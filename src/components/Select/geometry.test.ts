import {
    DROPDOWN_GAP,
    DROPDOWN_VERTICAL_PADDING,
    HORIZONTAL_FLIP_THRESHOLD,
    OPTION_HEIGHT,
    computeDropdownPlacement,
    computeDropdownPosition,
    dropdownHeight,
} from './geometry';

/**
 * 这些判断在组件里**覆盖不到**：面板定位靠 `measureInWindow`，而 jest preset 把它
 * mock 成永不回调的空实现，所以测试里面板永远落在兜底位置。
 * 见 `geometry.ts` 顶部注释。
 */

/** Web 版 `beforeEach` 里的那组默认值：视口 2000×2000，触发区在中段 */
const WIDE = { width: 2000, height: 2000 };
const MIDDLE = { x: 0, y: 200, width: 100, height: 50 };

describe('几何常量', () => {
    it('与上游算式一致', () => {
        // `options.length * 44 + 24`
        expect(OPTION_HEIGHT).toBe(44);
        expect(DROPDOWN_VERTICAL_PADDING).toBe(24);
        // `marginLeft / marginRight / marginTop / marginBottom: 6px`
        expect(DROPDOWN_GAP).toBe(6);
        // 上游硬编码的翻边阈值，刻意保留（Less 里没有宽度声明）
        expect(HORIZONTAL_FLIP_THRESHOLD).toBe(200);
    });

    it('dropdownHeight = 选项数 × 44 + 24', () => {
        expect(dropdownHeight(0)).toBe(24);
        expect(dropdownHeight(3)).toBe(156);
        expect(dropdownHeight(1)).toBe(68);
    });
});

describe('computeDropdownPlacement', () => {
    it('空间充足 → 贴右侧、垂直居中（上游的默认分支）', () => {
        // spaceBelow = 2000 - 250 = 1750 >= 156；spaceAbove = 200 >= 156
        expect(computeDropdownPlacement(MIDDLE, WIDE, 3)).toEqual({ side: 'right', align: 'center' });
    });

    it('右侧空间不足 → 翻到左侧', () => {
        // rect.right = 1900，1900 + 200 > 2000
        const trigger = { x: 1800, y: 200, width: 100, height: 50 };
        expect(computeDropdownPlacement(trigger, WIDE, 3)).toEqual({ side: 'left', align: 'center' });
    });

    it('右侧恰好等于阈值时不算「不足」', () => {
        // rect.right = 1800，1800 + 200 === 2000，不满足 `>`
        const trigger = { x: 1700, y: 200, width: 100, height: 50 };
        expect(computeDropdownPlacement(trigger, WIDE, 3).side).toBe('right');
    });

    it('下方放不下且上方更宽裕 → 往上弹', () => {
        // 触发区贴底：spaceBelow = 2000 - 1950 = 50 < 156；spaceAbove = 1900 > 50
        // （Web 版这条用例的 mockRect 写的是 `top: 100, bottom: 1995`，两者相差 1895
        //   却声明 height: 50 —— 那是 DOMRect 桩自相矛盾。RN 侧用 y + height 推导，
        //   所以改成构造一个真实的贴底场景。）
        const trigger = { x: 0, y: 1900, width: 100, height: 50 };
        expect(computeDropdownPlacement(trigger, WIDE, 3)).toEqual({ side: 'right', align: 'above' });
    });

    it('下方放不下但上方也不更宽裕 → 仍贴下展开（走第二个分支，不是往上弹）', () => {
        // 触发区贴底且视口很矮：spaceBelow = 70 - 60 = 10 < 156；spaceAbove = 10，不 > 10
        const trigger = { x: 0, y: 10, width: 100, height: 50 };
        const win = { width: 2000, height: 70 };
        expect(computeDropdownPlacement(trigger, win, 3).align).toBe('below');
    });

    it('触发区距视口顶部太近 → 强制贴下展开', () => {
        // spaceBelow = 2000 - 500 = 1500 >= 156；spaceAbove = 10，y = 10 < 156
        const trigger = { x: 0, y: 10, width: 100, height: 50 };
        expect(computeDropdownPlacement(trigger, WIDE, 3).align).toBe('below');
    });

    it('水平与垂直互不影响', () => {
        const trigger = { x: 1800, y: 10, width: 100, height: 50 };
        expect(computeDropdownPlacement(trigger, WIDE, 3)).toEqual({ side: 'left', align: 'below' });
    });

    it('选项越多越容易翻上去（判据就是 dropdownHeight）', () => {
        // 视口高 500，触发区贴近底部：spaceBelow = 500 - 450 = 50，spaceAbove = 400
        const trigger = { x: 0, y: 400, width: 100, height: 50 };
        const win = { width: 2000, height: 500 };
        // 0 项：dropdownHeight = 24 <= 50 → 不走前两个分支，y = 400 >= 24 → 居中
        expect(computeDropdownPlacement(trigger, win, 0).align).toBe('center');
        // 1 项：dropdownHeight = 68 > 50，且 spaceAbove 400 > spaceBelow 50 → 往上弹
        expect(computeDropdownPlacement(trigger, win, 1).align).toBe('above');
        expect(dropdownHeight(0)).toBeLessThan(50);
        expect(dropdownHeight(1)).toBeGreaterThan(50);
    });
});

describe('computeDropdownPosition', () => {
    it('贴右侧 + 居中：left = 触发区右边 + 6，top = 触发区中线 - 面板高 / 2', () => {
        // left = 0 + 100 + 6 = 106；top = 200 + 25 - 156 / 2 = 147
        expect(computeDropdownPosition(MIDDLE, WIDE, 3)).toEqual({ left: 106, top: 147 });
    });

    it('翻到左侧：right = 窗口宽 - 触发区左边 + 6', () => {
        const trigger = { x: 1800, y: 200, width: 100, height: 50 };
        const pos = computeDropdownPosition(trigger, WIDE, 3);
        // right = 2000 - 1800 + 6 = 206 → 面板右边缘落在 1794，即触发区左边再往左 6px
        expect(pos).toEqual({ right: 206, top: 147 });
        expect(2000 - (pos.right ?? 0)).toBe(trigger.x - DROPDOWN_GAP);
    });

    it('往上弹：bottom = 窗口高 - 触发区顶边 + 6', () => {
        const trigger = { x: 0, y: 1900, width: 100, height: 50 };
        const pos = computeDropdownPosition(trigger, WIDE, 3);
        // bottom = 2000 - 1900 + 6 = 106；left = 0 + 100 + 6 = 106
        expect(pos).toEqual({ left: 106, bottom: 106 });
        // 面板底边落在触发区上方 6px
        expect(WIDE.height - (pos.bottom ?? 0)).toBe(trigger.y - DROPDOWN_GAP);
    });

    it('贴下展开：top = 触发区底边 + 6', () => {
        const trigger = { x: 0, y: 10, width: 100, height: 50 };
        const pos = computeDropdownPosition(trigger, WIDE, 3);
        expect(pos).toEqual({ left: 106, top: 66 });
        expect(pos.top).toBe(trigger.y + trigger.height + DROPDOWN_GAP);
    });

    it('面板越矮，居中时越贴近触发区中线', () => {
        const one = computeDropdownPosition(MIDDLE, WIDE, 1);
        const three = computeDropdownPosition(MIDDLE, WIDE, 3);
        // 1 项：200 + 25 - 68 / 2 = 191；3 项：147
        expect(one.top).toBe(191);
        expect(three.top).toBe(147);
        // 两者的中线都等于触发区中线
        expect((one.top ?? 0) + dropdownHeight(1) / 2).toBe(MIDDLE.y + MIDDLE.height / 2);
        expect((three.top ?? 0) + dropdownHeight(3) / 2).toBe(MIDDLE.y + MIDDLE.height / 2);
    });

    it('四个分支的组合都能算出合法的偏移', () => {
        const cases: Array<
            [{ x: number; y: number; width: number; height: number }, { width: number; height: number }]
        > = [
            [MIDDLE, WIDE],
            [{ x: 1800, y: 200, width: 100, height: 50 }, WIDE],
            [{ x: 0, y: 1900, width: 100, height: 50 }, WIDE],
            [{ x: 0, y: 10, width: 100, height: 50 }, WIDE],
            [{ x: 1800, y: 10, width: 100, height: 50 }, WIDE],
            [
                { x: 0, y: 10, width: 100, height: 50 },
                { width: 2000, height: 70 },
            ],
        ];
        for (const [trigger, win] of cases) {
            const pos = computeDropdownPosition(trigger, win, 3);
            // 水平、垂直各恰好一个约束
            expect([pos.left, pos.right].filter((v) => v !== undefined)).toHaveLength(1);
            expect([pos.top, pos.bottom].filter((v) => v !== undefined)).toHaveLength(1);
            expect(Number.isFinite(pos.left ?? pos.right)).toBe(true);
            expect(Number.isFinite(pos.top ?? pos.bottom)).toBe(true);
        }
    });
});
