// Structural browser types keep the native entry independent of the DOM type library.
interface RadioElement {
    getAttribute(name: string): string | null;
    setAttribute(name: string, value: string): void;
    removeAttribute(name: string): void;
    closest(selector: string): unknown;
    getClientRects(): { length: number };
    focus(): void;
    click(): void;
    disabled?: boolean;
    tagName?: string;
}
interface GroupEvent {
    target: unknown;
    key?: string;
    defaultPrevented?: boolean;
    isComposing?: boolean;
    altKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    preventDefault(): void;
    stopPropagation(): void;
}
interface GroupElement {
    querySelectorAll(selector: string): ArrayLike<RadioElement>;
    addEventListener(type: string, listener: (event: GroupEvent) => void): void;
    removeEventListener(type: string, listener: (event: GroupEvent) => void): void;
    ownerDocument: {
        activeElement: unknown;
        defaultView?: {
            getComputedStyle?(element: GroupElement): { direction: string };
            MutationObserver?: new (callback: () => void) => {
                observe(element: GroupElement, options: object): void;
                disconnect(): void;
            };
        };
    };
}

/** Delegates activation to the existing radio press handler; never mutates checked state. */
export function attachRadioGroupKeyboard(element: unknown): (() => void) | undefined {
    const group = element as GroupElement | null;
    if (!group?.querySelectorAll || !group.ownerDocument || !group.addEventListener) return undefined;
    const doc = group.ownerDocument;
    const originals = new Map<RadioElement, { original: string | null; assigned: string }>();
    let stopped = false;
    let spaceTarget: RadioElement | undefined;
    const options = () =>
        Array.from(group.querySelectorAll('[role="radio"]')).filter(
            (radio) => radio.closest('[role="radiogroup"]') === group
        );
    const available = (radio: RadioElement) =>
        !radio.disabled &&
        radio.getAttribute('aria-disabled') !== 'true' &&
        !radio.closest('[hidden], [aria-hidden="true"], [inert]') &&
        radio.getClientRects().length > 0;
    const assign = (radio: RadioElement, value: string) => {
        if (!originals.has(radio)) originals.set(radio, { original: radio.getAttribute('tabindex'), assigned: value });
        originals.get(radio)!.assigned = value;
        if (radio.getAttribute('tabindex') !== value) radio.setAttribute('tabindex', value);
    };
    const restore = (radio: RadioElement, state: { original: string | null; assigned: string }) => {
        if (radio.getAttribute('tabindex') !== state.assigned) return;
        if (state.original === null) radio.removeAttribute('tabindex');
        else radio.setAttribute('tabindex', state.original);
    };
    const sync = () => {
        if (stopped) return;
        const radios = options();
        for (const [radio, state] of originals) {
            if (radios.includes(radio)) continue;
            restore(radio, state);
            originals.delete(radio);
        }
        const enabled = radios.filter(available);
        const focused = enabled.find((radio) => radio === doc.activeElement);
        const entry = focused ?? enabled.find((radio) => radio.getAttribute('aria-checked') === 'true') ?? enabled[0];
        radios.forEach((radio) => assign(radio, radio === entry ? '0' : '-1'));
        // If a focused option becomes disabled, keep navigation inside this group.
        // Changes to an inactive group must never steal focus from another control.
        if (entry && !focused && radios.some((radio) => radio === doc.activeElement)) entry.focus();
    };
    const keydown = (event: GroupEvent) => {
        if (
            event.defaultPrevented ||
            event.isComposing ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey
        )
            return;
        const enabled = options().filter(available);
        // Do not consume arrows in nested inputs, links, buttons or radio groups.
        const index = enabled.findIndex((radio) => radio === event.target);
        if (index < 0) return;
        if (event.key === ' ' || event.key === 'Spacebar') {
            // RN Web handles Space for buttons, but not DIVs with role=radio.
            // Leave genuine HTML controls to their native keyboard behavior.
            if (['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A'].includes(enabled[index].tagName ?? '')) return;
            event.preventDefault();
            event.stopPropagation();
            spaceTarget = enabled[index];
            return;
        }
        spaceTarget = undefined;
        const rtl = doc.defaultView?.getComputedStyle?.(group).direction === 'rtl';
        let next: number;
        switch (event.key) {
            case 'ArrowRight':
                next = index + (rtl ? -1 : 1);
                break;
            case 'ArrowLeft':
                next = index + (rtl ? 1 : -1);
                break;
            case 'ArrowDown':
                next = index + 1;
                break;
            case 'ArrowUp':
                next = index - 1;
                break;
            case 'Home':
                next = 0;
                break;
            case 'End':
                next = enabled.length - 1;
                break;
            default:
                return;
        }
        event.preventDefault();
        event.stopPropagation();
        const target = enabled[(next + enabled.length) % enabled.length];
        target.focus();
        sync();
        if (target !== enabled[index] && target === doc.activeElement && available(target)) target.click();
    };
    const keyup = (event: GroupEvent) => {
        if (event.key !== ' ' && event.key !== 'Spacebar') return;
        const target = spaceTarget;
        spaceTarget = undefined;
        if (!target || event.defaultPrevented) return;
        event.preventDefault();
        event.stopPropagation();
        if (
            target === event.target &&
            target === doc.activeElement &&
            options().includes(target) &&
            available(target) &&
            !event.isComposing &&
            !event.altKey &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.shiftKey &&
            target.getAttribute('aria-checked') !== 'true'
        )
            target.click();
    };
    const focusout = () => {
        spaceTarget = undefined;
        // focusout fires before activeElement moves; return Tab entry to the
        // checked option only after the user has actually left the group.
        Promise.resolve().then(sync);
    };
    const observer = doc.defaultView?.MutationObserver ? new doc.defaultView.MutationObserver(sync) : undefined;
    group.addEventListener('keydown', keydown);
    group.addEventListener('keyup', keyup);
    group.addEventListener('focusin', sync);
    group.addEventListener('focusout', focusout);
    observer?.observe(group, {
        subtree: true,
        childList: true,
        attributes: true,
        // Avoid observing animated styles: color/transform frames are not navigation changes.
        attributeFilter: [
            'role',
            'aria-checked',
            'aria-disabled',
            'disabled',
            'hidden',
            'aria-hidden',
            'inert',
            'tabindex',
        ],
    });
    sync();
    return () => {
        stopped = true;
        spaceTarget = undefined;
        observer?.disconnect();
        group.removeEventListener('keydown', keydown);
        group.removeEventListener('keyup', keyup);
        group.removeEventListener('focusin', sync);
        group.removeEventListener('focusout', focusout);
        for (const [radio, state] of originals) restore(radio, state);
        originals.clear();
    };
}
