# Calendar - RN fork

For `animal-island-ui-rn`, not the upstream DOM package. The declarations below are
verbatim from native source; rebuild `dist/index.d.ts` before relying on installed types.
Package/runtime setup: [native-host.md](native-host.md).

## Calendar

```ts
export type CalendarColor = 'teal' | 'amber' | 'coral' | 'green' | 'purple';

export interface CalendarEvent {
    /** 事项内容 */
    title: React.ReactNode;
    /** 开始日期：YYYY-MM-DD 字符串或 dayjs 对象 */
    start: string | Dayjs;
    /** 结束日期，省略时等同于 start；传入时渲染成跨天的连续事项条 */
    end?: string | Dayjs;
    /** 颜色，默认 teal */
    color?: CalendarColor;
    /** 是否在事项条首段展示起始时间 HH:mm（跨周续接段不重复展示） */
    showTime?: boolean;
}

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
```

The grid always has six weeks. Default selection/month use today; showEventTime defaults
to true and draggableEvents to false. Replace the events array when changing its entries.
Write back controlled value/panelValue after their callbacks. Month navigation does not
commit a date. Event content must be native React nodes, not DOM elements.

Native range creation starts with a long press; cancel/termination never commits, and
endpoints are ordered date-only strings. Accessibility actions provide another entry.
The Web adapter supports arrows, Home/End, PageUp/PageDown, Enter/Space and Escape.
Neither an adapter test nor substituted dimensions proves physical gesture/focus behavior.
Small widths scroll horizontally rather than shrinking day targets below 44 native units.
Two event lanes and an overflow count retain a bounded row at large font scales.
