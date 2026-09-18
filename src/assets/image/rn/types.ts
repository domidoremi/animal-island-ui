/**
 * 场景插画组件的公共 props。
 *
 * 放在单独文件里，让四个生成出来的组件（`CoffeeBreak` / `ForestGrove` /
 * `StarryCamp` / `SweetCorner`）共用同一个类型，而不是各自复制一份。
 */
export interface SceneImageProps {
    /** 渲染宽度，默认 '100%' */
    width?: number | string;
    /** 渲染高度，默认 '100%' */
    height?: number | string;
    /**
     * 同 SVG 的 `preserveAspectRatio`，默认 `'xMidYMid meet'`（react-native-svg 的默认值）。
     *
     * Background 的 `background-size: cover; background-position: center` 需要传
     * `'xMidYMid slice'`（等比放大到铺满并居中裁切）；Progress 按轨道宽度等比缩放，
     * 用默认的 `meet` 即可。
     */
    preserveAspectRatio?: string;
    /** 测试标识 */
    testID?: string;
}
