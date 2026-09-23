/**
 * animal-island-ui —— React Native 版入口。
 *
 * 注意：本文件在 `rn` 分支上是**增量**的。上游 Web 版有 34 个组件，
 * RN 版逐个移植，每移植一个就在这里加一行导出。当前 27 / 34。
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
export * from './theme/appearance';
export { ThemeProvider, useTheme } from './theme/ThemeProvider';
export type { ThemeProviderProps } from './theme/ThemeProvider';
export { ThemeTransitionProvider, useThemeTransition } from './theme/ThemeTransition';
export type { ThemeTransitionOptions, ThemeTransitionProviderProps } from './theme/ThemeTransition';

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

export { Carousel } from './components/Carousel';
export type { CarouselProps } from './components/Carousel';

export { Checkbox } from './components/Checkbox';
export type { CheckboxProps, CheckboxOption, CheckboxSize } from './components/Checkbox';

export { CodeBlock } from './components/CodeBlock';
export type { CodeBlockProps } from './components/CodeBlock';

export { Collapse } from './components/Collapse';
export type { CollapseProps } from './components/Collapse';

export { Countdown } from './components/Countdown';
export type { CountdownProps, CountdownSize, CountdownVariant } from './components/Countdown';

export { Cursor } from './components/Cursor';
export type { CursorProps, CursorType } from './components/Cursor';

export { DatePicker } from './components/DatePicker';
export type { DatePickerProps, DatePickerSize, DatePickerStatus, DatePickerValue } from './components/DatePicker';

export { Divider } from './components/Divider';
export type { DividerProps, DividerType } from './components/Divider';

export { Drawer } from './components/Drawer';
export type { DrawerProps, DrawerPlacement } from './components/Drawer';

export { Footer } from './components/Footer';
export type { FooterProps } from './components/Footer';

export { Form } from './components/Form';
export type {
    FormInstance,
    FormProps,
    FormItemProps,
    FormLayout,
    FormLabelAlign,
    FormSize,
    FormItemLayout,
    ValidateStatus,
    ValidateError,
    ValidateInfo,
    FieldData,
    NamePath,
    RuleObject,
    RuleRender,
    RuleType,
    Rules,
    StoreValue,
    ColProps,
    RequiredMark,
    ScrollOptions,
} from './components/Form';
export { useForm } from './components/Form';
export type { FormProviderProps } from './components/Form';

export { Image } from './components/Image';
export type { ImageProps, ImageColor } from './components/Image';

export { Input } from './components/Input';
export type { InputProps, InputSize, InputChangeEvent } from './components/Input';

export { Loading } from './components/Loading';
export type { LoadingProps } from './components/Loading';

export { Modal } from './components/Modal';
export type { ModalProps, ModalVariant } from './components/Modal';

export { Notification, NotificationHost, notificationOpen, notificationDestroy } from './components/Notification';
export type {
    NotificationStatic,
    NotificationConfig,
    NotificationItem,
    NotificationType,
    NotificationPosition,
    NotificationPlacement,
} from './components/Notification';

export { Pagination } from './components/Pagination';
export type { PaginationProps } from './components/Pagination';

export { Progress } from './components/Progress';
export type { ProgressProps, ProgressSize } from './components/Progress';

export { Radio } from './components/Radio';
export { RadioGroup } from './components/Radio/RadioGroup';
export type { RadioGroupProps } from './components/Radio/RadioGroup';
export type { RadioProps, RadioOption, RadioSize } from './components/Radio';

export { Select } from './components/Select';
export type { SelectProps, SelectOption } from './components/Select';

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

export { Table } from './components/Table';
export type { TableProps, TableColumn } from './components/Table';

export { Tabs } from './components/Tabs';
export type { TabsProps, TabItem } from './components/Tabs';

export { Tag } from './components/Tag';
export type { TagProps, TagSize, TagVariant, TagColor } from './components/Tag';

export { Time } from './components/Time';
export type { TimeProps } from './components/Time';

export { TimePicker } from './components/TimePicker';
export type { TimePickerProps, TimePickerSize, TimePickerStatus, TimePart } from './components/TimePicker';

export { Title } from './components/Title';
export type { TitleProps, TitleSize, TitleColor } from './components/Title';

export { Typewriter } from './components/Typewriter';
export type { TypewriterProps } from './components/Typewriter';

export { Tooltip } from './components/Tooltip';
export type { TooltipProps, TooltipPlacement, TooltipTrigger, TooltipVariant } from './components/Tooltip';
