# CountUp and Rate - RN fork

For `animal-island-ui-rn`, not the upstream DOM package. The declarations below are
verbatim from native source; rebuild `dist/index.d.ts` before relying on installed types.
Package/runtime setup: [native-host.md](native-host.md).

## CountUp

```ts
export type CountUpSize = 'small' | 'middle' | 'large';

export type CountUpVariant = 'default' | 'island';

export type CountUpEasingName = 'linear' | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic' | 'easeOutExpo';

export type CountUpEasingFunction = (progress: number) => number;

export type CountUpEasing = CountUpEasingName | CountUpEasingFunction;

export interface CountUpCompleteResult {
    /** 是否重播动画 */
    shouldRepeat?: boolean;
    /** 重播前的等待时间（秒），默认 0 */
    delay?: number;
    /** 重播时的起始值，默认回到 start */
    newStartAt?: number;
}

export interface CountUpCelebrateOptions {
    /** 贴纸文案，任意内容；不传则不渲染贴纸 */
    text?: React.ReactNode;
}

export interface CountUpRenderState {
    /** 当前展示值 */
    value: number;
    /** 重置到起始值并重新播放 */
    reset: (newStartAt?: number) => void;
}

export interface CountUpProps extends Omit<ViewProps, 'children'> {
    /** 起始值，默认 0 */
    start?: number;
    /** 目标值（比如本局总分） */
    end: number;
    /** 动画时长（秒），默认 2；传 0 直接显示目标值 */
    duration?: number;
    /** 是否正在计数，默认 false。改为 false 会暂停并保留当前值，再改回 true 从暂停处继续 */
    isCounting?: boolean;
    /** Decimal places (0-100, truncated); defaults to the greater start/end precision. */
    decimalPlaces?: number;
    /** 小数点符号，默认 '.' */
    decimalSeparator?: string;
    /** 千分位符号，默认 ''（不分组） */
    thousandsSeparator?: string;
    /** 缓动曲线，默认 'easeOutCubic' */
    easing?: CountUpEasing;
    /** 完全接管数字格式化，优先级高于 decimalPlaces / decimalSeparator / thousandsSeparator */
    formatter?: (value: number) => React.ReactNode;
    /** 展示值刷新间隔（秒），0 表示每帧刷新，默认 0 */
    updateInterval?: number;
    /** 数字前缀，如 '¥' */
    prefix?: React.ReactNode;
    /** 数字后缀，如 '分' */
    suffix?: React.ReactNode;
    /** 尺寸 */
    size?: CountUpSize;
    /** 显示风格 */
    variant?: CountUpVariant;
    /** 数字块是否带边框，默认无 */
    bordered?: boolean;
    /** 计数结束后的庆祝动效（数字弹跳 + 光环 + 星芒），传 text 会额外弹出一张贴纸，默认关闭 */
    celebrate?: boolean | CountUpCelebrateOptions;
    /** 展示值更新时触发（每帧触发，与 updateInterval 无关） */
    onUpdate?: (value: number) => void;
    /** 计数结束时触发，可返回 CountUpCompleteResult 以重播 */
    onComplete?: (elapsedTime: number) => void | CountUpCompleteResult;
    /**
     * 渲染函数，可完全接管数字渲染，参数为 { value, reset }。
     * 注意：数字块整体对辅助技术隐藏（aria-hidden），这里只放展示性内容，可聚焦元素请放到组件外面
     */
    children?: (state: CountUpRenderState) => React.ReactNode;
}
```

Defaults: start 0, duration 2 seconds, isCounting false, decimal separator '.', no
thousands separator, easeOutCubic, updateInterval 0, middle/default, no border/celebration.
Pause retains the current value; reset may choose a new start. Nonfinite endpoints or
duration do not schedule endless frames. Reduced motion suppresses decorative rings,
sparkles and sticker motion, not value changes, onUpdate or completion/replay semantics.
The native sticker is flat-filled and the scale sequence is not exact Web rotation.
Keep focusable actions outside the decorative number block.

## Rate

```ts
export type RateSize = 'small' | 'middle' | 'large';

export interface RateProps extends Omit<ViewProps, 'children'> {
    /** Controlled rating. */
    value?: number;
    /** Uncontrolled initial rating. */
    defaultValue?: number;
    /** Number of stars. */
    count?: number;
    /** Visual star size; interactive targets remain at least 44 logical units. */
    size?: RateSize;
    /** Display only. */
    readonly?: boolean;
    /** Pressing the selected star clears the rating. */
    allowClear?: boolean;
    /** Called with the committed rating, including zero on clear. */
    onChange?: (value: number) => void;
}
```

Defaults: defaultValue 0, count 5, size middle, readonly false, allowClear true.
Ratings round/clamp to 0..count. Controlled value changes only when the host writes back.
Pressing the selected star clears it; readonly renders one accessible value with no
interactive targets. Stars use verified upstream artwork; native targets remain at least
44 units while the small/middle/large artwork is 20/26/34. Hover preview is Web-only.
Reduced motion removes decorative burst/timing without disabling selection.
