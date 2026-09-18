/**
 * animal-island-ui —— React Native 版入口。
 *
 * 注意：本文件在 `rn` 分支上是**增量**的。上游 Web 版有 34 个组件，
 * RN 版逐个移植，每移植一个就在这里加一行导出。当前 16 / 34。
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
// 场景插画（上游的 .svg 资源模块 → react-native-svg 组件）
// ============================================
export { CoffeeBreak, ForestGrove, StarryCamp, SweetCorner } from './assets/image/rn';
export type { SceneImageProps } from './assets/image/rn';

// ============================================
// 基础 UI 组件
// ============================================
export { BackTop } from './components/BackTop';
export type { BackTopProps } from './components/BackTop';

export { Background } from './components/Background';
export type { BackgroundProps, BackgroundType } from './components/Background';

export { Button } from './components/Button';
export type { ButtonProps, ButtonType, ButtonSize } from './components/Button';

export { Card } from './components/Card';
export type { CardProps, CardType, CardColor, CardPattern } from './components/Card';

export { Collapse } from './components/Collapse';
export type { CollapseProps } from './components/Collapse';

export { Cursor } from './components/Cursor';
export type { CursorProps, CursorType } from './components/Cursor';

export { Divider } from './components/Divider';
export type { DividerProps, DividerType } from './components/Divider';

export { Footer } from './components/Footer';
export type { FooterProps } from './components/Footer';

export { Loading } from './components/Loading';
export type { LoadingProps } from './components/Loading';

export { Progress } from './components/Progress';
export type { ProgressProps, ProgressSize } from './components/Progress';

export { Skeleton, SkeletonButton, SkeletonInput, SkeletonAvatar } from './components/Skeleton';
export type {
    SkeletonProps,
    SkeletonVariant,
    SkeletonButtonProps,
    SkeletonInputProps,
    SkeletonAvatarProps,
} from './components/Skeleton';

export { Switch } from './components/Switch';
export type { SwitchProps, SwitchSize } from './components/Switch';

export { Tag } from './components/Tag';
export type { TagProps, TagSize, TagVariant, TagColor } from './components/Tag';

export { Time } from './components/Time';
export type { TimeProps } from './components/Time';

export { TimePicker } from './components/TimePicker';
export type { TimePickerProps, TimePickerSize, TimePickerStatus, TimePart } from './components/TimePicker';

export { Title } from './components/Title';
export type { TitleProps, TitleSize, TitleColor } from './components/Title';
