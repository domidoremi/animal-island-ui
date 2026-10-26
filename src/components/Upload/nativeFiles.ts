export interface UploadNativeFile {
    /** URI owned by the host picker; the library never deletes or revokes it. */
    uri: string;
    name: string;
    size?: number;
    type?: string;
    /** Required for action uploads on Web; native uploads use the URI. */
    blob?: Blob;
}

export function snapshotNativeFile(file: UploadNativeFile): UploadNativeFile {
    return Object.freeze({
        uri: file.uri,
        name: file.name,
        ...(file.size === undefined ? {} : { size: file.size }),
        ...(file.type === undefined ? {} : { type: file.type }),
        ...(file.blob === undefined ? {} : { blob: file.blob }),
    });
}

export function isFileBlob(value: unknown): value is Blob {
    const constructor = (globalThis as unknown as { Blob?: typeof Blob }).Blob;
    return typeof constructor === 'function' && value instanceof constructor;
}

export function snapshotFormFields(fields: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
    if (!fields) return fields;
    return Object.freeze(
        Object.fromEntries(
            Object.entries(fields).map(([key, value]) => [
                key,
                isFileBlob(value)
                    ? value
                    : value && typeof value === 'object' && validNativeFile(value as UploadNativeFile)
                      ? snapshotNativeFile(value as UploadNativeFile)
                      : String(value),
            ])
        )
    );
}

export function matchAccept(file: UploadNativeFile, accept?: string): boolean {
    if (!accept) return true;
    const patterns = accept
        .split(',')
        .map((pattern) => pattern.trim().toLowerCase())
        .filter(Boolean);
    if (!patterns.length) return true;
    const name = file.name.toLowerCase(),
        mime = (file.type ?? '').toLowerCase();
    if (!mime) return patterns.some((pattern) => pattern.startsWith('.') && name.endsWith(pattern));
    return patterns.some((pattern) =>
        pattern.startsWith('.')
            ? name.endsWith(pattern)
            : pattern.endsWith('/*')
              ? mime.split('/')[0] === pattern.split('/')[0]
              : mime === pattern
    );
}

export function formatFileSize(size?: number): string {
    if (size === undefined || !Number.isFinite(size)) return '';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function validNativeFile(file: UploadNativeFile): boolean {
    return (
        typeof file?.uri === 'string' &&
        !!file.uri.trim() &&
        typeof file.name === 'string' &&
        !!file.name.trim() &&
        (file.type === undefined || typeof file.type === 'string') &&
        (file.size === undefined || (Number.isFinite(file.size) && file.size >= 0))
    );
}
