// ============================================
// Notification 命令式 API + 内部 store + 宿主组件（RN 版）
// 用法: Notification.success({ message: '...', description: '...' })
// 与 Web 版最大的差别见下面 `NotificationHost` 的注释。
// ============================================

import React, { useCallback, useSyncExternalStore } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { NotificationView } from './Notification';
import type { NotificationConfig, NotificationItem, NotificationPosition, NotificationType } from './types';

const DEFAULT_DURATION = 4.5;

const POSITION_PLACEMENT: Record<NotificationPosition, 'top' | 'bottom'> = {
    top: 'top',
    topLeft: 'top',
    topRight: 'top',
    bottom: 'bottom',
    bottomLeft: 'bottom',
    bottomRight: 'bottom',
};

const POSITION_GROUPS: NotificationPosition[] = ['top', 'topLeft', 'topRight', 'bottom', 'bottomLeft', 'bottomRight'];

/** `.position-*` 六个分组的定位（上游是 `position: fixed` + `translateX(-50%)` 居中） */
const GROUP_STYLE: Record<NotificationPosition, ViewStyle> = {
    top: { top: 24, left: 0, right: 0, alignItems: 'center' },
    topLeft: { top: 24, left: 24, alignItems: 'flex-start' },
    topRight: { top: 24, right: 24, alignItems: 'flex-end' },
    bottom: { bottom: 24, left: 0, right: 0, alignItems: 'center', flexDirection: 'column-reverse' },
    bottomLeft: { bottom: 24, left: 24, alignItems: 'flex-start', flexDirection: 'column-reverse' },
    bottomRight: { bottom: 24, right: 24, alignItems: 'flex-end', flexDirection: 'column-reverse' },
};

// ---- Module-level store ----
let storeItems: NotificationItem[] = [];
let counter = 0;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

const getSnapshot = (): NotificationItem[] => storeItems;
const getServerSnapshot = (): NotificationItem[] => [];

const NotificationContainer: React.FC<{ items: NotificationItem[]; testID?: string }> = ({ items: list, testID }) => {
    const handleRemove = useCallback((key: string) => {
        const next = storeItems.filter((it) => it.key !== key);
        if (next.length === storeItems.length) return;
        storeItems = next;
        listeners.forEach((l) => l());
    }, []);

    return (
        <>
            {POSITION_GROUPS.map((position) => {
                const groupItems = list.filter((it) => it.position === position);
                if (groupItems.length === 0) return null;
                return (
                    <View
                        key={position}
                        pointerEvents="box-none"
                        style={[styles.group, GROUP_STYLE[position]]}
                        testID={testID ? `${testID}-group-${position}` : undefined}
                    >
                        {groupItems.map((it) => (
                            <NotificationView
                                key={it.key}
                                item={it}
                                onRemove={handleRemove}
                                testID={testID ? `${testID}-item-${it.key}` : undefined}
                            />
                        ))}
                    </View>
                );
            })}
        </>
    );
};

/**
 * Notification 的**宿主组件**。
 *
 * ⚠️ **这是 RN 版相对上游最大的结构变化。** 上游在首次 `open()` 时自己
 * `document.createElement` + `createRoot(...).render(<Bridge />)` 把容器挂到 `document.body`
 * 上，调用方什么都不用做。RN 既没有 `document` 也没有 `createRoot`，**没有任何
 * 「凭空挂一个 React 根」的机制**，所以必须由宿主 App 在视图树里渲染一次
 * `<NotificationHost />`（通常放在根组件的最外层，盖在所有内容之上）。
 *
 * 命令式 API（`Notification.success(...)` 等）的形状与上游完全一致，
 * 变化的只有「谁来承载渲染」这一件事。
 */
export const NotificationHost: React.FC<{ testID?: string }> = ({ testID }) => {
    const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    return (
        <View pointerEvents="box-none" style={styles.root} testID={testID}>
            <NotificationContainer items={list} testID={testID} />
        </View>
    );
};

NotificationHost.displayName = 'NotificationHost';

// ---- Public API ----
const buildItem = (config: NotificationConfig | string, type: NotificationType): NotificationItem => {
    const normalized: NotificationConfig = typeof config === 'string' ? { message: config } : { ...config };
    const position: NotificationPosition = normalized.position ?? 'top';
    counter += 1;
    return {
        ...normalized,
        type,
        key: normalized.key ?? `animal-notification-${Date.now()}-${counter}`,
        position,
        placement: POSITION_PLACEMENT[position],
        duration: normalized.duration ?? DEFAULT_DURATION,
        createdAt: Date.now(),
    };
};

const open = (config: NotificationConfig | string, type: NotificationType = 'info'): void => {
    const item = buildItem(config, type);

    // 显式 key 时,先尝试更新现有通知(react: 若 key 已存在则替换,否则追加)
    if (item.key) {
        const idx = storeItems.findIndex((it) => it.key === item.key);
        if (idx !== -1) {
            const next = storeItems.slice();
            next[idx] = item;
            storeItems = next;
            listeners.forEach((l) => l());
            return;
        }
    }

    storeItems = [...storeItems, item];
    listeners.forEach((l) => l());
};

const destroy = (key?: string): void => {
    let removed: NotificationItem[] = [];
    if (key) {
        removed = storeItems.filter((it) => it.key === key);
        const next = storeItems.filter((it) => it.key !== key);
        if (next.length === storeItems.length) return;
        storeItems = next;
    } else if (storeItems.length === 0) {
        return;
    } else {
        removed = storeItems.slice();
        storeItems = [];
    }
    listeners.forEach((l) => l());
    // 关闭契约对齐"用户点 × / duration 到期":无论哪种路径,onClose 都该同步触发。
    // 调用方常在 onClose 里设置 dismissed / abort 等闭包标志位(见 upload 进度场景),
    // 如果 destroy 路径不走 onClose,这些标志位就收不到信号,后续同 key open 仍会"复活"。
    removed.forEach((it) => it.onClose?.());
};

/**
 * 命令式 Notification,沿用 antd 风格静态方法。
 *
 * - `Notification.open(config)` / `.success(config)` / `.info(config)` / `.warning(config)` / `.error(config)`
 * - `config` 可以是字符串(仅 message)或完整对象
 * - `Notification.destroy()` 关闭全部,`Notification.destroy(key)` 关闭指定 key
 * - 默认位置: `top`(顶部居中)
 * - 默认 `duration: 4.5` 秒;传 `0` 关闭自动关闭
 * - 显式指定 `key` 后再次调用同 key 会更新现有通知而不是新增
 *
 * ⚠️ **RN 版要求宿主 App 渲染一次 `<NotificationHost />`**，否则这些调用只会改 store、
 * 屏幕上什么都不出现。上游不需要这一步（它自己往 `document.body` 挂根）。
 */
export interface NotificationStatic {
    (config: NotificationConfig | string): void;
    open: (config: NotificationConfig | string) => void;
    success: (config: NotificationConfig | string) => void;
    info: (config: NotificationConfig | string) => void;
    warning: (config: NotificationConfig | string) => void;
    error: (config: NotificationConfig | string) => void;
    destroy: (key?: string) => void;
}

const notificationApi = ((config: NotificationConfig | string) => open(config, 'info')) as NotificationStatic;
notificationApi.open = (config) => open(config, 'info');
notificationApi.success = (config) => open(config, 'success');
notificationApi.info = (config) => open(config, 'info');
notificationApi.warning = (config) => open(config, 'warning');
notificationApi.error = (config) => open(config, 'error');
notificationApi.destroy = destroy;

export const Notification = notificationApi;
export { open as notificationOpen, destroy as notificationDestroy };
export const NOTIFICATION_DEFAULT_DURATION = DEFAULT_DURATION;

const styles = StyleSheet.create({
    // `.notificationRoot { position:fixed; inset:0; pointer-events:none; z-index:2000 }`
    root: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 2000,
    },
    // `.position-* { position:fixed; display:flex; flex-direction:column; gap:12px }`
    // ⚠️ `max-width: calc(100vw - 32px)` → 退化（RN 不支持 `calc()`）
    group: {
        position: 'absolute',
        flexDirection: 'column',
        gap: 12,
    },
});
