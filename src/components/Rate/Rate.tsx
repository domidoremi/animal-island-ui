import React, { useCallback, useId, useRef, useState } from 'react';
import { StarIcon } from 'naive-icons';
import classNames from 'classnames';
import styles from './rate.module.less';

export type RateSize = 'small' | 'middle' | 'large';

export interface RateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
    /** 当前评分（受控） */
    value?: number;
    /** 默认评分（非受控） */
    defaultValue?: number;
    /** 星星总数 */
    count?: number;
    /** 尺寸 */
    size?: RateSize;
    /** 只读，仅展示不可交互 */
    readonly?: boolean;
    /** 再次点击同一颗星时清空评分，默认开启 */
    allowClear?: boolean;
    /** 评分变化回调，清空时为 0 */
    onChange?: (value: number) => void;
}

/** 一次评分的起止值；seq 每次提交自增，用于重放星星动画 */
interface RateBurst {
    from: number;
    to: number;
    seq: number;
}

const BURST_STEP_MS = 60;

/** 把任意评分夹取成 [0, count] 的整数：小数就近取整，超出范围直接夹取 */
const toStarCount = (value: number, count: number) => Math.min(count, Math.max(0, Math.round(value)));

export const Rate: React.FC<RateProps> = ({
    value,
    defaultValue = 0,
    count = 5,
    size = 'middle',
    readonly = false,
    allowClear = true,
    onChange,
    className,
    style,
    onKeyDown,
    onMouseLeave,
    ...rest
}) => {
    const [innerValue, setInnerValue] = useState(defaultValue);
    const [hoverValue, setHoverValue] = useState(0);
    const [burst, setBurst] = useState<RateBurst>({ from: 0, to: 0, seq: 0 });

    const isControlled = value !== undefined;
    const rateValue = isControlled ? value! : innerValue;
    // 悬停预览：只读时始终展示真实评分
    const displayValue = !readonly && hoverValue > 0 ? hoverValue : rateValue;
    // 受控值可能是小数或超出范围（展示平均分、count 调小后旧值偏高），
    // 夹取成整数后用于点亮数量与选中态 —— 保证永远有一颗星可 Tab 到达
    const filledCount = toStarCount(displayValue, count);
    const checkedValue = toStarCount(rateValue, count);

    const reactId = useId();
    const groupName = `animal-rate-${reactId.replace(/:/g, '')}`;
    const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

    const commit = useCallback(
        (next: number) => {
            if (readonly || next === rateValue) return;
            if (!isControlled) setInnerValue(next);
            // 清空后鼠标仍停在原处，重置预览才能立刻看到「已清空」
            if (next === 0) setHoverValue(0);
            setBurst((prev) => ({ from: checkedValue, to: next, seq: prev.seq + 1 }));
            onChange?.(next);
        },
        [readonly, rateValue, checkedValue, isControlled, onChange]
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLDivElement>) => {
            onKeyDown?.(e);
            if (readonly) return;

            let next = 0;
            switch (e.key) {
                case 'ArrowRight':
                case 'ArrowUp':
                    // 从夹取后的整数值出发：受控值可能是小数或超出 count
                    next = Math.min(count, checkedValue + 1);
                    break;
                case 'ArrowLeft':
                case 'ArrowDown':
                    next = Math.max(1, checkedValue - 1);
                    break;
                case 'Home':
                    next = 1;
                    break;
                case 'End':
                    next = count;
                    break;
                default:
                    return;
            }

            e.preventDefault();
            // 键盘选择同样要收起悬停预览，否则停在旧星星上的鼠标会盖住新评分
            setHoverValue(0);
            inputRefs.current[next - 1]?.focus();
            commit(next);
        },
        [onKeyDown, readonly, checkedValue, count, commit]
    );

    const handleMouseLeave = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            setHoverValue(0);
            onMouseLeave?.(e);
        },
        [onMouseLeave]
    );

    return (
        <div
            role="radiogroup"
            aria-label="评分"
            aria-readonly={readonly || undefined}
            className={classNames(styles.rate, styles[size], { [styles.readonly]: readonly }, className)}
            style={style}
            onKeyDown={handleKeyDown}
            onMouseLeave={handleMouseLeave}
            {...rest}
        >
            {Array.from({ length: count }, (_, index) => {
                const starValue = index + 1;
                const isActive = index < filledCount;
                const isChecked = checkedValue === starValue;
                const isTabStop = checkedValue > 0 ? isChecked : index === 0;
                // 只有「加分」才播放动画：from → to 之间新点亮（含刚点的那颗）的星星依次弹出
                const isBursting = burst.to > burst.from && index >= burst.from && index < burst.to;
                const isSplash = burst.to > burst.from && index === burst.to - 1;

                return (
                    <label
                        key={starValue}
                        className={classNames(styles.item, { [styles.active]: isActive })}
                        onMouseEnter={readonly ? undefined : () => setHoverValue(starValue)}
                    >
                        <input
                            ref={(el) => {
                                inputRefs.current[index] = el;
                            }}
                            className={styles.input}
                            type="radio"
                            name={groupName}
                            checked={isChecked}
                            disabled={readonly}
                            tabIndex={!readonly && isTabStop ? 0 : -1}
                            aria-label={`${starValue} 星`}
                            onChange={() => commit(starValue)}
                            onClick={() => {
                                if (allowClear && checkedValue === starValue) commit(0);
                            }}
                        />
                        {isSplash && <span key={`splash-${burst.seq}`} className={styles.splash} aria-hidden="true" />}
                        <span
                            key={isBursting ? `star-${burst.seq}` : 'star'}
                            className={classNames(styles.star, { [styles.pop]: isBursting })}
                            style={
                                isBursting
                                    ? ({
                                          '--rate-pop-delay': `${(index - burst.from) * BURST_STEP_MS}ms`,
                                      } as React.CSSProperties)
                                    : undefined
                            }
                        >
                            <StarIcon className={styles.icon} aria-hidden="true" />
                        </span>
                    </label>
                );
            })}
        </div>
    );
};

Rate.displayName = 'Rate';
