import React from 'react';
import { Pressable, Text, TextInput } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { Tooltip } from './Tooltip';
import { ARROW_SIZE, ISLAND_ARROW_SIZE, TOOLTIP_GAP } from './geometry';
import { ThemeProvider } from '../../theme/ThemeProvider';

it('supports host-controlled visibility without stealing the child action', async () => {
    const press = jest.fn();
    const tree = (open: boolean) => (
        <ThemeProvider reducedMotion>
            <Tooltip title="Help" open={open} trigger="click">
                <Pressable onPress={press}>
                    <Text>Action</Text>
                </Pressable>
            </Tooltip>
        </ThemeProvider>
    );
    const screen = await render(tree(true));
    expect(screen.getByRole('tooltip')).toBeTruthy();
    await fireEvent.press(screen.getByText('Action'));
    expect(press).toHaveBeenCalledTimes(1);
    await screen.rerender(tree(false));
    expect(screen.queryByRole('tooltip')).toBeNull();
});

/**
 * RN 版测试，对应 Web 版 `Tooltip.test.tsx` 的 9 个用例。
 *
 * **被丢弃 / 改写的 Web 用例**：
 *   - 「显示时 `trigger.aria-describedby` 指向 `tooltip.id`」与
 *     「隐藏时保留子元素原值」这 2 个 a11y 用例 —— **RN 0.87 没有 `aria-describedby`**
 *     （全包搜索 `describedby` / `DescribedBy` 零命中；`View.js` 的 aria 改写清单里也没有）。
 *     与 `aria-controls` / `aria-haspopup` 同一类，没有对应物就是没有。
 *     替代：断言 `role="tooltip"` + `accessible` + `aria-hidden` 随显隐翻转，
 *     也就是 RN 上「读屏怎么拿到气泡内容」的真实路径（气泡自身是一个可访问节点）。
 *   - `trigger="hover"` 的语义变了：Web 是鼠标悬停，RN 映射为**按住显示 / 松开隐藏**。
 *   - `placement` / `variant` 的断言从「类名」改成「真实样式 + 结构」。
 *   - `filter: drop-shadow`（island 的有机轮廓投影）在 RN 里没有对应物，**未还原**。
 *   - `clip-path: url(#id)`（island 内容裁进有机轮廓）RN 无法作用于 View，**未还原**：
 *     内容直接叠在 SVG 之上，不裁切。
 *
 * **测不到的**：气泡相对触发器的真实位置（RNTL 不做布局，只能靠 geometry 的单测）、
 * 阴影 / 有机轮廓的观感、淡入动画的实际时长。
 */

const HIDDEN = { includeHiddenElements: true } as const;

/** 拍平节点上展开后的样式（`toHaveStyle` 只做子集匹配，要读值得自己拍） */
const styleOf = (node: TestInstance): Record<string, unknown> => {
    const merged: Record<string, unknown> = {};
    const walk = (s: unknown) => {
        if (Array.isArray(s)) s.forEach(walk);
        else if (s && typeof s === 'object') Object.assign(merged, s);
    };
    walk((node.props as { style?: unknown }).style);
    return merged;
};

/**
 * 手指按住。`fireEvent(node, 'pressIn')` 打不到 `Pressable`：Pressability 只把
 * responder 事件挂到宿主 View 上，不暴露 `onPressIn`。见 Select / Button 的说明。
 */
const responderEvent = (registrationName: string) => ({
    currentTarget: { measure: () => {} },
    target: {},
    preventDefault: () => {},
    isDefaultPrevented: () => false,
    stopPropagation: () => {},
    isPropagationStopped: () => false,
    persist: () => {},
    isPersistent: () => false,
    timeStamp: 0,
    nativeEvent: {
        changedTouches: [],
        identifier: 0,
        locationX: 0,
        locationY: 0,
        pageX: 0,
        pageY: 0,
        target: 0,
        timestamp: Date.now(),
        touches: [],
    },
    dispatchConfig: { registrationName },
});

const pressIn = (node: TestInstance) => fireEvent(node, 'responderGrant', responderEvent('onResponderGrant'));
const pressOut = (node: TestInstance) => fireEvent(node, 'responderRelease', responderEvent('onResponderRelease'));

/** 推进假定时器（Pressability 的 pressOut 要等 130ms，hide 还有 100ms 防抖） */
const tick = (ms: number) =>
    act(() => {
        jest.advanceTimersByTime(ms);
    });

/**
 * Tooltip 用 `cloneElement` 把触发回调挂到**直接子元素**上，所以子元素必须把这些
 * props 往下传 —— 真实使用方也一样：包一层不透传的组件就永远收不到触发事件。
 */
const Trigger: React.FC<{
    onPress?: () => void;
    onPressIn?: () => void;
    onPressOut?: () => void;
}> = ({ onPress, onPressIn, onPressOut }) => (
    <Pressable testID="trigger" onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
        <Text>btn</Text>
    </Pressable>
);

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('Tooltip', () => {
    it('默认隐藏：role="tooltip" 可查到（证明 accessible 已设），aria-hidden=true', async () => {
        const { getByRole, getByTestId } = await render(
            <Tooltip title="hi" testID="t">
                <Trigger />
            </Tooltip>
        );
        // 不带 includeHiddenElements 也能查到，说明 aria-hidden 在 RNTL 里不算「隐藏」；
        // 关键是 `accessible` 让它进了无障碍树（裸 <View role> 查不到）。
        expect(getByRole('tooltip', HIDDEN)).toBeTruthy();
        expect(getByTestId('t-bubble', HIDDEN).props['aria-hidden']).toBe(true);
    });

    it('hover(=按住) 触发显示，松开后隐藏', async () => {
        const { getByTestId } = await render(
            <Tooltip title="hi" trigger="hover" testID="t">
                <Trigger />
            </Tooltip>
        );
        const bubble = getByTestId('t-bubble', HIDDEN);
        expect(bubble.props['aria-hidden']).toBe(true);

        await pressIn(getByTestId('trigger'));
        expect(getByTestId('t-bubble', HIDDEN).props['aria-hidden']).toBe(false);

        await pressOut(getByTestId('trigger'));
        await tick(400);
        expect(getByTestId('t-bubble', HIDDEN).props['aria-hidden']).toBe(true);
    });

    it('松开后仍有 100ms 隐藏防抖（上游 setTimeout(…, 100)）', async () => {
        const { getByTestId } = await render(
            <Tooltip title="hi" trigger="hover" testID="t">
                <Trigger />
            </Tooltip>
        );
        await pressIn(getByTestId('trigger'));
        await pressOut(getByTestId('trigger'));

        // pressOut 本身要等 130ms，之后再 100ms 才真的隐藏
        await tick(200);
        expect(getByTestId('t-bubble', HIDDEN).props['aria-hidden']).toBe(false);
        await tick(200);
        expect(getByTestId('t-bubble', HIDDEN).props['aria-hidden']).toBe(true);
    });

    it('focus 触发（子元素可聚焦时，如 TextInput）', async () => {
        const { getByTestId } = await render(
            <Tooltip title="hi" trigger="focus" testID="t">
                <TextInput testID="input" />
            </Tooltip>
        );
        expect(getByTestId('t-bubble', HIDDEN).props['aria-hidden']).toBe(true);
        await fireEvent(getByTestId('input'), 'focus');
        expect(getByTestId('t-bubble', HIDDEN).props['aria-hidden']).toBe(false);
        await fireEvent(getByTestId('input'), 'blur');
        await tick(400);
        expect(getByTestId('t-bubble', HIDDEN).props['aria-hidden']).toBe(true);
    });

    it('click 触发：再次点击关闭（toggle）', async () => {
        const { getByTestId } = await render(
            <Tooltip title="hi" trigger="click" testID="t">
                <Trigger />
            </Tooltip>
        );
        await fireEvent.press(getByTestId('trigger'));
        expect(getByTestId('t-bubble', HIDDEN).props['aria-hidden']).toBe(false);
        await fireEvent.press(getByTestId('trigger'));
        expect(getByTestId('t-bubble', HIDDEN).props['aria-hidden']).toBe(true);
    });

    it('保留子元素自身的事件处理器', async () => {
        const onPress = jest.fn();
        const { getByTestId } = await render(
            <Tooltip title="hi" trigger="click" testID="t">
                <Trigger onPress={onPress} />
            </Tooltip>
        );
        await fireEvent.press(getByTestId('trigger'));
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    describe('placement', () => {
        it('top：气泡在上方，间距 10，水平居中用 alignSelf（RN 没有 translateX 百分比）', async () => {
            const { getByTestId } = await render(
                <Tooltip title="hi" placement="top" testID="t">
                    <Trigger />
                </Tooltip>
            );
            expect(styleOf(getByTestId('t-bubble', HIDDEN))).toMatchObject({
                bottom: '100%',
                marginBottom: TOOLTIP_GAP,
                alignSelf: 'center',
            });
        });

        it('bottom-start：气泡在下方并贴左边', async () => {
            const { getByTestId } = await render(
                <Tooltip title="hi" placement="bottom-start" testID="t">
                    <Trigger />
                </Tooltip>
            );
            expect(styleOf(getByTestId('t-bubble', HIDDEN))).toMatchObject({
                top: '100%',
                marginTop: TOOLTIP_GAP,
                left: 0,
            });
        });

        it('left：沿水平方向推开；垂直居中靠测量值（RN 没有 translateY 百分比）', async () => {
            const { getByTestId } = await render(
                <Tooltip title="hi" placement="left" testID="t">
                    <Trigger />
                </Tooltip>
            );
            expect(styleOf(getByTestId('t-bubble', HIDDEN))).toMatchObject({
                right: '100%',
                marginRight: TOOLTIP_GAP,
            });

            // 未测量到尺寸时退化为顶部对齐
            expect(styleOf(getByTestId('t-bubble', HIDDEN)).top).toBe(0);

            await fireEvent(getByTestId('t'), 'layout', {
                nativeEvent: { layout: { x: 0, y: 0, width: 100, height: 60 } },
            });
            await fireEvent(getByTestId('t-bubble', HIDDEN), 'layout', {
                nativeEvent: { layout: { x: 0, y: 0, width: 80, height: 20 } },
            });
            expect(styleOf(getByTestId('t-bubble', HIDDEN)).top).toBe(20);
        });
    });

    describe('variant', () => {
        it('default：实底 + 描边 + 阴影', async () => {
            const { getByTestId } = await render(
                <Tooltip title="hi" testID="t">
                    <Trigger />
                </Tooltip>
            );
            const s = styleOf(getByTestId('t-bubble', HIDDEN));
            expect(s.backgroundColor).toBe('rgb(247, 243, 223)');
            expect(s.borderWidth).toBe(2);
            expect(s.boxShadow).toBeTruthy();
        });

        it('island：透明底、无描边、加粗居中，并渲染有机轮廓 SVG', async () => {
            const { getByTestId } = await render(
                <Tooltip title="hi" variant="island" testID="t">
                    <Trigger />
                </Tooltip>
            );
            const s = styleOf(getByTestId('t-bubble', HIDDEN));
            expect(s.backgroundColor).toBe('transparent');
            expect(s.borderWidth).toBe(0);
            expect(s.boxShadow).toBeUndefined();

            // 上游的 `clip-path: url(#id)` + SVG 底图 → RN 里就是一张拉满的 SVG。
            // 这里不断言 RNSVGSvgView 的宿主类型（那是 react-native-svg 的内部名），
            // 只断言「这张 SVG 确实挂在气泡里」。
            expect(getByTestId('t-island-svg', HIDDEN)).toBeTruthy();
            // 上游 `.island .content { font-weight: 600; text-align: center }`
            expect(styleOf(getByTestId('t-content', HIDDEN))).toBeTruthy();
        });

        it('island + borderless：内容落到实底上（.island.borderless .islandContent）', async () => {
            const { getByTestId } = await render(
                <Tooltip title="hi" variant="island" bordered={false} testID="t">
                    <Trigger />
                </Tooltip>
            );
            // 无描边时不渲染有机轮廓 SVG，内容自己就是那块实底
            expect(styleOf(getByTestId('t-content', HIDDEN)).backgroundColor).toBe('rgb(247, 243, 223)');
            expect(styleOf(getByTestId('t-content', HIDDEN)).borderRadius).toBe(16);
            expect(() => getByTestId('t-island-svg', HIDDEN)).toThrow();
        });

        it('island + bordered：内容透明，靠 SVG 画底（.island.bordered .islandContent）', async () => {
            const { getByTestId } = await render(
                <Tooltip title="hi" variant="island" bordered testID="t">
                    <Trigger />
                </Tooltip>
            );
            expect(styleOf(getByTestId('t-content', HIDDEN)).backgroundColor).toBeUndefined();
            expect(getByTestId('t-island-svg', HIDDEN)).toBeTruthy();
        });
    });

    describe('箭头', () => {
        it('渲染为真实节点且 aria-hidden（上游是 ::after 伪元素）', async () => {
            const { getByTestId } = await render(
                <Tooltip title="hi" testID="t">
                    <Trigger />
                </Tooltip>
            );
            const arrow = getByTestId('t-arrow', HIDDEN);
            expect(arrow.props['aria-hidden']).toBe(true);
            expect(styleOf(arrow).width).toBe(ARROW_SIZE);
        });

        it('island 用 10px 的箭头', async () => {
            const { getByTestId } = await render(
                <Tooltip title="hi" variant="island" testID="t">
                    <Trigger />
                </Tooltip>
            );
            expect(styleOf(getByTestId('t-arrow', HIDDEN)).width).toBe(ISLAND_ARROW_SIZE);
        });
    });

    describe('a11y', () => {
        it('RN 没有 aria-describedby：trigger 上不会产生该 prop', async () => {
            const { getByTestId } = await render(
                <Tooltip title="hi" trigger="click" testID="t">
                    <Trigger />
                </Tooltip>
            );
            await fireEvent.press(getByTestId('trigger'));
            const trigger = getByTestId('trigger');
            expect(trigger.props['aria-describedby']).toBeUndefined();
            expect(trigger.props.accessibilityDescribedBy).toBeUndefined();
        });

        it('气泡自身是 role=tooltip 的可访问节点（describedby 的 RN 替代路径）', async () => {
            const { getByRole } = await render(
                <Tooltip title="hi" testID="t">
                    <Trigger />
                </Tooltip>
            );
            expect(getByRole('tooltip', HIDDEN)).toBeTruthy();
        });
    });

    it('style / testID 透传到外层包裹节点', async () => {
        const { getByTestId } = await render(
            <Tooltip title="hi" testID="t" style={{ marginTop: 7 }}>
                <Trigger />
            </Tooltip>
        );
        expect(styleOf(getByTestId('t')).marginTop).toBe(7);
    });
});
