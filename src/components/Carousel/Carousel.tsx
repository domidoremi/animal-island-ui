import React, { Children, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
    type LayoutChangeEvent,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    type ScrollViewInstance,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import { boxShadow, colors, fontFamily, fontSize } from '../../theme/tokens';
import { clampIndex, indexFromOffset, normalizeIndex, snapOffset } from './geometry';

export interface CarouselProps {
    /** 轮播内容，每个直接子元素为一张 */
    children: React.ReactNode;
    /** 当前索引，传入时为受控模式 */
    activeIndex?: number;
    /** 非受控模式的初始索引 */
    defaultActiveIndex?: number;
    /** 切换后的回调 */
    onChange?: (index: number) => void;
    /** 是否自动播放 */
    autoplay?: boolean;
    /** 自动播放间隔，单位毫秒 */
    interval?: number;
    /** 是否首尾循环 */
    loop?: boolean;
    /** 是否显示左右箭头 */
    showArrows?: boolean;
    /** 是否显示圆点指示器 */
    showDots?: boolean;
    /**
     * ⚠️ 上游是「鼠标悬停时暂停自动播放；键盘焦点进入时始终暂停」。
     * RN 既没有 hover 也没有 DOM 焦点，这里映射为「**手指按住时暂停**」
     * （`onTouchStart` / `onTouchEnd`）—— 触摸设备上最接近「用户正在看着它」的信号。
     */
    pauseOnHover?: boolean;
    /** 对外暴露的无障碍标签 */
    'aria-label'?: string;
    /** 自定义样式（作用于最外层容器） */
    style?: StyleProp<ViewStyle>;
    /** 测试标识（RN 里 `className` 的对应物） */
    testID?: string;
}

/**
 * 轮播 —— 横向分页滚动。
 *
 * ## 与上游的结构性差异
 *
 * 1. **视口从「绝对定位叠放 + 淡入」换成 `ScrollView` + `pagingEnabled`。**
 *    Web 版 `.slide` 是 `position: absolute; inset: 0`，靠 `opacity` / `transform`
 *    过渡切换，一次只显示一张，用户**不能拖动**，只能点箭头 / 圆点。
 *    RN 版把所有页并排铺在一个横向 `ScrollView` 里，一屏一页，
 *    于是**多了手指滑动**这个能力（触摸端的自然交互），代价是丢了那 0.3s 的淡入位移。
 *    索引算术抽在 `geometry.ts` 里，可单测。
 * 2. **`loop` 只在箭头 / 圆点 / 自动播放上生效**：`ScrollView` 的物理两端是滑不过去的，
 *    滑到最后一页再往左滑不会回到第一页（Web 版本来也没有拖拽，所以这条不算回退）。
 * 3. **键盘导航整条丢弃**：上游 `onKeyDown` 支持 ArrowLeft / ArrowRight / Home / End。
 *    RN 没有 DOM 键盘事件（宿主可用 `Modal`/`TextInput` 自行接硬件键盘，不在本组件职责内）。
 * 4. **`aria-roledescription` 丢弃**：RN 0.87 **没有**这个属性（`ViewAccessibility` 里不存在），
 *    `accessibilityRole` 也没有 `carousel` / `slide` 这两个值，只能整条丢掉。
 *    同理 `aria-current`（圆点的当前页标记）不存在，改用 RN 支持的 `aria-selected`。
 * 5. **`pauseOnHover` 映射为「手指按住暂停」**，见 props 注释。
 * 6. **`...rest` 透传丢弃**：上游把剩余的 HTML 属性（`id` / `data-*` / 事件）摊到 `<section>` 上，
 *    RN 没有 HTML 属性。
 * 7. **`:hover` / `:active` / `transition` / `@media` 丢弃**：`.arrow:hover` 的上浮 2px 与
 *    `.arrow:active` 的「取消上浮」是一对，hover 没了之后 active 也就无从取消；
 *    `@media (max-width: 480px)` 的箭头缩小改用 RN 的 `useWindowDimensions()` 判断；
 *    `prefers-reduced-motion` 在 RN 里应由宿主用 `AccessibilityInfo` 处理，本组件不做。
 */
export const Carousel: React.FC<CarouselProps> = ({
    children,
    activeIndex,
    defaultActiveIndex = 0,
    onChange,
    autoplay = false,
    interval = 3_000,
    loop = true,
    showArrows = true,
    showDots = true,
    pauseOnHover = true,
    'aria-label': ariaLabel = '轮播图',
    style,
    testID,
}) => {
    const slides = useMemo(() => Children.toArray(children), [children]);
    const lastIndex = slides.length - 1;

    const [internalIndex, setInternalIndex] = useState(() => clampIndex(defaultActiveIndex, lastIndex));
    // 上游叫 hoverPaused —— RN 里由「手指按住」驱动（见 props 注释）
    const [hoverPaused, setHoverPaused] = useState(false);
    // 上游还有 focusPaused（DOM 焦点进入时暂停）；RN 没有焦点语义，已丢弃
    const [rotationPaused, setRotationPaused] = useState(false);
    const [measuredWidth, setMeasuredWidth] = useState(0);

    const currentIndex = clampIndex(activeIndex ?? internalIndex, lastIndex);
    const effectivePaused = hoverPaused || rotationPaused;

    const scrollRef = useRef<ScrollViewInstance>(null);

    /**
     * 一页的宽度。
     *
     * 必须先量再用：横向 `ScrollView` 的 contentContainer 宽度是 auto（由子元素撑开），
     * 子元素写 `width: '100%'` 会解析成 auto → 分页失效。
     * 量到之前用 `useWindowDimensions().width` 兜底（`onLayout` 下一帧就到），
     * 避免第一帧所有页挤在一起。窗口宽度只有在「轮播不是满屏宽」时才是错的，
     * 那一帧之后就会被校正。
     */
    const { width: windowWidth } = useWindowDimensions();
    const pageWidth = measuredWidth > 0 ? measuredWidth : windowWidth;

    const goTo = useCallback(
        (nextIndex: number) => {
            if (slides.length === 0) return;
            const normalized = normalizeIndex(nextIndex, slides.length, loop);
            if (normalized === currentIndex) return;
            if (activeIndex === undefined) setInternalIndex(normalized);
            onChange?.(normalized);
        },
        [activeIndex, currentIndex, loop, onChange, slides.length]
    );

    // 自动播放：上游 `window.setInterval`，RN 用全局 setInterval（语义一致）
    useEffect(() => {
        if (!autoplay || effectivePaused || slides.length < 2) return undefined;
        const timer = setInterval(() => goTo(currentIndex + 1), Math.max(interval, 1_000));
        return () => clearInterval(timer);
    }, [autoplay, currentIndex, effectivePaused, goTo, interval, slides.length]);

    // 索引 → 滚动位置。这是唯一一处命令式滚动，测试里只能断言「调了什么参数」
    // （jest preset 把 ScrollView.scrollTo mock 成 jest.fn()，见 geometry.ts 的注释）。
    useEffect(() => {
        if (pageWidth <= 0) return;
        scrollRef.current?.scrollTo({ x: snapOffset(currentIndex, pageWidth), animated: true });
    }, [currentIndex, pageWidth]);

    const handleLayout = useCallback((event: LayoutChangeEvent) => {
        setMeasuredWidth(event.nativeEvent.layout.width);
    }, []);

    // 手指滑动结束后把 ScrollView 的实际落点同步回索引
    const handleMomentumScrollEnd = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            goTo(indexFromOffset(event.nativeEvent.contentOffset.x, pageWidth, slides.length));
        },
        [goTo, pageWidth, slides.length]
    );

    const hasControls = slides.length > 1;

    // 小屏箭头收窄 —— 对应 `@media (max-width: 480px) { .arrow { width/height: 36px } }`
    const compactArrows = windowWidth <= 480;

    return (
        <View
            role="region"
            // ⚠️ 上游还有 `aria-roledescription="carousel"`：RN 0.87 没有这个属性，只能丢
            aria-label={ariaLabel}
            tabIndex={0}
            onTouchStart={() => {
                if (pauseOnHover) setHoverPaused(true);
            }}
            onTouchEnd={() => setHoverPaused(false)}
            style={[styles.carousel, style]}
            testID={testID}
        >
            {hasControls && autoplay && (
                <Pressable
                    accessibilityRole="button"
                    aria-label={effectivePaused ? '继续自动播放' : '暂停自动播放'}
                    onPress={() => {
                        if (effectivePaused) {
                            setHoverPaused(false);
                            setRotationPaused(false);
                        } else {
                            setRotationPaused(true);
                        }
                    }}
                    style={styles.rotationControl}
                    testID={testID ? `${testID}-rotation` : undefined}
                >
                    <Text style={styles.rotationControlText}>{effectivePaused ? '播放' : '暂停'}</Text>
                </Pressable>
            )}

            <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onLayout={handleLayout}
                onMomentumScrollEnd={handleMomentumScrollEnd}
                style={styles.viewport}
                testID={testID ? `${testID}-viewport` : undefined}
            >
                {slides.map((slide, index) => {
                    const active = index === currentIndex;
                    return (
                        <View
                            key={index}
                            role="group"
                            // ⚠️ 上游的 `aria-roledescription="slide"` 在 RN 里不存在，已丢
                            aria-label={`第 ${index + 1} 张，共 ${slides.length} 张`}
                            aria-hidden={!active}
                            style={[styles.slide, { width: pageWidth }]}
                            testID={testID ? `${testID}-slide-${index}` : undefined}
                        >
                            {slide}
                        </View>
                    );
                })}
            </ScrollView>

            {hasControls && showArrows && (
                <>
                    <Pressable
                        accessibilityRole="button"
                        aria-label="上一张"
                        aria-disabled={!loop && currentIndex === 0}
                        disabled={!loop && currentIndex === 0}
                        onPress={() => goTo(currentIndex - 1)}
                        style={[
                            styles.arrow,
                            compactArrows && styles.arrowCompact,
                            styles.previous,
                            compactArrows && styles.previousCompact,
                            !loop && currentIndex === 0 && styles.arrowDisabled,
                        ]}
                        testID={testID ? `${testID}-previous` : undefined}
                    >
                        {/* 上游用 `.arrow::before` 的「两条边框 + 旋转」画箭头，RN 没有伪元素，
                            于是直接是一个旋转 45° 的方块；CSS 里 `translate(-35%, -50%)`
                            的居中偏移由父容器的 alignItems/justifyContent 代替。 */}
                        <View style={[styles.chevron, styles.chevronPrevious]} />
                    </Pressable>
                    <Pressable
                        accessibilityRole="button"
                        aria-label="下一张"
                        aria-disabled={!loop && currentIndex === lastIndex}
                        disabled={!loop && currentIndex === lastIndex}
                        onPress={() => goTo(currentIndex + 1)}
                        style={[
                            styles.arrow,
                            compactArrows && styles.arrowCompact,
                            styles.next,
                            compactArrows && styles.nextCompact,
                            !loop && currentIndex === lastIndex && styles.arrowDisabled,
                        ]}
                        testID={testID ? `${testID}-next` : undefined}
                    >
                        <View style={[styles.chevron, styles.chevronNext]} />
                    </Pressable>
                </>
            )}

            {hasControls && showDots && (
                <View
                    role="group"
                    aria-label="选择轮播页"
                    style={styles.dots}
                    testID={testID ? `${testID}-dots` : undefined}
                >
                    {slides.map((_, index) => {
                        const active = index === currentIndex;
                        return (
                            <Pressable
                                key={index}
                                accessibilityRole="button"
                                aria-label={`转到第 ${index + 1} 张`}
                                // ⚠️ 上游是 `aria-current={active ? 'true' : undefined}`；
                                // RN 没有 `aria-current`，改用等价的选中语义
                                aria-selected={active}
                                onPress={() => goTo(index)}
                                style={styles.dot}
                                testID={testID ? `${testID}-dot-${index}` : undefined}
                            >
                                <View style={[styles.dotMark, active && styles.dotMarkActive]} />
                            </Pressable>
                        );
                    })}
                </View>
            )}
        </View>
    );
};

Carousel.displayName = 'Carousel';

const styles = StyleSheet.create({
    // `.carousel { position: relative; width: 100%; min-width: 0; border-radius: 20px; outline: none }`
    // 丢弃：`position: relative`（RN 的 View 默认即相对定位）、
    //       `outline: none` + `:focus-visible`（RN 没有 CSS 焦点环）、
    //       `font-family`（字体栈，RN 用不了 —— 已挪到下面的 Text 上，用 token 的 `undefined`）。
    carousel: {
        position: 'relative',
        width: '100%',
        minWidth: 0,
        borderRadius: 20,
    },
    // `.viewport { position: relative; overflow: hidden; min-height: 180px;
    //             background: rgb(247, 243, 223); border-radius: 20px }`
    viewport: {
        minHeight: 180,
        backgroundColor: 'rgb(247, 243, 223)',
        borderRadius: 20,
        overflow: 'hidden',
    },
    // `.slide { min-height: 180px }`（宽由行内样式给，见 pageWidth 的注释）
    slide: {
        minHeight: 180,
    },
    // `.arrow`：42×42 圆钮，半透明白底 + 1.5px 淡棕描边 + shadow-sm
    // 丢弃：`transform: translateY(-50%)` 改成 RN 的 `top: '50%'` + 百分比 translate（见下）、
    //       `cursor`、`:hover`（上浮 2px）、`:active`、`:focus-visible`、`transition`。
    arrow: {
        position: 'absolute',
        top: '50%',
        width: 42,
        height: 42,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(121, 79, 39, 0.16)',
        borderRadius: 21,
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        boxShadow: boxShadow.sm,
        transform: [{ translateY: '-50%' }],
    },
    arrowCompact: {
        width: 36,
        height: 36,
        borderRadius: 18,
    },
    arrowDisabled: {
        opacity: 0.4,
    },
    previous: {
        left: 14,
    },
    previousCompact: {
        left: 8,
    },
    next: {
        right: 14,
    },
    nextCompact: {
        right: 8,
    },
    // `.arrow::before`：9×9 的方块只留上/左边框，旋转成箭头；颜色取 `currentColor` = `#794f27`
    chevron: {
        width: 9,
        height: 9,
        borderTopWidth: 3,
        borderLeftWidth: 3,
        borderColor: colors.text,
    },
    chevronPrevious: {
        transform: [{ rotate: '-45deg' }],
    },
    chevronNext: {
        transform: [{ rotate: '135deg' }],
    },
    // `.dots`：底部居中的白色胶囊
    // 丢弃：`left: 50%` + `translateX(-50%)` 的居中改成 `alignSelf: 'center'`
    //       （绝对定位子节点在左右 insets 都为 auto 时按父容器对齐，RN 的惯用写法）。
    dots: {
        position: 'absolute',
        bottom: 14,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        paddingVertical: 7,
        paddingHorizontal: 10,
        borderRadius: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
    },
    // `.dot`：30×30 的点击热区，本身透明
    dot: {
        width: 30,
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 50,
    },
    // `.dot::before`：10×10 圆点
    dotMark: {
        width: 10,
        height: 10,
        borderRadius: 50,
        backgroundColor: '#d4c9b4',
    },
    // `.dot-active::before { width: 24px; background: @primary-color }`
    dotMarkActive: {
        width: 24,
        backgroundColor: colors.primary,
    },
    // `.rotation-control`：右上角的播放/暂停胶囊
    rotationControl: {
        position: 'absolute',
        top: 14,
        right: 14,
        zIndex: 3,
        minWidth: 58,
        height: 32,
        paddingHorizontal: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(121, 79, 39, 0.16)',
        borderRadius: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
    },
    rotationControlText: {
        color: colors.text,
        fontSize: fontSize.sm,
        fontWeight: '700',
        lineHeight: fontSize.sm,
        // 上游 `.rotation-control { font-family: inherit }`，继承 `.carousel` 的
        // `var(--animal-font-family, ...)` —— 字体栈，RN 用不了；token 里默认就是 undefined
        fontFamily,
    },
});
