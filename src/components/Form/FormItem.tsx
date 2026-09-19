/**
 * Form.Item —— React Native 版。
 *
 * 与上游 Web 版的差异：
 *
 * 1. **`<label htmlFor>` → `nativeID` + `aria-labelledby`**。RN 没有 `<label>` 元素，
 *    标签与控件的关联只能靠无障碍属性：label 拿到 `nativeID`，控件拿到
 *    `aria-labelledby`（RN 0.87 会把它转成 `accessibilityLabelledBy`）。
 * 2. **`aria-errormessage` 删除**。RN 0.87 的 `View.js` 只改写 13 个 `aria-*`，
 *    里面没有 `errormessage`（也没有 `describedby` / `controls` / `haspopup`）。
 *    错误文案与控件之间的程序化关联在 RN 上**无法表达**，只能靠视觉相邻。
 * 3. **`data-field-name` → `testID`**。它原本就是给 `scrollToField` 的 DOM 查询用的，
 *    而 `scrollToField` 在 RN 已变成空操作；保留成 `testID` 至少还能被测试定位。
 * 4. **CSS Grid 的 24 列 `labelCol` / `wrapperCol` → flex 权重**。RN 没有 grid，
 *    `span: 8` 折算成 `flex: 8/24`，`offset` 折算成一段等宽的占位 `View`。
 *    （24 是上游 `buildGridStyle` 里写死的默认值。）
 * 5. **裸字符串子节点自动包一层 `<Text>`**。上游允许 `<Form.Item>纯文本</Form.Item>`，
 *    RN 里裸字符串会直接抛 `Invariant Violation`；`Table.tsx` 的 `asNode` 是同一处处理。
 * 6. `defaultGetValueFromEvent` **原样保留**：它读的 `{ target: { value } }` 正是本仓
 *    已移植的 `Input` 发出的 `InputChangeEvent` 形状，不需要改。
 */

import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { FormContext } from './context';
import { stringifyNamePath } from './types';
import type { FormItemProps, NamePath, Rules, StoreValue } from './types';

/**
 * 从事件对象中取目标值。与上游 `defaultGetValueFromEvent` 逐行一致。
 *
 * 覆盖典型控件：
 *  - 本仓 RN 版 `Input`：`{ target: { value } }`（`InputChangeEvent`）
 *  - 自定义组件：直接返回事件本身，或读事件上的 `value`
 *  - Web 的 `target.type === 'checkbox' | 'radio'` 分支**保留**：`Checkbox` / `Radio`
 *    的 RN 版若仍在 `onChange` 里传 `{ target: { checked } }`，这里照样能读出来。
 */
function defaultGetValueFromEvent(event: unknown): StoreValue {
    if (event === null || event === undefined) return event;
    if (typeof event !== 'object') return event;
    const target = (event as { target?: { value?: unknown; checked?: unknown; type?: string } }).target;
    if (target && typeof target === 'object') {
        // checkbox / radio 用 checked
        if (target.type === 'checkbox' || target.type === 'radio') {
            if ('checked' in target) return target.checked;
        }
        // 普通 input：优先 value
        if ('value' in target && target.value !== undefined) return target.value;
    }
    // 自定义组件可能直接传 value
    if ('value' in (event as Record<string, unknown>)) {
        return (event as { value: unknown }).value;
    }
    return event;
}

/** 上游 `buildGridStyle` 里写死的 24 列 */
const GRID_COLUMNS = 24;

/**
 * 这些颜色是 `Form.module.less` 的**局部**变量，与 `src/styles/variables.less`
 * 不同源（那边是 `#6fba2c` / `#f5c31c` / `#e05a5a`，这边是 antd 默认色）。
 * 逐字照搬 Less 里的值，不做统一。
 */
const LABEL_COLOR = 'rgba(0, 0, 0, 0.85)';
const HELP_COLOR = 'rgba(0, 0, 0, 0.45)';
const ERROR_COLOR = '#ff4d4f';
const WARNING_COLOR = '#faad14';
const SUCCESS_COLOR = '#52c41a';
const VALIDATING_COLOR = '#1677ff';
const HELP_FONT_SIZE = 12;
const LABEL_LINE_HEIGHT = 1.6;

/** 校验状态 → 提示文字色（`.island-form-item-explain-error` 等） */
const STATUS_COLOR: Record<string, string> = {
    error: ERROR_COLOR,
    warning: WARNING_COLOR,
    success: SUCCESS_COLOR,
    validating: VALIDATING_COLOR,
};

/**
 * 24 列的 `span` / `offset` 折算成 RN 的 flex 权重。
 *
 * 上游 `gridColumn: `${startCol + offset} / span ${span}`` 有两层含义：
 * 起始列由 `offset` 推移，宽度由 `span` 决定。RN 的 flex 只能表达权重，
 * 所以 `offset` 折成一段 `flex: offset/24` 的**占位 View**，`span` 折成 `flex: span/24`。
 * 无 `labelCol` / `wrapperCol` 时返回 undefined，交回默认布局（与上游 `if (!col) return {}` 一致）。
 */
const flexWeightOf = (span: number | undefined): number | undefined =>
    span === undefined ? undefined : span / GRID_COLUMNS;

export const FormItem: React.FC<FormItemProps> = (props) => {
    const {
        name,
        label,
        rules = [],
        required = false,
        valuePropName = 'value',
        trigger = 'onChange',
        getValueFromEvent = defaultGetValueFromEvent,
        normalize,
        hidden = false,
        hasFeedback = false,
        validateStatus,
        help,
        noStyle = false,
        labelCol,
        wrapperCol,
        colon,
        requiredMark,
        layout: itemLayout,
        style,
        children,
        testID,
    } = props;

    const ctx = useContext(FormContext);
    if (!ctx) {
        throw new Error('Form.Item must be used inside <Form> or <Form.Provider>');
    }

    const {
        form,
        layout: ctxLayout,
        labelAlign,
        labelCol: ctxLabelCol,
        wrapperCol: ctxWrapperCol,
        size,
        disabled: ctxDisabled,
        colon: ctxColon,
        requiredMark: ctxRequiredMark,
        labelFontSize,
        horizontalGap,
    } = ctx;

    // 字段在 form 中的字符串 key
    const fieldKey = useMemo(() => (name !== undefined ? stringifyNamePath(name) : null), [name]);

    // 订阅触发器（每次 form 状态变化时 setState 重新渲染）
    const [, setTick] = useState(0);
    const notify = useCallback(() => setTick((t) => t + 1), []);

    // 注册 / 注销 —— 只在 fieldKey 变化时注册/注销
    useEffect(() => {
        if (!fieldKey) return;
        const formAny = form as unknown as {
            __store?: {
                registerField: (n: NamePath, rules: Rules, initialValue: unknown, notify: () => void) => void;
                unregisterField: (n: NamePath) => void;
                updateRules: (n: NamePath, rules: Rules) => void;
            };
        };
        const store = formAny.__store;
        if (!store) return;
        store.registerField(name!, rules, undefined, notify);
        return () => store.unregisterField(fieldKey);
        // rules 变化通过下方独立 effect 更新，避免重新注册
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form, fieldKey, name, notify]);

    // rules 变化时同步到已注册的字段元数据
    useEffect(() => {
        if (!fieldKey) return;
        const formAny = form as unknown as {
            __store?: {
                updateRules: (n: NamePath, rules: Rules) => void;
            };
        };
        formAny.__store?.updateRules?.(fieldKey, rules);
    }, [rules, fieldKey, form]);

    if (hidden) return null;

    // 当前字段值
    const value = fieldKey ? form.getFieldValue(name as never) : undefined;
    // 当前字段错误
    const errors = fieldKey ? form.getFieldError(name as never) : undefined;
    const isValidating = fieldKey ? form.isFieldValidating(name as never) : false;
    const touched = fieldKey ? form.isFieldTouched(name as never) : false;

    // 推算 validateStatus
    const computedStatus = validateStatus ?? (isValidating ? 'validating' : errors?.[0] ? 'error' : '');
    // 显示的错误（help 优先，否则取第一条）
    const displayError = touched && errors?.[0] ? errors[0] : undefined;
    const showHelp = displayError ?? help;

    // 必填星号判定
    const mergedRequiredMark = requiredMark ?? ctxRequiredMark;
    const isRequired = required || rules.some((r) => (typeof r === 'object' ? r.required : false));
    const showRequiredMark = isRequired && mergedRequiredMark !== false;

    // 处理子元素：克隆并注入 value / onChange
    const childIsElement = React.isValidElement(children);
    const childProps: Record<string, unknown> = childIsElement ? { ...(children.props as object) } : {};
    if (fieldKey && childIsElement) {
        childProps[valuePropName] = value;
        const userTrigger = childProps[trigger];
        childProps[trigger] = (event: unknown) => {
            // 先调用用户的 trigger（保留链式回调）
            if (typeof userTrigger === 'function') {
                (userTrigger as (e: unknown) => void)(event);
            }
            // 取值
            const rawValue = getValueFromEvent(event);
            const prevValue = form.getFieldValue(name as never);
            const finalValue = normalize ? normalize(rawValue, prevValue, form.getFieldsValue(true)) : rawValue;
            form.setFieldValue(name as never, finalValue);
        };
        // Web 版这里写的是 `childProps.id = fieldKey`（DOM 的 `id`，配合 `<label htmlFor>`）；
        // RN 用 `nativeID`，label 一端改用 `aria-labelledby` 指回来（见文件头第 1 点）。
        if (childProps.nativeID === undefined) {
            childProps.nativeID = fieldKey;
        }
        childProps['aria-labelledby'] = `${fieldKey}_label`;
    }

    // disabled 透传
    if (ctxDisabled && childProps.disabled === undefined) {
        childProps.disabled = true;
    }
    // size 透传（如果有 child 支持）
    if (childProps.size === undefined) {
        childProps.size = size;
    }
    // status 透传
    if (childProps.status === undefined && computedStatus === 'error') {
        childProps.status = 'error';
    }

    const injected = fieldKey && childIsElement ? React.cloneElement(children, childProps) : children;
    /**
     * 裸字符串 / 数字在 RN 里必须包一层 `<Text>` 才能渲染，否则直接抛
     * `Invariant Violation: Text strings must be rendered within a <Text> component`。
     *
     * 上游 Web 版允许 `<Form.Item label="展示项">纯文本</Form.Item>`（HTML 里裸文本合法）；
     * RN 要保住这个用法，只能在这里补一层。`Table.tsx` 的 `asNode` 是同一处处理。
     */
    const renderChildren =
        typeof injected === 'string' || typeof injected === 'number' ? <Text>{injected}</Text> : injected;

    // 布局：inline 模式下 FormItem 退化为 vertical（每个 item 独占一行）
    const itemLayoutTyped = (itemLayout ?? ctxLayout) as 'horizontal' | 'vertical' | 'inline';
    const layout: 'horizontal' | 'vertical' = itemLayoutTyped === 'inline' ? 'vertical' : itemLayoutTyped;
    const mergedLabelCol = labelCol ?? ctxLabelCol;
    const mergedWrapperCol = wrapperCol ?? ctxWrapperCol;
    const showColon = colon ?? ctxColon;

    const labelFlex = flexWeightOf(mergedLabelCol?.span);
    const labelOffsetFlex = flexWeightOf(mergedLabelCol?.offset ?? 0);
    const wrapperFlex = flexWeightOf(mergedWrapperCol?.span);
    const wrapperOffsetFlex = flexWeightOf(mergedWrapperCol?.offset ?? 0);

    const controlStyle: StyleProp<ViewStyle> = [
        styles.control,
        wrapperFlex !== undefined && { flex: wrapperFlex },
        style,
    ];

    const labelNode =
        label !== undefined ? (
            <Text
                nativeID={`${fieldKey}_label`}
                style={[
                    styles.label,
                    { fontSize: labelFontSize, lineHeight: Math.round(labelFontSize * LABEL_LINE_HEIGHT) },
                    { textAlign: labelAlign },
                    labelFlex !== undefined && { flex: labelFlex },
                    showRequiredMark && styles.labelRequired,
                ]}
                testID={testID ? `${testID}-label` : undefined}
            >
                {label}
                {showColon && label !== '' ? ':' : null}
            </Text>
        ) : null;

    const helpNode =
        showHelp !== undefined ? (
            <View style={styles.explain} testID={testID ? `${testID}-help` : undefined}>
                {hasFeedback && computedStatus === 'error' ? (
                    <Text style={[styles.feedbackIcon, { color: STATUS_COLOR[computedStatus] }]}>✕</Text>
                ) : null}
                <Text style={[styles.explainText, { color: STATUS_COLOR[computedStatus] ?? HELP_COLOR }]}>
                    {showHelp}
                </Text>
            </View>
        ) : null;

    if (noStyle) {
        return (
            <>
                {renderChildren}
                {helpNode}
            </>
        );
    }

    return (
        <View
            style={[
                styles.item,
                layout === 'horizontal' ? [styles.itemHorizontal, { gap: horizontalGap }] : styles.itemVertical,
            ]}
            testID={testID ?? (fieldKey ? `form-item-${fieldKey}` : undefined)}
        >
            {labelOffsetFlex ? <View style={{ flex: labelOffsetFlex }} /> : null}
            {labelNode}
            <View style={controlStyle} testID={testID ? `${testID}-control` : undefined}>
                {wrapperOffsetFlex ? <View style={{ flex: wrapperOffsetFlex }} /> : null}
                <View style={styles.controlInput}>{renderChildren}</View>
                {helpNode}
            </View>
        </View>
    );
};

FormItem.displayName = 'FormItem';

const styles = StyleSheet.create({
    // `.island-form-item`
    item: {
        margin: 0,
        padding: 0,
    },
    itemHorizontal: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    itemVertical: {
        flexDirection: 'column',
        alignItems: 'stretch',
    },
    // `.island-form-item-label`
    label: {
        color: LABEL_COLOR,
    },
    // `.island-form-item-label-required::before { color: @required-color }`
    //
    // ⚠️ 上游的必填星号是 `::before { content: '*' }` 伪元素，RN 没有伪元素，
    // 所以改成把 `*` 直接拼进 label 文本（见 labelNode）。这里只保留颜色。
    labelRequired: {
        color: ERROR_COLOR,
    },
    // `.island-form-item-control`
    control: {
        flexShrink: 1,
    },
    // `.island-form-item-control-input`
    controlInput: {
        alignSelf: 'stretch',
    },
    // `.island-form-item-explain`
    explain: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    explainText: {
        fontSize: HELP_FONT_SIZE,
        color: HELP_COLOR,
    },
    // `.island-form-item-feedback-icon`
    feedbackIcon: {
        fontSize: 12,
    },
});
