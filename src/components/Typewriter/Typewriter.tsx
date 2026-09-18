import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

export interface TypewriterProps {
    /** 需要逐字显示的内容，支持 ReactNode，保留原有元素结构/换行/样式 */
    children?: React.ReactNode;
    /** 每字间隔 (ms), 默认 90 */
    speed?: number;
    /**
     * 外部触发重新播放。值变化即重启动画。
     * 常见用法是把弹窗的 open 次数或一个递增的 key 传进来。
     */
    trigger?: unknown;
    /** 是否自动从头开始播放，默认 true；设为 false 可直接显示全部 */
    autoPlay?: boolean;
    /** 播放完成回调 */
    onDone?: () => void;
    /**
     * 自定义样式（作用于承载文字的那层 `<Text>`）。
     *
     * ⚠️ **上游没有这个 prop**（Web 版 Typewriter 不渲染任何包裹元素，文字直接继承
     * 调用处的排版）。RN 必须有一层 `<Text>` 才能承载字符串，所以这里补一个 `style`
     * 让调用方仍能控制字号 / 颜色 / 行高等排版。属于增量、可回退。
     */
    style?: StyleProp<TextStyle>;
    /**
     * 测试标识（RN 里 `className` 的对应物）。
     *
     * ⚠️ 同样**上游没有**：Web 版没有可定位的根节点（只返回一个 Fragment）。
     */
    testID?: string;
}

/**
 * 递归计算 ReactNode 中的纯文本总长度（用于驱动打字机进度）
 */
const countText = (node: React.ReactNode): number => {
    if (node === null || node === undefined || typeof node === 'boolean') return 0;
    if (typeof node === 'string' || typeof node === 'number') return String(node).length;
    if (Array.isArray(node)) return node.reduce<number>((s, n) => s + countText(n), 0);
    if (React.isValidElement(node)) {
        return countText((node.props as { children?: React.ReactNode }).children);
    }
    return 0;
};

interface RenderState {
    remaining: number;
    stopped: boolean;
}

/**
 * 按剩余可显字符数裁剪 ReactNode，保留原有的元素结构 / 换行 / 样式。
 *
 * 与 Web 版逐字一致（同一套 `remaining` / `stopped` 游标）。
 */
const renderTruncated = (node: React.ReactNode, state: RenderState, keyPrefix = 'tw'): React.ReactNode => {
    if (state.stopped) return null;
    if (node === null || node === undefined || typeof node === 'boolean') return null;

    if (typeof node === 'string' || typeof node === 'number') {
        const text = String(node);
        if (state.remaining >= text.length) {
            state.remaining -= text.length;
            return text;
        }
        const shown = text.slice(0, state.remaining);
        state.remaining = 0;
        state.stopped = true;
        return shown;
    }

    if (Array.isArray(node)) {
        return node.map((child, i) => (
            <React.Fragment key={`${keyPrefix}-${i}`}>
                {renderTruncated(child, state, `${keyPrefix}-${i}`)}
            </React.Fragment>
        ));
    }

    if (React.isValidElement(node)) {
        const props = node.props as { children?: React.ReactNode };
        const childContent = renderTruncated(props.children, state, keyPrefix);
        return React.cloneElement(node, undefined, childContent);
    }

    return null;
};

/**
 * Typewriter 打字机组件
 * - 按字符逐个显示，保留原 children 的元素结构、换行和样式
 * - Web 版「不引入任何外层包裹元素，对布局 / 字号 / 颜色 / 字体均零影响」
 *
 * ⚠️ **与 Web 版的结构性差异（RN 硬约束，无法规避）**：RN 里裸字符串**必须**包在
 * `<Text>` 里，否则直接抛 "Text strings must be rendered within a <Text> component"。
 * 所以这里最外层固定是一层 `<Text>`，Web 版「零包裹元素」的承诺在 RN 上做不到。
 * 代价与缓解：
 *   1. 排版不再继承调用处的文字样式（RN 的样式不跨组件继承），改由 `style` prop 控制；
 *      该 prop 是 RN 侧新增的。
 *   2. **`children` 只能是「文字形状」的节点** —— `string` / `number` / `<Text>`（含嵌套）。
 *      RN 不允许 `<View>` / `<Image>` 出现在 `<Text>` 内部，所以上游那种
 *      「children 随便塞块级元素」的用法在 RN 侧不成立：块级内容请自己拆开，
 *      只把要逐字显示的文字交给 Typewriter。
 *
 * 另：`window.setInterval` → 裸 `setInterval`（RN 没有 `window`）。
 */
export const Typewriter: React.FC<TypewriterProps> = ({
    children,
    speed = 90,
    trigger,
    autoPlay = true,
    onDone,
    style,
    testID,
}) => {
    const total = useMemo(() => countText(children), [children]);
    const [count, setCount] = useState(autoPlay ? 0 : total);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (timerRef.current !== null) clearInterval(timerRef.current);
        if (!autoPlay) {
            setCount(total);
            return undefined;
        }
        setCount(0);
        if (total === 0) return undefined;
        timerRef.current = setInterval(() => {
            setCount((c) => {
                if (c >= total) {
                    if (timerRef.current !== null) clearInterval(timerRef.current);
                    return c;
                }
                return c + 1;
            });
        }, speed);
        return () => {
            if (timerRef.current !== null) clearInterval(timerRef.current);
        };
    }, [total, speed, trigger, autoPlay]);

    useEffect(() => {
        if (total > 0 && count >= total) onDone?.();
        // 依赖数组与上游一致，**故意不含 `onDone`**：调用方常传内联箭头函数，
        // 把它放进依赖会让「播放完成后父组件任意一次重渲染」都重放一遍 onDone。
        // 上游就是靠这行 eslint-disable 保持该语义，这里照搬。
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [count, total]);

    const state: RenderState = { remaining: count, stopped: false };
    return (
        <Text style={style} testID={testID}>
            {renderTruncated(children, state)}
        </Text>
    );
};

Typewriter.displayName = 'Typewriter';
