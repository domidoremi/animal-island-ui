/**
 * DatePicker —— React Native 版。
 *
 * 与上游 Web 版（`main` 分支 `src/components/DatePicker/DatePicker.tsx`）的差异见
 * `RN-PORT.md` 的「移植契约」与「有意分歧」两节。本组件特有的三点：
 *
 * 1. **面板进 Modal**。上游是绝对定位的子元素，RN 下会被任何 `overflow: hidden`
 *    祖先（含所有 `ScrollView`）裁掉，且没有 `mousedown` 可做外部点击关闭。
 *    这里照 `TimePicker` / `Select` 的先例改为透明 `Modal` + 背景 `Pressable`。
 * 2. **键盘交互整体丢弃**。上游 `handleKeyDown` 覆盖 Enter/Space/Esc/方向键/PageUp/PageDown
 *    共 6 类按键，RN 没有 DOM 键盘事件，也没有可以承载 `onKeyDown` 的宿主组件。
 *    「Esc 关闭」退化为 `Modal.onRequestClose`（Android 返回键 / iOS 下滑关闭手势）。
 * 3. **`focusedDate` 状态整体移除**。上游它是键盘导航的当前焦点日期，唯一的读者就是
 *    `handleKeyDown`；RN 没有键盘导航，留着只会变成「只写不读」的死状态。
 *
 * 4. **hover 预览改为按下预览**。上游范围模式用 `onMouseEnter/onMouseLeave` 做区间预览，
 *    RN 没有指针悬停，映射到 `onPressIn` / `onPressOut` —— 手指按下时预览，
 *    抬起时撤销。这是触屏上最接近的对应物，语义与上游一致。
 *
 * 面板定位与日期算术全部在 `calendar.ts`（单测见 `calendar.test.ts`）。
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
    type StyleProp,
    type ViewInstance,
    type ViewStyle,
} from 'react-native';
import { Path, Rect as SvgRect, Svg } from 'react-native-svg';
import {
    MONTHS,
    PANEL_WIDTH,
    PANEL_WIDTH_RANGE,
    WEEKDAYS,
    buildCells,
    buildYearCells,
    cellRangeRole,
    computePanelPosition,
    effectiveRange,
    formatDate,
    isSameDay,
    parseRange,
    parseValue,
    toMonthValue,
    toValue,
    yearDecade,
    type PanelPosition,
} from './calendar';

export type DatePickerSize = 'small' | 'middle' | 'large';

export type DatePickerStatus = 'error' | 'warning';

/** 选中值：日期模式为 YYYY-MM-DD，范围模式为 [开始, 结束]，清空为 null */
export type DatePickerValue = string | [string, string] | null;

export interface DatePickerProps {
    /** 范围选择模式：联动选择开始日期与结束日期 */
    range?: boolean;
    /** 选择粒度：date 选择日期（YYYY-MM-DD），month 选择月份（YYYY-MM） */
    picker?: 'date' | 'month';
    /** 当前选中值（受控） */
    value?: DatePickerValue;
    /** 默认选中值（非受控） */
    defaultValue?: string | [string, string];
    /** 值变化回调 */
    onChange?: (value: DatePickerValue) => void;
    /** 占位文本 */
    placeholder?: string;
    /** 是否禁用 */
    disabled?: boolean;
    /** 是否允许一键清空 */
    allowClear?: boolean;
    /** 尺寸 */
    size?: DatePickerSize;
    /** 校验状态 */
    status?: DatePickerStatus;
    /** 展示格式，支持 YYYY / MM / DD / M / D 占位符 */
    format?: string;
    /** 禁用日期判断函数，返回 true 的日期不可选 */
    disabledDate?: (date: Date) => boolean;
    /** 受控展开状态 */
    open?: boolean;
    /** 展开状态变化回调 */
    onOpenChange?: (open: boolean) => void;
    /** 面板底部是否显示「今天」快捷按钮 */
    showToday?: boolean;
    /** 无障碍标签（无可见 label 时使用） */
    'aria-label'?: string;
    /** 关联外部可见 label 的 id */
    'aria-labelledby'?: string;
    /**
     * 自定义样式（作用于最外层容器）。
     *
     * Web 版这里是 `className` + `style: React.CSSProperties`；RN 两个都不存在，
     * 统一并成一个 `style`。
     */
    style?: StyleProp<ViewStyle>;
    /** 测试标识 */
    testID?: string;
}

/** 关闭退场动画时长 —— 与上游 `.panel` 的 0.2s 过渡一致 */
const CLOSE_ANIMATION_MS = 200;

/** 尺寸规格：对应 `.trigger-small / -middle / -large` */
const SIZE_SPEC = {
    small: { height: 32, paddingHorizontal: 14, fontSize: 12 },
    middle: { height: 40, paddingHorizontal: 18, fontSize: 14 },
    large: { height: 48, paddingHorizontal: 22, fontSize: 16 },
} as const;

/**
 * 触发区的三种阴影，取自 Less：
 *   `.trigger-open`  → 0 3px 0 0 #e0b800, 0 0 0 3px rgba(255, 204, 0, 0.15)
 *   `.trigger-error` → 0 3px 0 0 #c94444
 *   `.trigger-warning` → 0 3px 0 0 #dba90e
 *
 * 优先级 **status > open**：CSS 里 `.trigger-open`（L44）先于 `.trigger-error`（L50），
 * 同特异性时后者胜出。这里照同样的顺序覆盖。
 */
const SHADOW_OPEN = '0 3px 0 0 #e0b800, 0 0 0 3px rgba(255, 204, 0, 0.15)';
const SHADOW_ERROR = '0 3px 0 0 #c94444';
const SHADOW_WARNING = '0 3px 0 0 #dba90e';

/** `.wrapper-disabled .trigger { background: #ece8dc }`；常态底是 `#fffbe7` */
const TRIGGER_BG = '#fffbe7';
const DISABLED_BG = '#ece8dc';

/** `.value { color: #8a7b66 }` / `.placeholder { color: #c4b89e }` */
const VALUE_COLOR = '#8a7b66';
const PLACEHOLDER_COLOR = '#c4b89e';

/** `.calendarIcon / .navBtn { color: #a0936e }` */
const ICON_COLOR = '#a0936e';

/** 面板里除 token 外的硬编码色（Less 里就是硬编码，非变量） */
const PANEL_BG = '#fffdf7';
const PANEL_BORDER = '#e8dcc8';
const DAY_COLOR = '#725d42';
const DAY_OUTSIDE_COLOR = '#c4b89e';
const DAY_DISABLED_COLOR = '#d4c9b4';
const SELECTED_BG = '#19c8b9';
const RANGE_BG = '#ffc107';
const TODAY_RING = '#19c8b9';

/**
 * 面板兜底位置。
 *
 * `measureInWindow` 在 jest preset 里被 mock 成**永不回调的空实现**，所以测试环境
 * 永远落在这里。先设兜底再用回调升级，既让测试能渲染，也避免了真机上首帧闪烁。
 */
const FALLBACK_PANEL_POSITION: PanelPosition = { top: 0, left: 0 };

const EASE = Easing.bezier(0.4, 0, 0.2, 1);

/** 日历图标（上游是内联 `<svg>`，14×14，`stroke="currentColor"`） */
const CalendarIcon: React.FC = () => (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
        <SvgRect x={1.5} y={2.5} width={11} height={10} rx={2} stroke={ICON_COLOR} strokeWidth={1.4} />
        <Path d="M1.5 5.5h11" stroke={ICON_COLOR} strokeWidth={1.4} />
        <Path d="M4.7 1v2.4M9.3 1v2.4" stroke={ICON_COLOR} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
);

/** 左右翻页箭头（上游内联 `<svg>`，12×12） */
const ChevronIcon: React.FC<{ direction: 'left' | 'right' }> = ({ direction }) => (
    <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
        <Path
            d={direction === 'left' ? 'M7.5 2.5L4 6l3.5 3.5' : 'M4.5 2.5L8 6l-3.5 3.5'}
            stroke={ICON_COLOR}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </Svg>
);

type PanelDate = { date: Date; label: string };

export const DatePicker: React.FC<DatePickerProps> = ({
    value,
    defaultValue,
    onChange,
    range = false,
    picker = 'date',
    placeholder = '请选择日期',
    disabled = false,
    allowClear = false,
    size = 'middle',
    status,
    format = picker === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD',
    disabledDate,
    open: openProp,
    onOpenChange,
    showToday = true,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    style,
    testID,
}) => {
    const [innerValue, setInnerValue] = useState<DatePickerValue>(defaultValue ?? null);
    const [innerOpen, setInnerOpen] = useState(false);
    const [viewDate, setViewDate] = useState(
        () => parseValue(typeof defaultValue === 'string' ? defaultValue : null) ?? new Date()
    );
    const [mode, setMode] = useState<'date' | 'month' | 'year'>('date');
    const [rangeStart, setRangeStart] = useState<Date | null>(null);
    const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
    const [hoverDate, setHoverDate] = useState<Date | null>(null);
    /** 单日期模式待选日期（点选后尚未确认） */
    const [pendingDate, setPendingDate] = useState<Date | null>(null);
    const [panelPosition, setPanelPosition] = useState<PanelPosition>(FALLBACK_PANEL_POSITION);

    const triggerRef = useRef<ViewInstance>(null);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    /** 面板进场 / 退场：上游是 CSS transition，RN 用一个 Animated.Value 双向跑 */
    const progress = useRef(new Animated.Value(0)).current;

    const windowSize = useWindowDimensions();

    const isControlled = value !== undefined;
    const currentValue: DatePickerValue = isControlled ? (value ?? null) : innerValue;
    const selectedDate = range ? null : parseValue(typeof currentValue === 'string' ? currentValue : null);
    const selectedRange = range ? parseRange(currentValue) : null;
    const open = openProp !== undefined ? openProp : innerOpen;

    // 面板展开时重置视图所用到的当前值引用，避免值变化本身触发重置
    const valueRef = useRef(currentValue);
    useEffect(() => {
        valueRef.current = currentValue;
    }, [currentValue]);

    useEffect(
        () => () => {
            if (closeTimerRef.current !== undefined) clearTimeout(closeTimerRef.current);
        },
        []
    );

    const setOpen = useCallback(
        (next: boolean) => {
            if (openProp === undefined) setInnerOpen(next);
            onOpenChange?.(next);
        },
        [openProp, onOpenChange]
    );

    // 每次展开时把面板视图重置到当前选中值（无选中则回到今天）
    useEffect(() => {
        if (!open) return;
        if (closeTimerRef.current !== undefined) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = undefined;
        }
        const current = valueRef.current;
        const base = range
            ? (parseRange(current)?.[0] ?? new Date())
            : (parseValue(typeof current === 'string' ? current : null) ?? new Date());
        setViewDate(base);
        setMode(picker === 'month' && !range ? 'month' : 'date');
        setRangeStart(null);
        setRangeEnd(null);
        setHoverDate(null);
        setPendingDate(null);
        setPanelPosition(FALLBACK_PANEL_POSITION);
        progress.setValue(0);
        Animated.timing(progress, {
            toValue: 1,
            duration: CLOSE_ANIMATION_MS,
            easing: EASE,
            useNativeDriver: true,
        }).start();
        const trigger = triggerRef.current;
        if (trigger && typeof trigger.measureInWindow === 'function') {
            trigger.measureInWindow((x, y, width, height) => {
                setPanelPosition(computePanelPosition({ x, y, width, height }, windowSize, range));
            });
        }
    }, [open, range, picker, windowSize, progress]);

    /** 统一关闭入口：先播退场动画，结束后再卸载 */
    const closePanel = useCallback(() => {
        if (closeTimerRef.current !== undefined) return;
        Animated.timing(progress, {
            toValue: 0,
            duration: CLOSE_ANIMATION_MS,
            easing: EASE,
            useNativeDriver: true,
        }).start();
        closeTimerRef.current = setTimeout(() => {
            closeTimerRef.current = undefined;
            setOpen(false);
            setRangeStart(null);
            setRangeEnd(null);
            setHoverDate(null);
            setPendingDate(null);
        }, CLOSE_ANIMATION_MS);
    }, [progress, setOpen]);

    // 点选日期：仅更新待选值，点击「确定」后才提交并关闭
    const selectDate = useCallback(
        (date: Date) => {
            if (disabledDate?.(date)) return;
            if (!range) {
                setPendingDate(date);
                return;
            }
            if (!rangeStart) {
                setRangeStart(date);
                return;
            }
            if (date < rangeStart) {
                setRangeStart(date);
                return;
            }
            setRangeEnd(date);
        },
        [disabledDate, range, rangeStart]
    );

    const handleClear = () => {
        if (!isControlled) setInnerValue(null);
        onChange?.(null);
    };

    const shiftView = (yearDelta: number, monthDelta = 0) => {
        setViewDate(new Date(viewDate.getFullYear() + yearDelta, viewDate.getMonth() + monthDelta, 1));
    };

    const handleToday = () => {
        const today = new Date();
        if (!range) {
            setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
            setMode(picker === 'month' ? 'month' : 'date');
            setPendingDate(today);
            return;
        }
        // 范围模式：「今天」仅负责把视图跳转到今天所在月份
        setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
        setRangeStart(null);
        setRangeEnd(null);
    };

    // 确定：提交待选值并关闭面板；无待选值（或范围不完整）时仅关闭
    const confirmTime = () => {
        if (!range) {
            if (pendingDate) {
                const next = picker === 'month' ? toMonthValue(pendingDate) : toValue(pendingDate);
                if (!isControlled) setInnerValue(next);
                onChange?.(next);
            }
            closePanel();
            return;
        }
        if (rangeStart && rangeEnd) {
            const next: [string, string] = [toValue(rangeStart), toValue(rangeEnd)];
            if (!isControlled) setInnerValue(next);
            onChange?.(next);
        }
        closePanel();
    };

    const today = new Date();

    /** 渲染某个月份的星期表头 + 日期网格（范围模式左右面板共用） */
    const renderDayGrid = (vDate: Date, panelIndex: number) => {
        const vMonth = vDate.getMonth();
        const rangeHighlight = range
            ? effectiveRange({ rangeStart, rangeEnd, hoverDate, selectedRange })
            : { start: null, end: null };
        return (
            <View>
                <View style={styles.weekRow}>
                    {WEEKDAYS.map((w) => (
                        <Text key={w} style={styles.weekCell}>
                            {w}
                        </Text>
                    ))}
                </View>
                <View style={styles.grid}>
                    {buildCells(vDate).map((cell) => {
                        const disabledCell = disabledDate?.(cell) === true;
                        const isToday = isSameDay(cell, today);
                        const outside = cell.getMonth() !== vMonth;
                        let selected = false;
                        let role = { isStart: false, isEnd: false, inRange: false };
                        if (range) {
                            role = cellRangeRole(cell, rangeHighlight);
                        } else {
                            const activeDate = pendingDate ?? selectedDate;
                            selected = !!activeDate && isSameDay(cell, activeDate);
                        }
                        // `ViewStyle` 的属性是 readonly，条件赋值必须先攒到普通对象里
                        const face: Record<string, unknown> = {};
                        if (outside) face.color = DAY_OUTSIDE_COLOR;
                        if (!range && isToday) face.color = TODAY_RING;
                        if (selected) {
                            face.backgroundColor = SELECTED_BG;
                            face.color = '#fff';
                        }
                        if (role.inRange) {
                            face.backgroundColor = RANGE_BG;
                            face.color = '#fff';
                        }
                        if (role.isStart || role.isEnd) {
                            face.backgroundColor = RANGE_BG;
                            face.color = '#fff';
                        }
                        if (disabledCell) {
                            face.backgroundColor = 'transparent';
                            face.color = DAY_DISABLED_COLOR;
                        }
                        return (
                            <Pressable
                                key={`${panelIndex}-${cell.getTime()}`}
                                accessibilityRole="button"
                                accessibilityState={{ disabled: disabledCell, selected }}
                                accessibilityLabel={`${cell.getFullYear()}年${cell.getMonth() + 1}月${cell.getDate()}日`}
                                disabled={disabledCell}
                                onPress={() => selectDate(cell)}
                                // hover 预览 → 按下预览（见文件头第 3 点）
                                onPressIn={() => range && setHoverDate(cell)}
                                onPressOut={() => range && setHoverDate(null)}
                                style={[styles.dayCell, face as ViewStyle]}
                                testID={testID ? `${testID}-day-${toValue(cell)}` : undefined}
                            >
                                <Text style={[styles.dayText, face as ViewStyle]}>{cell.getDate()}</Text>
                            </Pressable>
                        );
                    })}
                </View>
            </View>
        );
    };

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const yearCells = buildYearCells(year);
    const [decadeStart, decadeEnd] = yearDecade(year);

    // 触发区样式：`.trigger` 打底，status 覆盖 open（见 SHADOW_* 处的说明）
    const triggerFace: Record<string, unknown> = {
        height: SIZE_SPEC[size].height,
        paddingHorizontal: SIZE_SPEC[size].paddingHorizontal,
        backgroundColor: disabled ? DISABLED_BG : TRIGGER_BG,
    };
    if (!disabled) {
        if (open) triggerFace.boxShadow = SHADOW_OPEN;
        if (status === 'error') triggerFace.boxShadow = SHADOW_ERROR;
        if (status === 'warning') triggerFace.boxShadow = SHADOW_WARNING;
    }

    const hasClear = allowClear && !!currentValue && !disabled;

    /** 触发区文案：范围模式两端，其余单值 */
    const renderTriggerContent = () => {
        const textStyle = { fontSize: SIZE_SPEC[size].fontSize };
        if (range) {
            if (open && rangeStart) {
                return (
                    <>
                        <Text style={[styles.value, textStyle]}>{formatDate(rangeStart, format)}</Text>
                        <View aria-hidden style={styles.rangeDivider} />
                        <Text style={[rangeEnd ? styles.value : styles.placeholder, textStyle]}>
                            {rangeEnd ? formatDate(rangeEnd, format) : placeholder}
                        </Text>
                    </>
                );
            }
            if (selectedRange) {
                return (
                    <>
                        <Text style={[styles.value, textStyle]}>{formatDate(selectedRange[0], format)}</Text>
                        <View aria-hidden style={styles.rangeDivider} />
                        <Text style={[styles.value, textStyle]}>{formatDate(selectedRange[1], format)}</Text>
                    </>
                );
            }
            return <Text style={[styles.placeholder, textStyle]}>{placeholder}</Text>;
        }
        const shown = open && pendingDate ? pendingDate : selectedDate;
        const isPlaceholder = !currentValue && !shown;
        return (
            <Text style={[isPlaceholder ? styles.placeholder : styles.value, textStyle]}>
                {shown ? formatDate(shown, format) : placeholder}
            </Text>
        );
    };

    return (
        <View style={[styles.wrapper, disabled && styles.wrapperDisabled, style]} testID={testID}>
            <Pressable
                ref={triggerRef}
                role="combobox"
                aria-expanded={open}
                aria-disabled={disabled || undefined}
                aria-label={ariaLabel}
                aria-labelledby={ariaLabelledBy}
                disabled={disabled}
                onPress={() => setOpen(!open)}
                style={[styles.trigger, triggerFace as ViewStyle]}
                testID={testID ? `${testID}-trigger` : undefined}
            >
                {renderTriggerContent()}
                {hasClear && (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="清除日期"
                        onPress={handleClear}
                        style={styles.clear}
                        testID={testID ? `${testID}-clear` : undefined}
                    >
                        <Text style={styles.clearText}>×</Text>
                    </Pressable>
                )}
                <View aria-hidden style={styles.calendarIcon} testID={testID ? `${testID}-calendar` : undefined}>
                    <CalendarIcon />
                </View>
            </Pressable>
            <Modal transparent visible={open} animationType="none" onRequestClose={closePanel}>
                <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={closePanel}
                    testID={testID ? `${testID}-backdrop` : undefined}
                />
                <Animated.View
                    role="dialog"
                    aria-label={range ? '选择日期范围' : '选择日期'}
                    onStartShouldSetResponder={() => true}
                    style={[
                        styles.panel,
                        range && styles.panelRange,
                        panelPosition,
                        {
                            opacity: progress,
                            transform: [
                                {
                                    translateY: progress.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [-6, 0],
                                    }),
                                },
                            ],
                        },
                    ]}
                    testID={testID ? `${testID}-panel` : undefined}
                >
                    {range ? (
                        <>
                            <View style={styles.rangePanels}>
                                {[
                                    { date: viewDate, label: 'left' },
                                    {
                                        date: new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1),
                                        label: 'right',
                                    },
                                ].map((panel: PanelDate, idx) => (
                                    <View key={panel.label} style={styles.rangePanel}>
                                        <View style={styles.header}>
                                            <View style={styles.headerGroup}>
                                                {idx === 0 && (
                                                    <>
                                                        <Pressable
                                                            accessibilityRole="button"
                                                            accessibilityLabel="上一年"
                                                            onPress={() => shiftView(-1, 0)}
                                                            style={styles.navBtn}
                                                            testID={testID ? `${testID}-prev-year` : undefined}
                                                        >
                                                            <ChevronIcon direction="left" />
                                                        </Pressable>
                                                        <Pressable
                                                            accessibilityRole="button"
                                                            accessibilityLabel="上个月"
                                                            onPress={() => shiftView(0, -1)}
                                                            style={styles.navBtn}
                                                            testID={testID ? `${testID}-prev-month` : undefined}
                                                        >
                                                            <ChevronIcon direction="left" />
                                                        </Pressable>
                                                    </>
                                                )}
                                            </View>
                                            <Text style={styles.yearLabel}>
                                                {panel.date.getFullYear()}年{panel.date.getMonth() + 1}月
                                            </Text>
                                            <View style={styles.headerGroup}>
                                                {idx === 1 && (
                                                    <>
                                                        <Pressable
                                                            accessibilityRole="button"
                                                            accessibilityLabel="下个月"
                                                            onPress={() => shiftView(0, 1)}
                                                            style={styles.navBtn}
                                                            testID={testID ? `${testID}-next-month` : undefined}
                                                        >
                                                            <ChevronIcon direction="right" />
                                                        </Pressable>
                                                        <Pressable
                                                            accessibilityRole="button"
                                                            accessibilityLabel="下一年"
                                                            onPress={() => shiftView(1, 0)}
                                                            style={styles.navBtn}
                                                            testID={testID ? `${testID}-next-year` : undefined}
                                                        >
                                                            <ChevronIcon direction="right" />
                                                        </Pressable>
                                                    </>
                                                )}
                                            </View>
                                        </View>
                                        {renderDayGrid(panel.date, idx)}
                                    </View>
                                ))}
                            </View>
                            <View style={styles.footer}>
                                <Pressable
                                    accessibilityRole="button"
                                    onPress={confirmTime}
                                    style={styles.confirmBtn}
                                    testID={testID ? `${testID}-confirm` : undefined}
                                >
                                    <Text style={styles.confirmText}>确定</Text>
                                </Pressable>
                            </View>
                        </>
                    ) : (
                        <>
                            <View style={styles.header}>
                                <View style={styles.headerGroup}>
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel="上一年"
                                        onPress={() => (mode === 'year' ? shiftView(-10, 0) : shiftView(-1, 0))}
                                        style={styles.navBtn}
                                        testID={testID ? `${testID}-prev-year` : undefined}
                                    >
                                        <ChevronIcon direction="left" />
                                    </Pressable>
                                    {mode === 'date' && (
                                        <Pressable
                                            accessibilityRole="button"
                                            accessibilityLabel="上个月"
                                            onPress={() => shiftView(0, -1)}
                                            style={styles.navBtn}
                                            testID={testID ? `${testID}-prev-month` : undefined}
                                        >
                                            <ChevronIcon direction="left" />
                                        </Pressable>
                                    )}
                                </View>
                                {mode === 'date' && (
                                    <Pressable
                                        accessibilityRole="button"
                                        onPress={() => setMode('year')}
                                        style={styles.labelBtn}
                                        testID={testID ? `${testID}-label` : undefined}
                                    >
                                        <Text style={styles.labelText}>
                                            {year}年{month + 1}月
                                        </Text>
                                    </Pressable>
                                )}
                                {mode === 'month' && (
                                    <Pressable
                                        accessibilityRole="button"
                                        onPress={() => setMode('year')}
                                        style={styles.labelBtn}
                                        testID={testID ? `${testID}-label` : undefined}
                                    >
                                        <Text style={styles.labelText}>{year}年</Text>
                                    </Pressable>
                                )}
                                {mode === 'year' && (
                                    <Text style={styles.yearLabel}>
                                        {decadeStart} - {decadeEnd}年
                                    </Text>
                                )}
                                <View style={styles.headerGroup}>
                                    {mode === 'date' && (
                                        <Pressable
                                            accessibilityRole="button"
                                            accessibilityLabel="下个月"
                                            onPress={() => shiftView(0, 1)}
                                            style={styles.navBtn}
                                            testID={testID ? `${testID}-next-month` : undefined}
                                        >
                                            <ChevronIcon direction="right" />
                                        </Pressable>
                                    )}
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel="下一年"
                                        onPress={() => (mode === 'year' ? shiftView(10, 0) : shiftView(1, 0))}
                                        style={styles.navBtn}
                                        testID={testID ? `${testID}-next-year` : undefined}
                                    >
                                        <ChevronIcon direction="right" />
                                    </Pressable>
                                </View>
                            </View>
                            {mode === 'date' && renderDayGrid(viewDate, 0)}
                            {mode === 'month' && (
                                <View style={styles.grid3x4}>
                                    {MONTHS.map((label, i) => {
                                        const activeDate = pendingDate ?? selectedDate;
                                        const selected =
                                            !!activeDate &&
                                            activeDate.getFullYear() === year &&
                                            activeDate.getMonth() === i;
                                        return (
                                            <Pressable
                                                key={label}
                                                accessibilityRole="button"
                                                accessibilityState={{ selected }}
                                                accessibilityLabel={`${i + 1}月`}
                                                onPress={() => {
                                                    if (picker === 'month' && !range) {
                                                        setPendingDate(new Date(year, i, 1));
                                                    } else {
                                                        setViewDate(new Date(year, i, 1));
                                                        setMode('date');
                                                    }
                                                }}
                                                style={[styles.monthCell, selected && styles.monthCellSelected]}
                                                testID={testID ? `${testID}-month-${i + 1}` : undefined}
                                            >
                                                <Text style={[styles.monthText, selected && styles.monthTextSelected]}>
                                                    {label}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            )}
                            {mode === 'year' && (
                                <View style={styles.grid3x4}>
                                    {yearCells.map((y) => {
                                        const selected = selectedDate?.getFullYear() === y;
                                        return (
                                            <Pressable
                                                key={y}
                                                accessibilityRole="button"
                                                accessibilityState={{ selected }}
                                                accessibilityLabel={`${y}年`}
                                                onPress={() => {
                                                    setViewDate(new Date(y, month, 1));
                                                    setMode('month');
                                                }}
                                                style={[styles.yearCell, selected && styles.yearCellSelected]}
                                                testID={testID ? `${testID}-year-${y}` : undefined}
                                            >
                                                <Text style={[styles.monthText, selected && styles.monthTextSelected]}>
                                                    {y}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            )}
                            {(mode === 'date' || (picker === 'month' && mode === 'month')) && (
                                <View style={styles.footer}>
                                    {showToday && (
                                        <Pressable
                                            accessibilityRole="button"
                                            onPress={handleToday}
                                            style={styles.todayBtn}
                                            testID={testID ? `${testID}-today` : undefined}
                                        >
                                            <Text style={styles.todayText}>今天</Text>
                                        </Pressable>
                                    )}
                                    <Pressable
                                        accessibilityRole="button"
                                        onPress={confirmTime}
                                        style={styles.confirmBtn}
                                        testID={testID ? `${testID}-confirm` : undefined}
                                    >
                                        <Text style={styles.confirmText}>确定</Text>
                                    </Pressable>
                                </View>
                            )}
                        </>
                    )}
                </Animated.View>
            </Modal>
        </View>
    );
};

DatePicker.displayName = 'DatePicker';

const styles = StyleSheet.create({
    // `.wrapper { position: relative; display: inline-block }`
    wrapper: {
        alignSelf: 'flex-start',
        position: 'relative',
    },
    wrapperDisabled: {
        opacity: 0.6,
    },
    trigger: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 50,
    },
    value: {
        flex: 1,
        color: VALUE_COLOR,
        fontWeight: '500',
    },
    placeholder: {
        flex: 1,
        color: PLACEHOLDER_COLOR,
        fontWeight: '400',
    },
    // `.rangeDivider { width: 1px; height: 16px; margin: 0 2px; background: #e8dcc8 }`
    rangeDivider: {
        width: 1,
        height: 16,
        marginHorizontal: 2,
        backgroundColor: '#e8dcc8',
    },
    clear: {
        width: 20,
        height: 20,
        marginLeft: 4,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
    },
    clearText: {
        color: PLACEHOLDER_COLOR,
        fontSize: 13,
        fontWeight: '700',
        lineHeight: 16,
    },
    calendarIcon: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    // `.panel`
    panel: {
        position: 'absolute',
        width: PANEL_WIDTH,
        padding: 14,
        backgroundColor: PANEL_BG,
        borderWidth: 1.5,
        borderColor: PANEL_BORDER,
        borderRadius: 20,
        boxShadow: '0 6px 18px rgba(61, 52, 40, 0.12)',
    },
    panelRange: {
        width: PANEL_WIDTH_RANGE,
    },
    rangePanels: {
        flexDirection: 'row',
        gap: 12,
    },
    rangePanel: {
        width: PANEL_WIDTH,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    headerGroup: {
        flexDirection: 'row',
        gap: 2,
    },
    navBtn: {
        width: 26,
        height: 26,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
    },
    labelBtn: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 10,
    },
    labelText: {
        color: DAY_COLOR,
        fontSize: 14,
        fontWeight: '700',
    },
    yearLabel: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        color: DAY_COLOR,
        fontSize: 14,
        fontWeight: '700',
    },
    weekRow: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    weekCell: {
        width: 36,
        height: 24,
        lineHeight: 24,
        textAlign: 'center',
        color: '#a09080',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 2,
    },
    // `.dayCell { width: 32; height: 32; justify-self: center; border-radius: 50% }`
    dayCell: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
    },
    dayText: {
        color: DAY_COLOR,
        fontSize: 13,
        fontWeight: '500',
    },
    grid3x4: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
    },
    monthCell: {
        width: 84,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
    },
    monthCellSelected: {
        backgroundColor: SELECTED_BG,
    },
    yearCell: {
        width: 84,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
    },
    yearCellSelected: {
        backgroundColor: SELECTED_BG,
    },
    monthText: {
        color: DAY_COLOR,
        fontSize: 13,
        fontWeight: '500',
    },
    monthTextSelected: {
        color: '#fff',
        fontWeight: '700',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f0e8d8',
    },
    todayBtn: {
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 10,
    },
    todayText: {
        color: '#8a7b66',
        fontSize: 13,
        fontWeight: '700',
    },
    confirmBtn: {
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: 'rgba(114, 93, 66, 0.1)',
    },
    confirmText: {
        color: '#8a7b66',
        fontSize: 12,
        fontWeight: '700',
    },
});
