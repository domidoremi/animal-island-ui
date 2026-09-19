// ============================================
// Notification 单条视图（RN 版）
// 4 种 type 走同一套结构，靠 type 决定卡片底色 / 描边色 / 图标底色
// 进场 / 退场方向由 placement (top/bottom) 决定
// 退场流程: leaving 状态 -> 250ms 动画结束 -> 通知父级从 store 移除
// ============================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import type { NotificationItem, NotificationType } from './types';

const ENTER_MS = 250;
const LEAVE_MS = 250;
const SLIDE_DISTANCE = 16;

/** 每张卡片的配色：`.type-*` 的 background / border-color，以及 `.type-* .iconWrap` 的底色与图标色 */
const TYPE_PALETTE: Record<
    NotificationType,
    { bg: string; border: string; iconBg: string; icon: string; shadow: string }
> = {
    success: {
        bg: '#f5fae9',
        border: '#6fba2c',
        iconBg: '#d8efc1',
        icon: '#5a9e1e',
        shadow: '0 6px 18px rgba(111, 186, 44, 0.18)',
    },
    info: {
        bg: '#ecf9f6',
        border: '#19c8b9',
        iconBg: '#c2ece6',
        icon: '#11a89b',
        shadow: '0 6px 18px rgba(25, 200, 185, 0.18)',
    },
    warning: {
        bg: '#fdf6d9',
        border: '#f5c31c',
        iconBg: '#fbeaa1',
        icon: '#b88a06',
        shadow: '0 6px 18px rgba(245, 195, 28, 0.2)',
    },
    error: {
        bg: '#fde8e8',
        border: '#e05a5a',
        iconBg: '#f7c8c8',
        icon: '#c94444',
        shadow: '0 6px 18px rgba(224, 90, 90, 0.18)',
    },
};

/** 默认 4 类型图标。上游用 `currentColor` 继承 `.iconWrap` 的颜色，RN 只能写死 */
const DefaultIcon: React.FC<{ type: NotificationType; color: string }> = ({ type, color }) => {
    if (type === 'success') {
        return (
            <Svg viewBox="0 0 24 24" width={18} height={18}>
                <Path
                    d="M5 12.5l4.5 4.5L19 7.5"
                    fill="none"
                    stroke={color}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </Svg>
        );
    }
    if (type === 'info') {
        return (
            <Svg viewBox="0 0 24 24" width={18} height={18}>
                <Circle cx={12} cy={7} r={1.6} fill={color} />
                <Path d="M12 11v7" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
            </Svg>
        );
    }
    if (type === 'warning') {
        return (
            <Svg viewBox="0 0 24 24" width={18} height={18}>
                <Path d="M12 4l9.5 16.5h-19z" fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
                <Path d="M12 10v4M12 16.5v.01" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
            </Svg>
        );
    }
    return (
        <Svg viewBox="0 0 24 24" width={18} height={18}>
            <Path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
        </Svg>
    );
};

export interface NotificationViewProps {
    item: NotificationItem;
    onRemove: (key: string) => void;
    /** 测试标识前缀（RN 里 `className` 的对应物） */
    testID?: string;
}

export const NotificationView: React.FC<NotificationViewProps> = ({ item, onRemove, testID }) => {
    const [leaving, setLeaving] = useState(false);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const removeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const triggerClose = useCallback(() => {
        if (leaving) return;
        setLeaving(true);
    }, [leaving]);

    // 倒计时结束 -> 进入退场态
    useEffect(() => {
        if (!item.duration || item.duration <= 0) return undefined;
        closeTimerRef.current = setTimeout(() => {
            triggerClose();
        }, item.duration * 1000);
        return () => {
            if (closeTimerRef.current !== undefined) {
                clearTimeout(closeTimerRef.current);
                closeTimerRef.current = undefined;
            }
        };
    }, [item.duration, triggerClose]);

    // 退场动画结束后从 store 移除 + 触发 onClose
    useEffect(() => {
        if (!leaving) return undefined;
        removeTimerRef.current = setTimeout(() => {
            onRemove(item.key);
            item.onClose?.();
        }, LEAVE_MS);
        return () => {
            if (removeTimerRef.current !== undefined) {
                clearTimeout(removeTimerRef.current);
                removeTimerRef.current = undefined;
            }
        };
        // 故意不依赖整个 item：leave 定时器只需在 leaving/key/onClose 变化时重置，
        // 避免父级任意更新都重启动画。
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leaving, item.key, item.onClose, onRemove]);

    /**
     * 进场 / 退场：上游是 4 条 `@keyframes`（top/bottom × enter/leave），
     * RN 用**一个** `progress` 双向跑：0 = 不可见且带位移，1 = 就位且完全不透明。
     * 挂载时 0 → 1（进场），`leaving` 时 1 → 0（退场，正好是进场的反向）。
     */
    const progress = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.timing(progress, {
            toValue: leaving ? 0 : 1,
            duration: leaving ? LEAVE_MS : ENTER_MS,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
            useNativeDriver: true,
        }).start();
    }, [leaving, progress]);

    // `placement=top` 从 -16px 滑入；`placement=bottom` 从 +16px 滑入
    const distance = item.placement === 'top' ? -SLIDE_DISTANCE : SLIDE_DISTANCE;
    const opacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
    const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] });

    const palette = TYPE_PALETTE[item.type];
    const iconNode = item.icon ?? <DefaultIcon type={item.type} color={palette.icon} />;
    const interactive = !!item.onClick;

    const card: ViewStyle = {
        backgroundColor: palette.bg,
        borderColor: palette.border,
        boxShadow: palette.shadow,
    };

    // ⚠️ `Animated.View` 的类型不接受 `onPress`（它不是 `Pressable`），所以可点击态
    //    用 responder 回调实现：`onStartShouldSetResponder` 抢下触摸，
    //    `onResponderRelease` 触发 `onClick`。语义与上游 `onClick` 一致，
    //    只是触发方式换成了 RN 的 responder 系统（测试里 `fireEvent.press` 不生效，
    //    要发 `responderRelease`）。
    return (
        <Animated.View
            accessible={interactive || undefined}
            role={interactive ? 'button' : undefined}
            onStartShouldSetResponder={interactive ? () => true : undefined}
            onResponderRelease={interactive ? () => item.onClick?.() : undefined}
            pointerEvents="auto"
            style={[styles.notification, card, item.style, { opacity, transform: [{ translateY }] }]}
            testID={testID}
        >
            <View style={[styles.iconWrap, { backgroundColor: palette.iconBg }]} aria-hidden>
                {iconNode}
            </View>
            <View style={styles.body}>
                {typeof item.message === 'string' || typeof item.message === 'number' ? (
                    <Text style={styles.title}>{item.message}</Text>
                ) : (
                    item.message
                )}
                {item.description !== undefined &&
                    item.description !== null &&
                    (typeof item.description === 'string' || typeof item.description === 'number' ? (
                        <Text style={styles.description}>{item.description}</Text>
                    ) : (
                        item.description
                    ))}
            </View>
            {item.btn && <View style={styles.btnSlot}>{item.btn}</View>}
            <Pressable
                accessibilityRole="button"
                aria-label="close"
                onPress={triggerClose}
                style={styles.close}
                testID={testID ? `${testID}-close` : undefined}
            >
                {item.closeIcon ?? <Text style={styles.closeText}>×</Text>}
            </Pressable>
        </Animated.View>
    );
};

NotificationView.displayName = 'NotificationView';

export const NOTIFICATION_ENTER_MS = ENTER_MS;
export const NOTIFICATION_LEAVE_MS = LEAVE_MS;

const styles = StyleSheet.create({
    // `.notification { display:flex; align-items:center; gap:12px; width:384px; padding:14px 16px;
    //                 border:2px solid; border-radius:18px }`
    // ⚠️ `max-width: calc(100vw - 48px)` —— RN 不支持 `calc()`，退化为 `maxWidth: '100%'`。
    notification: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        width: 384,
        maxWidth: '100%',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderWidth: 2,
        borderRadius: 18,
    },
    // `.iconWrap { width:32px; height:32px; border-radius:50%; align-items:center; justify-content:center }`
    iconWrap: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // `.body { flex:1 1 auto; min-width:0; display:flex; flex-direction:column; gap:4px }`
    body: {
        flex: 1,
        minWidth: 0,
        gap: 4,
    },
    // `.title { font-size:15px; font-weight:700; line-height:1.4; color:#794f27 }`
    title: {
        fontSize: 15,
        fontWeight: '700',
        lineHeight: 21,
        color: '#794f27',
    },
    // `.description { font-size:13px; font-weight:500; line-height:1.55; color:#8a7b66 }`
    description: {
        fontSize: 13,
        fontWeight: '500',
        lineHeight: 20,
        color: '#8a7b66',
    },
    // `.btnSlot { flex:0 0 auto; margin-left:4px }`
    btnSlot: {
        marginLeft: 4,
    },
    // `.close { width:22px; height:22px; margin-left:4px; border-radius:50% }`
    close: {
        width: 22,
        height: 22,
        marginLeft: 4,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 11,
    },
    closeText: {
        fontSize: 18,
        lineHeight: 18,
        color: 'rgba(114, 93, 66, 0.55)',
    },
});
