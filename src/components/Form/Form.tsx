/**
 * Form —— React Native 版。
 *
 * 与上游 Web 版的差异：
 *
 * 1. **没有 `<form>`，也没有原生提交**。上游靠 `<form onSubmit>` 拦下原生提交再走校验；
 *    RN 既无 `<form>` 也无原生 submit 事件，更没有 `<button type="submit">`。
 *    → 容器改成 `View`，提交必须显式调 `form.submit()`（或 `form.validateFields()`）。
 *    `onFinish` / `onFinishFailed` 的触发时机与上游一致（校验后二选一）。
 * 2. **`onReset` 删除**（见 `types.ts` 的说明）：没有原生 reset 事件可挂。
 *    重置走 `form.resetFields()`。
 * 3. `useForm` / `validators` / `context` **与上游同文件同名**，只有 `scrollToField`
 *    一处改成了有文档的空操作（见 `useForm.ts`）。
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { FormContext, type FormContextValue } from './context';
import { useForm } from './useForm';
import { FormItem } from './FormItem';
import type { FormInstance, FormProps } from './types';

/** 布局间距，取自 `Form.module.less` 的局部变量 */
const FORM_ITEM_GAP = 8;
const INLINE_GAP = 8;
const HORIZONTAL_GAP = 16;

/** 尺寸 → label 字号（Less 的 `@label-font-size-*`） */
const LABEL_FONT_SIZE = { small: 12, middle: 14, large: 16 } as const;

/**
 * 表单容器。
 *
 * - 通过 `FormContext` 向 `Form.Item` 注入 form 实例与布局配置
 * - form 实例的 `onValuesChange` / `onFinish` / `onFinishFailed` 通过 ref 桥接，
 *   避免每次 props 变化重建实例
 */
function FormInner<T extends Record<string, unknown>>(props: FormProps<T>): React.ReactElement {
    const {
        form: formProp,
        initialValues,
        layout = 'horizontal',
        labelAlign = layout === 'horizontal' ? 'right' : 'left',
        labelCol,
        wrapperCol,
        size = 'middle',
        disabled = false,
        colon = true,
        requiredMark = false,
        onFinish,
        onFinishFailed,
        onValuesChange,
        children,
        style,
        testID,
    } = props;

    // 是否用户传入 form 实例
    const isControlledForm = formProp !== undefined;
    // 总是用 useForm 兜底创建，传入则复用
    const [defaultForm] = useForm<T>();
    const formInstance = (isControlledForm ? formProp : defaultForm) as FormInstance<T>;

    // 用 ref 锁定最新回调，避免 form 实例重新创建
    const callbacksRef = useRef({ onFinish, onFinishFailed, onValuesChange });
    useEffect(() => {
        callbacksRef.current = { onFinish, onFinishFailed, onValuesChange };
    }, [onFinish, onFinishFailed, onValuesChange]);

    // 把 ref 上的回调桥接到 form 实例的隐式订阅
    useEffect(() => {
        const formAny = formInstance as unknown as {
            __bindCallbacks?: (c: typeof callbacksRef.current) => void;
        };
        if (typeof formAny.__bindCallbacks === 'function') {
            formAny.__bindCallbacks(callbacksRef.current);
        }
    }, [formInstance, onFinish, onFinishFailed, onValuesChange]);

    // 注入初始值：仅当 initialValues 内容（深比较）真正变化时同步给 form，
    // 避免父组件因其它状态 re-render 时用新引用、同内容对象把用户输入清空。
    const lastInitialKeyRef = useRef<string | undefined>(undefined);
    useEffect(() => {
        if (!initialValues) return;
        const key = JSON.stringify(initialValues);
        if (key === lastInitialKeyRef.current) return;
        lastInitialKeyRef.current = key;
        formInstance.setFieldsValue(initialValues as T);
    }, [initialValues, formInstance]);

    const ctxValue = useMemo<FormContextValue>(
        () => ({
            form: formInstance as unknown as FormContextValue['form'],
            layout,
            labelAlign,
            labelCol,
            wrapperCol,
            size,
            disabled,
            colon,
            requiredMark,
            /** RN 专有：Form 的字号，供 FormItem 的 label 用 */
            labelFontSize: LABEL_FONT_SIZE[size],
            itemGap: FORM_ITEM_GAP,
            inlineGap: INLINE_GAP,
            horizontalGap: HORIZONTAL_GAP,
        }),
        [formInstance, layout, labelAlign, labelCol, wrapperCol, size, disabled, colon, requiredMark]
    );

    return (
        <FormContext.Provider value={ctxValue}>
            <View
                style={[
                    styles.form,
                    layout === 'horizontal' && styles.formHorizontal,
                    layout === 'vertical' && styles.formVertical,
                    layout === 'inline' && styles.formInline,
                    disabled && styles.formDisabled,
                    style,
                ]}
                testID={testID}
            >
                {children}
            </View>
        </FormContext.Provider>
    );
}

type FormComponent = ((props: FormProps<Record<string, unknown>>) => React.ReactElement) & {
    Item: typeof FormItem;
    useForm: typeof useForm;
    Provider: typeof FormProvider;
    displayName?: string;
};

/** 渲染容器的主组件（RN 没有 `<form>`，`forwardRef` 也就没有意义，故去掉） */
export const Form = FormInner as unknown as FormComponent;
Form.displayName = 'Form';

// ============================================
// 静态方法
// ============================================

/** 创建 form 实例（等价于 Form.useForm()） */
Form.useForm = useForm;

// ============================================
// Form.Provider：在表单树外层注入 form 实例，供嵌套组件读值
// ============================================

export interface FormProviderProps {
    form: FormInstance;
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    testID?: string;
}

function FormProviderInner({ form, children, style, testID }: FormProviderProps): React.ReactElement {
    const ctxValue = useMemo<FormContextValue>(
        () => ({
            form,
            layout: 'vertical',
            labelAlign: 'left',
            size: 'middle',
            disabled: false,
            colon: true,
            requiredMark: false,
            labelFontSize: LABEL_FONT_SIZE.middle,
            itemGap: FORM_ITEM_GAP,
            inlineGap: INLINE_GAP,
            horizontalGap: HORIZONTAL_GAP,
        }),
        [form]
    );
    return (
        <FormContext.Provider value={ctxValue}>
            <View style={[styles.form, styles.formVertical, style]} testID={testID}>
                {children}
            </View>
        </FormContext.Provider>
    );
}

const FormProvider = FormProviderInner as unknown as React.FC<FormProviderProps>;
FormProvider.displayName = 'FormProvider';

// 把 Form.Item 挂上
Form.Item = FormItem;
Form.Provider = FormProvider;

// 默认导出：方便 `import Form from './Form'` 后使用 Form.Item
export default Form;

const styles = StyleSheet.create({
    // `.island-form { margin: 0; padding: 0; color: rgba(0,0,0,0.85); font-size: 14px }`
    form: {
        margin: 0,
        padding: 0,
        gap: FORM_ITEM_GAP,
    },
    // `.island-form-horizontal { display: flex; flex-direction: column; gap: @form-item-gap }`
    formHorizontal: {
        display: 'flex',
        flexDirection: 'column',
    },
    // `.island-form-vertical { display: flex; flex-direction: column; gap: @form-item-gap }`
    formVertical: {
        display: 'flex',
        flexDirection: 'column',
    },
    // `.island-form-inline { display: flex; gap: @inline-gap }`
    formInline: {
        display: 'flex',
        flexDirection: 'row',
        gap: INLINE_GAP,
        flexWrap: 'wrap',
    },
    // `.island-form-disabled { opacity: 0.6 }`
    formDisabled: {
        opacity: 0.6,
    },
});
