import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    ScrollView,
    StyleSheet,
    Text,
    View,
    type StyleProp,
    type ViewProps,
    type ViewStyle,
} from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Pagination, type PaginationProps } from '../Pagination';

export interface TableColumn<T = Record<string, unknown>> {
    title: React.ReactNode;
    dataIndex?: keyof T;
    render?: (value: unknown, record: T, index: number) => React.ReactNode;
    /** 列宽 */
    width?: ViewStyle['width'];
    align?: 'left' | 'center' | 'right';
    /**
     * 固定列。
     *
     * ⚠️ **在 RN 里是空操作（no-op）**：上游靠 `position: sticky` 实现列固定，
     * RN 没有 sticky。保留 prop 只为守住上游 API 的形状；也不会报错。
     */
    fixed?: 'left' | 'right';
    /** 单元格自定义样式（取代 Web 的 `style: CSSProperties`） */
    style?: StyleProp<ViewStyle>;
}

export interface TableProps {
    columns?: TableColumn[];
    dataSource?: Record<string, unknown>[];
    rowKey?: string | ((record: Record<string, unknown>) => string);
    striped?: boolean;
    showHeader?: boolean;
    /**
     * 行样式（取代 Web 的 `rowClassName`）。
     *
     * ⚠️ 这是**改名**：上游是 `rowClassName?: string | ((record, index) => string)`，
     * 而 RN 没有 class。等价物就是样式，故改为 `rowStyle` 并保持同样的
     * 「值 / 函数」两种形态。
     */
    rowStyle?: StyleProp<ViewStyle> | ((record: Record<string, unknown>, index: number) => StyleProp<ViewStyle>);
    /**
     * 行上的额外 props（上游 `onRow` 返回 `<tr>` 的 HTML 属性）。
     *
     * ⚠️ 语义收窄：上游返回的是 `HTMLAttributes<HTMLTableRowElement>`（`onClick` 等 DOM
     * 属性），RN 这里返回 `ViewProps`。DOM 专属属性（`className`、`tabIndex`、`data-*`）
     * 在 RN 上不存在，传了也不会生效。
     */
    onRow?: (record: Record<string, unknown>, index: number) => ViewProps;
    loading?: boolean;
    emptyText?: React.ReactNode;
    /** 滚动容器；传了就把表格放进 `ScrollView`（上游是 `.scrollable { overflow: auto }`） */
    scroll?: {
        x?: number | string;
        y?: number | string;
    };
    /** 分页配置；传入对象开启客户端分页，false 或缺省不分页（total 由 Table 内部按数据量计算） */
    pagination?: false | Omit<PaginationProps, 'total'>;
    /** 自定义样式（取代 Web 的 `className`） */
    style?: StyleProp<ViewStyle>;
    /** 测试标识，同时作为 `-table` / `-head` / `-body` / `-row-N` / `-empty` / `-loading` 的前缀 */
    testID?: string;
}

/** `.headerRow::after` / `.row::after`：6px 实线 + 6px 透明的虚线分隔条 */
const DASH_COLOR = 'rgb(240, 232, 216)';

/**
 * 上游的 `::after` 虚线分隔条。
 *
 * CSS 是 `repeating-linear-gradient(90deg, … 0 6px, transparent 6px 12px)`；
 * RN 没有 repeating-gradient，用 SVG 的 `strokeDasharray` 还原（与 Divider 同一套做法）。
 * 上游把它画在 `tr::after` 上（绝对定位、左右各内缩 20px），RN 里只能是真实节点。
 */
const DashedSeparator: React.FC<{ testID?: string }> = ({ testID }) => (
    <View style={styles.separator} aria-hidden testID={testID}>
        <Svg width="100%" height={1}>
            <Line x1={0} y1={0.5} x2="100%" y2={0.5} stroke={DASH_COLOR} strokeWidth={1} strokeDasharray="6 6" />
        </Svg>
    </View>
);

/** `.emptyIcon`：24×24 的「空表格」图标。上游用 `fill="currentColor"`，RN 只能写死颜色 */
const EmptyIcon: React.FC = () => (
    <Svg viewBox="0 0 24 24" width={48} height={48}>
        <Path
            fill="#9f927d"
            d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z"
        />
    </Svg>
);

/** `.loadingSpinner`：一圈 1s 匀速旋转的圆环（上游 `@keyframes spin`） */
const LoadingSpinner: React.FC<{ testID?: string }> = ({ testID }) => {
    const spin = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        const loop = Animated.loop(
            Animated.timing(spin, {
                toValue: 1,
                duration: 1000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        );
        loop.start();
        return () => loop.stop();
    }, [spin]);

    return (
        <Animated.View
            style={{
                transform: [
                    {
                        rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
                    },
                ],
            }}
            testID={testID}
        >
            <Svg viewBox="0 0 50 50" width={40} height={40}>
                {/* 上游 `@keyframes dash` 让 dasharray 变化；RN 里只保留静态的那一圈 */}
                <Circle
                    cx={25}
                    cy={25}
                    r={20}
                    fill="none"
                    stroke="#19c8b9"
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeDasharray="31.4 31.4"
                />
            </Svg>
        </Animated.View>
    );
};

/**
 * 纯字符串 / 数字在 RN 里必须包一层 `<Text>` 才能渲染。
 *
 * ⚠️ `textAlign` 是 `TextStyle` 的属性，`ViewStyle` 上没有 —— 上游的 `text-align: right`
 * 写在 `<th>` / `<td>` 上，RN 只能：容器用 `alignItems`（flex 语义），
 * 纯文本子节点再补一层 `textAlign`。自定义 `render` 返回的节点拿不到这个样式，
 * 这是 RN 版的固有损失。
 */
const asNode = (node: React.ReactNode, textAlign?: 'left' | 'center' | 'right'): React.ReactNode =>
    typeof node === 'string' || typeof node === 'number' ? (
        <Text style={textAlign ? { textAlign } : undefined}>{node}</Text>
    ) : (
        node
    );

/** `align` 在 RN 容器上的对应物：flex 的主轴对齐 */
const alignItemsOf = (align: TableColumn['align']): ViewStyle['alignItems'] =>
    align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';

/**
 * Table 表格
 *
 * ## 与上游的结构性差异
 *
 * | 上游（Web）                              | RN 版                                                        |
 * | ---------------------------------------- | ------------------------------------------------------------ |
 * | `<table>/<thead>/<tbody>/<tr>/<th>/<td>` | `View` + `role="table"/"rowgroup"/"row"/"columnheader"/"cell"` |
 * | `.row:hover` 高亮                        | 丢弃（RN 没有 hover）                                         |
 * | `.row::after` 虚线（CSS 渐变）           | 真实节点 + `react-native-svg` 的 `strokeDasharray`            |
 * | `.scrollable { overflow: auto }`         | `ScrollView`                                                  |
 * | `.loadingOverlay { backdrop-filter: blur }` | 丢弃（RN 没有 backdrop-filter），只留半透明底                |
 * | `column.fixed`（`position: sticky`）     | 空操作，见 `TableColumn.fixed`                                |
 * | `rowClassName`（CSS 类）                 | 改名 `rowStyle`，见 `TableProps.rowStyle`                     |
 * | `onRow` 返回 `<tr>` 的 HTML 属性         | 返回 `ViewProps`，见 `TableProps.onRow`                       |
 * | `@keyframes dash`（dasharray 变化）      | 只保留静态圆环（无限动画的 dash 变化在 RN 上要起第二条 loop）|
 *
 * RN 的 `Role` union **包含** `table` / `rowgroup` / `row` / `columnheader` / `cell`，
 * 所以表格语义是能真实表达的，不是退化。
 */
export const Table: React.FC<TableProps> = ({
    columns = [],
    dataSource = [],
    rowKey = 'key',
    striped = true,
    showHeader = true,
    rowStyle,
    onRow,
    loading = false,
    emptyText = '暂无数据',
    scroll,
    pagination,
    style,
    testID,
}) => {
    // 分页状态：pagination.current / pagination.pageSize 受控时优先，否则走内部状态（初值取 default*）
    const paginated = pagination !== false && pagination !== undefined;
    const [innerPage, setInnerPage] = useState(() =>
        paginated ? ((pagination as PaginationProps).defaultCurrent ?? 1) : 1
    );
    const [innerPageSize, setInnerPageSize] = useState(() =>
        paginated ? ((pagination as PaginationProps).defaultPageSize ?? 10) : 10
    );
    const pageSize = paginated ? ((pagination as PaginationProps).pageSize ?? innerPageSize) : dataSource.length;
    const pageCount = Math.max(1, Math.ceil(dataSource.length / Math.max(1, pageSize)));
    const currentPage = paginated ? Math.min((pagination as PaginationProps).current ?? innerPage, pageCount) : 1;
    const pageData = paginated ? dataSource.slice((currentPage - 1) * pageSize, currentPage * pageSize) : dataSource;

    const getRowKey = (record: Record<string, unknown>, index: number): string => {
        if (typeof rowKey === 'function') return rowKey(record);
        return (record[rowKey] as string) || String(index);
    };

    const rowStyleOf = (record: Record<string, unknown>, index: number): StyleProp<ViewStyle> =>
        typeof rowStyle === 'function' ? rowStyle(record, index) : rowStyle;

    const renderCell = (column: TableColumn, record: Record<string, unknown>, index: number) => {
        const value = column.dataIndex ? record[column.dataIndex as string] : undefined;
        return asNode(column.render ? column.render(value, record, index) : (value as React.ReactNode));
    };

    const tableBody = (
        <View
            role="table"
            style={[styles.table, loading && styles.tableLoading]}
            testID={testID ? `${testID}-table` : undefined}
        >
            {showHeader && (
                <View role="rowgroup" testID={testID ? `${testID}-head` : undefined}>
                    <View role="row" style={styles.headerRow}>
                        {columns.map((column, index) => (
                            <View
                                key={index}
                                role="columnheader"
                                style={[
                                    styles.headerCell,
                                    { width: column.width, alignItems: alignItemsOf(column.align) },
                                    column.width ? undefined : styles.cellFlex,
                                    column.style,
                                ]}
                            >
                                {asNode(column.title, column.align)}
                            </View>
                        ))}
                    </View>
                    <DashedSeparator testID={testID ? `${testID}-head-sep` : undefined} />
                </View>
            )}
            <View role="rowgroup" testID={testID ? `${testID}-body` : undefined}>
                {dataSource.length === 0 ? (
                    <View style={styles.emptyContent} testID={testID ? `${testID}-empty` : undefined}>
                        <EmptyIcon />
                        {asNode(emptyText)}
                    </View>
                ) : (
                    pageData.map((record, index) => (
                        <View key={getRowKey(record, index)}>
                            <View
                                role="row"
                                style={[
                                    styles.row,
                                    striped && index % 2 === 1 && styles.striped,
                                    rowStyleOf(record, index),
                                ]}
                                testID={testID ? `${testID}-row-${index}` : undefined}
                                {...onRow?.(record, index)}
                            >
                                {columns.map((column, colIndex) => (
                                    <View
                                        key={colIndex}
                                        role="cell"
                                        style={[
                                            styles.cell,
                                            { alignItems: alignItemsOf(column.align) },
                                            column.width ? undefined : styles.cellFlex,
                                            column.style,
                                        ]}
                                    >
                                        {renderCell(column, record, index)}
                                    </View>
                                ))}
                            </View>
                            {/* `.row:last-child::after { display: none }` */}
                            {index < pageData.length - 1 && <DashedSeparator />}
                        </View>
                    ))
                )}
            </View>
        </View>
    );

    return (
        <View style={[styles.wrapper, style]} testID={testID}>
            {scroll ? (
                <ScrollView
                    horizontal={scroll.x !== undefined}
                    style={scroll.y !== undefined ? { maxHeight: scroll.y as number } : undefined}
                >
                    {tableBody}
                </ScrollView>
            ) : (
                tableBody
            )}
            {paginated && (
                <View style={styles.paginationWrapper}>
                    <Pagination
                        {...(pagination as PaginationProps)}
                        total={dataSource.length}
                        current={currentPage}
                        pageSize={pageSize}
                        onChange={(page, size) => {
                            if ((pagination as PaginationProps).current === undefined) setInnerPage(page);
                            if ((pagination as PaginationProps).pageSize === undefined) setInnerPageSize(size);
                            (pagination as PaginationProps).onChange?.(page, size);
                        }}
                    />
                </View>
            )}
            {loading && (
                <View style={styles.loadingOverlay} testID={testID ? `${testID}-loading` : undefined}>
                    <LoadingSpinner testID={testID ? `${testID}-spinner` : undefined} />
                </View>
            )}
        </View>
    );
};

Table.displayName = 'Table';

const styles = StyleSheet.create({
    // `.wrapper { position:relative; width:100%; background: rgb(247,243,223); border-radius:20px; padding:6px }`
    wrapper: {
        position: 'relative',
        width: '100%',
        backgroundColor: 'rgb(247, 243, 223)',
        borderRadius: 20,
        padding: 6,
    },
    // `.table { width: 100% }`
    table: {
        width: '100%',
    },
    // `.loading { opacity: .7; pointer-events: none }`
    // ⚠️ `pointer-events: none` 在 RN 上要用 `pointerEvents` prop，这里用样式表做不到，
    //    改为只在 overlay 上拦触摸（overlay 盖满且不吃事件），表格本身的穿透未还原。
    tableLoading: {
        opacity: 0.7,
    },
    // `.headerRow { position: relative }`
    headerRow: {
        flexDirection: 'row',
    },
    // `.headerCell { padding: 16px 20px; font-size:14px; font-weight:700; color:#725d42 }`
    // ⚠️ `white-space: nowrap` 在 RN 上没有直接对应物（要用 `numberOfLines={1}` + 不换行宽度），
    //    这里只在 `<Text>` 上生效不了，故未还原。
    headerCell: {
        paddingVertical: 16,
        paddingHorizontal: 20,
        fontSize: 14,
        fontWeight: '700',
        color: '#725d42',
    },
    // 未指定 `column.width` 时让单元格等分（上游是 table 的自动列宽）
    cellFlex: {
        flex: 1,
    },
    // `.row { position: relative }`
    row: {
        flexDirection: 'row',
    },
    // `.striped { background: rgba(248, 248, 240, .6) }`
    striped: {
        backgroundColor: 'rgba(248, 248, 240, 0.6)',
    },
    // `.cell { padding: 14px 20px; font-size:14px; font-weight:500; color:#725d42; line-height:1.6 }`
    cell: {
        paddingVertical: 14,
        paddingHorizontal: 20,
        fontSize: 14,
        fontWeight: '500',
        color: '#725d42',
        lineHeight: 22,
    },
    // `::after` 的左右内缩 20px
    separator: {
        marginHorizontal: 20,
        height: 1,
    },
    // `.emptyContent { display:flex; flex-direction:column; align-items:center; gap:16px;
    //                  color:#9f927d; font-size:14px }`
    emptyContent: {
        alignItems: 'center',
        gap: 16,
        paddingVertical: 60,
        paddingHorizontal: 20,
    },
    // `.paginationWrapper { display:flex; justify-content:flex-end; padding: 10px 16px 8px }`
    paginationWrapper: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingTop: 10,
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    // `.loadingOverlay { position:absolute; inset:0; display:flex; align-items:center;
    //                    justify-content:center; background: rgba(247,243,223,.8) }`
    // ⚠️ `backdrop-filter: blur(2px)` 在 RN 上没有对应物，未还原。
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(247, 243, 223, 0.8)',
    },
});
