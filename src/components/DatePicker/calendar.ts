/**
 * DatePicker 的纯逻辑：日期解析 / 序列化 / 网格构建 / 范围高亮判定 / 面板定位。
 *
 * 抽出来的理由与 `TimePicker/geometry.ts`、`Select/geometry.ts` 一致：
 * 面板定位依赖 `measureInWindow`，而 jest preset 把它 mock 成**永不回调的空实现**
 * （`@react-native/jest-preset/jest/MockNativeMethods.js` 里是 `measureInWindow: jest.fn()`），
 * 所以翻边 / 对齐这些**判断**在组件测试里一个都跑不到。日期算术虽然能跑，
 * 但挪到这里可以按边界逐条测（月末、闰年、跨年、首尾补格），不必靠点击 UI。
 *
 * 全部函数与上游 `DatePicker.tsx` 的同名局部函数**逐行对应**，未改动语义。
 */

/** 星期表头，与上游 `WEEKDAYS` 一致 */
export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const;

/** 月份网格文案，与上游 `MONTHS` 一致 */
export const MONTHS = [
    '一月',
    '二月',
    '三月',
    '四月',
    '五月',
    '六月',
    '七月',
    '八月',
    '九月',
    '十月',
    '十一月',
    '十二月',
] as const;

/** 日期网格固定 6 行 × 7 列，与上游 `buildCells` 的 `cells.length < 42` 一致 */
export const GRID_CELLS = 42;

/** 面板宽度：单日期 280，范围模式 600（上游 `.panel` / `.panelRange`） */
export const PANEL_WIDTH = 280;
export const PANEL_WIDTH_RANGE = 600;

/** 面板高度估算值 —— 上游定位里写死的 `const panelHeight = 340` */
export const PANEL_HEIGHT_ESTIMATE = 340;

/** 面板与触发区的间距 —— 上游的 `marginTop / marginBottom: 6px` */
export const PANEL_GAP = 6;

const pad = (n: number) => `${n}`.padStart(2, '0');

/** 将 YYYY[-MM[-DD]] 字符串解析为本地时间 Date，非法输入返回 null */
export const parseValue = (value: string | null | undefined): Date | null => {
    if (!value) return null;
    const match = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/.exec(value);
    if (!match || Number(match[2]) > 12) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3] ?? 1));
    return Number.isNaN(date.getTime()) ? null : date;
};

/** 将 Date 序列化为 YYYY-MM-DD */
export const toValue = (date: Date): string =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** 将 Date 序列化为 YYYY-MM（月份选择模式的值） */
export const toMonthValue = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

/**
 * 按模板格式化日期，支持 YYYY / MM / DD / M / D 占位符。
 *
 * ⚠️ 顺序敏感：必须先替换 `YYYY`，否则 `YYYY` 里的 `Y` 会被 `M`/`D` 的替换误伤；
 * 且 `MM` 必须早于 `M`。这里逐字照搬上游 `formatDate` 的替换顺序。
 */
export const formatDate = (date: Date, format: string): string =>
    format
        .replace('YYYY', `${date.getFullYear()}`)
        .replace('MM', pad(date.getMonth() + 1))
        .replace('DD', pad(date.getDate()))
        .replace('M', `${date.getMonth() + 1}`)
        .replace('D', `${date.getDate()}`);

export const isSameDay = (a: Date, b: Date): boolean =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const isSameMonth = (a: Date, b: Date): boolean =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

export type DateRange = [Date, Date];

/** 解析范围值 [开始, 结束]，任一端非法或非数组均返回 null */
export const parseRange = (value: string | [string, string] | null): DateRange | null => {
    if (!value || typeof value === 'string') return null;
    const start = parseValue(value[0]);
    const end = parseValue(value[1]);
    return start && end ? [start, end] : null;
};

/**
 * 构建日期网格：固定 6 行 × 7 列，首尾补齐上/下月日期。
 *
 * 与上游 `buildCells` 一致：先按当月 1 号的星期往前补上月尾巴，再铺整月，
 * 最后补下月开头直到凑满 42 格。补出来的日期**同属返回的 Date 数组**，
 * 「是否属于当前视图月」由调用方自己比对 `getMonth()`（上游的 `outside`）。
 */
export const buildCells = (vDate: Date): Date[] => {
    const vYear = vDate.getFullYear();
    const vMonth = vDate.getMonth();
    const cells: Date[] = [];
    const startWeekday = new Date(vYear, vMonth, 1).getDay();
    const daysInMonth = new Date(vYear, vMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(vYear, vMonth, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i--) cells.push(new Date(vYear, vMonth - 1, daysInPrevMonth - i));
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(vYear, vMonth, d));
    for (let d = 1; cells.length < GRID_CELLS; d++) cells.push(new Date(vYear, vMonth + 1, d));
    return cells;
};

/** 年份选择网格：12 个年份，从 `startYear - 1` 起 —— 上游 `yearCells` */
export const buildYearCells = (year: number): number[] => {
    const startYear = Math.floor(year / 10) * 10;
    return Array.from({ length: 12 }, (_, i) => startYear - 1 + i);
};

/** 年份选择网格的区间标题：上游 `{startYear} - {startYear + 9}年` */
export const yearDecade = (year: number): [number, number] => {
    const startYear = Math.floor(year / 10) * 10;
    return [startYear, startYear + 9];
};

export type RangeHighlightSource = {
    /** 范围模式进行中的选择：已确定的开始日期（待选） */
    rangeStart: Date | null;
    /** 范围模式进行中的选择：已确定的结束日期（待选） */
    rangeEnd: Date | null;
    /** 触屏按下预览中的日期（对应上游鼠标 `hoverDate`） */
    hoverDate: Date | null;
    /** 已提交的范围值 */
    selectedRange: DateRange | null;
};

export type RangeHighlight = {
    start: Date | null;
    end: Date | null;
};

/**
 * 计算当前应当高亮的范围端点。
 *
 * 与上游 `renderDayGrid` 内联的那段逻辑逐条对应：
 *   - 已选定开始 + 结束 → 用待选范围；
 *   - 只有开始、且预览日期早于它 → **反向预览**：预览日期成为潜在起点；
 *   - 只有开始、预览日期晚于它 → 预览日期成为潜在终点；
 *   - 只有开始、无预览 → 退化为起止同点（只圈出开始）；
 *   - 无进行中的选择 → 用已提交的范围。
 */
export const effectiveRange = (source: RangeHighlightSource): RangeHighlight => {
    const { rangeStart, rangeEnd, hoverDate, selectedRange } = source;
    if (rangeStart) {
        if (rangeEnd) return { start: rangeStart, end: rangeEnd };
        if (hoverDate && hoverDate < rangeStart) return { start: hoverDate, end: rangeStart };
        return { start: rangeStart, end: hoverDate && hoverDate > rangeStart ? hoverDate : rangeStart };
    }
    if (selectedRange) return { start: selectedRange[0], end: selectedRange[1] };
    return { start: null, end: null };
};

/** 某一格在范围模式下的高亮角色 —— 上游的 `rangeStartCell / rangeEndCell / inRange` */
export const cellRangeRole = (
    cell: Date,
    range: RangeHighlight
): { isStart: boolean; isEnd: boolean; inRange: boolean } => {
    if (!range.start || !range.end) return { isStart: false, isEnd: false, inRange: false };
    return {
        isStart: isSameDay(cell, range.start),
        isEnd: isSameDay(cell, range.end),
        inRange: cell > range.start && cell < range.end,
    };
};

export type Rect = { x: number; y: number; width: number; height: number };
export type WindowSize = { width: number; height: number };
export type PanelPosition = { top?: number; bottom?: number; left?: number; right?: number };

/**
 * 面板定位：优先向下展开，下方空间不足且上方更宽裕时向上翻转；右侧空间不足时右对齐。
 *
 * 与上游 `useEffect` 里的定位逻辑逐条对应，但**返回值换成 RN 的绝对定位数值**
 * （上游是 `top: '100%'` / `bottom: '100%'` / `right: 0` 这类 CSS 相对值）。
 *
 * 上游的两个硬编码值原样保留：
 *   - `panelHeight = 340`（真实面板比这高：单日期约 400，范围模式更高）；
 *   - 右对齐判据里的 `range ? 620 : 300`，而 `.panel` 实际宽 280 / `.panelRange` 600。
 *     **620 / 300 都大于真实宽度**，只会让右对齐提前触发，不会错位，故不动。
 */
export const computePanelPosition = (trigger: Rect, win: WindowSize, range: boolean): PanelPosition => {
    const pos: PanelPosition = {};
    if (
        trigger.y + trigger.height + PANEL_HEIGHT_ESTIMATE > win.height &&
        trigger.y > win.height - (trigger.y + trigger.height)
    ) {
        pos.bottom = win.height - trigger.y + PANEL_GAP;
    } else {
        pos.top = trigger.y + trigger.height + PANEL_GAP;
    }
    if (trigger.x + (range ? 620 : 300) > win.width) {
        pos.right = win.width - (trigger.x + trigger.width);
    } else {
        pos.left = trigger.x;
    }
    return pos;
};
