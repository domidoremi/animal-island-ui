import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
    useWindowDimensions,
    type StyleProp,
    type ViewInstance,
    type ViewStyle,
} from 'react-native';
import { Path, Svg } from 'react-native-svg';
import { computeSizeListPosition, getPageItems, type PanelPosition } from './geometry';

export type PaginationVariant = 'orange' | 'teal';

export interface PaginationProps {
    /** 数据总数 */
    total: number;
    /** 当前页（受控） */
    current?: number;
    /** 默认当前页 */
    defaultCurrent?: number;
    /** 每页条数（受控） */
    pageSize?: number;
    /** 默认每页条数 */
    defaultPageSize?: number;
    /** 页码或每页条数变化时触发 */
    onChange?: (page: number, pageSize: number) => void;
    /** 每页条数变化时触发 */
    onShowSizeChange?: (current: number, size: number) => void;
    /** 是否显示每页条数切换器 */
    showSizeChanger?: boolean;
    /** 可选的每页条数列表 */
    pageSizeOptions?: number[];
    /** 是否显示快速跳转输入框 */
    showQuickJumper?: boolean;
    /** 是否显示总条数文本 */
    showTotal?: boolean;
    /** 是否禁用 */
    disabled?: boolean;
    /** 配色：orange 琥珀橘（DatePicker 范围选择同款，默认）/ teal 青 */
    variant?: PaginationVariant;
    /**
     * 自定义样式（作用于最外层 View）。
     *
     * 对应 Web 版的 `className`：RN 没有类名系统，`style` 是它的替代物。
     */
    style?: StyleProp<ViewStyle>;
    /** 测试标识（RN 里 `className` 的对应物） */
    testID?: string;
}

/**
 * 配色变体 —— 对应 `.orange` / `.teal` 两组规则。
 *
 * ⚠️ **`:hover` 全部丢弃**（见 RN-PORT.md：触摸设备没有 hover）：
 *   - `.orange .item:hover:not(:disabled):not(.active) { background: #ffd54f; color: #725d42 }`
 *   - `.teal   .item:hover:not(:disabled):not(.active) { background: #e6f9f6; color: #19c8b9 }`
 *   - `.orange .active:hover { background: #ffb400 }` / `.teal .active:hover { background: #3dd4c6 }`
 * 代价：页码/翻页按钮在触摸设备上**没有按下反馈**（上游唯一的反馈就是 hover）。
 * 与 Tag 的处理一致（Tag 也丢弃了 hover 并接受同一代价）。
 *
 * 注：`pagination.module.less` **没有 `@import` 任何 Less 变量**，颜色全部硬编码，
 * 所以这里也逐条照搬硬编码值，不走 `src/theme/tokens.ts`。
 */
type VariantPalette = {
    /** 当前页底色 */
    active: string;
    /** 展开时箭头颜色 */
    caretOpen: string;
};

const VARIANT_PALETTE: Record<PaginationVariant, VariantPalette> = {
    orange: { active: '#ffc107', caretOpen: '#ffb400' },
    teal: { active: '#19c8b9', caretOpen: '#19c8b9' },
};

/** Less 里硬编码的颜色，逐字照搬 */
const PALETTE = {
    text: '#725d42',
    textActive: '#fff',
    textDisabled: '#d4c9b4',
    totalText: '#a09080',
    ellipsisText: '#c4b89e',
    triggerBorder: '#e8dcc8',
    triggerBg: '#fff',
    triggerBgDisabled: '#f5f5f0',
    caret: '#a09080',
    listBg: '#ffeea0',
    jumperText: '#8a7b66',
    jumperInputBg: '#fffbe7',
    jumperInputBgDisabled: '#ece8dc',
    optionPill: '#ffcc00',
} as const;

/**
 * 弹层挂载时使用的兜底位置。
 *
 * 真机上 `measureInWindow` 回调到达前会先落在这里（下一帧就被校正），
 * 测试渲染器里回调**永不触发**，所以断言时看到的就是这个值。
 * 取 `{ bottom: 0, left: 0 }`：弹层本来就是「向上弹出」，兜底也贴在窗口底部。
 */
const FALLBACK_SIZE_LIST_POSITION: PanelPosition = { bottom: 0, left: 0 };

/**
 * 上一页 / 下一页的箭头。
 *
 * Web 版是内联 `<svg>` 且用 `stroke="currentColor"` 从 `.item { color: #725d42 }`
 * 取色；RN 没有 `currentColor`，所以颜色必须显式透传进来。
 */
const ChevronIcon: React.FC<{ color: string; direction: 'left' | 'right' }> = ({ color, direction }) => (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
        <Path
            d={direction === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
        />
    </Svg>
);

/** `.caret` 里的下三角。Web 用 `fill="currentColor"`，同样改为显式传色。 */
const CaretDownIcon: React.FC<{ color: string }> = ({ color }) => (
    <Svg width={10} height={10} viewBox="0 0 24 24">
        <Path d="M12 16.5L5.5 9h13z" fill={color} />
    </Svg>
);

interface SizeChangerProps {
    value: number;
    options: number[];
    disabled?: boolean;
    variant: PaginationVariant;
    onChange: (size: number) => void;
    testID?: string;
}

/**
 * 每页条数切换器：胶囊触发器 + 上弹选项列表。
 *
 * ⚠️ **结构性差异**：Web 版把 `<ul>` 绝对定位在 `.sizeChanger` 里
 * （`bottom: calc(100% + 8px)`），并靠 `document.addEventListener('mousedown')`
 * 点击外部关闭、`keydown` 的 Escape 关闭。RN 没有全局点击监听，也拿不到
 * 「点在组件外」这件事，所以弹层搬进了透明 `Modal`：
 *   - 全屏透明 `Pressable` 遮罩 = 点击外部关闭（与 Web 的 mousedown 等价）；
 *   - `Modal.onRequestClose` = Android 实体返回键（等价于 Web 的 Escape）；
 *   - 代价：定位要靠 `measureInWindow` 自己算，见 `computeSizeListPosition`。
 *
 * ⚠️ 丢弃项：
 *   - `.sizeTrigger:hover`（边框 #d4c4a8 / 底色 #fffdf7）与 `.sizeOption:hover`
 *     （字重 700）、`.sizeOption:hover::before`（手指光标三角）—— 都是 hover，无触摸对应物。
 *   - `@keyframes size-list-in`（0.2s 淡入）—— RN 没有 CSS 动画；这里的弹层是瞬现的。
 *   - `@keyframes cursor-slide-in` —— 同上（属于 hover 的装饰）。
 */
const SizeChanger: React.FC<SizeChangerProps> = ({ value, options, disabled = false, variant, onChange, testID }) => {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<PanelPosition | null>(null);
    const triggerRef = useRef<ViewInstance>(null);
    const windowSize = useWindowDimensions();

    const palette = VARIANT_PALETTE[variant];
    const sub = (suffix: string) => (testID === undefined ? undefined : `${testID}-${suffix}`);

    useEffect(() => {
        if (!open) {
            setPosition(null);
            return;
        }
        // 先落兜底位置**再**尝试测量校正：`measureInWindow` 是回调式的，测试渲染器里
        // 它存在但**永远不会回调**（实测），只等回调会让弹层根本挂不上。
        setPosition(FALLBACK_SIZE_LIST_POSITION);
        const trigger = triggerRef.current;
        if (trigger && typeof trigger.measureInWindow === 'function') {
            trigger.measureInWindow((x, y, width, height) => {
                setPosition(computeSizeListPosition({ x, y, width, height }, windowSize));
            });
        }
    }, [open, windowSize]);

    return (
        <View style={styles.sizeChanger}>
            <Pressable
                ref={triggerRef}
                role="button"
                // ⚠️ Web 版还有 `aria-haspopup="listbox"`：RN 没有 `aria-haspopup`，丢弃。
                aria-expanded={open}
                aria-label={`每页 ${value} 条`}
                disabled={disabled}
                onPress={disabled ? undefined : () => setOpen((v) => !v)}
                style={[styles.sizeTrigger, disabled && styles.sizeTriggerDisabled]}
                testID={sub('size-trigger')}
            >
                <Text style={styles.sizeTriggerText}>{value} 条/页</Text>
                <View style={[styles.caret, open && styles.caretOpen]} aria-hidden>
                    <CaretDownIcon color={open ? palette.caretOpen : PALETTE.caret} />
                </View>
            </Pressable>

            <Modal transparent visible={open} animationType="none" onRequestClose={() => setOpen(false)}>
                {/* 透明全屏遮罩：只负责「点击弹层外部关闭」，不画任何底色（Web 也没有 scrim） */}
                <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={() => setOpen(false)}
                    testID={sub('size-backdrop')}
                />

                {position && (
                    <View
                        // ⚠️ Web 版是 `role="listbox"`。RN 0.87 的 `Role` 联合里**没有**
                        // `listbox`（有 `list` / `listitem` / `option`），所以容器降级成
                        // `list`，选项仍是 `option`。
                        role="list"
                        aria-label="选择每页条数"
                        // 弹层自身要「吃掉」落在它身上的触摸，否则点到弹层空白处会穿透到
                        // 下面那层遮罩、把弹层关掉。Web 版靠 `ref.current.contains(e.target)`
                        // 判断内外，RN 的等价物是响应者系统 —— 即这一句。
                        onStartShouldSetResponder={() => true}
                        style={[styles.sizeList, position]}
                        testID={sub('size-list')}
                    >
                        {options.map((opt) => {
                            const isActive = opt === value;
                            return (
                                <Pressable
                                    key={opt}
                                    role="option"
                                    aria-selected={isActive}
                                    onPress={() => {
                                        setOpen(false);
                                        if (opt !== value) onChange(opt);
                                    }}
                                    style={styles.sizeOption}
                                    testID={sub(`size-option-${opt}`)}
                                >
                                    {/* `.sizeOptionActive::after` 的金色 pill bar：静态装饰，直接画一层 */}
                                    {isActive && <View style={styles.optionPill} pointerEvents="none" aria-hidden />}
                                    <Text style={[styles.sizeOptionText, isActive && styles.sizeOptionTextActive]}>
                                        {opt} 条/页
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                )}
            </Modal>
        </View>
    );
};

interface QuickJumperProps {
    disabled?: boolean;
    onJump: (page: number) => void;
    testID?: string;
}

/**
 * 快速跳转输入框：Enter 或失焦跳页。
 *
 * ✅ 上游的键盘用例在这里**可以移植**：Web 的 `onKeyDown` + `e.key === 'Enter'`
 * 在 RN 里的等价物是 `TextInput.onSubmitEditing`（软键盘「回车/前往」键），
 * 所以「输入 99 回车 → 收敛到最后一页」这条用例被完整保留（不是丢弃）。
 */
const QuickJumper: React.FC<QuickJumperProps> = ({ disabled = false, onJump, testID }) => {
    const [text, setText] = useState('');

    const jump = useCallback(() => {
        const page = parseInt(text, 10);
        setText('');
        if (!Number.isNaN(page)) onJump(page);
    }, [text, onJump]);

    return (
        <View style={styles.jumper}>
            <Text style={styles.jumperLabel}>跳至</Text>
            <TextInput
                value={text}
                editable={!disabled}
                inputMode="numeric"
                // ⚠️ Web 版这里是 `aria-label="跳转到指定页"`。RN 0.87 的 `Role` 联合里
                // 没有 `textbox`，所以只能保留 `aria-label`，无法补 `role`。
                aria-label="跳转到指定页"
                onChangeText={(next) => setText(next.replace(/[^\d]/g, ''))}
                onSubmitEditing={jump}
                onBlur={jump}
                style={[styles.jumperInput, disabled && styles.jumperInputDisabled]}
                testID={testID === undefined ? undefined : `${testID}-jump-input`}
            />
            <Text style={styles.jumperLabel}>页</Text>
        </View>
    );
};

export const Pagination: React.FC<PaginationProps> = ({
    total,
    current,
    defaultCurrent = 1,
    pageSize: pageSizeProp,
    defaultPageSize = 10,
    onChange,
    onShowSizeChange,
    showSizeChanger = false,
    pageSizeOptions,
    showQuickJumper = false,
    showTotal = false,
    disabled = false,
    variant = 'orange',
    style,
    testID,
}) => {
    const [innerPage, setInnerPage] = useState(defaultCurrent);
    const [innerPageSize, setInnerPageSize] = useState(defaultPageSize);

    const pageSize = pageSizeProp ?? innerPageSize;
    const pageCount = Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
    const page = Math.min(current ?? innerPage, pageCount);
    const items = getPageItems(page, pageCount);

    const palette = VARIANT_PALETTE[variant];
    const sub = (suffix: string) => (testID === undefined ? undefined : `${testID}-${suffix}`);

    const changePage = (next: number) => {
        const target = Math.min(Math.max(1, next), pageCount);
        if (target === page) return;
        if (current === undefined) setInnerPage(target);
        onChange?.(target, pageSize);
    };

    const changePageSize = (size: number) => {
        const nextPageCount = Math.max(1, Math.ceil(Math.max(0, total) / size));
        const targetPage = Math.min(page, nextPageCount);
        if (pageSizeProp === undefined) setInnerPageSize(size);
        if (current === undefined) setInnerPage(targetPage);
        onShowSizeChange?.(targetPage, size);
        if (targetPage !== page || size !== pageSize) onChange?.(targetPage, size);
    };

    const prevDisabled = disabled || page <= 1;
    const nextDisabled = disabled || page >= pageCount;

    return (
        <View
            // ⚠️ Web 版是 `<nav aria-label="分页">`。RN 0.87 的 `Role` 联合里有 `navigation`，
            // 但**不能**加 `accessible`：那会把整条分页的按钮合并成一个无障碍节点。
            // 于是根节点在 RNTL 里查不到（`getByRole` 要求 `isAccessibilityElement`），
            // 只能断言 prop 透传 —— 见测试文件里那条「pin 住限制」的用例。
            role="navigation"
            aria-label="分页"
            style={[styles.root, disabled && styles.rootDisabled, style]}
            testID={testID}
        >
            {showTotal && (
                <Text style={styles.total} numberOfLines={1}>
                    共 {total} 条
                </Text>
            )}

            <Pressable
                role="button"
                aria-label="上一页"
                disabled={prevDisabled}
                onPress={prevDisabled ? undefined : () => changePage(page - 1)}
                style={styles.item}
                testID={sub('prev')}
            >
                <ChevronIcon color={prevDisabled ? PALETTE.textDisabled : PALETTE.text} direction="left" />
            </Pressable>

            {items.map((item) =>
                typeof item === 'number' ? (
                    <Pressable
                        key={item}
                        role="button"
                        // ⚠️ Web 版用 `aria-current="page"`。RN 0.87 **不支持** `aria-current`
                        // （`View.js` 的改写名单里没有它），语义上最接近的是
                        // `aria-selected` → `accessibilityState.selected`。
                        // 这是 RN 侧的有意替换，与 TimePicker 补 `selected` 同一处理。
                        aria-selected={item === page}
                        disabled={disabled}
                        onPress={disabled ? undefined : () => changePage(item)}
                        style={[styles.item, item === page && { backgroundColor: palette.active }]}
                        testID={sub(`page-${item}`)}
                    >
                        <Text
                            style={[
                                styles.itemText,
                                item === page && styles.itemTextActive,
                                // CSS 层叠：`.item:disabled`(0,2,0) 的 color 压过 `.active`(0,1,0)
                                disabled && styles.itemTextDisabled,
                            ]}
                        >
                            {item}
                        </Text>
                    </Pressable>
                ) : (
                    <View key={item} style={styles.ellipsis} aria-hidden testID={sub(item)}>
                        <Text style={styles.ellipsisText}>···</Text>
                    </View>
                )
            )}

            <Pressable
                role="button"
                aria-label="下一页"
                disabled={nextDisabled}
                onPress={nextDisabled ? undefined : () => changePage(page + 1)}
                style={styles.item}
                testID={sub('next')}
            >
                <ChevronIcon color={nextDisabled ? PALETTE.textDisabled : PALETTE.text} direction="right" />
            </Pressable>

            {showSizeChanger && (
                <SizeChanger
                    value={pageSize}
                    options={pageSizeOptions ?? [10, 20, 50, 100]}
                    disabled={disabled}
                    variant={variant}
                    onChange={changePageSize}
                    testID={testID}
                />
            )}

            {showQuickJumper && <QuickJumper disabled={disabled} onJump={changePage} testID={testID} />}
        </View>
    );
};

Pagination.displayName = 'Pagination';

const styles = StyleSheet.create({
    // `.pagination`：inline-flex / align-items center / gap 2px / font-size 14px / color #725d42
    // 丢弃的声明：
    //   - `box-sizing: border-box` —— RN 默认即 border-box。
    //   - `font-family: 'Nunito', 'Noto Sans SC', sans-serif` —— RN 不支持字体栈（见 tokens.ts）。
    //   - `user-select: none` —— RN 的 Text 默认不可选中。
    //   - `font-size: 14px` / `color: #725d42` —— RN 的 Text **不继承**父节点样式，
    //     已分别写到各 Text 上（`.total` / `.item` / `.ellipsis` 本来也各自覆盖）。
    root: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 2,
        // Web 是 `display: inline-flex`：RN 的 View 在 column 父容器里默认拉伸，
        // 想「按内容宽度收缩」必须显式 flex-start（与 Button / Tag 的处理一致）。
        alignSelf: 'flex-start',
    },
    rootDisabled: {
        opacity: 0.6,
    },
    // `.total { margin-right: 10px; font-size: 13px; font-weight: 600; color: #a09080; white-space: nowrap }`
    total: {
        marginRight: 10,
        fontSize: 13,
        fontWeight: '600',
        color: PALETTE.totalText,
    },
    // `.item`：32×32 正圆幽灵格子 / font-size 13 / font-weight 500 / line-height 1
    // 丢弃：`transition: all 0.15s ease`（RN 没有 CSS 过渡）、
    //       `:focus-visible { outline: 2px solid #ffcc00; outline-offset: 1px }`（RN 无 outline）
    item: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        borderRadius: 16, // CSS border-radius: 50% 于 32×32 → 16
        backgroundColor: 'transparent',
    },
    itemText: {
        color: PALETTE.text,
        fontSize: 13,
        fontWeight: '500',
        lineHeight: 13, // CSS line-height: 1
    },
    // `.active { color: #fff; font-weight: 700; cursor: default }`
    itemTextActive: {
        color: PALETTE.textActive,
        fontWeight: '700',
    },
    // `.item:disabled { color: #d4c9b4 }`
    itemTextDisabled: {
        color: PALETTE.textDisabled,
    },
    // `.ellipsis { width: 24px; height: 32px; color: #c4b89e; font-weight: 900; letter-spacing: 1px }`
    ellipsis: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 32,
    },
    ellipsisText: {
        color: PALETTE.ellipsisText,
        fontWeight: '900',
        letterSpacing: 1,
    },
    // `.sizeChanger { position: relative; display: inline-flex; margin-left: 8px }`
    // （`position: relative` 在 RN 里是默认值，无需声明）
    sizeChanger: {
        marginLeft: 8,
    },
    // `.sizeTrigger`：34 高 / 12 圆角 / 2px #e8dcc8 描边 / 白底 / gap 8 / padding 0 12
    sizeTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        height: 34,
        paddingHorizontal: 12,
        borderWidth: 2,
        borderColor: PALETTE.triggerBorder,
        borderRadius: 12,
        backgroundColor: PALETTE.triggerBg,
    },
    sizeTriggerDisabled: {
        opacity: 0.5,
        backgroundColor: PALETTE.triggerBgDisabled,
    },
    sizeTriggerText: {
        color: PALETTE.text,
        fontSize: 13,
        fontWeight: '600',
        lineHeight: 13, // CSS line-height: 1
    },
    // `.caret { display: flex; align-items: center; color: #a09080 }`
    caret: {
        alignItems: 'center',
    },
    caretOpen: {
        transform: [{ rotate: '180deg' }],
    },
    // `.sizeList`：向上弹出、#ffeea0、圆角 28、padding 8px 0、投影 0 6px 18px rgba(61,52,40,.12)
    // 定位（bottom / left）由 computeSizeListPosition 在运行时算出来，见上。
    sizeList: {
        position: 'absolute',
        paddingVertical: 8,
        backgroundColor: PALETTE.listBg,
        borderRadius: 28,
        // ⚠️ `boxShadow` 需要 Android 的 New Architecture（与 Button / Divider 同一约束）
        boxShadow: '0 6px 18px rgba(61, 52, 40, 0.12)',
    },
    // `.sizeOption`：min-width 108 / padding 8px 26px / font-size 13 / font-weight 500
    sizeOption: {
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 108,
        paddingVertical: 8,
        paddingHorizontal: 26,
    },
    // `.sizeOptionActive::after`：高 14、左右各留 20、金色 #ffcc00、圆角 7、opacity .3
    // `top: 56%; transform: translateY(-50%)` → `top: '56%'` + `marginTop: -7`
    // （RN 的 transform 不支持百分比，用负 margin 等价替换）
    optionPill: {
        position: 'absolute',
        left: 20,
        right: 20,
        top: '56%',
        marginTop: -7,
        height: 14,
        borderRadius: 7,
        backgroundColor: PALETTE.optionPill,
        opacity: 0.3,
    },
    sizeOptionText: {
        color: PALETTE.text,
        fontSize: 13,
        fontWeight: '500',
    },
    // `.sizeOptionActive { font-weight: 700 }`
    sizeOptionTextActive: {
        fontWeight: '700',
    },
    // `.jumper { display: inline-flex; align-items: center; gap: 6px; margin-left: 8px; font-size: 13px; font-weight: 500; color: #8a7b66 }`
    jumper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginLeft: 8,
    },
    jumperLabel: {
        color: PALETTE.jumperText,
        fontSize: 13,
        fontWeight: '500',
    },
    // `.jumperInput`：52×32 奶油胶囊 / font-size 13 / font-weight 700 / text-align center
    // 丢弃：`outline: none`（RN 无 outline）、`caret-color`（RN 无对应声明）、
    //       `&::placeholder`（上游没有 placeholder 属性，规则是死的）
    jumperInput: {
        width: 52,
        height: 32,
        padding: 0,
        borderRadius: 50,
        backgroundColor: PALETTE.jumperInputBg,
        color: PALETTE.text,
        fontSize: 13,
        fontWeight: '700',
        textAlign: 'center',
    },
    jumperInputDisabled: {
        opacity: 0.5,
        backgroundColor: PALETTE.jumperInputBgDisabled,
    },
});
