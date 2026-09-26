import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
    type LayoutChangeEvent,
    type StyleProp,
    type TextStyle,
    type ViewStyle,
} from 'react-native';
import { Circle, Path, Svg } from 'react-native-svg';
import {
    LIST_MAX_HEIGHT,
    LIST_PADDING,
    OPTION_GAP,
    OPTION_HEIGHT,
    PANEL_WIDTH,
    PANEL_WIDTH_NO_SECONDS,
    centerOffset,
    computePanelPosition,
    type PanelPosition,
} from './geometry';

export type TimePickerSize = 'small' | 'middle' | 'large';

export type TimePickerStatus = 'error' | 'warning';

/** 时分秒对象 */
export type TimePart = { h: number; m: number; s: number };

export interface TimePickerProps {
    /** 当前选中时间（受控），格式 HH:mm:ss */
    value?: string;
    /** 默认选中时间（非受控），格式 HH:mm:ss */
    defaultValue?: string;
    /** 值变化回调，清空时返回 null */
    onChange?: (value: string | null) => void;
    /** 占位文本 */
    placeholder?: string;
    /** 是否禁用 */
    disabled?: boolean;
    /** 是否允许一键清空 */
    allowClear?: boolean;
    /** 尺寸 */
    size?: TimePickerSize;
    /** 校验状态 */
    status?: TimePickerStatus;
    /** 展示格式，支持 HH / mm / ss 占位符，默认 HH:mm:ss；包含 ss 时面板显示秒列 */
    format?: string;
    /** 小时步进（默认 1） */
    hourStep?: number;
    /** 分钟步进（默认 1） */
    minuteStep?: number;
    /** 秒步进（默认 1） */
    secondStep?: number;
    /** 受控展开状态 */
    open?: boolean;
    /** 展开状态变化回调 */
    onOpenChange?: (open: boolean) => void;
    /** 对外暴露的无障碍标签（无可见 label 时使用） */
    'aria-label'?: string;
    /** 关联外部可见 label 的 id */
    'aria-labelledby'?: string;
    /** 自定义样式（作用于最外层容器） */
    style?: StyleProp<ViewStyle>;
    /** 测试标识（RN 里 `className` 的对应物） */
    testID?: string;
}

const pad2 = (n: number) => `${n}`.padStart(2, '0');

/** 将 HH:mm:ss 字符串解析为时分秒对象，非法输入返回 null */
const parseTime = (value: string | null | undefined): TimePart | null => {
    if (!value) return null;
    const match = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(value);
    if (!match) return null;
    const part: TimePart = { h: Number(match[1]), m: Number(match[2]), s: Number(match[3] ?? 0) };
    return part.h > 23 || part.m > 59 || part.s > 59 ? null : part;
};

/** 将时分秒序列化为 HH:mm:ss */
const toValue = (part: TimePart) => `${pad2(part.h)}:${pad2(part.m)}:${pad2(part.s)}`;

/** 按模板格式化时间，支持 HH / mm / ss 占位符 */
const formatTime = (part: TimePart, format: string) =>
    format.replace('HH', pad2(part.h)).replace('mm', pad2(part.m)).replace('ss', pad2(part.s));

/** 面板是否展示秒列：format 包含 ss */
const hasSeconds = (format: string) => format.includes('ss');

/** 关闭退场动画时长，与 Web 版 `.panel` 的 0.2s 过渡一致，动画结束后再卸载面板 */
const CLOSE_ANIMATION_MS = 200;

const EASE = Easing.bezier(0.4, 0, 0.2, 1);

/** 触发区尺寸 —— 对应 `.trigger-small / -middle / -large` */
const SIZE_SPEC: Record<TimePickerSize, { height: number; paddingHorizontal: number; fontSize: number }> = {
    small: { height: 32, paddingHorizontal: 14, fontSize: 12 },
    middle: { height: 40, paddingHorizontal: 18, fontSize: 14 },
    large: { height: 48, paddingHorizontal: 22, fontSize: 16 },
};

/**
 * 触发区投影。对应 `.trigger-*` 的 `box-shadow`。
 *
 * ⚠️ `.trigger:hover { box-shadow: 0 3px 0 0 #c4b89e }` **丢弃** —— RN 没有 hover。
 *
 * ⚠️ 优先级按 **CSS 源码顺序**而非 class 书写顺序：`.trigger-open`(L44) 在
 * `.trigger-error`(L50) / `.trigger-warning`(L54) 之前，同权重下后者胜。
 * 所以 status 压过 open（面板展开且 error 时，看到的是 error 的投影）。
 */
const SHADOW_OPEN = '0 3px 0 0 #e0b800, 0 0 0 3px rgba(255, 204, 0, 0.15)';
const SHADOW_ERROR = '0 3px 0 0 #c94444';
const SHADOW_WARNING = '0 3px 0 0 #dba90e';

/** 触发区被禁用时的底色 —— 对应 `.wrapper-disabled .trigger { background: #ece8dc }` */
const DISABLED_BG = '#ece8dc';
const TRIGGER_BG = '#fffbe7';

/** 值 / 占位文本颜色 —— 对应 `.value` / `.placeholder` */
const VALUE_COLOR = '#8a7b66';
const PLACEHOLDER_COLOR = '#c4b89e';

/**
 * 面板挂载时使用的兜底位置。
 *
 * 真机上 `measureInWindow` 回调到达前会先落在这里（下一帧就被校正），
 * 测试渲染器里回调**永不触发**，所以断言时看到的就是这个值。
 */
const FALLBACK_PANEL_POSITION: PanelPosition = { top: 0, left: 0 };

/**
 * 触发区右侧的小时钟图标。
 *
 * Web 版把这段 svg 内联在 TimePicker 的 JSX 里，并且用 `stroke="currentColor"`
 * 从 `.clockIcon { color: #a0936e }` 取色。RN 没有 `currentColor`，把颜色写死在这里
 * （禁用态也不变色 —— Web 版 `.wrapper-disabled` 只覆盖 `.value` / `.placeholder`）。
 */
const ClockIcon: React.FC = () => (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
        <Circle cx={7} cy={7} r={5.5} stroke="#a0936e" strokeWidth={1.4} />
        <Path d="M7 4.2V7l2 1.2" stroke="#a0936e" strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
);

interface TimeColumnProps {
    /** 列标题：时 / 分 / 秒 */
    title: string;
    /** 无障碍名里的单位：时 / 分 / 秒 */
    unit: string;
    /** 本列可选值（已按步进过滤） */
    values: number[];
    /** 当前选中值 */
    selected: number;
    onSelect: (value: number) => void;
    testID?: string;
}

/**
 * 一列可滚动的数值。
 *
 * Web 版用 `list.scrollTop = ...` 直接改 DOM 滚动位置；RN 换成一个 `ScrollView`
 * + `onLayout` 量出可视高度，再 `scrollTo` 把选中项滚到中间。
 * 「该滚到哪」的算术在 `geometry.ts` 的 `centerOffset` 里（可单测）。
 */
const TimeColumn: React.FC<TimeColumnProps> = ({ title, unit, values, selected, onSelect, testID }) => {
    // 从组件提取实例类型，同时兼容 RN 0.86 的 class 和 0.87 的函数组件声明。
    const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
    const [viewportHeight, setViewportHeight] = useState(0);

    // 选中项在本列（已过滤）里的下标；不在列表里（如 step=15 却选中 7 分）时退回 0
    const found = values.indexOf(selected);
    const selectedIndex = found >= 0 ? found : 0;

    useEffect(() => {
        if (viewportHeight <= 0) return;
        scrollRef.current?.scrollTo({ y: centerOffset(selectedIndex, viewportHeight), animated: false });
    }, [selectedIndex, viewportHeight]);

    const onLayout = useCallback((e: LayoutChangeEvent) => {
        setViewportHeight(e.nativeEvent.layout.height);
    }, []);

    return (
        <View style={styles.column}>
            <Text style={styles.columnTitle}>{title}</Text>
            <ScrollView
                ref={scrollRef}
                style={styles.columnList}
                contentContainerStyle={styles.columnListContent}
                onLayout={onLayout}
                showsVerticalScrollIndicator={false}
                testID={testID}
            >
                {values.map((v) => {
                    const isSelected = v === selected;
                    return (
                        <Pressable
                            key={v}
                            accessibilityRole="button"
                            // 上游 Web 版**没有**把选中态暴露给无障碍（只有 `.optionSelected`
                            // 这个视觉 class）。这里补上 `selected`，否则读屏用户点完听不到确认。
                            // 属于 RN 侧的有意增强，视觉与行为不变。
                            accessibilityState={{ selected: isSelected }}
                            aria-label={`${v} ${unit}`}
                            onPress={() => onSelect(v)}
                            style={[styles.option, isSelected && styles.optionSelected]}
                        >
                            <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{pad2(v)}</Text>
                        </Pressable>
                    );
                })}
            </ScrollView>
        </View>
    );
};

export const TimePicker: React.FC<TimePickerProps> = ({
    value,
    defaultValue,
    onChange,
    placeholder = '请选择时间',
    disabled = false,
    allowClear = false,
    size = 'middle',
    status,
    format = 'HH:mm:ss',
    hourStep = 1,
    minuteStep = 1,
    secondStep = 1,
    open: openProp,
    onOpenChange,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    style,
    testID,
}) => {
    const [innerValue, setInnerValue] = useState<string | null>(defaultValue ?? null);
    const [innerOpen, setInnerOpen] = useState(false);
    const [pending, setPending] = useState<TimePart | null>(() => parseTime(defaultValue));
    const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
    const closingRef = useRef(false);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const triggerRef = useRef<React.ComponentRef<typeof View>>(null);

    const windowSize = useWindowDimensions();

    const isControlled = value !== undefined;
    const currentValue = isControlled ? (value ?? null) : innerValue;
    const parsed = parseTime(currentValue);
    const open = openProp !== undefined ? openProp : innerOpen;

    /**
     * 面板的入场 / 退场进度 0→1。
     *
     * 对应 Web 版 `.panel`（`opacity: 0; translateY(-6px)`）→ `.panelVisible`
     * （`opacity: 1; translateY(0)`）的 0.2s 过渡。
     *
     * `useNativeDriver: true`：opacity 与 translateY 都是原生驱动支持的属性，
     * 交给原生线程逐帧更稳（与 Button 的 loading 旋转一致）。
     * 卸载时机**不依赖**动画回调，而是照 Web 版用 `setTimeout`，见 `closePanel`。
     */
    const visible = useRef(new Animated.Value(0)).current;

    // 打开面板时重置待选值所用到的当前值引用，避免值变化本身触发重置
    const valueRef = useRef(currentValue);
    useEffect(() => {
        valueRef.current = currentValue;
    }, [currentValue]);

    const setOpen = useCallback(
        (next: boolean) => {
            if (openProp === undefined) setInnerOpen(next);
            onOpenChange?.(next);
        },
        [openProp, onOpenChange]
    );

    // 统一关闭入口：先播放退场动效，动画结束后再卸载面板
    const closePanel = useCallback(() => {
        if (closingRef.current) return;
        closingRef.current = true;
        Animated.timing(visible, {
            toValue: 0,
            duration: CLOSE_ANIMATION_MS,
            easing: EASE,
            useNativeDriver: true,
        }).start();
        closeTimerRef.current = setTimeout(() => {
            closingRef.current = false;
            closeTimerRef.current = null;
            setOpen(false);
        }, CLOSE_ANIMATION_MS);
    }, [setOpen, visible]);

    // 组件卸载时清理未触发的关闭定时器
    useEffect(
        () => () => {
            if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current);
        },
        []
    );

    // 每次展开：待选值重置为当前值、播放入场动效、测量触发区位置
    useEffect(() => {
        if (!open) {
            setPanelPosition(null);
            return;
        }

        if (closeTimerRef.current !== null) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
        closingRef.current = false;

        setPending(parseTime(valueRef.current) ?? { h: 0, m: 0, s: 0 });

        visible.setValue(0);
        Animated.timing(visible, {
            toValue: 1,
            duration: CLOSE_ANIMATION_MS,
            easing: EASE,
            useNativeDriver: true,
        }).start();

        // ⚠️ 与 Web 版的结构性差异：Web 的面板是 wrapper 的子节点，`top: 100%` 这类
        // 相对定位天然生效；RN 为了不被祖先的 overflow 裁掉，把面板放进了 `Modal`，
        // 于是必须自己测量触发区在屏幕上的位置，再换算成绝对偏移。
        //
        // 先落兜底位置**再**尝试测量校正：`measureInWindow` 是回调式的，测试渲染器里
        // 它存在但**永远不会回调**（实测），只等回调会让面板根本挂不上。
        // 真机上回调在下一帧到达，此时面板刚起步（opacity 从 0 淡入），
        // 一帧的位置校正看不出来。
        setPanelPosition(FALLBACK_PANEL_POSITION);
        const trigger = triggerRef.current;
        if (trigger && typeof trigger.measureInWindow === 'function') {
            trigger.measureInWindow((x, y, width, height) => {
                setPanelPosition(computePanelPosition({ x, y, width, height }, windowSize));
            });
        }
    }, [open, visible, windowSize]);

    const pickUnit = (part: TimePart) => setPending(part);

    // 此刻：待选时间设为当前时间
    const setNow = () => {
        const now = new Date();
        setPending({ h: now.getHours(), m: now.getMinutes(), s: now.getSeconds() });
    };

    // 确定：值有变化时提交，随后关闭面板
    const confirmTime = () => {
        if (!pending) return;
        const next = toValue(pending);
        if (next !== currentValue) {
            if (!isControlled) setInnerValue(next);
            onChange?.(next);
        }
        closePanel();
    };

    const handleClear = () => {
        if (!isControlled) setInnerValue(null);
        onChange?.(null);
    };

    const base = pending ?? { h: 0, m: 0, s: 0 };
    const hours = Array.from({ length: 24 }, (_, i) => i).filter((h) => h % Math.max(1, hourStep) === 0);
    const minutes = Array.from({ length: 60 }, (_, i) => i).filter((m) => m % Math.max(1, minuteStep) === 0);
    const seconds = hasSeconds(format)
        ? Array.from({ length: 60 }, (_, i) => i).filter((s) => s % Math.max(1, secondStep) === 0)
        : [];
    const secondsEnabled = seconds.length > 0;

    const sizeSpec = SIZE_SPEC[size];

    // 触发区外观：底色 + 投影 + 尺寸。投影优先级 status > open（见 SHADOW_* 注释）。
    // 用 `Record<string, unknown>` 攒再断言成 `ViewStyle`：`ViewStyle` 的属性是 readonly，
    // 不能条件式赋值（与 Button 的 `toViewStyle` 同一处理）。
    const triggerFace: Record<string, unknown> = {
        height: sizeSpec.height,
        paddingHorizontal: sizeSpec.paddingHorizontal,
        backgroundColor: disabled ? DISABLED_BG : TRIGGER_BG,
    };
    if (!disabled) {
        if (status === 'error') triggerFace.boxShadow = SHADOW_ERROR;
        else if (status === 'warning') triggerFace.boxShadow = SHADOW_WARNING;
        else if (open) triggerFace.boxShadow = SHADOW_OPEN;
    }

    // 文本样式：颜色看「有无已提交的值」+ 禁用态；字重只看「有无已提交的值」。
    // 注意文本内容与颜色判据不同源 —— Web 版就是这个行为（展开时显示 pending，
    // 但 class 仍按 currentValue 决定），照搬。
    const textStyle: TextStyle = {
        flex: 1,
        fontSize: sizeSpec.fontSize,
        // CSS `letter-spacing: 0.01em`，RN 只接受绝对值，按字号换算
        letterSpacing: sizeSpec.fontSize * 0.01,
        fontWeight: currentValue ? '500' : '400',
        color: disabled || !currentValue ? PLACEHOLDER_COLOR : VALUE_COLOR,
    };

    const displayText =
        open && pending ? formatTime(pending, format) : parsed ? formatTime(parsed, format) : placeholder;

    const translateY = visible.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] });

    return (
        <View style={[styles.wrapper, disabled && styles.wrapperDisabled, style]} testID={testID}>
            <Pressable
                ref={triggerRef}
                role="combobox"
                aria-expanded={open}
                // ⚠️ Web 版还有 `aria-haspopup="dialog"` 与 `aria-controls={panelId}`：
                // RN 既没有 `aria-haspopup`，也没有 `aria-controls`，两个都只能丢。
                aria-disabled={disabled || undefined}
                aria-label={ariaLabel}
                aria-labelledby={ariaLabelledBy}
                tabIndex={disabled ? -1 : 0}
                onPress={() => !disabled && !closingRef.current && setOpen(!open)}
                style={[styles.trigger, triggerFace as ViewStyle]}
                testID={testID ? `${testID}-trigger` : undefined}
            >
                <Text style={textStyle} numberOfLines={1}>
                    {displayText}
                </Text>
                {allowClear && currentValue && !disabled && (
                    <Pressable
                        accessibilityRole="button"
                        aria-label="清除时间"
                        onPress={handleClear}
                        style={styles.clear}
                    >
                        <Text style={styles.clearText}>×</Text>
                    </Pressable>
                )}
                {/* `aria-hidden`：装饰性图标，不进无障碍树（Web 版同样是 aria-hidden） */}
                <View aria-hidden style={styles.clockIcon} testID={testID ? `${testID}-clock` : undefined}>
                    <ClockIcon />
                </View>
            </Pressable>

            <Modal
                transparent
                visible={open}
                animationType="none"
                // Android 实体返回键 / 手势返回：等价于 Web 版的 Escape
                onRequestClose={closePanel}
            >
                {/*
                 * 透明全屏遮罩：只负责「点击面板外部关闭」，不画任何底色
                 * —— Web 版没有 scrim，只有 `document.addEventListener('mousedown')`。
                 */}
                <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={closePanel}
                    testID={testID ? `${testID}-backdrop` : undefined}
                />

                {panelPosition && (
                    <Animated.View
                        role="dialog"
                        aria-label="选择时间"
                        // 面板自身要「吃掉」落在它身上的触摸，否则点到面板空白处会穿透到
                        // 下面那层遮罩、把面板关掉。Web 版靠 `wrapper.contains(e.target)`
                        // 判断内外，RN 靠响应者系统，等价物就是这一句。
                        onStartShouldSetResponder={() => true}
                        style={[
                            styles.panel,
                            !secondsEnabled && styles.panelNoSeconds,
                            panelPosition,
                            { opacity: visible, transform: [{ translateY }] },
                        ]}
                        testID={testID ? `${testID}-panel` : undefined}
                    >
                        <View style={styles.columns}>
                            <TimeColumn
                                title="时"
                                unit="时"
                                values={hours}
                                selected={base.h}
                                onSelect={(h) => pickUnit({ ...base, h })}
                                testID={testID ? `${testID}-hour` : undefined}
                            />
                            <TimeColumn
                                title="分"
                                unit="分"
                                values={minutes}
                                selected={base.m}
                                onSelect={(m) => pickUnit({ ...base, m })}
                                testID={testID ? `${testID}-minute` : undefined}
                            />
                            {secondsEnabled && (
                                <TimeColumn
                                    title="秒"
                                    unit="秒"
                                    values={seconds}
                                    selected={base.s}
                                    onSelect={(s) => pickUnit({ ...base, s })}
                                    testID={testID ? `${testID}-second` : undefined}
                                />
                            )}
                        </View>

                        <View style={styles.footer}>
                            <Pressable
                                accessibilityRole="button"
                                onPress={setNow}
                                style={styles.footerBtn}
                                testID={testID ? `${testID}-now` : undefined}
                            >
                                <Text style={styles.footerBtnText}>此刻</Text>
                            </Pressable>
                            <Pressable
                                accessibilityRole="button"
                                onPress={confirmTime}
                                style={styles.confirmBtn}
                                testID={testID ? `${testID}-confirm` : undefined}
                            >
                                <Text style={styles.confirmBtnText}>确定</Text>
                            </Pressable>
                        </View>
                    </Animated.View>
                )}
            </Modal>
        </View>
    );
};

TimePicker.displayName = 'TimePicker';

const styles = StyleSheet.create({
    wrapper: {
        // Web 是 `display: inline-block`，RN 的等价物是让容器不被拉伸
        alignSelf: 'flex-start',
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
    clear: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 20,
        height: 20,
        marginLeft: 4,
        borderRadius: 10,
    },
    clearText: {
        color: PLACEHOLDER_COLOR,
        fontSize: 13,
        fontWeight: '700',
        lineHeight: 13, // CSS line-height: 1
    },
    clockIcon: {
        alignItems: 'center',
    },
    panel: {
        position: 'absolute',
        width: PANEL_WIDTH,
        padding: 14,
        backgroundColor: '#fffdf7',
        borderWidth: 1.5,
        borderColor: '#e8dcc8',
        borderRadius: 20,
        // ⚠️ `boxShadow` 需要 Android 的 New Architecture（与 Button / Divider 同一约束）
        boxShadow: '0 6px 18px rgba(61, 52, 40, 0.12)',
    },
    panelNoSeconds: {
        width: PANEL_WIDTH_NO_SECONDS,
    },
    columns: {
        flexDirection: 'row',
        gap: 8,
    },
    column: {
        flex: 1,
        minWidth: 0,
    },
    columnTitle: {
        marginBottom: 6,
        textAlign: 'center',
        color: '#a09080',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1, // CSS letter-spacing: 1px
    },
    columnList: {
        maxHeight: LIST_MAX_HEIGHT,
    },
    columnListContent: {
        padding: LIST_PADDING,
        gap: OPTION_GAP,
    },
    option: {
        height: OPTION_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
    },
    optionSelected: {
        backgroundColor: '#ffb400',
    },
    optionText: {
        color: '#725d42',
        fontSize: 13,
        fontWeight: '500',
    },
    optionTextSelected: {
        color: '#fff',
        fontWeight: '700',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 6,
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f0e8d8',
    },
    footerBtn: {
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 10,
    },
    footerBtnText: {
        color: VALUE_COLOR,
        fontSize: 12,
        fontWeight: '700',
    },
    confirmBtn: {
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: 'rgba(114, 93, 66, 0.1)',
    },
    confirmBtnText: {
        color: VALUE_COLOR,
        fontSize: 12,
        fontWeight: '700',
    },
});
