import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    Pressable,
    StyleSheet,
    Text,
    View,
    type StyleProp,
    type TextStyle,
    type ViewStyle,
} from 'react-native';
import { borderWidth, colors, duration, fontSize, radius, spacing } from '../../theme/tokens';

export interface TabItem {
    key: string;
    label: React.ReactNode;
    children: React.ReactNode;
}

export interface TabsProps {
    items: TabItem[];
    defaultActiveKey?: string;
    activeKey?: string;
    onChange?: (key: string) => void;
    /** @deprecated 叶子装饰已移除，该参数不再生效（上游保留为 no-op，这里同样保留以免破坏 API） */
    leafAnimation?: boolean;
    shadow?: boolean;
    /** 无可见标题时给 tablist 一个无障碍标签 */
    'aria-label'?: string;
    /**
     * 自定义样式（作用于最外层容器）。
     *
     * 对应 Web 版的 `className`：RN 没有类名系统，`style` 是它的替代物。
     * 上游本来就有同名 `style` prop（作用于最外层 div），语义一致。
     */
    style?: StyleProp<ViewStyle>;
    /**
     * 测试标识（RN 里 `className` 的对应物）。
     *
     * 组件内部还会派生 `${testID}-tablist` / `-tab-<key>` / `-panel` / `-icon-<key>` /
     * `-label-<key>`，供测试定位 Web 版用类名 / role 定位的那几个结构节点。
     */
    testID?: string;
}

/**
 * 面板入场动画时长 —— 对应 `.tabContent { animation: fadeIn 0.25s ease }`。
 * `@motion-duration-base` = 0.25s，与 `duration.base` 一致。
 */
const FADE_DURATION = duration.base;

/** 选中态底色 —— `.tabItem.active { background: #0cc0b5 }`（Less 里是硬编码，照搬） */
const ACTIVE_BG = '#0cc0b5';
/** 选中态文字色 —— `.tabItem.active { color: #fff9e3 }`（硬编码） */
const ACTIVE_TEXT = '#fff9e3';

export const Tabs: React.FC<TabsProps> = ({
    items,
    defaultActiveKey,
    activeKey,
    onChange,
    // 上游把 `leafAnimation` 留成 no-op（叶子装饰已移除）。RN 侧同样不解构它，
    // 保留在类型里以免破坏已有调用方。
    shadow = true,
    'aria-label': ariaLabel,
    style,
    testID,
}) => {
    const [internalActiveKey, setInternalActiveKey] = useState(defaultActiveKey || items[0]?.key);

    const currentActiveKey = activeKey !== undefined ? activeKey : internalActiveKey;

    /**
     * tablist 内每个 tab 的稳定 id 前缀。
     *
     * Web 版用它做 `aria-controls` / `aria-labelledby` **双向**关联：
     *   - `tab → panel`：`aria-controls={panelId(k)}` —— **RN 没有 `aria-controls`，整条丢弃**；
     *   - `panel → tab`：`aria-labelledby={tabId(k)}` —— RN 0.87 支持，已还原（见下）。
     * 因此面板那侧的 `id={panelId(k)}` 也一并删掉：没有任何东西会引用它
     * （与 TimePicker 丢弃 `panelId` 的处理一致，见 RN-PORT.md「deliberate divergences」第 4 条）。
     */
    const idPrefix = `animal-tabs-${useId().replace(/:/g, '')}`;
    const tabId = useCallback((k: string) => `${idPrefix}-tab-${k}`, [idPrefix]);

    const handleTabClick = useCallback(
        (key: string) => {
            if (activeKey === undefined) {
                setInternalActiveKey(key);
            }
            onChange?.(key);
        },
        [activeKey, onChange]
    );

    const activeItem = useMemo(() => items.find((item) => item.key === currentActiveKey), [items, currentActiveKey]);

    /**
     * 面板入场动画（`.tabContent { animation: fadeIn 0.25s ease }`，
     * `from { opacity: 0; translateY(4px) }` → `to { opacity: 1; translateY(0) }`）。
     *
     * ⚠️ 与 Web 版一致，这是**只在挂载时播一次**的入场动画：Web 上切 tab 时 React
     * 复用同一个 `.tabContent` DOM 节点，CSS animation 不会重放；RN 侧同理，
     * 面板 `View` 不带 `key`，所以也只在首次挂载时播一次。
     *
     * `useNativeDriver: true`：opacity / translateY 都是原生可驱动的属性
     * （与 Button 的 loading 旋转同一选择；测试渲染器里原生驱动是空操作，不产生 act 警告）。
     */
    const fade = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.timing(fade, {
            toValue: 1,
            duration: FADE_DURATION,
            easing: Easing.ease, // CSS `ease` = cubic-bezier(0.25, 0.1, 0.25, 1)
            useNativeDriver: true,
        }).start();
    }, [fade]);
    const translateY = fade.interpolate({ inputRange: [0, 1], outputRange: [4, 0] });

    return (
        <View style={[styles.tabs, style]} testID={testID}>
            {/*
             * Web: <div role="tablist" aria-label aria-orientation="horizontal" onKeyDown>
             *
             * ⚠️ 两处丢弃：
             *   - `aria-orientation="horizontal"` —— RN 0.87 的 aria-* 白名单里没有它。
             *   - `onKeyDown`（ArrowLeft/Right/Home/End 切换 + `focusTab` 迁移焦点）——
             *     RN 没有 DOM 键盘事件，也没有 `element.focus()`；触摸设备上「切换 tab」
             *     就是点它本身，键盘漫游（roving tabindex）留给系统读屏。
             *
             * `role="tablist"` 与 `role="tab"` / `role="tabpanel"` **RN 0.87 是支持的**
             * （`Role` 联合类型里三者都在，见 ViewAccessibility.d.ts）。
             *
             * ⚠️ 这里**刻意不设 `accessible`**：RN 会把容器的子节点合并成**一个**无障碍
             * 节点，那会把每个 tab 压平、读屏用户就没法逐个选中了。代价是 RNTL 的
             * `getByRole('tablist')` 查不到它（`isAccessibilityElement` 对裸 View 只在
             * 显式传了 `accessible` 时才为 true）—— 与 Collapse 的 `region` 同一限制。
             */}
            <View
                role="tablist"
                aria-label={ariaLabel}
                style={styles.tabList}
                testID={testID ? `${testID}-tablist` : undefined}
            >
                {items.map((item) => {
                    const isActive = item.key === currentActiveKey;
                    return (
                        <Pressable
                            key={item.key}
                            role="tab"
                            // `aria-selected` 是上游的名字；Pressable 会把它折进
                            // `accessibilityState.selected`（Pressable.js 的 ariaSelected
                            // → _accessibilityState.selected），所以测试里读
                            // `props.accessibilityState.selected` 即可。
                            aria-selected={isActive}
                            nativeID={tabId(item.key)}
                            // Web 的 roving tabindex：只有当前 tab 可被 Tab 键停留。
                            // RN 0.87 的 `ViewProps` 原生支持 `tabIndex: 0 | -1`，
                            // 且 `View.js` 会把它换算成 `focusable = !tabIndex`
                            // （即 RN-PORT.md 里 `tabIndex → focusable` 那条映射），
                            // 所以这里逐字照搬上游写法。
                            tabIndex={isActive ? 0 : -1}
                            onPress={() => handleTabClick(item.key)}
                            style={[
                                styles.tabItem,
                                isActive && styles.tabItemActive,
                                isActive && shadow && styles.tabItemActiveShadow,
                            ]}
                            testID={testID ? `${testID}-tab-${item.key}` : undefined}
                        >
                            {/* 装饰性圆点，`aria-hidden`（与 Web 版一致） */}
                            <Text
                                aria-hidden
                                style={[
                                    styles.tabText,
                                    styles.tabIcon,
                                    isActive && styles.tabTextActive,
                                    isActive && styles.tabIconActive,
                                ]}
                                testID={testID ? `${testID}-icon-${item.key}` : undefined}
                            >
                                {isActive ? '●' : '○'}
                            </Text>
                            <Text
                                style={[styles.tabText, styles.tabLabel, isActive && styles.tabTextActive]}
                                testID={testID ? `${testID}-label-${item.key}` : undefined}
                            >
                                {item.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            {/*
             * Web: <div role="tabpanel" id={panelId} aria-labelledby={tabId} tabIndex={0}>
             * 只能还原「panel → tab」这一半（RN 无 `aria-controls`，见 `idPrefix` 注释）。
             */}
            <Animated.View
                role="tabpanel"
                aria-labelledby={activeItem ? tabId(activeItem.key) : undefined}
                tabIndex={0}
                style={[styles.tabContent, { opacity: fade, transform: [{ translateY }] }]}
                testID={testID ? `${testID}-panel` : undefined}
            >
                <View style={styles.tabContentInner}>{activeItem?.children}</View>
            </Animated.View>
        </View>
    );
};

Tabs.displayName = 'Tabs';

const styles = StyleSheet.create({
    // `.tabs { background: @bg-color; border-radius: @border-radius-lg;
    //          border: @border-width solid @border-color-light; overflow: hidden }`
    tabs: {
        backgroundColor: colors.bg,
        borderRadius: radius.lg,
        borderWidth,
        borderColor: colors.borderLight,
        overflow: 'hidden',
    },
    // `.tabList { display: flex; gap: @spacing-xs; padding: @spacing-lg;
    //            background: rgba(255, 255, 255, 0.6); border-bottom: 2px solid @border-color-light }`
    tabList: {
        flexDirection: 'row',
        gap: spacing.xs,
        padding: spacing.lg,
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
        borderBottomWidth: 2,
        borderBottomColor: colors.borderLight,
    },
    // `.tabItem { display: flex; align-items: center; gap: @spacing-sm;
    //            padding: @spacing-sm @spacing-lg; background: transparent;
    //            border: none; border-radius: @border-radius-lg }`
    tabItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.lg,
        backgroundColor: 'transparent',
        // `.tabItem:hover { background: rgba(25, 200, 185, 0.1) }` **丢弃** ——
        // 触摸设备没有 hover，RN 也没有对应事件（RN-PORT.md 的 `:hover` → —）。
    },
    // `.tabItem.active { background: #0cc0b5 }`（文字色 / 字重在 `tabTextActive`）
    tabItemActive: {
        backgroundColor: ACTIVE_BG,
    },
    // `.tabItem.active-shadow { box-shadow: 0 3px 0 0 @shadow-color-light }`
    tabItemActiveShadow: {
        boxShadow: `0 3px 0 0 ${colors.shadowLight}`,
    },
    // `.tabItem { font-size: @font-size-base; font-weight: 500; color: @text-color }`
    // —— 这两条是可继承的文本样式，RN 里不会继承，所以下沉到两个 `<Text>` 上。
    tabText: {
        color: colors.text,
        fontWeight: '500',
    } as TextStyle,
    tabTextActive: {
        color: ACTIVE_TEXT,
        fontWeight: '600',
    } as TextStyle,
    // `.tabIcon { font-size: 10px }`
    tabIcon: {
        fontSize: 10,
    },
    // `.active .tabIcon { transform: scale(1.2) }`
    tabIconActive: {
        transform: [{ scale: 1.2 }],
    },
    // `.tabLabel { position: relative; color: inherit }`（`position: relative` 在 RN 里是默认值，无需声明）
    tabLabel: {
        fontSize: fontSize.base,
    },
    // `.tabContent { min-height: 60px; padding: @spacing-xl }`
    tabContent: {
        minHeight: 60,
        padding: spacing.xl,
    },
    // `.tabContentInner { min-height: 40px; color: var(--animal-text-color-secondary);
    //                    font-size: var(--animal-font-size-base);
    //                    line-height: var(--animal-line-height-base) }`
    // 这里只保留盒模型；文字颜色 / 字号 / 行高是可继承属性，RN 不继承，
    // 由内容自己的 `<Text>` 决定（与上游「容器声明可继承文字样式」的做法不等价，但
    // RN 没有别的表达方式）。
    tabContentInner: {
        minHeight: 40,
    },
});
