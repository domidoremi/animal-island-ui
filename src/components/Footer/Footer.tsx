import React from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

export interface FooterProps {
    /** 版权文案，默认 `All Rights Reserved.` */
    text?: string;
    /** 年份，默认取当前年份（动态获取） */
    year?: number;
    /** 自定义样式（对应 Web 的 `className` + `style`） */
    style?: StyleProp<TextStyle>;
    /** 测试标识（RN 里 `className` 的对应物） */
    testID?: string;
}

/**
 * 版权栏。
 *
 * Web 版渲染的是语义化 `<footer>` 元素（`display: block` 的纯文本容器）。
 * RN 没有 `contentinfo` / `footer` 这类 role（`AccessibilityRole` 里没有对应值），
 * 所以根节点退化为 `<Text>`：
 *   - 文本样式（color / fontSize / textAlign）与 Web 一致，且都落在同一个宿主节点上，
 *     可以直接用 `testID` 断言；
 *   - `<Text>` 在默认的 column 父容器里 `alignItems: 'stretch'` 生效，
 *     宽度撑满父容器 —— 与 `<footer>` 的块级行为一致，所以 `textAlign: 'center'` 有效。
 *     ⚠️ 若父容器把 `alignItems` 改成 `center` / `flex-start`，`<Text>` 会收缩到内容宽度，
 *     居中随之失效（Web 的 `<footer>` 不受此影响）。这是 RN 无块级盒模型的必然差异。
 */
export const Footer: React.FC<FooterProps> = ({ text = 'All Rights Reserved.', year, style, testID }) => {
    const displayYear = year ?? new Date().getFullYear();
    return (
        <Text style={[styles.footer, style]} testID={testID}>
            © {displayYear} {text}
        </Text>
    );
};

Footer.displayName = 'Footer';

/**
 * 对应 Web 的 `.footer`。
 *
 * ⚠️ `footer.module.less` 里这三个值**全是硬编码**，没有引用任何 Less 变量
 * （`color: #807d75` 不是 `@text-color-secondary: #9f927d`；
 *  `font-size: 12px` 没写 `@font-size-sm`；`padding: 16px 0` 没写 `@spacing-lg`）。
 * 按「Less 硬编码就照搬硬编码值」的约定，这里**不使用 `src/theme/tokens.ts`**，
 * 原样镜像 Less 的字面量。
 */
const styles = StyleSheet.create({
    footer: {
        color: '#807d75', // .footer { color: #807d75 }
        fontSize: 12, // .footer { font-size: 12px }
        paddingVertical: 16, // .footer { padding: 16px 0 }
        paddingHorizontal: 0,
        textAlign: 'center', // .footer { text-align: center }
    },
});
