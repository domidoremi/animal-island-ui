import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Progress } from './Progress';
import styles from './progress.module.less';

describe('Progress', () => {
    describe('rendering', () => {
        it('renders with role=progressbar and clamps percent', () => {
            render(<Progress percent={-10} />);
            const bar = screen.getByRole('progressbar');
            expect(bar).toBeInTheDocument();
            expect(bar).toHaveAttribute('aria-valuemin', '0');
            expect(bar).toHaveAttribute('aria-valuemax', '100');
            // -10 should be clamped to 0
            expect(bar).toHaveAttribute('aria-valuenow', '0');
        });

        it('clamps percent above 100 down to 100', () => {
            render(<Progress percent={150} />);
            const bar = screen.getByRole('progressbar');
            expect(bar).toHaveAttribute('aria-valuenow', '100');
        });

        it('rounds non-integer percent for aria-valuenow', () => {
            render(<Progress percent={33.7} />);
            const bar = screen.getByRole('progressbar');
            expect(bar).toHaveAttribute('aria-valuenow', '34');
        });

        it('uses percent=0 as default safe value when given NaN', () => {
            render(<Progress percent={Number.NaN} />);
            const bar = screen.getByRole('progressbar');
            expect(bar).toHaveAttribute('aria-valuenow', '0');
        });

        it('forwards className and style', () => {
            const { container } = render(<Progress percent={50} className="custom-class" style={{ width: 320 }} />);
            const root = container.firstChild as HTMLElement;
            expect(root).toHaveClass('custom-class');
            expect(root).toHaveStyle({ width: '320px' });
        });

        it('forwards aria-label and aria-labelledby to progressbar role (a11y)', () => {
            const { rerender } = render(<Progress percent={50} aria-label="任务进度" />);
            const bar = screen.getByRole('progressbar');
            // jest-dom v6: 显式 role 透传校验
            expect(bar).toHaveRole('progressbar');
            expect(bar).toHaveAttribute('aria-label', '任务进度');
            rerender(<Progress percent={50} aria-labelledby="external-title-id" />);
            expect(screen.getByRole('progressbar')).toHaveAttribute('aria-labelledby', 'external-title-id');
        });
    });

    describe('info text', () => {
        it('default shows percent with % suffix', () => {
            render(<Progress percent={42} />);
            expect(screen.getByText('42%')).toBeInTheDocument();
        });

        it('showInfo=false hides percent text', () => {
            const { container } = render(<Progress percent={50} showInfo={false} />);
            expect(container.textContent).not.toMatch(/\d+%/);
        });

        it('infoFormat receives percent and renders custom node', () => {
            render(<Progress percent={7} infoFormat={(p) => `${Math.round(p)}/10`} />);
            expect(screen.getByText('7/10')).toBeInTheDocument();
        });
    });

    describe('size', () => {
        it('size=small applies size-small class to track', () => {
            const { container } = render(<Progress percent={50} size="small" />);
            expect(container.querySelector(`.${styles['size-small']}`)).toBeInTheDocument();
        });

        it('size=middle applies size-middle class to track (default)', () => {
            const { container } = render(<Progress percent={50} />);
            expect(container.querySelector(`.${styles['size-middle']}`)).toBeInTheDocument();
        });

        it('size=large applies size-large class to track', () => {
            const { container } = render(<Progress percent={50} size="large" />);
            expect(container.querySelector(`.${styles['size-large']}`)).toBeInTheDocument();
        });
    });

    describe('animation', () => {
        it('duration=0 applies noTransition class to fill', () => {
            const { container } = render(<Progress percent={50} duration={0} />);
            expect(container.querySelector(`.${styles.noTransition}`)).toBeInTheDocument();
        });

        it('duration applies as transition-duration style on fill', () => {
            const { container } = render(<Progress percent={50} duration={1.2} />);
            const fillEl = container.querySelector(`.${styles.fill}`) as HTMLElement;
            expect(fillEl).toBeInTheDocument();
            expect(fillEl.style.transitionDuration).toBe('1.2s');
        });

        it('default fill carries the fill class (CSS-defined)', () => {
            const { container } = render(<Progress percent={50} />);
            const fillEl = container.querySelector(`.${styles.fill}`) as HTMLElement;
            expect(fillEl).toBeInTheDocument();
            expect(fillEl.className).toContain(styles.fill);
        });
    });

    describe('fill width', () => {
        it('translates percent to fill width via inline style', () => {
            const { container } = render(<Progress percent={42} />);
            const fillEl = container.querySelector(`.${styles.fill}`) as HTMLElement;
            expect(fillEl.style.width).toBe('42%');
        });
    });

    describe('info position (right)', () => {
        it('renders percent text after the track (right of the bar)', () => {
            const { container } = render(<Progress percent={50} />);
            const row = container.querySelector(`.${styles.row}`) as HTMLElement;
            expect(row).toBeInTheDocument();
            const info = row.querySelector(`.${styles.right}`) as HTMLElement;
            expect(info).toBeInTheDocument();
            expect(info.textContent).toBe('50%');
            // The track and the label are siblings inside the row
            const track = row.querySelector(`.${styles.track}`);
            expect(track).toBeInTheDocument();
        });
    });
});
