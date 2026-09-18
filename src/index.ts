/**
 * animal-island-ui —— React Native 版入口。
 *
 * 注意：本文件在 `rn` 分支上是**增量**的。上游 Web 版有 34 个组件，
 * RN 版按「先做小样验证」的策略逐个移植，每移植一个就在这里加一行导出。
 * 上游 Web 版的完整导出清单见 `main` 分支的 `src/index.ts`。
 *
 * 与 Web 版的两点结构性差异：
 *   1. 不导入全局样式（Web 版这里是 `import './styles/index.less'`）。
 *      RN 没有全局 CSS，样式通过 `src/theme/tokens.ts` 注入。
 *   2. 不导出 `className` 类 API，改用 `style` + `testID`。
 */

// ============================================
// 设计 token
// ============================================
export * from './theme/tokens';

// ============================================
// 图标（RN 自建：上游的 naive-icons 是 DOM-only 库，RN 用不了）
// ============================================
export { DonutIcon, FishIcon, ImageIcon, BaseIcon, naivePalette } from './icons';
export type { IconProps } from './icons';

// ============================================
// 基础 UI 组件
// ============================================
export { Button } from './components/Button';
export type { ButtonProps, ButtonType, ButtonSize } from './components/Button';

export { Collapse } from './components/Collapse';
export type { CollapseProps } from './components/Collapse';

export { Divider } from './components/Divider';
export type { DividerProps, DividerType } from './components/Divider';
