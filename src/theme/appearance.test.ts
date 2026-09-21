import { colors, defaultTheme } from './tokens';
import { appearanceColors, resolveNativeTheme } from './appearance';

/**
 * 主题解析（明/暗）的**行为不变量**测试。
 *
 * 与 `tokens.test.ts` 不同：暗色调是本分支新写的（上游 Web 版没有暗色主题，
 * `variables.less` 里无对应值），没有「上游真值」可比对。所以这里不冻结具体 hex，
 * 只锁三件会真正引发回归的事：
 *   1. light 必须与 `defaultTheme` 恒等 —— 上游默认皮肤归本包所有，不能被主题层改写。
 *   2. dark 只替换颜色，其余 token（间距/圆角/动效/阴影……）逐字不变。
 *   3. 明暗两套语义色板的 key 集合一致、dark 颜色映射不丢键 —— 新增一个颜色 token
 *      却忘了在 dark 里映射，是这层最可能出的错。
 */

const COLOR_RE = /^#[0-9a-f]{6}$|^rgba?\(/i;
const COLOR_KEY_COUNT = 25; // 与 tokens.ts 的 colors 一致

describe('appearanceColors 语义色板', () => {
    it('light 与 dark 的语义角色 key 集合完全一致', () => {
        expect(Object.keys(appearanceColors.dark).sort()).toEqual(Object.keys(appearanceColors.light).sort());
    });

    it.each(['light', 'dark'] as const)('%s 每个角色都是合法颜色字符串', (mode) => {
        for (const value of Object.values(appearanceColors[mode])) {
            expect(value).toMatch(COLOR_RE);
        }
    });

    it('light 语义角色直接引用 tokens（不另起一套真值）', () => {
        expect(appearanceColors.light.canvas).toBe(colors.bg);
        expect(appearanceColors.light.surfaceMuted).toBe(colors.bgSecondary);
        expect(appearanceColors.light.onSurface).toBe(colors.text);
        expect(appearanceColors.light.primary).toBe(colors.primary);
        expect(appearanceColors.light.primaryContainer).toBe(colors.primaryBg);
        expect(appearanceColors.light.border).toBe(colors.border);
        expect(appearanceColors.light.borderStrong).toBe(colors.borderHover);
        expect(appearanceColors.light.divider).toBe(colors.borderLight);
    });
});

describe('resolveNativeTheme', () => {
    it('默认参数等于 light', () => {
        expect(resolveNativeTheme()).toBe(resolveNativeTheme('light'));
    });

    it('light 与 defaultTheme 恒等（同一引用）', () => {
        expect(resolveNativeTheme('light')).toBe(defaultTheme);
    });

    describe('dark', () => {
        it('只替换 colors，其余 token 与 defaultTheme 逐字不变', () => {
            const { colors: _darkColors, ...darkRest } = resolveNativeTheme('dark');
            const { colors: _lightColors, ...lightRest } = defaultTheme;
            expect(darkRest).toEqual(lightRest);
        });

        it('colors 的 key 集合与 light 一致（映射不丢键、不多键）', () => {
            const darkColors = resolveNativeTheme('dark').colors;
            expect(Object.keys(darkColors)).toHaveLength(COLOR_KEY_COUNT);
            expect(Object.keys(darkColors).sort()).toEqual(Object.keys(colors).sort());
        });

        it('每个颜色都是合法颜色字符串', () => {
            for (const value of Object.values(resolveNativeTheme('dark').colors)) {
                expect(value).toMatch(COLOR_RE);
            }
        });

        it('关键角色确实切成了暗色（与 light 不同值）', () => {
            const darkColors = resolveNativeTheme('dark').colors;
            expect(darkColors.bg).not.toBe(colors.bg);
            expect(darkColors.text).not.toBe(colors.text);
            expect(darkColors.primary).not.toBe(colors.primary);
            expect(darkColors.border).not.toBe(colors.border);
        });

        it('dark 颜色映射自 appearanceColors.dark 的语义角色', () => {
            const p = appearanceColors.dark;
            const darkColors = resolveNativeTheme('dark').colors;
            expect(darkColors.primary).toBe(p.primary);
            expect(darkColors.primaryBg).toBe(p.primaryContainer);
            expect(darkColors.text).toBe(p.onSurface);
            expect(darkColors.textSecondary).toBe(p.onSurfaceMuted);
            expect(darkColors.bg).toBe(p.surface);
            expect(darkColors.bgSecondary).toBe(p.surfaceContainer);
            expect(darkColors.bgDisabled).toBe(p.surfaceMuted);
            expect(darkColors.border).toBe(p.border);
            expect(darkColors.borderHover).toBe(p.borderStrong);
            expect(darkColors.borderLight).toBe(p.divider);
        });
    });
});
