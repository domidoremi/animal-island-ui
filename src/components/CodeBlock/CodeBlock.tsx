import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clipboard, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * CodeBlock —— 代码块 + 一键复制。
 *
 * ## 高亮方案（移植时的关键决定）
 *
 * 上游 Web 版**没有**用 Prism / Shiki / highlight.js，也**没有**用
 * `dangerouslySetInnerHTML` —— 它在本文件里手写了一个正则分词器
 * （上游 `highlightJSX`，见下），把源码切成 `{start, end, color}` 的 token，
 * 再渲染成一串 `<span style={{ color }}>`。
 *
 * 这套逻辑是**纯字符串运算 + 彩色文本片段**，没有任何 DOM 依赖，所以
 * **完整保留**：分词器原样搬成纯函数 `tokenizeCode`（返回 `{ text, color }` 数组，
 * 便于单测），渲染层把 `<span>` 换成 RN 的 `<Text>`（嵌套 `<Text>` 会内联排版，
 * 等价于 Web 的 `<span>`）。**没有引入任何新依赖，也没有降级掉高亮。**
 *
 * ## 与上游的结构性差异
 *
 * 1. **复制**：`navigator.clipboard.writeText` 与 `document.execCommand('copy')`
 *    兜底都不存在。RN 0.87 仍内置 `Clipboard`（**已废弃**，官方建议迁到
 *    `@react-native-clipboard/clipboard`，但那是一个新依赖，本分支不引入）。
 *    `Clipboard.setString()` 是**同步且无返回值**的，所以上游那条
 *    「写入失败 → error 状态」的异步分支在 RN 上只剩 try/catch 能触发。
 * 2. **`.wrapper` + `<pre>` 两层合并成一层**：Web 的 `<pre>` 会横向滚动
 *    （`overflow: auto`），绝对定位的复制按钮必须放在滚动容器**外**，
 *    所以才要多一层 `.wrapper`。RN 版代码块不滚动，复制按钮直接作为
 *    代码块容器的子节点即可，视觉与上游一致，少一层嵌套。
 *    代价：上游把 `style` 的布局属性（width / margin*）提到 `.wrapper`、
 *    其余落到 `<pre>`；RN 版 `style` 统一作用于代码块本身，结果等价。
 * 3. **长代码换行而不横向滚动**：`overflow: auto` 没有 RN 等价物（除非再套一层
 *    横向 `ScrollView`，会把 `style` 的落点再拆一次），这里选择换行并如实记录。
 */

/**
 * 代码配色 —— 上游 `COLORS` 常量逐条照搬。
 * 注意：这些颜色写在上游的 **TSX** 里（不在 `.less` 中），所以**照搬硬编码值**，
 * 不映射到 `theme/tokens.ts`（token 层里没有代码高亮配色）。
 */
export const CODE_COLORS = {
    comment: '#6b5e50',
    string: '#a8d4a0',
    keyword: '#d4a0e0',
    react: '#e06c75',
    component: '#80c0e0',
    func: '#61afef',
    prop: '#e8c87a',
    jsx: '#f0a870',
    operator: '#d4b896',
    number: '#a8d4a0',
    default: '#e8d5bc',
} as const;

/** 高亮后的一段连续文本 */
export interface CodeRun {
    text: string;
    color: string;
}

interface Token {
    start: number;
    end: number;
    color: string;
}

/**
 * 上游 `highlightJSX` 的分词部分，抽成纯函数。
 *
 * 逻辑逐条照搬：按**固定顺序**跑一遍正则，每个匹配产出一个 token，
 * 再按 `start` 稳定排序，最后线性扫描、跳过与前一个 token 重叠的部分
 * （`if (token.start < pos) continue`），未覆盖的空隙用 `CODE_COLORS.default`。
 * 排序用 `Array.prototype.sort`，ES2019 起保证稳定，所以同 `start` 的 token
 * 保持「先加入者优先」——与上游一致。
 *
 * 抽出来的原因：这是**唯一有分支的算术**，放在渲染函数里就只能靠断言颜色来间接验证。
 */
export const tokenizeCode = (code: string): CodeRun[] => {
    const tokens: Token[] = [];

    const addPattern = (regex: RegExp, color: string) => {
        const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);
        let match: RegExpExecArray | null;
        while ((match = re.exec(code)) !== null) {
            tokens.push({ start: match.index, end: match.index + match[0].length, color });
        }
    };

    addPattern(/\/\*[\s\S]*?\*\//g, CODE_COLORS.comment);
    addPattern(/\/\/.*$/gm, CODE_COLORS.comment);
    addPattern(/`[^`]*`/g, CODE_COLORS.string);
    addPattern(/"[^"]*"/g, CODE_COLORS.string);
    addPattern(/'[^']*'/g, CODE_COLORS.string);
    addPattern(/<\/?[A-Z][\w.$]*/g, CODE_COLORS.jsx);
    addPattern(/<\/?[a-z][\w-]*/g, CODE_COLORS.jsx);
    addPattern(/\/?>/g, CODE_COLORS.jsx);
    addPattern(
        /\b(React|useState|useEffect|useCallback|useMemo|useRef|useContext|useReducer|useLayoutEffect|useImperativeHandle|useDebugValue|createContext|createElement|cloneElement|Fragment|Suspense|lazy|memo|forwardRef|useId|FC|ReactNode|ReactElement|CSSProperties)\b/g,
        CODE_COLORS.react
    );
    addPattern(/\b(true|false)\b/g, CODE_COLORS.keyword);
    addPattern(/\b(null|undefined|void|NaN|Infinity)\b/gi, CODE_COLORS.keyword);
    addPattern(/\b\d+\.?\d*\b/g, CODE_COLORS.number);
    addPattern(
        /\b(import|from|as|export|default|const|let|var|function|return|if|else|for|while|switch|case|break|continue|try|catch|throw|finally|new|typeof|instanceof|async|await|type|interface)\b/gi,
        CODE_COLORS.keyword
    );
    addPattern(/\b[A-Z][a-zA-Z0-9_$]*\b/g, CODE_COLORS.component);
    addPattern(/\b[a-z][a-zA-Z0-9_$]*\s*(?=\()/g, CODE_COLORS.func);
    addPattern(/\b[a-zA-Z_$][\w$]*\s*(?==)/g, CODE_COLORS.prop);
    addPattern(/>|===|!==|==|!=|<=|>=|&&|\|\||[+\-*/%=<>!&|^~?:]/g, CODE_COLORS.operator);
    addPattern(/[{}[\]();,]/g, CODE_COLORS.operator);

    tokens.sort((a, b) => a.start - b.start);

    const runs: CodeRun[] = [];
    const push = (text: string, color: string) => {
        // 上游也会产出长度 0 的 span（不会有），这里顺手挡掉，视觉等价
        if (text.length > 0) runs.push({ text, color });
    };

    let pos = 0;
    for (const token of tokens) {
        if (token.start < pos) continue;
        if (token.start > pos) push(code.slice(pos, token.start), CODE_COLORS.default);
        push(code.slice(token.start, token.end), token.color);
        pos = token.end;
    }
    if (pos < code.length) push(code.slice(pos), CODE_COLORS.default);

    return runs;
};

/**
 * 等宽字体。
 *
 * 上游写的是字体栈 `'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace`。
 * **RN 不支持字体栈**（只能给一个 family），所以按平台取系统等宽字体。
 * 宿主 App 想用 SF Mono / Fira Code，需自行接入 ttf/otf 并覆盖此处。
 */
const MONO_FONT = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

/** 复制成功 / 失败后的状态回退延时 —— 上游 `2_000` */
const RESET_DELAY = 2000;

export interface CodeBlockProps {
    /** 要高亮的 JSX / TypeScript 源码 */
    code: string;
    /** 自定义样式（作用于代码块本身） */
    style?: StyleProp<ViewStyle>;
    /** 是否显示复制按钮，默认 true */
    copyable?: boolean;
    /** 复制成功后的回调 */
    onCopy?: (code: string) => void;
    /** 测试标识（RN 里 `className` 的对应物） */
    testID?: string;
}

type CopyStatus = 'idle' | 'copied' | 'error';

/** 上游 `COPY_STATUS_CONTENT` 逐条照搬：按钮文案 + 无障碍名 */
const COPY_STATUS_CONTENT: Record<CopyStatus, { text: string; label: string }> = {
    idle: { text: '复制', label: '复制代码' },
    copied: { text: '已复制', label: '代码已复制' },
    error: { text: '复制失败', label: '代码复制失败' },
};

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, style, copyable = true, onCopy, testID }) => {
    const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
    // 上游是 `useRef<number>()` + `window.setTimeout`；RN 用全局 setTimeout（返回 NodeJS.Timeout）
    const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
        () => () => {
            if (resetTimer.current !== null) clearTimeout(resetTimer.current);
        },
        []
    );

    /**
     * ⚠️ 与上游的差异：上游 `copyText` 是 async 的
     * （`navigator.clipboard.writeText` 返回 Promise，失败走兼容方案再失败才抛）。
     * RN 的 `Clipboard.setString` 是**同步无返回值**的，没有失败信号，
     * 所以只有「调用本身抛异常」才会落到 error 分支。
     * 同理，上游「Clipboard API 不可用时用 textarea + execCommand 兜底」这条路径
     * **整条丢弃** —— RN 没有 document，而核心 `Clipboard` 本身就是那个兜底。
     */
    const handleCopy = () => {
        if (resetTimer.current !== null) clearTimeout(resetTimer.current);
        try {
            Clipboard.setString(code);
            setCopyStatus('copied');
            onCopy?.(code);
        } catch {
            setCopyStatus('error');
        }
        resetTimer.current = setTimeout(() => setCopyStatus('idle'), RESET_DELAY);
    };

    const runs = useMemo(() => tokenizeCode(code), [code]);
    const buttonContent = COPY_STATUS_CONTENT[copyStatus];

    // `style` 可能是数组，先 flatten 再读 padding —— 上游直接读 `style?.padding`
    const flatStyle = StyleSheet.flatten(style);
    const copyButtonSpacing = copyable && flatStyle?.padding === undefined && flatStyle?.paddingRight === undefined;

    return (
        <View style={[styles.block, copyButtonSpacing && styles.blockWithCopyButton, style]} testID={testID}>
            {/*
             * 嵌套 `<Text>` 等价于 Web 的 `<span>`：RN 的嵌套 Text 会内联排版，
             * 并且**继承外层 Text 的字体 / 行高 / 字号**，颜色由每段自己声明。
             *
             * `whiteSpace: 'pre'` / `overflow: auto` / `tabSize: 4` / `margin: 0`
             * 四条声明没有 RN 等价物，已丢弃：
             *   - RN 的 Text **不合并空白**，换行与缩进天然保留，所以 `pre` 是隐含的；
             *   - 横向滚动需要再套一层 `ScrollView`，见文件头的「结构性差异」第 3 条；
             *   - `tabSize` 无对应属性；`margin: 0` 是清 UA 默认值，RN 没有 UA 样式。
             */}
            <Text style={styles.code} testID={testID ? `${testID}-code` : undefined}>
                {runs.map((run, index) => (
                    <Text key={index} style={{ color: run.color }}>
                        {run.text}
                    </Text>
                ))}
            </Text>

            {copyable && (
                <Pressable
                    accessibilityRole="button"
                    aria-label={buttonContent.label}
                    onPress={handleCopy}
                    style={styles.copyButton}
                    testID={testID ? `${testID}-copy` : undefined}
                >
                    <Text style={styles.copyButtonText}>{buttonContent.text}</Text>
                </Pressable>
            )}
        </View>
    );
};

CodeBlock.displayName = 'CodeBlock';

const styles = StyleSheet.create({
    // 合并了上游的 `.wrapper` 与 `codeBlockStyle`（见文件头「结构性差异」第 2 条）：
    //   .wrapper { position: relative; min-width: 0; margin: 1em 0 }
    //   codeBlockStyle { boxSizing: border-box; width: 100%; margin: 0; padding: 20px 24px;
    //                    background: #2b2118; border: 1px solid #3d3028; border-radius: 20px }
    // 丢弃的声明：
    //   - `box-sizing: border-box` —— RN/Yoga 的尺寸语义本就是 border-box。
    //   - `position: relative` —— RN 的 View 默认即相对定位，绝对定位子节点已相对它解析。
    //   - `line-height: 1.7` / `font-size: 14px` / `font-weight: 600` / `color` 是
    //     **文字**样式，RN 不做继承，已挪到下面的 `code` 上（`.wrapper` 里没有这些）。
    //   - `margin: 1em 0` → `marginVertical: 14`：1em 按代码块的 14px 字号换算。
    block: {
        position: 'relative',
        width: '100%',
        minWidth: 0,
        marginVertical: 14,
        paddingVertical: 20,
        paddingHorizontal: 24,
        backgroundColor: '#2b2118',
        borderWidth: 1,
        borderColor: '#3d3028',
        borderRadius: 20,
    },
    // 上游 `copyButtonSpacing ? { paddingRight: 96 } : null` —— 给右上角的复制按钮让位
    blockWithCopyButton: {
        paddingRight: 96,
    },
    code: {
        fontSize: 14,
        lineHeight: 14 * 1.7, // CSS line-height: 1.7（RN 只接受绝对行高）
        fontFamily: MONO_FONT,
        fontWeight: '600',
        color: '#e8d5bc',
    },
    // `.copy-button`：
    //   position absolute / top 12 / right 12 / min-width 62 / height 32 / padding 0 12
    //   border 1px solid rgba(232,213,188,.3) / border-radius 50 / background rgba(61,48,40,.94)
    //   color #e8d5bc / font-size 12 / font-weight 700
    // 丢弃的声明：
    //   - `:hover`（背景变亮 + 上浮 1px）与 `transition` —— 触摸设备没有 hover，RN 也没有过渡。
    //   - `:focus-visible` 的 outline —— RN 没有 CSS 焦点环。
    //   - `cursor: pointer` —— RN 没有光标。
    //   - `font-family: var(--animal-font-family, 'Nunito', 'Noto Sans SC')` ——
    //     这是个字体栈，RN 用不了；`theme/tokens.ts` 的 `fontFamily` 默认就是 `undefined`
    //     （宿主 App 接入 ttf/otf 后自行覆盖），所以这里不设 family，用系统字体。
    copyButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        minWidth: 62,
        height: 32,
        paddingHorizontal: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(232, 213, 188, 0.3)',
        borderRadius: 50,
        backgroundColor: 'rgba(61, 48, 40, 0.94)',
    },
    copyButtonText: {
        color: '#e8d5bc',
        fontSize: 12,
        fontWeight: '700',
        lineHeight: 12, // CSS 里按钮是 flex 居中，行高塌成 1 更贴近原样
    },
});
