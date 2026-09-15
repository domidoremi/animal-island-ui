import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Footer } from './Footer';
import styles from './footer.module.less';

const thisYear = new Date().getFullYear();

describe('Footer', () => {
    it('默认渲染版权栏（当前年份 + 默认文案）', () => {
        const { container } = render(<Footer />);
        const root = container.firstChild as HTMLElement;
        expect(root).toBeInTheDocument();
        expect(root).toHaveTextContent(`© ${thisYear} All Rights Reserved.`);
    });

    it('text 可自定义文案', () => {
        const { container } = render(<Footer text="Pocket Projects Inc." />);
        expect(container.firstChild).toHaveTextContent(`© ${thisYear} Pocket Projects Inc.`);
    });

    it('year 可自定义年份', () => {
        const { container } = render(<Footer text="Acme" year={2020} />);
        expect(container.firstChild).toHaveTextContent('© 2020 Acme');
    });

    it('默认样式：颜色 #807d75、12px、padding 16px 0、居中', () => {
        const { container } = render(<Footer />);
        const root = container.firstChild as HTMLElement;
        expect(root).toHaveStyle({
            color: '#807d75',
            'font-size': '12px',
            padding: '16px 0',
        });
    });

    it('应用 className 与 style', () => {
        const { container } = render(<Footer className="x" style={{ fontSize: 14 }} />);
        const root = container.firstChild as HTMLElement;
        expect(root).toHaveClass('x');
        expect(root).toHaveStyle({ fontSize: '14px' });
    });

    it('语义化 footer 元素', () => {
        const { container } = render(<Footer />);
        expect(container.firstChild?.nodeName).toBe('FOOTER');
        expect(container.firstChild).toHaveClass(styles.footer);
    });
});
