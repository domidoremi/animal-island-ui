import { createContext } from 'react';
import type { ColProps, FormInstance, FormLabelAlign, FormLayout, FormSize, RequiredMark } from './types';

export interface FormContextValue {
    /** Form 实例（提供注册、校验、命令式 API） */
    form: FormInstance;
    /**
     * ⚠️ Web 版这里还有一个 `prefixCls: string`，FormItem 用它拼 CSS class
     * （`island-form-item-error` / `island-form-item-required` …）。
     * RN 没有 class，样式是内联的，这个字段在 RN 侧**没有任何读者**，故删除
     * 而不是留成死字段。
     */
    /** 布局方向 */
    layout: FormLayout;
    /** label 对齐 */
    labelAlign: FormLabelAlign;
    /** label 网格 */
    labelCol?: ColProps;
    /** wrapper 网格 */
    wrapperCol?: ColProps;
    /** 全局尺寸 */
    size: FormSize;
    /** 全局禁用 */
    disabled: boolean;
    /** 是否显示冒号 */
    colon: boolean;
    /** 必填星号策略 */
    requiredMark: RequiredMark;
    /**
     * RN 专有：label 的字号。
     *
     * Web 版靠 CSS 层叠 `.island-form-small .island-form-item-label { font-size: 12px }`
     * 让 Form 的 `size` 影响后代；RN 没有 CSS 层叠，只能由 Form 把算好的值放进 context。
     */
    labelFontSize: number;
    /** RN 专有：Form 的 item 间距（对应 `@form-item-gap`） */
    itemGap: number;
    /** RN 专有：inline 布局的间距（对应 `@inline-gap`） */
    inlineGap: number;
    /** RN 专有：horizontal 布局 label 与控件的间距（对应 `@horizontal-gap`） */
    horizontalGap: number;
}

export const FormContext = createContext<FormContextValue | null>(null);
