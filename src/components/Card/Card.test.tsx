import React from 'react';
import { View } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { Card, type CardColor, type CardPattern } from './Card';

/**
 * RN 版测试，对应 Web 版 `Card.test.tsx` 的 21 个用例。
 *
 * **被改写（而非丢弃）的用例**：
 *   - 全部 `toHaveClass(styles.x)` 断言 → 改成 `toHaveStyle`。RN 没有类系统，
 *     组件内部把各变体合成为一个 style 对象，所以这里断言的是**合成后的最终值**
 *     （比 Web 断言「类名在不在」更强）。副作用：Web 的
 *     「type + color + pattern 三者组合时同时应用对应 class」只能断言层叠结果
 *     —— 同优先级 CSS 按样式表顺序，`.pattern-*` 在最后，所以 pattern 盖过
 *     color / dashed。RN 侧复刻了同样的覆盖顺序（见 Card.tsx 的 COLOR_SPEC 注释）。
 *   - 「透传原生 div 属性（onClick / className / style）」→ 拆成 `onPress`（第 15 条）
 *     与 `style` / `testID`（第 17 条）。`className` 在 RN 无对应物，丢弃。
 *   - 「aria-* / data-* 透传」→ `data-*` 丢弃（RN 无对应物），`role` / `aria-label` /
 *     `aria-labelledby` 保留为显式 props。注意 RN-PORT.md 的 View-mock 表：jest preset
 *     把 `View` 整个 mock 掉了，`aria-*` **不会**被改写成 `accessibility*`，
 *     所以下面读的是原始 props —— 只证明「组件把这个 prop 转发下去了」。
 *   - `className 透传仍然生效,且与 hoverable 共存` → 由 testID + style + 按下态覆盖。
 *
 * **被丢弃的用例**（RN 无对应能力）：
 *   - `onMouseDown` / hover 相关的类断言：触摸设备没有 hover（见 Card.tsx 的
 *     `hoverable` 注释），Web 的 `.card-hoverable:hover` 与
 *     `.card-hoverable.card-dashed:hover` 改挂在**按下态**上，用例 19 / 20 覆盖。
 *
 * **RN 专有补充**：
 *   - 文本子节点必须包在 `<Text>` 里（RN 不允许裸字符串作为 View 的子节点）。
 *   - 未传 `onPress` 时根节点是纯容器 `View`（`Pressable` 默认 `accessible`，
 *     会把整张卡片的子节点合并成一个无障碍节点）。
 *   - 花纹层是装饰性的：`aria-hidden` + `pointerEvents="none"`。
 *   - 花纹的 SVG 几何（tile 尺寸、偏移、圆心、半径、点色）—— 这是 Web 侧
 *     CSS `radial-gradient` 无法在测试里断言的部分，RN 换成 `<Pattern>` 后可以逐值校验。
 */
const child = (node: unknown) => node as TestInstance;

/** 花纹层带 `aria-hidden`，RNTL 默认把它排除在查询之外，所以要显式带上 */
const HIDDEN = { includeHiddenElements: true } as const;

/** 取根节点上展开后的样式对象（`toHaveStyle` 只做子集匹配，读值要用这个） */
const styleOf = (node: TestInstance) => {
    const merged: Record<string, unknown> = {};
    const walk = (s: unknown) => {
        if (Array.isArray(s)) s.forEach(walk);
        else if (s && typeof s === 'object') Object.assign(merged, s);
    };
    walk(node.props.style);
    return merged;
};

/**
 * 模拟「手指按住」。
 *
 * `Pressable` 的 `pressed` 由 Pressability 驱动，而 Pressability 只把 responder 事件
 * 挂到宿主 View 上（`onResponderGrant` / `onResponderRelease`），不暴露 `onPressIn`
 * —— 所以 `fireEvent(node, 'pressIn')` 打不到它。这里复刻 RNTL 内部的事件形状，
 * `currentTarget` 必须带 `measure` 桩：Pressability 首次转按下态时会调
 * `this._responderID.measure(...)`，而测试渲染器的宿主实例没有原生 `measure`。
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

/**
 * react-native-svg 会把颜色解析成 ARGB 整数（`fill: { type: 0, payload }`），
 * 这里还原成 `rgba(r, g, b, a)`，用来校验 CSS 里写死的点色（含 alpha）。
 * alpha 的量化误差（`round(a * 255)`）与 CSS 的写法一致，能逐字对回。
 */
const decodeArgb = (payload: number) => {
    // 用除法取字节（而不是位运算）以避开 eslint 的 no-bitwise
    const a = Math.floor(payload / 0x1000000) % 0x100;
    const r = Math.floor(payload / 0x10000) % 0x100;
    const g = Math.floor(payload / 0x100) % 0x100;
    const b = payload % 0x100;
    return `rgba(${r}, ${g}, ${b}, ${Number((a / 255).toFixed(2))})`;
};

/**
 * 从花纹层里取出两层 <Pattern>、其圆点与铺满的 <Rect>。
 *
 * 结构（实测）：`<View>` → `<RNSVGSvgView>` → `<RNSVGGroup>`（react-native-svg 自己
 * 包的一层，Divider 的测试同样踩到）→ `[<RNSVGDefs>, <RNSVGRect>, <RNSVGRect>]`。
 */
const patternDots = (layer: TestInstance) => {
    const svg = child(layer.children[0]);
    const group = child(svg.children[0]);
    const [defs, primaryRect, secondaryRect] = group.children.map(child);
    const [primaryPattern, secondaryPattern] = defs.children.map(child);
    return {
        primary: { pattern: primaryPattern, dot: child(primaryPattern.children[0]), rect: primaryRect },
        secondary: { pattern: secondaryPattern, dot: child(secondaryPattern.children[0]), rect: secondaryRect },
    };
};

/** 颜色变体 —— 逐条抄自 `card.module.less` 的 `.card-{color}` */
const COLOR_EXPECT: Record<Exclude<CardColor, 'default'>, { backgroundColor: string; color: string }> = {
    'app-pink': { backgroundColor: '#f8a6b2', color: '#fff' },
    purple: { backgroundColor: '#b77dee', color: '#fff' },
    'app-blue': { backgroundColor: '#889df0', color: '#fff' },
    'app-yellow': { backgroundColor: '#f7cd67', color: '#725d42' },
    'app-orange': { backgroundColor: '#e59266', color: '#fff' },
    'app-teal': { backgroundColor: '#82d5bb', color: '#fff' },
    'app-green': { backgroundColor: '#8ac68a', color: '#fff' },
    'app-red': { backgroundColor: '#fc736d', color: '#fff' },
    'lime-green': { backgroundColor: '#d1da49', color: '#3d5a1a' },
    'yellow-green': { backgroundColor: '#ecdf52', color: '#725d42' },
    brown: { backgroundColor: '#9a835a', color: '#fff' },
    'warm-peach-pink': { backgroundColor: '#e18c6f', color: '#fff' },
};

/** 花纹变体 —— 逐条抄自 `card.module.less` 的 `.pattern-{pattern}` */
const PATTERN_EXPECT: Record<
    Exclude<CardPattern, 'none'>,
    { backgroundColor: string; borderColor: string; color: string; dotPrimary: string; dotSecondary: string }
> = {
    default: {
        backgroundColor: 'rgb(247, 243, 223)',
        borderColor: '#d4c4a8',
        color: '#725d42',
        dotPrimary: 'rgba(196, 184, 158, 0.15)',
        dotSecondary: 'rgba(196, 184, 158, 0.1)',
    },
    'app-pink': {
        backgroundColor: '#fde4e8',
        borderColor: '#f8a6b2',
        color: '#a85565',
        dotPrimary: 'rgba(248, 166, 178, 0.18)',
        dotSecondary: 'rgba(255, 200, 210, 0.12)',
    },
    purple: {
        backgroundColor: '#f0e8ff',
        borderColor: '#b77dee',
        color: '#6a3a9a',
        dotPrimary: 'rgba(183, 125, 238, 0.18)',
        dotSecondary: 'rgba(220, 180, 255, 0.12)',
    },
    'app-blue': {
        backgroundColor: '#e8edff',
        borderColor: '#889df0',
        color: '#4a5a8a',
        dotPrimary: 'rgba(136, 157, 240, 0.18)',
        dotSecondary: 'rgba(180, 195, 255, 0.12)',
    },
    'app-yellow': {
        backgroundColor: '#fff8e0',
        borderColor: '#f7cd67',
        color: '#7a6528',
        dotPrimary: 'rgba(247, 205, 103, 0.18)',
        dotSecondary: 'rgba(255, 230, 160, 0.12)',
    },
    'app-orange': {
        backgroundColor: '#fff0e8',
        borderColor: '#e59266',
        color: '#8a4a2a',
        dotPrimary: 'rgba(229, 146, 102, 0.18)',
        dotSecondary: 'rgba(255, 190, 150, 0.12)',
    },
    'app-teal': {
        backgroundColor: '#e8faf5',
        borderColor: '#82d5bb',
        color: '#2a6b5a',
        dotPrimary: 'rgba(130, 213, 187, 0.18)',
        dotSecondary: 'rgba(170, 235, 210, 0.12)',
    },
    'app-green': {
        backgroundColor: '#e8f5e8',
        borderColor: '#8ac68a',
        color: '#3a6b3a',
        dotPrimary: 'rgba(138, 198, 138, 0.18)',
        dotSecondary: 'rgba(180, 220, 180, 0.12)',
    },
    'app-red': {
        backgroundColor: '#ffe8e8',
        borderColor: '#fc736d',
        color: '#9a3a3a',
        dotPrimary: 'rgba(252, 115, 109, 0.18)',
        dotSecondary: 'rgba(255, 160, 155, 0.12)',
    },
    'lime-green': {
        backgroundColor: '#f5f8e0',
        borderColor: '#d1da49',
        color: '#5a6b28',
        dotPrimary: 'rgba(209, 218, 73, 0.18)',
        dotSecondary: 'rgba(230, 240, 130, 0.12)',
    },
    'yellow-green': {
        backgroundColor: '#fffde8',
        borderColor: '#ecdf52',
        color: '#6a5a28',
        dotPrimary: 'rgba(236, 223, 82, 0.18)',
        dotSecondary: 'rgba(255, 245, 140, 0.12)',
    },
    brown: {
        backgroundColor: '#f5f0e0',
        borderColor: '#9a835a',
        color: '#5a4a2a',
        dotPrimary: 'rgba(154, 131, 90, 0.18)',
        dotSecondary: 'rgba(190, 165, 120, 0.12)',
    },
    'warm-peach-pink': {
        backgroundColor: '#fff0e8',
        borderColor: '#e18c6f',
        color: '#8a4a2a',
        dotPrimary: 'rgba(225, 140, 111, 0.18)',
        dotSecondary: 'rgba(255, 185, 160, 0.12)',
    },
};

const ALL_COLORS = Object.keys(COLOR_EXPECT) as Exclude<CardColor, 'default'>[];
const ALL_PATTERNS = Object.keys(PATTERN_EXPECT) as Exclude<CardPattern, 'none'>[];

describe('Card', () => {
    it('渲染 children', async () => {
        const { getByTestId } = await render(
            <Card testID="card">
                <View testID="c" />
            </Card>
        );
        expect(getByTestId('c')).toBeTruthy();
    });

    it('文本 children 被包在 Text 里（RN 不允许裸字符串作为 View 的子节点）', async () => {
        const { getByTestId, getByText } = await render(<Card testID="card">hi</Card>);
        expect(getByText('hi')).toBeTruthy();
        expect(child(getByTestId('card').children[0]).type).toBe('Text');
    });

    it('默认不带 type / color / pattern 相关样式，只有 .card 基础样式', async () => {
        const { getByTestId } = await render(<Card testID="card">x</Card>);
        const root = getByTestId('card');
        expect(root).toHaveStyle({
            borderRadius: 20,
            backgroundColor: 'rgb(247, 243, 223)',
            paddingVertical: 16,
            paddingHorizontal: 24,
        });
        // 没有边框（.card 不声明 border；.card-dashed 才声明）
        expect(styleOf(root).borderWidth).toBeUndefined();
        expect(styleOf(root).borderStyle).toBeUndefined();
        // 没有花纹层
        expect(root.children).toHaveLength(1);
    });

    it('type=dashed 应用虚线边框与浅底（.card-dashed）', async () => {
        const { getByTestId } = await render(
            <Card testID="card" type="dashed">
                x
            </Card>
        );
        expect(getByTestId('card')).toHaveStyle({
            backgroundColor: 'rgb(250, 248, 242)',
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: '#e8dcc8',
        });
    });

    it('type=default 显式不应用 card-dashed', async () => {
        const { getByTestId } = await render(
            <Card testID="card" type="default">
                x
            </Card>
        );
        expect(styleOf(getByTestId('card')).borderStyle).toBeUndefined();
    });

    it('color 非 default 时应用背景与文字色', async () => {
        const { getByTestId } = await render(
            <Card testID="card" color="app-pink">
                x
            </Card>
        );
        const root = getByTestId('card');
        expect(root).toHaveStyle({ backgroundColor: '#f8a6b2' });
        // 文字色写在包住文本的 <Text> 上（RN 的文字色不从父 View 继承）
        expect(child(root.children[0])).toHaveStyle({ color: '#fff' });
    });

    it('color=default 显式不应用任何颜色变体', async () => {
        const { getByTestId } = await render(
            <Card testID="card" color="default">
                x
            </Card>
        );
        const root = getByTestId('card');
        expect(root).toHaveStyle({ backgroundColor: 'rgb(247, 243, 223)' });
        expect(child(root.children[0])).toHaveStyle({ color: '#725d42' });
    });

    it('pattern 非 none 时应用花纹（底色 / 1.5px 描边 / 文字色 + 花纹层）', async () => {
        const { getByTestId } = await render(
            <Card testID="card" pattern="purple">
                x
            </Card>
        );
        const root = getByTestId('card');
        expect(root).toHaveStyle({
            backgroundColor: '#f0e8ff',
            borderWidth: 1.5,
            borderStyle: 'solid',
            borderColor: '#b77dee',
        });
        expect(child(root.children[1])).toHaveStyle({ color: '#6a3a9a' });
        expect(getByTestId('card-pattern', HIDDEN)).toBeTruthy();
    });

    it('pattern=none 显式不渲染花纹层', async () => {
        const { getByTestId, queryByTestId } = await render(
            <Card testID="card" pattern="none">
                x
            </Card>
        );
        expect(queryByTestId('card-pattern', HIDDEN)).toBeNull();
        // 也不套用 pattern-default 的描边
        expect(styleOf(getByTestId('card')).borderWidth).toBeUndefined();
    });

    it('color 全部 12 种枚举都应用对应样式', async () => {
        for (const color of ALL_COLORS) {
            const { getByTestId, unmount } = await render(
                <Card testID="card" color={color}>
                    x
                </Card>
            );
            const root = getByTestId('card');
            expect(root).toHaveStyle({ backgroundColor: COLOR_EXPECT[color].backgroundColor });
            expect(child(root.children[0])).toHaveStyle({ color: COLOR_EXPECT[color].color });
            await unmount();
        }
    });

    it('pattern 全部 13 种枚举都应用对应样式与点阵几何', async () => {
        for (const pattern of ALL_PATTERNS) {
            const expected = PATTERN_EXPECT[pattern];
            const { getByTestId, unmount } = await render(
                <Card testID="card" pattern={pattern}>
                    x
                </Card>
            );
            const root = getByTestId('card');
            expect(root).toHaveStyle({
                backgroundColor: expected.backgroundColor,
                borderWidth: 1.5,
                borderStyle: 'solid',
                borderColor: expected.borderColor,
            });
            expect(child(root.children[1])).toHaveStyle({ color: expected.color });

            const { primary, secondary } = patternDots(getByTestId('card-pattern', HIDDEN));
            // 28px 网格、偏移 0、圆心在 tile 中心、r=1.5
            expect(primary.pattern.props.x).toBe(0);
            expect(primary.pattern.props.y).toBe(0);
            expect(primary.pattern.props.width).toBe(28);
            expect(primary.pattern.props.height).toBe(28);
            expect(primary.pattern.props.patternUnits).toBe(1); // 1 = userSpaceOnUse
            expect(primary.dot.props.cx).toBe(14);
            expect(primary.dot.props.cy).toBe(14);
            expect(primary.dot.props.r).toBe(1.5);
            // 14px 网格、偏移 (7,7)、圆心仍在 tile 中心（= 绝对坐标 14,14）、r=1
            expect(secondary.pattern.props.x).toBe(7);
            expect(secondary.pattern.props.y).toBe(7);
            expect(secondary.pattern.props.width).toBe(14);
            expect(secondary.pattern.props.height).toBe(14);
            expect(secondary.dot.props.cx).toBe(14);
            expect(secondary.dot.props.cy).toBe(14);
            expect(secondary.dot.props.r).toBe(1);
            // 两层点色（含 alpha）逐字对回 Less
            expect(decodeArgb(primary.dot.props.fill.payload)).toBe(expected.dotPrimary);
            expect(decodeArgb(secondary.dot.props.fill.payload)).toBe(expected.dotSecondary);
            // 两个 <Rect> 分别用两层 <Pattern> 铺满整个卡片
            expect(primary.rect.props.width).toBe('100%');
            expect(primary.rect.props.height).toBe('100%');
            expect(primary.rect.props.fill.brushRef).toBe(primary.pattern.props.name);
            expect(secondary.rect.props.fill.brushRef).toBe(secondary.pattern.props.name);
            await unmount();
        }
    });

    it('type + color + pattern 三者组合：按 CSS 层叠，pattern 盖过 color 与 dashed', async () => {
        const { getByTestId } = await render(
            <Card testID="card" type="dashed" color="app-pink" pattern="purple">
                x
            </Card>
        );
        const root = getByTestId('card');
        // `.pattern-*` 在 card.module.less 里排在 `.card-dashed` / `.card-{color}` 之后，
        // 同优先级 → 后者胜出。RN 侧用同样的覆盖顺序合成。
        expect(root).toHaveStyle({
            backgroundColor: '#f0e8ff',
            borderColor: '#b77dee',
            borderWidth: 1.5,
            borderStyle: 'solid',
        });
        expect(child(root.children[1])).toHaveStyle({ color: '#6a3a9a' });
    });

    it('children 为空字符串时正常渲染根节点', async () => {
        const { getByTestId } = await render(<Card testID="card">{''}</Card>);
        expect(getByTestId('card')).toHaveStyle({ borderRadius: 20, backgroundColor: 'rgb(247, 243, 223)' });
    });

    it('children 为数字 / 字符串 / 节点均可', async () => {
        const { getByTestId, getByText, rerender } = await render(<Card testID="card">{42}</Card>);
        expect(getByText('42')).toBeTruthy();

        await rerender(<Card testID="card">plain text</Card>);
        expect(getByText('plain text')).toBeTruthy();

        await rerender(
            <Card testID="card">
                <View testID="e" />
            </Card>
        );
        expect(getByTestId('e')).toBeTruthy();
    });

    it('传了 onPress 时根节点是 Pressable，点击触发回调', async () => {
        const onPress = jest.fn();
        const { getByTestId } = await render(
            <Card testID="card" onPress={onPress}>
                x
            </Card>
        );
        const root = getByTestId('card');
        await fireEvent.press(root);
        expect(onPress).toHaveBeenCalledTimes(1);
        expect(onPress.mock.calls[0][0]).toBeTruthy();
    });

    it('未传 onPress 时根节点是纯容器 View（不合并无障碍子节点）', async () => {
        const { getByTestId } = await render(
            <Card testID="card">
                <View testID="inner" />
            </Card>
        );
        const root = getByTestId('card');
        // Pressable 会补上 accessible；View 不会 —— 卡片内容因此仍是独立的无障碍节点
        expect(root.props.accessible).toBeUndefined();
        expect(root.props.onPress).toBeUndefined();
        expect(getByTestId('inner')).toBeTruthy();
    });

    it('role / aria-label / aria-labelledby / style / testID 透传', async () => {
        const { getByTestId } = await render(
            <Card testID="card" style={{ marginTop: 5 }} role="region" aria-label="card" aria-labelledby="some-title">
                x
            </Card>
        );
        const root = getByTestId('card');
        expect(root).toHaveStyle({ marginTop: 5 });
        // View 被 jest preset 整个 mock，`aria-*` 不会被改写成 `accessibility*`，
        // 所以这里读到的是原始 props —— 只证明组件把 prop 转发下去了。
        expect(root.props.role).toBe('region');
        expect(root.props['aria-label']).toBe('card');
        expect(root.props['aria-labelledby']).toBe('some-title');
    });

    // ---------- hoverable：Web 的 hover 反馈改挂按下态 ----------

    it('默认（不传 hoverable）按下不改变样式', async () => {
        const { getByTestId } = await render(
            <Card testID="card" onPress={jest.fn()}>
                x
            </Card>
        );
        const root = getByTestId('card');
        await pressIn(root);
        expect(styleOf(root).transform).toBeUndefined();
    });

    it('hoverable={false} 显式不应用按下上浮', async () => {
        const { getByTestId } = await render(
            <Card testID="card" hoverable={false} onPress={jest.fn()}>
                x
            </Card>
        );
        const root = getByTestId('card');
        await pressIn(root);
        expect(styleOf(root).transform).toBeUndefined();
    });

    it('hoverable + onPress：按下时上浮 2px（替代 .card-hoverable:hover）', async () => {
        const { getByTestId } = await render(
            <Card testID="card" hoverable onPress={jest.fn()}>
                x
            </Card>
        );
        const root = getByTestId('card');
        await pressIn(root);
        expect(styleOf(root).transform).toEqual([{ translateY: -2 }]);
        expect(root).toHaveStyle({ backgroundColor: 'rgb(247, 243, 223)' });
    });

    it('hoverable + type=dashed：按下只换边框色、不位移（.card-hoverable.card-dashed:hover）', async () => {
        const { getByTestId } = await render(
            <Card testID="card" type="dashed" hoverable onPress={jest.fn()}>
                x
            </Card>
        );
        const root = getByTestId('card');
        await pressIn(root);
        expect(root).toHaveStyle({ borderColor: '#d4c4a8' });
        expect(styleOf(root).transform).toBeUndefined();
    });

    it('花纹层是装饰性的：aria-hidden 且不挡触摸', async () => {
        const { getByTestId, queryByTestId } = await render(
            <Card testID="card" pattern="app-teal">
                x
            </Card>
        );
        const layer = getByTestId('card-pattern', HIDDEN);
        expect(layer.props['aria-hidden']).toBe(true);
        expect(layer.props.pointerEvents).toBe('none');
        // 默认查询（不含 includeHiddenElements）查不到它 —— 反证 aria-hidden 生效
        expect(queryByTestId('card-pattern')).toBeNull();
        expect(getByTestId('card').children).toHaveLength(2);
    });
});
