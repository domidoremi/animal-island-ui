# RN-PORT.md — 把 animal-island-ui 移植到 React Native

> 本文是 [`RN-PORT.md`](../RN-PORT.md) 的中文镜像，按仓库约定（英文为主 + 中文镜像）。
> 两者含义必须一致；**有冲突时以英文版为准**。技术名词保持英文。

本 fork 的 `rn` 分支把组件库从 React DOM 移植到 React Native。本文记录**决策**、
**与上游的有意分歧**、以及**测试覆盖不到的部分** —— 让下一个人不必重新推导一遍。

上游 `main` 未被改动：Web 版组件库（34 个组件、Less Modules、Vitest、Vite）仍留在磁盘上。
RN 移植是**增量**的 —— 它靠 `tsconfig.json`、`tsconfig.build.json`、`jest.config.js`
三处显式 include 白名单隔离，未移植的 Web 组件不会进入 RN 的 typecheck 或测试。

## 状态

| 层             | 已移植 | 测试 | 备注                                                           |
| -------------- | ------ | ---- | -------------------------------------------------------------- |
| design tokens  | ✅     | 52   | `src/theme/tokens.ts`，与 `src/styles/variables.less` 1:1 对应 |
| Divider        | ✅     | 12   | wave / squiggle 平铺用 `react-native-svg` 重建                 |
| Button         | ✅     | 21   | 另建了一套 RN 图标集（`src/icons/`）                           |
| Collapse       | ✅     | 14   | CSS Grid `0fr → 1fr` → 测量高度 + `Animated`                   |
| TimePicker     | ✅     | 22   | 面板移入 `Modal`；几何计算抽到 `geometry.ts`（+15 测试）       |
| 其余 30 个组件 | ❌     | —    | 未改动的 Web 源码                                              |

`npm run ci` = `format:check` + `lint` + `typecheck` + `test` + `build`。当前 **136 用例 / 6 套件**。

### ⚠️ 本分支放弃了什么

为 RN 重写 `package.json` **移除了 Web 工具链**（vite、vitest、less、`@testing-library/react`）。
eslint 被重新接回，但按 RN 的方式 —— 见「Linting」。因此在 `rn` 分支上：

- `npm run ci` 是 **RN** 流水线。上游的 `ci` 还跑了 `check:docs` 与 `test:a11y`，
  这两项在本分支没有对应物。
- 仍在磁盘上的 Web 组件在本分支**不受任何验证**。它们的流水线在 `main` 上。
  若你在这里改 Web 组件，后果自负。
- `.githooks/pre-commit` **未启用**（`core.hooksPath` 未设置），所以没有东西会自动跑 `ci`
  —— 提交前请自己跑。

## 工具链决策

| 决策                                          | 原因                                                                                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `react-native@0.87.1`、`react@19.2.x`         | 当时的最新稳定版；RN 0.87 的 peer 是 `react@^19.2.3`。                                                                                            |
| `preset: '@react-native/jest-preset'`         | **RN 0.87 把 jest preset 从 `react-native` 包里拆出去了。** 写 `preset: 'react-native'` 会报 `Module react-native should have "jest-preset.js"`。 |
| `jest@29`（不是 30）                          | 与官方模板 `@react-native-community/template@0.87.1` 一致；jest 30 会弄坏 preset。                                                                |
| `tsconfig.build.json` 用 `module: "node16"`   | RN 0.87 的类型在 `react-native/types_generated/index.d.ts`，只能通过 `package.json#exports` 触达。node10 解析 → `TS7016`。                        |
| `prettier` 锁 `3.8.4`                         | 上游 lockfile 锁的是 3.8.4；`^3.4.0` 会解析到 3.9.x，它会重排 union 类型，导致**未改动的上游文件**也过不了 `format:check`。                       |
| eslint 9 + `@react-native/eslint-config/flat` | RN 自己的配置；它需要的两处修补见「Linting」。                                                                                                    |
| `react-native-svg` 作为 peer dependency       | 本库渲染真实 SVG；宿主 App 必须自行安装。                                                                                                         |

## Linting

上游的 `eslint.config.js` 是 ESM，且 import 了 vite / react-refresh 插件 —— 两者在本分支
都无意义 —— 所以是**整体替换**而非扩展。替换后的配置是 CJS，因为本分支的 `package.json`
没有 `"type": "module"`（上游有）。

基线是 `@react-native/eslint-config/flat`，它需要两处修补：

1. **`eslint-plugin-ft-flow@2.0.1` 在 eslint 9 上直接崩** ——
   只要 lint 任何 `.js` 文件就报 `TypeError: context.getAllComments is not a function`。
   RN 的配置依赖 `^2.0.1`，所以 `package.json` 加了一条 override 到 `^3.0.11`。
   （我此前「RN 的配置仍要 eslint 8」的说法是**错的**：0.87.1 声明的是
   `eslint: ^8.0.0 || ^9.0.0`，并提供 `./flat` 入口。）
2. **`eqeqeq` 是 `['error', 'always', { null: 'ignore' }]`**，不是裸的 `'always'`。
   上游那种裸写法会把它自己 9 个组件里的 `x != null` 全标成错误；而 `null: 'ignore'`
   正是「既非 null 也非 undefined」的惯用写法，所以改配置、不改代码。

**未移植的组件是动态忽略的。** `eslint.config.js` 会扫 `src/components/*/`，把
`<Name>.tsx` 里不含 `from 'react-native'` 的目录整体忽略。这个判据是自维护的：
移植一个组件它就自动进入 lint 范围，所以 lint **不需要**逐组件登记
（这一点与那三处 include 白名单不同）。

## 移植契约（Web → RN）

| Web                                                                                      | RN                                                      | 备注                                                   |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------ |
| `className` + `*.module.less`                                                            | `style`（组件文件内 `StyleSheet.create`）+ `testID`     | RN 没有 class 体系；Less 文件留在磁盘上供 Web 构建用   |
| `onClick`                                                                                | `Pressable` 的 `onPress`                                |                                                        |
| `:hover`                                                                                 | —                                                       | 丢弃：触摸端没有 hover                                 |
| `:active`                                                                                | `Pressable` style 回调给的 `pressed`                    |                                                        |
| `onMouseDown={e => e.preventDefault()}`（保持焦点）                                      | —                                                       | 丢弃：`View` 没有焦点语义                              |
| `ResizeObserver` / `clientWidth`                                                         | `onLayout`                                              |                                                        |
| CSS `repeating-linear-gradient`                                                          | SVG `strokeDasharray`                                   | Divider                                                |
| CSS data-URI SVG 平铺                                                                    | 循环里的 `<Path transform="translate(...)">`            | Divider                                                |
| CSS Grid `grid-template-rows: 0fr → 1fr`                                                 | 先 `onLayout` 测量，再用 `Animated.Value` 驱动 `height` | Collapse                                               |
| `@keyframes`                                                                             | `Animated.loop` + `Easing.linear`                       | Button 的 loading 转圈                                 |
| `box-shadow: <字符串>`                                                                   | `boxShadow: <字符串>`（RN 0.76+，CSS 语法）             | **Android 上需要新架构**                               |
| `@font-face` + woff2                                                                     | —                                                       | woff2 是 Web 专属；宿主 App 需自行提供 ttf/otf（见下） |
| `position: absolute` 的 popover（放在 `position: relative` 包裹层里）                    | `Modal` + `measureInWindow` 定位                        | TimePicker —— 见「结构性分歧」                         |
| `document.addEventListener('mousedown')`（点击外部）                                     | `Modal` 内的全屏透明 `Pressable`                        | 行为一致，但没有视觉遮罩                               |
| `window.innerHeight` / `innerWidth`                                                      | `useWindowDimensions()`                                 |                                                        |
| `list.scrollTop` / `list.clientHeight`                                                   | `ScrollView` + `onLayout` + `scrollTo({ y })`           | TimePicker 的列                                        |
| `onKeyDown`（Enter / Escape / 方向键）                                                   | —                                                       | `Modal.onRequestClose` 覆盖 Android 返回键             |
| `role`、`aria-label`、`aria-labelledby`、`aria-expanded`、`aria-disabled`、`aria-hidden` | 同名 prop                                               | RN 0.87 支持 ARIA 风格 props                           |
| `aria-controls`、`aria-haspopup`                                                         | —                                                       | **RN 没有对应物**                                      |
| `tabIndex={0}` / `{-1}`                                                                  | `tabIndex` → `focusable`                                |                                                        |
| SVG `stroke="currentColor"`                                                              | 把颜色显式传进图标                                      | RN 没有 `currentColor`                                 |

## 结构性分歧（不只是改名）

### 1. TimePicker 的面板放在 `Modal` 里

Web 上面板是 trigger 包裹层的绝对定位子元素，所以 `top: 100%` / `bottom: 100%`
天然相对 trigger 解析。在 RN 里这种做法会被**任何带 `overflow: hidden` 的祖先裁掉**
—— 而每个 `ScrollView` 都算 —— 且 `zIndex` 只能排序兄弟节点。于是面板移进一个透明
`Modal`，由组件自己测量 trigger：

```tsx
trigger.measureInWindow((x, y, width, height) =>
    setPanelPosition(computePanelPosition({ x, y, width, height }, windowSize))
);
```

`computePanelPosition`（在 `geometry.ts` 里）是一个纯函数，用屏幕坐标复现上游的
向下翻 / 向上翻 / 右对齐逻辑，并有单测。

### 2. Collapse 的面板**不**设 `accessible`

恢复 `role="region"` + `aria-labelledby` 是做得到的（RN 0.87 两者都支持），
但面板上**故意不设** `accessible={true}`：RN 会把容器的子节点合并成一个可访问性节点，
那会把富文本甚至可交互的 `answer` 压成一坨。Web 的 `region` 是不合并的 landmark，
所以不设反而更接近。代价：iOS 上这个 landmark 可能因此不被播报。

## 与上游行为的有意分歧

以下是 RN 版**没有**照上游做的地方。每一处都在改动点写了注释。

1. **TimePicker 列的居中：步进 `38` → `30`。修掉了一个真实的上游缺陷。**
   上游算的是 `list.scrollTop = index * 38 - clientHeight / 2 + 19`，注释写「条目高 28px + 间距 10px」。
   但 `time-picker.module.less` 里是 `.option { height: 28px }` 与
   `.columnList { gap: 2px; padding: 2px }` —— 真实步进是 **30**，注释与样式表自相矛盾。
   index 为 10 时上游会多滚 80px，且误差随下标增长。
   `centerOffset()` 用真实数值重算，并在 0 处夹取。
   见 `geometry.ts` 与 `geometry.test.ts` 里的算术。
2. **TimePicker 的选项暴露了 `accessibilityState.selected`。这是新增的，上游没有。**
   上游只用视觉 class（`.optionSelected`）标记选中项，所以读屏用户选完后得不到任何确认。
   这一项是增量且可回退的；不改变视觉与行为。
3. **TimePicker 的右对齐阈值：保留上游硬编码的 `260`。没有改。**
   `260` 比两种面板宽度（248 / 172）都大，所以面板会比严格必要更早右对齐。
   与 (1) 不同，这从不会把面板放错位置 —— 它是偏好而非缺陷 —— 所以有意不动。
   **已标出，待决策。**
4. **TimePicker 的面板不设 `nativeID`。** 上游设了 `id={panelId}`，好让 trigger 的
   `aria-controls` 指过去。既然 RN 没有 `aria-controls`，永远不会有东西引用这个 id，
   所以删掉而不是留成死代码。
5. **trigger 上的 `aria-haspopup` / `aria-controls` 被丢弃**，Web 的键盘用例
   （Tab 聚焦、Enter、Escape）也从测试套件里删掉 —— RN 没有 DOM 键盘事件。
   改为测试 `Modal.onRequestClose`（Android 返回键）。

## 未测面 —— 仅靠构造保证

在相信这个绿色构建之前，请先诚实面对这一点：

| 范围                                               | 为什么在这里测不到                                                                                                                                                                                                |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TimePicker 面板定位                                | jest preset 把 `measureInWindow` mock 成裸 `jest.fn()`（`@react-native/jest-preset/jest/MockNativeMethods.js`）—— 它**从不回调**。所以面板渲染在兜底位置 `{ top: 0, left: 0 }`。                                  |
| TimePicker 列的居中                                | `ScrollView.scrollTo` 需要原生滚动节点，测试渲染器里没有。**改为对算术做单测。**                                                                                                                                  |
| `boxShadow` 真的渲染出来                           | 全仓没有任何视觉断言。且 Android 上需要新架构；旧架构下阴影会被静默丢弃。                                                                                                                                         |
| 字体                                               | `fontFamily` 默认是 `undefined`。woff2 在 RN 里用不了；想要海岛观感的宿主 App 必须自带 Nunito + Noto Sans SC 的 ttf/otf，并通过 theme 覆盖。                                                                      |
| `onStartShouldSetResponder` 是否真的挡住了触摸穿透 | RNTL 触发事件时会**向上**走树找 handler；而 Modal 的 backdrop 是**兄弟**节点，所以即使没有这道防护，朴素的 `fireEvent.press(panel)` 也会通过。测试改为断言机制本身（`onStartShouldSetResponder()` 返回 `true`）。 |

### 兜底定位为什么不会闪

`measureInWindow` 是回调式的，所以面板先挂载在兜底位置，下一帧才被纠正。它不闪，
因为面板同时在用 200ms 从 `opacity: 0` 淡入 —— 淡入开头的一帧位置纠正是看不出来的。

## 测试笔记（RNTL v14 + RN 0.87 的坑）

- **`render` 与 `fireEvent` 是 async 的** —— React 19 的异步 `act`。永远要 `await`。
- **`fireEvent(node, 'pressIn')` 对 `Pressable` 无效。** Pressability 把
  `onResponderGrant` / `onResponderRelease` 挂在宿主 view 上，从不暴露 `onPressIn`。
  Button 的测试直接触发 responder 序列，并给出完整的事件形状，包括
  `currentTarget: { measure: () => {} }`（Pressability 会调 `this._responderID.measure(...)`）。
- **Pressability 会等 130ms**（`DEFAULT_MIN_PRESS_DURATION`）才发出 `pressOut`，
  所以 press-out 断言需要 `await waitFor(...)`。
- **`getByRole` 受 `isAccessibilityElement` 门控**，而它对非 Text 宿主**只有显式设了
  `accessible` 才返回 `true`**。`Pressable` 会自动设，所以 `getByRole('button')` /
  `('combobox')` 可用；裸 `<View role="region">` 对 `getByRole` 不可见，即使带
  `includeHiddenElements: true`。这种情况改为断言它的 props。
- **`computeAccessibleName` 不理会 `aria-hidden` 与 `accessible={false}`** —— 它会走遍所有子节点。
  所以当装饰性的 `+`/`−` 字符也在里面时，「按钮以问题文本命名」这件事无法断言；
  改为断言 `accessibilityState` 或那个字符。
- **JS 驱动的 `Animated` 需要 fake timers。** `useNativeDriver: false` 会逐帧更新 React；
  没有 fake timers 时这些帧会落在 `act` 之外，把输出刷满 "not wrapped in act(...)" 警告。
  见 `Collapse.test.tsx`。
- **`getByTestId` 返回的是宿主元素**，所以你看到的是 RN 的 `View.js` 把 `aria-*`
  改写为 `accessibility*` **之后**的 props —— **但** jest preset 把 `View` 整个 mock 掉了
  （`setup.js` → `mocks/View.js` → `mockComponent`），而这个 mock **原样**透传 props。后果：

    | 写法                     | 测试里的宿主 props        | 真机上的宿主 props（`View.js`）                             |
    | ------------------------ | ------------------------- | ----------------------------------------------------------- |
    | `<Pressable aria-label>` | `accessibilityLabel`      | 相同 —— `Pressable` 在 JS 里自己转换，且**没被** mock       |
    | `<View aria-label>`      | `aria-label`（原始）      | `accessibilityLabel`                                        |
    | `<View aria-labelledby>` | `aria-labelledby`（原始） | `accessibilityLabelledBy`（数组）                           |
    | `<View aria-hidden>`     | `aria-hidden`（原始）     | `accessibilityElementsHidden` + `importantForAccessibility` |
    | `<View role>`            | `role`（原始）            | `role` —— **不在**改写列表里                                |

    所以：断言 **`Pressable`** 的 props（trigger、选项）与生产一致；断言 **`View` /
    `Animated.View`** 的 props 只能证明「prop 被透传了」。

## 加下一个组件

1. 移植到 `src/components/<Name>/<Name>.tsx`，保留上游的 prop 名，去掉 `className`
   （改为加 `testID` 与 `style`）。每处分歧都在改动点写注释，并注明它替换掉的上游行。
2. 在 `src/index.ts` 加 barrel 导出。
3. 目录要登记在**三处**，否则会静默逃出门禁：
   `tsconfig.json` → `include`、`tsconfig.build.json` → `include`、
   `jest.config.js` → `testMatch`。
4. 移植测试文件。删掉 `className` 断言与 DOM 键盘用例；每个被删掉的 Web 用例，
   都要在文件头写清**为什么**删，并在存在 RN 替代方案时补一个
   （例如用 `Modal.onRequestClose` 替代 Escape）。
5. 若组件有测试渲染器里跑不了的逻辑（测量、滚动、命令式 API），
   **把它抽成纯函数并对它做单测** —— 见 `src/components/TimePicker/geometry.ts`。
6. `npm run ci`。

## 验证

```bash
npm run ci        # format:check + lint + typecheck + test + build
npm run lint      # eslint .
npm run test      # jest
npm run typecheck # tsc --noEmit（只覆盖已移植的子集）
npm run build     # tsc --project tsconfig.build.json → dist/
```

任何与视觉有关的东西 —— 阴影、字体、滚动行为、面板位置 —— 都必须在真机或模拟器上检查。
本分支的测试看不到这些。
