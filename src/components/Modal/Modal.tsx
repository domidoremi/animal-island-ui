import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    KeyboardAvoidingView,
    Platform,
    Modal as RNModal,
    Pressable,
    StyleSheet,
    Text,
    View,
    ScrollView,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../Button';
import { Cursor } from '../Cursor';
import { Typewriter } from '../Typewriter';

/** game 变体的有机外框（上游 `ClipDef` 内联 SVG 的 `clipPath`，同一条路径） */
const GAME_CLIP_PATH =
    'M0.501,0.005 L0.501,0.005 L0.523,0.005 L0.549,0.006 C0.704,0.01,0.796,0.017,0.825,0.027 L0.827,0.028 C0.872,0.045,0.939,0.044,0.978,0.17 C1,0.254,1,0.365,0.99,0.505 L0.988,0.513 C0.979,0.558,0.971,0.598,0.965,0.633 C0.956,0.689,0.979,0.77,0.964,0.865 C0.953,0.928,0.921,0.966,0.869,0.979 C0.821,0.986,0.773,0.992,0.726,0.995 L0.712,0.996 L0.694,0.997 C0.648,1,0.586,1,0.507,1 L0.501,1 L0.464,1 C0.385,1,0.325,0.998,0.283,0.995 C0.234,0.992,0.184,0.987,0.133,0.979 C0.081,0.966,0.05,0.928,0.039,0.865 C0.023,0.77,0.047,0.689,0.037,0.633 C0.031,0.595,0.023,0.552,0.013,0.505 C-0.006,0.365,-0.002,0.254,0.024,0.17 C0.064,0.045,0.13,0.045,0.174,0.028 L0.175,0.028 C0.204,0.017,0.303,0.009,0.474,0.005 L0.501,0.005';

/** `.mask { animation: animal-fade-in 0.25s ease }` */
const FADE_MS = 250;
/** `.modal { animation: animal-zoom-in 0.3s ease }` */
const ZOOM_MS = 300;

export type ModalVariant = 'default' | 'game';

export interface ModalProps {
    /** 是否可见 */
    open: boolean;
    /** 弹窗类型: default 常规圆角矩形, game 异形自然外框。默认 default */
    variant?: ModalVariant;
    /** 标题 */
    title?: React.ReactNode;
    /** 宽度，默认 520 */
    width?: number | string;
    /** 点击遮罩关闭 */
    maskClosable?: boolean;
    /** 底部按钮区域；`undefined` 用默认按钮，`null` 不渲染 */
    footer?: React.ReactNode | null;
    /** 关闭回调 */
    onClose?: () => void;
    /** 确认回调 */
    onOk?: () => void;
    /** 自定义内容 */
    children?: React.ReactNode;
    /** 弹窗自定义样式（取代 Web 的 `className`） */
    style?: StyleProp<ViewStyle>;
    /** 打字机每字间隔 (ms), 默认 80 */
    typeSpeed?: number;
    /** 是否启用打字机效果, 默认 true */
    typewriter?: boolean;
    /** 遮罩层自定义样式 */
    maskStyle?: StyleProp<ViewStyle>;
    /** 测试标识，同时作为 `-mask` / `-panel` / `-title` / `-body` / `-footer` 的前缀 */
    testID?: string;
    /** Insets supplied by the host's safe-area authority. */
    contentInsets?: { top: number; right: number; bottom: number; left: number };
    /** Host typography/layout for the scrollable body. */
    contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Modal 弹窗
 *
 * ## 与上游的结构性差异
 *
 * | 上游（Web）                                | RN 版                                                       |
 * | ------------------------------------------ | ----------------------------------------------------------- |
 * | `createPortal(..., document.body)`         | RN `Modal`（`transparent` + `animationType="none"`）         |
 * | `if (!open) return null`                   | `visible={open}`（上游也没有退场动画，所以这里不必延迟卸载） |
 * | `@keyframes animal-fade-in / zoom-in`      | `Animated.timing`（只播入场，与上游一致）                    |
 * | `clip-path: url(#animal-modal-clip)`       | **降级为一张铺满的 SVG 底图**：RN 不能用路径裁切 `View`      |
 * | `aria-describedby={bodyId}`                | **RN 0.87 没有 `aria-describedby`**，丢弃（`bodyId` 一并去掉）|
 * | 焦点送进 / 归还 / Tab 陷阱 / Escape        | 焦点三项无对应物；Escape → `Modal.onRequestClose`            |
 * | `document.body.style.overflow` 锁滚动      | 无对应物                                                     |
 * | `tabIndex={-1}`                            | 无对应物                                                     |
 * | `max-width: calc(100vw - 32px)`            | RN 不支持 `calc()`，退化为 `maxWidth: '100%'`                |
 *
 * 遮罩点击关闭用 `Pressable`；弹窗自身 `onStartShouldSetResponder={() => true}`
 * 抢下 responder，于是弹窗内的点击不会冒泡到遮罩 —— 对应上游的
 * `onClick={e => e.stopPropagation()}`。
 */
export const Modal: React.FC<ModalProps> = ({
    open,
    variant = 'default',
    title,
    width = 520,
    maskClosable = true,
    footer,
    onClose,
    onOk,
    children,
    style,
    typeSpeed = 80,
    typewriter = true,
    maskStyle,
    testID,
    contentInsets = { top: 24, right: 16, bottom: 24, left: 16 },
    contentStyle,
}) => {
    const { mode, theme, reducedMotion } = useTheme();
    // 每次 open 变为 true 时重启打字机
    const [playKey, setPlayKey] = useState(0);

    const idPrefix = `animal-modal-${useId().replace(/:/g, '')}`;
    const titleId = `${idPrefix}-title`;

    const maskOpacity = useRef(new Animated.Value(0)).current;
    const zoom = useRef(new Animated.Value(0)).current;
    const isGame = variant === 'game';

    useEffect(() => {
        if (!open) return undefined;
        setPlayKey((k) => k + 1);
        maskOpacity.setValue(0);
        zoom.setValue(0);
        Animated.timing(maskOpacity, {
            toValue: 1,
            duration: reducedMotion ? 0 : FADE_MS,
            easing: Easing.ease,
            useNativeDriver: true,
        }).start();
        Animated.timing(zoom, {
            toValue: 1,
            duration: reducedMotion ? 0 : ZOOM_MS,
            easing: Easing.ease,
            useNativeDriver: true,
        }).start();
        return undefined;
    }, [open, maskOpacity, zoom, reducedMotion]);

    const handleMaskPress = useCallback(() => {
        if (maskClosable) onClose?.();
    }, [maskClosable, onClose]);

    const defaultFooter = (
        <>
            <Button type="primary" onPress={onClose}>
                取消
            </Button>
            <Button type="primary" onPress={onOk}>
                确定
            </Button>
        </>
    );

    return (
        <RNModal transparent statusBarTranslucent visible={open} animationType="none" onRequestClose={onClose}>
            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <Cursor style={styles.flex}>
                    <Animated.View
                        style={[
                            styles.mask,
                            {
                                opacity: maskOpacity,
                                backgroundColor: theme.colors.mask,
                                paddingTop: contentInsets.top,
                                paddingRight: contentInsets.right,
                                paddingBottom: contentInsets.bottom,
                                paddingLeft: contentInsets.left,
                            },
                            maskStyle,
                        ]}
                        testID={testID ? `${testID}-mask` : undefined}
                    >
                        <Pressable
                            accessible={false}
                            accessibilityRole="none"
                            style={StyleSheet.absoluteFill}
                            onPress={handleMaskPress}
                            disabled={!maskClosable}
                            testID={testID ? `${testID}-mask-hit` : undefined}
                        />
                        <Animated.View
                            // `accessible` 必需：RNTL 的 `getByRole` 受 `isAccessibilityElement`
                            // 门控，非 Text 宿主只有显式 `accessible` 才会进无障碍树。
                            accessible
                            role="dialog"
                            aria-modal
                            accessibilityViewIsModal
                            aria-labelledby={title ? titleId : undefined}
                            // 上游 `onClick={e => e.stopPropagation()}`
                            onStartShouldSetResponder={() => true}
                            style={[
                                styles.modal,
                                isGame && styles.modalGame,
                                { width },
                                style,
                                {
                                    opacity: zoom,
                                    transform: [
                                        { scale: zoom.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
                                    ],
                                } as never,
                            ]}
                            testID={testID ? `${testID}-panel` : undefined}
                        >
                            {isGame && (
                                // 上游：`<ClipDef />` 的 `clipPath` + `.gameClipped { clip-path: url(...) }`。
                                // RN 不能用路径裁切 `View`，所以改成把同一条路径当作底图画在内容下面 ——
                                // 形状一致，但**内容不会被裁掉**（见文件头的差异表）。
                                <Svg
                                    viewBox="0 0 1 1"
                                    preserveAspectRatio="none"
                                    style={StyleSheet.absoluteFill}
                                    testID={testID ? `${testID}-game-shape` : undefined}
                                >
                                    <Path
                                        d={GAME_CLIP_PATH}
                                        fill={mode === 'dark' ? theme.colors.bg : 'rgb(247, 243, 223)'}
                                    />
                                </Svg>
                            )}
                            <View
                                style={[
                                    styles.modalClipped,
                                    mode === 'dark' && { backgroundColor: theme.colors.bg },
                                    isGame && styles.gameClipped,
                                ]}
                                testID={testID ? `${testID}-clipped` : undefined}
                            >
                                {title && (
                                    <View style={styles.header}>
                                        <Text
                                            nativeID={titleId}
                                            style={[styles.title, mode === 'dark' && { color: theme.colors.text }]}
                                            testID={testID ? `${testID}-title` : undefined}
                                        >
                                            {title}
                                        </Text>
                                    </View>
                                )}
                                <ScrollView
                                    style={styles.scrollBody}
                                    contentContainerStyle={[styles.body, contentStyle]}
                                    keyboardShouldPersistTaps="handled"
                                    testID={testID ? `${testID}-body` : undefined}
                                >
                                    {typewriter && !reducedMotion ? (
                                        <Typewriter speed={typeSpeed} trigger={playKey}>
                                            {children}
                                        </Typewriter>
                                    ) : (
                                        children
                                    )}
                                </ScrollView>
                                {footer !== null && (
                                    <View style={styles.footer} testID={testID ? `${testID}-footer` : undefined}>
                                        {footer === undefined ? defaultFooter : footer}
                                    </View>
                                )}
                            </View>
                        </Animated.View>
                    </Animated.View>
                </Cursor>
            </KeyboardAvoidingView>
        </RNModal>
    );
};

Modal.displayName = 'Modal';

const styles = StyleSheet.create({
    flex: { flex: 1 },
    scrollBody: { flexShrink: 1 },
    // `.mask { position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
    //          background: var(--animal-mask-bg) }`（= `@mask-bg` → `colors.mask`）
    mask: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.mask,
    },
    // `.modal { position: relative; max-width: calc(100vw - 32px); max-height: calc(100vh - 64px) }`
    // ⚠️ `calc()` 在 RN 里没有对应物，退化为百分比（那 32 / 64px 的内缩丢了）
    modal: {
        position: 'relative',
        maxWidth: '100%',
        maxHeight: '100%',
    },
    // `.modalGame { border-radius: 0 }`（外形交给 SVG 底图）
    modalGame: {},
    // `.modalClipped { padding: 40px 35px 25px; background: rgb(247,243,223); border-radius: 22px;
    //                  box-shadow: 0 18px 50px -12px rgba(0,0,0,.25); overflow: hidden }`
    modalClipped: {
        width: '100%',
        maxHeight: '100%',
        paddingTop: 40,
        paddingHorizontal: 35,
        paddingBottom: 25,
        backgroundColor: 'rgb(247, 243, 223)',
        borderRadius: 22,
        boxShadow: '0 18px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
    },
    // `.gameClipped { border-radius: 0; box-shadow: none; padding: 48px 48px 32px }`
    // ⚠️ `clip-path: url(#animal-modal-clip)` 无法还原，见组件注释。
    gameClipped: {
        paddingTop: 48,
        paddingHorizontal: 48,
        paddingBottom: 32,
        backgroundColor: 'transparent',
        borderRadius: 0,
        boxShadow: undefined,
    },
    // `.header { display:flex; align-items:center; justify-content:space-between; padding-bottom:15px }`
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 15,
    },
    // `.title { font-size:28px; font-weight:700; color: rgba(114,93,66,1) }`
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: 'rgba(114, 93, 66, 1)',
    },
    // `.body { padding-bottom:20px; flex:1; font-size:20px; font-weight:600; line-height:1.6; color:#8a7b66 }`
    body: {
        paddingBottom: 20,
        alignItems: 'flex-start',
        fontSize: 20,
        fontWeight: '600',
        lineHeight: 32,
        color: '#8a7b66',
    },
    // `.footer { display:flex; align-items:center; justify-content:flex-end; gap:12px }`
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 12,
    },
});
