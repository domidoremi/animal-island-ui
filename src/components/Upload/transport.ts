import { Platform } from 'react-native';
import {
    isFileBlob,
    snapshotFormFields,
    snapshotNativeFile,
    validNativeFile,
    type UploadNativeFile,
} from './nativeFiles';

export interface UploadTransportOptions {
    file: UploadNativeFile;
    signal: AbortSignal;
    action: string | ((file: UploadNativeFile) => string | Promise<string>);
    method?: 'POST' | 'PUT' | 'PATCH';
    headers?: Record<string, string>;
    data?:
        | Record<string, unknown>
        | ((
              file: UploadNativeFile
          ) => Record<string, unknown> | undefined | Promise<Record<string, unknown> | undefined>);
    name?: string;
    withCredentials?: boolean;
    onProgress: (percent: number) => void;
    onSuccess: (response?: unknown) => void;
    onError: (error?: unknown) => void;
}

/** Effects start only after explicit selection and admission; no simulated success path. */
export async function uploadNativeFile(options: UploadTransportOptions): Promise<void> {
    const { signal } = options;
    // Signing/data callbacks may await; the admitted URI, headers and callback owners must not drift meanwhile.
    const {
        action: addressSource,
        method = 'POST',
        name = 'file',
        withCredentials = false,
        onProgress,
        onSuccess,
        onError,
    } = options;
    let xhr: XMLHttpRequest | undefined;
    let settled = false;
    const abort = () => {
        settled = true;
        signal.removeEventListener('abort', abort);
        xhr?.abort();
    };
    signal.addEventListener('abort', abort, { once: true });
    const finish = (success: boolean, value?: unknown) => {
        if (settled || signal.aborted) return;
        settled = true;
        signal.removeEventListener('abort', abort);
        if (success) onSuccess(value);
        else onError(value);
    };
    try {
        if (signal.aborted) return;
        if (!validNativeFile(options.file)) throw new Error('A valid host-owned file descriptor is required.');
        const file = snapshotNativeFile(options.file);
        const headers = { ...options.headers };
        const dataSource = typeof options.data === 'function' ? options.data : snapshotFormFields(options.data);
        const action = typeof addressSource === 'function' ? await addressSource(file) : addressSource;
        if (signal.aborted) return;
        if (!/^https?:\/\//i.test(action)) throw new Error('An HTTP(S) upload address is required.');
        const data = typeof dataSource === 'function' ? snapshotFormFields(await dataSource(file)) : dataSource;
        if (signal.aborted) return;
        const body = new FormData();
        const append = body as unknown as { append(key: string, value: unknown, filename?: string): void };
        if (Platform.OS === 'web') {
            if (!file.blob) throw new Error('The Web picker must supply the file blob for an action upload.');
            append.append(name, file.blob, file.name);
        } else append.append(name, { uri: file.uri, name: file.name, type: file.type ?? 'application/octet-stream' });
        for (const [key, value] of Object.entries(data ?? {})) {
            if (isFileBlob(value)) {
                if (Platform.OS !== 'web')
                    throw new Error('Native form file fields require a host-owned URI descriptor.');
                append.append(key, value);
            } else if (value && typeof value === 'object' && validNativeFile(value as UploadNativeFile)) {
                const field = value as UploadNativeFile;
                if (Platform.OS === 'web') {
                    if (!field.blob) throw new Error('Web form file fields require a host-owned blob.');
                    append.append(key, field.blob, field.name);
                } else
                    append.append(key, {
                        uri: field.uri,
                        name: field.name,
                        type: field.type ?? 'application/octet-stream',
                    });
            } else append.append(key, String(value));
        }
        if (signal.aborted) return;
        xhr = new XMLHttpRequest();
        xhr.open(method, action);
        xhr.withCredentials = withCredentials;
        for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value);
        xhr.upload.onprogress = (event) => {
            if (!settled && !signal.aborted && event.lengthComputable && event.total > 0)
                onProgress((event.loaded / event.total) * 100);
        };
        xhr.onload = () => {
            if (!xhr) return;
            let response: unknown = xhr.responseText;
            try {
                response = JSON.parse(xhr.responseText);
            } catch {
                /* Text responses remain valid. */
            }
            finish(xhr.status >= 200 && xhr.status < 300, response);
        };
        xhr.onerror = () => finish(false, new Error('Upload transport failed.'));
        xhr.ontimeout = () => finish(false, new Error('Upload transport timed out.'));
        xhr.onabort = () => {
            if (!signal.aborted) finish(false, new Error('Upload transport canceled.'));
            else signal.removeEventListener('abort', abort);
        };
        if (!signal.aborted) xhr.send(body);
    } catch (error) {
        finish(false, error);
    } finally {
        if (signal.aborted) signal.removeEventListener('abort', abort);
    }
}
