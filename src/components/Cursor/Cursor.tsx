import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

export type CursorType = 'default' | 'raindrop';

export interface CursorProps {
    /** 子元素 */
    children?: React.ReactNode;
    /** 自定义样式（RN 里取代 Web 的 `className`） */
    style?: StyleProp<ViewStyle>;
    /** 测试标识（RN 里 `className` 的对应物） */
    testID?: string;
    /**
     * 光标风格，默认 `'default'`。
     * - `default`：手指箭头
     * - `raindrop`：蓝色雨滴
     *
     * ⚠️ **在 RN 里是空操作（no-op）**：RN 没有鼠标光标，`CursorType` 只是为了保住
     * 上游 API 的形状而保留。详见下面的组件注释。
     */
    type?: CursorType;
    /**
     * 是否对所有后代元素强制覆盖光标。默认 `true`。
     * - `true`：全覆盖，所有后代（含 a/button 等交互元素）统一使用自定义光标
     * - `false`：仅容器自身设置自定义光标，交互元素保留 `pointer`、文本输入保留 `text`、禁用态保留 `not-allowed`
     *
     * ⚠️ **在 RN 里是空操作（no-op）**，理由同上。
     */
    forceAll?: boolean;
}

/**
 * `Cursor` —— **Web 专有能力，在 RN 上退化为一个纯直通（pass-through）容器。**
 *
 * ## 上游做了什么
 * Web 版的 `Cursor` 本体只有一行：
 * ```tsx
 * // 上游 Cursor.tsx（原文）
 * const cls = ['animal-cursor', forceAll ? 'animal-cursor--force' : 'animal-cursor--scoped',
 *              type === 'raindrop' && 'animal-cursor--raindrop', className].filter(Boolean).join(' ');
 * return <div className={cls} style={style}>{children}</div>;
 * ```
 * 真正的行为全在 `cursor.css` 里 —— 给容器（`--force`）或仅容器自身（`--scoped`）
 * 设一个 **自定义鼠标光标图片**（内联 SVG 的 `cursor: url("data:image/svg+xml,…") 6 4, default !important`），
 * `--scoped` 再给后代恢复 `auto` / `pointer` / `text` / `not-allowed`。
 * 一句话：**它只是换了个鼠标指针的样子，不改变任何布局或交互逻辑。**
 *
 * ## 为什么 RN 上做不了
 * 1. RN 没有鼠标指针。RN 0.87 确实新增了 `cursor` 样式属性，但类型是
 *    `CursorValue = 'auto' | 'pointer'`（见 `types_generated/…/StyleSheetTypes.d.ts`）——
 *    只支持这两个关键字，**没有 `url(...)` 自定义图片**，也没有 `default` / `text` / `not-allowed`。
 * 2. 因此 `type`（箭头 / 雨滴）与 `forceAll`（全覆盖 / 保留交互语义）这两条上游语义
 *    **在 RN 上没有任何可表达的对应物**。刻意不发明「触摸版光标」（比如跟着手指画一个
 *    水滴图标）：那会凭空多出一个上游没有的交互与视觉，并且会干扰触摸目标。
 *
 * ## 那为什么还要保留这个组件
 * `Drawer` 和 `Modal` 都把内容包在 `<Cursor>` 里（`<Cursor>…mask + 弹层…</Cursor>`，
 * 且**不传任何 props**）。保留它 = 这两个组件在 RN 侧可以原样搬运、不用改动结构。
 *
 * ## RN 版的实际行为
 * 渲染一个**无样式**的 `<View>`，把 `children` 原样透传，`style` / `testID` 正常透传。
 * 它不做任何布局、不拦触摸、不进无障碍树、不改变指针。`type` / `forceAll` 收下但**不读**，
 * 所以它们既不会报错也不会产生任何效果 —— 测试里用「四种组合渲染出的树完全一致」钉住这一点。
 */
export const Cursor: React.FC<CursorProps> = ({
    children,
    style,
    testID,
    // 上游：`forceAll ? 'animal-cursor--force' : 'animal-cursor--scoped'` 与
    // `type === 'raindrop' && 'animal-cursor--raindrop'` 只用来拼 CSS 类名，
    // 在 RN 上没有可表达的光标行为，因此**不解构、不使用**（保留在 props 类型里仅为兼容上游 API）。
}) => (
    // 上游：`<div className={cls} style={style}>{children}</div>`
    // RN：没有 className（`animal-cursor*` 那一整套类名无对应物），只保留 style + children。
    <View style={style} testID={testID}>
        {children}
    </View>
);

Cursor.displayName = 'Cursor';
