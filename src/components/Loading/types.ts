import type React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

/**
 * ⚠️ 与 Web 版的差异（`types.ts` 原为 `extends React.HTMLAttributes<HTMLDivElement>`）：
 *
 * 1. 丢掉 `React.HTMLAttributes<HTMLDivElement>` —— 那是 DOM 属性集（`className` /
 *    `data-*` / `onMouseEnter` …），RN 里没有对应物。上游组件把 `...rest` 整个透传到
 *    根 `<div>`，Web 测试还用 `data-scope="snow"` 验证过这条通路；RN 侧改成显式的
 *    `style` + `testID`（与 Button / Collapse 的做法一致）。
 * 2. 新增 `style` / `testID`，对应 Web 的 `className`。
 */
export interface LoadingProps {
    /** 是否开启雪花屏（true / false 控制开启关闭）；false 时渐变消失 */
    active?: boolean;
    /** 雪花屏中央提示文字 */
    tip?: React.ReactNode;
    /** 延迟显示时间（毫秒），避免加载快速结束时闪烁；0 = 立即显示 */
    delay?: number;
    /** 渐变消失时长（秒） */
    fadeDuration?: number;
    /** 全屏层级，默认 3000（高于 Notification 的 2000） */
    zIndex?: number;
    /** 自定义样式（作用于最外层全屏容器） */
    style?: StyleProp<ViewStyle>;
    /** 测试标识（RN 里 `className` 的对应物） */
    testID?: string;
}
