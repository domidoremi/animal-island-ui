/**
 * TimePicker 的滚动 / 定位几何。
 *
 * 这些算术被单独抽出来，是因为它们在组件里**无法被测试覆盖**：
 *   - 滚动靠 `ScrollView.scrollTo` 命令式调用，测试渲染器里没有原生滚动节点
 *     （`scrollTo` 内部 `getNativeScrollRef()` 为 null 会直接 return）；
 *   - 面板定位靠 `View.measureInWindow` 回调，测试渲染器的宿主实例**没有任何
 *     measure 成员**（实测 `Object.keys` 里 measure* 为空）。
 * 所以把「该滚到哪 / 该摆在哪」算成纯函数，单独单测。
 */

/** 单个选项高度 —— 对应 `.option { height: 28px }` */
export const OPTION_HEIGHT = 28;

/** 选项间距 —— 对应 `.columnList { gap: 2px }` */
export const OPTION_GAP = 2;

/** 列表内边距 —— 对应 `.columnList { padding: 2px }` */
export const LIST_PADDING = 2;

/** 相邻两个选项顶部的距离 */
export const OPTION_STRIDE = OPTION_HEIGHT + OPTION_GAP;

/** 列表可视高度上限 —— 对应 `.columnList { max-height: 232px }` */
export const LIST_MAX_HEIGHT = 232;

/**
 * 让第 `index` 个选项垂直居中时，列表应滚到的 y 偏移。
 *
 * 第 i 个选项的顶部 = `LIST_PADDING + i * OPTION_STRIDE`，让它的中线对准视口中线：
 *
 *     y = LIST_PADDING + i * OPTION_STRIDE + OPTION_HEIGHT / 2 - viewportHeight / 2
 *
 * 结果夹到 >= 0（`scrollTo` 不接受负偏移；Web 版靠 `scrollTop` 自身夹取）。
 *
 * ⚠️ **与上游 Web 版不一致 —— 有意修正一处真实缺陷。**
 * Web 版写的是：
 *
 *     // 条目高 28px + 间距 10px
 *     const itemHeight = 38;
 *     list.scrollTop = index * itemHeight - list.clientHeight / 2 + itemHeight / 2;
 *
 * 但 `time-picker.module.less` 里 `.option` 是 `height: 28px`、`.columnList` 是
 * `gap: 2px; padding: 2px` —— **真实步进是 30，不是 38**（注释里的「间距 10px」与样式表矛盾）。
 * 按 38 算，第 i 项会多滚 `8i` px：选到「10 时」时偏出 80px，越往后越离谱。
 * 这里按真实的 28 + 2 + 2 重算。
 */
export const centerOffset = (index: number, viewportHeight: number): number =>
    Math.max(0, LIST_PADDING + index * OPTION_STRIDE + OPTION_HEIGHT / 2 - viewportHeight / 2);

/** 面板宽度 —— 对应 `.panel { width: 248px }` */
export const PANEL_WIDTH = 248;

/** format 不含 ss 时的面板宽度 —— 对应 `.panelNoSeconds { width: 172px }` */
export const PANEL_WIDTH_NO_SECONDS = 172;

/** 面板与触发区的间距 —— 对应 Web 版的 `marginTop / marginBottom: 6px` */
export const PANEL_GAP = 6;

/**
 * 估算面板高度，用于判断下方是否放得下 —— Web 版同名常量，值同为 320。
 * （面板实际高度依赖列数与字体，Web 版也是估算，不追求精确。）
 */
export const PANEL_HEIGHT_ESTIMATE = 320;

/**
 * 右对齐阈值 —— Web 版硬编码的 `rect.left + 260 > window.innerWidth`。
 *
 * ⚠️ 这里**刻意保留上游的 260**，没有换成真实面板宽度（248 / 172）：
 * 260 比两个变体都宽，意味着面板在「刚好放得下」时也会提前右对齐。这只是保守，
 * 不会摆错位置，属于上游的口味而非缺陷，所以不擅自改。
 * （与 `centerOffset` 的区别：那个会真的把选中项滚偏，这个只是对齐时机更早。）
 */
export const RIGHT_ALIGN_THRESHOLD = 260;

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

/** 面板的绝对定位偏移；`top` / `bottom` 与 `left` / `right` 各自只会出现一个 */
export interface PanelPosition {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
}

/**
 * 计算面板相对**屏幕**的绝对定位偏移（面板在 `Modal` 里，不再是触发区的子节点）。
 *
 * 对应 Web 版这段（`position: absolute` 相对 wrapper）：
 *
 *     if (rect.bottom + panelHeight > viewportHeight && rect.top > viewportHeight - rect.bottom) {
 *         newStyle.bottom = '100%';  newStyle.marginBottom = '6px';
 *     } else {
 *         newStyle.top = '100%';     newStyle.marginTop = '6px';
 *     }
 *     if (rect.left + 260 > window.innerWidth) { newStyle.right = 0; newStyle.left = 'auto'; }
 *
 * 语义一一对应：
 *   - 默认向下展开（`top = 触发区底边 + 6`）；
 *   - 下方放不下**且**上方比下方更宽裕时向上翻转（`bottom = 窗口高 - 触发区顶边 + 6`）；
 *   - 右侧空间不足时右对齐（`right = 窗口宽 - 触发区右边`），否则左对齐。
 */
export const computePanelPosition = (trigger: Rect, win: WindowSize): PanelPosition => {
    const pos: PanelPosition = {};

    const spaceBelow = win.height - (trigger.y + trigger.height);
    const spaceAbove = trigger.y;
    if (spaceBelow < PANEL_HEIGHT_ESTIMATE && spaceAbove > spaceBelow) {
        pos.bottom = win.height - trigger.y + PANEL_GAP;
    } else {
        pos.top = trigger.y + trigger.height + PANEL_GAP;
    }

    if (trigger.x + RIGHT_ALIGN_THRESHOLD > win.width) {
        pos.right = win.width - (trigger.x + trigger.width);
    } else {
        pos.left = trigger.x;
    }

    return pos;
};
