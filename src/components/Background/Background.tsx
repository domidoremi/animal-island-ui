import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { CoffeeBreak, SweetCorner, type SceneImageProps } from '../../assets/image/rn';
import {
    BACKGROUND_PATTERN_SPEC,
    BackgroundLayer,
    BackgroundPatternLayer,
    SCENE_BASE_COLOR,
    type BackgroundPatternType,
} from './patterns';

/**
 * 背景图案类型（dots-* 波点壁纸的底色与 Card pattern-* 系列一致）：
 * - default 奶油色波点（默认）
 * - grid 24px 网格（边框色细线）
 * - dots-dark-green 深绿波点
 * - sprinkles 彩色针糖（圆柱形糖针随机散落）
 * - sweet-corner / coffee-break 场景背景图（Progress 场景图同款，cover 铺满）
 * - 其余 12 色 dots-* 底色对应 Card pattern-* 系列的粉彩波点壁纸
 *
 * 与上游 `BackgroundType` 的成员**完全一致**（只是把 16 个图案类收在
 * `BackgroundPatternType` 里再并上两张场景图；union 的书写顺序不影响语义）。
 */
export type BackgroundType = BackgroundPatternType | 'sweet-corner' | 'coffee-break';

/**
 * 场景图 type → RN 组件。
 *
 * Web 版这里是 `{ 'sweet-corner': sweetCorner, ... }`，值是 `.svg` 模块 import 出来的
 * **URL 字符串**，再塞进 CSS 的 `backgroundImage: url(...)`。
 * RN 没有 svg loader、也没有 CSS 背景，所以值换成了 `react-native-svg` 组件
 * （见 `src/assets/image/rn/`），由本组件直接渲染。
 */
const SCENE_IMAGE: Partial<Record<BackgroundType, React.FC<SceneImageProps>>> = {
    'sweet-corner': SweetCorner,
    'coffee-break': CoffeeBreak,
};

export interface BackgroundProps {
    /** 背景图案类型（dots-* 底色与 Card pattern-* 系列一致），默认奶油色波点 */
    type?: BackgroundType;
    /** 子内容，渲染在图案背景之上 */
    children?: React.ReactNode;
    /** 自定义样式（作用于最外层容器） */
    style?: StyleProp<ViewStyle>;
    /** 测试标识（RN 里 `className` 的对应物） */
    testID?: string;
}

/**
 * 装饰背景壁纸。
 *
 * 与 Web 版的结构差异（Web 把壁纸直接画在根 div 的 CSS 背景上）：
 * 根 `View` 只负责**底色**（`backgroundColor`，对应 CSS `background` 简写里最后那个颜色），
 * 图案 / 场景图放在一个绝对定位铺满、`pointerEvents="none"`、`aria-hidden` 的兄弟层里。
 * 原因是 RN 的 `View` 没有 CSS 背景，重复平铺只能靠 `react-native-svg` 的 `<Pattern>`；
 * 而「CSS 背景不参与命中测试、也不进无障碍树」这两点，用 `pointerEvents` / `aria-hidden` 补回。
 *
 * 上游 `BackgroundProps extends React.HTMLAttributes<HTMLDivElement>` 并在根 div 上
 * `{...rest}` 透传 DOM 属性（`onClick`、`id`、`data-*` …）。RN 没有 DOM 属性，
 * 这一整块被丢弃：只保留 `type` / `children` / `style` / `testID`。
 */
export const Background: React.FC<BackgroundProps> = ({ type = 'default', children, style, testID }) => {
    const Scene = SCENE_IMAGE[type];
    const pattern = BACKGROUND_PATTERN_SPEC[type as BackgroundPatternType];
    // 场景图类的底色来自 .bg-sweet-corner / .bg-coffee-break 的 background-color，
    // 图案类来自各自 background 简写的最后一个颜色
    const backgroundColor = Scene ? SCENE_BASE_COLOR : pattern.base;

    return (
        <View style={[styles.background, { backgroundColor }, style]} testID={testID}>
            <BackgroundLayer testID={testID ? `${testID}-layer` : undefined}>
                {Scene ? (
                    // CSS: background-size: cover; background-position: center
                    // → 等比放大到铺满并居中裁切（preserveAspectRatio 的 'slice' 即 cover）
                    <Scene width="100%" height="100%" preserveAspectRatio="xMidYMid slice" />
                ) : (
                    <BackgroundPatternLayer spec={pattern} testID={testID ? `${testID}-pattern` : undefined} />
                )}
            </BackgroundLayer>
            {children}
        </View>
    );
};

Background.displayName = 'Background';

const styles = StyleSheet.create({
    background: {
        // Web 的 `.background` 是 `position: relative`；RN(Yoga) 里绝对定位子节点本来就
        // 相对父节点定位，所以这行是照抄过来的**空操作**，留着只为和 Less 对齐。
        position: 'relative',
        width: '100%',
        minHeight: '100%',
    },
});
