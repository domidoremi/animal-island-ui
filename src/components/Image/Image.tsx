import React, { useCallback, useEffect, useState } from 'react';
import {
    Image as RNImage,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
    type DimensionValue,
    type ImageProps as RNImageProps,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import { ImageIcon } from '../../icons';

export type ImageColor =
    | 'white'
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

export interface ImageProps {
    /** 图片地址（必填） */
    src: string;
    /** 图片替代文本（无障碍）；留空表示装饰性图片 */
    alt?: string;
    /**
     * 图片宽度。
     *
     * ⚠️ 与上游的类型差异（同 `Skeleton`）：上游声明 `number | string`，RN 的尺寸只接受
     * `DimensionValue`（`number | 'auto' | '${number}%' | null`），裸 string 无法赋值，
     * 所以收窄。上游实际用到的数字与 `'100%'` 都能通过。
     *
     * ⚠️ 与上游的行为差异：Web 的 `<img>` 不给宽高时会用**图片自身的像素尺寸**，
     * RN 的 `Image` 不会 —— 不传 `width` / `height` 时外框没有固有尺寸，会渲染成 0×0。
     * 远程图片无法同步拿到固有尺寸（`Image.getSize` 是异步的，本组件不引入这条状态），
     * 所以**请显式传宽高**。
     */
    width?: DimensionValue;
    /** 图片高度，见 `width` 的说明 */
    height?: DimensionValue;
    /** 背景颜色（Card pattern 同款底色，无花纹；'white' 为纯白，默认 white；仅 variant='bordered' 时生效） */
    color?: ImageColor;
    /** 相框类型：'default' 卡片大阴影+大圆角（默认），'bordered' 边框柔和阴影+小圆角，'stamp' 邮票齿孔边框 */
    variant?: 'default' | 'bordered' | 'stamp';
    /** 邮票类型（variant='stamp'）下的发行年份，如「2026」，印在右上角照片上；留空不显示 */
    stampYear?: string;
    /**
     * 是否启用懒加载。
     *
     * ⚠️ **RN 侧为空操作**：上游映射到 `<img loading="lazy">`，RN 的 `Image` 没有对应能力
     * （图片在挂载时即由原生图片加载器取用，不感知是否进入视口）。保留该 prop 只为 API 一致；
     * 需要真正的懒加载，宿主应自行用 `onLayout` / 滚动位置控制是否渲染本组件。
     */
    lazy?: boolean;
    /** 点击图片弹出大图预览 */
    preview?: boolean;
    /** 图片加载完成回调 */
    onLoad?: NonNullable<RNImageProps['onLoad']>;
    /** 图片加载失败回调 */
    onError?: NonNullable<RNImageProps['onError']>;
    /** 自定义样式（作用于相框 / 错误占位本身） */
    style?: StyleProp<ViewStyle>;
    /** 测试标识（RN 里 `className` 的对应物） */
    testID?: string;
}

/**
 * Image —— 相框 + 错误占位 + 点击大图预览。
 *
 * ## 移植时替换掉的两样东西
 *
 * 1. **`createPortal`（react-dom）→ 透明 `Modal`。**
 *    上游把大图预览经 Portal 挂到 `document.body`，遮罩是 `position: fixed; inset: 0; z-index: 1000`，
 *    为的是**跳出祖先的层叠与裁剪**。RN 里用绝对定位的 View 达不到这个效果
 *    —— 它会被任何 `overflow: hidden` 的祖先裁掉，`zIndex` 也只能排序兄弟节点
 *    （这正是 `RN-PORT.md` 里 TimePicker 那条结构性差异）。所以改用透明 `Modal`：
 *    它渲染在整棵 React 树之上、天然覆盖全屏，并且提供 `onRequestClose`
 *    接住 Android 实体返回键 —— 恰好是上游 Escape 关预览的等价物。
 * 2. **`naive-icons` 的 `ImageIcon` → `src/icons/ImageIcon.tsx`。**
 *    上游的 `naive-icons` 是 DOM-only 的 SVG 库；本仓库早先移植 Button 时已用
 *    `react-native-svg` 复刻了同一套图标（含 `ImageIcon`），直接复用，没有新增依赖。
 *
 * ## 其它行为差异
 *
 * - **键盘 / 焦点管理整条丢弃**：上游打开预览时会 `focus()` 关闭按钮、监听 Escape、
 *   用 Tab 把焦点圈在遮罩内、关闭后把焦点还给触发元素。RN 没有 DOM 焦点与键盘事件，
 *   等价物是 `Modal.onRequestClose`（已接）。
 * - **`variant='stamp'` 的齿孔不可移植**：上游用 `mask-image` + `mask-composite: intersect`
 *   在四条边上挖半圆孔，再用 `filter: drop-shadow()` 补阴影、用 `::after` 叠半色调网点。
 *    RN **没有 CSS mask、没有 filter、没有伪元素**，这三样整条丢弃；
 *    保留的是邮票的可移植部分：暖白底纸（`#fbfaf5`）、14px 内缩留白、直角、无阴影。
 * - **`...rest` 透传丢弃**：上游把剩余的 `<img>` HTML 属性摊下去，RN 没有 HTML 属性。
 * - **相框上的 `:hover` / `transition` / `cursor: zoom-in` 丢弃**：触摸设备没有 hover。
 * - **图片尺寸**：见 `width` 的注释。
 * - **`resizeMode="stretch"`**：上游 `.img` 没有声明 `object-fit`，即 CSS 默认的 `fill`（拉伸铺满），
 *    RN 的默认值却是 `cover`（裁剪），所以显式写 `stretch` 才对得上。
 * - **`.loaded .img { opacity: 1 }` 的 0.25s 过渡**：RN 没有 transition，改为直接切换
 *    （加载完成时图片从 `opacity: 0` 跳到 1）。
 */

/**
 * 调色板 —— 上游 `.image-*` 类逐条照搬。
 * 这些颜色写在 **Less** 里（`image.module.less` 的「Color variants」段），且没有对应的
 * `theme/tokens.ts` 条目（token 层是 Card pattern 的那一套），所以**照搬硬编码值**。
 * `white` 不在表里：它用的是 `.image` 基类的 `background: #fff`，没有额外类。
 */
const COLOR_SPEC: Record<Exclude<ImageColor, 'white'>, { backgroundColor: string; color: string }> = {
    default: { backgroundColor: 'rgb(247, 243, 223)', color: '#725d42' },
    'app-pink': { backgroundColor: '#fde4e8', color: '#a85565' },
    purple: { backgroundColor: '#f0e8ff', color: '#6a3a9a' },
    'app-blue': { backgroundColor: '#e8edff', color: '#4a5a8a' },
    'app-yellow': { backgroundColor: '#fff8e0', color: '#7a6528' },
    'app-orange': { backgroundColor: '#fff0e8', color: '#8a4a2a' },
    'app-teal': { backgroundColor: '#e8faf5', color: '#2a6b5a' },
    'app-green': { backgroundColor: '#e8f5e8', color: '#3a6b3a' },
    'app-red': { backgroundColor: '#ffe8e8', color: '#9a3a3a' },
    'lime-green': { backgroundColor: '#f5f8e0', color: '#5a6b28' },
    'yellow-green': { backgroundColor: '#fffde8', color: '#6a5a28' },
    brown: { backgroundColor: '#f5f0e0', color: '#5a4a2a' },
    'warm-peach-pink': { backgroundColor: '#fff0e8', color: '#8a4a2a' },
};

/** `.previewImg { max-width: min(88vw, 1100px); max-height: 86vh }` */
const PREVIEW_MAX_WIDTH_RATIO = 0.88;
const PREVIEW_MAX_WIDTH_CAP = 1100;
const PREVIEW_MAX_HEIGHT_RATIO = 0.86;

export const Image: React.FC<ImageProps> = ({
    src,
    alt = '',
    width,
    height,
    color = 'white',
    variant = 'default',
    preview = true,
    stampYear,
    style,
    onLoad,
    onError,
    testID,
}) => {
    // failed：主图加载失败时显示错误占位
    const [failed, setFailed] = useState(false);
    const [loaded, setLoaded] = useState(false);
    // 大图预览开关
    const [previewOpen, setPreviewOpen] = useState(false);

    // src 变化时重置加载状态
    useEffect(() => {
        setFailed(false);
        setLoaded(false);
    }, [src]);

    const handleLoad = useCallback<NonNullable<RNImageProps['onLoad']>>(
        (event) => {
            setLoaded(true);
            onLoad?.(event);
        },
        [onLoad]
    );

    const handleError = useCallback<NonNullable<RNImageProps['onError']>>(
        (event) => {
            // 加载失败 → 错误占位
            setFailed(true);
            setLoaded(true);
            onError?.(event);
        },
        [onError]
    );

    const { width: windowWidth, height: windowHeight } = useWindowDimensions();

    const palette = color === 'white' ? null : COLOR_SPEC[color];

    if (failed) {
        return (
            /*
             * 上游的类顺序是 `[.image, .image-{color}, .error]`，但 CSS 的优先级看的是
             * **样式表顺序**：`.error`（L142）在 `.image-{color}`（L157 起）之前，
             * 所以调色板的 `color` 会盖掉 `.error` 的 `#c4b89e`。RN 的数组顺序等价于
             * 样式表顺序，所以调色板放最后。
             */
            <View
                role="img"
                aria-label={alt || '图片加载失败'}
                style={[
                    styles.image,
                    styles.error,
                    palette && { backgroundColor: palette.backgroundColor },
                    { width, height },
                    style,
                ]}
                testID={testID}
            >
                {/* 上游 `<ImageIcon size={32} aria-hidden="true" />`：装饰性图标不进无障碍树 */}
                <View aria-hidden testID={testID ? `${testID}-error-icon` : undefined}>
                    <ImageIcon size={32} />
                </View>
                <Text
                    style={[styles.errorText, palette && { color: palette.color }]}
                    testID={testID ? `${testID}-error-text` : undefined}
                >
                    图片加载失败
                </Text>
            </View>
        );
    }

    const frameStyle: StyleProp<ViewStyle> = [
        styles.image,
        variant === 'default' && styles.variantDefault,
        variant === 'stamp' && styles.variantStamp,
        // 基础投影只属于 bordered（即未覆盖的基类外观）；default / stamp 各自处理
        variant === 'bordered' && styles.shadowBase,
        // ⚠️ 色板**只在 bordered 时**叠加（上游 `variant === 'bordered' && color !== 'white' && ...`）。
        // 注意错误占位那条分支**没有**这个 variant 判断，是上游的不对称，照搬。
        variant === 'bordered' && palette && { backgroundColor: palette.backgroundColor },
        { width, height },
        style,
    ];

    const content = (
        <RNImage
            source={{ uri: src }}
            alt={alt}
            resizeMode="stretch"
            onLoad={handleLoad}
            onError={handleError}
            style={[styles.img, !loaded && styles.imgHidden]}
            testID={testID ? `${testID}-img` : undefined}
        />
    );

    // 邮票文字覆盖层：仅 variant='stamp' 且传入 stampYear 时渲染，印在照片右上角
    const stampExtra =
        variant === 'stamp' && stampYear ? (
            <Text style={styles.stampYear} testID={testID ? `${testID}-stamp-year` : undefined}>
                {stampYear}
            </Text>
        ) : null;

    // 点击预览：相框升格为 Pressable，预览弹层放进 Modal（见文件头第 1 条）
    if (preview) {
        return (
            <>
                <Pressable
                    accessibilityRole="button"
                    onPress={() => setPreviewOpen(true)}
                    style={frameStyle}
                    testID={testID}
                >
                    {content}
                    {stampExtra}
                </Pressable>
                <Modal
                    transparent
                    visible={previewOpen}
                    // 上游 `@keyframes animal-image-fade-in`（遮罩 0.2s 淡入）→ Modal 自带的淡入
                    animationType="fade"
                    // Android 实体返回键 —— 等价于上游的 Escape 关闭
                    onRequestClose={() => setPreviewOpen(false)}
                >
                    {/*
                     * 整屏遮罩：点空白处关闭（上游 `.mask` 的 onClick）。
                     * 没有 scrim 之外的额外装饰，底色就是 `.mask` 的 rgba(0,0,0,0.55)。
                     */}
                    <Pressable
                        accessible={false}
                        accessibilityRole="none"
                        style={styles.mask}
                        onPress={() => setPreviewOpen(false)}
                        testID={testID ? `${testID}-mask` : undefined}
                    >
                        <View
                            role="dialog"
                            aria-modal
                            accessibilityViewIsModal
                            aria-label={alt ? `查看图片：${alt}` : '图片预览'}
                            // 弹层自身要「吃掉」落在它身上的触摸，否则点到图片上会穿透到遮罩、
                            // 把预览关掉。上游靠 `e.stopPropagation()`，RN 靠响应者系统。
                            onStartShouldSetResponder={() => true}
                            style={styles.dialog}
                            testID={testID ? `${testID}-dialog` : undefined}
                        >
                            <Pressable
                                accessibilityRole="button"
                                aria-label="关闭预览"
                                onPress={() => setPreviewOpen(false)}
                                style={styles.closeButton}
                                testID={testID ? `${testID}-close` : undefined}
                            >
                                {/* 上游 `.closeMark` 的两条伪元素横杠 → 两个旋转的 View */}
                                <View style={styles.closeMark} />
                                <View style={[styles.closeMark, styles.closeMarkCross]} />
                            </Pressable>
                            <RNImage
                                source={{ uri: src }}
                                alt={alt}
                                resizeMode="contain"
                                // 上游是 `max-width: min(88vw, 1100px); max-height: 86vh` +
                                // `object-fit: contain`。RN 的 Image 不能按固有尺寸自适应，
                                // 所以直接给「最大可视区域」作为盒子尺寸，位图用 contain 摆进去
                                // —— 视觉等价，差别只在弹层的命中区域是整块最大区域。
                                style={[
                                    styles.previewImage,
                                    {
                                        width: Math.min(windowWidth * PREVIEW_MAX_WIDTH_RATIO, PREVIEW_MAX_WIDTH_CAP),
                                        height: windowHeight * PREVIEW_MAX_HEIGHT_RATIO,
                                    },
                                ]}
                                testID={testID ? `${testID}-preview-image` : undefined}
                            />
                        </View>
                    </Pressable>
                </Modal>
            </>
        );
    }

    return (
        <View style={frameStyle} testID={testID}>
            {content}
            {stampExtra}
        </View>
    );
};

Image.displayName = 'Image';

const styles = StyleSheet.create({
    // `.image`：白色衬板相框。
    // 丢弃的声明：
    //   - `display: inline-flex` → `alignSelf: 'flex-start'`（RN 的 View 在 column 容器里
    //     默认拉伸，想按内容收缩必须显式声明）。
    //   - `position: relative` —— RN 的 View 默认即相对定位。
    //   - `line-height: 0` / `vertical-align: middle` —— RN 没有行内排版。
    //   - `border: none` —— RN 的 View 默认无边框。
    //   - `box-sizing: border-box` —— RN/Yoga 本就是 border-box。
    //   - `transition: transform` —— RN 没有过渡（且这里也没有触发 transform 的 hover）。
    // 投影单独放在 `shadowBase`：`variant='stamp'` 要**没有**投影，而 RN 的样式数组里
    // 写 `boxShadow: undefined` 来「清掉」是不可靠的，所以拆开按变体选择。
    image: {
        position: 'relative',
        alignSelf: 'flex-start',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 8,
        flexShrink: 0,
    },
    // `.image { box-shadow: 0 8px 14px 0 rgba(0, 0, 0, 0.08) }`
    shadowBase: {
        boxShadow: '0 8px 14px 0 rgba(0, 0, 0, 0.08)',
    },
    // `.variant-default`：无边框、无内边距、无背景，卡片大阴影 + 12px 圆角
    variantDefault: {
        padding: 0,
        backgroundColor: 'transparent',
        borderRadius: 12,
        boxShadow:
            '0 13px 27px -5px rgba(50, 50, 93, 0.25), 0 8px 16px -8px rgba(0, 0, 0, 0.3), 0 -6px 16px -6px rgba(0, 0, 0, 0.03)',
    },
    // `.variant-stamp`：只保留可移植的部分 —— 暖白底纸 + 14px 内缩 + 直角 + 无阴影。
    // 齿孔（mask-composite）、`filter: drop-shadow`、`::after` 半色调网点在 RN 里没有等价物，已丢。
    variantStamp: {
        padding: 14,
        backgroundColor: '#fbfaf5',
        borderRadius: 0,
    },
    // `.img { display: block; width: 100%; height: 100%; opacity: 0 }`
    // `.loaded .img { opacity: 1 }` —— 过渡丢弃，直接切换
    img: {
        width: '100%',
        height: '100%',
    },
    imgHidden: {
        opacity: 0,
    },
    // `.stamp-year`：右上角白字 + 暗阴影
    stampYear: {
        position: 'absolute',
        right: 19,
        top: 18,
        zIndex: 2,
        fontSize: 8,
        letterSpacing: 8 * 0.18, // CSS letter-spacing: 0.18em
        color: 'rgba(255, 255, 255, 0.88)',
        // `text-shadow: 0 1px 3px rgba(0,0,0,0.55)` → RN 的 textShadow*
        textShadowColor: 'rgba(0, 0, 0, 0.55)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    // `.error`：column 布局 + 8px 间距 + 13px/1.5 的说明文字。
    // ⚠️ RN 的 View **不继承**文字样式，上游 `.error` 里的
    // `line-height` / `font-size` / `font-weight` / `color` 已挪到 `errorText` 上。
    error: {
        flexDirection: 'column',
        gap: 8,
    },
    errorText: {
        fontSize: 13,
        fontWeight: '500',
        lineHeight: 13 * 1.5, // CSS line-height: 1.5
        color: '#c4b89e',
    },
    // `.mask { position: fixed; inset: 0; z-index: 1000; display: flex;
    //          align-items: center; justify-content: center; background: rgba(0,0,0,0.55) }`
    // `position: fixed` / `z-index` 由 Modal 承担；`flex: 1` 让它铺满 Modal。
    mask: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
    },
    // `.dialog { position: relative; display: inline-flex; line-height: 0 }`
    dialog: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    // `.previewImg`：圆角 + 大投影；尺寸由行内样式给（见组件的注释）
    previewImage: {
        borderRadius: 20,
        boxShadow: '0 12px 40px rgba(43, 33, 24, 0.55)',
    },
    // `.closeBtn`：右上角 40×40 圆钮。
    // 丢弃：`:hover`（背景加深 + scale 1.06）、`:focus-visible`、`transition`、`cursor`。
    closeButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 1,
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.75)',
        borderRadius: 20,
        backgroundColor: 'rgba(216, 220, 226, 0.9)',
    },
    // `.closeMark::before / ::after`：16×2 的白色横杠，旋转 ±45° 组成叉号。
    // 上游用 `left/top: 50%` + `translate(-50%, -50%)` 居中；RN 里两个 View 都是
    // 绝对定位且不设 insets，由父容器的 alignItems/justifyContent 居中，效果相同。
    closeMark: {
        position: 'absolute',
        width: 16,
        height: 2,
        borderRadius: 2,
        backgroundColor: '#fff',
        transform: [{ rotate: '45deg' }],
    },
    closeMarkCross: {
        transform: [{ rotate: '-45deg' }],
    },
});
