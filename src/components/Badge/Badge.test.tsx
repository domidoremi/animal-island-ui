import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge, BadgeColor } from './Badge';
import styles from './badge.module.less';

const queryIndicator = (container: HTMLElement) => container.querySelector('sup') as HTMLElement | null;

describe('Badge', () => {
    describe('rendering', () => {
        it('渲染 count 数字', () => {
            render(<Badge count={5} />);
            expect(screen.getByText('5')).toBeInTheDocument();
        });

        it('包裹 children 并叠加角标', () => {
            const { container } = render(
                <Badge count={5}>
                    <span>头像</span>
                </Badge>
            );
            const root = container.firstChild as HTMLElement;
            expect(root).toHaveClass(styles.badge);
            expect(root).not.toHaveClass(styles.standalone);
            expect(screen.getByText('头像')).toBeInTheDocument();
            expect(screen.getByText('5')).toBeInTheDocument();
        });

        it('默认应用 medium 尺寸与 app-red 颜色', () => {
            const { container } = render(<Badge count={5} />);
            const sup = queryIndicator(container) as HTMLElement;
            expect(sup).toHaveClass(styles['size-medium']);
            expect(sup).toHaveClass(styles['color-app-red']);
        });

        it('渲染为 sup 元素，便于附着在被包裹元素右上角', () => {
            const { container } = render(<Badge count={5} />);
            expect(container.querySelector('sup')).toBeInTheDocument();
        });

        it('支持 className 与 style', () => {
            const { container } = render(<Badge count={1} className="x" style={{ marginLeft: 4 }} />);
            const root = container.firstChild as HTMLElement;
            expect(root).toHaveClass('x');
            expect(root).toHaveStyle({ marginLeft: '4px' });
        });

        it('透传原生属性', () => {
            const { container } = render(<Badge count={1} aria-label="未读消息" />);
            expect(container.firstChild).toHaveAttribute('aria-label', '未读消息');
        });
    });

    describe('count 显隐', () => {
        it('不传 count 时不渲染角标', () => {
            const { container } = render(
                <Badge>
                    <span>头像</span>
                </Badge>
            );
            expect(queryIndicator(container)).toBeNull();
        });

        it('count 为 0 时默认隐藏', () => {
            const { container } = render(<Badge count={0} />);
            expect(queryIndicator(container)).toBeNull();
        });

        it('count 为 0 且 showZero 时展示', () => {
            render(<Badge count={0} showZero />);
            expect(screen.getByText('0')).toBeInTheDocument();
        });

        it('字符串 "0" 同样按零值处理', () => {
            const { container } = render(<Badge count="0" />);
            expect(queryIndicator(container)).toBeNull();
        });

        it('空字符串 count 不渲染角标', () => {
            const { container } = render(
                <Badge count="">
                    <span>头像</span>
                </Badge>
            );
            expect(queryIndicator(container)).toBeNull();
        });

        it('纯空白字符串 count 不渲染角标', () => {
            const { container } = render(
                <Badge count="   ">
                    <span>头像</span>
                </Badge>
            );
            expect(queryIndicator(container)).toBeNull();
        });

        it('空字符串 count 在 dot 模式下仍展示小圆点', () => {
            const { container } = render(
                <Badge count="" dot>
                    <span>头像</span>
                </Badge>
            );
            expect(queryIndicator(container)).toHaveClass(styles.dot);
        });

        it('支持 ReactNode 作为 count', () => {
            render(
                <Badge count={<span data-testid="icon">icon</span>}>
                    <span>头像</span>
                </Badge>
            );
            expect(screen.getByTestId('icon')).toBeInTheDocument();
        });

        it('原生 title 展示真实数值', () => {
            const { container } = render(<Badge count={1000} />);
            expect(queryIndicator(container)).toHaveAttribute('title', '1000');
        });

        it('显式传入 title 时优先使用', () => {
            const { container } = render(<Badge count={1000} title="未读 1000 条" />);
            expect(queryIndicator(container)).toHaveAttribute('title', '未读 1000 条');
        });
    });

    describe('overflowCount', () => {
        it('默认超过 99 显示 99+', () => {
            render(<Badge count={100} />);
            expect(screen.getByText('99+')).toBeInTheDocument();
        });

        it('count 等于 99 时不封顶', () => {
            render(<Badge count={99} />);
            expect(screen.getByText('99')).toBeInTheDocument();
        });

        it('自定义 overflowCount', () => {
            render(<Badge count={99} overflowCount={10} />);
            expect(screen.getByText('10+')).toBeInTheDocument();
        });

        it('数字字符串参与封顶换算', () => {
            render(<Badge count="1000" overflowCount={999} />);
            expect(screen.getByText('999+')).toBeInTheDocument();
        });

        it('ReactNode 内容原样展示，不参与封顶', () => {
            render(<Badge count={<span data-testid="icon">icon</span>} overflowCount={1} />);
            expect(screen.getByTestId('icon')).toBeInTheDocument();
        });
    });

    describe('dot', () => {
        it('dot 只渲染小圆点，不渲染数字', () => {
            const { container } = render(
                <Badge count={5} dot>
                    <span>头像</span>
                </Badge>
            );
            const sup = queryIndicator(container) as HTMLElement;
            expect(sup).toHaveClass(styles.dot);
            expect(sup).toBeEmptyDOMElement();
        });

        it('dot 未传 count 时也展示', () => {
            const { container } = render(
                <Badge dot>
                    <span>头像</span>
                </Badge>
            );
            expect(queryIndicator(container)).toHaveClass(styles.dot);
        });

        it('dot 且 count 为 0 时隐藏', () => {
            const { container } = render(
                <Badge dot count={0}>
                    <span>头像</span>
                </Badge>
            );
            expect(queryIndicator(container)).toBeNull();
        });

        it('dot 时不设置 title', () => {
            const { container } = render(
                <Badge dot count={5}>
                    <span>头像</span>
                </Badge>
            );
            expect(queryIndicator(container)).not.toHaveAttribute('title');
        });
    });

    describe('size', () => {
        it('size=small 应用对应类', () => {
            const { container } = render(<Badge count={5} size="small" />);
            expect(queryIndicator(container)).toHaveClass(styles['size-small']);
        });

        it('size=medium 应用对应类', () => {
            const { container } = render(<Badge count={5} size="medium" />);
            expect(queryIndicator(container)).toHaveClass(styles['size-medium']);
        });
    });

    describe('color', () => {
        const COLORS: BadgeColor[] = [
            'app-red',
            'app-pink',
            'app-orange',
            'app-yellow',
            'app-teal',
            'app-green',
            'app-blue',
            'purple',
            'lime-green',
            'yellow-green',
            'brown',
            'warm-peach-pink',
        ];

        it.each(COLORS)('color=%s 应用对应类', (color) => {
            const { container } = render(<Badge count={5} color={color} />);
            expect(queryIndicator(container)).toHaveClass(styles[`color-${color}`]);
        });
    });

    describe('独立使用', () => {
        it('未传 children 时应用 standalone 类', () => {
            const { container } = render(<Badge count={11} />);
            expect(container.firstChild).toHaveClass(styles.standalone);
        });

        it('传入 children 时不应用 standalone 类', () => {
            const { container } = render(
                <Badge count={11}>
                    <span>头像</span>
                </Badge>
            );
            expect(container.firstChild).not.toHaveClass(styles.standalone);
        });
    });
});
