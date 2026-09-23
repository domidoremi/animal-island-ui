import React, { useState } from 'react';
import { View } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { Input } from './Input';
import { colors } from '../../theme/tokens';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { resolveNativeTheme } from '../../theme/appearance';

/**
 * RN 版测试，对应 Web 版 `Input.test.tsx` 的 14 个用例。
 *
 * **被丢弃的 Web 用例及原因**
 *
 *   - `渲染基础 textbox`（`getByRole('textbox')`）—— **RN 0.87 没有 `textbox` 这个
 *     role**：`Role` 联合类型里只有 `searchbox` / `combobox`，没有 `textbox`；
 *     `TextInput` 也没有隐式 role（RNTL 的 `getRole` 只给 `Text` 兜底成 `text`）。
 *     改用 `getByTestId('i-input')`，并断言宿主节点类型就是 `TextInput`。
 *   - `status=error … toBeInvalid()` —— RN 没有 invalid accessibility trait；
 *     保留错误态投影，并透传 aria-invalid 供 React Native Web 使用。
 *   - `清除按钮支持键盘聚焦与 Enter 触发` —— RN 没有 DOM 键盘焦点 / Enter 事件，
 *     `outline: 2px solid` 的 `:focus-visible` 也没有对应物。替换为
 *     「清除按钮是可访问的 button，且带 aria-label」。
 *   - 两条 `Bug 复现`（clear 触发的 onChange 事件缺 `preventDefault` /
 *     `stopPropagation`，以及 `target.name/type/id` 残缺）—— 测的是 **DOM
 *     SyntheticEvent 与原生 `<input>` 属性**的管道：RN 没有 DOM 事件派发
 *     （上游为此去改 value setter 再 `dispatchEvent('input')`，RN 侧直接调回调），
 *     `name` / `type` 也不是 TextInput 的属性（`id` 的对应物是 `nativeID`）。
 *     `target.value` 这一半仍然保留并有断言（见「clear」一节）。
 *
 * **另有两处上游没有的补充**：焦点环（增量，见 Input.tsx 的 `FOCUS_RING`）、
 * 以及 CSS 层叠优先级（`.wrapper-small:not(.wrapper-no-shadow)` 压过 `.wrapper-error`）。
 *
 * ⚠️ 本文件用 `fireEvent.changeText` —— 它是 RNTL 唯一能命中 TextInput 的写法
 * （按 `onChangeText` 找 handler），所以组件内部用的是 `onChangeText`，
 * 对外的 `onChange` 名字与上游一致。
 */
const child = (node: unknown) => node as TestInstance;

/** 读展开后的样式对象（`toHaveStyle` 只做子集匹配，这里用于精确读值） */
const styleOf = (node: TestInstance) => {
    const merged: Record<string, unknown> = {};
    const walk = (s: unknown) => {
        if (Array.isArray(s)) s.forEach(walk);
        else if (s && typeof s === 'object') Object.assign(merged, s);
    };
    walk(node.props.style);
    return merged;
};

const errorShadow = `0 3px 0 0 ${colors.errorActive}`; // @error-color-active
const warningShadow = `0 3px 0 0 ${colors.warningActive}`; // @warning-color-active
const focusRing = '0 0 0 3px rgba(245, 195, 28, 0.25)';

describe('Input', () => {
    it('does not render a raw empty string inside the native wrapper when clear is enabled', async () => {
        const screen = await render(<Input testID="empty" allowClear value="" />);
        // Renderer children discard empty strings; inspect the raw View props so
        // this catches the `allowClear && currentValue && ...` RN Web regression.
        expect(
            React.Children.toArray(screen.getByTestId('empty').props.children).filter(
                (node) => typeof node === 'string'
            )
        ).toHaveLength(0);
    });
    it('preserves native events, refs and selection while emitting both string and Form changes', async () => {
        const onChange = jest.fn();
        const onChangeText = jest.fn();
        const onNativeChange = jest.fn();
        const inputRef = jest.fn();
        const screen = await render(
            <Input
                defaultValue="draft"
                allowClear
                onChange={onChange}
                onChangeText={onChangeText}
                inputRef={inputRef}
                inputProps={{ testID: 'native', selection: { start: 2, end: 2 }, onChange: onNativeChange }}
            />
        );
        expect(inputRef).toHaveBeenCalled();
        expect(screen.getByTestId('native').props.selection).toEqual({ start: 2, end: 2 });
        const event = { nativeEvent: { text: 'edited', target: 7, eventCount: 1 } };
        await fireEvent(screen.getByTestId('native'), 'change', event);
        expect(onNativeChange).toHaveBeenCalledWith(event);
        await fireEvent.changeText(screen.getByTestId('native'), 'edited');
        expect(onChangeText).toHaveBeenLastCalledWith('edited');
        expect(onChange).toHaveBeenLastCalledWith({ target: { value: 'edited' }, nativeEvent: { text: 'edited' } });
        await fireEvent.press(screen.getByRole('button', { name: '清除' }));
        expect(onChangeText).toHaveBeenLastCalledWith('');
        expect(screen.getByTestId('native').props.value).toBe('');
    });

    it('uses the provider dark palette and keeps disabled native input and clear behavior aligned', async () => {
        const screen = await render(
            <ThemeProvider mode="dark">
                <Input value="locked" disabled allowClear testID="dark" />
            </ThemeProvider>
        );
        const theme = resolveNativeTheme('dark');
        expect(screen.getByTestId('dark')).toHaveStyle({ backgroundColor: theme.colors.bgDisabled });
        expect(screen.getByTestId('dark-input')).toHaveStyle({ color: theme.colors.textDisabled });
        expect(screen.getByTestId('dark-input').props.accessibilityState.disabled).toBe(true);
        expect(screen.getByTestId('dark-input').props.editable).toBe(false);
        expect(screen.queryByRole('button', { name: '清除' })).toBeNull();
    });

    describe('渲染', () => {
        it('渲染基础输入框（Web 的 role=textbox 在 RN 里没有对应 role，改用 testID）', async () => {
            const { getByTestId } = await render(<Input testID="i" />);
            const input = getByTestId('i-input');
            expect(child(input).type).toBe('TextInput');
            // 上游的 role=textbox 语义在 RN 由 TextInput 这个宿主组件本身承担
            expect(input.props.role).toBeUndefined();
        });

        it('应用 size 规格（height / padding / radius / fontSize）', async () => {
            const sizes = [
                { size: 'small', height: 32, paddingHorizontal: 14, borderRadius: 40, fontSize: 12 },
                { size: 'middle', height: 40, paddingHorizontal: 18, borderRadius: 50, fontSize: 14 },
                { size: 'large', height: 48, paddingHorizontal: 22, borderRadius: 50, fontSize: 16 },
            ] as const;
            for (const spec of sizes) {
                const { getByTestId, unmount } = await render(<Input testID="i" size={spec.size} />);
                expect(getByTestId('i')).toHaveStyle({
                    height: spec.height,
                    paddingHorizontal: spec.paddingHorizontal,
                    borderRadius: spec.borderRadius,
                });
                expect(getByTestId('i-input')).toHaveStyle({ fontSize: spec.fontSize });
                await unmount();
            }
        });

        it('status=error keeps error styling and web invalid semantics without inventing a native invalid state', async () => {
            const { getByTestId } = await render(<Input testID="i" shadow status="error" />);
            expect(getByTestId('i')).toHaveStyle({ boxShadow: errorShadow });
            expect(getByTestId('i-input').props['aria-invalid']).toBe(true);
            expect(getByTestId('i-input').props.accessibilityState).toEqual({ disabled: false });
        });

        it('status=warning 时容器投影转警告色', async () => {
            const { getByTestId } = await render(<Input testID="i" shadow status="warning" />);
            expect(getByTestId('i')).toHaveStyle({ boxShadow: warningShadow });
        });

        it('渲染 prefix / suffix', async () => {
            const { getByTestId } = await render(
                <Input testID="i" prefix={<View testID="prefix" />} suffix={<View testID="suffix" />} />
            );
            expect(getByTestId('i-prefix')).toBeTruthy();
            expect(getByTestId('i-suffix')).toBeTruthy();
            expect(getByTestId('prefix')).toBeTruthy();
            expect(getByTestId('suffix')).toBeTruthy();
            // 结构：prefix → input → suffix（无 clear 时）
            expect(getByTestId('i').children).toHaveLength(3);
        });

        it('无 prefix / suffix 时只渲染输入框', async () => {
            const { getByTestId } = await render(<Input testID="i" />);
            expect(getByTestId('i').children).toHaveLength(1);
        });
    });

    describe('非受控', () => {
        it('defaultValue 设定初始值', async () => {
            const { getByTestId } = await render(<Input testID="i" defaultValue="hello" />);
            expect(getByTestId('i-input')).toHaveDisplayValue('hello');
        });

        it('输入触发 onChange 且更新值', async () => {
            const onChange = jest.fn();
            const { getByTestId } = await render(<Input testID="i" onChange={onChange} />);
            const input = getByTestId('i-input');

            await fireEvent.changeText(input, 'ab');
            expect(onChange).toHaveBeenCalledTimes(1);
            expect(input).toHaveDisplayValue('ab');
        });

        it('onChange 事件同时带 target.value 与 nativeEvent.text', async () => {
            const onChange = jest.fn();
            const { getByTestId } = await render(<Input testID="i" onChange={onChange} />);
            await fireEvent.changeText(getByTestId('i-input'), 'xy');

            // target.value：与上游 `e.target.value` 同形，供 Form 取值
            // nativeEvent.text：RN TextInput 的原生字段
            expect(onChange.mock.calls[0][0]).toEqual({
                target: { value: 'xy' },
                nativeEvent: { text: 'xy' },
            });
        });
    });

    describe('受控', () => {
        it('value 受控生效，父级回写后 UI 同步', async () => {
            const onChange = jest.fn();
            // Web 版用 @test/components 的 ControlledHost；RN 侧内联一个等价宿主
            const Host = () => {
                const [value, setValue] = useState('');
                return (
                    <Input
                        testID="i"
                        value={value}
                        onChange={(e) => {
                            onChange(e.target.value);
                            setValue(e.target.value);
                        }}
                    />
                );
            };
            const { getByTestId } = await render(<Host />);
            await fireEvent.changeText(getByTestId('i-input'), 'x');

            expect(onChange).toHaveBeenLastCalledWith('x');
            expect(getByTestId('i-input')).toHaveDisplayValue('x');
        });

        it('受控且父级不回写时值不变', async () => {
            const onChange = jest.fn();
            const { getByTestId } = await render(<Input testID="i" value="fixed" onChange={onChange} />);
            await fireEvent.changeText(getByTestId('i-input'), 'other');

            expect(onChange).toHaveBeenCalledWith({ target: { value: 'other' }, nativeEvent: { text: 'other' } });
            expect(getByTestId('i-input')).toHaveDisplayValue('fixed');
        });
    });

    describe('disabled / clear', () => {
        it('disabled 时不可输入，容器加禁用底色与降透明度', async () => {
            const onChange = jest.fn();
            const { getByTestId } = await render(<Input testID="i" disabled defaultValue="a" onChange={onChange} />);
            const input = getByTestId('i-input');

            // Web 的 <input disabled>；RN 的对应物是 editable={false}
            expect(input.props.editable).toBe(false);
            await fireEvent.changeText(input, 'b');
            expect(onChange).not.toHaveBeenCalled();

            // `.wrapper-disabled { background: #ece8dc; opacity: 0.6 }`
            expect(getByTestId('i')).toHaveStyle({ backgroundColor: '#ece8dc', opacity: 0.6 });
            // `.wrapper-disabled .input { color: #c4b89e }`
            expect(input).toHaveStyle({ color: '#c4b89e' });
        });

        it('allowClear 显示清除按钮，点击后清空并触发 onClear / onChange', async () => {
            const onClear = jest.fn();
            const onChange = jest.fn();
            const { getByTestId, getByRole } = await render(
                <Input testID="i" allowClear defaultValue="abc" onChange={onChange} onClear={onClear} />
            );

            const clear = getByRole('button');
            await fireEvent.press(clear);

            expect(onClear).toHaveBeenCalledTimes(1);
            expect(onChange).toHaveBeenCalledTimes(1);
            // 上游那条 Bug 测试里仍然成立的一半：清除后 onChange 的 target.value 是 ''
            expect(onChange.mock.calls[0][0]).toEqual({ target: { value: '' }, nativeEvent: { text: '' } });
            expect(getByTestId('i-input')).toHaveDisplayValue('');
        });

        it('allowClear 在空值时不渲染清除按钮', async () => {
            const { queryByRole } = await render(<Input allowClear />);
            expect(queryByRole('button')).toBeNull();
        });

        it('allowClear 在 disabled 时不渲染清除按钮', async () => {
            const { queryByRole } = await render(<Input allowClear disabled defaultValue="abc" />);
            expect(queryByRole('button')).toBeNull();
        });

        it('清除按钮是可访问的 button 且带默认 / 自定义 aria-label', async () => {
            // Web 版这条测「原生 button 可 Tab 聚焦 + Enter 触发」；
            // RN 没有键盘焦点，改为断言等价的可访问语义（role + 可访问名）。
            const { getByTestId, rerender } = await render(<Input testID="i" allowClear defaultValue="abc" />);
            const clear = getByTestId('i-clear');
            expect(clear.props.accessibilityRole).toBe('button');
            expect(clear.props.accessibilityLabel).toBe('清除');

            await rerender(<Input testID="i" allowClear defaultValue="abc" clearAriaLabel="Clear" />);
            expect(getByTestId('i-clear').props.accessibilityLabel).toBe('Clear');
            expect(getByTestId('i-clear')).toHaveAccessibleName('Clear');
        });

        it('清除按钮上的 × 字形包在 Text 里（RN 要求）', async () => {
            const { getByTestId } = await render(<Input testID="i" allowClear defaultValue="abc" />);
            const clear = getByTestId('i-clear');
            expect(child(clear.children[0]).type).toBe('Text');
            expect(clear).toHaveTextContent('×');
        });
    });

    describe('投影层叠（逐条复刻 CSS 优先级）', () => {
        it('默认（middle + shadow=false）无投影', async () => {
            const { getByTestId } = await render(<Input testID="i" />);
            expect(styleOf(getByTestId('i')).boxShadow).toBeUndefined();
        });

        it('shadow 时按尺寸取 2px / 3px / 4px 硬偏移投影', async () => {
            const cases = [
                { size: 'small', boxShadow: '0 2px 0 0 #d4c9b4' },
                { size: 'middle', boxShadow: '0 3px 0 0 #d4c9b4' },
                { size: 'large', boxShadow: '0 4px 0 0 #d4c9b4' },
            ] as const;
            for (const c of cases) {
                const { getByTestId, unmount } = await render(<Input testID="i" shadow size={c.size} />);
                expect(getByTestId('i')).toHaveStyle({ boxShadow: c.boxShadow });
                await unmount();
            }
        });

        it('0-2-0 的尺寸规则压过 status：小号 + error 仍是灰色尺寸投影', async () => {
            // `.wrapper-small:not(.wrapper-no-shadow)`（L47）权重高于 `.wrapper-error`（L70）
            const { getByTestId } = await render(<Input testID="i" shadow size="small" status="error" />);
            expect(getByTestId('i')).toHaveStyle({ boxShadow: '0 2px 0 0 #d4c9b4' });
        });

        it('同为 0-1-0 时后写的胜：no-shadow / disabled 都被 status 压过', async () => {
            // `.wrapper-error`（L71）在 `.wrapper-no-shadow`（L33）与 `.wrapper-disabled`（L22）之后
            const { getByTestId, rerender } = await render(<Input testID="i" status="error" />);
            expect(getByTestId('i')).toHaveStyle({ boxShadow: errorShadow });

            await rerender(<Input testID="i" disabled status="error" />);
            expect(getByTestId('i')).toHaveStyle({ boxShadow: errorShadow });
        });
    });

    // ---------- RN 专有：焦点态（Web 靠 `:focus` 伪类，RN 只能靠 onFocus / onBlur）----------

    describe('焦点态', () => {
        it('聚焦时叠加焦点环，失焦后移除', async () => {
            const { getByTestId } = await render(<Input testID="i" />);
            const input = getByTestId('i-input');
            expect(styleOf(getByTestId('i')).boxShadow).toBeUndefined();

            await fireEvent(input, 'focus');
            expect(styleOf(getByTestId('i')).boxShadow).toBe(focusRing);

            await fireEvent(input, 'blur');
            expect(styleOf(getByTestId('i')).boxShadow).toBeUndefined();
        });

        it('焦点环与静止投影叠加（逗号分隔的多段 boxShadow）', async () => {
            const { getByTestId } = await render(<Input testID="i" shadow />);
            await fireEvent(getByTestId('i-input'), 'focus');
            expect(styleOf(getByTestId('i')).boxShadow).toBe(`0 3px 0 0 #d4c9b4, ${focusRing}`);
        });

        it('onFocus / onBlur 回调透传', async () => {
            const onFocus = jest.fn();
            const onBlur = jest.fn();
            const { getByTestId } = await render(<Input testID="i" onFocus={onFocus} onBlur={onBlur} />);
            const input = getByTestId('i-input');

            await fireEvent(input, 'focus');
            await fireEvent(input, 'blur');
            expect(onFocus).toHaveBeenCalledTimes(1);
            expect(onBlur).toHaveBeenCalledTimes(1);
        });
    });

    describe('透传', () => {
        it('style / testID 透传，且 style 排在最后可覆盖默认值', async () => {
            const { getByTestId } = await render(<Input testID="i" shadow style={{ marginTop: 4, height: 99 }} />);
            const root = getByTestId('i');
            expect(root).toHaveStyle({ marginTop: 4, height: 99 });
            expect(root).toHaveStyle({ backgroundColor: 'rgb(250, 248, 243)' });
        });

        it('placeholder / placeholderTextColor / nativeID / aria-label 透传到输入框', async () => {
            const { getByTestId, getByLabelText } = await render(
                <Input
                    testID="i"
                    placeholder="请输入"
                    placeholderTextColor="#123456"
                    nativeID="field-1"
                    aria-label="用户名"
                />
            );
            const input = getByTestId('i-input');
            expect(input.props.placeholder).toBe('请输入');
            expect(input.props.placeholderTextColor).toBe('#123456');
            expect(input.props.nativeID).toBe('field-1');
            // ⚠️ jest preset **连 `TextInput` 一起 mock 了**（`mocks/TextInput.js` →
            // `mockComponent`），props 原样透传到宿主节点，所以看到的是**未改写**的
            // `aria-label`（RN-PORT.md 只记了 `View` 被 mock，`TextInput` 同理）。
            // 真机上 `TextInput` 继承 `ViewProps`，会由 `View.js` 改写成
            // `accessibilityLabel`。这里只能证明「透传成立」。
            expect(input.props['aria-label']).toBe('用户名');
            // RNTL 的 `computeAriaLabel` 先读 `aria-label`，所以可访问名仍然成立
            expect(getByLabelText('用户名')).toBeTruthy();
        });

        it('未指定 placeholderTextColor 时默认 #c4b89e（CSS ::placeholder 的颜色）', async () => {
            const { getByTestId } = await render(<Input testID="i" placeholder="p" />);
            expect(getByTestId('i-input').props.placeholderTextColor).toBe('#c4b89e');
        });

        it('输入框文字颜色与字重 / 字距 / 行高按上游声明', async () => {
            const { getByTestId } = await render(<Input testID="i" />);
            // `.input { color: #794f3f; font-weight: 500; letter-spacing: 0.01em;
            //          line-height: var(--animal-line-height-base) }`
            expect(getByTestId('i-input')).toHaveStyle({
                color: '#794f3f',
                fontWeight: '500',
                letterSpacing: 0.14,
                lineHeight: 14 * 1.5715,
            });
        });
    });
});
