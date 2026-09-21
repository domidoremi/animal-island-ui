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

/**
 * 品牌色系名。对应 Tag/Card/Title/Image 里那 12 个具名装饰色
 * （上游 Less 全是硬编码 hex，不走 `@` 变量），是本库「动物岛」视觉的招牌色。
 */
export type BrandColorName =
    | 'app-pink'
    | 'purple'
    | 'app-blue'
    | 'app-yellow'
    | 'app-orange'
    | 'app-teal'
    | 'app-green'
    | 'app-red'
    | 'lime-green'
    | 'yellow-green'
    | 'brown'
    | 'warm-peach-pink';

/**
 * 一个品牌色系的**全部消费槽**。原先同一批 hex 在 Tag/Card/Title/Image 里各写一遍，
 * 这里收拢成单一真源，5 个组件共用（见 RN-PORT.md 的暗色重皮说明）。
 *
 * **light 值逐字等于各组件当前的字面量**（`git` 移植前的写死色），所以组件改吃
 * `theme.brand[color]` 后，light 渲染逐字不变、现有断言全绿；只有 dark 下才换成
 * `deriveBrandDark` 推导的暗调（见 `appearance.ts`）。
 *
 * 槽位来源（以 app-pink 为例）：
 *   solidBg      Tag solid 底/边 · Card color 底 · Title front            #f8a6b2
 *   onSolid      Card color 字 · Title text（随色系变，黄/青柠系是深棕字）  #fff
 *   tagSolidOn   Tag solid 的字（**light 恒 #fff**，与 onSolid 分叉）       #fff
 *   border       Tag outline 色 · Card pattern 边（= solidBg）             #f8a6b2
 *   softBg/onSoft    Tag soft（Material Design 系，独立 hue）             #fce4ec / #c2185b
 *   containerBg/onContainer  Card pattern 底/字 · Image 底/字（两者相等）  #fde4e8 / #a85565
 *   titleBack/titleFold      Title 立体飘带的 --rb / --rk                 #e06880 / #a03060
 *   dotPrimary/dotSecondary  Card pattern 两层点阵 rgba                   rgba(248,166,178,0.18) / rgba(255,200,210,0.12)
 */
export type BrandFace = {
    solidBg: string;
    onSolid: string;
    tagSolidOn: string;
    border: string;
    softBg: string;
    onSoft: string;
    containerBg: string;
    onContainer: string;
    titleBack: string;
    titleFold: string;
    dotPrimary: string;
    dotSecondary: string;
};

/** 品牌色系的 light 值。每一格都逐字抄自组件现有字面量，改动即视为视觉变更。 */
export const brand: Record<BrandColorName, BrandFace> = {
    'app-pink': {
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
    purple: {
        solidBg: '#b77dee',
        onSolid: '#fff',
        tagSolidOn: '#fff',
        border: '#b77dee',
        softBg: '#f3e5f5',
        onSoft: '#7b1fa2',
        containerBg: '#f0e8ff',
        onContainer: '#6a3a9a',
        titleBack: '#9050d0',
        titleFold: '#5a1a9a',
        dotPrimary: 'rgba(183, 125, 238, 0.18)',
        dotSecondary: 'rgba(220, 180, 255, 0.12)',
    },
    'app-blue': {
        solidBg: '#889df0',
        onSolid: '#fff',
        tagSolidOn: '#fff',
        border: '#889df0',
        softBg: '#e6f0ff',
        onSoft: '#1565c0',
        containerBg: '#e8edff',
        onContainer: '#4a5a8a',
        titleBack: '#5068d8',
        titleFold: '#2030a0',
        dotPrimary: 'rgba(136, 157, 240, 0.18)',
        dotSecondary: 'rgba(180, 195, 255, 0.12)',
    },
    'app-yellow': {
        solidBg: '#f7cd67',
        onSolid: '#725d42',
        tagSolidOn: '#fff',
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
    'app-orange': {
        solidBg: '#e59266',
        onSolid: '#fff',
        tagSolidOn: '#fff',
        border: '#e59266',
        softBg: '#fff3e0',
        onSoft: '#e65100',
        containerBg: '#fff0e8',
        onContainer: '#8a4a2a',
        titleBack: '#c06a30',
        titleFold: '#7a3a10',
        dotPrimary: 'rgba(229, 146, 102, 0.18)',
        dotSecondary: 'rgba(255, 190, 150, 0.12)',
    },
    'app-teal': {
        solidBg: '#82d5bb',
        onSolid: '#fff',
        tagSolidOn: '#fff',
        border: '#82d5bb',
        softBg: '#e0f2f1',
        onSoft: '#00695c',
        containerBg: '#e8faf5',
        onContainer: '#2a6b5a',
        titleBack: '#40a880',
        titleFold: '#186048',
        dotPrimary: 'rgba(130, 213, 187, 0.18)',
        dotSecondary: 'rgba(170, 235, 210, 0.12)',
    },
    'app-green': {
        solidBg: '#8ac68a',
        onSolid: '#fff',
        tagSolidOn: '#fff',
        border: '#8ac68a',
        softBg: '#e8f5e9',
        onSoft: '#2e7d32',
        containerBg: '#e8f5e8',
        onContainer: '#3a6b3a',
        titleBack: '#509050',
        titleFold: '#205020',
        dotPrimary: 'rgba(138, 198, 138, 0.18)',
        dotSecondary: 'rgba(180, 220, 180, 0.12)',
    },
    'app-red': {
        solidBg: '#fc736d',
        onSolid: '#fff',
        tagSolidOn: '#fff',
        border: '#fc736d',
        softBg: '#ffebee',
        onSoft: '#c62828',
        containerBg: '#ffe8e8',
        onContainer: '#9a3a3a',
        titleBack: '#d43030',
        titleFold: '#900010',
        dotPrimary: 'rgba(252, 115, 109, 0.18)',
        dotSecondary: 'rgba(255, 160, 155, 0.12)',
    },
    'lime-green': {
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
    'yellow-green': {
        solidBg: '#ecdf52',
        onSolid: '#725d42',
        tagSolidOn: '#fff',
        border: '#ecdf52',
        softBg: '#f9fbe7',
        onSoft: '#827717',
        containerBg: '#fffde8',
        onContainer: '#6a5a28',
        titleBack: '#c0b010',
        titleFold: '#706800',
        dotPrimary: 'rgba(236, 223, 82, 0.18)',
        dotSecondary: 'rgba(255, 245, 140, 0.12)',
    },
    brown: {
        solidBg: '#9a835a',
        onSolid: '#fff',
        tagSolidOn: '#fff',
        border: '#9a835a',
        softBg: '#efebe9',
        onSoft: '#4e342e',
        containerBg: '#f5f0e0',
        onContainer: '#5a4a2a',
        titleBack: '#705830',
        titleFold: '#3a2810',
        dotPrimary: 'rgba(154, 131, 90, 0.18)',
        dotSecondary: 'rgba(190, 165, 120, 0.12)',
    },
    'warm-peach-pink': {
        solidBg: '#e18c6f',
        onSolid: '#fff',
        tagSolidOn: '#fff',
        border: '#e18c6f',
        softBg: '#fbe9e7',
        onSoft: '#bf360c',
        containerBg: '#fff0e8',
        onContainer: '#8a4a2a',
        titleBack: '#b85a30',
        titleFold: '#6a2a10',
        dotPrimary: 'rgba(225, 140, 111, 0.18)',
        dotSecondary: 'rgba(255, 185, 160, 0.12)',
    },
};

/**
 * 组件专属语义角色 —— 无法归入 `colors`（25 个基础语义）或 `brand`（品牌色系）的
 * 那些写死色，集中到这里配 light/dark 双值。**逐组件按阶段增补**：Phase 0 只放品牌
 * 消费者的 `default`（非品牌）中性色与跨组件通用槽，其余组件私有色在各自阶段迁入。
 *
 * light 值同样逐字等于组件现字面量。
 */
export type Roles = {
    /** Tag `default` 变体：solid 底 / 文字 / solid 边 / outline·dashed 边 */
    tagNeutralBg: string;
    tagNeutralOn: string;
    tagNeutralBorderSolid: string;
    tagNeutralBorderOutline: string;
    /** Button primary 的硬阴影底色 `0 5px 0 0 #bdaea0`（不在任何基础 token 里） */
    buttonPrimaryShadow: string;
};

/** 组件专属角色的 light 值。 */
export const roles: Roles = {
    tagNeutralBg: 'rgb(247, 243, 223)',
    tagNeutralOn: '#8f734f',
    tagNeutralBorderSolid: '#d4c4a8',
    tagNeutralBorderOutline: '#c4b89e',
    buttonPrimaryShadow: '#bdaea0',
};

export type Theme = {
    colors: { [Key in keyof typeof colors]: string };
    brand: Record<BrandColorName, BrandFace>;
    roles: Roles;
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
    brand,
    roles,
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
