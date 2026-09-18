import {
    borderWidth,
    boxShadow,
    colors,
    controlHeight,
    defaultTheme,
    duration,
    easing,
    fontFamily,
    fontSize,
    lineHeightBase,
    radius,
    spacing,
} from './tokens';

/**
 * 设计 token 的**冻结测试**。
 *
 * 期望值逐条抄自上游 `src/styles/variables.less`（`main` 分支），
 * **不是**抄自 `tokens.ts` —— 否则把 tokens.ts 改坏了测试也会跟着变绿，等于没测。
 * 单位换算规则见 `tokens.ts` 顶部注释（Less 的 px → RN 无单位数字；`0.15s` → `150`）。
 *
 * 为什么值得单独测：整条 RN 移植线的保真度都压在这层 token 上，
 * 而它是唯一「改了不会让任何组件测试变红」的文件。
 */

/** [tokens 的 key, 上游 Less 变量名, 期望值] */
const COLOR_SPEC: Array<[keyof typeof colors, string, string]> = [
    // ---------- Color Palette ----------
    ['primary', '@primary-color', '#19c8b9'],
    ['primaryHover', '@primary-color-hover', '#3dd4c6'],
    ['primaryActive', '@primary-color-active', '#50b9ab'],
    ['primaryBg', '@primary-color-bg', '#e6f9f6'],
    ['success', '@success-color', '#6fba2c'],
    ['successHover', '@success-color-hover', '#85cc45'],
    ['successActive', '@success-color-active', '#5a9e1e'],
    ['warning', '@warning-color', '#f5c31c'],
    ['warningHover', '@warning-color-hover', '#f7d04a'],
    ['warningActive', '@warning-color-active', '#dba90e'],
    ['error', '@error-color', '#e05a5a'],
    ['errorHover', '@error-color-hover', '#e87878'],
    ['errorActive', '@error-color-active', '#c94444'],
    // ---------- Neutral ----------
    ['text', '@text-color', '#794f27'],
    ['textSecondary', '@text-color-secondary', '#9f927d'],
    ['textDisabled', '@text-color-disabled', '#c4b89e'],
    ['border', '@border-color', '#dcd8d1'],
    ['borderHover', '@border-color-hover', '#827157'],
    ['borderLight', '@border-color-light', '#e8e2d6'],
    ['shadowLight', '@shadow-color-light', 'rgba(61, 52, 40, 0.08)'],
    ['bg', '@bg-color', '#f8f8f0'],
    ['bgSecondary', '@bg-color-secondary', '#f0e8d8'],
    ['bgDisabled', '@bg-color-disabled', '#f0ece2'],
    // ---------- Overlay ----------
    ['mask', '@mask-bg', 'rgba(0, 0, 0, 0.35)'],
    // `@focus-yellow` 在 Less 里是 `@warning-color` 的别名，展开后同值
    ['focus', '@focus-yellow (= @warning-color)', '#f5c31c'],
];

describe('设计 token ← src/styles/variables.less', () => {
    describe('颜色', () => {
        it.each(COLOR_SPEC)('%s ← %s', (key, _lessVariable, expected) => {
            expect(colors[key]).toBe(expected);
        });

        it('没有遗漏也没有多余（Less 里共 25 个颜色变量）', () => {
            expect(COLOR_SPEC).toHaveLength(25);
            expect(Object.keys(colors)).toHaveLength(25);
        });

        it('@focus-yellow 确实等于 @warning-color', () => {
            expect(colors.focus).toBe(colors.warning);
        });
    });

    describe('字号 / 行高', () => {
        it.each([
            ['sm', 12],
            ['base', 14],
            ['lg', 16],
        ] as const)('fontSize.%s = %d（@font-size-*）', (key, expected) => {
            expect(fontSize[key]).toBe(expected);
        });

        it('lineHeightBase = 1.5715（@line-height-base，无单位）', () => {
            expect(lineHeightBase).toBe(1.5715);
        });
    });

    describe('间距', () => {
        it.each([
            ['xs', 4],
            ['sm', 8],
            ['md', 12],
            ['lg', 16],
            ['xl', 24],
        ] as const)('spacing.%s = %d（@spacing-*）', (key, expected) => {
            expect(spacing[key]).toBe(expected);
        });
    });

    describe('圆角 / 边框 / 控件高度', () => {
        it.each([
            ['sm', 16],
            ['base', 18],
            ['lg', 24],
        ] as const)('radius.%s = %d（@border-radius-*）', (key, expected) => {
            expect(radius[key]).toBe(expected);
        });

        it('borderWidth = 2（@border-width）', () => {
            expect(borderWidth).toBe(2);
        });

        it.each([
            ['sm', 32],
            ['base', 40],
            ['lg', 48],
        ] as const)('controlHeight.%s = %d（@height-*）', (key, expected) => {
            expect(controlHeight[key]).toBe(expected);
        });
    });

    describe('阴影（逐字照搬 CSS，不做拆解）', () => {
        it('三个 @shadow-* 原值一致', () => {
            expect(boxShadow).toEqual({
                sm: '0 2px 4px 0 rgba(61, 52, 40, 0.06)',
                base: '0 3px 10px 0 rgba(61, 52, 40, 0.1)',
                lg: '0 8px 24px 0 rgba(61, 52, 40, 0.14)',
            });
        });

        it('保留 CSS 的 4 段语法（offsetX offsetY blur spread color）', () => {
            // 拆成 shadowOffset / shadowRadius + elevation 会丢掉 spread 与硬偏移，
            // 无法表达 Button 的 `0 5px 0 0 #bdaea0`，所以必须是字符串
            for (const value of Object.values(boxShadow)) {
                expect(value).toMatch(/^0 \d+px \d+px \d+ .+$/);
            }
        });
    });

    describe('动效（秒 → 毫秒）', () => {
        it.each([
            ['fast', 150], // @motion-duration-fast: 0.15s
            ['base', 250], // @motion-duration-base: 0.25s
            ['slow', 350], // @motion-duration-slow: 0.35s
        ] as const)('duration.%s = %dms', (key, expected) => {
            expect(duration[key]).toBe(expected);
        });

        it('easing = cubic-bezier(0.4, 0, 0.2, 1) 的控制点', () => {
            expect(easing).toEqual([0.4, 0, 0.2, 1]);
        });
    });

    describe('字体', () => {
        it('默认不设 family（woff2 不可用，且 RN 不支持字体栈）', () => {
            expect(fontFamily).toBeUndefined();
        });
    });

    describe('defaultTheme', () => {
        it('把所有 token 聚成一个可注入的对象', () => {
            expect(defaultTheme).toEqual({
                colors,
                fontSize,
                lineHeightBase,
                spacing,
                radius,
                borderWidth,
                controlHeight,
                duration,
                easing,
                boxShadow,
                fontFamily,
            });
        });

        it('字段齐全（11 个）', () => {
            expect(Object.keys(defaultTheme)).toHaveLength(11);
        });
    });
});
