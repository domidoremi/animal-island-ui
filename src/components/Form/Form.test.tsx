/**
 * Form 的 RN 版测试，对应 Web 版 `Form.test.tsx`。
 *
 * ## 丢弃的 Web 用例（及原因）
 *
 * | Web 用例 | 原因 |
 * | --- | --- |
 * | 「渲染为 `<form>` 元素」 | RN 没有 `<form>`，容器是 `View`。改为断言容器的 `flexDirection`。 |
 * | 「child `id` 与 label `htmlFor` 配对」 | 没有 `<label htmlFor>`。改为 `nativeID` + `aria-labelledby`（a11y 意图保留）。 |
 * | 「点击 reset 按钮触发 `onReset`」 | 原生 reset 事件不存在，`onReset` prop 已删除（见 `types.ts`）。 |
 * | 「`aria-invalid` / `toBeInvalid` / `toHaveAccessibleErrorMessage`」 | RN 0.87 的 `View.js` 只改写 13 个 `aria-*`，里面没有 `invalid` 也没有 `errormessage`。改为断言错误文案渲染 + 子控件拿到 `status`。 |
 * | 「`grid-column` 内联样式」 | 没有 CSS Grid。改为断言折算出的 `flex` 权重（`span / 24`）。 |
 *
 * ## 两处 RN 侧的**补强**（不是丢弃）
 *
 * - 无 `name` 的 `Form.Item` 里放裸字符串：上游 HTML 合法，RN 会抛
 *   `Invariant Violation`，故 `FormItem` 自动包一层 `<Text>`（见 `FormItem.tsx`）。
 * - 必填星号：上游是 `::before { content: '*' }` 伪元素，RN 没有伪元素，
 *   只能把颜色落到 label 上（`content` 本身无法表达）。
 *
 * ## ⚠️ 用例里不能调 `Form.useForm()`
 *
 * 在 RN 测试里那是**非法 hook 调用**（不在组件内）。统一走下面的 `harness()`：
 * 由宿主组件在内部创建实例，再挂到外部变量上。
 *
 * ## 测不到的
 *
 * - `scrollToField` 的任何行为：RN 版是空操作。只有一条「调用不抛错」的用例。
 * - 布局观感（gap / flex 比例是否好看）、字号与行高的实际渲染。
 */

import React from 'react';
import { Text, View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { Form, type FormInstance } from './index';
import type { RuleObject } from './types';
import { Input } from '../Input';

const styleOf = (node: TestInstance): Record<string, unknown> =>
    (Array.isArray(node.props.style)
        ? Object.assign({}, ...node.props.style.flat())
        : (node.props.style ?? {})) as Record<string, unknown>;

/** Form.module.less 里 label 的常态色 `@label-color` */
const LABEL_COLOR = 'rgba(0, 0, 0, 0.85)';
/** `.island-form-item-label-required { color: @required-color }` → `#ff4d4f` */
const REQUIRED_COLOR = '#ff4d4f';

/**
 * 造一个「内部创建 form 实例 + 把实例挂到外部变量」的宿主组件。
 *
 * 返回的 `form()` 是**取值器**而不是值 —— 实例要等宿主挂载后才存在。
 */
function harness(renderForm: (form: FormInstance) => React.ReactElement) {
    let instance: FormInstance | null = null;
    const Host: React.FC = () => {
        const [form] = Form.useForm();
        instance = form;
        return renderForm(form);
    };
    return { Host, form: () => instance as FormInstance };
}

/** 在 act 里跑一次提交（RN 没有原生 submit，必须显式调 `form.submit()`） */
const submit = (form: FormInstance) =>
    act(async () => {
        form.submit();
    });

/** 触发一次 Input 的值变化 */
const type = (input: TestInstance, text: string) => fireEvent.changeText(input, text);

describe('Form', () => {
    describe('基础渲染', () => {
        it('渲染容器（RN 没有 <form>，是 View）', async () => {
            const { getByTestId } = await render(
                <Form testID="f">
                    <Form.Item label="姓名" name="name">
                        <Input testID="name" />
                    </Form.Item>
                </Form>
            );
            expect(getByTestId('f')).toBeTruthy();
        });

        it('Form.Item 无 name 时也支持（裸字符串由 FormItem 包 <Text>）', async () => {
            const { getByText } = await render(
                <Form>
                    <Form.Item label="展示项">纯文本</Form.Item>
                </Form>
            );
            // 冒号拼进了同一个 <Text>（RN 没有 ::after 伪元素），故用正则匹配
            expect(getByText(/展示项/)).toBeTruthy();
            expect(getByText('纯文本')).toBeTruthy();
        });

        it('hidden 的 Form.Item 不渲染', async () => {
            const { queryByTestId } = await render(
                <Form>
                    <Form.Item name="hidden" hidden testID="hid">
                        <Input />
                    </Form.Item>
                </Form>
            );
            expect(queryByTestId('hid')).toBeNull();
        });

        it('name 自动把 child nativeID 与 label 配对（取代 htmlFor + id）', async () => {
            const { getByTestId } = await render(
                <Form>
                    <Form.Item label="用户名" name="username" testID="u">
                        <Input testID="u-owner" />
                    </Form.Item>
                </Form>
            );
            const input = getByTestId('u-owner-input');
            const label = getByTestId('u-label');
            expect(input.props.nativeID).toBe('username');
            expect(label.props.nativeID).toBe('username_label');
            expect(input.props['aria-labelledby'] ?? input.props.accessibilityLabelledBy).toBe('username_label');
        });

        it('child 已传 nativeID 时不覆盖（用户优先）', async () => {
            const { getByTestId } = await render(
                <Form>
                    <Form.Item label="邮箱" name="email">
                        <Input nativeID="custom-email-id" testID="e" />
                    </Form.Item>
                </Form>
            );
            expect(getByTestId('e-input').props.nativeID).toBe('custom-email-id');
        });
    });

    describe('布局', () => {
        it('layout=horizontal（默认）：容器纵向、item 横向', async () => {
            const { getByTestId } = await render(
                <Form testID="f">
                    <Form.Item label="h" name="h" testID="h">
                        <Input />
                    </Form.Item>
                </Form>
            );
            expect(styleOf(getByTestId('f')).flexDirection).toBe('column');
            expect(styleOf(getByTestId('h')).flexDirection).toBe('row');
        });

        it('layout=vertical：item 也纵向', async () => {
            const { getByTestId } = await render(
                <Form layout="vertical">
                    <Form.Item label="v" name="v" testID="v">
                        <Input />
                    </Form.Item>
                </Form>
            );
            expect(styleOf(getByTestId('v')).flexDirection).toBe('column');
        });

        it('layout=inline：容器横向', async () => {
            const { getByTestId } = await render(
                <Form layout="inline" testID="f">
                    <Form.Item label="i" name="i">
                        <Input />
                    </Form.Item>
                </Form>
            );
            expect(styleOf(getByTestId('f')).flexDirection).toBe('row');
        });

        it('size 影响 label 字号（取代 CSS 层叠）', async () => {
            const { getByTestId } = await render(
                <Form size="small">
                    <Form.Item label="s" name="s" testID="s">
                        <Input />
                    </Form.Item>
                </Form>
            );
            expect(styleOf(getByTestId('s-label')).fontSize).toBe(12);
        });
    });

    describe('Form.useForm + 表单实例', () => {
        it('form.getFieldValue 返回 initialValues 中的值', async () => {
            const { Host, form } = harness((f) => (
                <Form form={f} initialValues={{ username: 'tom' }}>
                    <Form.Item name="username">
                        <Input />
                    </Form.Item>
                </Form>
            ));
            await render(<Host />);
            expect(form().getFieldValue('username')).toBe('tom');
        });

        it('受控 form 实例：setFieldValue / getFieldValue', async () => {
            const { Host, form } = harness((f) => (
                <Form form={f}>
                    <Form.Item name="a">
                        <Input testID="a" />
                    </Form.Item>
                </Form>
            ));
            await render(<Host />);
            await act(async () => {
                form().setFieldValue('a', 'x');
            });
            expect(form().getFieldValue('a')).toBe('x');
        });

        it('回归: setFieldsValue 嵌套对象应展开为 dot-path', async () => {
            const { Host, form } = harness((f) => (
                <Form form={f}>
                    <Form.Item name="user.name">
                        <Input />
                    </Form.Item>
                </Form>
            ));
            await render(<Host />);
            await act(async () => {
                form().setFieldsValue({ user: { name: 'tom' } });
            });
            expect(form().getFieldValue('user.name')).toBe('tom');
        });

        it('回归: setFieldsValue 数组值当 leaf，不递归', async () => {
            const { Host, form } = harness((f) => (
                <Form form={f}>
                    <Form.Item name="tags">
                        <Input />
                    </Form.Item>
                </Form>
            ));
            await render(<Host />);
            await act(async () => {
                form().setFieldsValue({ tags: ['a', 'b'] });
            });
            expect(form().getFieldValue('tags')).toEqual(['a', 'b']);
        });

        it('回归: FormItem name=["user","name"] + 嵌套 initialValues 能渲染出值', async () => {
            const { getByTestId } = await render(
                <Form initialValues={{ user: { name: 'tom' } }}>
                    <Form.Item name={['user', 'name']}>
                        <Input testID="un" />
                    </Form.Item>
                </Form>
            );
            expect(getByTestId('un-input').props.value).toBe('tom');
        });

        it('受控 form 实例 + setFieldsValue 同步到 Input', async () => {
            const { Host, form } = harness((f) => (
                <Form form={f}>
                    <Form.Item name="a">
                        <Input testID="a" />
                    </Form.Item>
                </Form>
            ));
            const { getByTestId } = await render(<Host />);
            await act(async () => {
                form().setFieldsValue({ a: 'sync' });
            });
            expect(getByTestId('a-input').props.value).toBe('sync');
        });

        it('resetFields 把值还原到 initialValues', async () => {
            const { Host, form } = harness((f) => (
                <Form form={f} initialValues={{ a: 'init' }}>
                    <Form.Item name="a">
                        <Input testID="a" />
                    </Form.Item>
                </Form>
            ));
            const { getByTestId } = await render(<Host />);
            await type(getByTestId('a-input'), 'changed');
            expect(form().getFieldValue('a')).toBe('changed');
            await act(async () => {
                form().resetFields();
            });
            expect(form().getFieldValue('a')).toBe('init');
        });
    });

    describe('校验', () => {
        it('required 规则：空值触发错误，有值通过', async () => {
            const onFinish = jest.fn();
            const { Host, form } = harness((f) => (
                <Form form={f} onFinish={onFinish}>
                    <Form.Item name="a" rules={[{ required: true, message: '必填' }]}>
                        <Input testID="a" />
                    </Form.Item>
                </Form>
            ));
            const { getByTestId } = await render(<Host />);
            await submit(form());
            expect(form().getFieldError('a')).toEqual(['必填']);
            await type(getByTestId('a-input'), 'x');
            await submit(form());
            expect(onFinish).toHaveBeenCalled();
        });

        it('min / max / len 规则：字符串长度校验', async () => {
            const { Host, form } = harness((f) => (
                <Form form={f}>
                    <Form.Item name="a" rules={[{ min: 3, message: '至少 3' }]}>
                        <Input testID="a" />
                    </Form.Item>
                </Form>
            ));
            const { getByTestId } = await render(<Host />);
            await type(getByTestId('a-input'), 'ab');
            await submit(form());
            expect(form().getFieldError('a')).toEqual(['至少 3']);
            await type(getByTestId('a-input'), 'abc');
            await submit(form());
            expect(form().getFieldError('a')).toBeUndefined();
        });

        it('type=integer 规则：字符串数字按整数校验', async () => {
            const { Host, form } = harness((f) => (
                <Form form={f}>
                    <Form.Item name="a" rules={[{ type: 'integer', message: '要整数' }]}>
                        <Input testID="a" />
                    </Form.Item>
                </Form>
            ));
            const { getByTestId } = await render(<Host />);
            await type(getByTestId('a-input'), '1.5');
            await submit(form());
            expect(form().getFieldError('a')).toEqual(['要整数']);
            await type(getByTestId('a-input'), '12');
            await submit(form());
            expect(form().getFieldError('a')).toBeUndefined();
        });

        it('min/max 规则：number 类型按数值比较（不受字符串长度影响）', async () => {
            const { Host, form } = harness((f) => (
                <Form form={f}>
                    <Form.Item name="a" rules={[{ type: 'number', min: 10, message: '≥10' }]}>
                        <Input testID="a" />
                    </Form.Item>
                </Form>
            ));
            const { getByTestId } = await render(<Host />);
            await type(getByTestId('a-input'), '9');
            await submit(form());
            expect(form().getFieldError('a')).toEqual(['≥10']);
            await type(getByTestId('a-input'), '10');
            await submit(form());
            expect(form().getFieldError('a')).toBeUndefined();
        });

        it('pattern 规则：正则校验', async () => {
            const { Host, form } = harness((f) => (
                <Form form={f}>
                    <Form.Item name="a" rules={[{ pattern: /^a+$/, message: '只许 a' }]}>
                        <Input testID="a" />
                    </Form.Item>
                </Form>
            ));
            const { getByTestId } = await render(<Host />);
            await type(getByTestId('a-input'), 'b');
            await submit(form());
            expect(form().getFieldError('a')).toEqual(['只许 a']);
        });

        it('validator：async 自定义校验', async () => {
            const validator = jest.fn(async (_rule: RuleObject, value: unknown) => {
                if (value === 'bad') throw new Error('异步不通过');
            });
            const { Host, form } = harness((f) => (
                <Form form={f}>
                    <Form.Item name="a" rules={[{ validator }]}>
                        <Input testID="a" />
                    </Form.Item>
                </Form>
            ));
            const { getByTestId } = await render(<Host />);
            await type(getByTestId('a-input'), 'bad');
            await submit(form());
            expect(validator).toHaveBeenCalled();
            expect(form().getFieldError('a')).toEqual(['异步不通过']);
        });

        it('validator 返回 string 也算错误', async () => {
            const { Host, form } = harness((f) => (
                <Form form={f}>
                    <Form.Item name="a" rules={[{ validator: () => '直接返回错误' }]}>
                        <Input testID="a" />
                    </Form.Item>
                </Form>
            ));
            const { getByTestId } = await render(<Host />);
            // ⚠️ 必须先有值：空值时 runRule 会跳过不带 required 的规则
            await type(getByTestId('a-input'), 'any');
            await submit(form());
            expect(form().getFieldError('a')).toEqual(['直接返回错误']);
        });

        it('onValuesChange 触发：单字段变化', async () => {
            const onValuesChange = jest.fn();
            const { getByTestId } = await render(
                <Form onValuesChange={onValuesChange}>
                    <Form.Item name="a">
                        <Input testID="a" />
                    </Form.Item>
                </Form>
            );
            await type(getByTestId('a-input'), 'x');
            expect(onValuesChange).toHaveBeenCalledWith({ a: 'x' }, { a: 'x' });
        });

        it('错误态渲染错误文案，并把 status 透传给子控件', async () => {
            /**
             * 把注入的 `status` 直接显示出来的探针控件。
             *
             * 为什么不能直接查 `Input`：Web 版断言的是 `aria-invalid="true"`，RN 0.87
             * 的 `View.js` 只改写 13 个 `aria-*`，里面**没有** `invalid`。RN 侧唯一等价的
             * 错误信号是透传给子控件的 `status="error"`，但它是**复合组件**的 prop ——
             * `container.queryAll` 在本仓实际只返回宿主节点（实测无 composite 节点），
             * 拿不到。所以让子控件自己把它渲染出来再断言。
             */
            const StatusProbe: React.FC<{ status?: string }> = ({ status }) => (
                <Text testID="probe">{`status=${String(status)}`}</Text>
            );
            const { Host, form } = harness((f) => (
                <Form form={f}>
                    <Form.Item name="a" rules={[{ required: true, message: '必填' }]}>
                        <StatusProbe />
                    </Form.Item>
                </Form>
            ));
            const { getByTestId, getByText } = await render(<Host />);
            expect(getByTestId('probe').props.children).toBe('status=undefined');
            await submit(form());
            expect(getByText('必填')).toBeTruthy();
            expect(getByTestId('probe').props.children).toBe('status=error');
        });
    });

    describe('提交', () => {
        it('空表单触发 onFinish（全部无 required），不走 onFinishFailed', async () => {
            const onFinish = jest.fn();
            const onFinishFailed = jest.fn();
            const { Host, form } = harness((f) => (
                <Form form={f} onFinish={onFinish} onFinishFailed={onFinishFailed}>
                    <Form.Item name="a">
                        <Input />
                    </Form.Item>
                </Form>
            ));
            await render(<Host />);
            await submit(form());
            expect(onFinish).toHaveBeenCalled();
            expect(onFinishFailed).not.toHaveBeenCalled();
        });

        it('onFinishFailed 收到 values + errorFields', async () => {
            const onFinishFailed = jest.fn();
            const { Host, form } = harness((f) => (
                <Form form={f} onFinishFailed={onFinishFailed}>
                    <Form.Item name="a" rules={[{ required: true, message: '必填' }]}>
                        <Input />
                    </Form.Item>
                </Form>
            ));
            await render(<Host />);
            await submit(form());
            expect(onFinishFailed).toHaveBeenCalled();
            const info = onFinishFailed.mock.calls[0][0];
            expect(info.errorFields[0].name).toBe('a');
            expect(info.errorFields[0].errors).toEqual(['必填']);
        });

        it('type=number 规则：接受整数 + 浮点 + 数字字符串', async () => {
            const { Host, form } = harness((f) => (
                <Form form={f}>
                    <Form.Item name="a" rules={[{ type: 'number', message: '要数字' }]}>
                        <Input testID="a" />
                    </Form.Item>
                </Form>
            ));
            const { getByTestId } = await render(<Host />);
            for (const v of ['1', '1.5', '-2']) {
                await type(getByTestId('a-input'), v);
                await submit(form());
                expect(form().getFieldError('a')).toBeUndefined();
            }
        });

        it('type=email 规则：邮箱格式', async () => {
            const { Host, form } = harness((f) => (
                <Form form={f}>
                    <Form.Item name="a" rules={[{ type: 'email', message: '邮箱格式' }]}>
                        <Input testID="a" />
                    </Form.Item>
                </Form>
            ));
            const { getByTestId } = await render(<Host />);
            await type(getByTestId('a-input'), 'nope');
            await submit(form());
            expect(form().getFieldError('a')).toEqual(['邮箱格式']);
            await type(getByTestId('a-input'), 'a@b.com');
            await submit(form());
            expect(form().getFieldError('a')).toBeUndefined();
        });

        it('type=url 规则：URL 格式', async () => {
            const { Host, form } = harness((f) => (
                <Form form={f}>
                    <Form.Item name="a" rules={[{ type: 'url', message: 'URL 格式' }]}>
                        <Input testID="a" />
                    </Form.Item>
                </Form>
            ));
            const { getByTestId } = await render(<Host />);
            await type(getByTestId('a-input'), 'not-a-url');
            await submit(form());
            expect(form().getFieldError('a')).toEqual(['URL 格式']);
            await type(getByTestId('a-input'), 'https://example.com');
            await submit(form());
            expect(form().getFieldError('a')).toBeUndefined();
        });

        it('required + whitespace: 纯空格也算空', async () => {
            const { Host, form } = harness((f) => (
                <Form form={f}>
                    <Form.Item name="a" rules={[{ required: true, whitespace: true, message: '不能空' }]}>
                        <Input testID="a" />
                    </Form.Item>
                </Form>
            ));
            const { getByTestId } = await render(<Host />);
            await type(getByTestId('a-input'), '   ');
            await submit(form());
            expect(form().getFieldError('a')).toEqual(['不能空']);
        });

        it('多条 rule 合并校验：同一字段按当前值报对应的那条', async () => {
            const onFinish = jest.fn();
            const { Host, form } = harness((f) => (
                <Form form={f} onFinish={onFinish}>
                    <Form.Item
                        name="age"
                        rules={[
                            { required: true, message: '必填' },
                            { type: 'integer', min: 0, max: 150, message: '0-150' },
                        ]}
                    >
                        <Input testID="age" />
                    </Form.Item>
                </Form>
            ));
            const { getByTestId } = await render(<Host />);
            // 空 → required 报「必填」
            await submit(form());
            expect(form().getFieldError('age')).toEqual(['必填']);
            // 非整数 → 报「0-150」
            await type(getByTestId('age-input'), 'abc');
            await submit(form());
            expect(form().getFieldError('age')).toEqual(['0-150']);
            // 超范围 → 仍是「0-150」
            await type(getByTestId('age-input'), '200');
            await submit(form());
            expect(form().getFieldError('age')).toEqual(['0-150']);
            // 合法 → 通过并 onFinish
            await type(getByTestId('age-input'), '25');
            await submit(form());
            expect(onFinish).toHaveBeenCalledWith({ age: '25' });
        });
    });

    describe('label / colon / requiredMark', () => {
        it('labelAlign=right（horizontal 默认）', async () => {
            const { getByTestId } = await render(
                <Form>
                    <Form.Item label="l" name="l" testID="l">
                        <Input />
                    </Form.Item>
                </Form>
            );
            expect(styleOf(getByTestId('l-label')).textAlign).toBe('right');
        });

        it('labelAlign=left', async () => {
            const { getByTestId } = await render(
                <Form labelAlign="left">
                    <Form.Item label="l" name="l" testID="l">
                        <Input />
                    </Form.Item>
                </Form>
            );
            expect(styleOf(getByTestId('l-label')).textAlign).toBe('left');
        });

        it('colon=false 时不显示冒号', async () => {
            const { getByTestId } = await render(
                <Form colon={false}>
                    <Form.Item label="l" name="l" testID="l">
                        <Input />
                    </Form.Item>
                </Form>
            );
            const label = getByTestId('l-label');
            const text = [label.props.children]
                .flat()
                .map((c: unknown) => (typeof c === 'string' ? c : ''))
                .join('');
            expect(text.endsWith(':')).toBe(false);
        });

        it('colon=true（默认）时显示冒号', async () => {
            const { getByTestId } = await render(
                <Form>
                    <Form.Item label="l" name="l" testID="l">
                        <Input />
                    </Form.Item>
                </Form>
            );
            const label = getByTestId('l-label');
            const text = [label.props.children]
                .flat()
                .map((c: unknown) => (typeof c === 'string' ? c : ''))
                .join('');
            expect(text.endsWith(':')).toBe(true);
        });

        it('requiredMark=true 时 label 标红（取代 ::before 伪元素）', async () => {
            const { getByTestId } = await render(
                <Form requiredMark>
                    <Form.Item label="l" name="l" testID="l" required>
                        <Input />
                    </Form.Item>
                </Form>
            );
            expect(styleOf(getByTestId('l-label')).color).toBe(REQUIRED_COLOR);
        });

        it('requiredMark=false（默认）时 label 用常态色', async () => {
            const { getByTestId } = await render(
                <Form>
                    <Form.Item label="l" name="l" testID="l" required>
                        <Input />
                    </Form.Item>
                </Form>
            );
            expect(styleOf(getByTestId('l-label')).color).toBe(LABEL_COLOR);
        });

        it('labelCol/wrapperCol 折算成 flex 权重（取代 grid-column）', async () => {
            const { getByTestId } = await render(
                <Form labelCol={{ span: 8 }} wrapperCol={{ span: 16 }}>
                    <Form.Item label="l" name="l" testID="l">
                        <Input />
                    </Form.Item>
                </Form>
            );
            expect(styleOf(getByTestId('l-label')).flex).toBeCloseTo(8 / 24);
            expect(styleOf(getByTestId('l-control')).flex).toBeCloseTo(16 / 24);
        });
    });

    describe('高级功能', () => {
        it('noStyle 时不渲染外层容器', async () => {
            const { getByTestId, queryByTestId } = await render(
                <Form>
                    <Form.Item name="a" noStyle testID="a">
                        <Input testID="owner" />
                    </Form.Item>
                </Form>
            );
            expect(queryByTestId('a')).toBeNull();
            expect(getByTestId('owner-input')).toBeTruthy();
        });

        it('hasFeedback 时错误状态下显示 ✕ 图标', async () => {
            const { Host, form } = harness((f) => (
                <Form form={f}>
                    <Form.Item name="a" hasFeedback rules={[{ required: true, message: '必填' }]}>
                        <Input />
                    </Form.Item>
                </Form>
            ));
            const { getByText } = await render(<Host />);
            await submit(form());
            expect(getByText('✕')).toBeTruthy();
        });

        it('validateStatus=success 手动指定（覆盖自动推断）', async () => {
            const { getByTestId, getByText } = await render(
                <Form>
                    <Form.Item name="a" validateStatus="success" help="ok" testID="a">
                        <Input />
                    </Form.Item>
                </Form>
            );
            expect(getByText('ok')).toBeTruthy();
            expect(getByTestId('a-help')).toBeTruthy();
        });

        it('help 文本：无错误时显示', async () => {
            const { getByText } = await render(
                <Form>
                    <Form.Item name="a" help="说明">
                        <Input />
                    </Form.Item>
                </Form>
            );
            expect(getByText('说明')).toBeTruthy();
        });

        it('help 文本：有错误时被错误覆盖', async () => {
            const { Host, form } = harness((f) => (
                <Form form={f}>
                    <Form.Item name="a" help="说明" rules={[{ required: true, message: '必填' }]}>
                        <Input />
                    </Form.Item>
                </Form>
            ));
            const { getByText, queryByText } = await render(<Host />);
            await submit(form());
            expect(getByText('必填')).toBeTruthy();
            expect(queryByText('说明')).toBeNull();
        });

        it('disabled 透传到子组件', async () => {
            const { getByTestId } = await render(
                <Form disabled>
                    <Form.Item name="a">
                        <Input testID="a" />
                    </Form.Item>
                </Form>
            );
            expect(getByTestId('a-input').props.editable).toBe(false);
        });

        it('getValueFromEvent 自定义取值', async () => {
            // 自定义控件：`onChange` 直接吐字符串（不是事件对象）
            const CustomInput: React.FC<{ value?: string; onChange?: (v: string) => void }> = ({ value, onChange }) => (
                <Text testID="custom" onPress={() => onChange?.('from-custom')}>
                    {value ?? ''}
                </Text>
            );
            const { Host, form } = harness((f) => (
                <Form form={f}>
                    <Form.Item name="custom" getValueFromEvent={(v) => v}>
                        <CustomInput />
                    </Form.Item>
                </Form>
            ));
            const { getByTestId } = await render(<Host />);
            await fireEvent.press(getByTestId('custom'));
            expect(form().getFieldValue('custom')).toBe('from-custom');
        });

        it('normalize 在 setFieldValue 前标准化', async () => {
            const { Host, form } = harness((f) => (
                <Form form={f}>
                    <Form.Item name="a" normalize={(v) => String(v).toUpperCase()}>
                        <Input testID="a" />
                    </Form.Item>
                </Form>
            ));
            const { getByTestId } = await render(<Host />);
            await type(getByTestId('a-input'), 'abc');
            expect(form().getFieldValue('a')).toBe('ABC');
        });

        it('valuePropName 切换（如 checkbox 用 checked）', async () => {
            const Fake: React.FC<{ checked?: boolean; onChange?: (v: boolean) => void }> = ({ checked, onChange }) => (
                <Text testID="fake" onPress={() => onChange?.(!checked)}>
                    {String(checked)}
                </Text>
            );
            const { Host, form } = harness((f) => (
                <Form form={f}>
                    <Form.Item name="c" valuePropName="checked" getValueFromEvent={(e) => e}>
                        <Fake />
                    </Form.Item>
                </Form>
            ));
            const { getByTestId } = await render(<Host />);
            await fireEvent.press(getByTestId('fake'));
            expect(form().getFieldValue('c')).toBe(true);
        });
    });

    describe('命令式 API', () => {
        it('validateFields 返回通过时的 values', async () => {
            const { Host, form } = harness((f) => (
                <Form form={f} initialValues={{ a: '1' }}>
                    <Form.Item name="a">
                        <Input />
                    </Form.Item>
                </Form>
            ));
            await render(<Host />);
            let values: unknown;
            await act(async () => {
                values = await form().validateFields();
            });
            expect(values).toEqual({ a: '1' });
        });

        it('validateFields 校验失败抛带 errorFields 的 Error', async () => {
            const { Host, form } = harness((f) => (
                <Form form={f}>
                    <Form.Item name="a" rules={[{ required: true, message: '必填' }]}>
                        <Input />
                    </Form.Item>
                </Form>
            ));
            await render(<Host />);
            await expect(form().validateFields()).rejects.toMatchObject({
                message: 'Validation failed',
                errorFields: [{ name: 'a', errors: ['必填'] }],
            });
        });

        it('getFieldsValue(true) 包含未注册字段', async () => {
            const { Host, form } = harness((f) => (
                <Form form={f} initialValues={{ a: 1, b: 2 }}>
                    <Form.Item name="a">
                        <Input />
                    </Form.Item>
                </Form>
            ));
            await render(<Host />);
            expect(form().getFieldsValue(true)).toEqual({ a: 1, b: 2 });
        });

        it('setFields 设置错误信息', async () => {
            const { Host, form } = harness((f) => (
                <Form form={f}>
                    <Form.Item name="a">
                        <Input />
                    </Form.Item>
                </Form>
            ));
            await render(<Host />);
            await act(async () => {
                form().setFields([{ name: 'a', errors: ['手动错误'] }]);
            });
            expect(form().getFieldError('a')).toEqual(['手动错误']);
        });

        it('scrollToField 在 RN 是空操作（调用不抛错）', async () => {
            const { Host, form } = harness((f) => (
                <Form form={f}>
                    <Form.Item name="a">
                        <Input />
                    </Form.Item>
                </Form>
            ));
            await render(<Host />);
            expect(() => form().scrollToField('a')).not.toThrow();
        });
    });

    describe('onValuesChange', () => {
        it('单字段 change 触发，changedValues 仅含变化字段', async () => {
            const onValuesChange = jest.fn();
            const { getByTestId } = await render(
                <Form initialValues={{ a: '', b: '' }} onValuesChange={onValuesChange}>
                    <Form.Item name="a">
                        <Input testID="a" />
                    </Form.Item>
                    <Form.Item name="b">
                        <Input testID="b" />
                    </Form.Item>
                </Form>
            );
            await type(getByTestId('a-input'), 'x');
            expect(onValuesChange).toHaveBeenCalledWith({ a: 'x' }, { a: 'x', b: '' });
        });

        it('onValuesChange 第二个参数是全量 values', async () => {
            const seen: unknown[] = [];
            const { getByTestId } = await render(
                <Form initialValues={{ a: '1' }} onValuesChange={(_c, all) => seen.push(all)}>
                    <Form.Item name="a">
                        <Input testID="a" />
                    </Form.Item>
                </Form>
            );
            await type(getByTestId('a-input'), '2');
            expect(seen[seen.length - 1]).toEqual({ a: '2' });
        });
    });

    describe('initialValues 同步', () => {
        it('initialValues 内容变化时 setFieldsValue 会再调', async () => {
            const calls: string[] = [];
            const Host: React.FC<{ v: string }> = ({ v }) => {
                const [f] = Form.useForm();
                // 每次渲染都是新实例，所以在渲染期包一层记录
                const original = f.setFieldsValue;
                if (!(f as unknown as { __wrapped?: boolean }).__wrapped) {
                    (f as unknown as { __wrapped?: boolean }).__wrapped = true;
                    f.setFieldsValue = (values: Parameters<typeof original>[0]) => {
                        calls.push(JSON.stringify(values));
                        return original.call(f, values);
                    };
                }
                return (
                    <Form form={f} initialValues={{ a: v }}>
                        <Form.Item name="a">
                            <Input testID="a" />
                        </Form.Item>
                    </Form>
                );
            };
            const { rerender } = await render(<Host v="1" />);
            const after = calls.length;
            await rerender(<Host v="2" />);
            expect(calls.length).toBeGreaterThan(after);
            expect(calls[calls.length - 1]).toBe(JSON.stringify({ a: '2' }));
        });
    });

    describe('Form.Provider', () => {
        it('Provider 注入 form 实例，FormItem 仍可注册', async () => {
            const { Host, form } = harness((f) => (
                <Form.Provider form={f}>
                    <View>
                        <Form.Item name="a">
                            <Input testID="a" />
                        </Form.Item>
                    </View>
                </Form.Provider>
            ));
            const { getByTestId } = await render(<Host />);
            await type(getByTestId('a-input'), 'from-provider');
            expect(form().getFieldValue('a')).toBe('from-provider');
        });
    });
});
