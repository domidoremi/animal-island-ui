import { useEffect, useState } from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Pressable, processColor, StyleSheet, Text, TextInput } from 'react-native';
import { Tooltip } from './Tooltip';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { resolveNativeTheme } from '../../theme/appearance';

const messages = { en: 'Clear search', ja: '検索をクリア', 'zh-CN': '清除搜索' }
const modes = ['light', 'dark'] as const
const variants = ['default', 'island'] as const
const placements = ['top', 'top-start', 'top-end', 'bottom', 'bottom-start', 'bottom-end',
  'left', 'left-start', 'left-end', 'right', 'right-start', 'right-end'] as const
const languages = ['en', 'ja', 'zh-CN'] as const
const cases = modes.flatMap(mode => variants.flatMap(variant => [true, false].flatMap(bordered =>
  placements.flatMap(placement => languages.map(language => ({ mode, variant, bordered, placement, language }))))))
const HIDDEN = { includeHiddenElements: true } as const

function expected(mode: typeof modes[number]) {
  const theme = resolveNativeTheme(mode)
  return mode === 'dark' ? { backgroundColor: theme.colors.bgSecondary, borderColor: theme.colors.border,
    color: theme.colors.textSecondary } : { backgroundColor: 'rgb(247, 243, 223)', borderColor: '#c4b89e', color: '#725d42' }
}

it.each(cases)('projects native tooltip palette $mode/$variant/bordered=$bordered/$placement/$language', async ({ mode, variant, bordered, placement, language }) => {
  const palette = expected(mode), action = jest.fn()
  const screen = await render(<ThemeProvider mode={mode} reducedMotion><Tooltip open title={messages[language]}
    variant={variant} bordered={bordered} placement={placement} testID="palette-tip">
    <Pressable onPress={action}><Text>Trigger</Text></Pressable>
  </Tooltip></ThemeProvider>)
  try {
    const bubble = screen.getByTestId('palette-tip-bubble', HIDDEN)
    const arrow = screen.getByTestId('palette-tip-arrow', HIDDEN)
    expect(bubble.props.role).toBe('tooltip')
    expect(bubble.props['aria-hidden']).toBe(false)
    expect(bubble.props.pointerEvents).toBe('auto')
    expect(screen.getByText(messages[language], HIDDEN)).toHaveStyle({ color: palette.color, fontSize: 12,
      fontWeight: variant === 'island' ? '600' : '500', lineHeight: variant === 'island' ? 19 : 18 })
    expect(arrow).toHaveStyle({ backgroundColor: palette.backgroundColor, borderColor: palette.borderColor })
    if (variant === 'default') {
      expect(bubble).toHaveStyle({ backgroundColor: palette.backgroundColor, paddingHorizontal: 12,
        paddingVertical: 6, maxWidth: 240, borderRadius: 16 })
      if (bordered) expect(bubble).toHaveStyle({ borderColor: palette.borderColor, borderWidth: 2 })
    } else {
      expect(bubble).toHaveStyle({ backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 0,
        paddingVertical: 0, maxWidth: 280 })
      if (bordered) {
        expect(screen.getByTestId('palette-tip-island-svg', HIDDEN)).toBeTruthy()
        const paths = screen.container.queryAll(node => node.type === 'RNSVGPath' && typeof node.props.d === 'string')
        expect(paths.length).toBeGreaterThan(0)
        for (const path of paths) expect(path.props).toMatchObject({ fill: { type: 0, payload: processColor(palette.backgroundColor) }, stroke: { type: 0, payload: processColor(palette.borderColor) } })
        expect(StyleSheet.flatten(screen.getByTestId('palette-tip-content', HIDDEN).props.style).backgroundColor).toBeUndefined()
      } else {
        expect(screen.queryByTestId('palette-tip-island-svg', HIDDEN)).toBeNull()
        expect(screen.getByTestId('palette-tip-content', HIDDEN)).toHaveStyle({ backgroundColor: palette.backgroundColor })
        expect(arrow).toHaveStyle({ width: 14, height: 14, borderRadius: 7 })
      }
    }
    await fireEvent.press(screen.getByText('Trigger'))
    expect(action).toHaveBeenCalledTimes(1)
  } finally { await screen.unmount() }
})

const changes = variants.flatMap(variant => [true, false].flatMap(bordered => languages.map(language => ({ variant, bordered, language }))))
it.each(changes)('updates tooltip mode without rebuilding the owner or trigger $variant/$bordered/$language', async ({ variant, bordered, language }) => {
  const mounted = jest.fn(), action = jest.fn()
  function Owner() {
    const [draft, setDraft] = useState('Unsent draft')
    useEffect(() => { mounted() }, [])
    return <><TextInput testID="palette-draft" value={draft} onChangeText={setDraft} selection={{ start: 1, end: 4 }} />
      <Tooltip open title={messages[language]} variant={variant} bordered={bordered} trigger="click" testID="changing-tip">
        <Pressable testID="palette-trigger" onPress={action}><Text>Trigger</Text></Pressable>
      </Tooltip></>
  }
  const tree = (mode: typeof modes[number], open = true) => <ThemeProvider mode={mode} reducedMotion>{open ? <Owner /> : null}</ThemeProvider>
  const screen = await render(tree('light'))
  try {
    const draft = screen.getByTestId('palette-draft'), trigger = screen.getByTestId('palette-trigger')
    const bubble = screen.getByTestId('changing-tip-bubble', HIDDEN)
    await fireEvent.changeText(draft, 'Preserved theme draft')
    for (const mode of ['light', 'dark', 'light', 'dark'] as const) {
      await screen.rerender(tree(mode))
      expect(screen.getByTestId('palette-draft')).toBe(draft)
      expect(draft.props.value).toBe('Preserved theme draft')
      expect(draft.props.selection).toEqual({ start: 1, end: 4 })
      expect(screen.getByTestId('palette-trigger')).toBe(trigger)
      expect(screen.getByTestId('changing-tip-bubble', HIDDEN)).toBe(bubble)
      expect(screen.getByText(messages[language], HIDDEN)).toHaveStyle({ color: expected(mode).color })
      expect(screen.getByTestId('changing-tip-arrow', HIDDEN)).toHaveStyle({ backgroundColor: expected(mode).backgroundColor,
        borderColor: expected(mode).borderColor })
      await fireEvent.press(trigger)
      expect(bubble.props['aria-hidden']).toBe(false)
    }
    expect(mounted).toHaveBeenCalledTimes(1)
    expect(action).toHaveBeenCalledTimes(4)
  } finally { await screen.unmount() }
})
