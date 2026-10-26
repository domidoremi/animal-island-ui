interface SelectKeyEvent {
    key?: string;
    target: { id?: string } | null;
    defaultPrevented?: boolean;
    isComposing?: boolean;
    altKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    preventDefault(): void;
}

interface SelectElement {
    addEventListener(type: string, handler: (event: SelectKeyEvent) => void): void;
    removeEventListener(type: string, handler: (event: SelectKeyEvent) => void): void;
    querySelector(selector: string): { focus?(): void } | null;
    setAttribute(name: string, value: string): void;
    removeAttribute(name: string): void;
    focus?(): void;
}

export function attachSelectKeyboard(
    element: unknown,
    controlId: string,
    optionPrefix: string,
    handleKey: (key: string, fromOption: boolean) => boolean
) {
    const root = element as SelectElement | null;
    if (!root?.addEventListener) return undefined;
    const listener = (event: SelectKeyEvent) => {
        if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || !event.key)
            return;
        const id = event.target?.id;
        const fromOption = Boolean(id?.startsWith(optionPrefix));
        if (id !== controlId && !fromOption) return;
        if (handleKey(event.key, fromOption)) event.preventDefault();
    };
    root.addEventListener('keydown', listener);
    return () => root.removeEventListener('keydown', listener);
}

export function focusSelect(element: unknown, id?: string) {
    const root = element as SelectElement | null;
    if (id) root?.querySelector?.(`[id="${id}"]`)?.focus?.();
    else root?.focus?.();
}

export function setSelectWebSemantics(element: unknown, listId: string, activeId: string | null) {
    const control = element as SelectElement | null;
    if (!control?.setAttribute) return undefined;
    const names = ['aria-haspopup', 'aria-controls', 'aria-activedescendant'];
    control.setAttribute(names[0], 'listbox');
    control.setAttribute(names[1], listId);
    if (activeId) control.setAttribute(names[2], activeId);
    else control.removeAttribute(names[2]);
    return () => names.forEach((name) => control.removeAttribute(name));
}
