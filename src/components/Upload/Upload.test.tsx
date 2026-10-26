import React, { useState } from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import {
    Upload,
    type UploadFile,
    type UploadCustomRequestOptions,
    type UploadNativeFile,
    type UploadChangeParam,
} from './Upload';
import { matchAccept, formatFileSize } from './nativeFiles';

const file = (name = 'one.txt', type = 'text/plain'): UploadNativeFile => ({
    uri: 'file:///owned/' + name,
    name,
    type,
    size: 1024,
});
const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => {
        resolve = done;
    });
    return { promise, resolve };
};
const trigger = (view: Awaited<ReturnType<typeof render>>) => view.getByRole('button', { name: 'Upload files' });
const pick = async (view: Awaited<ReturnType<typeof render>>) => {
    await fireEvent.press(trigger(view));
    await act(async () => undefined);
};

it('requires an explicit host picker and never simulates a transfer', async () => {
    const view = await render(<Upload />);
    expect(trigger(view).props.accessibilityState.disabled).toBe(true);
    expect(view.queryByRole('progressbar')).toBeNull();
});
it('does not call a supplied picker before user activation', async () => {
    const picker = jest.fn(() => [file()]);
    await render(<Upload onPickFiles={picker} />);
    expect(picker).not.toHaveBeenCalled();
});
it('disabled uploads do not invoke the picker', async () => {
    const picker = jest.fn(() => [file()]);
    const view = await render(<Upload disabled onPickFiles={picker} />);
    await pick(view);
    expect(picker).not.toHaveBeenCalled();
});
it('renders native custom trigger and tip content', async () => {
    const view = await render(
        <Upload tip="Safe file selection">
            <Text>Choose report</Text>
        </Upload>
    );
    expect(view.getByText('Choose report')).toBeTruthy();
    expect(view.getByText('Safe file selection')).toBeTruthy();
});
it('forwards directory intent without accessing storage itself', async () => {
    const picker = jest.fn(() => null);
    const view = await render(<Upload onPickFiles={picker} accept=".txt" multiple directory />);
    await pick(view);
    expect(picker).toHaveBeenCalledWith(
        expect.objectContaining({ accept: '.txt', multiple: true, directory: true, signal: expect.anything() })
    );
});
it('picker cancellation makes no file or transport change', async () => {
    const change = jest.fn(),
        request = jest.fn();
    const view = await render(<Upload onPickFiles={() => null} customRequest={request} onChange={change} />);
    await pick(view);
    expect(request).not.toHaveBeenCalled();
    expect(change).not.toHaveBeenCalled();
});
it('picker rejection is retryable and does not start a transfer', async () => {
    const picker = jest
        .fn()
        .mockRejectedValueOnce(new Error('Owned picker unavailable'))
        .mockResolvedValueOnce([file()]);
    const request = jest.fn(),
        error = jest.fn();
    const view = await render(<Upload onPickFiles={picker} customRequest={request} onPickerError={error} />);
    await pick(view);
    expect(view.getByRole('alert')).toBeTruthy();
    expect(request).not.toHaveBeenCalled();
    await pick(view);
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(error).toHaveBeenCalledTimes(1);
});
it('serializes a pending picker and discards its result after unmount', async () => {
    const gate = deferred<UploadNativeFile[]>();
    const picker = jest.fn((_options: unknown) => gate.promise),
        request = jest.fn(),
        change = jest.fn();
    const view = await render(<Upload onPickFiles={picker} customRequest={request} onChange={change} />);
    await pick(view);
    await pick(view);
    expect(picker).toHaveBeenCalledTimes(1);
    await view.unmount();
    await act(() => gate.resolve([file()]));
    expect(request).not.toHaveBeenCalled();
    expect(change).not.toHaveBeenCalled();
    expect((picker.mock.calls[0][0] as { signal: AbortSignal }).signal.aborted).toBe(true);
});
it('disabling while beforeUpload is pending fences late admission', async () => {
    const gate = deferred<boolean>();
    const change = jest.fn(),
        request = jest.fn();
    const props = {
        onPickFiles: () => [file()],
        beforeUpload: () => gate.promise,
        customRequest: request,
        onChange: change,
    };
    const view = await render(<Upload {...props} />);
    await pick(view);
    await view.rerender(<Upload {...props} disabled />);
    await act(() => gate.resolve(true));
    expect(request).not.toHaveBeenCalled();
    expect(change).not.toHaveBeenCalled();
});

it('beforeUpload false skips both list and transport admission', async () => {
    const request = jest.fn(),
        change = jest.fn();
    const view = await render(
        <Upload onPickFiles={() => [file()]} beforeUpload={() => false} customRequest={request} onChange={change} />
    );
    await pick(view);
    expect(request).not.toHaveBeenCalled();
    expect(change).not.toHaveBeenCalled();
});
it('uploads a transformed descriptor while retaining the selected original', async () => {
    const original = file(),
        transformed = file('converted.txt'),
        request = jest.fn(),
        change = jest.fn();
    const view = await render(
        <Upload
            onPickFiles={() => [original]}
            beforeUpload={async () => transformed}
            customRequest={request}
            onChange={change}
        />
    );
    await pick(view);
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(request.mock.calls[0][0].file).toEqual(transformed);
    expect(change.mock.calls[0][0].file.originFileObj).toEqual(original);
    expect(change.mock.calls[0][0].file.name).toBe('converted.txt');
});
it('detaches every selected descriptor before awaiting beforeUpload', async () => {
    const original = file(),
        gate = deferred<boolean>(),
        request = jest.fn(),
        change = jest.fn();
    const view = await render(
        <Upload
            onPickFiles={() => [original]}
            beforeUpload={() => gate.promise}
            customRequest={request}
            onChange={change}
        />
    );
    await pick(view);
    original.uri = 'file:///not-selected.txt';
    original.name = 'not-selected.txt';
    await act(() => gate.resolve(true));
    expect(request.mock.calls[0][0].file).toEqual(file());
    expect(change.mock.calls[0][0].file.originFileObj).toEqual(file());
    expect(view.queryByText('not-selected.txt')).toBeNull();
});
it('the custom request cannot rewrite the original descriptor recorded for the host', async () => {
    const original = file(),
        change = jest.fn();
    const view = await render(
        <Upload
            onPickFiles={() => [original]}
            onChange={change}
            customRequest={(options) => {
                expect(Object.isFrozen(options.file)).toBe(true);
                options.onSuccess();
            }}
        />
    );
    await pick(view);
    expect(change.mock.calls.at(-1)![0].file.originFileObj).toEqual(original);
    expect(view.getByText('1.0 KB Uploaded')).toBeTruthy();
});
it('same-ID size/type changes invalidate an outstanding removal confirmation', async () => {
    const gate = deferred<boolean>(),
        change = jest.fn();
    const original: UploadFile = { uid: 'owned', name: 'one.txt', size: 1024, type: 'text/plain', status: 'done' };
    const view = await render(<Upload fileList={[original]} onRemove={() => gate.promise} onChange={change} />);
    await fireEvent.press(view.getByRole('button', { name: 'Remove one.txt' }));
    await view.rerender(
        <Upload
            fileList={[{ ...original, size: 4096, type: 'text/html' }]}
            onRemove={() => gate.promise}
            onChange={change}
        />
    );
    await act(() => gate.resolve(true));
    expect(change).not.toHaveBeenCalled();
    expect(view.getByText('one.txt')).toBeTruthy();
});
it('rejects invalid descriptors and enforces accept on the original file', async () => {
    const request = jest.fn();
    const view = await render(
        <Upload
            accept=".txt"
            onPickFiles={() => [file('one.png', 'image/png'), { ...file('bad.txt'), uri: '' }, file()]}
            multiple
            customRequest={request}
        />
    );
    await pick(view);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0].file.name).toBe('one.txt');
});
it('records real error rather than simulated success when no transport exists', async () => {
    const change = jest.fn();
    const view = await render(<Upload onPickFiles={() => [file()]} onChange={change} />);
    await pick(view);
    await waitFor(() => expect(view.getByText('1.0 KB Upload failed')).toBeTruthy());
    expect((change.mock.calls.at(-1)![0] as UploadChangeParam).file.status).toBe('error');
    expect(view.queryByText('1.0 KB Uploaded')).toBeNull();
});
it('reports actual progress, terminal success and ignores duplicate late callbacks', async () => {
    let request!: UploadCustomRequestOptions;
    const change = jest.fn();
    const view = await render(
        <Upload
            onPickFiles={() => [file()]}
            customRequest={(options) => {
                request = options;
            }}
            onChange={change}
        />
    );
    await pick(view);
    await act(() => request.onProgress(43));
    expect(view.getByRole('progressbar').props.accessibilityValue.now).toBe(43);
    await act(() => request.onSuccess({ stored: true }));
    expect(view.queryByRole('progressbar')).toBeNull();
    const last = change.mock.calls.length;
    await act(() => {
        request.onProgress(1);
        request.onError('late');
        request.onSuccess('duplicate');
    });
    expect(change).toHaveBeenCalledTimes(last);
    expect(view.getByText('1.0 KB Uploaded')).toBeTruthy();
});
it('maps custom transport throw to real failure', async () => {
    const view = await render(
        <Upload
            onPickFiles={() => [file()]}
            customRequest={() => {
                throw new Error('Owned transport failed');
            }}
        />
    );
    await pick(view);
    expect(view.getByText('1.0 KB Upload failed')).toBeTruthy();
});
it('clamps finite progress and ignores NaN', async () => {
    let request!: UploadCustomRequestOptions;
    const view = await render(
        <Upload
            onPickFiles={() => [file()]}
            customRequest={(options) => {
                request = options;
            }}
        />
    );
    await pick(view);
    await act(() => request.onProgress(999));
    expect(view.getByRole('progressbar').props.accessibilityValue.now).toBe(100);
    await act(() => request.onProgress(-1));
    expect(view.getByRole('progressbar').props.accessibilityValue.now).toBe(0);
    await act(() => request.onProgress(NaN));
    expect(view.getByRole('progressbar').props.accessibilityValue.now).toBe(0);
});
it('maxCount one replaces and cancels the old in-flight upload', async () => {
    const abort = jest.fn(),
        exceeded = jest.fn();
    const requests: UploadCustomRequestOptions[] = [];
    let selected = file('one.txt');
    const view = await render(
        <Upload
            maxCount={1}
            onPickFiles={() => [selected]}
            onExceed={exceeded}
            customRequest={(options) => {
                requests.push(options);
                return { abort };
            }}
        />
    );
    await pick(view);
    selected = file('two.txt');
    await pick(view);
    expect(abort).toHaveBeenCalledTimes(1);
    expect(requests[0].signal.aborted).toBe(true);
    expect(view.queryByText('one.txt')).toBeNull();
    expect(view.getByText('two.txt')).toBeTruthy();
    expect(exceeded).not.toHaveBeenCalled();
});
it('larger maxCount keeps earliest files and reports only discarded originals', async () => {
    const exceeded = jest.fn(),
        request = jest.fn();
    const view = await render(
        <Upload
            maxCount={2}
            multiple
            onPickFiles={() => [file('one.txt'), file('two.txt'), file('three.txt')]}
            onExceed={exceeded}
            customRequest={request}
        />
    );
    await pick(view);
    expect(request).toHaveBeenCalledTimes(2);
    expect(exceeded).toHaveBeenCalledWith([file('three.txt')], expect.any(Array));
    expect(view.queryByText('three.txt')).toBeNull();
});
it('onRemove veto keeps the file and its active request', async () => {
    const abort = jest.fn();
    const view = await render(
        <Upload onPickFiles={() => [file()]} customRequest={() => ({ abort })} onRemove={() => false} />
    );
    await pick(view);
    await fireEvent.press(view.getByRole('button', { name: 'Remove one.txt' }));
    expect(view.getByText('one.txt')).toBeTruthy();
    expect(abort).not.toHaveBeenCalled();
});
it('committed removal aborts once and ignores late transport writes', async () => {
    let request!: UploadCustomRequestOptions;
    const abort = jest.fn(),
        change = jest.fn();
    const view = await render(
        <Upload
            onPickFiles={() => [file()]}
            customRequest={(options) => {
                request = options;
                return { abort };
            }}
            onChange={change}
        />
    );
    await pick(view);
    await fireEvent.press(view.getByRole('button', { name: 'Remove one.txt' }));
    await waitFor(() => expect(view.queryByText('one.txt')).toBeNull());
    expect(abort).toHaveBeenCalledTimes(1);
    const last = change.mock.calls.length;
    await act(() => request.onSuccess());
    expect(change).toHaveBeenCalledTimes(last);
    expect(change.mock.calls.at(-1)![0].file.status).toBe('removed');
});
it('a changed controlled file invalidates outstanding removal confirmation', async () => {
    const gate = deferred<boolean>(),
        change = jest.fn();
    const first: UploadFile = { uid: 'owned', name: 'one.txt', status: 'done', url: 'file:///one.txt' };
    const view = await render(<Upload fileList={[first]} onRemove={() => gate.promise} onChange={change} />);
    await fireEvent.press(view.getByRole('button', { name: 'Remove one.txt' }));
    await view.rerender(
        <Upload fileList={[{ ...first, name: 'changed.txt' }]} onRemove={() => gate.promise} onChange={change} />
    );
    await act(() => gate.resolve(true));
    expect(change).not.toHaveBeenCalled();
    expect(view.getByText('changed.txt')).toBeTruthy();
});
it('supports actual controlled owner writeback', async () => {
    function Owner() {
        const [files, setFiles] = useState<UploadFile[]>([]);
        return (
            <Upload
                fileList={files}
                onChange={(info) => setFiles(info.fileList)}
                onPickFiles={() => [file()]}
                customRequest={(options) => options.onSuccess()}
            />
        );
    }
    const view = await render(<Owner />);
    await pick(view);
    expect(view.getByText('one.txt')).toBeTruthy();
    expect(view.getByText('1.0 KB Uploaded')).toBeTruthy();
});
it('unmount fences the native transport and calls its abort handle once', async () => {
    const gates: UploadCustomRequestOptions[] = [],
        abort = jest.fn();
    function Owner() {
        const [files, setFiles] = useState<UploadFile[]>([]);
        return (
            <Upload
                fileList={files}
                onChange={(info) => setFiles(info.fileList)}
                onPickFiles={() => [file()]}
                customRequest={(options) => {
                    gates.push(options);
                    return { abort };
                }}
            />
        );
    }
    const view = await render(<Owner />);
    await pick(view);
    await view.unmount();
    expect(gates[0].signal.aborted).toBe(true);
    expect(abort).toHaveBeenCalledTimes(1);
    await act(() => gates[0].onSuccess());
});
it.each(['text', 'picture', 'picture-card'] as const)(
    'renders native %s preview without owning the source URI',
    async (listType) => {
        const initial: UploadFile = {
            uid: 'image',
            name: 'photo.png',
            type: 'image/png',
            thumbUrl: 'file:///owned/photo.png',
            status: 'done',
        };
        const view = await render(<Upload fileList={[initial]} listType={listType} />);
        await fireEvent.press(view.getByRole('button', { name: 'Preview photo.png' }));
        expect(view.getByRole('button', { name: 'Close preview' })).toBeTruthy();
        await fireEvent.press(view.getByRole('button', { name: 'Close preview' }));
        expect(view.queryByRole('button', { name: 'Close preview' })).toBeNull();
        expect(initial.thumbUrl).toBe('file:///owned/photo.png');
    }
);
it('honors an explicit preview callback and list action visibility', async () => {
    const initial: UploadFile = { uid: 'image', name: 'photo.png', url: 'file:///owned/photo.png', status: 'done' },
        preview = jest.fn();
    const view = await render(
        <Upload fileList={[initial]} onPreview={preview} showUploadList={{ showRemoveIcon: false }} />
    );
    expect(view.queryByRole('button', { name: 'Remove photo.png' })).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Preview photo.png' }));
    expect(preview).toHaveBeenCalledWith(initial);
    await view.rerender(<Upload fileList={[initial]} showUploadList={false} />);
    expect(view.queryByText('photo.png')).toBeNull();
});
it.each([
    ['image/*', 'x.png', 'image/png', true],
    ['.txt', 'x.TXT', '', true],
    ['.pdf', 'x.txt', 'text/plain', false],
    ['text/plain', 'x.txt', 'text/plain', true],
] as const)('matches native accept %s', (accept, name, type, expected) => {
    expect(matchAccept(file(name, type), accept)).toBe(expected);
});
it('formats native sizes without reading file bytes', () => {
    expect(formatFileSize()).toBe('');
    expect(formatFileSize(12)).toBe('12 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(1048576)).toBe('1.0 MB');
});
