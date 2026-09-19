import type { ViewStyle } from 'react-native';
import type { TooltipPlacement, TooltipVariant } from './Tooltip';

/**
 * Tooltip 的几何计算 —— 抽成纯函数是因为**测不到**：
 * 气泡相对触发器的位置在这个测试渲染器里没有任何可观测效果（RNTL 不做布局），
 * 只能对算术本身做单测。与 `TimePicker/geometry.ts`、`Select/geometry.ts` 同一套做法。
 */

/** `.tooltip { bottom: calc(100% + 10px) }` 里的 10px */
export const TOOLTIP_GAP = 10;
/** `.tooltip::after { width/height: 8px }` */
export const ARROW_SIZE = 8;
/** `.island.bordered .tail { width/height: 10px }` */
export const ISLAND_ARROW_SIZE = 10;
/** 默认变体的箭头沿副轴的内缩：`.top_start::after { left: 16px }` */
export const ARROW_INSET = 16;
/** island 变体的内缩：`.island.bordered.top_start .tail { left: 20px }` */
export const ISLAND_ARROW_INSET = 20;
/** 箭头伸出气泡外的距离：`.top::after { bottom: -5px }` */
export const ARROW_STICK_OUT = 5;
export const TOOLTIP_BG = 'rgb(247, 243, 223)';
export const TOOLTIP_BORDER = '#c4b89e';
/** island 有机轮廓的填充色（上游 `ISLAND_BG`） */
export const ISLAND_BG = 'rgb(247, 243, 223)';
/** island 有机轮廓的描边色（上游 `ISLAND_STROKE`） */
export const ISLAND_STROKE = '#c4b89e';

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';
export type TooltipAlign = 'center' | 'start' | 'end';

export type PlacementBox = { side: TooltipSide; align: TooltipAlign };

/** `bottom-start` → `{ side: 'bottom', align: 'start' }`；`top` → align 默认 `'center'` */
export const splitPlacement = (placement: TooltipPlacement): PlacementBox => {
    const parts = placement.split('-');
    const side = parts[0] as TooltipSide;
    const align = (parts[1] as TooltipAlign | undefined) ?? 'center';
    return { side, align };
};

/**
 * 气泡主体的定位样式。
 *
 * Web 侧靠 `bottom: calc(100% + 10px)` 把气泡推到触发器上方；RN 没有 `calc`，
 * 用 `bottom: '100%'` + `marginBottom: 10` 表达同一件事。
 * 侧向居中 Web 用 `left: 50%; transform: translateX(-50%)`，RN 的 translate
 * 不接受百分比，改用 `alignSelf: 'center'`（RN 惯用法）。
 *
 * ⚠️ `left` / `right` 两个方向的**垂直**居中 RN 没有等价写法（没有 translateY 百分比），
 * 交给 `verticalCenterTop()` 按测量值算；未测量到尺寸时退化为顶部对齐。
 */
export const bubbleStyle = (box: PlacementBox, gap: number = TOOLTIP_GAP): ViewStyle => {
    const outward: ViewStyle =
        box.side === 'top'
            ? { bottom: '100%', marginBottom: gap }
            : box.side === 'bottom'
              ? { top: '100%', marginTop: gap }
              : box.side === 'left'
                ? { right: '100%', marginRight: gap }
                : { left: '100%', marginLeft: gap };

    if (box.side === 'top' || box.side === 'bottom') {
        const cross: ViewStyle =
            box.align === 'center' ? { alignSelf: 'center' } : box.align === 'start' ? { left: 0 } : { right: 0 };
        return { ...outward, ...cross };
    }

    // 侧向：center 不在这里给偏移，由测量值补 top
    const cross: ViewStyle = box.align === 'center' ? {} : box.align === 'start' ? { top: 0 } : { bottom: 0 };
    return { ...outward, ...cross };
};

/**
 * `left` / `right` 的垂直居中偏移。
 * 未测量到任一侧尺寸时返回 `null`，表示「先按顶部对齐」。
 */
export const verticalCenterTop = (wrapperHeight: number | undefined, tipHeight: number | undefined): number | null => {
    if (wrapperHeight == null || tipHeight == null) return null;
    return Math.max(0, (wrapperHeight - tipHeight) / 2);
};

/** 每个方向该给箭头哪两条边描边（Web 用 rotate(45deg) 的方块 + 两条 border 拼出小三角） */
const ARROW_BORDERS: Record<TooltipSide, ViewStyle> = {
    top: { borderRightWidth: 2, borderBottomWidth: 2 },
    bottom: { borderTopWidth: 2, borderLeftWidth: 2 },
    left: { borderTopWidth: 2, borderRightWidth: 2 },
    right: { borderBottomWidth: 2, borderLeftWidth: 2 },
};

/**
 * 箭头的定位样式（Web 侧是 `.tooltip::after` 伪元素，RN 必须有真实节点）。
 *
 * 居中时 Web 用 `left: 50%; transform: translateX(-50%) rotate(45deg)`，
 * RN 用 `left: '50%'` + `marginLeft: -size/2`（等价且可测）。
 */
export const arrowStyle = (box: PlacementBox, variant: TooltipVariant, bordered: boolean): ViewStyle => {
    const size = variant === 'island' ? ISLAND_ARROW_SIZE : ARROW_SIZE;
    const inset = variant === 'island' ? ISLAND_ARROW_INSET : ARROW_INSET;

    const base: ViewStyle = {
        position: 'absolute',
        width: size,
        height: size,
        backgroundColor: TOOLTIP_BG,
        borderColor: TOOLTIP_BORDER,
        transform: [{ rotate: '45deg' }],
    };

    const outward: ViewStyle =
        box.side === 'top'
            ? { bottom: -ARROW_STICK_OUT }
            : box.side === 'bottom'
              ? { top: -ARROW_STICK_OUT }
              : box.side === 'left'
                ? { right: -ARROW_STICK_OUT }
                : { left: -ARROW_STICK_OUT };

    const cross: ViewStyle =
        box.side === 'top' || box.side === 'bottom'
            ? box.align === 'center'
                ? { left: '50%', marginLeft: -size / 2 }
                : box.align === 'start'
                  ? { left: inset }
                  : { right: inset }
            : box.align === 'center'
              ? { top: '50%', marginTop: -size / 2 }
              : box.align === 'start'
                ? { top: inset }
                : { bottom: inset };

    // island.borderless 是个圆点，不描边、不旋转
    if (variant === 'island' && !bordered) {
        return {
            ...base,
            ...outward,
            ...cross,
            width: 14,
            height: 14,
            borderRadius: 7,
            transform: undefined,
        };
    }

    return { ...base, ...outward, ...cross, ...(bordered ? ARROW_BORDERS[box.side] : null) };
};
