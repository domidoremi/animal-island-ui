import { resolveThemeTransitionCircle, startWebThemeTransition } from './themeTransitionWeb';

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
afterEach(() => {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
});

it.each([undefined, { x: 0, y: 0 }, { x: 320, y: 800 }, { x: -8, y: 900 }, { x: NaN, y: Infinity }])(
    '扩散半径覆盖全部角落，并限制触点到视口内 (%j)',
    (origin) => {
        const circle = resolveThemeTransitionCircle(320, 800, origin);
        expect(circle.x).toBeGreaterThanOrEqual(0);
        expect(circle.x).toBeLessThanOrEqual(320);
        expect(circle.y).toBeGreaterThanOrEqual(0);
        expect(circle.y).toBeLessThanOrEqual(800);
        for (const x of [0, 320])
            for (const y of [0, 800]) {
                expect(Math.hypot(x - circle.x, y - circle.y)).toBeLessThan(circle.radius);
            }
    }
);

function browser() {
    let finish!: () => void;
    let update!: () => Promise<void>;
    const transition = {
        ready: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
        finished: new Promise<void>((resolve) => {
            finish = resolve;
        }),
        skipTransition: jest.fn(),
    };
    const style = { textContent: '', remove: jest.fn() };
    const doc = {
        visibilityState: 'visible',
        documentElement: { setAttribute: jest.fn(), removeAttribute: jest.fn() },
        createElement: jest.fn(() => style),
        head: { appendChild: jest.fn() },
        startViewTransition: jest.fn((callback: () => Promise<void>) => {
            update = callback;
            return transition;
        }),
    };
    Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
    return { doc, style, transition, finish, update: () => update() };
}

it('使用真实快照 API 和触点圆形裁剪，完成后移除临时样式', async () => {
    const b = browser();
    const update = jest.fn();
    const done = jest.fn();
    const handle = startWebThemeTransition(
        async () => {
            update();
        },
        done,
        { x: 20, y: 30, radius: 900 }
    );
    expect(handle).toBeDefined();
    expect(update).not.toHaveBeenCalled();
    expect(b.style.textContent).toContain('circle(0px at 20px 30px)');
    expect(b.style.textContent).toContain('circle(900px at 20px 30px)');
    await b.update();
    expect(update).toHaveBeenCalledTimes(1);
    b.finish();
    await Promise.resolve();
    expect(done).toHaveBeenCalledTimes(1);
    expect(b.style.remove).toHaveBeenCalledTimes(1);
    expect(b.doc.documentElement.removeAttribute).toHaveBeenCalledWith('data-animal-theme-transition');
});

it('跳过和迟到完成只清理一次，ready 拒绝也有处理', async () => {
    const b = browser();
    b.transition.ready = Promise.reject(new Error('skipped'));
    const done = jest.fn();
    const handle = startWebThemeTransition(async () => {}, done, { x: 0, y: 0, radius: 400 });
    handle!.stop();
    expect(b.transition.skipTransition).toHaveBeenCalledTimes(1);
    b.finish();
    await Promise.resolve();
    expect(b.style.remove).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledTimes(1);
});

it('不可用、隐藏或抛错的快照 API 安全降级', () => {
    Reflect.deleteProperty(globalThis, 'document');
    const update = jest.fn();
    const done = jest.fn();
    const circle = { x: 0, y: 0, radius: 400 };
    expect(startWebThemeTransition(update, done, circle)).toBeUndefined();
    const b = browser();
    b.doc.visibilityState = 'hidden';
    expect(startWebThemeTransition(update, done, circle)).toBeUndefined();
    expect(b.doc.startViewTransition).not.toHaveBeenCalled();
    b.doc.visibilityState = 'visible';
    b.doc.startViewTransition.mockImplementation(() => {
        throw new Error('unsupported');
    });
    expect(startWebThemeTransition(update, done, circle)).toBeUndefined();
    expect(b.style.remove).toHaveBeenCalledTimes(1);
    expect(update).not.toHaveBeenCalled();
});
