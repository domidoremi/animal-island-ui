/**
 * RN 设计 token —— 与上游 Web 版 `src/styles/variables.less` 逐条对应。
 *
 * 映射规则（Web → RN）：
 *   - 颜色：原值照搬（都是 hex / rgba，RN 通用）。
 *   - 尺寸/间距/圆角/字号：Less 的 `px` 在 RN 里就是无单位数字，数值照搬。
 *   - 阴影：RN 0.76+ 支持 CSS 风格的 `boxShadow` 字符串，**逐字照搬**（详见
 *     `boxShadow` 的注释；Android 需要新架构）。
 *   - 字体：Web 版走 `@font-face` + woff2（`src/styles/fonts.less`），
 *     **woff2 是 Web 专有格式，RN 用不了**；RN 需要宿主 App 自行接入 ttf/otf
 *     （见 RN-PORT.md「未解决项」）。这里只留一个可覆盖的占位。
 *   - 动效：CSS 的 `0.15s` → RN 的毫秒数；`cubic-bezier(0.4, 0, 0.2, 1)` → 贝塞尔控制点数组。
 */

export const colors = {
    // ---------- Color Palette ----------
    primary: '#19c8b9',
    primaryHover: '#3dd4c6',
    primaryActive: '#50b9ab',
    primaryBg: '#e6f9f6',

    success: '#6fba2c',
    successHover: '#85cc45',
    successActive: '#5a9e1e',

    warning: '#f5c31c',
    warningHover: '#f7d04a',
    warningActive: '#dba90e',

    error: '#e05a5a',
    errorHover: '#e87878',
    errorActive: '#c94444',

    // ---------- Neutral ----------
    text: '#794f27',
    textSecondary: '#9f927d',
    textDisabled: '#c4b89e',

    focus: '#f5c31c', // @focus-yellow = @warning-color

    border: '#dcd8d1',
    borderHover: '#827157',
    borderLight: '#e8e2d6',
    shadowLight: 'rgba(61, 52, 40, 0.08)',

    bg: '#f8f8f0',
    bgSecondary: '#f0e8d8',
    bgDisabled: '#f0ece2',

    // ---------- Overlay ----------
    mask: 'rgba(0, 0, 0, 0.35)',
} as const;

/** @font-size-* */
export const fontSize = {
    sm: 12,
    base: 14,
    lg: 16,
} as const;

/** @line-height-base */
export const lineHeightBase = 1.5715;

/** @spacing-* */
export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
} as const;

/** @border-radius-* */
export const radius = {
    sm: 16,
    base: 18,
    lg: 24,
} as const;

/** @border-width */
export const borderWidth = 2;

/** @height-*（控件高度） */
export const controlHeight = {
    sm: 32,
    base: 40,
    lg: 48,
} as const;

/** @motion-duration-* → 毫秒 */
export const duration = {
    fast: 150,
    base: 250,
    slow: 350,
} as const;

/** @motion-ease: cubic-bezier(0.4, 0, 0.2, 1) */
export const easing = [0.4, 0, 0.2, 1] as const;

/**
 * 阴影。CSS 原值：
 *   @shadow-sm:   0 2px 4px 0  rgba(61, 52, 40, 0.06)
 *   @shadow-base: 0 3px 10px 0 rgba(61, 52, 40, 0.1)
 *   @shadow-lg:   0 8px 24px 0 rgba(61, 52, 40, 0.14)
 *
 * RN 0.76+ 支持 CSS 风格的 `boxShadow` 字符串，所以这里**逐字照搬**，不做拆解。
 * 这比拆成 `shadowColor`/`shadowOffset`/`shadowOpacity`/`shadowRadius` + Android
 * `elevation` 精确得多 —— 后者无法表达本库 Button 的
 * `0 5px 0 0 #bdaea0` 这类**零模糊硬偏移阴影**（elevation 只有模糊阴影）。
 *
 * ⚠️ 约束：`boxShadow` 在 Android 上**需要新架构**（RN 0.76 起为默认）。
 * 旧架构下这些阴影会被忽略（不报错，只是没有阴影）。
 */
export const boxShadow = {
    sm: '0 2px 4px 0 rgba(61, 52, 40, 0.06)',
    base: '0 3px 10px 0 rgba(61, 52, 40, 0.1)',
    lg: '0 8px 24px 0 rgba(61, 52, 40, 0.14)',
} as const;

/**
 * 字体。Web 版的 `@font-family` 是 Nunito + Noto Sans SC 的字体栈，
 * RN **不支持字体栈**（只能给一个 family），且 woff2 不可用。
 * 默认不设 family（用系统字体）；宿主 App 接入 ttf/otf 后可通过 ThemeProvider 覆盖。
 */
export const fontFamily: string | undefined = undefined;

export type Theme = {
    colors: typeof colors;
    fontSize: typeof fontSize;
    lineHeightBase: number;
    spacing: typeof spacing;
    radius: typeof radius;
    borderWidth: number;
    controlHeight: typeof controlHeight;
    duration: typeof duration;
    easing: typeof easing;
    boxShadow: typeof boxShadow;
    fontFamily: string | undefined;
};

export const defaultTheme: Theme = {
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
};
