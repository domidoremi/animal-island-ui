interface CalendarKeyEvent {
    key?: string;
    target: { id?: string } | null;
    defaultPrevented?: boolean;
    isComposing?: boolean;
    altKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    preventDefault(): void;
}
interface CalendarElement {
    addEventListener(type: string, handler: (event: CalendarKeyEvent) => void): void;
    removeEventListener(type: string, handler: (event: CalendarKeyEvent) => void): void;
    querySelector(selector: string): { focus?(): void } | null;
}

export function attachCalendarKeyboard(
    element: unknown,
    cellPrefix: string,
    handleKey: (key: string) => boolean
): (() => void) | undefined {
    const root = element as CalendarElement | null;
    if (!root?.addEventListener) return undefined;
    const listener = (event: CalendarKeyEvent) => {
        if (
            event.defaultPrevented ||
            event.isComposing ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            !event.target?.id?.startsWith(cellPrefix) ||
            !event.key
        )
            return;
        if (handleKey(event.key)) event.preventDefault();
    };
    root.addEventListener('keydown', listener);
    return () => root.removeEventListener('keydown', listener);
}

export function focusCalendarCell(element: unknown, id: string) {
    (element as CalendarElement | null)?.querySelector?.(`[id="${id}"]`)?.focus?.();
}
