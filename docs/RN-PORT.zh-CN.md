# RN-PORT.md — 把 animal-island-ui 移植到 React Native

> 本文是 [`RN-PORT.md`](../RN-PORT.md) 的中文镜像，按仓库约定（英文为主 + 中文镜像）。
> 两者含义必须一致；**有冲突时以英文版为准**。技术名词保持英文。

本 fork 的 `rn` 分支把组件库从 React DOM 移植到 React Native。本文记录**决策**、
**与上游的有意分歧**、以及**测试覆盖不到的部分** —— 让下一个人不必重新推导一遍。

上游 Web 历史与保留的 Less/demo 源码只是参照，不是本分支的运行时。
`rn` 分支使用原生实现，并由 `tsconfig.json`、`tsconfig.build.json`、`jest.config.js`
的显式 include 白名单限定范围。不要通过合并恢复 Web 组件体，也不要因保留文件而推断 Web 构建可用。

## 状态

### 宿主运行时兼容性

IsleMind 使用 React Native 0.86.3 消费本 fork。ref 实例类型通过
`React.ComponentRef<typeof View>` / `React.ComponentRef<typeof ScrollView>` 提取；
Input 聚焦/失焦处理器从 `TextInputProps` 提取，不能导入 0.87 独有的实例/事件类型别名。
Modal 和 Table 列宽使用 `ViewStyle['width']`，而不是任意 CSS 字符串。
这些是类型契约修正，不改变视觉行为。
Jest 优先使用当前运行时内置的 preset，不存在时使用 0.87 拆出的独立 preset。
编译器、Metro 和原生 autolinking 必须使用宿主同一份 React/React Native/SVG。
独立安装 fork 依赖可能替换 workspace 链接，因此构建消费应用前需重新运行应用的安装步骤。

**全部 40 个组件 API 已有原生适配**，包括 Avatar、Badge、Calendar、CountUp、
Rate 与 Upload。其中仍有下文明确记录的空操作；不承诺 DOM 行为或设备上的像素级动画一致。

2026 年 10 月 23 日本地验证：串行全量 Jest **1300/1300 项、55/55 套件通过**，
源码类型检查通过。数量来自该次运行的 Jest JSON，不来自覆盖率徽章。
后续运行必须重新绑定源码与构建产物，不代表已完成浏览器渲染、安装设备或真实 Provider 验收。

2026 年 10 月 26 日检查点：`npm run ci` 的格式检查、lint（**0 错误、41 警告**）、
源码类型检查、**55/55 套件中的 1316/1316 测试**与 JS/声明构建均通过。
单独执行的 `node scripts/check-docs-sync.mjs` 也通过。
这仅记录本地原生验证，不代表远端 CI 或设备/发布验收。

### 上游同步与原生变更

本地已有的 upstream main 版本 `2d855fc6c1cb56cc4152290f50c43439d4a4920f`
在适配快照之前，已包含在保存的 RN 版本 `ce23f9af7fd7d28fbb634cddfd46641f9d85fd2b` 中。
2026 年 10 月 26 日检查点将本文所述原生适配与文档一并保存为本地 RN 提交，
没有推送或发布。宿主 pin 必须指向该快照的完整 SHA，并要求工作树干净。
本地提交身份不代表远端 CI/EAS 已能获取这些输入。

2026 年 10 月 24 日（UTC）的只读远端查询得到实际上游 main
`f35813856ea241d022b85f0fbafac0f4223d5e71`，比上述已知版本多两次提交。
完整树比较仅改变 `README.md` 和 `docs/README.zh-CN.md`，新增微信小程序社区移植链接。
这两处内容在本次快照之前已同步到 RN 工作树，原生 API、素材和依赖均未改变。
比较时，查询得到的上游提交对象在本地不可用；创建本次快照没有执行 fetch 或 merge。
本地提交保存了镜像文档，不代表包含该上游提交，也不代表远端可重新获取并构建。

- Avatar、Select、Form、Upload、BackTop、Rate 共用 `src/icons/`，素材复制自已验证的
  `naive-icons@1.6.0` 源码并适配 `react-native-svg`；MIT 声明保留在 `src/icons/base.tsx`。
  不安装第二份 React/DOM 图标运行时。
- Background/Card 点阵半径、暖桃色与修订色板、Input 表面、Button 文本高度、
  Countdown 溢出和 BackTop 偏移按上游源码同步。
- Progress 使用 2 单位描边、单层 14 单位网格/1.5 半径小点、SVG 薄荷渐变和完成提亮。
  宿主 `fillColor` 覆盖渐变/场景。
- Time 按实例进行中英文 dayjs 格式化；DatePicker 严格解析与 TimePicker 的
  `2000-01-01` 固定锚点使用原有 dayjs 依赖。TypeScript 构建外置 dayjs，不打包私有副本。
- CodeBlock 保留 JSX/TypeScript、Shell 分词器。原生复制仍使用当前运行时已废弃的 Clipboard；
  代码换行并非 Web 的横向滚动。
- Select 支持搜索、清空、筛选和宿主远端结果。原生搜索位于 Modal 内，键盘避让边界限制
  测量/兜底面板位置；Web 键盘、焦点、ARIA 适配与原生事件 API 分离。
- Drawer 尊重减少动态、暗色表面、键盘避让和滚动正文；对话框不压平交互子节点。
  Web 焦点陷阱仍不支持，原生焦点/滚动/键盘行为还需物理验证。
- Loading 在减少动态时保留静态雪景；CountUp、Rate 关闭装饰效果，但不抑制值更新或完成语义。

### 新组件边界

Avatar 支持原生图像描述符和加载失败回退；Avatar.Group 不覆盖子组件明确选择。
Badge 提供可访问的完整计数。Calendar 是六周原生网格，具有受控日期/月回调、有界事项层与
长按 responder 范围创建；Web 键盘适配不等于设备手势验证。原生事项色板/标签和拖动入口与上游不同。
CountUp 保留暂停、重置、重播与格式化；原生光环、星芒、贴纸是近似实现
（平面贴纸填充和缩放序列，而非精确 Web 旋转）。Rate 使用上游星形素材与原生触控目标，hover 仅用于 Web。

Upload **绝不模拟上传成功**。宿主提供 `onPickFiles`，负责权限与 URI 生命周期。
缺少 picker 时禁用选择；选择后缺少 `action`/`customRequest` 会变为错误而不是 `done`。
选择、转换后元数据、请求配置、异步移除与晚到回调均设有隔离栅栏，描述符脱离宿主可变输入。
原生 multipart 使用 URI/name/type 而不是 DOM File，Web action 上传要求宿主在描述符中提供 blob。
卸载/移除会中止活动工作；选择本身不会删除 URI、弹权限窗口或调用 Provider。

原生 API 见有界的 [宿主参考](../skills/animal-island-ui-style/references/components/native-host.md)。
manifest 为 private 且声明 CC-BY-NC-4.0，而根目录/上游 LICENSE 为 MIT。
此包装/许可差异仍未解决，不能视作分发批准。

### ⚠️ 本分支放弃了什么

为 RN 重写 `package.json` **移除了 Web 工具链**（vite、vitest、less、`@testing-library/react`）。
eslint 被重新接回，但按 RN 的方式 —— 见「Linting」。因此在 `rn` 分支上：

- `npm run ci` 是 **RN** 流水线。单独运行 `node scripts/check-docs-sync.mjs`：
  保留的上游文档检查器未加入当前 manifest 的 CI 链。
  本分支没有已安装的 Web axe/Vitest 无障碍流水线。
- 保留的 Web Less/demo 文件**未在本分支验收为可运行 Web 库**。
  本分支组件体为原生实现；可运行的上游 DOM 库是独立源码/运行时。
  原生 include 白名单不能代替其验收。
- `.githooks/pre-commit` **未启用**（`core.hooksPath` 未设置），所以没有东西会自动跑 `ci`
  —— 提交前请自己跑。

## ⚠️ 本 fork 的默认分支是 `rn`

fork `domidoremi/animal-island-ui` 的**默认分支是 `rn`**（上游 Web 库原封不动留在 `main`）。
两件要知道的连带影响：

1. **`gh repo sync` 现在作用于 `rn`，不是 `main`。** `--branch` 默认取目标仓库的默认分支，
   所以裸跑

    ```bash
    gh repo sync domidoremi/animal-island-ui
    ```

    会试图把 **`rn`** 快进到上游的 `main`。由于历史已分叉，它会失败 —— 这本身无害，
    但**加 `--force` 会 hard reset `rn`，摧毁整个移植**。
    要同步上游镜像，务必显式指定分支：

    ```bash
    gh repo sync domidoremi/animal-island-ui -b main
    ```

2. **本分支的 `README.md` 是上游的 Web 版 README**，只在顶部加了一段提示。
   它记载的安装命令与 `animal-island-ui/style` 引入**不适用于本分支**。
   不要顺手「修好」其余部分 —— 与上游逐字节一致，才能让 fork 与上游可 diff。

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

| Web                                                                                      | RN                                                      | 备注                                                                                                   |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `className` + `*.module.less`                                                            | `style`（StyleSheet）+ `testID`                         | 保留的 Less 是上游视觉参照，不等于本分支可运行 Web 构建。                                              |
| `onClick`                                                                                | `Pressable` 的 `onPress`                                |                                                                                                        |
| `:hover`                                                                                 | —                                                       | 丢弃：触摸端没有 hover                                                                                 |
| `:active`                                                                                | `Pressable` style 回调给的 `pressed`                    |                                                                                                        |
| `onMouseDown={e => e.preventDefault()}`（保持焦点）                                      | —                                                       | 丢弃：`View` 没有焦点语义                                                                              |
| `ResizeObserver` / `clientWidth`                                                         | `onLayout`                                              |                                                                                                        |
| CSS `repeating-linear-gradient`                                                          | SVG `strokeDasharray`                                   | Divider                                                                                                |
| CSS data-URI SVG 平铺                                                                    | 循环里的 `<Path transform="translate(...)">`            | Divider                                                                                                |
| CSS Grid `grid-template-rows: 0fr → 1fr`                                                 | 先 `onLayout` 测量，再用 `Animated.Value` 驱动 `height` | Collapse                                                                                               |
| `@keyframes`                                                                             | `Animated.loop` + `Easing.linear`                       | Button 的 loading 转圈                                                                                 |
| `box-shadow: <字符串>`                                                                   | `boxShadow: <字符串>`（RN 0.76+，CSS 语法）             | **Android 上需要新架构**                                                                               |
| `@font-face` + woff2                                                                     | —                                                       | woff2 是 Web 专属；宿主 App 需自行提供 ttf/otf（见下）                                                 |
| `position: absolute` 的 popover（放在 `position: relative` 包裹层里）                    | `Modal` + `measureInWindow` 定位                        | TimePicker —— 见「结构性分歧」                                                                         |
| `document.addEventListener('mousedown')`（点击外部）                                     | `Modal` 内的全屏透明 `Pressable`                        | 行为一致，但没有视觉遮罩                                                                               |
| `window.innerHeight` / `innerWidth`                                                      | `useWindowDimensions()`                                 |                                                                                                        |
| `list.scrollTop` / `list.clientHeight`                                                   | `ScrollView` + `onLayout` + `scrollTo({ y })`           | TimePicker 的列                                                                                        |
| `onKeyDown`（Enter / Escape / 方向键）                                                   | 独立 Web adapter 或原生 TextInput 事件                  | Select、Calendar、Rate、RadioGroup 保留已记录的 Web 键盘行为；Android Back 使用 Modal.onRequestClose。 |
| `role`、`aria-label`、`aria-labelledby`、`aria-expanded`、`aria-disabled`、`aria-hidden` | 同名 prop                                               | RN 0.87 支持 ARIA 风格 props                                                                           |
| `aria-controls`、`aria-haspopup`                                                         | —                                                       | **RN 没有对应物**                                                                                      |
| `tabIndex={0}` / `{-1}`                                                                  | `tabIndex` → `focusable`                                |                                                                                                        |
| SVG `stroke="currentColor"`                                                              | 把颜色显式传进图标                                      | RN 没有 `currentColor`                                                                                 |

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

### 3. `Cursor` 是**有文档的空操作**

上游的 `Cursor` 只是一个 `<div>`，靠 CSS（`cursor.css`）套一个**自定义鼠标指针**。
RN 没有鼠标指针 —— RN 的 `cursor` 样式只接受 `'auto' | 'pointer'`，不支持 `url()` 图片。
所以 RN 版渲染一个朴素 `View`，透传 `children` / `style` / `testID`，
并**收下但不使用** `type` 与 `forceAll`。选它而不是删掉这个组件，是因为
`Drawer` 与 `Modal` 会把内容包在 `<Cursor>` 里，必须继续能用。
测试里断言四种 prop 组合渲染出的宿主树逐字节相同 —— 这就是「空操作」在此处的含义。

### 4. 场景 SVG 变成了组件

上游把 `.svg` 当**模块** import（bundler 的 svg loader 给一个 URL 字符串），
再喂给 `background-image: url(...)`。RN 两者都没有。
`Background` 与 `Progress` 实际用到的 4 张场景图转成了 `react-native-svg` 组件，
放在 `src/assets/image/rn/`；`assets/image/svg/desktop/` 下的 30 张壁纸
在 RN 子集里没有任何引用，故未转换。

### 5. `BackTop` 改为接收 `scrollY`，不再监听 window

上游读 `window` 的滚动位置。RN 没有 window 滚动，故新增可选 prop `scrollY?: number`
（宿主透传 `onScroll` 拿到的 `contentOffset.y`），`visibilityHeight` 的比较仍留在组件内。
`duration` **删掉**：`ScrollView.scrollTo` 只有动画 / 不动画两档，留着是死参数。

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

6. **Tooltip：hover → 按住显示。** RN 没有 hover。气泡在 trigger 按住期间显示、松开即隐藏，
   并保留上游那个 100ms 的隐藏防抖。上游的 `aria-describedby` 在 RN **没有对应物**
   （全包搜零命中），所以不再做 trigger → 气泡的关联，改为让气泡自身成为
   `role="tooltip"` 的可访问节点。
7. **Drawer：`pushBackground` 是有文档的空操作。** 上游在抽屉打开时把 `body` 的子元素
   推开。RN 没有 `body`、也没有这种变换，所以这个 prop 收下但不用。焦点陷阱、焦点归还、
   锁滚动同理丢弃。上游靠 CSS transition 双向播放（节点常驻 DOM），
   RN 必须自己维持 `mounted` 直到退场动画播完。
8. **Modal：`game` 变体的 `clip-path` 无法裁切 `View`。** 改为铺满的 SVG 底图，
   轮廓与上游一致 —— 形状是对的，但内容不再被它裁切。`aria-describedby` 同样丢弃，理由同 (6)。
9. **Table：`text-align` 改到 `alignItems`。** RN 的 `textAlign` 属于 `TextStyle` 而非
   `ViewStyle`，容器拿不到它。故容器层用 flex 的 `alignItems`，纯文本子节点再补自己的
   `textAlign`。自定义 `render` 返回的节点**拿不到**后者 —— 这是真实的保真度损失，不是疏漏。
10. **Notification 必须显式挂宿主。** 上游的 `notification.info()` 会自己建容器并挂到
    `document.body`。RN 没有这个入口，故改为模块级 store + 由宿主在根组件挂一次
    `<NotificationHost />`。这是整个移植里最大的 API 变化。
11. **Form：`onSubmit` 与 `onReset` 是删除，不是改名。** 两者都是原生表单事件
    （`<form onsubmit>`、`<button type=reset>`），RN 既没有 `FormHTMLAttributes`
    也没有原生表单事件。提交走 `form.submit()`、重置走 `form.resetFields()`。
    `scrollToField()` 降级为有文档的空操作：上游是
    `document.querySelector(...)?.scrollIntoView(...)`，RN 没有 document、也拿不到滚动容器
    （它由宿主的 `ScrollView` 持有）；上游自己就注明「交给消费者」。`aria-invalid` 与
    `aria-errormessage` 在 RN 0.87 都不存在（只改写 13 个 `aria-*`），
    故错误态改为把 `status="error"` 透传给子控件。
12. **DatePicker：`focusedDate` 状态整体删除。** 上游的 `focusedDate` 是键盘导航的焦点日期，
    唯一读者就是 `handleKeyDown`。键盘导航既已丢弃，留着就是只写不读的死状态。
    range 的 hover 预览改为按下预览，理由同 (6)。

13. **暗色主题 + `ThemeProvider` 是 RN 侧新增能力，不是移植。** 上游只有一套烘进
    `variables.less` 的亮色皮肤，没有暗色主题、也没有运行时主题切换可移植。RN 没有 CSS 自定义
    属性，明暗切换只能做成显式 Provider。`src/theme/appearance.ts` 新增一套语义暗色板与
    `resolveNativeTheme(mode)`（light **按引用**返回 `defaultTheme` —— 默认皮肤仍归本包所有）；
    `ThemeProvider` 通过 `useTheme` 暴露 `{ mode, theme, reducedMotion }`，可选 `accent` 仅覆盖
    `colors.primary`。暗色 hex 值是**这里新写的，不是从上游推导**，所以 `appearance.test.ts`
    冻结的是**行为不变量**（light ≡ default、dark 替换 colors/brand/roles 而保留几何、两套色板共用一套 key），
    而非具体颜色 —— 没有上游真值可比。`reducedMotion` 由宿主传入，不再另起一个
    `AccessibilityInfo` 监听，以与宿主自身设置保持一致。以 `./theme` 子路径导出
    （见 `package.json` 的 `exports`），好让构建工具不拉入 React Native 就能读 token。
    Button、Input、Switch、Select、Card、Background、Modal、Progress、Avatar、Badge、
    Calendar、CountUp、Rate、Upload、Drawer 消费 Provider 颜色；Button、Switch、Select、
    Card、Modal、Progress、Tooltip、Badge、CountUp、Rate、Loading、Drawer 尊重减少动态。
    Provider 覆盖并非普遍，Form 继承的样式仍为中性灰。

## 消费 RN fork

将同级 checkout 作为 `animal-island-ui-rn` workspace 依赖；不要把 RN 实现复制到宿主应用。
通用组件修复、素材与色板在本仓库维护；宿主负责偏好持久化、本地化、导航、安全区与业务状态适配。

从 `animal-island-ui-rn` 导入组件和 `ThemeProvider`。Node 工具从
`animal-island-ui-rn/theme` 导入纯 token 或 `resolveNativeTheme`。Metro/browser
导出指向源码；`npm run build` 在忽略的 `dist/` 中生成声明与 CommonJS 入口，
公共 API 改动后需重新构建。链接的宿主必须使用自己的 React、React Native 与 SVG runtime，
不能使用本 fork 的开发依赖。

向 Provider 传入解析后的 `mode`、`accent`、`reducedMotion`。Accent 只覆盖
`colors.primary`，不会替换所有皮肤/品牌色。Progress 还保留已有的 OS 减少动态监听。
原生输入 ref/事件、按钮无障碍、禁用选项、受控 Tooltip、不确定进度与弹窗安全区见
[RN 宿主 API 参考](../skills/animal-island-ui-style/references/components/native-host.md)。
Modal 使用键盘避让容器、滚动正文和固定页脚；本地化操作按钮由宿主通过 footer 传入。

本地修改会实时消费，但不包含在仅上传宿主的 CI/EAS 构建中。远端构建必须准备兼容的
fork revision；使用完整 commit SHA 才可重复构建。单测不能证明原生键盘、读屏与设备渲染正确。

## 未测面 —— 仅靠构造保证

在相信这个绿色构建之前，请先诚实面对这一点：

| 范围                                               | 为什么在这里测不到                                                                                                                                                                                                |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TimePicker 面板定位                                | jest preset 把 `measureInWindow` mock 成裸 `jest.fn()`（`@react-native/jest-preset/jest/MockNativeMethods.js`）—— 它**从不回调**。所以面板渲染在兜底位置 `{ top: 0, left: 0 }`。                                  |
| TimePicker 列的居中                                | `ScrollView.scrollTo` 需要原生滚动节点，测试渲染器里没有。**改为对算术做单测。**                                                                                                                                  |
| `boxShadow` 真的渲染出来                           | 全仓没有任何视觉断言。且 Android 上需要新架构；旧架构下阴影会被静默丢弃。                                                                                                                                         |
| 字体                                               | 宿主提供原生 ttf/otf 与文本样式；ThemeProvider 没有字体注入 prop，woff2 不能作为原生字体输入。                                                                                                                    |
| `onStartShouldSetResponder` 是否真的挡住了触摸穿透 | RNTL 触发事件时会**向上**走树找 handler；而 Modal 的 backdrop 是**兄弟**节点，所以即使没有这道防护，朴素的 `fireEvent.press(panel)` 也会通过。测试改为断言机制本身（`onStartShouldSetResponder()` 返回 `true`）。 |

### 兜底位置不等于视觉验收

测量通过 callback 返回；面板先使用兜底边界，收到测量后再更新。
淡入可能遮盖修正，但 renderer 测试不能证明用户看不到它；减少动态会主动跳过淡入。
真实原生/Web 位置、键盘缩减与初始定位仍是独立验收事项。

## 测试笔记（RNTL v14 + linked RN 的坑）

- **`render` 与 `fireEvent` 是 async 的** —— React 19 的异步 `act`。永远要 `await`。
- **节点类型统一写 `import type { TestInstance } from 'test-renderer';`。**
  这是规范形式（RNTL v14 从该包转出）。**不要**自己定义更窄的结构类型，
  也**不要**加 `with { 'resolution-mode': 'import' }`。这两者只在用 `--module node16`
  跑**独立** `tsc` 时才显得必要；而本仓 `tsconfig.json` 用的是 `module: ESNext` +
  `moduleResolution: bundler`，在该口径下朴素写法一直是干净的。若要在项目外单独校验
  某个组件，**先把模块口径对齐仓库**，否则你会去追一个根本不存在的 `TS1541`。
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
- **JS 驱动的 `Animated` 需要某种定时器控制** —— `useNativeDriver: false` 会逐帧更新 React，
  没有控制时这些帧会落在 `act` 之外。`Collapse.test.tsx` 用的是 fake timers。
  **但 fake timers 并非到处可用** —— 见下一条。
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

- ⚠️ **一挂载就起动画的组件上，fake timers 不可用**（Drawer、DatePicker）。
  两种独立的失败，都是探针确认过的：

    | 做法                                                    | 症状                                                                                                                                                             |
    | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | `jest.useFakeTimers()`                                  | 连 `queueMicrotask` 一起假掉，而 React 19 的调度器与 RNTL 的 `await render()` 都靠它推进微任务 → 树提交不了，首个用例跑 10 秒，之后连 `trigger` 都查不到         |
    | `jest.useFakeTimers({ doNotFake: ['queueMicrotask'] })` | 只修好渲染这一半：React 调度器自己也用 `setTimeout` 排任务，于是 `await act(async () => ...)` 要等一个永远不来的定时器 —— 能过但耗时 11 秒并触发 Jest 的 5s 超时 |
    | 真实定时器 + `waitFor(..., { timeout: 2000 })`          | 可行，且后续用例不受影响（已验证）                                                                                                                               |

- ⚠️ **RNTL 把 `aria-modal` 元素的兄弟节点一律视为不可访问** ——
  `helpers/accessibility.js` 里的 `isHiddenFromAccessibility` 是在模拟 iOS 的
  `accessibilityViewIsModal`。所以 `Modal` 容器内的遮罩必须带 `includeHiddenElements: true`
  才查得到，否则根本找不到。
- ⚠️ **「等待 Modal 自行卸载」的用例会污染同文件后面的用例** —— 后面报
  `Unable to find an element with testID: ...`，而 `container.queryAll` 又能查到。
  fake timers、`waitFor`、真实定时器三种等法都一样。把这类用例挪到**文件最后**即可恢复；
  拆到独立文件也能规避（模块注册表隔离），但不值得为此多拆一个文件。见 `Drawer.test.tsx`。
- **`container.queryAll` 只给宿主节点** —— 结果里没有复合组件，所以注入到子控件的 prop
  （如 `Form` 给 `Input` 注入 `status="error"`）查不到。改用一个把该 prop 渲染成文本的探针子组件。
  见 `Form.test.tsx` 的「错误态」用例。
- **裸字符串子节点会抛** `Invariant Violation: Text strings must be rendered within a
<Text> component`。接受自由 children 的组件（`Form.Item`、Table 单元格）自己会包一层；
  测试里渲染裸文本时也要自己包。

## 加下一个组件

1. 移植到 `src/components/<Name>/<Name>.tsx`，保留上游的 prop 名，去掉 `className`
   （改为加 `testID` 与 `style`）。差异记录在原生参考；源码注释仅说明无法从实现还原的不变量。
2. 在 `src/index.ts` 加 barrel 导出。
3. 目录要登记在**三处**，否则会静默逃出门禁：
   `tsconfig.json` → `include`、`tsconfig.build.json` → `include`、
   `jest.config.js` → `testMatch`。
4. 移植测试文件。删掉 `className` 断言与不适用于原生的 DOM 用例；为 `RadioGroup`
   等共享行为保留明确的 Web 宿主交互测试。每个被删掉的 Web 用例，
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
