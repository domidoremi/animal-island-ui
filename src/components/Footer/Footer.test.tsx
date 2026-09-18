import React from 'react';
import { render } from '@testing-library/react-native';
import { Footer } from './Footer';

/**
 * RN 版测试，对应 Web 版 `Footer.test.tsx` 的 6 个用例。
 *
 * **被丢弃的 Web 用例及原因**：
 *   - 「语义化 footer 元素」（`nodeName === 'FOOTER'`）—— RN 没有块级元素语义，
 *     `AccessibilityRole` 里也没有 `contentinfo` / `footer`，无法断言「这是个 footer」。
 *     替代用例：断言根宿主节点是 `Text`（组件文档里说明了这一降级）。
 *   - 「应用 className」—— RN 无 className（`style` 部分保留）。
 *   - 样式断言里的 `padding: '16px 0'` —— RN 没有 `padding` 简写，
 *     拆成 `paddingVertical` / `paddingHorizontal` 两条断言，覆盖等价。
 *
 * RNTL v14 的 `render` 是**异步**的（React 19 的 async act），所有用例都要 `await`。
 */
const thisYear = new Date().getFullYear();

describe('Footer', () => {
    it('默认渲染版权栏（当前年份 + 默认文案）', async () => {
        const { getByText } = await render(<Footer />);
        expect(getByText(`© ${thisYear} All Rights Reserved.`)).toBeTruthy();
    });

    it('text 可自定义文案', async () => {
        const { getByText } = await render(<Footer text="Pocket Projects Inc." />);
        expect(getByText(`© ${thisYear} Pocket Projects Inc.`)).toBeTruthy();
    });

    it('year 可自定义年份', async () => {
        const { getByText } = await render(<Footer text="Acme" year={2020} />);
        expect(getByText('© 2020 Acme')).toBeTruthy();
    });

    it('默认样式：颜色 #807d75、12px、padding 16px 0、居中', async () => {
        const { getByTestId } = await render(<Footer testID="f" />);
        expect(getByTestId('f')).toHaveStyle({
            color: '#807d75',
            fontSize: 12,
            paddingVertical: 16,
            paddingHorizontal: 0,
            textAlign: 'center',
        });
    });

    it('应用 style（后置覆盖默认样式）', async () => {
        const { getByTestId } = await render(<Footer testID="f" style={{ fontSize: 14, marginTop: 4 }} />);
        const root = getByTestId('f');
        expect(root).toHaveStyle({ fontSize: 14, marginTop: 4 });
        // 未被覆盖的默认值仍在
        expect(root).toHaveStyle({ color: '#807d75' });
    });

    it('根宿主节点是 Text（RN 无 footer 语义，见组件注释）', async () => {
        const { getByTestId } = await render(<Footer testID="f" />);
        expect(getByTestId('f').type).toBe('Text');
    });

    it('testID 透传', async () => {
        const { getByTestId } = await render(<Footer testID="f" />);
        expect(getByTestId('f')).toBeTruthy();
    });

    it('未传 year 时**渲染时**动态取当前年份（不是模块加载时定死的常量）', async () => {
        jest.useFakeTimers();
        try {
            jest.setSystemTime(new Date('2011-06-08T09:30:00'));
            const { getByText } = await render(<Footer text="Acme" />);
            expect(getByText('© 2011 Acme')).toBeTruthy();
        } finally {
            jest.useRealTimers();
        }
    });

    it('文案拼接与 Web 一致：`© 年份 文案`（空格不被吞掉）', async () => {
        const { getByTestId, getByText } = await render(<Footer text="Acme" year={2020} testID="f" />);
        const root = getByTestId('f');
        // JSX 的 `© {year} {text}` 在宿主侧是 4 个子节点，拼起来恰好是 '© 2020 Acme'。
        // 这条断言的是 Web 版用 `toHaveTextContent('© 2020 Acme')` 覆盖的同一件事。
        expect(root.children).toHaveLength(4);
        expect(getByText('© 2020 Acme')).toBeTruthy();
    });
});
