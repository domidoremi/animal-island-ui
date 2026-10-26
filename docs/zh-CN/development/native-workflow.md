# 原生分支工作流

本文适用于 `rn` 分支及其 `animal-island-ui-rn` manifest。其他开发页保留上游
DOM/Vite/Vitest 指南，不改变原生运行时、命令集或执行授权。

## 运行时与源码权威

- 宿主提供 React、React Native、react-native-svg peers。IsleMind 当前链接
  React 19.2.3、RN 0.86.3、SVG 15.15.4，不等于 fork 的独立开发栈。
- 原生 ref/事件从当前组件或 TextInputProps 声明提取，不能假设独立新版 RN 类型存在。
- 使用 StyleSheet、原生 props 和共享 `src/icons/` 素材。保留的 Less/demo 源码
  描述上游皮肤，不是原生 CSS 流水线。
- dayjs 是当前 manifest 的日期依赖；locale 按实例选择。TypeScript 构建外置
  dayjs，而不是打包隔离的日期运行时。
- 源码导出、两份 TypeScript include 和 Jest testMatch 保持一致；测试/demo
  不进入构建 JS/声明。

## 命令

```sh
npm run typecheck
npm run lint
npm run test -- --runInBand --watch=false
npm run build
node scripts/check-docs-sync.mjs
npm run format:check
```

`npm run ci` 串联 format:check、lint、typecheck、test、build。保留的文档检查器
单独执行，当前 manifest 没有 `check:docs` npm script，也没有原生 Web axe/Vitest、
demo/deploy 流水线。
使用当前工具，不为通过关卡替换运行时或安装无关升级。保留失败记录，区分 lint 警告
与无警告结果。只格式化本次相关文件，不重排保留的上游历史。

## 消费应用集成

Metro/browser 条件消费 `src/index.ts`、`src/theme/index.ts`；Node/Jest 消费
`dist/index.js`。宿主测试前重建，并将产物哈希绑定到已测源码。源码测试通过但
dist 陈旧，不等于消费应用验收。

本地 workspace 可以是未提交、未发布源码。默认 CI/EAS 准备仍必须要求已保存的
完整 SHA 与干净 checkout，不能推进远端 pin 到 HEAD 后声称包含未提交适配。
必要的 workspace 锁文件对账不授权升级、包脚本或网络/Provider/设备执行。

2026 年 10 月 26 日检查点将当前原生适配保存为本地提交，用于宿主精确源码验证。
该检查点不推送或发布；本地 pin 匹配不证明全新远端 CI/EAS clone 能获取此提交。

### 离线锁验证边界

链接的 dayjs 运行时为 1.11.23；IsleMind 文本锁保留原生依赖映射，以及现有
npm 锁中的精确版本和 integrity。源码契约不等于安装回执。2026 年 10 月 23 日，
Bun 1.4.2 的 offline/frozen/lockfile-only 检查仍因 dayjs manifest 未缓存而失败。
一次性完整宿主对照只移除库的 `prepare` 钩子时通过；保留钩子则重现 workspace
更新和依赖重解析，即使传入 `--ignore-scripts`。两种对照均未执行钩子。

保留真实 `prepare` 钩子和失败回执。删除生命周期行为、伪造注册表缓存或将离线
检查换成 `--prefer-offline`，都不能关闭关卡。单独有界的元数据缓存修复须在真实
workspace 不变的情况下验证；不得安装第二份 React/RN 运行时，也不得推进未发布
fork 的远端 pin 绕过失败。

## 文档与验证范围

英文/中文路由、原生 API 参考和原生视觉差异须同时更新。入口是
[RN-PORT.md](../../RN-PORT.zh-CN.md) 和
[native-host.md](../../../skills/animal-island-ui-style/references/components/native-host.md)。
skill 参考须可独立安装，components 下每文件最多 200 行。
不能用原生 Jest 数量重生成保留的 Web 覆盖率徽章。

React 19/RNTL 14 测试须 await render/fireEvent/act，保留受控写回、禁用态、
晚到回调/取消、减少动态回归。隔离 renderer、Dimensions 替身、Web 适配器、
内存存储均不能证明真实焦点、键盘、滚动、阴影、手势或安装设备持久化。
当前渲染 Web 与独立授权的设备/Provider 检查是不同关卡。

manifest 仍为 private/CC-BY-NC-4.0，而保留的 LICENSE 为 MIT。
差异尚未解决，本文流程不是分发或发布批准。
