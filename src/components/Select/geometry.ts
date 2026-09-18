/**
 * Select 下拉面板的定位几何。
 *
 * 抽出来的理由与 TimePicker 的 `geometry.ts` 完全一致：定位靠 `measureInWindow`
 * 回调，而 jest preset 把它 mock 成**永不回调的空实现**
 * （`@react-native/jest-preset/jest/MockNativeMethods.js` 里是 `measureInWindow: jest.fn()`），
 * 所以面板在测试里永远落在兜底位置，翻边 / 对齐这些**判断**一个都跑不到。
 * 把它们算成纯函数单独测（`geometry.test.ts`），至少让「该摆在哪」这件事有覆盖。
 *
 * 上游 Web 版（`Select.tsx` 的 `useEffect`）：
 *
 *     const dropdownHeight = options.length * 44 + 24;
 *     if (rect.right + 200 > viewportWidth) { right: '100%'; marginRight: 6 }
 *     else { left: '100%'; marginLeft: 6 }
 *     const spaceBelow = viewportHeight - rect.bottom;
 *     const spaceAbove = rect.top;
 *     if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) { bottom: '100%'; marginBottom: 6 }
 *     else if (spaceBelow < dropdownHeight) { top: '100%'; marginTop: 6 }
 *     else if (rect.top < dropdownHeight) { top: '100%'; marginTop: 6 }
 *     else { top: '50%'; transform: 'translateY(-50%)' }
 *
 * 注意上游的语义与 TimePicker **不同**：Select 的下拉默认是**贴到触发区右侧**展开的
 * （`left: 100%`），只有右侧空间不足才翻到左侧；垂直方向默认**居中**，
 * 只有下方放不下（或触发区离顶部太近）才改成贴下 / 贴上。这里逐条照搬。
 */

/** 触发区最小宽度 —— 对应 `.wrapper { min-width: 140px }` */
export const TRIGGER_MIN_WIDTH = 140;

/** 下拉面板与触发区的间距 —— 对应上游的 `marginLeft / marginRight / marginTop / marginBottom: 6px` */
export const DROPDOWN_GAP = 6;

/** 单个选项的高度（含上下 padding 10px + 行高），上游估算用 —— 对应 `options.length * 44` */
export const OPTION_HEIGHT = 44;

/** 面板上下内边距合计 —— 对应 `.dropdown { padding: 12px 0 }` 即 `+ 24` */
export const DROPDOWN_VERTICAL_PADDING = 24;

/**
 * 水平翻边的阈值 —— 上游硬编码的 `rect.right + 200 > viewportWidth`。
 *
 * ⚠️ 这里**刻意保留上游的 200**，与 TimePicker 保留 `RIGHT_ALIGN_THRESHOLD = 260`
 * 是同一决定：200 只是「面板大概多宽」的估算（Less 里根本没有宽度声明，
 * 真实宽度是 `width: max-content`），比真实宽度保守，只影响翻边时机，不会摆错位置。
 * 属于上游的口味而非缺陷，不擅自改。
 */
export const HORIZONTAL_FLIP_THRESHOLD = 200;

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

/** 水平方向：面板贴在触发区右侧（默认）还是左侧（右侧放不下） */
export type DropdownSide = 'right' | 'left';

/** 垂直方向：贴下 / 贴上 / 相对触发区居中（默认） */
export type DropdownAlign = 'below' | 'above' | 'center';

/** 定位结论（不含具体像素） */
export interface DropdownPlacement {
    side: DropdownSide;
    align: DropdownAlign;
}

/** 面板的绝对定位偏移；`top` / `bottom` 与 `left` / `right` 各自只会出现一个 */
export interface DropdownPosition {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
}

/** 估算面板高度：`options.length * 44 + 24`（上游同名算式） */
export const dropdownHeight = (optionCount: number): number => optionCount * OPTION_HEIGHT + DROPDOWN_VERTICAL_PADDING;

/**
 * 决定面板往哪一侧、哪一个方向展开 —— 上游三个分支的纯函数版本。
 *
 * 分支顺序**必须**与上游一致，因为 `spaceBelow < dropdownHeight` 同时命中
 * 第二个和第三个分支时，上游先判「上方更宽裕就翻上去」。
 */
export const computeDropdownPlacement = (trigger: Rect, win: WindowSize, optionCount: number): DropdownPlacement => {
    const height = dropdownHeight(optionCount);

    const side: DropdownSide = trigger.x + trigger.width + HORIZONTAL_FLIP_THRESHOLD > win.width ? 'left' : 'right';

    const spaceBelow = win.height - (trigger.y + trigger.height);
    const spaceAbove = trigger.y;

    let align: DropdownAlign;
    if (spaceBelow < height && spaceAbove > spaceBelow) {
        align = 'above';
    } else if (spaceBelow < height) {
        align = 'below';
    } else if (trigger.y < height) {
        align = 'below';
    } else {
        align = 'center';
    }

    return { side, align };
};

/**
 * 把定位结论换算成相对**屏幕**的绝对偏移。
 *
 * 面板在 `Modal` 里，不再是触发区的子节点，所以上游那些
 * `left: 100%` / `right: 100%` / `top: 50% + translateY(-50%)` 的相对定位
 * 都要手算成屏幕坐标：
 *
 *   - side = right → `left = 触发区右边 + 6`
 *   - side = left  → `right = 窗口宽 - 触发区左边 + 6`（面板右边缘落在触发区左侧 6px 处）
 *   - align = below  → `top = 触发区底边 + 6`
 *   - align = above  → `bottom = 窗口高 - 触发区顶边 + 6`
 *   - align = center → `top = 触发区中线 - 面板高 / 2`
 */
export const computeDropdownPosition = (trigger: Rect, win: WindowSize, optionCount: number): DropdownPosition => {
    const { side, align } = computeDropdownPlacement(trigger, win, optionCount);
    const pos: DropdownPosition = {};

    if (side === 'right') {
        pos.left = trigger.x + trigger.width + DROPDOWN_GAP;
    } else {
        pos.right = win.width - trigger.x + DROPDOWN_GAP;
    }

    if (align === 'below') {
        pos.top = trigger.y + trigger.height + DROPDOWN_GAP;
    } else if (align === 'above') {
        pos.bottom = win.height - trigger.y + DROPDOWN_GAP;
    } else {
        pos.top = trigger.y + trigger.height / 2 - dropdownHeight(optionCount) / 2;
    }

    return pos;
};
