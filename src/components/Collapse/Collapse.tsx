import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    Pressable,
    StyleSheet,
    Text,
    View,
    type LayoutChangeEvent,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import { FishIcon } from '../../icons';
import { colors, fontSize, radius, spacing } from '../../theme/tokens';

export interface CollapseProps {
    /** 问题标题 */
    question: React.ReactNode;
    /** 答案内容 */
    answer: React.ReactNode;
    /** 是否默认展开 */
    defaultExpanded?: boolean;
    /** 是否禁用 */
    disabled?: boolean;
    /** 自定义样式（作用于最外层卡片） */
    style?: StyleProp<ViewStyle>;
    /** 测试标识（RN 里 `className` 的对应物） */
    testID?: string;
}

/** 面板展开动画时长 —— Web 是 `grid-template-rows 0.3s` */
const EXPAND_DURATION = 300;
/** 装饰元素动画时长 —— Web 是 `--animal-motion-duration-base`（250ms） */
const DECOR_DURATION = 250;
const EASE = Easing.bezier(0.4, 0, 0.2, 1);

export const Collapse: React.FC<CollapseProps> = ({
    question,
    answer,
    defaultExpanded = false,
    disabled = false,
    style,
    testID,
}) => {
    const [expanded, setExpanded] = useState(defaultExpanded);
    /** 内容自然高度（不含动画中的下内边距），由 onLayout 量得 */
    const [contentHeight, setContentHeight] = useState(0);

    // RN 支持 `nativeID` + `aria-labelledby`，所以 Web 版这套 id 关联可以还原
    // （React 19 的 useId 在 RN 里同样可用；只有 `aria-controls` 在 RN 里没有对应物）。
    const headerId = `animal-collapse-${useId().replace(/:/g, '')}-header`;

    /**
     * 展开进度 0→1。
     *
     * ⚠️ Web 版用的是 CSS Grid 的 `grid-template-rows: 0fr → 1fr` 过渡 —— RN 既没有
     * grid 也没有 `fr` 单位，所以改成 RN 的经典做法：先 `onLayout` 量出内容自然高度，
     * 再用 Animated 驱动容器的 `height`（0 → 内容高度 + 下内边距）。
     *
     * 两个 Value 都用 `useNativeDriver: false`：`height` 与背景色插值都只能在 JS 侧算。
     */
    const expand = useRef(new Animated.Value(defaultExpanded ? 1 : 0)).current;
    const decor = useRef(new Animated.Value(defaultExpanded ? 1 : 0)).current;

    useEffect(() => {
        Animated.timing(expand, {
            toValue: expanded ? 1 : 0,
            duration: EXPAND_DURATION,
            easing: EASE,
            useNativeDriver: false,
        }).start();
        Animated.timing(decor, {
            toValue: expanded ? 1 : 0,
            duration: DECOR_DURATION,
            easing: EASE,
            useNativeDriver: false,
        }).start();
    }, [expanded, expand, decor]);

    const onContentLayout = useCallback((e: LayoutChangeEvent) => {
        setContentHeight(e.nativeEvent.layout.height);
    }, []);

    const toggle = () => {
        if (!disabled) setExpanded((v) => !v);
    };

    // 未量到高度时：展开态先交给自适应高度（避免 defaultExpanded 首帧被压成 0），
    // 折叠态直接给 0。
    const panelHeight =
        contentHeight > 0
            ? expand.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, contentHeight + spacing.xl],
              })
            : expanded
              ? undefined
              : 0;

    const panelPaddingBottom = expand.interpolate({
        inputRange: [0, 1],
        outputRange: [0, spacing.xl],
    });

    const iconRotate = decor.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
    const iconBackground = decor.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.primary, colors.primaryActive],
    });
    const leafRotate = decor.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });

    const isTextual = (node: React.ReactNode): node is string | number =>
        typeof node === 'string' || typeof node === 'number';

    return (
        <View style={[styles.card, disabled && styles.cardDisabled, style]} testID={testID}>
            <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded, disabled }}
                nativeID={headerId}
                disabled={disabled}
                onPress={toggle}
                style={styles.header}
                testID={testID ? `${testID}-header` : undefined}
            >
                {/* `aria-hidden`：装饰性内容，不进无障碍树（Web 版同样是 aria-hidden） */}
                <Animated.View
                    aria-hidden
                    style={[
                        styles.questionIcon,
                        { backgroundColor: iconBackground, transform: [{ rotate: iconRotate }] },
                    ]}
                >
                    <Text style={styles.questionIconText}>{expanded ? '−' : '+'}</Text>
                </Animated.View>

                <View style={styles.questionTextWrap}>
                    {isTextual(question) ? <Text style={styles.questionText}>{question}</Text> : question}
                </View>

                <Animated.View aria-hidden style={[styles.leafDecoration, { transform: [{ rotate: leafRotate }] }]}>
                    <FishIcon size={20} />
                </Animated.View>
            </Pressable>

            {/* 展开区。RN 0.87 支持 ARIA 风格的 `role` 与 `aria-labelledby`，所以
                `role="region"` 与 header 的关联可以还原；只有 `aria-controls` 在 RN
                里没有对应属性（RN 支持的 aria-* 见 ViewAccessibility.d.ts）。 */}
            <Animated.View
                role="region"
                aria-labelledby={headerId}
                style={[styles.answerWrapper, { height: panelHeight }]}
                testID={testID ? `${testID}-panel` : undefined}
            >
                <Animated.View style={[styles.answerContent, { paddingBottom: panelPaddingBottom }]}>
                    <View onLayout={onContentLayout} testID={testID ? `${testID}-content` : undefined}>
                        {isTextual(answer) ? <Text style={styles.answerText}>{answer}</Text> : answer}
                    </View>
                </Animated.View>
            </Animated.View>
        </View>
    );
};

Collapse.displayName = 'Collapse';

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.bg,
        borderRadius: radius.base,
        borderWidth: 2,
        borderColor: colors.border,
        overflow: 'hidden',
        marginBottom: spacing.md,
    },
    cardDisabled: {
        opacity: 0.6,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        width: '100%',
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.xl,
    },
    questionIcon: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        borderRadius: 14,
        flexShrink: 0,
    },
    questionIconText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        lineHeight: 18, // CSS line-height: 1
    },
    questionTextWrap: {
        flex: 1,
    },
    questionText: {
        fontSize: fontSize.lg,
        fontWeight: '600',
        color: colors.text,
        lineHeight: fontSize.lg * 1.4, // CSS line-height: 1.4
    },
    leafDecoration: {
        // 上游此处 opacity 两侧都是 1，实际只有 rotate 有变化
        flexShrink: 0,
    },
    answerWrapper: {
        overflow: 'hidden',
    },
    answerContent: {
        paddingHorizontal: spacing.xl,
    },
    answerText: {
        color: colors.textSecondary,
        fontSize: fontSize.base,
        lineHeight: fontSize.base * 1.7, // CSS line-height: 1.7
    },
});
