import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import {
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
    type GestureResponderEvent,
    type ViewProps,
    type ViewStyle,
} from 'react-native';
import { Path, Svg } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';
import {
    COLS,
    GRID_CELLS,
    MAX_EVENT_ROWS,
    WEEKDAYS,
    clampToGrid,
    gridStartOf,
    layoutEvents,
    parseDate,
    parseMonthValue,
    pointToCell,
    textOf,
    toDateKey,
    type CalendarEvent,
} from './monthGrid';
import { attachCalendarKeyboard, focusCalendarCell } from './calendarWeb';
export type { CalendarColor, CalendarEvent } from './monthGrid';

export interface CalendarProps extends Omit<ViewProps, 'children'> {
    /** Controlled selected day, YYYY-MM-DD. */
    value?: string;
    /** Initial selected day; defaults to today. */
    defaultValue?: string;
    /** Controlled visible month, YYYY-MM or YYYY-MM-DD. */
    panelValue?: string;
    /** Initial visible month. */
    defaultPanelValue?: string;
    /** Selection commits; navigation alone does not select. */
    onChange?: (date: string) => void;
    /** The parent must write back a controlled panel month. */
    onPanelChange?: (month: string) => void;
    /** Replace the array when changing event dates or titles. */
    events?: CalendarEvent[];
    /** Time appears only on the first event segment. */
    showEventTime?: boolean;
    /** Long-press then drag to create a range; accessibility actions offer the same operation. */
    draggableEvents?: boolean;
    /** Ordered, date-only endpoints. Canceled or same-day drags never create events. */
    onEventCreate?: (start: string, end: string) => void;
    /** Native logical width or percentage. */
    width?: ViewStyle['width'];
}
const EMPTY_EVENTS: CalendarEvent[] = [];
const EVENT_BRAND = {
    teal: 'app-teal',
    amber: 'app-yellow',
    coral: 'app-red',
    green: 'app-green',
    purple: 'purple',
} as const;
interface DragRange {
    anchor: number;
    head: number;
    grid: string;
}

export const Calendar: React.FC<CalendarProps> = ({
    value,
    defaultValue,
    panelValue,
    defaultPanelValue,
    onChange,
    onPanelChange,
    events = EMPTY_EVENTS,
    showEventTime = true,
    draggableEvents = false,
    onEventCreate,
    width,
    style,
    testID,
    accessibilityLabel = 'Calendar',
    ...rest
}) => {
    const { theme } = useTheme();
    const { width: windowWidth, fontScale } = useWindowDimensions();
    const [innerValue, setInnerValue] = useState(() => defaultValue ?? toDateKey(dayjs()));
    const selectedValue = value ?? innerValue;
    const [innerPanel, setInnerPanel] = useState(
        () => parseMonthValue(defaultPanelValue) ?? parseDate(defaultValue) ?? parseDate(value) ?? dayjs()
    );
    const viewMonth = panelValue !== undefined ? (parseMonthValue(panelValue) ?? dayjs()) : innerPanel;
    const monthKey = viewMonth.format('YYYY-MM');
    const gridKey = toDateKey(gridStartOf(viewMonth));
    const gridStart = dayjs(gridKey);
    const todayKey = toDateKey(dayjs());
    const [focusCursor, setFocusCursor] = useState(() => selectedValue);
    const focusKey = toDateKey(clampToGrid(parseDate(focusCursor) ?? dayjs(), gridStart));
    const selectedDate = parseDate(selectedValue);
    const selectedKey = selectedDate ? toDateKey(clampToGrid(selectedDate, gridStart)) : '';
    const [measuredWidth, setMeasuredWidth] = useState(0);
    const rootRef = useRef<React.ComponentRef<typeof View>>(null);
    const gridRef = useRef<React.ComponentRef<typeof View>>(null);
    const prefix = 'animal-calendar-' + useId().replace(/[^a-zA-Z0-9_-]/g, '') + '-';
    const pendingFocus = useRef(false);
    const lastSelected = useRef(selectedValue);
    const [drag, setDrag] = useState<DragRange | null>(null);
    const dragRef = useRef<DragRange | null>(null);
    const origin = useRef<{ x: number; y: number; width: number } | null>(null);
    const availableWidth = typeof width === 'number' ? width : measuredWidth || windowWidth - 32;
    const gridWidth = Math.max(COLS * 44, availableWidth);
    const scale = Math.max(0.6, Math.min(2, gridWidth / 750));
    const numberBand = Math.max(44, 42 * scale, 22 * fontScale + 16);
    const eventRow = Math.max(22 * scale, Math.max(11, 13 * scale) * fontScale + 8);
    const rowHeight = Math.max(104 * scale, numberBand + eventRow * MAX_EVENT_ROWS + 6);
    const cells = useMemo(
        () => Array.from({ length: GRID_CELLS }, (_, index) => dayjs(gridKey).add(index, 'day')),
        [gridKey]
    );
    const preview = useMemo<CalendarEvent | null>(
        () =>
            drag
                ? {
                      title: '',
                      start: dayjs(drag.grid).add(Math.min(drag.anchor, drag.head), 'day'),
                      end: dayjs(drag.grid).add(Math.max(drag.anchor, drag.head), 'day'),
                      color: 'teal',
                  }
                : null,
        [drag]
    );
    const layout = useMemo(
        () => layoutEvents(preview ? [...events, preview] : events, dayjs(gridKey), dayjs(todayKey), preview),
        [events, preview, gridKey, todayKey]
    );
    const cellEvents = useMemo(
        () =>
            cells.map((date) =>
                events.filter((event) => {
                    const start = parseDate(event.start) ?? dayjs(todayKey);
                    const declaredEnd = parseDate(event.end);
                    const end = declaredEnd && !declaredEnd.isBefore(start, 'day') ? declaredEnd : start;
                    return !date.isBefore(start, 'day') && !date.isAfter(end, 'day');
                })
            ),
        [cells, events, todayKey]
    );
    const overflow = layout.counts.map(
        (count, index) =>
            count -
            layout.segments.filter(
                (segment) => segment.event !== preview && index >= segment.index && index <= segment.endIndex
            ).length
    );
    const cancelDrag = useCallback(() => {
        dragRef.current = null;
        setDrag(null);
        origin.current = null;
    }, []);
    useEffect(() => {
        cancelDrag();
    }, [gridKey, draggableEvents, cancelDrag]);
    useEffect(() => {
        setFocusCursor(selectedValue);
    }, [selectedValue]);
    useEffect(() => {
        if (lastSelected.current === selectedValue) return;
        lastSelected.current = selectedValue;
        if (panelValue !== undefined) return;
        const next = parseDate(selectedValue);
        if (next && next.format('YYYY-MM') !== monthKey) setInnerPanel(next.date(1));
    }, [selectedValue, panelValue, monthKey]);
    const goToMonth = useCallback(
        (month: Dayjs, focus?: Dayjs) => {
            if (panelValue === undefined) setInnerPanel(month.date(1));
            onPanelChange?.(month.format('YYYY-MM'));
            if (focus) setFocusCursor(toDateKey(focus));
        },
        [panelValue, onPanelChange]
    );
    const select = useCallback(
        (date: Dayjs) => {
            const next = toDateKey(date);
            setFocusCursor(next);
            if (value === undefined) setInnerValue(next);
            onChange?.(next);
            if (date.format('YYYY-MM') !== monthKey) goToMonth(date.date(1));
        },
        [value, monthKey, goToMonth, onChange]
    );
    const shift = (delta: number, unit: 'month' | 'year' = 'month') => {
        const next = viewMonth.date(1).add(delta, unit);
        goToMonth(next, next.date(Math.min(dayjs(focusKey).date(), next.daysInMonth())));
    };
    useEffect(() => {
        if (Platform.OS !== 'web') return;
        return attachCalendarKeyboard(rootRef.current, prefix, (key) => {
            if (key === 'Enter' || key === ' ') {
                select(dayjs(focusKey));
                return true;
            }
            if (key === 'Escape') {
                cancelDrag();
                return true;
            }
            if (key === 'PageUp' || key === 'PageDown') {
                pendingFocus.current = true;
                shift(key === 'PageUp' ? -1 : 1);
                return true;
            }
            const current = dayjs(focusKey);
            const delta =
                key === 'ArrowLeft'
                    ? -1
                    : key === 'ArrowRight'
                      ? 1
                      : key === 'ArrowUp'
                        ? -COLS
                        : key === 'ArrowDown'
                          ? COLS
                          : key === 'Home'
                            ? -current.day()
                            : key === 'End'
                              ? 6 - current.day()
                              : null;
            if (delta === null) return false;
            const next = current.add(delta, 'day');
            pendingFocus.current = true;
            setFocusCursor(toDateKey(next));
            if (!next.isSame(viewMonth, 'month')) goToMonth(next.date(1));
            return true;
        });
    });
    useEffect(() => {
        if (!pendingFocus.current) return;
        pendingFocus.current = false;
        focusCalendarCell(rootRef.current, prefix + focusKey);
    }, [prefix, focusKey, monthKey]);
    const beginDrag = (index: number) => {
        if (!draggableEvents) return;
        const next = { anchor: index, head: index, grid: gridKey };
        dragRef.current = next;
        setDrag(next);
        gridRef.current?.measureInWindow((x, y, nextWidth) => {
            if (dragRef.current === next) origin.current = { x, y, width: nextWidth };
        });
    };
    const finishDrag = () => {
        const active = dragRef.current;
        cancelDrag();
        if (!draggableEvents || !active || active.grid !== gridKey || active.anchor === active.head) return;
        onEventCreate?.(
            toDateKey(dayjs(active.grid).add(Math.min(active.anchor, active.head), 'day')),
            toDateKey(dayjs(active.grid).add(Math.max(active.anchor, active.head), 'day'))
        );
    };
    const moveDrag = (event: GestureResponderEvent) => {
        const active = dragRef.current,
            box = origin.current;
        if (!active || !box) return;
        if (event.nativeEvent.touches?.length > 1) {
            cancelDrag();
            return;
        }
        const index = pointToCell(
            event.nativeEvent.pageX - box.x,
            event.nativeEvent.pageY - box.y,
            box.width,
            rowHeight
        );
        if (index === null) {
            cancelDrag();
            return;
        }
        const next = { ...active, head: index };
        dragRef.current = next;
        setDrag(next);
    };
    const chevron = (direction: -1 | 1) => (
        <Svg width={18} height={18} viewBox="0 0 24 24" accessible={false}>
            <Path
                d={direction < 0 ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
                stroke={theme.colors.text}
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
            />
        </Svg>
    );
    const navButton = (label: string, action: () => void, direction: -1 | 1) => (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={action}
            style={({ pressed }) => [styles.nav, { backgroundColor: pressed ? theme.colors.primaryBg : undefined }]}
        >
            {chevron(direction)}
        </Pressable>
    );
    return (
        <View
            {...rest}
            ref={rootRef}
            accessible={false}
            accessibilityLabel={accessibilityLabel}
            testID={testID}
            onLayout={(event) => setMeasuredWidth(event.nativeEvent.layout.width)}
            style={[{ width, maxWidth: '100%' }, style]}
        >
            <View style={styles.header}>
                <View style={styles.navGroup}>
                    {navButton('Previous year', () => shift(-1, 'year'), -1)}
                    {navButton('Previous month', () => shift(-1), -1)}
                </View>
                <Text
                    accessibilityRole="header"
                    accessibilityLiveRegion="polite"
                    style={{ color: theme.colors.text, fontSize: 15, fontWeight: '700', flexShrink: 1 }}
                >
                    {viewMonth.format('YYYY-MM')}
                </Text>
                <View style={styles.navGroup}>
                    {navButton('Next month', () => shift(1), 1)}
                    {navButton('Next year', () => shift(1, 'year'), 1)}
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Today"
                        onPress={() => select(dayjs())}
                        style={styles.nav}
                    >
                        <Text style={{ color: theme.colors.primary, fontSize: 14 }}>Today</Text>
                    </Pressable>
                </View>
            </View>
            <ScrollView horizontal contentContainerStyle={{ width: gridWidth }} keyboardShouldPersistTaps="handled">
                <View style={{ width: gridWidth }}>
                    <View style={styles.weekdays}>
                        {WEEKDAYS.map((day) => (
                            <Text key={day} style={[styles.weekday, { color: theme.colors.textSecondary }]}>
                                {day}
                            </Text>
                        ))}
                    </View>
                    <View
                        ref={gridRef}
                        testID={testID ? testID + '-grid' : undefined}
                        accessible={false}
                        onMoveShouldSetResponder={() => dragRef.current !== null}
                        onResponderMove={moveDrag}
                        onResponderRelease={finishDrag}
                        onResponderTerminate={cancelDrag}
                        onTouchEnd={finishDrag}
                        onTouchCancel={cancelDrag}
                        onResponderTerminationRequest={() => true}
                    >
                        {Array.from({ length: 6 }, (_, row) => (
                            <View key={row} style={{ height: rowHeight, flexDirection: 'row' }}>
                                {cells.slice(row * COLS, (row + 1) * COLS).map((date, col) => {
                                    const index = row * COLS + col,
                                        key = toDateKey(date),
                                        selected = key === selectedKey;
                                    const inRange =
                                        drag &&
                                        index >= Math.min(drag.anchor, drag.head) &&
                                        index <= Math.max(drag.anchor, drag.head);
                                    return (
                                        <Pressable
                                            key={key}
                                            nativeID={prefix + key}
                                            testID={testID ? testID + '-day-' + key : undefined}
                                            accessibilityRole="button"
                                            accessibilityLabel={[
                                                key,
                                                ...cellEvents[index].map((event) => textOf(event.title)),
                                            ].join(', ')}
                                            accessibilityState={{ selected }}
                                            tabIndex={key === focusKey ? 0 : -1}
                                            accessibilityActions={
                                                draggableEvents
                                                    ? [
                                                          { name: 'rangeStart', label: 'Start event range' },
                                                          { name: 'rangeEnd', label: 'Finish event range' },
                                                      ]
                                                    : undefined
                                            }
                                            onAccessibilityAction={(event) => {
                                                if (event.nativeEvent.actionName === 'rangeStart') beginDrag(index);
                                                else if (
                                                    event.nativeEvent.actionName === 'rangeEnd' &&
                                                    dragRef.current
                                                ) {
                                                    dragRef.current = { ...dragRef.current, head: index };
                                                    finishDrag();
                                                }
                                            }}
                                            onPress={() => select(date)}
                                            onLongPress={draggableEvents ? () => beginDrag(index) : undefined}
                                            style={[
                                                {
                                                    flex: 1,
                                                    minWidth: 44,
                                                    borderWidth: 1,
                                                    borderColor:
                                                        key === focusKey
                                                            ? theme.colors.primary
                                                            : theme.colors.borderLight,
                                                    backgroundColor: inRange ? theme.colors.primaryBg : theme.colors.bg,
                                                },
                                            ]}
                                        >
                                            <View
                                                style={{
                                                    height: numberBand,
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}
                                            >
                                                <Text
                                                    accessible={false}
                                                    style={{
                                                        color: selected
                                                            ? theme.colors.bg
                                                            : date.month() === viewMonth.month()
                                                              ? theme.colors.text
                                                              : theme.colors.textSecondary,
                                                        backgroundColor: selected
                                                            ? theme.colors.primary
                                                            : key === todayKey
                                                              ? theme.colors.primaryBg
                                                              : undefined,
                                                        borderRadius: 14,
                                                        paddingHorizontal: 5,
                                                        paddingVertical: 2,
                                                        fontSize: Math.max(14, 17 * scale),
                                                        fontWeight: selected ? '800' : '500',
                                                    }}
                                                >
                                                    {date.date()}
                                                </Text>
                                            </View>
                                            {overflow[index] > 0 ? (
                                                <Text
                                                    accessible={false}
                                                    style={{
                                                        position: 'absolute',
                                                        bottom: 1,
                                                        right: 4,
                                                        color: theme.colors.textSecondary,
                                                        fontSize: 10,
                                                    }}
                                                >
                                                    {'+' + overflow[index]}
                                                </Text>
                                            ) : null}
                                        </Pressable>
                                    );
                                })}
                                <View
                                    pointerEvents="none"
                                    accessibilityElementsHidden
                                    importantForAccessibility="no-hide-descendants"
                                    style={StyleSheet.absoluteFill}
                                >
                                    {layout.segments
                                        .filter((segment) => Math.floor(segment.index / COLS) === row)
                                        .map((segment, index) => {
                                            const face = theme.brand[EVENT_BRAND[segment.event.color ?? 'teal']];
                                            const timed =
                                                showEventTime && segment.event.showTime && !segment.continuation;
                                            return (
                                                <View
                                                    key={index}
                                                    testID={testID ? testID + '-event-' + row + '-' + index : undefined}
                                                    style={{
                                                        position: 'absolute',
                                                        left: ((segment.index % COLS) * gridWidth) / COLS + 2,
                                                        width: (segment.span * gridWidth) / COLS - 4,
                                                        top: numberBand + segment.row * eventRow,
                                                        height: eventRow - 3,
                                                        borderRadius: 6,
                                                        paddingHorizontal: 4,
                                                        backgroundColor: face.containerBg,
                                                        opacity: segment.event === preview ? 0.5 : 1,
                                                    }}
                                                >
                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                        {timed ? (
                                                            <Text
                                                                style={{
                                                                    color: face.onContainer,
                                                                    fontSize: Math.max(11, 13 * scale),
                                                                }}
                                                            >
                                                                {(parseDate(segment.event.start)?.format('HH:mm') ??
                                                                    '') + ' '}
                                                            </Text>
                                                        ) : null}
                                                        {typeof segment.event.title === 'string' ||
                                                        typeof segment.event.title === 'number' ? (
                                                            <Text
                                                                numberOfLines={1}
                                                                style={{
                                                                    flexShrink: 1,
                                                                    color: face.onContainer,
                                                                    fontSize: Math.max(11, 13 * scale),
                                                                    fontWeight: '600',
                                                                }}
                                                            >
                                                                {segment.event.title}
                                                            </Text>
                                                        ) : (
                                                            segment.event.title
                                                        )}
                                                    </View>
                                                </View>
                                            );
                                        })}
                                </View>
                            </View>
                        ))}
                    </View>
                </View>
            </ScrollView>
        </View>
    );
};
Calendar.displayName = 'Calendar';
const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 4,
        marginBottom: 8,
    },
    navGroup: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
    nav: {
        minWidth: 44,
        minHeight: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    weekdays: { flexDirection: 'row', minHeight: 32, alignItems: 'center' },
    weekday: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '600' },
});
