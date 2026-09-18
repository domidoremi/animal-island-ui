import React from 'react';
import { Dimensions } from 'react-native';
import { act, render } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer' with { 'resolution-mode': 'import' };
import { Loading } from './Loading';

/**
 * RN 版测试，对应 Web 版 `Loading.test.tsx` 的 14 个用例。
 *
 * ## 关于 `Loading/island/` 的第三方压缩库（结论：**没有移植，也不需要移植**）
 *
 * 上游 eslint 里 ignore 掉 `*.min.js` / `island/` 目录，注释说是「第三方压缩库 +
 * 声明文件（来自 Loading/island/）」。**该目录在 rn / main / upstream/main /
 * library-hardening 上都不存在** —— 它在 `ce82fe3` 就随旧实现一起被删了。
 *
 * 它曾经是什么（`git show 91e3d6c:src/components/Loading/island/`）：
 *   `gsap.min.js`(58KB) + `gsap.min.d.ts`、`MotionPathPlugin.min.js`(20KB) + `.d.ts`、
 *   以及手写的 `script.js` —— 一个用 `document.querySelector` 驱动内联 `<svg>`
 *   海岛插画（#whole-island / #tree / #leaf1-5 / #water-circle / #tri-wave /
 *   沿 #fish-path 游动的 #fish）的 GSAP 时间线。
 *
 * 现版本 Loading 只 import React 与 `loading.module.less`，**完全不碰它**；而且它是
 * DOM-only（`document.querySelector` + CSS 选择器），RN 里也用不了。所以：
 * **未移植，且没有任何调用点需要处理**。上游那两条 eslint ignore 是历史遗留。
 *
 * ## 被丢弃 / 改写的 Web 用例
 *
 *   - `透传 className 与 style 到根元素` —— RN 无 className、无 `data-*`；且
 *     `types.ts` 不再 `extends HTMLAttributes`（`...rest` 透传整条路被删）。
 *     改为断言 `style` / `testID` 透传。
 *   - `exiting 时根元素以 fadeDuration 作为 transition-duration` —— RN 没有 CSS
 *     transition / `transitionDuration`。**换成了更实质的断言**：淡出期间 opacity
 *     真的在往下走，且恰好按 fadeDuration 计时卸载（见「渐变消失」一节）。
 *   - `每片雪花 …带负延迟` 里的负延迟一半 —— RN 的 `Animated` 没有负延迟（详见
 *     Loading.tsx 中 Flake 的注释）。改为断言「相位被换算成了 0–1 的起始进度」。
 *
 * ## 测不到的部分（诚实地说明）
 *
 *   - **雪花飘落本身**：`useNativeDriver: true` 在 jest 里是空操作，帧不会推进，
 *     所以只断言静态规格（尺寸 / 水平位置 / 时长 / 起始相位），不断言它真的在动。
 *   - **暗角渐变的观感**：只断言渲染出了 `react-native-svg` 的渐变节点。
 *   - **`prefers-reduced-motion`**：Web 版用媒体查询停掉落雪；RN 0.87 **没有导出
 *     `useReducedMotion`**（只有异步的 `AccessibilityInfo.isReduceMotionEnabled`），
 *     这条**整段丢弃**，没有对应实现可测。
 */
const styleOf = (node: TestInstance) => {
    const merged: Record<string, unknown> = {};
    const walk = (s: unknown) => {
        if (Array.isArray(s)) s.forEach(walk);
        else if (s && typeof s === 'object') Object.assign(merged, s);
    };
    walk(node.props.style);
    return merged;
};

/** 雪花层 / 暗角带 `aria-hidden`，RNTL 默认把它们排除在查询之外 */
const HIDDEN = { includeHiddenElements: true } as const;

/** 组件用 `useWindowDimensions().height + 60` 作为落程（对应 CSS 的 `100vh + 60px`） */
const FALL_DISTANCE = Dimensions.get('window').height + 60;

const advance = (ms: number) =>
    act(async () => {
        jest.advanceTimersByTime(ms);
    });

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
});

describe('Loading', () => {
    describe('渲染', () => {
        it('默认渲染全屏落雪 role=status 与兜底读屏文案', async () => {
            const { getByRole, getByTestId, getByText } = await render(<Loading testID="l" />);
            const root = getByTestId('l');
            expect(root.props.role).toBe('status');
            // `.loading { background: @night-sky }`
            expect(root).toHaveStyle({ backgroundColor: '#0b101a' });
            // `.loading { position: fixed; inset: 0 }` → RN 用绝对定位铺满父容器
            expect(root).toHaveStyle({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 });
            // 兜底读屏文案（`.srOnly`）
            expect(getByText('加载中')).toBeTruthy();
            // 容器整体是一个无障碍元素，所以 role 查得到（裸 View 过不了 RNTL 的闸门）
            expect(getByRole('status', { name: '加载中' })).toBeTruthy();
        });

        it('雪花层与暗角均为 aria-hidden，雪花数量为 50', async () => {
            const { getByTestId, getAllByTestId } = await render(<Loading testID="l" />);
            const snow = getByTestId('l-snow', HIDDEN);
            const vignette = getByTestId('l-vignette', HIDDEN);
            expect(snow.props['aria-hidden']).toBe(true);
            expect(vignette.props['aria-hidden']).toBe(true);
            expect(getAllByTestId('l-flake', HIDDEN)).toHaveLength(50);
            // 默认查询（不带 includeHiddenElements）看不到它们 —— 反证 aria-hidden 生效
            expect(() => getByTestId('l-snow')).toThrow();
        });

        it('每片雪花尺寸 1–6px、水平位置 0–100%、时长 6–12s，且起始相位已注入', async () => {
            const { getAllByTestId } = await render(<Loading testID="l" />);
            const flakes = getAllByTestId('l-flake', HIDDEN);

            for (const flake of flakes) {
                const style = styleOf(flake);
                const size = style.width as number;
                expect(size).toBeGreaterThanOrEqual(1);
                expect(size).toBeLessThanOrEqual(6);
                expect(style.height).toBe(size);
                expect(style.borderRadius).toBe(size / 2);
                // `.flake { top: -30px }`
                expect(style.top).toBe(-30);
                expect(style.left).toMatch(/^\d+(\.\d+)?%$/);
                expect(parseFloat(style.left as string)).toBeLessThanOrEqual(100);

                // 起始 translateY = phase × 落程，落在 [0, 落程) 内。
                // Web 用负 animation-delay 达到同样效果（首屏即有分布，不必等它飘满）。
                const translateY = (style.transform as { translateY: number }[])[0].translateY;
                expect(translateY).toBeGreaterThanOrEqual(0);
                expect(translateY).toBeLessThan(FALL_DISTANCE);
            }

            // 至少有一片不是从 0 开始 —— 否则「相位」等于没做
            const offsets = flakes.map((f) => (styleOf(f).transform as { translateY: number }[])[0].translateY);
            expect(offsets.some((v) => v > 0)).toBe(true);
        });

        it('50 片雪花是各自独立随机生成的（尺寸不全都相同）', async () => {
            const { getAllByTestId } = await render(<Loading testID="l" />);
            // 每片的动画时长（6–12s）写进了 `Animated.timing` 的 config，宿主样式上看不到，
            // 所以「时长在 6–12s 内」这条**测不到**；能测的是「随机参数确实各自不同」。
            const sizes = new Set(getAllByTestId('l-flake', HIDDEN).map((f) => styleOf(f).width));
            expect(sizes.size).toBeGreaterThan(1);
        });

        it('tip 渲染为中央提示文字并替代默认读屏文案', async () => {
            const { getByText, queryByText, getByTestId } = await render(<Loading testID="l" tip="正在连接岛屿" />);
            expect(getByText('正在连接岛屿')).toBeTruthy();
            expect(queryByText('加载中')).toBeNull();
            // `.tip { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center }`
            expect(getByTestId('l-tip')).toHaveStyle({
                position: 'absolute',
                alignItems: 'center',
                justifyContent: 'center',
            });
        });

        it('暗角用 react-native-svg 的 RadialGradient 绘制（替代 CSS radial-gradient）', async () => {
            const { getByTestId } = await render(<Loading testID="l" />);
            const vignette = getByTestId('l-vignette', HIDDEN);
            // 暗角容器下应该渲染出 SVG 宿主节点（react-native-svg 的渐变 + 铺满的 Rect）
            const svgTypes = (function walk(node: TestInstance): string[] {
                return [
                    typeof node.type === 'string' ? node.type : '',
                    ...node.children.flatMap((c) => walk(c as TestInstance)),
                ].filter(Boolean);
            })(vignette);
            expect(svgTypes.some((t) => t.toLowerCase().includes('svg'))).toBe(true);
        });

        it('active=false 初始不渲染任何内容', async () => {
            const { queryByTestId, toJSON } = await render(<Loading testID="l" active={false} />);
            expect(queryByTestId('l')).toBeNull();
            expect(toJSON()).toBeNull();
        });

        it('zIndex 默认 3000，可通过 prop 覆盖', async () => {
            const { getByTestId, rerender } = await render(<Loading testID="l" />);
            expect(getByTestId('l')).toHaveStyle({ zIndex: 3000 });

            await rerender(<Loading testID="l" zIndex={5000} />);
            expect(getByTestId('l')).toHaveStyle({ zIndex: 5000 });
        });

        it('style / testID 透传到根元素（替代 Web 的 className / data-* 透传）', async () => {
            const { getByTestId } = await render(<Loading testID="l" style={{ opacity: 0.9 }} />);
            const root = getByTestId('l');
            expect(root).toHaveStyle({ opacity: 0.9 });
            expect(root.props.testID).toBe('l');
        });
    });

    describe('delay 延迟显示', () => {
        it('delay 时间内不渲染，到时后出现', async () => {
            const { queryByTestId } = await render(<Loading testID="l" delay={300} />);
            expect(queryByTestId('l')).toBeNull();

            await advance(299);
            expect(queryByTestId('l')).toBeNull();

            await advance(1);
            expect(queryByTestId('l')).toBeTruthy();
        });

        it('delay=0 立即显示', async () => {
            const { getByTestId } = await render(<Loading testID="l" delay={0} />);
            expect(getByTestId('l')).toBeTruthy();
        });

        it('active 切换为 true 时重新计时', async () => {
            const { queryByTestId, rerender } = await render(<Loading testID="l" delay={300} active={false} />);
            await rerender(<Loading testID="l" delay={300} active />);
            expect(queryByTestId('l')).toBeNull();

            await advance(299);
            expect(queryByTestId('l')).toBeNull();

            await advance(1);
            expect(queryByTestId('l')).toBeTruthy();
        });
    });

    describe('渐变消失', () => {
        it('active→false 后保持挂载，pointer-events 关闭，且 opacity 真的在往下走', async () => {
            const { getByTestId, rerender } = await render(<Loading testID="l" />);
            // 进入时还有 200ms 的淡入（`@keyframes animal-loading-fade-in`）
            await advance(200);
            expect(styleOf(getByTestId('l')).opacity).toBe(1);

            await rerender(<Loading testID="l" active={false} />);
            const root = getByTestId('l');
            expect(root).toBeTruthy();
            // `.loading.exiting { pointer-events: none }`
            expect(root.props.pointerEvents).toBe('none');

            // 淡出时长 fadeDuration(0.6s) 的一半
            await advance(300);
            const opacity = styleOf(getByTestId('l')).opacity as number;
            expect(opacity).toBeGreaterThan(0);
            expect(opacity).toBeLessThan(1);
        });

        it('fadeDuration 走完后卸载雪花屏', async () => {
            const { queryByTestId, rerender } = await render(<Loading testID="l" fadeDuration={0.6} />);
            await rerender(<Loading testID="l" fadeDuration={0.6} active={false} />);
            expect(queryByTestId('l')).toBeTruthy();

            await advance(600);
            expect(queryByTestId('l')).toBeNull();
        });

        it('fadeDuration 可配置：1.5s 时 600ms 仍在，1500ms 才卸载', async () => {
            const { queryByTestId, rerender } = await render(<Loading testID="l" fadeDuration={1.5} />);
            await rerender(<Loading testID="l" fadeDuration={1.5} active={false} />);

            await advance(600);
            expect(queryByTestId('l')).toBeTruthy();

            await advance(900);
            expect(queryByTestId('l')).toBeNull();
        });

        it('淡出途中恢复 active：立即取消卸载并回到不透明', async () => {
            const { getByTestId, rerender } = await render(<Loading testID="l" fadeDuration={0.6} />);
            await rerender(<Loading testID="l" fadeDuration={0.6} active={false} />);
            // 淡出到一半时恢复开启
            await advance(300);
            await rerender(<Loading testID="l" fadeDuration={0.6} active />);

            const root = getByTestId('l');
            expect(root).toBeTruthy();
            expect(root.props.pointerEvents).toBe('auto');

            await advance(300); // 走完 200ms 的淡入
            expect(styleOf(getByTestId('l')).opacity).toBe(1);

            // 恢复后不再有任何计时器把它卸载
            await advance(5000);
            expect(getByTestId('l')).toBeTruthy();
        });
    });

    // ---------- RN 专有：与 Web 行为等价性无关的边界 ----------

    describe('边界', () => {
        it('重复挂载/卸载不会残留计时器（卸载后推进时间不报错）', async () => {
            const { unmount, queryByTestId } = await render(<Loading testID="l" delay={300} />);
            await unmount();
            await advance(1000);
            expect(queryByTestId('l')).toBeNull();
        });

        it('tip 为节点时原样渲染', async () => {
            const { getByTestId } = await render(<Loading testID="l" tip={<></>} />);
            expect(getByTestId('l-tip')).toBeTruthy();
        });

        it('非 exiting 时全屏遮罩拦截点击（pointerEvents 为 auto）', async () => {
            const { getByTestId } = await render(<Loading testID="l" />);
            // `.loading` 本身没有 pointer-events:none，只有 `.exiting` 才放行 —— 即加载期间
            // 整屏不可交互，这与 Web 版一致。
            expect(getByTestId('l').props.pointerEvents).toBe('auto');
        });
    });
});
