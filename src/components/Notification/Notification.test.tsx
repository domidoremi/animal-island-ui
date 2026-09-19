import React from 'react';
import { Pressable, Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { Notification, NotificationHost, notificationDestroy } from './NotificationPortal';

/**
 * RN 版测试，对应 Web 版 `Notification.test.tsx` 的 20 个用例。
 *
 * ## 最大的结构差异：宿主组件
 * 上游首次 `open()` 时自己往 `document.body` 挂一个 React 根，调用方什么都不用做。
 * RN 没有 `document` / `createRoot`，**没有「凭空挂一个 React 根」的机制**，所以
 * 必须由宿主 App 渲染一次 `<NotificationHost />`。命令式 API 的形状完全没变，
 * 变的只有「谁来承载渲染」。每个用例都得先渲染宿主。
 *
 * **被丢弃的 Web 用例**：
 *   - 「首次 open 后在 body 创建通知根容器」—— 没有 `document.body`，改成断言
 *     「不渲染宿主时什么都不出现 / 渲染宿主后才出现」。
 *   - 「键盘 Enter 触发 onClick」与 `tabIndex={0}` —— RN 没有 DOM 焦点与键盘事件。
 *   - `.clickable:hover` 与 `:focus-visible` 的 outline —— RN 没有 hover / focus 样式。
 *   - `@media (prefers-reduced-motion)` —— 无对应物。
 *   - 「race: closeIcon onClick 立即置 dismissed」—— 依赖 DOM 的冒泡顺序
 *     （span.onClick 先于 button.onClick）；RN 的 responder 系统没有这套顺序语义，
 *     保留不了这个 race 的还原。但 store 层的「同 key 更新」契约照测。
 *
 * **测不到的**：滑入 / 滑出的实际观感（测试里 `useNativeDriver` 是 no-op）、
 *   `max-width: calc(100vw - 32px)`（RN 不支持 `calc()`，退化成 `maxWidth: '100%'`）、
 *   `pointerEvents` 在真机上的穿透行为。
 */

const styleOf = (node: TestInstance): Record<string, unknown> => {
    const merged: Record<string, unknown> = {};
    const walk = (s: unknown) => {
        if (Array.isArray(s)) s.forEach(walk);
        else if (s && typeof s === 'object') Object.assign(merged, s);
    };
    walk((node.props as { style?: unknown }).style);
    return merged;
};

/** `Animated.View` 不接受 `onPress`，可点击态走 responder；fireEvent.press 不生效 */
const responderEvent = (registrationName: string) => ({
    currentTarget: { measure: () => {} },
    target: {},
    preventDefault: () => {},
    isDefaultPrevented: () => false,
    stopPropagation: () => {},
    isPropagationStopped: () => false,
    persist: () => {},
    isPersistent: () => false,
    timeStamp: 0,
    nativeEvent: {
        changedTouches: [],
        identifier: 0,
        locationX: 0,
        locationY: 0,
        pageX: 0,
        pageY: 0,
        target: 0,
        timestamp: Date.now(),
        touches: [],
    },
    dispatchConfig: { registrationName },
});

// ⚠️ 必须只取宿主节点（`typeof n.type === 'string'`）：`container.queryAll` 会同时返回
//    复合组件节点和它渲染出的宿主节点，直接按 testID 过滤会**每条通知数两遍**。
const cardsOf = (container: TestInstance) =>
    container.queryAll(
        (n) =>
            typeof n.type === 'string' &&
            typeof n.props.testID === 'string' &&
            n.props.testID.startsWith('n-item-') &&
            // 关闭按钮的 testID 是 `<卡片>-close`，同前缀，必须排掉
            !n.props.testID.endsWith('-close')
    );

describe('Notification', () => {
    beforeEach(async () => {
        await act(async () => {
            notificationDestroy();
        });
    });

    afterEach(async () => {
        await act(async () => {
            notificationDestroy();
        });
    });

    describe('宿主组件', () => {
        it('不渲染 NotificationHost 时，open 只改 store、屏幕什么都不出现', async () => {
            const { queryByText } = await render(<Text>app</Text>);
            await act(async () => {
                Notification.info('hello');
            });
            expect(queryByText('hello')).toBeNull();
        });

        it('渲染宿主后 open 才显示通知', async () => {
            const { getByText } = await render(<NotificationHost testID="n" />);
            await act(async () => {
                Notification.info({ message: 'hello', duration: 0 });
            });
            expect(getByText('hello')).toBeTruthy();
        });
    });

    describe('静态方法', () => {
        it('字符串简写会作为 message 渲染', async () => {
            const { getByText } = await render(<NotificationHost testID="n" />);
            await act(async () => {
                Notification.success('简写消息');
            });
            expect(getByText('简写消息')).toBeTruthy();
        });

        it('对象 config 渲染 message + description', async () => {
            const { getByText } = await render(<NotificationHost testID="n" />);
            await act(async () => {
                Notification.info({ message: '标题', description: '详细描述内容' });
            });
            expect(getByText('标题')).toBeTruthy();
            expect(getByText('详细描述内容')).toBeTruthy();
        });

        it('不同 type 应用对应配色', async () => {
            const { container } = await render(<NotificationHost testID="n" />);
            await act(async () => {
                Notification.success({ message: 's', duration: 0 });
                Notification.error({ message: 'e', duration: 0 });
                Notification.warning({ message: 'w', duration: 0 });
                Notification.info({ message: 'i', duration: 0 });
            });
            const cards = cardsOf(container);
            expect(cards).toHaveLength(4);
            expect(styleOf(cards[0]).backgroundColor).toBe('#f5fae9');
            expect(styleOf(cards[1]).backgroundColor).toBe('#fde8e8');
            expect(styleOf(cards[2]).backgroundColor).toBe('#fdf6d9');
            expect(styleOf(cards[3]).backgroundColor).toBe('#ecf9f6');
        });
    });

    describe('位置分组', () => {
        it('position=top（默认）挂到 top 组', async () => {
            const { getByTestId } = await render(<NotificationHost testID="n" />);
            await act(async () => {
                Notification.info({ message: 'top', duration: 0 });
            });
            const group = getByTestId('n-group-top');
            expect(styleOf(group).top).toBe(24);
            expect(styleOf(group).alignItems).toBe('center');
        });

        it('position=topRight 走 topRight 组', async () => {
            const { getByTestId } = await render(<NotificationHost testID="n" />);
            await act(async () => {
                Notification.info({ message: 'right', position: 'topRight', duration: 0 });
            });
            const group = getByTestId('n-group-topRight');
            expect(styleOf(group).right).toBe(24);
            expect(styleOf(group).alignItems).toBe('flex-end');
        });

        it('position=bottom 走 bottom 组，且列反向堆叠', async () => {
            const { getByTestId } = await render(<NotificationHost testID="n" />);
            await act(async () => {
                Notification.info({ message: 'b', position: 'bottom', duration: 0 });
            });
            const group = getByTestId('n-group-bottom');
            expect(styleOf(group).bottom).toBe(24);
            // `.position-bottom { flex-direction: column-reverse }`
            expect(styleOf(group).flexDirection).toBe('column-reverse');
        });
    });

    describe('关闭行为', () => {
        it('点击关闭按钮后退场并从树里移除', async () => {
            const { queryByText, getByLabelText } = await render(<NotificationHost testID="n" />);
            await act(async () => {
                Notification.info({ message: 'close me', duration: 0 });
            });
            const closeBtn = getByLabelText('close');
            expect(closeBtn.props.accessibilityRole).toBe('button');
            await fireEvent.press(closeBtn);
            await waitFor(() => expect(queryByText('close me')).toBeNull(), { timeout: 3000 });
        });

        it('duration 到期自动关闭并触发 onClose', async () => {
            const onClose = jest.fn();
            const { queryByText, getByText } = await render(<NotificationHost testID="n" />);
            await act(async () => {
                Notification.info({ message: 'auto', duration: 0.2, onClose });
            });
            expect(getByText('auto')).toBeTruthy();
            await waitFor(() => expect(queryByText('auto')).toBeNull(), { timeout: 3000 });
            expect(onClose).toHaveBeenCalled();
        });

        it('destroy() 关闭全部', async () => {
            const { queryByText, getByText } = await render(<NotificationHost testID="n" />);
            await act(async () => {
                Notification.info({ message: 'a', duration: 0 });
                Notification.success({ message: 'b', duration: 0 });
            });
            expect(getByText('a')).toBeTruthy();
            expect(getByText('b')).toBeTruthy();
            await act(async () => {
                notificationDestroy();
            });
            expect(queryByText('a')).toBeNull();
            expect(queryByText('b')).toBeNull();
        });

        it('destroy(key) 只关闭指定 key', async () => {
            const { queryByText, getByText } = await render(<NotificationHost testID="n" />);
            await act(async () => {
                Notification.info({ message: 'keep', key: 'k1', duration: 0 });
                Notification.info({ message: 'remove', key: 'k2', duration: 0 });
            });
            await act(async () => {
                notificationDestroy('k2');
            });
            expect(queryByText('remove')).toBeNull();
            expect(getByText('keep')).toBeTruthy();
        });

        it('destroy() 同步触发被移除项的 onClose（与点 × / duration 到期契约一致）', async () => {
            const onCloseA = jest.fn();
            const onCloseB = jest.fn();
            await render(<NotificationHost testID="n" />);
            await act(async () => {
                Notification.info({ message: 'a', duration: 0, onClose: onCloseA });
                Notification.success({ message: 'b', duration: 0, onClose: onCloseB });
            });
            await act(async () => {
                notificationDestroy();
            });
            // destroy() 是同步路径，onClose 应立即触发（不等 250ms 退场动画）
            expect(onCloseA).toHaveBeenCalledTimes(1);
            expect(onCloseB).toHaveBeenCalledTimes(1);
        });

        it('destroy(key) 同步触发该项的 onClose，其它 key 不触发', async () => {
            const onCloseK1 = jest.fn();
            const onCloseK2 = jest.fn();
            await render(<NotificationHost testID="n" />);
            await act(async () => {
                Notification.info({ message: 'k1 msg', key: 'k1', duration: 0, onClose: onCloseK1 });
                Notification.info({ message: 'k2 msg', key: 'k2', duration: 0, onClose: onCloseK2 });
            });
            await act(async () => {
                notificationDestroy('k2');
            });
            expect(onCloseK2).toHaveBeenCalledTimes(1);
            expect(onCloseK1).not.toHaveBeenCalled();
        });

        it('upload 场景：destroy 后同 key 后续 open 不再创建（dismissed 闭包经 onClose 收到信号）', async () => {
            const uploadKey = 'upload-destroy';
            let dismissed = false;
            const onCloseMock = jest.fn(() => {
                dismissed = true;
            });
            const open = (msg: string) => {
                if (dismissed) return;
                Notification.info({ message: msg, key: uploadKey, duration: 0, onClose: onCloseMock });
            };

            const { queryByText, getByText } = await render(<NotificationHost testID="n" />);
            await act(async () => {
                open('上传中 0%');
            });
            expect(getByText('上传中 0%')).toBeTruthy();

            await act(async () => {
                notificationDestroy();
            });
            expect(onCloseMock).toHaveBeenCalledTimes(1);
            expect(dismissed).toBe(true);

            await act(async () => {
                open('上传中 50%');
                open('上传完成 100%');
            });
            expect(queryByText('上传中 50%')).toBeNull();
            expect(queryByText('上传完成 100%')).toBeNull();
        });
    });

    describe('onClick 与可点击态', () => {
        it('配置 onClick 后，点击通知本体触发回调', async () => {
            const onClick = jest.fn();
            const { getByText, container } = await render(<NotificationHost testID="n" />);
            await act(async () => {
                Notification.info({ message: 'click me', duration: 0, onClick });
            });
            expect(getByText('click me')).toBeTruthy();
            const card = cardsOf(container)[0];
            // Animated.View 不接受 onPress，可点击态走 responder（见组件注释）
            fireEvent(card, 'responderRelease', responderEvent('onResponderRelease'));
            expect(onClick).toHaveBeenCalled();
        });

        it('onClick 设置后卡片带 role=button；没设置时没有', async () => {
            const { container } = await render(<NotificationHost testID="n" />);
            await act(async () => {
                Notification.info({ message: 'kb', duration: 0, onClick: () => {} });
                Notification.info({ message: 'plain', key: 'p', duration: 0 });
            });
            const cards = cardsOf(container);
            expect(cards[0].props.role).toBe('button');
            expect(cards[0].props.accessible).toBe(true);
            expect(cards[1].props.role).toBeUndefined();
        });
    });

    describe('key 更新', () => {
        it('同 key 二次 open 走更新分支（仍只 1 条）', async () => {
            const { container, queryByText, getByText } = await render(<NotificationHost testID="n" />);
            await act(async () => {
                Notification.info({ message: 'first', key: 'same', duration: 0 });
            });
            expect(getByText('first')).toBeTruthy();
            await act(async () => {
                Notification.info({ message: 'second', key: 'same', duration: 0 });
            });
            expect(cardsOf(container)).toHaveLength(1);
            expect(getByText('second')).toBeTruthy();
            expect(queryByText('first')).toBeNull();
        });

        it('用户关闭后，同 key 后续 open 不再创建（由调用方 dismissed 闭包控制）', async () => {
            const uploadKey = 'upload-test';
            let dismissed = false;
            const open = (msg: string) => {
                if (dismissed) return;
                Notification.info({
                    message: msg,
                    key: uploadKey,
                    duration: 0,
                    onClose: () => {
                        dismissed = true;
                    },
                });
            };

            const { queryByText, getByLabelText } = await render(<NotificationHost testID="n" />);
            await act(async () => {
                open('上传中 0%');
            });
            await fireEvent.press(getByLabelText('close'));
            await waitFor(() => expect(queryByText('上传中 0%')).toBeNull(), { timeout: 3000 });

            await act(async () => {
                open('上传中 50%');
                open('上传完成 100%');
            });
            expect(queryByText('上传中 50%')).toBeNull();
            expect(queryByText('上传完成 100%')).toBeNull();
        });
    });

    describe('btn slot', () => {
        it('配置 btn 后渲染自定义操作按钮', async () => {
            const { getByTestId } = await render(<NotificationHost testID="n" />);
            await act(async () => {
                Notification.info({
                    message: 'with action',
                    duration: 0,
                    btn: (
                        <Pressable testID="custom-btn">
                            <Text>Action</Text>
                        </Pressable>
                    ),
                });
            });
            expect(getByTestId('custom-btn')).toBeTruthy();
        });

        it('自定义 closeIcon 渲染在关闭按钮里', async () => {
            const { getByTestId, getByLabelText } = await render(<NotificationHost testID="n" />);
            await act(async () => {
                Notification.info({
                    message: 'custom close',
                    duration: 0,
                    closeIcon: <Text testID="custom-close">X</Text>,
                });
            });
            expect(getByTestId('custom-close')).toBeTruthy();
            expect(getByLabelText('close')).toBeTruthy();
        });
    });

    it('style 透传到卡片', async () => {
        const { container } = await render(<NotificationHost testID="n" />);
        await act(async () => {
            Notification.info({ message: 'styled', duration: 0, style: { borderWidth: 4 } });
        });
        expect(styleOf(cardsOf(container)[0]).borderWidth).toBe(4);
    });

    it('iconWrap 是 aria-hidden（装饰性图标不进无障碍树）', async () => {
        const { container } = await render(<NotificationHost testID="n" />);
        await act(async () => {
            Notification.info({ message: 'a11y', duration: 0 });
        });
        const iconWraps = container.queryAll((n) => n.props['aria-hidden'] === true && n.props.style !== undefined);
        expect(iconWraps.length).toBeGreaterThan(0);
        // 卡片自身不是隐藏节点
        expect(cardsOf(container)[0].props['aria-hidden']).toBeUndefined();
        expect(cardsOf(container)).toHaveLength(1);
    });
});
