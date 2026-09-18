/**
 * 上游 Web 版的场景插画（`src/assets/image/*.svg`）的 React Native 版本。
 *
 * Web 版里这些 `.svg` 是**模块**（由 vite / webpack 的 svg loader 处理），
 * `import sweetCorner from '../../assets/image/sweet-corner.svg'` 拿到的是一个 URL 字符串，
 * 再交给 CSS 的 `background-image: url(...)`。RN 既没有 bundler 的 svg loader，
 * 也没有 CSS background-image，所以每个用到的场景图都转成了一个
 * `react-native-svg` 组件，由调用方直接渲染。
 *
 * 转换范围：**只转 Background / Progress 实际引用的 4 张**。
 * `src/assets/image/svg/desktop/` 下的 30 张壁纸（01-sky-drift … 30-starry-camp）
 * 在当前 RN 子集里**没有任何组件引用**，因此没有转换。
 *
 * 转换是机械的、一次性的：整棵 SVG 树按标签一一映射到 react-native-svg 的同名组件
 * （`<svg>`→`<Svg>`、`<g>`→`<G>`、`<use>`→`<Use>`、`<pattern>`→`<Pattern>` …），
 * 只把 `stroke-width` 改成 `strokeWidth`、把根节点的 `width`/`height` 改成 props。
 * 每个文件的头部注释记录了各自的细节。
 */
export { CoffeeBreak } from './CoffeeBreak';
export { ForestGrove } from './ForestGrove';
export { StarryCamp } from './StarryCamp';
export { SweetCorner } from './SweetCorner';
export type { SceneImageProps } from './types';
