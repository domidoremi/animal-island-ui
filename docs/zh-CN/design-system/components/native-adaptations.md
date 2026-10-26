# 原生适配 - 视觉差异

本文描述原生实现，不是保留的 DOM/Less 表格。运行时/API 边界见
[RN-PORT.md](../../../RN-PORT.zh-CN.md)，原生 props 见
[宿主 API 参考](../../../../skills/animal-island-ui-style/references/components/native-host.md)。
尺寸均为原生逻辑单位，不是 CSS 长度。

## 共享皮肤与素材

已链接的上游快照提供暖桃色/色板修订、点阵几何、Input 奶油表面、Button 文本高度、
Countdown 溢出、BackTop 下/右偏移。原生 `src/icons/` 经既有 SVG base 使用已验证的
naive-icons 1.6.0 路径/颜色。base 保留 MIT 素材声明，不引入第二份 DOM 图标运行时。
装饰 SVG 不进入辅助技术节点。
共享 SVG 根节点在所有平台保留 `aria-hidden`，但 Web 不透传原生专用的
`accessible` 布尔属性，避免将其作为 DOM 属性产生警告。

亮色默认值仍由库持有。暗色表面与 brand/role 色是原生新增，不是上游暗色主题；
宿主 accent 只覆盖 primary。新增的 Avatar、Badge、Calendar、CountUp、Rate、Upload
使用 Provider；Form 继承的中性灰样式不会自动重着色。

## Button

Button 默认仍为单行与固定高度。原生 `multiline` 选项让完整文案居中换行，并增加
8 个逻辑单位的垂直内边距；所选尺寸改为最小高度。宿主必须约束宽度，让窄屏动作行换行。
颜色、胶囊形状、按下/加载表面及减少动态策略保持不变。

## Input

文本区域默认使用 `minWidth: 0`，防止浏览器输入框的固有宽度把固定前后缀或清除动作
推出窄行。显式 `inputStyle` 与 `inputProps.style` 仍保持更高优先级。
清除字形使用主题文字前景色，而不是占位文本颜色。
字号、行高、20 个逻辑单位的按钮及 12 个逻辑单位的 hitSlop 不变。受控回写、回调顺序、
原生事件、ref 与多行尺寸策略均保留。这不构成真实设备字体缩放、焦点或键盘验收。

## Avatar 与 Badge

Avatar 预设圆形为 32/40/48，方形半径为 8，回退使用实际 User 素材。
原生文本自适应替代 DOM 测量，默认组重叠为 8。
Badge 计数高度为 16/20，圆点为 10；较宽/CJK 计数改用胶囊。
辅助技术保留完整计数，而不是仅朗读视觉封顶后缀。

## Calendar

保留六周与两条事项层。原生事项色映射到主题 brand 色，而不是逐值复制上游事项 CSS。
页眉/星期/动作文案仍内置中文，不存在 locale prop。日期目标至少 44，窄网格横向滚动；
font scale 增大日期/事项层而不是裁剪文字。自定义事项节点位于 Text 外。
长按 responder 范围创建与预览是原生适配，不等于上游鼠标操作编排。

## CountUp 与 Rate

CountUp 保留原生双光环/四星芒及可选贴纸；平面贴纸填充和缩放序列近似 Web 渐变/旋转。
减少动态关闭这些装饰，不改变数值与完成语义。
Rate 使用上游实际 Star 素材，小/中/大视觉尺寸为 20/26/34，目标至少 44。
未填充星降低不透明度；hover 仅 Web，原生通过 press 选择。减少动态关闭爆发/计时效果。

## Select 与 Drawer

Select 保留上游胶囊/选项皮肤和清空素材；原生搜索位于 Modal 内，选项可滚动，
测量/兜底位置均受视口限制，键盘缩减后的布局也参与边界。
Drawer 使用 Provider 暗色表面、受视口限制的横向宽度、KeyboardAvoidingView、
滚动正文/页脚；减少动态立即挂载/卸载。背景 push 和 Web 焦点陷阱未实现；
对话框不压平可交互原生后代。

## Progress、Background 与 Loading

Progress 使用上游 2 单位描边、单层 14 单位网格/1.5 半径小点、
薄荷 SVG 渐变及完成提亮。场景覆盖整条轨道；fillColor 覆盖渐变/场景。
indeterminate 使用静态部分填充，不朗读编造的数值百分比。
Background/Card 点阵几何和修订色板遵循保留的上游皮肤；
Loading 在减少动态时保留 50 片雪花的可见静态场景。

## Upload 与 Form

Upload 的触发/列表/动作素材来自共享原生图标，drag 仅为视觉皮肤。
宿主提供文件选择、权限、URI。无 picker 禁用选择；无 action/customRequest 是错误，
绝不伪造 done。缩略图使用宿主持有 URI，不自动生成/revoke ObjectURL。
Form 错误反馈使用实际 Close 素材；scrollToField 仍由宿主持有/为空操作。

## 验证边界

源码/renderer 算术、模拟传输与替身大字号不能证明渲染 Web/原生像素一致、
手势、焦点、键盘或滚动。当前渲染 Web 与独立授权安装设备检查仍是不同关卡。
字体由宿主经原生文本样式提供；ThemeProvider 暴露 mode/accent/reducedMotion，
没有字体注入 API。private manifest 的许可差异未解决，不代表分发批准。
