import { brand, colors, defaultTheme, type BrandColorName, type BrandFace, type Roles, type Theme } from './tokens';

export type ThemeMode = 'light' | 'dark';

/** Semantic roles for host surfaces. Kept here so consumers never copy the skin. */
export const appearanceColors = {
    light: {
        canvas: colors.bg,
        surface: '#fffaf0',
        surfaceContainer: '#f7f1e6',
        surfaceElevated: '#fffaf0',
        surfaceMuted: colors.bgSecondary,
        surfaceOverlay: '#fffaf0',
        onSurface: colors.text,
        onSurfaceMuted: '#725d42',
        primary: colors.primary,
        onPrimary: '#3d3428',
        primaryContainer: colors.primaryBg,
        onPrimaryContainer: '#315c50',
        secondary: '#725d42',
        onSecondary: '#fffaf0',
        secondaryContainer: '#eee1c9',
        onSecondaryContainer: '#614728',
        tertiary: colors.warning,
        onTertiary: '#3d3428',
        border: colors.border,
        borderStrong: colors.borderHover,
        divider: colors.borderLight,
        focus: '#996600',
        selection: '#d6eee2',
        success: '#3d761a',
        warning: '#8a6500',
        error: '#b33939',
        info: '#315c50',
    },
    dark: {
        canvas: '#20251e',
        surface: '#2b3328',
        surfaceContainer: '#343e30',
        surfaceElevated: '#394334',
        surfaceMuted: '#30392c',
        surfaceOverlay: '#2b3328',
        onSurface: '#f4ebdd',
        onSurfaceMuted: '#cec3af',
        primary: '#6bdac8',
        onPrimary: '#173c32',
        primaryContainer: '#254c43',
        onPrimaryContainer: '#c4f3e6',
        secondary: '#dfc69b',
        onSecondary: '#3d3428',
        secondaryContainer: '#49432f',
        onSecondaryContainer: '#f3e4c7',
        tertiary: colors.warning,
        onTertiary: '#3d3428',
        border: '#59634e',
        borderStrong: '#9ca783',
        divider: '#47513e',
        focus: colors.focus,
        selection: '#365c4a',
        success: '#b0d785',
        warning: '#f5d479',
        error: '#ffaaa0',
        info: '#a1dfd0',
    },
} as const;

// ============================================================================
// 品牌色系的暗调推导
// ============================================================================
//
// 品牌 12 系 × 12 槽 = 144 个 dark 值，纯手配不可维护。改为从每个色系的**基准 hue**
// （light 的 `solidBg`）经 HSL 变换推导整组暗调，`deriveBrandDark` 是纯函数，
// 在模块加载时算一次成 `brandDark` const，不进渲染热路径。
//
// 推导目标是「暗底友好」：实心 chip 保持中等明度、去一点饱和；容器/soft 底压成低明度
// 低饱和的深色；容器/soft 上的文字提亮；点阵从「深点压浅底」反相成「浅点压深底」。

type HSL = { h: number; s: number; l: number };

/** #rrggbb → HSL（h∈[0,360), s/l∈[0,1]）。品牌 solidBg 全是 6 位 hex。 */
function hexToHsl(hex: string): HSL {
    const n = parseInt(hex.slice(1), 16);
    // 用整除/取模而非位运算：eslint 的 no-bitwise 在本仓是零基线，保持不引入 warning。
    const r = (Math.floor(n / 65536) % 256) / 255;
    const g = (Math.floor(n / 256) % 256) / 255;
    const b = (n % 256) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0) return { h: 0, s: 0, l };
    const s = d / (1 - Math.abs(2 * l - 1));
    let h: number;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
    return { h, s, l };
}

/** HSL → {r,g,b}（0-255 整数）。 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hp = h / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let r = 0;
    let g = 0;
    let b = 0;
    if (hp < 1) [r, g, b] = [c, x, 0];
    else if (hp < 2) [r, g, b] = [x, c, 0];
    else if (hp < 3) [r, g, b] = [0, c, x];
    else if (hp < 4) [r, g, b] = [0, x, c];
    else if (hp < 5) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    const m = l - c / 2;
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const hex2 = (n: number) => n.toString(16).padStart(2, '0');

function hslToHex(h: number, s: number, l: number): string {
    const [r, g, b] = hslToRgb(h, clamp01(s), clamp01(l));
    return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}

/** 相对亮度（sRGB 近似），用于在实心底上二选一：亮色系用深墨、暗色系用近白。 */
function relLuminance(hex: string): number {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.floor(n / 65536) % 256;
    const g = Math.floor(n / 256) % 256;
    const b = n % 256;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** 暗底上的深墨字 / 近白字，复刻 light 里黄·青柠·黄绿系用深棕、其余用白的取向。 */
const DARK_INK = '#20251e';
const DARK_ON_LIGHT = '#fffaf0';

/** 一个品牌基色（light 的 solidBg）→ 暗调 BrandFace。 */
export function deriveBrandDark(baseHex: string): BrandFace {
    const { h, s } = hexToHsl(baseHex);
    const cs = Math.min(s, 0.7); // 暗底上过饱和会刺眼，收一下
    const solidBg = hslToHex(h, cs, 0.58);
    const onSolid = relLuminance(solidBg) > 0.6 ? DARK_INK : DARK_ON_LIGHT;
    const [dr, dg, db] = hslToRgb(h, clamp01(cs * 0.55), 0.75); // 点阵浅色
    return {
        solidBg,
        onSolid,
        tagSolidOn: onSolid,
        border: hslToHex(h, cs * 0.8, 0.48),
        softBg: hslToHex(h, cs * 0.3, 0.22),
        onSoft: hslToHex(h, cs * 0.6, 0.82),
        containerBg: hslToHex(h, cs * 0.35, 0.24),
        onContainer: hslToHex(h, cs * 0.55, 0.8),
        titleBack: hslToHex(h, cs, 0.43),
        titleFold: hslToHex(h, cs, 0.28),
        dotPrimary: `rgba(${dr}, ${dg}, ${db}, 0.18)`,
        dotSecondary: `rgba(${dr}, ${dg}, ${db}, 0.12)`,
    };
}

/** 少数推导后观感不佳的色系可在此逐槽钉死（目前无）。 */
const BRAND_DARK_OVERRIDE: Partial<Record<BrandColorName, Partial<BrandFace>>> = {};

/** 品牌色系的暗调表：由 light 基色推导 + 覆盖表。模块级 const，只算一次。 */
export const brandDark: Record<BrandColorName, BrandFace> = Object.fromEntries(
    (Object.keys(brand) as BrandColorName[]).map((name) => [
        name,
        { ...deriveBrandDark(brand[name].solidBg), ...BRAND_DARK_OVERRIDE[name] },
    ])
) as Record<BrandColorName, BrandFace>;

/** 组件专属角色的暗调值。对齐 `appearanceColors.dark` 的面/边/文字层级。 */
export const rolesDark: Roles = {
    // 奶油场景面 → 暗底的容器面；其上的强调/正文字用亮/中亮墨对齐层级
    surfaceScene: appearanceColors.dark.surfaceContainer,
    onSceneStrong: appearanceColors.dark.onSurface,
    onSceneMuted: appearanceColors.dark.onSurfaceMuted,
    tagNeutralOn: appearanceColors.dark.onSurfaceMuted,
    tagNeutralBorderSolid: appearanceColors.dark.border,
    tagNeutralBorderOutline: appearanceColors.dark.border,
    // 浮层控件：light 是近白 + 暖描边压在奶油底上；暗底改成半透明的抬升深面 + 浅雾描边
    controlSurface: 'rgba(57, 67, 52, 0.92)',
    controlBorder: 'rgba(156, 167, 131, 0.3)',
    controlSurfaceMuted: 'rgba(57, 67, 52, 0.85)',
    // 未选中圆点：light 是暖灰米；暗底改成压低明度的橄榄灰
    carouselDotIdle: '#6f7a63',
    // 内阴影 / 投影：暗底上纯黑要更重才有凹陷/浮起感（light 是暖棕低 alpha）
    trackShadowColor: 'rgba(0, 0, 0, 0.28)',
    modalShadowColor: 'rgba(0, 0, 0, 0.5)',
    // primary 圆钮在暗底上是亮青，恒白字会糊，改成深墨（= onPrimary）
    onAccentSolid: appearanceColors.dark.onPrimary,
    // 硬偏移阴影在暗底上要比面更深，才有「下沿」立体感（light 的 #bdaea0 是暖灰）
    buttonPrimaryShadow: '#141810',
};

export function resolveNativeTheme(mode: ThemeMode = 'light'): Theme {
    if (mode === 'light') return defaultTheme;
    const palette = appearanceColors.dark;
    return {
        ...defaultTheme,
        colors: {
            ...colors,
            primary: palette.primary,
            primaryHover: '#95eadb',
            primaryActive: '#54bba9',
            primaryBg: palette.primaryContainer,
            text: palette.onSurface,
            textSecondary: palette.onSurfaceMuted,
            textDisabled: '#929782',
            bg: palette.surface,
            bgSecondary: palette.surfaceContainer,
            bgDisabled: palette.surfaceMuted,
            border: palette.border,
            borderHover: palette.borderStrong,
            borderLight: palette.divider,
            focus: palette.focus,
            success: palette.success,
            // 补齐 light 分支没覆盖、组件会读到的派生态，否则暗色下渲染成 light 值
            successHover: '#c2e79c',
            successActive: '#9bc46f',
            warning: palette.warning,
            warningHover: '#f8de95',
            warningActive: '#e0bc5c',
            error: palette.error,
            errorHover: '#ffc0b8',
            errorActive: '#a53d37',
            shadowLight: 'rgba(0, 0, 0, 0.24)',
            mask: 'rgba(0, 0, 0, 0.6)',
        },
        brand: brandDark,
        roles: rolesDark,
    };
}
