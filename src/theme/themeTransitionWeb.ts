// Structural browser types keep the native package free of a DOM lib dependency.
type BrowserTransition = {
    finished: Promise<void>;
    ready: Promise<void>;
    updateCallbackDone: Promise<void>;
    skipTransition(): void;
};
type TransitionStyle = { textContent: string; remove(): void };
type TransitionDocument = {
    visibilityState?: string;
    documentElement: { setAttribute(name: string, value: string): void; removeAttribute(name: string): void };
    head: { appendChild(style: TransitionStyle): void };
    createElement(tag: 'style'): TransitionStyle;
    startViewTransition?: (update: () => Promise<void>) => BrowserTransition;
};

export function resolveThemeTransitionCircle(width: number, height: number, origin?: { x: number; y: number }) {
    const x = Number.isFinite(origin?.x) ? Math.max(0, Math.min(width, origin!.x)) : width / 2;
    const y = Number.isFinite(origin?.y) ? Math.max(0, Math.min(height, origin!.y)) : height / 2;
    return { x, y, radius: Math.hypot(Math.max(x, width - x), Math.max(y, height - y)) + 2 };
}

/** Snapshot reveal: never mounts a second application tree or takes a JS screenshot. */
export function startWebThemeTransition(
    update: () => Promise<void>,
    done: () => void,
    circle: ReturnType<typeof resolveThemeTransitionCircle>
): { stop(): void } | undefined {
    const doc = (globalThis as typeof globalThis & { document?: TransitionDocument }).document;
    if (!doc?.startViewTransition || doc.visibilityState === 'hidden') return undefined;
    const style = doc.createElement('style');
    const scope = ':root[data-animal-theme-transition]';
    style.textContent = `
        ${scope}::view-transition { pointer-events: none; }
        ${scope}::view-transition-group(root), ${scope}::view-transition-old(root) { animation: none; }
        ${scope}::view-transition-image-pair(root) { isolation: auto; }
        ${scope}::view-transition-old(root) { z-index: 1; mix-blend-mode: normal; }
        ${scope}::view-transition-new(root) {
            z-index: 2; mix-blend-mode: normal;
            animation: animal-theme-reveal 340ms cubic-bezier(0.4, 0, 0.2, 1) both;
        }
        @keyframes animal-theme-reveal {
            from { clip-path: circle(0px at ${circle.x}px ${circle.y}px); }
            to { clip-path: circle(${circle.radius}px at ${circle.x}px ${circle.y}px); }
        }
    `;
    let cleaned = false;
    const clean = () => {
        if (cleaned) return;
        cleaned = true;
        style.remove();
        doc.documentElement.removeAttribute('data-animal-theme-transition');
    };
    try {
        doc.head.appendChild(style);
        doc.documentElement.setAttribute('data-animal-theme-transition', 'reveal');
        const transition = doc.startViewTransition(update);
        // Hidden documents / interrupted snapshots can reject ready independently.
        transition.ready.catch(() => undefined);
        transition.updateCallbackDone.catch(() => undefined);
        transition.finished.then(
            () => {
                clean();
                done();
            },
            () => {
                clean();
                done();
            }
        );
        return {
            stop() {
                clean();
                transition.skipTransition();
            },
        };
    } catch {
        clean();
        return undefined;
    }
}
