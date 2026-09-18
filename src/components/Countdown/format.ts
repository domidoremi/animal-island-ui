/**
 * Countdown 的纯逻辑：时间戳换算 / 格式模板解析 / 剩余时间拆分 / 数字条滚动算术。
 *
 * 与 TimePicker 的 `geometry.ts` 同样的理由 —— 下面这些在组件里**测试渲染器覆盖不到**：
 *   - 数字条的滚动在 Web 上靠 `el.style.transition` + 强制回流（`void el.offsetHeight`），
 *     在 RN 上靠 `Animated`；测试里拿不到中间帧，只能断言起止值。
 *   - 「该滚到第几面 / 是否需要先瞬移回绕」是纯算术，放在组件里只能靠渲染结果间接验证。
 *   - 模板解析（DD / HH / mm / ss 与字面量）和天数进位（format 含 DD 时 HH 才取模 24）
 *     都是边界条件密集的逻辑，单独测比透过 DOM 断言更精确。
 * 所以把它们全部算成纯函数，单独单测（`format.test.ts`）。
 */

/** 剩余毫秒的轮询周期 —— 对应 Web 版 `window.setInterval(update, 250)` */
export const COUNTDOWN_INTERVAL_MS = 250;

/** 数字条滚动时长 —— 对应 `.digitStrip { transition: transform 0.35s ... }` */
export const ROLL_DURATION_MS = 350;

/** 每个数字位渲染的面数 —— 对应 `[...DIGIT_FACES, ...DIGIT_FACES]`（0-9 两轮） */
export const FACES_PER_STRIP = 20;

/** 一个循环里的数字个数 —— 对应 `% 10` */
export const DIGIT_CYCLE = 10;

/** 数字面高度（em）—— 对应 `.digitCell { height: 1.2em }` / `.digitFace { height: 1.2em }` */
export const FACE_HEIGHT_RATIO = 1.2;

/** 0-9 的数字面，渲染时铺两轮 */
export const DIGIT_FACES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

/** 响应式换行断点 —— 对应 Less 的 `@media (max-width: 480px)` */
export const WRAP_BREAKPOINT = 480;

/** `value` 支持时间戳或 Date —— 对应上游 `toTimestamp` */
export const toTimestamp = (value: number | Date): number => (value instanceof Date ? value.getTime() : value);

/** 两位补零 —— 对应上游 `pad` */
export const pad = (value: number): string => String(value).padStart(2, '0');

/** 格式模板里支持的 token */
export type FormatToken = 'DD' | 'HH' | 'mm' | 'ss';

/** 模板解析结果：token 或原样渲染的字面量（":"、"天" 等） */
export type FormatPart = { kind: 'token'; token: FormatToken } | { kind: 'literal'; text: string };

const TOKEN_RE = /DD|HH|mm|ss/g;

/**
 * 将格式模板解析为 token / 字面量序列，字面量（":"、"天" 等）原样渲染为分隔符。
 *
 * 注意 `DD|HH|mm|ss` 的**顺序即优先级**：`mm` 是分钟、`MM` 不是 token（区分大小写）。
 */
export const parseFormat = (format: string): FormatPart[] => {
    const parts: FormatPart[] = [];
    const re = new RegExp(TOKEN_RE.source, 'g');
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(format)) !== null) {
        if (m.index > last) parts.push({ kind: 'literal', text: format.slice(last, m.index) });
        parts.push({ kind: 'token', token: m[0] as FormatToken });
        last = m.index + m[0].length;
    }
    if (last < format.length) parts.push({ kind: 'literal', text: format.slice(last) });
    return parts;
};

/**
 * 把剩余毫秒拆成 DD / HH / mm / ss 四个补零字符串。
 *
 * 两处容易看漏的上游语义，原样保留：
 *   1. 秒数用 `Math.ceil`（向上取整）—— 剩 1ms 也显示 `00:00:01`，归零瞬间才跳 `00`。
 *   2. **`HH` 是否对 24 取模取决于模板里有没有 `DD`**：含 `DD` 时 `HH` 是「天内的时」，
 *      不含时 `HH` 可以超过 24（如剩 30 小时显示 `30`）。
 */
export const splitRemaining = (remaining: number, format: string): Record<FormatToken, string> => {
    const totalSeconds = Math.ceil(remaining / 1_000);
    const days = Math.floor(totalSeconds / 86_400);
    const hasDays = format.includes('DD');
    const hours = hasDays ? Math.floor((totalSeconds % 86_400) / 3_600) : Math.floor(totalSeconds / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;
    return { DD: pad(days), HH: pad(hours), mm: pad(minutes), ss: pad(seconds) };
};

/**
 * 完整的可读时间串，如 `01 天 02:03:04`。
 *
 * Web 版把它渲染进 `.srOnly`（读屏专用）：滚动数字条整块 `aria-hidden`，
 * 辅助技术读到的就是这一串。
 */
export const formatRemaining = (remaining: number, format: string): string => {
    const digits = splitRemaining(remaining, format);
    return parseFormat(format)
        .map((part) => (part.kind === 'token' ? digits[part.token] : part.text))
        .join('');
};

/** 数字面高度（px）：`.digitCell` / `.digitFace` 的 `1.2em`，em 基准是该尺寸的数字字号 */
export const faceHeight = (digitFontSize: number): number => FACE_HEIGHT_RATIO * digitFontSize;

/** `computeRoll` 的结论：动画起点 / 终点（20 面数字条上的索引），以及是否需要先瞬移 */
export interface RollStep {
    /** 动画起点（因跨循环回绕可能被 +10） */
    from: number;
    /** 动画终点；`to % 10` 即最终显示的数字 */
    to: number;
    /** `true` 表示起点与当前位置不同，需要先无动画瞬移过去再滚 */
    jumped: boolean;
}

/**
 * 里程表式的**单向向下滚动**：算出这一次换数字该从哪一面滚到哪一面。
 *
 * 对应 Web 版 `DigitRoll` 的 `useEffect`：
 *
 *     const delta = (prev - next + 10) % 10;      // 向下滚动的步数
 *     let from = posRef.current;
 *     let target = from - delta;
 *     if (target < 0) { from += 10; target = from - delta; }   // 并先瞬移到 from
 *
 * 语义：
 *   - 数字减 1 走 1 步（向下滚），`0 → 9` 的回绕同样只走 1 步；
 *   - 数字不变时不做任何事（`from === to`）；
 *   - 当前位置减 delta 会跌出数字条（`< 0`）时，先把起点平移到下一循环的同数字位置
 *     （视觉无变化），再向下滚，从而**保证方向永远一致**。
 */
export const computeRoll = (current: number, prevDigit: string, nextDigit: string): RollStep => {
    const prev = Number(prevDigit);
    const next = Number(nextDigit);
    if (prev === next) return { from: current, to: current, jumped: false };

    const delta = (prev - next + DIGIT_CYCLE) % DIGIT_CYCLE;
    let from = current;
    let to = from - delta;
    let jumped = false;

    if (to < 0) {
        from += DIGIT_CYCLE;
        to = from - delta;
        jumped = true;
    }

    return { from, to, jumped };
};

/** 某个面索引对应的 `translateY`（px，负值向上） */
export const rollTranslateY = (position: number, digitFontSize: number): number =>
    -position * faceHeight(digitFontSize);

/** 尺寸规格 —— 对应 Less 的 `.small` / `.middle` / `.large`（含嵌套的 `.digitCell` / `.colon`） */
export const SIZE_SPEC = {
    small: { minHeight: 40, fontSize: 13, digitFontSize: 20 },
    middle: { minHeight: 48, fontSize: 14, digitFontSize: 26 },
    large: { minHeight: 56, fontSize: 16, digitFontSize: 34 },
} as const;

/** 数字字号与冒号字号同源 —— `.small .digitCell` 与 `.small .colon` 都是 20px / 26px / 34px */
export const colonFontSize = (digitFontSize: number): number => digitFontSize;

/** 冒号上移量 —— 对应 `.colon { top: -0.08em }`，em 基准是冒号自身字号 */
export const colonOffsetY = (digitFontSize: number): number => -0.08 * colonFontSize(digitFontSize);

/** 窄屏时换行 —— 对应 `@media (max-width: 480px)` 的 `flex-wrap: wrap` */
export const shouldWrap = (width: number): boolean => width <= WRAP_BREAKPOINT;
