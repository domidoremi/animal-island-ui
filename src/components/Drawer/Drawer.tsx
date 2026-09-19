import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import { Cursor } from '../Cursor';

export type DrawerPlacement = 'left' | 'right' | 'top' | 'bottom';

export interface DrawerProps {
    /** 是否可见 */
    open: boolean;
    /** 标题 */
    title?: React.ReactNode;
    /** 弹出位置，默认 'right' */
    placement?: DrawerPlacement;
    /** 宽度（left / right 时生效），默认 378 */
    width?: number;
    /** 高度（top / bottom 时生效），默认 300 */
    height?: number;
    /** 点击遮罩关闭，默认 true */
    maskClosable?: boolean;
    /**
     * 背景下沉景深效果，默认 true。
     *
     * ⚠️ **在 RN 里是空操作（no-op）**：上游的实现是遍历 `document.body.children`，
     * 给非 fixed 的子元素写 `transform: scale(0.94)` / `filter: blur(1px)` /
     * `borderRadius: 14px` / `overflow: hidden`。RN 既没有 `document`，
     * 也无法从组件内部改宿主 App 的其它视图。保留 prop 只为守住上游 API 的形状。
     */
    pushBackground?: boolean;
    /** 底部区域，传 null 或不传则不渲染 */
    footer?: React.ReactNode | null;
    /** 关闭回调 */
    onClose?: () => void;
    /** 自定义内容 */
    children?: React.ReactNode;
    /** 面板自定义样式（取代 Web 的 `className`） */
    style?: StyleProp<ViewStyle>;
    /** 遮罩层自定义样式 */
    maskStyle?: StyleProp<ViewStyle>;
    /** 测试标识，同时作为 `-mask` / `-panel` / `-title` / `-close` / `-body` / `-footer` 的前缀 */
    testID?: string;
}

/** `.panel { transition: transform 0.36s cubic-bezier(0.2, 0, 0.2, 1) }` */
const SLIDE_DURATION_MS = 360;
const SLIDE_EASING = Easing.bezier(0.2, 0, 0.2, 1);

const PANEL_BG = 'rgb(247, 243, 223)';
const TITLE_COLOR = 'rgba(114, 93, 66, 1)';
const CLOSE_COLOR = 'rgba(114, 93, 66, 0.6)';
const BODY_COLOR = '#8a7b66';
const MASK_BG = 'rgba(0, 0, 0, 0.18)';

/**
 * 关闭态 / 打开态的位移。
 *
 * 上游是 CSS：`.panelRight { transform: translateX(100%) }` 被
 * `.panel.panelOpen { transform: none }` 覆盖，靠 transition 双向播放。
 * RN 没有 CSS transition，改用 `Animated.Value` + 百分比 `translate`。
 */
const slideRange = (placement: DrawerPlacement, axis: 'x' | 'y'): [string, string] => {
    if (axis === 'x') {
        return placement === 'left' ? ['-100%', '0%'] : ['100%', '0%'];
    }
    return placement === 'top' ? ['-100%', '0%'] : ['100%', '0%'];
};

/**
 * Drawer 下沉景深抽屉
 *
 * ## 与上游的结构性差异
 *
 * | 上游（Web）                                      | RN 版                                                        |
 * | ------------------------------------------------ | ------------------------------------------------------------ |
 * | `createPortal(..., document.body)`               | RN `Modal`（`transparent` + `animationType="none"`）          |
 * | CSS `transition` 双向播放（节点常驻 DOM）         | `Animated`；关闭时播完再卸载，需要内部 `mounted` 状态         |
 * | `document.body.style.overflow = 'hidden'` 锁滚动 | 无对应物（RN 没有 body 滚动），丢弃                           |
 * | 焦点送进抽屉 / 归还 / Tab 陷阱                    | 无对应物（RN 的 `View` 没有 `.focus()`，也没有 DOM 焦点顺序） |
 * | `inert={!open}`                                   | 关闭时直接卸载，`aria-hidden` 只在退场动画期间为真            |
 * | Escape 键                                         | `Modal.onRequestClose`（安卓返回键，RN 的对应物）              |
 * | `pushBackground` 下沉 body 子元素                | 空操作，见 `DrawerProps.pushBackground`                       |
 *
 * 遮罩点击关闭用 `Pressable`；面板自身 `onStartShouldSetResponder={() => true}`
 * 抢下 responder，于是面板内的点击不会冒泡到遮罩 —— 这是上游
 * `onClick={e => e.stopPropagation()}` 在 RN 里的对应写法。
 */
export const Drawer: React.FC<DrawerProps> = ({
    open,
    title,
    placement = 'right',
    width = 378,
    height = 300,
    maskClosable = true,
    pushBackground: _pushBackground = true,
    footer,
    onClose,
    children,
    style,
    maskStyle,
    testID,
}) => {
    const [mounted, setMounted] = useState(open);
    const slide = useRef(new Animated.Value(open ? 1 : 0)).current;
    const maskOpacity = useRef(new Animated.Value(open ? 1 : 0)).current;

    const idPrefix = `animal-drawer-${useId().replace(/:/g, '')}`;
    const titleId = `${idPrefix}-title`;

    useEffect(() => {
        if (open) setMounted(true);

        // useNativeDriver：真实设备上走原生线程；测试里是 no-op，
        // 所以卸载不能挂在动画回调上（回调不会来），用定时器兜底（同 TimePicker）。
        Animated.timing(slide, {
            toValue: open ? 1 : 0,
            duration: SLIDE_DURATION_MS,
            easing: SLIDE_EASING,
            useNativeDriver: true,
        }).start();
        Animated.timing(maskOpacity, {
            toValue: open ? 1 : 0,
            duration: SLIDE_DURATION_MS,
            easing: Easing.ease,
            useNativeDriver: true,
        }).start();

        if (open) return undefined;
        const id = setTimeout(() => setMounted(false), SLIDE_DURATION_MS);
        return () => clearTimeout(id);
        // pushBackground 有意忽略（_pushBackground 不可读），故不进依赖数组
    }, [open, slide, maskOpacity]);

    const handleMaskPress = useCallback(() => {
        if (maskClosable) onClose?.();
    }, [maskClosable, onClose]);

    const panelStyle: ViewStyle = placement === 'left' || placement === 'right' ? { width } : { height };

    const horizontal = placement === 'left' || placement === 'right';
    const [from, to] = slideRange(placement, horizontal ? 'x' : 'y');
    const axis = horizontal ? 'translateX' : 'translateY';
    const slideTransform = [{ [axis]: slide.interpolate({ inputRange: [0, 1], outputRange: [from, to] }) }];

    return (
        <Modal transparent visible={mounted} animationType="none" onRequestClose={onClose}>
            <Cursor>
                <Animated.View
                    style={[styles.mask, { opacity: maskOpacity }, maskStyle]}
                    testID={testID ? `${testID}-mask` : undefined}
                >
                    <Pressable
                        style={StyleSheet.absoluteFill}
                        onPress={handleMaskPress}
                        disabled={!maskClosable}
                        testID={testID ? `${testID}-mask-hit` : undefined}
                    />
                    <Animated.View
                        // `accessible` 是必需的：RNTL 的 `getByRole` 受 `isAccessibilityElement`
                        // 门控，非 Text 宿主只有显式 `accessible` 才会进无障碍树（与 Collapse 的
                        // `region` 同款坑）。对 dialog 来说把内容合成一个节点也正好是上游的语义
                        // （`aria-modal="true"` 意味着外部内容都不可达）。
                        accessible
                        role="dialog"
                        aria-modal
                        aria-hidden={!open}
                        aria-labelledby={title ? titleId : undefined}
                        // 上游 `onClick={e => e.stopPropagation()}`：
                        // 抢下 responder，遮罩的 Pressable 就收不到这次触摸。
                        onStartShouldSetResponder={() => true}
                        style={[
                            styles.panel,
                            placement === 'right' && styles.panelRight,
                            placement === 'left' && styles.panelLeft,
                            placement === 'top' && styles.panelTop,
                            placement === 'bottom' && styles.panelBottom,
                            panelStyle,
                            style,
                            { transform: slideTransform as never },
                        ]}
                        testID={testID ? `${testID}-panel` : undefined}
                    >
                        {title && (
                            <View style={styles.header}>
                                <Text
                                    nativeID={titleId}
                                    style={styles.title}
                                    testID={testID ? `${testID}-title` : undefined}
                                >
                                    {title}
                                </Text>
                                <Pressable
                                    accessibilityRole="button"
                                    aria-label="关闭"
                                    onPress={onClose}
                                    style={styles.close}
                                    testID={testID ? `${testID}-close` : undefined}
                                >
                                    <Text style={styles.closeText}>×</Text>
                                </Pressable>
                            </View>
                        )}
                        <View style={styles.body} testID={testID ? `${testID}-body` : undefined}>
                            {children}
                        </View>
                        {footer && (
                            <View style={styles.footer} testID={testID ? `${testID}-footer` : undefined}>
                                {footer}
                            </View>
                        )}
                    </Animated.View>
                </Animated.View>
            </Cursor>
        </Modal>
    );
};

Drawer.displayName = 'Drawer';

const styles = StyleSheet.create({
    // `.mask { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,.18); opacity: 0 }`
    mask: {
        flex: 1,
        backgroundColor: MASK_BG,
    },
    // `.panel { position: fixed; z-index: 1001; display:flex; flex-direction: column; ... }`
    panel: {
        position: 'absolute',
        backgroundColor: PANEL_BG,
        flexDirection: 'column',
        overflow: 'hidden',
    },
    // ⚠️ `max-width: calc(100vw - 32px)` —— RN 不支持 `calc()`，
    //    这里退化为 `maxWidth: '100%'`，也就是丢掉那 32px 的内缩。
    panelRight: {
        top: 0,
        right: 0,
        bottom: 0,
        maxWidth: '100%',
        borderTopLeftRadius: 20,
        borderBottomLeftRadius: 20,
        boxShadow: '-12px 0 32px rgba(61, 52, 40, 0.18)',
    },
    panelLeft: {
        top: 0,
        left: 0,
        bottom: 0,
        maxWidth: '100%',
        borderTopRightRadius: 20,
        borderBottomRightRadius: 20,
        boxShadow: '12px 0 32px rgba(61, 52, 40, 0.18)',
    },
    panelTop: {
        top: 0,
        left: 0,
        right: 0,
        maxHeight: '100%',
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        boxShadow: '0 12px 32px rgba(61, 52, 40, 0.18)',
    },
    panelBottom: {
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: '100%',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        boxShadow: '0 -12px 32px rgba(61, 52, 40, 0.18)',
    },
    // `.header { display:flex; align-items:center; justify-content:space-between; padding: 24px 24px 15px }`
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 24,
        paddingHorizontal: 24,
        paddingBottom: 15,
        flexShrink: 0,
    },
    // `.title { font-size: 28px; font-weight: 700; color: rgba(114,93,66,1) }`
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: TITLE_COLOR,
    },
    // `.close { width:32px; height:32px; border:none; background:transparent; border-radius:50% }`
    close: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
    },
    // `.close { font-size: 22px; line-height: 1; color: rgba(114,93,66,.6) }`
    closeText: {
        fontSize: 22,
        lineHeight: 22,
        color: CLOSE_COLOR,
    },
    // `.body { flex:1; overflow-y:auto; padding: 0 24px 24px; font-size:20px; font-weight:600; line-height:1.6; color:#8a7b66 }`
    body: {
        flex: 1,
        paddingHorizontal: 24,
        paddingBottom: 24,
        fontSize: 20,
        fontWeight: '600',
        lineHeight: 32,
        color: BODY_COLOR,
    },
    // `.footer { display:flex; align-items:center; justify-content:flex-end; gap:12px; padding: 0 24px 24px }`
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 12,
        paddingHorizontal: 24,
        paddingBottom: 24,
        flexShrink: 0,
    },
});
