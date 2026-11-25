import { render } from '@testing-library/react-native';
import { StyleSheet, Text as NativeText } from 'react-native';
import { Progress as NativeProgress } from './Progress';
import { ThemeProvider as IsleThemeProvider } from '../../theme/ThemeProvider';

it.each(['light', 'dark'] as const)('preserves the %s fork defaults, formatter memo and value while only the host font changes', async mode => {
  const formatter = jest.fn((percent: number) => `Styled ${percent}`)
  const tree = (font: string) => <IsleThemeProvider mode={mode} reducedMotion>
    <NativeProgress percent={35} testID="default-progress" />
    <NativeProgress percent={35} infoFormat={formatter} infoTextStyle={{ fontFamily: font }} testID="styled-progress" />
  </IsleThemeProvider>
  const screen = await render(tree('Host Progress A'))
  const plain = StyleSheet.flatten(screen.getByText('35%').props.style)
  const styled = StyleSheet.flatten(screen.getByText('Styled 35').props.style)
  expect(plain.fontFamily).toBeUndefined()
  expect(styled).toEqual({ ...plain, fontFamily: 'Host Progress A' })
  const host = screen.getByTestId('styled-progress')
  expect(host.props['aria-valuenow']).toBe(35)
  expect(host.props['aria-valuetext']).toBe('Styled 35')
  expect(formatter).toHaveBeenCalledTimes(1)
  await screen.rerender(tree('Host Progress B'))
  expect(screen.getByTestId('styled-progress')).toBe(host)
  expect(StyleSheet.flatten(screen.getByText('Styled 35').props.style)).toEqual({ ...plain, fontFamily: 'Host Progress B' })
  expect(formatter).toHaveBeenCalledTimes(1)
  expect(host.props['aria-valuenow']).toBe(35)
  expect(host.props['aria-valuetext']).toBe('Styled 35')
  await screen.unmount()
})

const shapes = (['light', 'dark'] as const).flatMap(mode => (['string', 'number', 'element', 'hidden'] as const).map(shape => ({ mode, shape })))
it.each(shapes)('preserves %s info ownership and accessibility for $mode/$shape', async ({ mode, shape }) => {
  const element = <NativeText testID="custom-info" style={{ fontFamily: 'Caller font', color: '#123456' }}>Caller status</NativeText>
  const result = shape === 'number' ? 0 : shape === 'element' ? element : 'Source status'
  const formatter = jest.fn(() => result)
  const screen = await render(<IsleThemeProvider mode={mode} reducedMotion><NativeProgress percent={35} infoFormat={formatter} showInfo={shape !== 'hidden'}
    infoTextStyle={[{ fontFamily: 'Host Progress' }, { letterSpacing: 0.3 }]} testID="typed-progress" /></IsleThemeProvider>)
  expect(formatter).toHaveBeenCalledTimes(1)
  const host = screen.getByTestId('typed-progress')
  expect(host.props['aria-valuenow']).toBe(35)
  expect(host.props['aria-valuetext']).toBe(typeof result === 'string' ? result : undefined)
  if (shape === 'element') {
    expect(screen.getByTestId('custom-info')).toHaveStyle({ fontFamily: 'Caller font', color: '#123456' })
  } else if (shape === 'hidden') {
    expect(screen.queryByText('Source status')).toBeNull()
  } else {
    expect(screen.getByText(String(result))).toHaveStyle({ fontFamily: 'Host Progress', letterSpacing: 0.3 })
  }
  await screen.unmount()
})
