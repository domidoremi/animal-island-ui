interface RateElement {
    querySelectorAll(selector: string): ArrayLike<{ focus(): void }>;
    addEventListener(type: string, handler: (event: RateKeyEvent) => void): void;
    removeEventListener(type: string, handler: (event: RateKeyEvent) => void): void;
}
interface RateKeyEvent {
    target: unknown;
    key?: string;
    defaultPrevented?: boolean;
    isComposing?: boolean;
    altKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    preventDefault(): void;
}

export function attachRateKeyboard(element: unknown, value: number, count: number, commit: (value: number) => void) {
    const root = element as RateElement | null;
    if (!root?.addEventListener || !root.querySelectorAll) return undefined;
    const handler = (event: RateKeyEvent) => {
        if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || !count)
            return;
        const stars = Array.from(root.querySelectorAll('[role="radio"]'));
        if (!stars.includes(event.target as (typeof stars)[number])) return;
        const next =
            event.key === 'ArrowRight' || event.key === 'ArrowUp'
                ? Math.min(count, value + 1)
                : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
                  ? Math.max(1, value - 1)
                  : event.key === 'Home'
                    ? 1
                    : event.key === 'End'
                      ? count
                      : null;
        if (next === null) return;
        event.preventDefault();
        stars[next - 1]?.focus();
        if (next !== value) commit(next);
    };
    root.addEventListener('keydown', handler);
    return () => root.removeEventListener('keydown', handler);
}
