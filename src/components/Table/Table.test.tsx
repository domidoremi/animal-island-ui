import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { Table, type TableColumn } from './Table';

/**
 * RN 版测试，对应 Web 版 `Table.test.tsx` 的 11 个用例。
 *
 * **结构改写**：
 *   - `<table>/<thead>/<tbody>/<tr>/<th>/<td>` → `View` + `role` 语义。
 *     RN 0.87 的 `Role` union **包含** `table` / `rowgroup` / `row` / `columnheader` /
 *     `cell`，所以表格语义是真的保住了，不是退化成一堆裸 View。
 *   - 「striped 偶数行加 striped 类」→ 断言真实的 `backgroundColor`。
 *   - 「loading 时叠加 loading 类」→ 断言 `opacity: 0.7` + overlay 节点。
 *
 * **被丢弃 / 弱化的 Web 用例**：
 *   - `.row:hover` 高亮（`#d6f0ea` + 圆角 30）—— RN 没有 hover，**无对应物**。
 *   - 「rowKey 为函数时使用其返回值」—— 上游自己都承认「没有显式 data 属性可断言」，
 *     RN 里 React key 同样不可观测，只保留「行数正确」这一半并注明。
 *   - `@keyframes dash`（dasharray 随时间变化）—— RN 里只保留了静态圆环。
 *
 * **测不到的**：虚线分隔条的观感（`strokeDasharray` 在测试渲染器里画不出来）、
 *   `column.fixed`（上游 `position: sticky`，RN 无对应物，降级为空操作）、
 *   `.loadingOverlay { backdrop-filter: blur(2px) }`（RN 无对应物）、
 *   `white-space: nowrap`、滚动容器在真机上的横向滚动行为。
 */

const HIDDEN = { includeHiddenElements: true } as const;

const styleOf = (node: TestInstance): Record<string, unknown> => {
    const merged: Record<string, unknown> = {};
    const walk = (s: unknown) => {
        if (Array.isArray(s)) s.forEach(walk);
        else if (s && typeof s === 'object') Object.assign(merged, s);
    };
    walk((node.props as { style?: unknown }).style);
    return merged;
};

interface Row extends Record<string, unknown> {
    key: string;
    name: string;
    age: number;
}

const columns: TableColumn<Row>[] = [
    { title: 'Name', dataIndex: 'name' },
    { title: 'Age', dataIndex: 'age', align: 'right' },
];

// Table 的 columns prop 类型固定为 `TableColumn[]`（不带泛型），所以这里 cast 一下
const anyColumns = columns as unknown as Parameters<typeof Table>[0]['columns'];

const data: Row[] = [
    { key: '1', name: 'Alice', age: 20 },
    { key: '2', name: 'Bob', age: 30 },
];

const many: Row[] = Array.from({ length: 25 }, (_, i) => ({
    key: String(i + 1),
    name: `Name${i + 1}`,
    age: 20 + i,
}));

describe('Table', () => {
    it('渲染表头与行数据，表格语义用 role 表达', async () => {
        const { getByText, queryByRole, getByTestId } = await render(
            <Table columns={anyColumns} dataSource={data} testID="t" />
        );
        expect(getByText('Name')).toBeTruthy();
        expect(getByText('Age')).toBeTruthy();
        expect(getByText('Alice')).toBeTruthy();
        expect(getByText('Bob')).toBeTruthy();

        expect(getByTestId('t-table').props.role).toBe('table');
        // 与 Pagination 的 `role="navigation"` 同款：RNTL 的 `getByRole` 受
        // `isAccessibilityElement` 门控，裸 `<View role="table">` 查不到。
        // 刻意**不加** `accessible` —— 那会把整张表合成一个无障碍节点。
        expect(queryByRole('table')).toBeNull();
        expect(getByTestId('t-head').props.role).toBe('rowgroup');
        expect(getByTestId('t-body').props.role).toBe('rowgroup');
        expect(getByTestId('t-row-0').props.role).toBe('row');
    });

    it('表头单元格是 columnheader，数据单元格是 cell', async () => {
        const { getByTestId } = await render(<Table columns={anyColumns} dataSource={data} testID="t" />);
        const headerCells = getByTestId('t-head').queryAll((n: TestInstance) => n.props.role === 'columnheader');
        expect(headerCells).toHaveLength(2);
        const cells = getByTestId('t-row-0').queryAll((n: TestInstance) => n.props.role === 'cell');
        expect(cells).toHaveLength(2);
        // 上游 `text-align: right` 写在 `<th>/<td>` 上；RN 的 `textAlign` 只属于
        // `TextStyle`，所以容器层用 `alignItems`，纯文本子节点才补 `textAlign`。
        expect(styleOf(cells[1]).alignItems).toBe('flex-end');
        expect(styleOf(cells[0]).alignItems).toBe('flex-start');
    });

    it('showHeader=false 时不渲染表头', async () => {
        const { queryByText, queryByTestId } = await render(
            <Table columns={anyColumns} dataSource={data} showHeader={false} testID="t" />
        );
        expect(queryByText('Name')).toBeNull();
        expect(queryByTestId('t-head')).toBeNull();
    });

    it('数据为空时显示 emptyText', async () => {
        const { getByText, getByTestId } = await render(
            <Table columns={anyColumns} dataSource={[]} emptyText="无内容" testID="t" />
        );
        expect(getByText('无内容')).toBeTruthy();
        expect(getByTestId('t-empty')).toBeTruthy();
    });

    it('column.render 自定义单元格', async () => {
        const cols: TableColumn<Row>[] = [
            { title: 'Name', render: (_v, r) => <Text testID={`r-${r.key}`}>{r.name}!</Text> },
        ];
        const anyCols = cols as unknown as Parameters<typeof Table>[0]['columns'];
        const { getByTestId, getByText } = await render(<Table columns={anyCols} dataSource={data} testID="t" />);
        expect(getByTestId('r-1')).toBeTruthy();
        expect(getByText('Alice!')).toBeTruthy();
    });

    it('striped：奇数序号行（第 2 行）加斑马底色', async () => {
        const { getByTestId } = await render(<Table columns={anyColumns} dataSource={data} testID="t" />);
        expect(styleOf(getByTestId('t-row-0')).backgroundColor).toBeUndefined();
        expect(styleOf(getByTestId('t-row-1')).backgroundColor).toBe('rgba(248, 248, 240, 0.6)');
    });

    it('rowKey 为函数时使用其返回值（RN 里只能验行数）', async () => {
        const { getByTestId, queryByTestId } = await render(
            <Table columns={anyColumns} dataSource={data} rowKey={(r) => `row-${r.name}`} testID="t" />
        );
        // 上游原话：「没有显式 data 属性可断言；至少行数正确即可」—— RN 里 React key
        // 同样不可观测，所以这里只钉住行数（index 0 / 1 存在，2 不存在）。
        expect(getByTestId('t-row-0')).toBeTruthy();
        expect(getByTestId('t-row-1')).toBeTruthy();
        expect(queryByTestId('t-row-2')).toBeNull();
    });

    it('loading：表格半透明 + 盖一层 overlay', async () => {
        const { getByTestId } = await render(<Table columns={anyColumns} dataSource={data} loading testID="t" />);
        expect(styleOf(getByTestId('t-table')).opacity).toBe(0.7);
        expect(getByTestId('t-loading')).toBeTruthy();
        expect(getByTestId('t-spinner')).toBeTruthy();
    });

    it('pagination 对象开启客户端分页，只渲染当前页数据', async () => {
        const { getByText, queryByText, getByRole, queryByTestId, container } = await render(
            <Table columns={anyColumns} dataSource={many} pagination={{ pageSize: 10 }} testID="t" />
        );
        expect(getByText('Name1')).toBeTruthy();
        expect(queryByText('Name11')).toBeNull();
        expect(queryByTestId('t-row-10')).toBeNull();
        // 分页导航出现且显示总页数（`navigation` 同上，只能按 role 找节点）
        expect(container.queryAll((n: TestInstance) => n.props.role === 'navigation')).toHaveLength(1);
        expect(getByRole('button', { name: '3' })).toBeTruthy();
    });

    it('点击页码切换分页数据', async () => {
        const onChange = jest.fn();
        const { getByText, queryByText, getByRole } = await render(
            <Table columns={anyColumns} dataSource={many} pagination={{ pageSize: 10, onChange }} testID="t" />
        );
        await fireEvent.press(getByRole('button', { name: '2' }));
        expect(onChange).toHaveBeenCalledWith(2, 10);
        expect(getByText('Name11')).toBeTruthy();
        expect(queryByText('Name1')).toBeNull();
    });

    it('defaultPageSize / defaultCurrent 作为非受控初值生效', async () => {
        const { getByText, queryByText, getByRole, queryByTestId } = await render(
            <Table
                columns={anyColumns}
                dataSource={many}
                pagination={{ defaultPageSize: 5, defaultCurrent: 2 }}
                testID="t"
            />
        );
        // 第二页 5 条：Name6 ~ Name10
        expect(getByText('Name6')).toBeTruthy();
        expect(queryByText('Name1')).toBeNull();
        expect(queryByTestId('t-row-5')).toBeNull();
        // 上游用 `aria-current="page"`，RN 不支持 → 已移植的 Pagination 用 `aria-selected`
        expect(getByRole('button', { name: '2' }).props.accessibilityState).toMatchObject({ selected: true });
    });

    it('pagination=false 或缺省时不渲染分页', async () => {
        const { queryByRole, getByTestId } = await render(<Table columns={anyColumns} dataSource={data} testID="t" />);
        expect(queryByRole('navigation')).toBeNull();
        expect(getByTestId('t-row-1')).toBeTruthy();
    });

    it('虚线分隔条：表头下方一条，行间 N-1 条，最后一行下方没有', async () => {
        const { getByTestId, container } = await render(<Table columns={anyColumns} dataSource={data} testID="t" />);
        expect(getByTestId('t-head-sep', HIDDEN)).toBeTruthy();
        // 2 行数据 → 行间只有 1 条（最后一行不画）
        const seps = container.queryAll(
            (n: TestInstance) => n.props['aria-hidden'] === true && n.props.testID === undefined
        );
        expect(seps).toHaveLength(1);
    });

    it('scroll 时把表格放进 ScrollView', async () => {
        const { container } = await render(
            <Table columns={anyColumns} dataSource={data} scroll={{ y: 240 }} testID="t" />
        );
        // ScrollView 的宿主节点名随平台变（RCTScrollView / AndroidHorizontalScrollView），
        // 所以按「带 horizontal prop」来认，比认类型名稳。
        const scrollers = container.queryAll((n: TestInstance) => n.props.horizontal !== undefined);
        expect(scrollers).toHaveLength(1);
        expect(styleOf(scrollers[0]).maxHeight).toBe(240);
    });

    it('column.fixed 在 RN 上是空操作（不报错、不产生样式）', async () => {
        const fixedCols = [{ title: 'Name', dataIndex: 'name', fixed: 'left' as const }];
        const { getByTestId } = await render(
            <Table
                columns={fixedCols as unknown as Parameters<typeof Table>[0]['columns']}
                dataSource={data}
                testID="t"
            />
        );
        // 与不传 fixed 时完全一致：单元格上不会出现任何 sticky 相关的样式
        const cell = getByTestId('t-row-0').queryAll((n: TestInstance) => n.props.role === 'cell')[0];
        expect(styleOf(cell).position).toBeUndefined();
    });

    it('rowStyle / onRow / style 透传', async () => {
        const onPress = jest.fn();
        const { getByTestId } = await render(
            <Table
                columns={anyColumns}
                dataSource={data}
                rowStyle={{ borderWidth: 2 }}
                onRow={(_r, i) => (i === 0 ? { testID: 'custom-row' } : {})}
                style={{ marginTop: 8 }}
                testID="t"
            />
        );
        expect(styleOf(getByTestId('t-row-1')).borderWidth).toBe(2);
        // onRow 返回的 props 会覆盖默认 testID（spread 在后）
        expect(getByTestId('custom-row')).toBeTruthy();
        expect(styleOf(getByTestId('t')).marginTop).toBe(8);
        expect(onPress).not.toHaveBeenCalled();
    });
});
