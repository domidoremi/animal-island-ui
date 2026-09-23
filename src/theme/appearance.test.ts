import { brand, colors, defaultTheme, roles, type BrandColorName, type BrandFace } from './tokens';
import { appearanceColors, brandDark, resolveNativeTheme, rolesDark } from './appearance';

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
        it('只替换 colors / brand / roles，其余 token 与 defaultTheme 逐字不变', () => {
            // 暗色重皮后 brand / roles 在 dark 下也变（品牌色系与组件专属色的暗调），
            // 所以把这三项一并解构出去，只比剩下的尺寸/间距/动效等结构性 token。
            const { colors: _dc, brand: _db, roles: _dr, ...darkRest } = resolveNativeTheme('dark');
            const { colors: _lc, brand: _lb, roles: _lr, ...lightRest } = defaultTheme;
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

        it('补齐了组件会读到的派生态键（暗色下不再落回 light 值）', () => {
            const darkColors = resolveNativeTheme('dark').colors;
            for (const key of [
                'successHover',
                'successActive',
                'warningHover',
                'warningActive',
                'errorHover',
                'shadowLight',
            ] as const) {
                expect(darkColors[key]).not.toBe(colors[key]);
            }
        });
    });
});

/**
 * 品牌色系 `brand` 与组件专属 `roles` 的**冻结守卫**。
 *
 * light 值逐字抄自 Tag/Card/Title/Image 的现有字面量。这批断言把每一格钉死，
 * 是「暗色重皮不改 light 观感」的安全网 —— 组件后续改吃 `theme.brand[color]` 时，
 * 只要 light 值没漂，组件的现有颜色断言就不可能变红。任何一格被改动都会在这里先红。
 */
describe('brand / roles 的 light 值冻结（= 组件现有字面量）', () => {
    const BRAND_LIGHT_SPEC: Array<[BrandColorName, BrandFace]> = [
        [
            'app-pink',
            {
                solidBg: '#f8a6b2',
                onSolid: '#fff',
                tagSolidOn: '#fff',
                border: '#f8a6b2',
                softBg: '#fce4ec',
                onSoft: '#c2185b',
                containerBg: '#fde4e8',
                onContainer: '#a85565',
                titleBack: '#e06880',
                titleFold: '#a03060',
                dotPrimary: 'rgba(248, 166, 178, 0.18)',
                dotSecondary: 'rgba(255, 200, 210, 0.12)',
            },
        ],
        [
            'app-yellow',
            {
                solidBg: '#f7cd67',
                onSolid: '#725d42', // Card/Title：黄底用深棕字
                tagSolidOn: '#fff', // Tag solid：恒白字（与 onSolid 分叉）
                border: '#f7cd67',
                softBg: '#fff8e1',
                onSoft: '#f9a825',
                containerBg: '#fff8e0',
                onContainer: '#7a6528',
                titleBack: '#d4a030',
                titleFold: '#8a6010',
                dotPrimary: 'rgba(247, 205, 103, 0.18)',
                dotSecondary: 'rgba(255, 230, 160, 0.12)',
            },
        ],
        [
            'lime-green',
            {
                solidBg: '#d1da49',
                onSolid: '#3d5a1a',
                tagSolidOn: '#fff',
                border: '#d1da49',
                softBg: '#f1f8e9',
                onSoft: '#558b2f',
                containerBg: '#f5f8e0',
                onContainer: '#5a6b28',
                titleBack: '#90a010',
                titleFold: '#485800',
                dotPrimary: 'rgba(209, 218, 73, 0.18)',
                dotSecondary: 'rgba(230, 240, 130, 0.12)',
            },
        ],
    ];

    it.each(BRAND_LIGHT_SPEC)('brand[%s] 逐槽 = 现字面量', (name, face) => {
        expect(brand[name]).toEqual(face);
    });

    it('brand 覆盖全部 12 个品牌色系', () => {
        expect(Object.keys(brand)).toHaveLength(12);
    });

    it('roles 的 light 值 = 现字面量（场景面 / 浮层控件 / 阴影 / Tag 中性色 / Button 硬阴影）', () => {
        expect(roles).toEqual({
            surfaceScene: 'rgb(247, 243, 223)',
            onSceneStrong: '#725d42',
            onSceneMuted: '#8a7b66',
            tagNeutralOn: '#8f734f',
            tagNeutralBorderSolid: '#d4c4a8',
            tagNeutralBorderOutline: '#c4b89e',
            controlSurface: 'rgba(255, 255, 255, 0.92)',
            controlBorder: 'rgba(121, 79, 39, 0.16)',
            controlSurfaceMuted: 'rgba(255, 255, 255, 0.85)',
            carouselDotIdle: '#d4c9b4',
            trackShadowColor: 'rgba(114, 93, 66, 0.08)',
            modalShadowColor: 'rgba(0, 0, 0, 0.25)',
            onAccentSolid: '#fff',
            buttonPrimaryShadow: '#bdaea0',
        });
    });

    it('defaultTheme 携带 light 的 brand / roles（同一引用）', () => {
        expect(defaultTheme.brand).toBe(brand);
        expect(defaultTheme.roles).toBe(roles);
    });
});

describe('brand / roles 的 dark 值', () => {
    const COLOR_RE_LOCAL = /^#[0-9a-f]{6}$|^rgba?\(/i;

    it('brandDark 覆盖全部 12 系，且每系每槽都是合法颜色字符串', () => {
        expect(Object.keys(brandDark)).toHaveLength(12);
        for (const face of Object.values(brandDark)) {
            for (const value of Object.values(face)) {
                expect(value).toMatch(COLOR_RE_LOCAL);
            }
        }
    });

    it('brandDark 与 light 的 key 集合一致（推导不丢槽、不多槽）', () => {
        for (const name of Object.keys(brand) as BrandColorName[]) {
            expect(Object.keys(brandDark[name]).sort()).toEqual(Object.keys(brand[name]).sort());
        }
    });

    it('dark 的品牌实心底确实变了色（与 light 不同）', () => {
        for (const name of Object.keys(brand) as BrandColorName[]) {
            expect(brandDark[name].solidBg).not.toBe(brand[name].solidBg);
        }
    });

    it('deriveBrandDark 由 solidBg 推导：黄系落深墨字、其余落近白字', () => {
        // app-yellow 的 solidBg 亮度高 → onSolid 应是深墨
        expect(brandDark['app-yellow'].onSolid).toBe('#20251e');
        // purple 的 solidBg 偏暗 → onSolid 应是近白
        expect(brandDark.purple.onSolid).toBe('#fffaf0');
    });

    it('rolesDark 每个值都是合法颜色字符串', () => {
        for (const value of Object.values(rolesDark)) {
            expect(value).toMatch(COLOR_RE_LOCAL);
        }
    });
});
