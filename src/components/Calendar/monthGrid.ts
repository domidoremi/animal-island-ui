import React from 'react';
import dayjs, { type Dayjs } from 'dayjs';

export type CalendarColor = 'teal' | 'amber' | 'coral' | 'green' | 'purple';

/** 日历事项：同一天用同一个日期，跨天传不同的 start / end */
export interface CalendarEvent {
    /** 事项内容 */
    title: React.ReactNode;
    /** 开始日期：YYYY-MM-DD 字符串或 dayjs 对象 */
    start: string | Dayjs;
    /** 结束日期，省略时等同于 start；传入时渲染成跨天的连续事项条 */
    end?: string | Dayjs;
    /** 颜色，默认 teal */
    color?: CalendarColor;
    /** 是否在事项条首段展示起始时间 HH:mm（跨周续接段不重复展示） */
    showTime?: boolean;
}

export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/** 日期网格固定补满 6 周 × 7 天 */
export const GRID_CELLS = 42;
export const COLS = 7;
/** 日期网格的行数（6 周） */
const CELL_ROWS = GRID_CELLS / COLS;
export const MAX_EVENT_ROWS = 2;

export const toDateKey = (date: Dayjs) => date.format('YYYY-MM-DD');

/** 解析字符串 / dayjs 输入，非法输入返回 null */
export const parseDate = (value: string | Dayjs | null | undefined): Dayjs | null => {
    if (!value) return null;
    const parsed = dayjs.isDayjs(value) ? value : dayjs(value);
    return parsed.isValid() ? parsed : null;
};

/** YYYY-MM / YYYY-M 这类只到月份的输入，补成当月 1 日 */
export const parseMonthValue = (value: string | null | undefined): Dayjs | null => {
    if (!value) return null;
    const parsed = /^\d{4}-\d{1,2}$/.test(value) ? dayjs(`${value}-01`) : dayjs(value);
    return parsed.isValid() ? parsed : null;
};

/** 视图起点：本月 1 日所在周的周日 */
export const gridStartOf = (month: Dayjs) => {
    const first = month.date(1);
    return first.subtract(first.day(), 'day');
};

/** 日期在 42 格网格中的下标，早于视图或超出视图时夹取到边界 */
export const cellIndexOf = (date: Dayjs, gridStart: Dayjs) => {
    const index = date.startOf('day').diff(gridStart.startOf('day'), 'day');
    return Math.min(GRID_CELLS - 1, Math.max(0, index));
};

/** 事项是否与 42 格视图（含上下月补位）相交：早于视图起点或晚于视图终点则不可见 */
export const isEventVisibleInGrid = (start: Dayjs, end: Dayjs, gridStart: Dayjs): boolean => {
    const last = end.isBefore(start, 'day') ? start : end;
    return !last.isBefore(gridStart, 'day') && start.isBefore(gridStart.add(GRID_CELLS, 'day'), 'day');
};

/**
 * 把日期夹取到 42 格网格内。光标落在网格外时 42 格会全部 tabindex=-1，键盘用户 Tab 进日历后无处可停。
 */
export const clampToGrid = (date: Dayjs, gridStart: Dayjs): Dayjs => {
    if (date.isBefore(gridStart, 'day')) return gridStart;
    const last = gridStart.add(GRID_CELLS - 1, 'day');
    return date.isAfter(last, 'day') ? last : date;
};

/** 一段跨天事项在某一周里的可见片段：所在格子、跨列数、事项行 */
export interface EventSegment {
    event: CalendarEvent;
    /** 片段起点在网格中的线性下标 */
    index: number;
    /** 片段终点在网格中的线性下标（同一周内，保证跨列数不超过 7） */
    endIndex: number;
    /** 是否为跨周后的续接片段（时间只在本周内的首片展示一次） */
    continuation: boolean;
    /** 片段占用的列数 */
    span: number;
    /** 第几行事项（0..MAX_EVENT_ROWS-1） */
    row: number;
}

export interface EventLayout {
    /** 事项片段，供叠加层渲染 */
    segments: EventSegment[];
    /** 每个格子的事项总数，用于 +N 折叠 */
    counts: number[];
}

/**
 * 把事项映射到网格：跨天事项按自然日逐格铺开，并按周切成不超过 7 列的片段；
 * 同一天多条则依次占用事项行。结果与视图月份无关，因此拖拽预览（临时事项）也能复用同一套布局。
 *
 * nonCountingEvent 让某条事项占位但不计入 +N：拖拽预览条是临时态，计入就会在拖拽经过时凭空冒出徽标。
 */
export const layoutEvents = (
    events: CalendarEvent[],
    gridStart: Dayjs,
    today: Dayjs,
    nonCountingEvent?: CalendarEvent | null
): EventLayout => {
    const segments: EventSegment[] = [];
    const counts = new Array<number>(GRID_CELLS).fill(0);
    const rows = Array.from({ length: GRID_CELLS }, () => new Array<boolean>(MAX_EVENT_ROWS).fill(false));

    const sorted = [...events]
        .map((event) => ({
            event,
            start: parseDate(event.start) ?? today.startOf('day'),
            end: parseDate(event.end) ?? parseDate(event.start) ?? today.startOf('day'),
        }))
        .sort((a, b) => a.start.valueOf() - b.start.valueOf());

    for (const { event, start, end } of sorted) {
        const last = end.isBefore(start, 'day') ? start : end;
        const from = cellIndexOf(start, gridStart);
        const to = cellIndexOf(last, gridStart);

        // 完全落在 42 格视图（上下月补位）之外的事项不参与计数与渲染
        if (!isEventVisibleInGrid(start, last, gridStart)) continue;

        if (event !== nonCountingEvent) {
            for (let i = from; i <= to; i += 1) counts[i] += 1;
        }

        for (let row = 0; row < CELL_ROWS; row += 1) {
            const rowStart = row * COLS;
            const rowEnd = rowStart + COLS - 1;
            if (to < rowStart || from > rowEnd) continue;
            // 按周切断：片段左右两端都不能越过所在行的边界
            const segFrom = Math.max(from, rowStart);
            const segTo = Math.min(to, rowEnd);
            const span = segTo - segFrom + 1;

            // 从第一行开始找一段连续空闲的格子，放不下则整个片段折叠进 +N
            let placed = -1;
            for (let r = 0; r < MAX_EVENT_ROWS; r += 1) {
                let free = true;
                for (let i = segFrom; i <= segTo; i += 1) {
                    if (rows[i][r]) {
                        free = false;
                        break;
                    }
                }
                if (free) {
                    placed = r;
                    break;
                }
            }
            if (placed < 0) continue;

            for (let i = segFrom; i <= segTo; i += 1) rows[i][placed] = true;
            segments.push({
                event,
                index: segFrom,
                endIndex: segTo,
                // 首片就是事项本身的起始格时才算首段：跨周续接段与「早于视图」的截断段都不重复展示时间
                continuation: !start.isSame(gridStart.add(segFrom, 'day'), 'day'),
                span,
                row: placed,
            });
        }
    }

    return { segments, counts };
};

export const textOf = (node: React.ReactNode): string => {
    if (node === null || node === undefined || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(textOf).join('');
    if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children);
    return '';
};

/** Outside-grid motion cancels rather than creating an unintended clamped range. */
export function pointToCell(x: number, y: number, width: number, rowHeight: number): number | null {
    if (width <= 0 || rowHeight <= 0 || x < 0 || y < 0 || x >= width || y >= rowHeight * 6) return null;
    return Math.floor(y / rowHeight) * COLS + Math.floor(x / (width / COLS));
}
