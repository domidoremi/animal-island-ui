import {
    LIST_PADDING,
    OPTION_GAP,
    OPTION_HEIGHT,
    OPTION_STRIDE,
    PANEL_GAP,
    PANEL_HEIGHT_ESTIMATE,
    RIGHT_ALIGN_THRESHOLD,
    centerOffset,
    computePanelPosition,
} from './geometry';

/**
 * 这些算术在组件里**覆盖不到**（滚动要原生节点、定位要 `measureInWindow`），
 * 所以单独测纯函数。见 `geometry.ts` 顶部注释。
 */

describe('几何常量', () => {
    it('与 Less 样式表一致', () => {
        // .option { height: 28px } / .columnList { gap: 2px; padding: 2px }
        expect(OPTION_HEIGHT).toBe(28);
        expect(OPTION_GAP).toBe(2);
        expect(LIST_PADDING).toBe(2);
        expect(OPTION_STRIDE).toBe(OPTION_HEIGHT + OPTION_GAP);
        expect(OPTION_STRIDE).toBe(30);
    });

    it('面板定位常量沿用上游取值', () => {
        expect(PANEL_HEIGHT_ESTIMATE).toBe(320);
        expect(PANEL_GAP).toBe(6);
        // 上游硬编码的右对齐阈值，刻意保留（比真实面板宽 248/172 都宽）
        expect(RIGHT_ALIGN_THRESHOLD).toBe(260);
    });
});

describe('centerOffset', () => {
    /** 上游 Web 版的公式，留作对照：`index * 38 - clientHeight / 2 + 19` */
    const upstreamOffset = (index: number, viewportHeight: number) => index * 38 - viewportHeight / 2 + 19;

    it('列表顶部不足以居中时夹到 0', () => {
        // 2 + 0*30 + 14 - 232/2 = -100 → 夹到 0
        expect(centerOffset(0, 232)).toBe(0);
    });

    it('第 10 项：顶部 + 半高 - 半视口', () => {
        // 2 + 10*30 + 14 - 116 = 200
        expect(centerOffset(10, 232)).toBe(200);
    });

    it('视口越小偏移越大', () => {
        expect(centerOffset(5, 100)).toBeGreaterThan(centerOffset(5, 200));
        // 2 + 150 + 14 - 50 = 116
        expect(centerOffset(5, 100)).toBe(116);
    });

    it('夹取区间内不减，夹取区间外每项恰好多滚一个步进', () => {
        // 未夹取的门槛：2 + 30i + 14 - 116 > 0 → i >= 4
        const firstUnclamped = 4;
        expect(centerOffset(firstUnclamped - 1, 232)).toBe(0);
        expect(centerOffset(firstUnclamped, 232)).toBeGreaterThan(0);

        for (let i = firstUnclamped; i < 20; i++) {
            expect(centerOffset(i + 1, 232) - centerOffset(i, 232)).toBe(OPTION_STRIDE);
        }
    });

    it('单调不减（含夹取区间）', () => {
        for (let i = 0; i < 20; i++) {
            expect(centerOffset(i + 1, 232)).toBeGreaterThanOrEqual(centerOffset(i, 232));
        }
    });

    it('视口为 0（未测量）时退化为「选项顶部 + 半高」', () => {
        expect(centerOffset(0, 0)).toBe(LIST_PADDING + OPTION_HEIGHT / 2);
    });

    it('与上游公式的差异（记录有意的修正）', () => {
        // 上游按步进 38 算，第 10 项会多滚 8 * 10 = 80px（且它不夹负值）
        expect(upstreamOffset(10, 232)).toBe(283);
        expect(centerOffset(10, 232)).toBe(200);
        expect(upstreamOffset(10, 232) - centerOffset(10, 232)).toBe(83);

        // 第 0 项上游不夹负值，会得到负数（scrollTop 负值由浏览器夹到 0）
        expect(upstreamOffset(0, 232)).toBe(-97);
        expect(centerOffset(0, 232)).toBe(0);
    });
});

describe('computePanelPosition', () => {
    const win = { width: 750, height: 1334 };
    /** 中部一个普通触发区 */
    const middle = { x: 100, y: 200, width: 200, height: 40 };

    it('下方放得下 → 向下展开，左对齐', () => {
        // spaceBelow = 1334 - 240 = 1094 >= 320
        expect(computePanelPosition(middle, win)).toEqual({ top: 246, left: 100 });
    });

    it('下方放不下且上方更宽裕 → 向上翻转', () => {
        // spaceBelow = 1334 - 1040 = 294 < 320；spaceAbove = 1000 > 294
        const trigger = { x: 100, y: 1000, width: 200, height: 40 };
        const pos = computePanelPosition(trigger, win);
        expect(pos).toEqual({ bottom: 340, left: 100 });
        // bottom = 窗口高 - 触发区顶边 + 间距 → 面板底边落在触发区上方 6px
        expect(win.height - (pos.bottom ?? 0)).toBe(trigger.y - PANEL_GAP);
    });

    it('下方放不下但上方也不宽裕 → 仍向下展开（与 Web 版同）', () => {
        // spaceBelow = 500 - 240 = 260 < 320；spaceAbove = 200，不比 260 宽裕
        const pos = computePanelPosition(middle, { width: 750, height: 500 });
        expect(pos).toEqual({ top: 246, left: 100 });
    });

    it('恰好等于阈值时不算「右侧不足」', () => {
        // 240 + 260 === 500，不满足 `> width`
        const pos = computePanelPosition({ x: 240, y: 200, width: 200, height: 40 }, { width: 500, height: 1334 });
        expect(pos).toEqual({ top: 246, left: 240 });
    });

    it('右侧空间不足 → 右对齐到触发区右边缘', () => {
        const trigger = { x: 300, y: 200, width: 80, height: 40 };
        const pos = computePanelPosition(trigger, { width: 400, height: 1334 });
        // right = 400 - 380 = 20 → 面板右边在 380，与触发区右边对齐
        expect(pos).toEqual({ top: 246, right: 20 });
        expect(400 - (pos.right ?? 0)).toBe(trigger.x + trigger.width);
    });

    it('翻转与右对齐可以同时发生', () => {
        const trigger = { x: 300, y: 1000, width: 80, height: 40 };
        expect(computePanelPosition(trigger, { width: 400, height: 1334 })).toEqual({ bottom: 340, right: 20 });
    });
});
