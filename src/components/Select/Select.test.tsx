import React, { useState } from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { Select, type SelectOption } from './Select';
import { dropdownHeight } from './geometry';

/**
 * RN 版测试，对应 Web 版 `Select.test.tsx` 的 18 个用例。
 *
 * **被丢弃的 Web 用例及原因**：
 *   - `className` 断言（`styles.disabled` / `styles.trigger` / `styles.dropdown`）——
 *     RN 无 className，改为断言 `style` 的对应字段。
 *   - 「鼠标移入/移出选项 → hovered 样式」（1 个）—— RN 没有 hover。
 *     替代物是 `Pressable` 的 `pressed`（按下时文字加粗，与选中态同款），已单独覆盖。
 *   - 键盘 3 个（Enter/Space/方向键打开、ArrowDown/Up 切换 activedescendant + Enter 选中、
 *     Escape 关闭并把焦点交还 trigger）—— RN 没有 DOM 键盘事件，也没有 DOM 焦点。
 *     `aria-activedescendant` 在 RN 里**没有对应属性**，所以驱动它的 `activeKey` 状态
 *     也一并删除（不是「留着不用」）。Escape 的等价物是 Android 返回键，即
 *     `Modal.onRequestClose`，已单独覆盖。
 *   - `aria-haspopup="listbox"` / `aria-controls` / `aria-activedescendant` 断言 ——
 *     RN 三个都没有对应属性（前两个是 RN-PORT.md 点名「无 RN 等价物」的）。
 *   - 「点击外部区域关闭」不能照搬 Web 的 `mousedown` 写法：RN 没有全局点击监听，
 *     等价物是 Modal 里的透明全屏遮罩 `Pressable`，断言改为点它。
 *     同理「再次点击 trigger 折叠」在 Modal 版本里命中的是遮罩（触发区被盖住了），
 *     用户观感一致，但断言落在遮罩上。
 *   - `getByRole('listbox')`（2 处）—— 面板是裸 `<View role>`，过不了 RNTL 的
 *     `isAccessibilityElement` 闸门（只有显式 `accessible` 或 Text/Pressable 才算），
 *     而且 **RN 0.87 的 `Role` 联合类型里根本没有 `listbox`**，只能用 `list`。
 *     改为断言面板的 `role` / `aria-label` props 本身，并保留一条断言把该限制钉住。
 *   - 4 个「定位策略」用例（右侧不足翻左、下方不足翻上、顶部太近强制贴下、空间充足居中）——
 *     在组件里**无法覆盖**：定位靠 `measureInWindow`，而 jest preset 把它 mock 成
 *     永不回调的空实现。这 4 条**没有丢**，而是升级成 `geometry.test.ts` 里的纯函数单测
 *     （覆盖面更大：把上游三个分支与边界都枚举了）。本文件只保留一条「面板落在兜底位置」
 *     的接线断言。
 *   - `flushRaf()` 辅助（等待 `requestAnimationFrame` 把 `mounted` 置真）—— RN 不需要：
 *     `mounted` 这个中间状态存在的唯一目的是让 CSS `@keyframes` 能启动，RN 用 `Animated`
 *     直接驱动 `opacity`，面板挂载即可见。
 *
 * **RN 侧新增**：面板的兜底定位断言、防穿透机制断言、按下态断言、`Modal.onRequestClose`。
 */

const options: SelectOption[] = [
    { key: 'a', label: 'Apple' },
    { key: 'b', label: 'Banana' },
    { key: 'c', label: 'Cherry' },
];

const child = (node: unknown) => node as TestInstance;

const styleOf = (node: TestInstance) => {
    const merged: Record<string, unknown> = {};
    const walk = (s: unknown) => {
        if (Array.isArray(s)) s.forEach(walk);
        else if (s && typeof s === 'object') Object.assign(merged, s);
    };
    walk(node.props.style);
    return merged;
};

/** 受控宿主：把 onChange 接到本地 state，模拟真实用法 */
const Host = ({
    onChange,
    initial = '',
    disabled,
    testID = 's',
}: {
    onChange?: (k: string) => void;
    initial?: string;
    disabled?: boolean;
    testID?: string;
}) => {
    const [v, setV] = useState(initial);
    return (
        <Select
            testID={testID}
            options={options}
            value={v}
            disabled={disabled}
            onChange={(k) => {
                setV(k);
                onChange?.(k);
            }}
        />
    );
};

/**
 * 模拟「手指按住」。`fireEvent(node, 'pressIn')` 打不到 `Pressable`：
 * Pressability 只把 responder 事件挂到宿主 View 上（`onResponderGrant` /
 * `onResponderRelease`），不暴露 `onPressIn`。见 Button.test.tsx 的说明。
 */
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

const pressIn = (node: TestInstance) => fireEvent(node, 'responderGrant', responderEvent('onResponderGrant'));

/** 取选项里的文字节点（选项的渲染顺序是 [pillBar?, dot, Text]，所以取最后一个子节点） */
const labelOf = (option: TestInstance) => child(option.children[option.children.length - 1]);

describe('Select', () => {
    it('未选中时显示 placeholder', async () => {
        const { getByText } = await render(
            <Select options={options} value="" onChange={() => {}} placeholder="请选择" />
        );
        expect(getByText('请选择')).toBeTruthy();
    });

    it('已选中时显示对应 label', async () => {
        const { getByText } = await render(<Select options={options} value="b" onChange={() => {}} />);
        expect(getByText('Banana')).toBeTruthy();
    });

    it('点击 trigger 展开下拉', async () => {
        const { getByTestId, queryByTestId, getByText } = await render(<Host />);
        expect(queryByTestId('s-listbox')).toBeNull();

        await fireEvent.press(getByTestId('s-trigger'));
        expect(getByTestId('s-listbox')).toBeTruthy();
        expect(getByText('Apple')).toBeTruthy();
        expect(getByText('Cherry')).toBeTruthy();
    });

    it('展开后再点一次（落在遮罩上）折叠', async () => {
        const { getByTestId, queryByTestId } = await render(<Host />);
        await fireEvent.press(getByTestId('s-trigger'));
        expect(getByTestId('s-listbox')).toBeTruthy();

        // 触发区被全屏遮罩盖住，第二次点击命中的是遮罩 —— 与 Web「再点一次 trigger」观感一致
        await fireEvent.press(getByTestId('s-backdrop'));
        expect(queryByTestId('s-listbox')).toBeNull();
    });

    it('选择某项 → 触发 onChange 并关闭下拉', async () => {
        const onChange = jest.fn();
        const { getByTestId, queryByTestId, getByText } = await render(<Host onChange={onChange} />);
        await fireEvent.press(getByTestId('s-trigger'));
        await fireEvent.press(getByTestId('s-option-a'));

        expect(onChange).toHaveBeenCalledWith('a');
        expect(queryByTestId('s-listbox')).toBeNull();
        // 受控宿主回写后，触发区显示新值
        expect(getByText('Apple')).toBeTruthy();
    });

    it('disabled 时点击 trigger 不展开，并应用禁用样式', async () => {
        const { getByTestId, queryByTestId } = await render(<Host disabled />);
        const trigger = getByTestId('s-trigger');
        await fireEvent.press(trigger);
        expect(queryByTestId('s-listbox')).toBeNull();
        // .disabled .trigger { opacity: .5; background: #f5f5f0 }
        expect(getByTestId('s')).toHaveStyle({ opacity: 0.5 });
        expect(styleOf(trigger).backgroundColor).toBe('#f5f5f0');
        // `aria-disabled` 在宿主节点上已被 Pressable 改写成 accessibilityState.disabled
        expect(trigger.props.accessibilityState).toMatchObject({ disabled: true });
    });

    it('点击外部区域关闭下拉（替代 Web 的 document mousedown）', async () => {
        const { getByTestId, queryByTestId } = await render(<Host />);
        await fireEvent.press(getByTestId('s-trigger'));
        expect(getByTestId('s-listbox')).toBeTruthy();

        await fireEvent.press(getByTestId('s-backdrop'));
        expect(queryByTestId('s-listbox')).toBeNull();
    });

    it('trigger 角色 = combobox，aria-expanded 与 listbox 同步', async () => {
        const { getByTestId, getByRole } = await render(<Host />);
        const trigger = getByRole('combobox');
        // ⚠️ `getByTestId` 拿到的是**宿主节点**：Pressable 在 JS 里把 aria-* 转换掉了
        //   `aria-expanded` → `accessibilityState.expanded`
        //   `aria-disabled` → `accessibilityState.disabled`
        //   `aria-label`    → `accessibilityLabel`
        //   只有 `role` 原样保留。
        expect(trigger.props.role).toBe('combobox');
        expect(trigger.props.accessibilityState).toMatchObject({ expanded: false });

        await fireEvent.press(trigger);
        expect(getByTestId('s-trigger').props.accessibilityState).toMatchObject({ expanded: true });
        // ⚠️ 上游这里是 `getByRole('listbox')`。RN 里两重障碍：
        //   1. RN 0.87 的 `Role` 联合类型没有 `listbox`（只有 `list`）；
        //   2. 面板是裸 `<View role>`，过不了 RNTL 的 `isAccessibilityElement` 闸门。
        // 所以改为断言面板的 props 本身（`getByRole('list')` 同样查不到，见下面那条钉死限制的用例）。
        expect(getByTestId('s-listbox').props.role).toBe('list');
    });

    it('面板不能通过 getByRole 查到（RNTL 的 isAccessibilityElement 闸门）', async () => {
        const { getByTestId, queryByRole } = await render(<Host />);
        await fireEvent.press(getByTestId('s-trigger'));

        // 面板刻意**不**加 `accessible`：它内部是可交互的 option，
        // `accessible={true}` 会把整棵子树合并成一个无障碍节点（见 Collapse 的同款取舍）。
        // 代价就是 role 查不到 —— 这条断言把该限制钉住，将来 RNTL 放宽规则时会失败提醒。
        expect(queryByRole('list')).toBeNull();
        expect(queryByRole('listbox')).toBeNull();
    });

    it('option 节点带 role=option + aria-selected', async () => {
        const { getByTestId, getAllByRole } = await render(<Host initial="b" />);
        await fireEvent.press(getByTestId('s-trigger'));

        const opts = getAllByRole('option');
        expect(opts).toHaveLength(3);
        // ⚠️ `getAllByRole` 拿到的是**宿主节点**，而 Pressable 在 JS 里就把
        // `aria-selected` 转换成了 `accessibilityState.selected`
        //（与 `aria-expanded` → `accessibilityState.expanded` 同一机制）。
        // 真机上也是这个落点，所以这里断言 accessibilityState 与生产一致。
        expect(opts[1].props.accessibilityState).toMatchObject({ selected: true });
        expect(opts[0].props.accessibilityState).toMatchObject({ selected: false });
        // RNTL 直接按选中态查
        expect(getAllByRole('option', { selected: true })).toHaveLength(1);
    });

    it('aria-label 透传到 trigger 与面板', async () => {
        const { getByTestId, getByRole } = await render(
            <Select testID="s" options={options} value="" onChange={() => {}} aria-label="水果" />
        );
        expect(getByRole('combobox', { name: '水果' })).toBeTruthy();
        await fireEvent.press(getByTestId('s-trigger'));
        // 上游把 aria-label 同时给了 listbox，屏幕阅读器可读出名字
        expect(getByTestId('s-listbox').props['aria-label']).toBe('水果');
    });

    it('面板声明自己会吃掉触摸（防穿透到遮罩）', async () => {
        const { getByTestId } = await render(<Host />);
        await fireEvent.press(getByTestId('s-trigger'));
        const panel = getByTestId('s-listbox');
        // Web 版靠 `wrapper.contains(e.target)` 判断内外；RN 靠响应者系统，
        // 机制就是这个 prop。⚠️ 这条**不能**用 `fireEvent.press(panel)` 测：
        // RNTL 的事件是**向上**找 handler，而遮罩是面板的**兄弟**节点，
        // 所以无论有没有防穿透，那个断言都会通过（测出来是假象）。
        expect(child(panel).props.onStartShouldSetResponder?.()).toBe(true);
    });

    it('measureInWindow 不回调时，面板落在兜底位置（0, 0）', async () => {
        const { getByTestId } = await render(<Host />);
        await fireEvent.press(getByTestId('s-trigger'));
        // jest preset 把 measureInWindow mock 成永不回调的空实现，
        // 所以这里看到的就是 FALLBACK_PANEL_POSITION。
        // ⚠️ 这条**不能**证明真机上的定位正确 —— 真正的定位判断在 geometry.test.ts 里。
        expect(styleOf(getByTestId('s-listbox'))).toMatchObject({ top: 0, left: 0 });
    });

    it('当前选中项渲染 pillBar，未选中项不渲染', async () => {
        const { getByTestId } = await render(<Host initial="b" />);
        await fireEvent.press(getByTestId('s-trigger'));

        // 选中项：多一个 pillBar 子节点（pillBar + dot + Text = 3 个）
        expect(getByTestId('s-option-b').children).toHaveLength(3);
        expect(styleOf(child(getByTestId('s-option-b').children[0]))).toMatchObject({
            position: 'absolute',
            left: 20,
            right: 20,
            height: 14,
            borderRadius: 7,
            backgroundColor: '#ffcc00',
            opacity: 0.3,
        });
        // 未选中项：只有 dot + Text
        expect(getByTestId('s-option-a').children).toHaveLength(2);
    });

    it('选项 label 的加粗同时覆盖「选中」与「按下」（hover 的 RN 替代）', async () => {
        const { getByTestId } = await render(<Host initial="b" />);
        await fireEvent.press(getByTestId('s-trigger'));

        // .option.active { font-weight: 700 }
        expect(labelOf(getByTestId('s-option-b'))).toHaveStyle({ fontWeight: '700' });
        // .option { font-weight: 500 }
        expect(labelOf(getByTestId('s-option-a'))).toHaveStyle({ fontWeight: '500' });

        // `.option:hover { font-weight: 700 }` → RN 用 pressed
        await pressIn(getByTestId('s-option-a'));
        expect(labelOf(getByTestId('s-option-a'))).toHaveStyle({ fontWeight: '700' });

        // 没有「按下后又抬起」的断言：对选项来说 `responderRelease` 会把 press 走完
        // → 选中该项 → 面板关闭，节点随之卸载，抬起后的字重**观察不到**。
        // （`responderTerminate` 试过：Pressability 确实会 NOT_RESPONDER，
        //   但不会把 pressed 重置回去，实测仍是 700。）
        // 覆盖到的是两个真实分支：selected → 700、pressed → 700、两者皆否 → 500。
    });

    it('展开时 trigger 底色不变（上游 .trigger.open 与静止态同值）', async () => {
        const { getByTestId } = await render(<Host />);
        expect(styleOf(getByTestId('s-trigger')).backgroundColor).toBe('#fff');
        await fireEvent.press(getByTestId('s-trigger'));
        expect(styleOf(getByTestId('s-trigger')).backgroundColor).toBe('#fff');
    });

    it('箭头是装饰性元素（aria-hidden），展开时旋转 180 度', async () => {
        const { getByTestId } = await render(<Host />);
        // 默认查询查不到 → 反证 aria-hidden 生效
        expect(() => getByTestId('s-arrow')).toThrow();
        const arrow = getByTestId('s-arrow', { includeHiddenElements: true });
        expect(arrow.props['aria-hidden']).toBe(true);
        // 上游 `.arrow` 静止态**没有**声明 transform（只有 `.trigger.open .arrow` 才 rotate 180），
        // 所以收起时读不到 transform —— 照搬字面量，不补一个 rotate(0)。
        expect(styleOf(arrow).transform).toBeUndefined();

        await fireEvent.press(getByTestId('s-trigger'));
        expect(styleOf(getByTestId('s-arrow', { includeHiddenElements: true })).transform).toEqual([
            { rotate: '180deg' },
        ]);
    });

    it('options 为空时展开后是空面板', async () => {
        const { getByTestId, queryAllByRole } = await render(
            <Select testID="s" options={[]} value="" onChange={() => {}} />
        );
        await fireEvent.press(getByTestId('s-trigger'));
        expect(getByTestId('s-listbox')).toBeTruthy();
        expect(queryAllByRole('option')).toHaveLength(0);
    });

    it('style / testID 透传到最外层容器', async () => {
        const { getByTestId } = await render(
            <Select testID="s" options={options} value="" onChange={() => {}} style={{ marginTop: 4 }} />
        );
        // .wrapper { min-width: 140px } + 自定义 style
        expect(getByTestId('s')).toHaveStyle({ minWidth: 140, marginTop: 4 });
    });

    // ---------- RN 专有 ----------

    it('Android 返回键（Modal.onRequestClose）关闭面板，替代 Web 版的 Escape', async () => {
        const { getByTestId, queryByTestId, container } = await render(<Host />);
        await fireEvent.press(getByTestId('s-trigger'));
        expect(getByTestId('s-listbox')).toBeTruthy();

        // RNTL v14 没有 `UNSAFE_getByType`；`container` 是 TestInstance，
        // 用 `queryAll` 按 prop 定位 Modal 的宿主节点。
        const modals = container.queryAll((n) => typeof n.props.onRequestClose === 'function');
        expect(modals).toHaveLength(1);

        await act(async () => {
            modals[0].props.onRequestClose();
        });
        expect(queryByTestId('s-listbox')).toBeNull();
    });

    it('面板高度估算与 geometry 的 dropdownHeight 同源（选项数 × 44 + 24）', async () => {
        // 组件把 `options.length` 交给 computeDropdownPosition，后者用同一个算式；
        // 这条钉住「上游那个魔法数 44 / 24」在 RN 侧仍然只有一个出处。
        expect(dropdownHeight(options.length)).toBe(156);
    });
});
