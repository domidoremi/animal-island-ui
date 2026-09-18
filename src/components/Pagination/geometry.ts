/**
 * Pagination 的纯算术。
 *
 * 单独抽出来是因为它们要么是「可变的页码序列」（`getPageItems`），要么依赖
 * 测试渲染器里**永远拿不到**的测量结果（`computeSizeListPosition`）——
 * 与 TimePicker 的 `geometry.ts` 同一套思路：把决策算成纯函数，单独单测。
 *
 * 本文件不 import react / react-native，因此可以在任何环境下直接跑。
 */

/** 页码条里的一项：页码本身，或一个省略号 */
export type PageItem = number | 'ellipsis-left' | 'ellipsis-right';

/**
 * 不折叠的最大页数 —— 上游 `if (pageCount <= 7)` 里的 7。
 * 注意是 `<=`：正好 7 页也全部平铺。
 */
export const MAX_PAGES_WITHOUT_COLLAPSE = 7;

/**
 * 生成页码序列：首尾页 + 当前页邻域 + 省略号。
 *
 * **逐行照搬上游 Web 版 `Pagination.tsx` 的 `getPageItems`**（含它的两处怪癖）：
 *   1. 折叠阈值是 `current > 3` / `current < pageCount - 2`，所以第 3 页左侧、
 *      倒数第 3 页右侧**不会**出现省略号（窗口刚好贴边）。
 *   2. 邻域是 `[current - 1, current + 1]` 再夹到 `[2, pageCount - 1]`，
 *      与省略号的出现条件**不联动** —— 例如 `pageCount = 8, current = 7`
 *      会得到 `[1, …, 6, 7, 8]`（第 2~5 页被省略号吞掉）。
 *      这是上游既有行为，移植时**不做修正**。
 *
 * ⚠️ `current` 上游没有做**下界**夹取（`page = Math.min(current ?? innerPage, pageCount)`），
 * 传 `current = 0` 会得到 `[1, 'ellipsis-right', pageCount]` 这种退化序列。
 * 这里同样保留，不改（`changePage` 内部另有 `Math.max(1, next)` 的夹取）。
 */
export const getPageItems = (current: number, pageCount: number): PageItem[] => {
    if (pageCount <= MAX_PAGES_WITHOUT_COLLAPSE) {
        return Array.from({ length: pageCount }, (_, i) => i + 1);
    }
    const items: PageItem[] = [1];
    if (current > 3) {
        items.push('ellipsis-left');
    }
    const start = Math.max(2, current - 1);
    const end = Math.min(pageCount - 1, current + 1);
    for (let i = start; i <= end; i += 1) {
        items.push(i);
    }
    if (current < pageCount - 2) {
        items.push('ellipsis-right');
    }
    items.push(pageCount);
    return items;
};

/** 触发区在屏幕坐标系里的矩形（`measureInWindow` 的四个出参） */
export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** 窗口尺寸（`useWindowDimensions`） */
export interface WindowSize {
    width: number;
    height: number;
}

/** 弹层的绝对定位偏移；`top` / `bottom` 与 `left` / `right` 各自只会出现一个 */
export interface PanelPosition {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
}

/** 弹层与触发区的间距 —— 对应 `.sizeList { bottom: calc(100% + 8px) }` 里的 8px */
export const SIZE_LIST_GAP = 8;

/**
 * 计算「每页条数」弹层相对**屏幕**的绝对定位偏移。
 *
 * 对应 Web 版 `.sizeList` 的定位（弹层是 `.sizeChanger` 的绝对定位子节点）：
 *
 *     position: absolute;
 *     bottom: calc(100% + 8px);   // 向上弹出，底边贴触发区顶边上方 8px
 *     left: 0;                    // 与触发区左对齐
 *
 * RN 里弹层搬进了 `Modal`（见 `Pagination.tsx` 的结构性差异说明），不再是触发区的
 * 子节点，所以要自己把「触发区在屏幕上的位置」换算成绝对偏移：
 *
 *   - `bottom = 窗口高 - 触发区顶边 + 8`（`Modal` 的定位参照系是窗口）
 *   - `left = 触发区左边`
 *
 * 上游**没有**做右侧溢出处理（弹层不右对齐），这里同样不做 —— 保持 1:1。
 */
export const computeSizeListPosition = (trigger: Rect, win: WindowSize): PanelPosition => ({
    bottom: win.height - trigger.y + SIZE_LIST_GAP,
    left: trigger.x,
});
