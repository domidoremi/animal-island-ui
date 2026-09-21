import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Polygon, Svg } from 'react-native-svg';

export type TitleSize = 'small' | 'middle' | 'large';

export type TitleColor =
    | 'default'
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

export type TitleVariant = 'ribbon' | 'layer' | 'tab';

export interface TitleProps {
    /** 标题内容 */
    children: React.ReactNode;
    /** 尺寸 */
    size?: TitleSize;
    /** 配色，与 Card 同名色板 */
    color?: TitleColor;
    /** 标题样式：ribbon 飘带（默认）/ layer 双层纸 / tab 折角便签 */
    variant?: TitleVariant;
    /** 自定义样式（作用于最外层容器，对应 Web 的 `className` + `style`） */
    style?: StyleProp<ViewStyle>;
    /**
     * 测试标识（RN 里 `className` 的对应物）。
     *
     * 与 Button 的 `${testID}-loading-icon` 同一约定：组件内部还会派生
     * `${testID}-ribbon` / `-ribbon-text` / `-layer` / `-layer-front` / `-tab` / `-tab-text`，
     * 供测试定位 Web 版用类名定位的那几个结构节点（RN 没有类名，也没有 `querySelector`）。
     */
    testID?: string;
}

const SIZE_MAP: Record<TitleSize, number> = {
    small: 14,
    middle: 20,
    large: 28,
};

/** 一层配色 = Web 的 `--rf` / `--rb` / `--rk` / `--rt` 四个 CSS 变量 */
type Palette = { front: string; back: string; fold: string; text: string };

/**
 * 对应 `title.module.less` 里 12 个 `.color-*` 类的 `--rf/--rb/--rk/--rt`。
 *
 * ⚠️ 这些色值在 Less 里**全是硬编码 hex**（不是 `@` 变量），所以这里也照搬字面量，
 * **不**走 `src/theme/tokens.ts`。`default` 取的是 `.ribbon` / `.layer` / `.tab`
 * 三处各自声明、但内容完全相同的默认值（绿色）。
 */
const PALETTE: Record<TitleColor, Palette> = {
    default: { front: '#27d039', back: '#20992a', fold: '#115017', text: '#fff' },
    'app-pink': { front: '#f8a6b2', back: '#e06880', fold: '#a03060', text: '#fff' },
    purple: { front: '#b77dee', back: '#9050d0', fold: '#5a1a9a', text: '#fff' },
    'app-blue': { front: '#889df0', back: '#5068d8', fold: '#2030a0', text: '#fff' },
    'app-yellow': { front: '#f7cd67', back: '#d4a030', fold: '#8a6010', text: '#725d42' },
    'app-orange': { front: '#e59266', back: '#c06a30', fold: '#7a3a10', text: '#fff' },
    'app-teal': { front: '#82d5bb', back: '#40a880', fold: '#186048', text: '#fff' },
    'app-green': { front: '#8ac68a', back: '#509050', fold: '#205020', text: '#fff' },
    'app-red': { front: '#fc736d', back: '#d43030', fold: '#900010', text: '#fff' },
    'lime-green': { front: '#d1da49', back: '#90a010', fold: '#485800', text: '#3d5a1a' },
    'yellow-green': { front: '#ecdf52', back: '#c0b010', fold: '#706800', text: '#725d42' },
    brown: { front: '#9a835a', back: '#705830', fold: '#3a2810', text: '#fff' },
    'warm-peach-pink': { front: '#e18c6f', back: '#b85a30', fold: '#6a2a10', text: '#fff' },
};

interface BodyProps {
    children: React.ReactNode;
    /** SIZE_MAP[size]，也是所有 `em` 单位的基准 */
    fontSize: number;
    palette: Palette;
    testID?: string;
}

/** 小数像素（em 换算结果）在样式里保留两位，避免 `-1.2000000000000002px` 这种噪声 */
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * `<Svg>` 的宽高取整（**向下**取整）。
 *
 * `react-native-svg` 会把传给原生视图的 `width` / `height` 取整（实测 47.6 → 47、35.64 → 35），
 * 而 `<Polygon>` 的 `points` 不会被改。如果两者不一致，多出来的那零点几像素会被视口裁掉。
 * 所以这里主动把 SVG 盒子取整，并让**相邻的** `<View>`（Tab 的切角拼接）用同一个整数，
 * 保证图形既不被裁、也不出现接缝。代价是盒子的亚像素精度（≤1px）。
 */
const svgSize = (n: number) => Math.floor(n);

/**
 * `em` → RN 数字。
 *
 * Web 版整个 Title 的尺寸体系都建立在 `em` 上（`height: 2em`、`padding: 0 1.6em`…），
 * 字号由 `SIZE_MAP` 通过 inline style 注入，em 随之缩放。**RN 不支持 `em`**，
 * 所以统一用 `fontSize` 乘出来；基准字号就是 `.title` 那一层的 `fontSize`。
 */
const emOf = (fontSize: number) => (n: number) => round2(n * fontSize);

/**
 * `filter: drop-shadow(0 <y> <blur> <color>)` → RN 0.76+ 的 `filter: [{ dropShadow }]`。
 *
 * ⚠️ 两处近似（猜的，没有视觉验证）：
 *   1. CSS 的 blur radius 与 RN 的 `standardDeviation` 不是同一个量
 *      （CSS 规范里 blur radius ≈ 2σ），这里直接把 blur 值当 σ 用，阴影会略“硬”一点。
 *   2. `drop-shadow` 跟随的是**整个子树的 alpha 轮廓**（飘带/便签是由多块拼出来的，
 *      轮廓外凸），前提是 RN 的 `filter` 作用在容器子树上 —— 这点没有实测过。
 * 滤镜同样要求 Android 新架构，旧架构下会被静默忽略（与 `boxShadow` 同一约束）。
 */
const dropShadow = (offsetY: number, blur: number, color: string) => [
    { dropShadow: { offsetX: 0, offsetY, standardDeviation: blur, color } },
];

/**
 * Ribbon 飘带：燕尾（Web 用 `clip-path`）+ 折角（Web 用 border 三角）+ 正面主体。
 *
 * Web 的三块装饰都是**纯 CSS 画出来的形状**，RN 既没有 `clip-path` 也没有 border 三角，
 * 按 RN-PORT.md 的约定改用 `react-native-svg` 的 `<Polygon>`：
 *   - 两块燕尾是 1.7em × 1.7em 的方块被 `clip-path` 切出的多边形；
 *   - 两块折角是 `border-width: 0 0.95em 0.45em 0` 这类「0 尺寸盒子 + 有宽度的边框」
 *     形成的直角三角形（相邻边框宽为 0 时，该边框退化成三角形，斜边是盒子的对角线）。
 *     Web 的 `top: calc(100% - 0.05em)` 在 RN 里没有 calc，换算成 `bottom: -0.4em`
 *     （盒子高 0.45em，顶边在容器底边上方 0.05em）。
 *
 * 被丢弃的：`clip-path` 里那 0.08em 的圆角（SVG Polygon 没有逐角圆角，1.7em 的方块上
 * 这点圆角约 4.7%，视觉可忽略）；`:hover`（触摸设备没有 hover）。
 */
const Ribbon: React.FC<BodyProps> = ({ children, fontSize, palette, testID }) => {
    const em = emOf(fontSize);
    const tail = svgSize(em(1.7)); // .ribbonBack { width: 1.7em; height: 1.7em }
    const foldW = svgSize(em(0.95)); // .ribbonFold border-width 的水平分量
    const foldH = svgSize(em(0.45)); // .ribbonFold border-width 的垂直分量
    const tailNotchX = round2(tail * 0.3); // clip-path 的 30%
    const tailNotchY = round2(tail * 0.5); // clip-path 的 50%
    const tailRightNotchX = round2(tail * 0.7); // 右侧 clip-path 的 70%

    return (
        <View
            testID={testID ? `${testID}-ribbon` : undefined}
            style={[
                styles.ribbon,
                {
                    height: em(2), // .ribbon { height: 2em }
                    paddingHorizontal: em(1.6), // .ribbon { padding: 0 1.6em }
                    filter: dropShadow(em(0.08), em(0.12), 'rgba(0, 0, 0, 0.05)'),
                },
            ]}
        >
            {/* 1. 左燕尾：clip-path: polygon(100% 0%, 100% 100%, 0% 100%, 30% 50%, 0% 0%) */}
            <Svg
                width={tail}
                height={tail}
                style={[styles.ribbonTail, { left: em(-0.6), bottom: em(-0.4) }]}
                pointerEvents="none"
            >
                <Polygon
                    points={`${tail},0 ${tail},${tail} 0,${tail} ${tailNotchX},${tailNotchY} 0,0`}
                    fill={palette.back}
                />
            </Svg>

            {/* 2. 右燕尾：clip-path: polygon(0% 0%, 100% 0%, 70% 50%, 100% 100%, 0% 100%) */}
            <Svg
                width={tail}
                height={tail}
                style={[styles.ribbonTail, { right: em(-0.6), bottom: em(-0.4) }]}
                pointerEvents="none"
            >
                <Polygon
                    points={`0,0 ${tail},0 ${tailRightNotchX},${tailNotchY} ${tail},${tail} 0,${tail}`}
                    fill={palette.back}
                />
            </Svg>

            {/* 3. 左折角：left: 0.15em; border-color: transparent var(--rk) transparent transparent */}
            <Svg
                width={foldW}
                height={foldH}
                style={[styles.ribbonFold, { left: em(0.15), bottom: em(-0.4) }]}
                pointerEvents="none"
            >
                <Polygon points={`0,0 ${foldW},0 ${foldW},${foldH}`} fill={palette.fold} />
            </Svg>

            {/* 4. 右折角：right: 0.16em; border-color: transparent transparent transparent var(--rk) */}
            <Svg
                width={foldW}
                height={foldH}
                style={[styles.ribbonFold, { right: em(0.16), bottom: em(-0.4) }]}
                pointerEvents="none"
            >
                <Polygon points={`${foldW},0 0,0 0,${foldH}`} fill={palette.fold} />
            </Svg>

            {/* 5. 正面主体：inset: 0 0.1em; transform: perspective(11.5em) rotateX(3deg) */}
            <View
                style={[
                    styles.ribbonFront,
                    {
                        left: em(0.1),
                        right: em(0.1),
                        backgroundColor: palette.front,
                        borderRadius: em(0.2),
                        transform: [{ perspective: em(11.5) }, { rotateX: '3deg' }],
                        // box-shadow: inset 0 -0.06em 0 rgba(0, 0, 0, 0.05)
                        boxShadow: `inset 0 ${em(-0.06)}px 0 rgba(0, 0, 0, 0.05)`,
                    },
                ]}
                pointerEvents="none"
            />

            {/*
             * 6. 文字。
             * Web 的 `.ribbonText { display: inline-flex; align-items: center; height: 2em;
             * padding-top: 0.11em }` 靠 flex 把 1em 高的行盒在 2em 的框里垂直居中；
             * RN 的 <Text> 不会把行盒居中，所以改成「行盒高度 = 2em - 0.11em」——
             * 效果等价：字形中心落在 0.11em + 0.945em = 1.055em 处。
             */}
            <Text
                testID={testID ? `${testID}-ribbon-text` : undefined}
                numberOfLines={1}
                style={[
                    styles.ribbonText,
                    {
                        fontSize,
                        height: em(2),
                        paddingTop: em(0.11),
                        lineHeight: em(2) - em(0.11),
                        color: palette.text,
                        letterSpacing: em(0.04),
                        textShadowOffset: { width: 0, height: em(0.04) },
                        textShadowRadius: em(0.08),
                    },
                ]}
            >
                {children}
            </Text>
        </View>
    );
};

/**
 * Layer 双层纸：背层纸片是 Web 的 `.layer::before` 伪元素。
 * RN 没有伪元素，落成一个 `position: absolute` 的 `<View>`（纯圆角矩形，不需要 SVG）。
 */
const Layer: React.FC<BodyProps> = ({ children, fontSize, palette, testID }) => {
    const em = emOf(fontSize);

    return (
        <View
            testID={testID ? `${testID}-layer` : undefined}
            style={[styles.layer, { height: em(2.1) }]} // .layer { height: 2.1em }
        >
            {/* .layer::before { left: -0.26em; top: -0.3em; right: 0.65em; bottom: 0; ... } */}
            <View
                style={[
                    styles.layerBack,
                    {
                        left: em(-0.26),
                        top: em(-0.3),
                        right: em(0.65),
                        backgroundColor: palette.back,
                        borderRadius: em(0.35),
                    },
                ]}
                pointerEvents="none"
            />

            {/*
             * .layerFront：Web 是 inline-flex + align-items: center + height: 2.1em，
             * 行盒（继承 .title 的 line-height: 1）在 2.1em 里垂直居中。
             * RN 的 <Text> 不居中行盒，改成 lineHeight = 2.1em —— 字形中心同样落在 1.05em。
             * `justify-content: center` 在 Web 上是水平居中文字，RN 里 Text 按内容收缩，
             * 用 textAlign: 'center' 等价表达。
             */}
            <Text
                testID={testID ? `${testID}-layer-front` : undefined}
                numberOfLines={1}
                style={[
                    styles.layerFront,
                    {
                        fontSize,
                        height: em(2.1),
                        paddingHorizontal: em(1.55),
                        lineHeight: em(2.1),
                        borderRadius: em(0.35),
                        backgroundColor: palette.front,
                        color: palette.text,
                        letterSpacing: em(0.04),
                        // box-shadow: 0 0.1em 0.16em rgba(0, 0, 0, 0.08)
                        boxShadow: `0 ${em(0.1)}px ${em(0.16)}px rgba(0, 0, 0, 0.08)`,
                        textShadowOffset: { width: 0, height: em(0.05) },
                        textShadowRadius: em(0.1),
                    },
                ]}
            >
                {children}
            </Text>
        </View>
    );
};

/**
 * Tab 折角便签。
 *
 * 背景是 `linear-gradient(135deg, transparent 0.9em, var(--rf) 0.9em)`，也就是
 * 「左上角斜切掉一块」。CSS 渐变里这个斜切线的方程是 `x + y = 0.9em × √2`
 * （135° 渐变线从渐变盒的左上角起算，0.9em 是沿渐变线方向的距离，
 * 与渐变线垂直的等值线即 `(x + y) / √2 = 0.9em`，与盒子尺寸无关），
 * 所以切角在两条边上的落点都是 `0.9em × √2 ≈ 1.2728em`。
 *
 * RN 没有 `clip-path`，也没有「渐变切角」；这里把这块背景拆成**三个已知尺寸的块**
 * （切角三角形 + 右上矩形 + 下半矩形）而不是测量宽度后画一条 SVG 路径：
 *   - 尺寸全部由 `fontSize` 推出来，不依赖 `onLayout`，所以**首帧就是完整图形**；
 *   - 代价是三块相邻处可能有亚像素接缝（同色，实际不可见）。
 * `::after` 的折角三角同样用 `<Polygon>` 复刻。
 *
 * 被丢弃的：`:hover { transform: scale(1.06) }`（触摸设备没有 hover）。
 */
const Tab: React.FC<BodyProps> = ({ children, fontSize, palette, testID }) => {
    const em = emOf(fontSize);
    // 切角在边上的落点 = 0.9em × √2；同时是 SVG 盒子的尺寸，所以取整（见 svgSize 注释）
    const cut = svgSize(0.9 * Math.SQRT2 * fontSize);
    const fold = svgSize(em(0.9)); // .tab::after 的 border-width

    return (
        <View
            testID={testID ? `${testID}-tab` : undefined}
            style={[
                styles.tab,
                {
                    height: em(2), // .tab { height: 2em }
                    paddingHorizontal: em(1.5), // .tab { padding: 0 1.5em }
                    borderRadius: em(0.32),
                    filter: dropShadow(em(0.1), em(0.16), 'rgba(0, 0, 0, 0.08)'),
                },
            ]}
        >
            {/* 切角三角形：{(cut,0), (cut,cut), (0,cut)} */}
            <Svg width={cut} height={cut} style={styles.tabCorner} pointerEvents="none">
                <Polygon points={`${cut},0 ${cut},${cut} 0,${cut}`} fill={palette.front} />
            </Svg>

            {/* 右上块（含右上圆角） */}
            <View
                style={[
                    styles.tabTopBlock,
                    {
                        left: cut,
                        height: cut,
                        backgroundColor: palette.front,
                        borderTopRightRadius: em(0.32),
                    },
                ]}
                pointerEvents="none"
            />

            {/* 下半块（含两个下圆角） */}
            <View
                style={[
                    styles.tabBottomBlock,
                    {
                        top: cut,
                        backgroundColor: palette.front,
                        borderBottomLeftRadius: em(0.32),
                        borderBottomRightRadius: em(0.32),
                    },
                ]}
                pointerEvents="none"
            />

            {/*
             * .tab::after { right: 0; bottom: 0; border-width: 0 0 0.9em 0.9em;
             *               border-color: transparent transparent var(--rk) transparent }
             * 只有底边框有颜色 → 0.9em 见方的右下角里、被主对角线切开的左下那一半。
             */}
            <Svg width={fold} height={fold} style={styles.tabFold} pointerEvents="none">
                <Polygon points={`0,0 0,${fold} ${fold},${fold}`} fill={palette.fold} />
            </Svg>

            <Text
                testID={testID ? `${testID}-tab-text` : undefined}
                numberOfLines={1}
                style={[
                    styles.tabText,
                    {
                        fontSize,
                        // .tabText 继承 .title 的 line-height: 1；垂直居中由容器的
                        // alignItems: 'center' 负责（与 Web 的 inline-flex 一致）
                        lineHeight: fontSize,
                        marginLeft: em(0.4), // .tabText { margin-left: 0.4em }
                        color: palette.text,
                        letterSpacing: em(0.04),
                        textShadowOffset: { width: 0, height: em(0.05) },
                        textShadowRadius: em(0.1),
                    },
                ]}
            >
                {children}
            </Text>
        </View>
    );
};

const VARIANT_MAP: Record<TitleVariant, React.FC<BodyProps>> = {
    ribbon: Ribbon,
    layer: Layer,
    tab: Tab,
};

/**
 * 标题。三个变体（飘带 / 双层纸 / 折角便签）都靠 em 尺寸体系缩放，
 * 配色由 `PALETTE` 提供（Web 里是 CSS 变量 `--rf/--rb/--rk/--rt`）。
 *
 * 与 Web 的差异：
 *   1. `className` → `style` + `testID`（无类系统）。
 *   2. `.title { font-family / font-weight / line-height }` 是**可继承的文本样式**，
 *      RN 的 `<View>` 承载不了、也不会继承，所以全部下沉到各变体的 `<Text>` 上。
 *      其中 `font-weight: 800` 被三个变体的 900 覆盖，`line-height: 1` 等价于
 *      各 `<Text>` 的 `lineHeight`（ribbon / layer 因垂直居中的需要做了等价换算，见各自注释）。
 *   3. `font-family: @font-family` 是 Nunito + Noto Sans SC 字体栈，RN 不支持字体栈、
 *      woff2 也不可用（见 `tokens.ts` 的 `fontFamily`），与其它已移植组件一样**不设置**。
 *   4. `:hover` 的 `transform: scale(1.06)`（.layer / .tab）丢弃 —— 触摸设备没有 hover。
 *   5. 根节点是 `<View>` 而不是 `<span>`：`display: inline-block` 用
 *      `alignSelf: 'flex-start'` 复刻（收缩到内容宽度），`user-select: none` 用 RN 的
 *      `userSelect: 'none'` 样式。
 */
export const Title: React.FC<TitleProps> = ({
    children,
    size = 'middle',
    color = 'default',
    variant = 'ribbon',
    style,
    testID,
}) => {
    const fontSize = SIZE_MAP[size];
    const palette = PALETTE[color];
    const Body = VARIANT_MAP[variant];

    return (
        <View style={[styles.title, style]} testID={testID}>
            <Body fontSize={fontSize} palette={palette} testID={testID}>
                {children}
            </Body>
        </View>
    );
};

Title.displayName = 'Title';

const styles = StyleSheet.create({
    // .title { display: inline-block; user-select: none }
    title: {
        alignSelf: 'flex-start', // display: inline-block（按内容宽度收缩，不撑满父容器）
        userSelect: 'none',
    },
    absolute: {
        position: 'absolute',
    },
    // .ribbon { display: inline-flex; align-items: center; justify-content: center }
    ribbon: {
        position: 'relative',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    // .ribbonBack { position: absolute; bottom: -0.4em; width/height: 1.7em; z-index: 1 }
    ribbonTail: {
        position: 'absolute',
        zIndex: 1,
    },
    // .ribbonFold { position: absolute; top: calc(100% - 0.05em); z-index: 2 }
    ribbonFold: {
        position: 'absolute',
        zIndex: 2,
    },
    // .ribbonFront { position: absolute; inset: 0 0.1em; z-index: 3 }
    ribbonFront: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        zIndex: 3,
    },
    // .ribbonText { font-weight: 900; text-shadow: 0 0.04em 0.08em rgba(0,0,0,.05); z-index: 4 }
    ribbonText: {
        fontWeight: '900',
        textShadowColor: 'rgba(0, 0, 0, 0.05)',
        zIndex: 4,
    },
    // .layer { display: inline-flex; align-items: center; height: 2.1em }
    layer: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    // .layer::before { position: absolute; bottom: 0; z-index: 0 }
    layerBack: {
        position: 'absolute',
        bottom: 0,
        zIndex: 0,
    },
    // .layerFront { font-weight: 900; text-align: center; text-shadow: …; z-index: 1 }
    layerFront: {
        fontWeight: '900',
        textAlign: 'center',
        textShadowColor: 'rgba(0, 0, 0, 0.12)',
        zIndex: 1,
    },
    // .tab { display: inline-flex; align-items: center; justify-content: center; height: 2em }
    tab: {
        position: 'relative',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    // 切角三角形铺在左上角（尺寸 = 切角落点，见 Tab 的注释）
    tabCorner: {
        position: 'absolute',
        left: 0,
        top: 0,
    },
    // 右上块：right/top 贴边，left/height 由切角落点决定
    tabTopBlock: {
        position: 'absolute',
        right: 0,
        top: 0,
    },
    // 下半块：left/right/bottom 贴边，top 由切角落点决定
    tabBottomBlock: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
    },
    // .tab::after { position: absolute; right: 0; bottom: 0 }
    tabFold: {
        position: 'absolute',
        right: 0,
        bottom: 0,
    },
    // .tabText { font-weight: 900; text-shadow: …; z-index: 2 }
    tabText: {
        fontWeight: '900',
        textShadowColor: 'rgba(0, 0, 0, 0.12)',
        zIndex: 2,
    },
});
