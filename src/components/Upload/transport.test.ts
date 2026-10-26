import { Platform } from 'react-native';
import { uploadNativeFile, type UploadTransportOptions } from './transport';
import type { UploadNativeFile } from './nativeFiles';

class OwnedXHR {
    static instances: OwnedXHR[] = [];
    status = 200;
    responseText = '{"stored":true}';
    withCredentials = false;
    upload = {
        onprogress: null as null | ((event: { lengthComputable: boolean; loaded: number; total: number }) => void),
    };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    ontimeout: (() => void) | null = null;
    onabort: (() => void) | null = null;
    open = jest.fn((_method: string, _address: string) => {});
    setRequestHeader = jest.fn((_key: string, _value: string) => {});
    send = jest.fn((_body: OwnedFormData) => {});
    abort = jest.fn(() => this.onabort?.());
    constructor() {
        OwnedXHR.instances.push(this);
    }
}
class OwnedFormData {
    entries: Array<[string, unknown, string?]> = [];
    append(key: string, value: unknown, name?: string) {
        this.entries.push([key, value, name]);
    }
}
const globals = globalThis as unknown as { FormData: typeof FormData };
const originalXHR = globalThis.XMLHttpRequest,
    originalFormData = globals.FormData;
beforeEach(() => {
    OwnedXHR.instances = [];
    globalThis.XMLHttpRequest = OwnedXHR as unknown as typeof XMLHttpRequest;
    globals.FormData = OwnedFormData as unknown as typeof FormData;
});
afterEach(() => {
    globalThis.XMLHttpRequest = originalXHR;
    globals.FormData = originalFormData;
    jest.restoreAllMocks();
});
const file: UploadNativeFile = { uri: 'file:///owned/report.txt', name: 'report.txt', type: 'text/plain' };
const options = (extra: Partial<UploadTransportOptions> = {}): UploadTransportOptions => ({
    file,
    signal: new AbortController().signal,
    action: 'https://upload.invalid/files',
    onProgress: jest.fn(),
    onSuccess: jest.fn(),
    onError: jest.fn(),
    ...extra,
});

it('sends native FormData only through the explicitly admitted mocked transport', async () => {
    const config = options({
        method: 'PUT',
        headers: { 'X-Owned-Header': 'test' },
        data: { collection: 'owned' },
        name: 'asset',
        withCredentials: true,
    });
    await uploadNativeFile(config);
    const xhr = OwnedXHR.instances[0];
    expect(xhr.open).toHaveBeenCalledWith('PUT', 'https://upload.invalid/files');
    expect(xhr.withCredentials).toBe(true);
    expect(xhr.setRequestHeader).toHaveBeenCalledWith('X-Owned-Header', 'test');
    const form = xhr.send.mock.calls[0][0] as OwnedFormData;
    expect(form.entries[0]).toEqual(['asset', { uri: file.uri, name: file.name, type: file.type }, undefined]);
    expect(form.entries[1]).toEqual(['collection', 'owned', undefined]);
    expect(config.onSuccess).not.toHaveBeenCalled();
});
it('awaits per-file address and form fields before creating a request', async () => {
    const config = options({
        action: async (selected) => 'https://upload.invalid/' + selected.name,
        data: async () => ({ signed: 'yes' }),
    });
    await uploadNativeFile(config);
    expect(OwnedXHR.instances[0].open).toHaveBeenCalledWith('POST', 'https://upload.invalid/report.txt');
});
it('keeps the admitted descriptor, headers, field values and callback owner across async signing', async () => {
    let resolve!: (address: string) => void;
    const gate = new Promise<string>((done) => {
        resolve = done;
    });
    const selected = { ...file },
        extra = { ...file, uri: 'file:///owned/extra.txt', name: 'extra.txt' };
    const headers = { 'X-Owned-Header': 'before' };
    const data = { collection: 'before', attachment: extra };
    const success = jest.fn(),
        lateSuccess = jest.fn();
    const config = options({ file: selected, headers, data, action: () => gate, onSuccess: success });
    const pending = uploadNativeFile(config);
    selected.uri = 'file:///not-admitted.txt';
    extra.uri = 'file:///not-admitted-extra.txt';
    headers['X-Owned-Header'] = 'after';
    data.collection = 'after';
    config.onSuccess = lateSuccess;
    resolve('https://upload.invalid/files');
    await pending;
    const xhr = OwnedXHR.instances[0],
        form = xhr.send.mock.calls[0][0] as OwnedFormData;
    expect(xhr.setRequestHeader).toHaveBeenCalledWith('X-Owned-Header', 'before');
    expect(form.entries[0][1]).toEqual({ uri: file.uri, name: file.name, type: file.type });
    expect(form.entries[1]).toEqual(['collection', 'before', undefined]);
    expect(form.entries[2][1]).toEqual({ uri: 'file:///owned/extra.txt', name: 'extra.txt', type: file.type });
    xhr.onload?.();
    expect(success).toHaveBeenCalledTimes(1);
    expect(lateSuccess).not.toHaveBeenCalled();
});
it('freezes the descriptor passed to address and form-field owners', async () => {
    const config = options({
        action: (selected) => {
            expect(Object.isFrozen(selected)).toBe(true);
            expect(selected).not.toBe(file);
            return 'https://upload.invalid/files';
        },
        data: (selected) => {
            expect(Object.isFrozen(selected)).toBe(true);
            return { signed: 'yes' };
        },
    });
    await uploadNativeFile(config);
    expect(config.onError).not.toHaveBeenCalled();
});
it('preserves native URI form fields rather than stringifying them', async () => {
    await uploadNativeFile(
        options({ data: { extra: { uri: 'file:///owned/image.jpg', name: 'image.jpg', type: 'image/jpeg' } } })
    );
    const form = OwnedXHR.instances[0].send.mock.calls[0][0] as OwnedFormData;
    expect(form.entries[1]).toEqual([
        'extra',
        { uri: 'file:///owned/image.jpg', name: 'image.jpg', type: 'image/jpeg' },
        undefined,
    ]);
});
it('preserves Web blobs in additional fields without requiring a native URI', async () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(Platform, 'OS')!;
    const globalsWithBlob = globalThis as unknown as { Blob?: typeof Blob };
    const originalBlob = Object.getOwnPropertyDescriptor(globalThis, 'Blob');
    class OwnedBlob {}
    Object.defineProperty(globalThis, 'Blob', { value: OwnedBlob, configurable: true, writable: true });
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    try {
        const blob = new OwnedBlob() as unknown as Blob;
        expect(globalsWithBlob.Blob).toBe(OwnedBlob);
        await uploadNativeFile(options({ file: { ...file, blob }, data: { thumbnail: blob } }));
        const form = OwnedXHR.instances[0].send.mock.calls[0][0] as OwnedFormData;
        expect(form.entries[0]).toEqual(['file', blob, file.name]);
        expect(form.entries[1]).toEqual(['thumbnail', blob, undefined]);
    } finally {
        Object.defineProperty(Platform, 'OS', originalPlatform);
        if (originalBlob) Object.defineProperty(globalThis, 'Blob', originalBlob);
        else delete globalsWithBlob.Blob;
    }
});
it.each(['', 'file:///not-a-transport'])('rejects invalid upload address %s without a request', async (action) => {
    const config = options({ action });
    await uploadNativeFile(config);
    expect(OwnedXHR.instances).toHaveLength(0);
    expect(config.onError).toHaveBeenCalledTimes(1);
});
it('address rejection is a terminal error rather than a zero percent spinner', async () => {
    const config = options({
        action: async () => {
            throw new Error('Owned signing failure');
        },
    });
    await uploadNativeFile(config);
    expect(config.onError).toHaveBeenCalledTimes(1);
    expect(OwnedXHR.instances).toHaveLength(0);
});
it('canceling outstanding address resolution prevents subsequent admission', async () => {
    let resolve!: (address: string) => void;
    const gate = new Promise<string>((done) => {
        resolve = done;
    });
    const controller = new AbortController();
    const config = options({ signal: controller.signal, action: () => gate });
    const pending = uploadNativeFile(config);
    controller.abort();
    resolve('https://upload.invalid/files');
    await pending;
    expect(OwnedXHR.instances).toHaveLength(0);
    expect(config.onSuccess).not.toHaveBeenCalled();
    expect(config.onError).not.toHaveBeenCalled();
});
it('canceling outstanding form fields also prevents request creation', async () => {
    let resolve!: (value: Record<string, unknown>) => void;
    const gate = new Promise<Record<string, unknown>>((done) => {
        resolve = done;
    });
    const controller = new AbortController();
    const pending = uploadNativeFile(options({ signal: controller.signal, data: () => gate }));
    controller.abort();
    resolve({ key: 'owned' });
    await pending;
    expect(OwnedXHR.instances).toHaveLength(0);
});
it('maps actual progress and a single successful response to completion', async () => {
    const config = options();
    await uploadNativeFile(config);
    const xhr = OwnedXHR.instances[0];
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 2, total: 4 });
    expect(config.onProgress).toHaveBeenCalledWith(50);
    xhr.onload?.();
    xhr.onload?.();
    expect(config.onSuccess).toHaveBeenCalledTimes(1);
    expect(config.onSuccess).toHaveBeenCalledWith({ stored: true });
});
it('non-success status produces only failure', async () => {
    const config = options();
    await uploadNativeFile(config);
    const xhr = OwnedXHR.instances[0];
    xhr.status = 500;
    xhr.onload?.();
    expect(config.onError).toHaveBeenCalledTimes(1);
    expect(config.onSuccess).not.toHaveBeenCalled();
});
it('keeps a valid text response', async () => {
    const config = options();
    await uploadNativeFile(config);
    const xhr = OwnedXHR.instances[0];
    xhr.responseText = 'stored';
    xhr.onload?.();
    expect(config.onSuccess).toHaveBeenCalledWith('stored');
});
it('aborts an active transfer once and suppresses late progress and success', async () => {
    const controller = new AbortController();
    const config = options({ signal: controller.signal });
    await uploadNativeFile(config);
    const xhr = OwnedXHR.instances[0];
    controller.abort();
    controller.abort();
    expect(xhr.abort).toHaveBeenCalledTimes(1);
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 4, total: 4 });
    xhr.onload?.();
    expect(config.onProgress).not.toHaveBeenCalled();
    expect(config.onSuccess).not.toHaveBeenCalled();
});
it.each(['onerror', 'ontimeout', 'onabort'] as const)('maps independent %s to failure', async (event) => {
    const config = options();
    await uploadNativeFile(config);
    OwnedXHR.instances[0][event]?.();
    expect(config.onError).toHaveBeenCalledTimes(1);
});
it('an already canceled transfer never creates a transport', async () => {
    const controller = new AbortController();
    controller.abort();
    await uploadNativeFile(options({ signal: controller.signal }));
    expect(OwnedXHR.instances).toHaveLength(0);
});
it('Web action uploads reject a URI without a host-owned blob', async () => {
    const original = Object.getOwnPropertyDescriptor(Platform, 'OS')!;
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    try {
        const config = options();
        await uploadNativeFile(config);
        expect(config.onError).toHaveBeenCalledTimes(1);
        expect(OwnedXHR.instances).toHaveLength(0);
    } finally {
        Object.defineProperty(Platform, 'OS', original);
    }
});
