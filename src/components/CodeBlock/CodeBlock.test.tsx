import React from 'react';
import { Clipboard, StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { CODE_COLORS, CodeBlock, tokenizeCode } from './CodeBlock';

/**
 * RN 版测试，对应 Web 版 `CodeBlock.test.tsx` 的 11 个用例。
 *
 * **被丢弃的用例**：
 *   - 「Clipboard API 不可用时使用兼容复制方案」—— 上游的兜底是
 *     `document.createElement('textarea')` + `document.execCommand('copy')`。
 *     RN 没有 `document`，而且 RN 核心的 `Clipboard` **本身就是那个兜底**，
 *     没有「再兜一层」的余地。
 *   - 「兼容复制方案抛错时仍清理临时元素」—— 同上，RN 侧根本没有临时元素可清理。
 *   - `className` 断言 —— RN 无 className。
 *   - 「`pre` 元素 / `querySelector('span')`」这类 DOM 结构断言 —— RN 没有 DOM，
 *     改成断言渲染出的 `<Text>` 片段与纯函数 `tokenizeCode` 的输出。
 *
 * **RN 侧新增**：
 *   - 复制状态 2s 后回到 idle（上游有这条行为，但 Web 用例没测）。
 *   - 复制失败时**不**触发 `onCopy`。
 *   - `style` 的 `padding` 会让代码块多留出右侧让位空间（上游 `copyButtonSpacing`）。
 *
 * ⚠️ **读断言前必须知道：jest preset 把 `View` / `Text` / `Clipboard` 都 mock 掉了**
 *   - `View` / `Text` 的 mock 把 props **原样**透传给宿主节点，不做 RN 的 aria-* 改写
 *     （见 `RN-PORT.md` 的 `View`-mock 表）。所以 `<View aria-hidden>` 在测试里就是
 *     `aria-hidden`，真机上才会变成 `accessibilityElementsHidden`。
 *   - `Clipboard` 被 mock 成 `{ setString: jest.fn(), getString: jest.fn() }`
 *     （`@react-native/jest-preset/jest/mocks/Clipboard.js`），所以可以直接断言调用参数。
 *     注意 RN 核心的 `Clipboard` **已废弃**，`react-native/index.js` 里用 getter + `warnOnce`
 *     暴露它，因此本文件跑起来会打一条 deprecation 警告 —— 这是预期的，不是测试缺陷。
 */

/** 把一棵宿主子树的文本拼起来（嵌套 `<Text>` 会形成树，`getByText` 只看单个节点） */
const textOf = (node: TestInstance): string =>
    node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');

/** 代码块里的高亮片段（都是 `<Text>` 宿主节点） */
const runsOf = (codeNode: TestInstance): TestInstance[] =>
    codeNode.children.filter((child): child is TestInstance => typeof child !== 'string');

const colorOf = (node: TestInstance): unknown => StyleSheet.flatten(node.props.style)?.color;

/**
 * 展开后的样式对象。
 *
 * `toHaveStyle` 是**子集匹配**（`Object.keys(expected).every(...)`），键不存在时
 * `undefined !== 期望值` 会直接失败，所以「某个属性**没有**被设上」这类断言只能读值。
 * 另外 RN 的 `StyleSheet.flatten` **不会**把 `paddingHorizontal` 展开成
 * `paddingLeft/Right`，所以也别指望用 `paddingRight` 去断言 `paddingHorizontal`。
 */
const styleOf = (node: TestInstance): Record<string, unknown> =>
    (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, unknown>;

const setStringMock = Clipboard.setString as unknown as jest.Mock;

beforeEach(() => {
    // Clipboard 的 mock 是模块级共享的，必须逐例清空
    jest.clearAllMocks();
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
});

describe('CodeBlock', () => {
    it('渲染 code 内容（替代 Web 版对 pre.textContent 的断言）', async () => {
        const code = "const a = 'hello';";
        const { getByTestId } = await render(<CodeBlock code={code} testID="cb" />);
        expect(textOf(getByTestId('cb-code'))).toBe(code);
    });

    it('应用 style（替代 Web 版的 className + style 断言）', async () => {
        const { getByTestId } = await render(
            <CodeBlock code="x" testID="cb" style={{ borderRadius: 4, width: '50%', marginLeft: 12 }} />
        );
        const root = getByTestId('cb');
        expect(root).toHaveStyle({ borderRadius: 4, width: '50%', marginLeft: 12 });
        // 代码块的默认底色 / 内边距仍在（上游 codeBlockStyle）
        expect(root).toHaveStyle({ backgroundColor: '#2b2118', paddingHorizontal: 24 });
    });

    it('为代码片段产生多个高亮片段', async () => {
        const { getByTestId } = await render(<CodeBlock code="function foo() { return 1; }" testID="cb" />);
        expect(runsOf(getByTestId('cb-code')).length).toBeGreaterThan(0);
        // 纯函数侧的等价断言：token 数 > 1
        expect(tokenizeCode('function foo() { return 1; }').length).toBeGreaterThan(1);
    });

    it('识别块注释 /* ... */', async () => {
        const runs = tokenizeCode('/* block comment */ x');
        expect(runs[0]).toEqual({ text: '/* block comment */', color: CODE_COLORS.comment });
        // 注释之后的空隙回到默认色
        expect(runs[runs.length - 1].color).toBe(CODE_COLORS.default);
    });

    it('识别 JSX 标签 <MyComp />', async () => {
        const runs = tokenizeCode('<MyComp />');
        expect(runs.map((run) => run.text).join('')).toBe('<MyComp />');
        expect(runs.some((run) => run.color === CODE_COLORS.jsx)).toBe(true);
    });

    it('关键字 / 字符串 / 数字各自取色', async () => {
        const runs = tokenizeCode("const n = 42; // hi\nconst s = 'x';");
        const colorFor = (text: string) => runs.find((run) => run.text === text)?.color;
        expect(colorFor('const')).toBe(CODE_COLORS.keyword);
        expect(colorFor('42')).toBe(CODE_COLORS.number);
        expect(colorFor("'x'")).toBe(CODE_COLORS.string);
        expect(colorFor('// hi')).toBe(CODE_COLORS.comment);
    });

    it('渲染出的片段带对应的颜色', async () => {
        const { getByTestId } = await render(<CodeBlock code="const x = 1;" testID="cb" />);
        const colors = runsOf(getByTestId('cb-code')).map(colorOf);
        expect(colors).toContain(CODE_COLORS.keyword);
        expect(colors).toContain(CODE_COLORS.number);
    });

    it('空 code 不挂掉', async () => {
        const { getByTestId } = await render(<CodeBlock code="" testID="cb" />);
        expect(textOf(getByTestId('cb-code'))).toBe('');
        expect(runsOf(getByTestId('cb-code'))).toHaveLength(0);
    });

    it('默认可复制代码并显示成功反馈', async () => {
        const onCopy = jest.fn();
        const { getByRole } = await render(<CodeBlock code="const island = true;" onCopy={onCopy} />);

        await fireEvent.press(getByRole('button', { name: '复制代码' }));
        expect(setStringMock).toHaveBeenCalledWith('const island = true;');
        expect(onCopy).toHaveBeenCalledWith('const island = true;');
        expect(getByRole('button', { name: '代码已复制' })).toBeTruthy();
    });

    it('复制失败时给出反馈，且不触发 onCopy', async () => {
        const onCopy = jest.fn();
        const spy = jest.spyOn(Clipboard, 'setString').mockImplementation(() => {
            throw new Error('denied');
        });
        const { getByRole } = await render(<CodeBlock code="x" onCopy={onCopy} />);

        await fireEvent.press(getByRole('button', { name: '复制代码' }));
        expect(getByRole('button', { name: '代码复制失败' })).toBeTruthy();
        expect(onCopy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('复制 2s 后回到初始状态（RN 侧补测的上游行为）', async () => {
        const { getByRole } = await render(<CodeBlock code="x" />);
        await fireEvent.press(getByRole('button', { name: '复制代码' }));
        expect(getByRole('button', { name: '代码已复制' })).toBeTruthy();

        await act(async () => {
            jest.advanceTimersByTime(2_000);
        });
        expect(getByRole('button', { name: '复制代码' })).toBeTruthy();
    });

    it('copyable=false 时隐藏复制按钮', async () => {
        const { queryByRole, getByTestId } = await render(<CodeBlock code="x" copyable={false} testID="cb" />);
        expect(queryByRole('button')).toBeNull();
        // 没有按钮就不需要右侧让位（`paddingRight: 96` 那一条不会被叠加）
        expect(styleOf(getByTestId('cb')).paddingRight).toBeUndefined();
    });

    it('可复制时右侧留出让位空间（上游 copyButtonSpacing）', async () => {
        const { getByTestId } = await render(<CodeBlock code="x" testID="cb" />);
        expect(getByTestId('cb')).toHaveStyle({ paddingRight: 96 });
    });

    it('用户显式传了 padding 时不再额外让位', async () => {
        const { getByTestId } = await render(<CodeBlock code="x" testID="cb" style={{ padding: 4 }} />);
        expect(getByTestId('cb')).toHaveStyle({ padding: 4 });
    });

    it('卸载时清掉未触发的状态回退定时器', async () => {
        // 不能用 `jest.getTimerCount()` 做减法断言：React 的调度器自己也会排定时器
        // （实测按下复制后计数 +3，不只有组件那一个）。改成精确到「卸载时清掉的
        // 就是组件排的那个 2000ms 回退定时器」。
        // 用 `globalThis` 而不是 `global`：独立 tsc 只带 `--types jest`，
        // 没有 `@types/node`，`global` 这个名字不在类型里。
        const setTimeoutSpy = jest.spyOn(globalThis, 'setTimeout');
        const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout');

        const { getByRole, unmount } = await render(<CodeBlock code="x" />);
        await fireEvent.press(getByRole('button', { name: '复制代码' }));

        const resetIndex = setTimeoutSpy.mock.calls.findIndex((call) => call[1] === 2_000);
        expect(resetIndex).toBeGreaterThanOrEqual(0);
        const resetId = setTimeoutSpy.mock.results[resetIndex].value;

        clearTimeoutSpy.mockClear();
        await unmount();
        expect(clearTimeoutSpy).toHaveBeenCalledWith(resetId);

        setTimeoutSpy.mockRestore();
        clearTimeoutSpy.mockRestore();
    });
});
