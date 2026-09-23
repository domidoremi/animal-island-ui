# Decorative — 精确样式规范

> **RN fork:** Background 使用 Provider 暗色画布与圆点颜色，同时保留图案几何与场景素材。 [RN contract](../../../RN-PORT.zh-CN.md). 其余表格描述上游 Web/亮色皮肤。

## 主题过渡（RN 宿主）

`ThemeTransitionProvider` 为用户主动选择外观提供简短、可打断的揭示过渡。
支持的浏览器从点击位置以 340ms 圆形裁剪展开新的根视图快照；
原生/旧浏览器先以 190ms 展开目标表面色的实心圆，在遮盖下应用宿主更新，
然后以 130ms 淡出遮盖。原生动画驱动器只处理 transform/opacity。
无点击位置的键盘操作从视口中心展开。减少动态效果时立即应用；没有转圈、
虚构进度或最短加载等待。1200ms 安全时限确保停滞的过渡结束。
覆盖层仅用于装饰，不获取焦点，不复制应用树。设置、持久化、错误反馈与目标表面颜色由宿主管理。

承载海岛主题氛围的场景件：Time、Phone、Footer、Wallet 的精确取值

## Footer（版权栏）

版权栏：渲染 `© {year} {text}` —— 年份动态获取（当前年份），文案默认为 `All Rights Reserved.`。

```tsx
<Footer />                  // © 2026 All Rights Reserved.
<Footer text="Acme Ltd." /> // 自定义文案
<Footer text="Acme" year={2020} />
```

```less
.footer {
    color: #807d75;
    font-size: 12px;
    padding: 16px 0;
    text-align: center;
}
```

- `year` 默认取当前年份（`new Date().getFullYear()`），传入 `year` 可覆盖；`text` 替换 `All Rights Reserved.`。
- 样式完全可通过 `style` / `className` 自定义。
