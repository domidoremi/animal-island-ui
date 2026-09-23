import { attachRadioGroupKeyboard } from './radioGroupWeb';

function harness() {
    const listeners = new Map<string, (event: any) => void>();
    let notify = () => {};
    const disconnect = jest.fn();
    const doc = {
        activeElement: null as unknown,
        defaultView: {
            getComputedStyle: () => ({ direction: 'ltr' }),
            MutationObserver: class {
                constructor(callback: () => void) {
                    notify = callback;
                }
                observe = jest.fn();
                disconnect = disconnect;
            },
        },
    };
    const group = {
        ownerDocument: doc,
        querySelectorAll: () => radios,
        addEventListener: (name: string, callback: (event: any) => void) => listeners.set(name, callback),
        removeEventListener: (name: string) => listeners.delete(name),
    };
    const makeRadio = (checked = false, disabled = false) => {
        const attrs: Record<string, string> = {
            tabindex: '0',
            'aria-checked': String(checked),
            'aria-disabled': String(disabled),
        };
        const radio = {
            attrs,
            disabled: false,
            tagName: 'DIV',
            hidden: false,
            rectCount: 1,
            group: group as unknown,
            getAttribute: (name: string) => attrs[name] ?? null,
            setAttribute: jest.fn((name: string, value: string) => {
                attrs[name] = value;
            }),
            removeAttribute: (name: string) => {
                delete attrs[name];
            },
            closest: (selector: string) =>
                selector === '[role="radiogroup"]' ? radio.group : radio.hidden ? {} : null,
            getClientRects: () => ({ length: radio.rectCount }),
            focus: jest.fn(() => {
                doc.activeElement = radio;
                listeners.get('focusin')?.({ target: radio });
            }),
            click: jest.fn(),
        };
        return radio;
    };
    const radios = [makeRadio(), makeRadio(true), makeRadio(false, true), makeRadio()];
    const key = (keyName: string, target: unknown = doc.activeElement, extra = {}, type = 'keydown') => {
        const event = { key: keyName, target, preventDefault: jest.fn(), stopPropagation: jest.fn(), ...extra };
        listeners.get(type)?.(event);
        return event;
    };
    const start = () => attachRadioGroupKeyboard(group)!;
    const tabs = () => radios.map((radio) => radio.attrs.tabindex);
    return { group, doc, radios, makeRadio, key, start, tabs, listeners, notify: () => notify(), disconnect };
}

it('只给已选且可用的选项一个 Tab 入口，不移动焦点或更改已选值', () => {
    const h = harness();
    const outside = {};
    h.doc.activeElement = outside;
    h.start();
    expect(h.tabs()).toEqual(['-1', '0', '-1', '-1']);
    expect(h.doc.activeElement).toBe(outside);
    expect(h.radios.every((r) => r.click.mock.calls.length === 0)).toBe(true);
});

it('没有可用选中项时选第一个 Tab 入口；全禁用时没有入口', () => {
    const h = harness();
    h.radios[1].attrs['aria-disabled'] = 'true';
    h.start();
    expect(h.tabs()).toEqual(['0', '-1', '-1', '-1']);
    h.radios.forEach((r) => {
        r.disabled = true;
    });
    h.notify();
    expect(h.tabs()).toEqual(['-1', '-1', '-1', '-1']);
    expect(h.key('ArrowRight', h.radios[0]).preventDefault).not.toHaveBeenCalled();
});

it('方向键跳过禁用项、首尾循环，且单次调用原有激活操作', () => {
    const h = harness();
    h.start();
    h.radios[1].focus();
    const right = h.key('ArrowRight');
    expect(right.preventDefault).toHaveBeenCalledTimes(1);
    expect(right.stopPropagation).toHaveBeenCalledTimes(1);
    expect(h.doc.activeElement).toBe(h.radios[3]);
    expect(h.radios[3].click).toHaveBeenCalledTimes(1);
    // Activation can be deferred by a theme transition. The next key follows
    // actual focus, not the still-selected previous item.
    expect(h.radios[1].attrs['aria-checked']).toBe('true');
    h.key('ArrowDown');
    expect(h.doc.activeElement).toBe(h.radios[0]);
    h.key('ArrowUp');
    expect(h.doc.activeElement).toBe(h.radios[3]);
    h.key('ArrowLeft');
    expect(h.doc.activeElement).toBe(h.radios[1]);
    expect(h.radios[2].click).not.toHaveBeenCalled();
});

it('Home/End 定位首尾；仅一个可用项时不触发重复更新', () => {
    const h = harness();
    h.start();
    h.radios[1].focus();
    h.key('End');
    expect(h.doc.activeElement).toBe(h.radios[3]);
    h.key('Home');
    expect(h.doc.activeElement).toBe(h.radios[0]);
    h.radios.slice(1).forEach((r) => {
        r.hidden = true;
    });
    h.notify();
    h.radios[0].click.mockClear();
    h.key('ArrowRight');
    h.key('Home');
    expect(h.radios[0].click).not.toHaveBeenCalled();
});

it('RTL 反转横向键而不反转上下键', () => {
    const h = harness();
    h.doc.defaultView.getComputedStyle = () => ({ direction: 'rtl' });
    h.start();
    h.radios[1].focus();
    h.key('ArrowRight');
    expect(h.doc.activeElement).toBe(h.radios[0]);
    h.key('ArrowLeft');
    expect(h.doc.activeElement).toBe(h.radios[1]);
    h.key('ArrowDown');
    expect(h.doc.activeElement).toBe(h.radios[3]);
});

it('跳过隐藏元素并隔离嵌套组和嵌套文本输入', () => {
    const h = harness();
    h.radios[3].hidden = true;
    const nested = h.makeRadio();
    nested.group = {};
    h.radios.push(nested);
    h.start();
    expect(nested.attrs.tabindex).toBe('0');
    h.radios[1].focus();
    h.key('ArrowRight');
    expect(h.doc.activeElement).toBe(h.radios[0]);
    expect(h.key('ArrowLeft', {}).preventDefault).not.toHaveBeenCalled();
    expect(h.key('ArrowRight', nested).preventDefault).not.toHaveBeenCalled();
    h.radios[0].rectCount = 0;
    h.notify();
    expect(h.tabs()[0]).toBe('-1');
});

it.each([
    { altKey: true },
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { isComposing: true },
    { defaultPrevented: true },
])('不截获辅助键、输入法或已处理的按键 (%j)', (extra) => {
    const h = harness();
    h.start();
    h.radios[1].focus();
    expect(h.key('ArrowRight', h.radios[1], extra).preventDefault).not.toHaveBeenCalled();
    expect(h.doc.activeElement).toBe(h.radios[1]);
});

it('Tab 和 Enter 保留给浏览器和 Pressable，不重复激活', () => {
    const h = harness();
    h.start();
    h.radios[1].focus();
    for (const key of ['Tab', 'Enter', 'Escape']) expect(h.key(key).preventDefault).not.toHaveBeenCalled();
    expect(h.radios[1].click).not.toHaveBeenCalled();
});

it('自定义 radio 的 Space 防止滚动，在松开时激活一次，已选项不重复更新', () => {
    const h = harness();
    h.start();
    const target = h.radios[0];
    target.focus();
    expect(h.key(' ').preventDefault).toHaveBeenCalledTimes(1);
    h.key(' ', target, { repeat: true });
    expect(target.click).not.toHaveBeenCalled();
    h.key(' ', target, {}, 'keyup');
    expect(target.click).toHaveBeenCalledTimes(1);
    target.attrs['aria-checked'] = 'true';
    h.key(' ');
    h.key(' ', target, {}, 'keyup');
    expect(target.click).toHaveBeenCalledTimes(1);
});

it('真正的 HTML 控件保留原生 Space 行为，不额外模拟点击', () => {
    const h = harness();
    h.start();
    for (const tagName of ['BUTTON', 'INPUT']) {
        h.radios[0].tagName = tagName;
        h.radios[0].focus();
        expect(h.key(' ').preventDefault).not.toHaveBeenCalled();
        h.key(' ', h.radios[0], {}, 'keyup');
    }
    expect(h.radios[0].click).not.toHaveBeenCalled();
});

it('Space 松开前失焦或禁用会取消激活', () => {
    const h = harness();
    h.start();
    const target = h.radios[0];
    target.focus();
    h.key(' ');
    h.listeners.get('focusout')!({ target });
    h.doc.activeElement = {};
    h.key(' ', target, {}, 'keyup');
    target.focus();
    h.key(' ');
    target.disabled = true;
    h.key(' ', target, {}, 'keyup');
    expect(target.click).not.toHaveBeenCalled();
});

it('焦点处理函数立即禁用目标时，不继续执行该选项的激活操作', () => {
    const h = harness();
    h.start();
    h.radios[1].focus();
    const target = h.radios[3];
    target.focus.mockImplementation(() => {
        h.doc.activeElement = target;
        target.disabled = true;
    });
    h.key('ArrowRight');
    expect(target.click).not.toHaveBeenCalled();
    expect(h.doc.activeElement).toBe(h.radios[1]);
});

it('离开组后 Tab 入口回到已选项，外部更新不窃取焦点', async () => {
    const h = harness();
    h.start();
    h.radios[3].focus();
    expect(h.tabs()[3]).toBe('0');
    h.listeners.get('focusout')!({});
    const outside = {};
    h.doc.activeElement = outside;
    await Promise.resolve();
    expect(h.tabs()).toEqual(['-1', '0', '-1', '-1']);
    h.radios[1].attrs['aria-checked'] = 'false';
    h.radios[0].attrs['aria-checked'] = 'true';
    h.notify();
    expect(h.tabs()).toEqual(['0', '-1', '-1', '-1']);
    expect(h.doc.activeElement).toBe(outside);
});

it('当前焦点被禁用时迁移到可用项；移除和新增选项会重新同步', () => {
    const h = harness();
    h.start();
    h.radios[1].focus();
    h.radios[1].attrs['aria-disabled'] = 'true';
    h.notify();
    expect(h.doc.activeElement).toBe(h.radios[0]);
    const removed = h.radios.pop()!;
    h.notify();
    expect(removed.attrs.tabindex).toBe('0');
    const added = h.makeRadio();
    h.radios.push(added);
    h.notify();
    expect(added.attrs.tabindex).toBe('-1');
});

it('清理监听器、观察器与 Tab 修改，迟到事件不再改变节点', async () => {
    const h = harness();
    delete h.radios[0].attrs.tabindex;
    const stop = h.start();
    h.listeners.get('focusout')!({});
    h.radios[3].attrs.tabindex = '7'; // preserve a later external owner
    stop();
    await Promise.resolve();
    h.notify();
    expect(h.listeners.size).toBe(0);
    expect(h.disconnect).toHaveBeenCalledTimes(1);
    expect(h.tabs()).toEqual([undefined, '0', '0', '7']);
});

it('原生宿主或缺少 DOM 接口时不安装浏览器行为', () => {
    expect(attachRadioGroupKeyboard(null)).toBeUndefined();
    expect(attachRadioGroupKeyboard({})).toBeUndefined();
});
