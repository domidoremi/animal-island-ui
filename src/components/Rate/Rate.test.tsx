import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Rate, type RateProps } from './Rate';
import styles from './rate.module.less';

const setup = (props: Partial<RateProps> = {}) => {
    const onChange = vi.fn();
    const utils = render(<Rate onChange={onChange} {...props} />);
    const getInputs = () => screen.getAllByRole('radio') as HTMLInputElement[];
    /** active 类挂在 input 外层的 label 上 */
    const getLabels = () => getInputs().map((input) => input.closest('label') as HTMLLabelElement);
    const activeCount = () => getLabels().filter((label) => label.classList.contains(styles.active)).length;
    return { onChange, getInputs, getLabels, activeCount, user: userEvent.setup(), ...utils };
};

/** 受控包装：验证组件完全跟随父级 state。 */
const ControlledHost = ({ initial = 0, onChange }: { initial?: number; onChange?: (v: number) => void }) => {
    const [val, setVal] = useState(initial);
    return (
        <Rate
            value={val}
            onChange={(v) => {
                setVal(v);
                onChange?.(v);
            }}
        />
    );
};

describe('Rate', () => {
    describe('rendering', () => {
        it('默认渲染 5 颗星且都未选中', () => {
            const { getInputs, activeCount } = setup();
            expect(getInputs()).toHaveLength(5);
            getInputs().forEach((input) => expect(input).not.toBeChecked());
            expect(activeCount()).toBe(0);
        });

        it('count 自定义星星数量', () => {
            const { getInputs } = setup({ count: 10 });
            expect(getInputs()).toHaveLength(10);
        });

        it('defaultValue 点亮前 N 颗星并选中第 N 颗', () => {
            const { getInputs, activeCount } = setup({ defaultValue: 3 });
            expect(activeCount()).toBe(3);
            expect(getInputs()[2]).toBeChecked();
        });

        it('value 受控点亮前 N 颗星', () => {
            const { activeCount, getInputs } = setup({ value: 4 });
            expect(activeCount()).toBe(4);
            expect(getInputs()[3]).toBeChecked();
        });

        it('value 超出 count 时夹取选中态，且仍有一颗星可 Tab 到达', () => {
            const { getInputs, activeCount } = setup({ count: 3, value: 5 });
            expect(activeCount()).toBe(3);
            expect(getInputs()[2]).toBeChecked();
            expect(getInputs().map((input) => input.tabIndex)).toEqual([-1, -1, 0]);
        });

        it('value 为小数时按就近取整（用于展示平均分）', () => {
            const { getInputs, activeCount } = setup({ value: 4.6 });
            expect(activeCount()).toBe(5);
            expect(getInputs()[4]).toBeChecked();
        });

        it('挂载在 role="radiogroup" 容器中，每颗星都有可访问名称', () => {
            setup({ defaultValue: 2 });
            expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-label', '评分');
            expect(screen.getByRole('radio', { name: '3 星' })).toBeInTheDocument();
        });

        it('支持自定义 aria-label 覆盖默认值', () => {
            setup({ 'aria-label': '岛屿评分' });
            expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-label', '岛屿评分');
        });

        it('应用 className 与 style 到根节点', () => {
            setup({ className: 'my-rate', style: { marginTop: 8 } });
            const root = screen.getByRole('radiogroup');
            expect(root).toHaveClass('my-rate');
            expect(root).toHaveStyle({ marginTop: '8px' });
        });
    });

    describe('尺寸', () => {
        it.each(['small', 'middle', 'large'] as const)('支持 size=%s', (size) => {
            setup({ size });
            expect(screen.getByRole('radiogroup')).toHaveClass(styles[size]);
        });
    });

    describe('交互', () => {
        it('点击第 3 颗星触发 onChange(3) 并点亮前 3 颗', async () => {
            const { user, onChange, getInputs, activeCount } = setup({ defaultValue: 0 });
            await user.click(getInputs()[2]);
            expect(onChange).toHaveBeenCalledTimes(1);
            expect(onChange).toHaveBeenCalledWith(3);
            expect(activeCount()).toBe(3);
            expect(getInputs()[2]).toBeChecked();
        });

        it('点击更小的值会熄灭后面的星星', async () => {
            const { user, onChange, getInputs, activeCount } = setup({ defaultValue: 5 });
            await user.click(getInputs()[1]);
            expect(onChange).toHaveBeenLastCalledWith(2);
            expect(activeCount()).toBe(2);
            expect(getInputs()[4]).not.toBeChecked();
        });

        it('再次点击同一颗星清空评分（allowClear 默认开启）', async () => {
            const { user, onChange, activeCount } = setup({ defaultValue: 3 });
            const inputs = screen.getAllByRole('radio');
            await user.click(inputs[2]);
            expect(onChange).toHaveBeenLastCalledWith(0);
            expect(activeCount()).toBe(0);
        });

        it('allowClear=false 时再次点击同一颗星不清空', async () => {
            const { user, onChange, getInputs, activeCount } = setup({ defaultValue: 3, allowClear: false });
            await user.click(getInputs()[2]);
            expect(onChange).not.toHaveBeenCalled();
            expect(activeCount()).toBe(3);
        });

        it('受控模式只回调 onChange，显示由父级 state 决定', async () => {
            const onChange = vi.fn();
            render(<ControlledHost onChange={onChange} />);
            const user = userEvent.setup();
            const inputs = screen.getAllByRole('radio') as HTMLInputElement[];

            await user.click(inputs[3]);
            expect(onChange).toHaveBeenLastCalledWith(4);
            expect(inputs[3]).toBeChecked();
            expect(inputs[4]).not.toBeChecked();

            await user.click(inputs[1]);
            expect(onChange).toHaveBeenLastCalledWith(2);
            expect(inputs[1]).toBeChecked();
            expect(inputs[3]).not.toBeChecked();
        });

        it('受控模式下 value 不变时点击不会自行改动显示', async () => {
            const onChange = vi.fn();
            render(<Rate value={2} onChange={onChange} />);
            const user = userEvent.setup();
            await user.click(screen.getAllByRole('radio')[4]);
            expect(onChange).toHaveBeenLastCalledWith(5);
            expect(screen.getAllByRole('radio')[1]).toBeChecked();
        });
    });

    describe('只读', () => {
        it('readonly 时 input 禁用、容器标记 aria-readonly 且不响应点击', async () => {
            const { user, onChange, getInputs, activeCount } = setup({ defaultValue: 3, readonly: true });
            const root = screen.getByRole('radiogroup');
            expect(root).toHaveClass(styles.readonly);
            expect(root).toHaveAttribute('aria-readonly', 'true');
            getInputs().forEach((input) => expect(input).toBeDisabled());

            await user.click(getInputs()[4]);
            expect(onChange).not.toHaveBeenCalled();
            expect(activeCount()).toBe(3);
        });

        it('readonly 时键盘不生效', async () => {
            const { user, onChange, getInputs } = setup({ defaultValue: 3, readonly: true });
            getInputs()[2].focus();
            await user.keyboard('{ArrowRight}');
            expect(onChange).not.toHaveBeenCalled();
        });
    });

    describe('键盘可访问性', () => {
        it('ArrowRight / ArrowUp 加一星', async () => {
            const { user, onChange, getInputs } = setup({ defaultValue: 2 });
            getInputs()[1].focus();
            await user.keyboard('{ArrowRight}');
            expect(onChange).toHaveBeenLastCalledWith(3);
            expect(getInputs()[2]).toBeChecked();

            await user.keyboard('{ArrowUp}');
            expect(onChange).toHaveBeenLastCalledWith(4);
        });

        it('ArrowLeft / ArrowDown 减一星，最小为 1', async () => {
            const { user, onChange, getInputs } = setup({ defaultValue: 2 });
            getInputs()[1].focus();
            await user.keyboard('{ArrowLeft}');
            expect(onChange).toHaveBeenLastCalledWith(1);

            await user.keyboard('{ArrowDown}');
            expect(onChange).toHaveBeenLastCalledWith(1);
        });

        it('未评分时按方向键从 1 星开始', async () => {
            const { user, onChange, getInputs } = setup({ defaultValue: 0 });
            getInputs()[0].focus();
            await user.keyboard('{ArrowRight}');
            expect(onChange).toHaveBeenLastCalledWith(1);
        });

        it('Home / End 跳到首尾', async () => {
            const { user, onChange, getInputs } = setup({ count: 10, defaultValue: 5 });
            getInputs()[4].focus();
            await user.keyboard('{End}');
            expect(onChange).toHaveBeenLastCalledWith(10);

            await user.keyboard('{Home}');
            expect(onChange).toHaveBeenLastCalledWith(1);
        });

        it('受控值为小数时按取整后的星级移动并聚焦', async () => {
            const { user, onChange, getInputs } = setup({ value: 4.6 });
            getInputs()[4].focus();
            await user.keyboard('{ArrowLeft}');
            expect(onChange).toHaveBeenLastCalledWith(4);
            expect(document.activeElement).toBe(getInputs()[3]);
        });

        it('受控值超出 count 时方向键仍落在范围内', async () => {
            const { user, onChange, getInputs } = setup({ count: 3, value: 5 });
            getInputs()[2].focus();
            await user.keyboard('{ArrowLeft}');
            expect(onChange).toHaveBeenLastCalledWith(2);
            expect(document.activeElement).toBe(getInputs()[1]);
        });

        it('键盘选择时收起悬停预览', async () => {
            const { user, getInputs, getLabels, activeCount } = setup({ defaultValue: 2 });
            await user.hover(getLabels()[4]);
            expect(activeCount()).toBe(5);

            getInputs()[1].focus();
            await user.keyboard('{ArrowRight}');
            expect(activeCount()).toBe(3);
        });

        it('ArrowRight 到最大值后保持不变', async () => {
            const { user, onChange, getInputs } = setup({ defaultValue: 5 });
            getInputs()[4].focus();
            await user.keyboard('{ArrowRight}');
            expect(onChange).not.toHaveBeenCalled();
        });

        it('其它按键不改变评分', async () => {
            const { user, onChange, getInputs } = setup({ defaultValue: 3 });
            getInputs()[2].focus();
            await user.keyboard('a');
            expect(onChange).not.toHaveBeenCalled();
        });

        it('roving tabindex：只有当前选中的星可以 Tab 到达', () => {
            const { getInputs } = setup({ defaultValue: 3 });
            expect(getInputs().map((input) => input.tabIndex)).toEqual([-1, -1, 0, -1, -1]);
        });

        it('未评分时第一颗星是 Tab 落点', () => {
            const { getInputs } = setup();
            expect(getInputs().map((input) => input.tabIndex)).toEqual([0, -1, -1, -1, -1]);
        });
    });

    describe('悬停预览', () => {
        it('hover 到第 4 颗预览前 4 颗，移出后恢复真实评分', async () => {
            const { user, getLabels, activeCount } = setup({ defaultValue: 2 });
            await user.hover(getLabels()[3]);
            expect(activeCount()).toBe(4);

            await user.unhover(getLabels()[3]);
            expect(activeCount()).toBe(2);
        });

        it('readonly 时不预览', async () => {
            const { user, getLabels, activeCount } = setup({ defaultValue: 2, readonly: true });
            await user.hover(getLabels()[4]);
            expect(activeCount()).toBe(2);
        });

        it('点击清空后立即收起预览', async () => {
            const { user, getInputs, activeCount } = setup({ defaultValue: 3 });
            await user.hover(getInputs()[2]);
            await user.click(getInputs()[2]);
            expect(activeCount()).toBe(0);
        });
    });

    describe('选中动画', () => {
        it('加分时按顺序播放 pop 与 splash', async () => {
            const { user, getInputs, container } = setup();
            await user.click(getInputs()[2]);
            expect(container.querySelectorAll(`.${styles.pop}`)).toHaveLength(3);
            expect(container.querySelectorAll(`.${styles.splash}`)).toHaveLength(1);
            // 动画延迟按点亮顺序递增，形成依次弹出的效果
            const delays = Array.from(container.querySelectorAll<HTMLElement>(`.${styles.pop}`)).map((el) =>
                el.style.getPropertyValue('--rate-pop-delay')
            );
            expect(delays).toEqual(['0ms', '60ms', '120ms']);
        });

        it('减分时不播放动画', async () => {
            const { user, getInputs, container } = setup({ defaultValue: 4 });
            await user.click(getInputs()[1]);
            expect(container.querySelectorAll(`.${styles.pop}`)).toHaveLength(0);
            expect(container.querySelectorAll(`.${styles.splash}`)).toHaveLength(0);
        });

        it('清空时不播放动画', async () => {
            const { user, getInputs, container } = setup({ defaultValue: 3 });
            await user.click(getInputs()[2]);
            expect(container.querySelectorAll(`.${styles.pop}`)).toHaveLength(0);
            expect(container.querySelectorAll(`.${styles.splash}`)).toHaveLength(0);
        });

        it('重复选中会重新挂载 splash 以重放动画', async () => {
            const { user, getInputs, container } = setup();
            await user.click(getInputs()[2]);
            const first = container.querySelector(`.${styles.splash}`);
            await user.click(getInputs()[2]); // 清空
            await user.click(getInputs()[2]); // 重新选 3 星
            const second = container.querySelector(`.${styles.splash}`);
            expect(second).toBeInTheDocument();
            expect(second).not.toBe(first);
        });
    });
});
