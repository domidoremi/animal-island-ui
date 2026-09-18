/**
 * Carousel 的分页 / 索引几何。
 *
 * 这些算术被单独抽出来，是因为它们在组件里**无法被测试覆盖**：
 * `ScrollView.scrollTo` 需要原生滚动节点，测试渲染器里只有 jest preset 的
 * mock（`@react-native/jest-preset/jest/mocks/ScrollView.js` 把 `scrollTo` 定义成
 * `jest.fn()`），它**不会真的滚动**，也不会产生 `onMomentumScrollEnd`。
 * 所以把「该滚到哪 / 滚到了第几页」算成纯函数，单独单测；
 * 组件里的命令式调用只能断言「调用参数对不对」。
 */

/**
 * 把索引夹到 `[0, maxIndex]`。
 *
 * 上游同名函数：`Math.min(Math.max(value, 0), Math.max(max, 0))` —— 逐字照搬，
 * 包括 `Math.max(max, 0)`（`maxIndex` 为 -1 即空列表时夹到 0）。
 */
export const clampIndex = (value: number, maxIndex: number): number =>
    Math.min(Math.max(value, 0), Math.max(maxIndex, 0));

/**
 * 上游 `goTo` 里的索引归一化：
 *
 *     if (loop) normalized = (nextIndex + slides.length) % slides.length;
 *     else normalized = clamp(nextIndex, lastIndex);
 *
 * 逐字照搬（含 `(n + len) % len` 这个写法 —— 它只对 `-len < n < 2*len` 正确，
 * 但 `goTo` 的入参只可能是 `currentIndex ± 1` 或圆点索引，落在这个区间内，
 * 所以不擅自换成更「稳」的写法，避免无谓的行为差异）。
 *
 * `count === 0`（没有子元素）时上游在 `goTo` 开头就 return，这里返回 0 只是兜底。
 */
export const normalizeIndex = (nextIndex: number, count: number, loop: boolean): number => {
    if (count === 0) return 0;
    return loop ? (nextIndex + count) % count : clampIndex(nextIndex, count - 1);
};

/** 第 `index` 页的横向滚动偏移。`pagingEnabled` 下每页正好一屏宽。 */
export const snapOffset = (index: number, pageWidth: number): number => index * pageWidth;

/**
 * 从 `onMomentumScrollEnd` 的 `contentOffset.x` 反推当前页。
 *
 * 用四舍五入而非 `Math.floor`：用户滑到两页中间松手时，ScrollView 会吸附到**更近**的一页，
 * 四舍五入正是这次吸附的结果。
 * `pageWidth <= 0`（还没量到宽度）时返回 0，避免除零得到 `Infinity`。
 */
export const indexFromOffset = (offsetX: number, pageWidth: number, count: number): number => {
    if (count === 0 || pageWidth <= 0) return 0;
    return clampIndex(Math.round(offsetX / pageWidth), count - 1);
};
