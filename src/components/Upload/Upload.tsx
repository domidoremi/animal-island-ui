import React, { useEffect, useRef, useState } from 'react';
import {
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
    type ViewProps,
    type ViewStyle,
} from 'react-native';
import { CheckIcon, CloseIcon, EyeIcon, FileIcon, UploadIcon } from '../../icons';
import { useTheme } from '../../theme/ThemeProvider';
import { formatFileSize, matchAccept, snapshotNativeFile, validNativeFile, type UploadNativeFile } from './nativeFiles';
import { uploadNativeFile } from './transport';
export type { UploadNativeFile } from './nativeFiles';

export type UploadFileStatus = 'uploading' | 'done' | 'error' | 'removed';
export type UploadListType = 'text' | 'picture' | 'picture-card';
export interface UploadFile {
    uid: string;
    name: string;
    size?: number;
    type?: string;
    status?: UploadFileStatus;
    percent?: number;
    url?: string;
    thumbUrl?: string;
    /** Native picker descriptor instead of a DOM File. */
    originFileObj?: UploadNativeFile;
    response?: unknown;
    error?: unknown;
}
export interface UploadCustomRequestOptions {
    file: UploadNativeFile;
    /** Observe cancellation even when the transport cannot return an abort handle. */
    signal: AbortSignal;
    onProgress: (percent: number) => void;
    onSuccess: (response?: unknown) => void;
    onError: (error?: unknown) => void;
}
export interface UploadChangeParam {
    file: UploadFile;
    fileList: UploadFile[];
}
export interface UploadShowUploadList {
    showPreviewIcon?: boolean;
    showRemoveIcon?: boolean;
}
export type UploadOnChange = (info: UploadChangeParam) => void;
export interface UploadPickerOptions {
    accept?: string;
    multiple: boolean;
    directory: boolean;
    signal: AbortSignal;
}
export interface UploadProps extends ViewProps {
    accept?: string;
    multiple?: boolean;
    maxCount?: number;
    disabled?: boolean;
    /** Delegated to the host picker; no automatic permission or directory access. */
    directory?: boolean;
    fileList?: UploadFile[];
    defaultFileList?: UploadFile[];
    listType?: UploadListType;
    showUploadList?: boolean | UploadShowUploadList;
    onPreview?: (file: UploadFile) => void;
    /** Visual drop-zone skin only; native selection remains an explicit press. */
    drag?: boolean;
    tip?: React.ReactNode;
    /** Host owns picker permissions and temporary URI lifetime. Missing port disables selection. */
    onPickFiles?: (options: UploadPickerOptions) => UploadNativeFile[] | null | Promise<UploadNativeFile[] | null>;
    onPickerError?: (error: unknown) => void;
    beforeUpload?: (
        file: UploadNativeFile,
        files: UploadNativeFile[]
    ) => boolean | UploadNativeFile | Promise<boolean | UploadNativeFile>;
    customRequest?: (options: UploadCustomRequestOptions) => void | { abort: () => void };
    action?: string | ((file: UploadNativeFile) => string | Promise<string>);
    method?: 'POST' | 'PUT' | 'PATCH';
    headers?: Record<string, string>;
    data?:
        | Record<string, unknown>
        | ((
              file: UploadNativeFile
          ) => Record<string, unknown> | undefined | Promise<Record<string, unknown> | undefined>);
    name?: string;
    withCredentials?: boolean;
    onChange?: UploadOnChange;
    onExceed?: (files: UploadNativeFile[], filesNow: UploadFile[]) => void;
    onRemove?: (file: UploadFile) => boolean | void | Promise<boolean | void>;
}
interface Request {
    controller: AbortController;
    abort?: () => void;
}
let uidSeed = 0;
const uid = () => 'animal-upload-' + Date.now().toString(36) + '-' + ++uidSeed;
const identity = (file: UploadFile) =>
    JSON.stringify([
        file.uid,
        file.name,
        file.size,
        file.type,
        file.url,
        file.thumbUrl,
        file.originFileObj?.uri,
        file.originFileObj?.name,
        file.originFileObj?.size,
        file.originFileObj?.type,
    ]);
const snapshotFile = (file: UploadFile): UploadFile => ({
    ...file,
    ...(file.originFileObj ? { originFileObj: snapshotNativeFile(file.originFileObj) } : {}),
});
const node = (value: React.ReactNode, color: string) =>
    typeof value === 'string' || typeof value === 'number' ? (
        <Text style={{ color, fontWeight: '600', fontSize: 14 }}>{value}</Text>
    ) : (
        value
    );

export const Upload: React.FC<UploadProps> = ({
    accept,
    multiple = false,
    maxCount,
    disabled = false,
    directory = false,
    fileList,
    defaultFileList,
    listType = 'text',
    showUploadList = true,
    onPreview,
    drag = false,
    tip,
    children,
    onPickFiles,
    onPickerError,
    beforeUpload,
    customRequest,
    action,
    method = 'POST',
    headers,
    data,
    name,
    withCredentials,
    onChange,
    onExceed,
    onRemove,
    style,
    testID,
    accessibilityLabel = 'Upload files',
    ...rest
}) => {
    const { theme } = useTheme();
    const dimensions = useWindowDimensions();
    const [innerFiles, setInnerFiles] = useState<UploadFile[]>(() => (defaultFileList ?? []).map(snapshotFile));
    const files = fileList ?? innerFiles;
    const current = useRef(files);
    current.current = files;
    const controlled = useRef(fileList !== undefined);
    controlled.current = fileList !== undefined;
    const live = useRef(true),
        blocked = useRef(disabled);
    blocked.current = disabled;
    const change = useRef(onChange);
    change.current = onChange;
    const requests = useRef(new Map<string, Request>());
    const picking = useRef<AbortController | null>(null);
    const [isPicking, setPicking] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [removing, setRemoving] = useState<string[]>([]);
    const pendingRemoval = useRef(new Set<string>());
    const [preview, setPreview] = useState<UploadFile | null>(null);
    const commit = (next: UploadFile[], changed: UploadFile) => {
        if (!live.current) return;
        current.current = next;
        if (!controlled.current) setInnerFiles(next);
        change.current?.({ file: snapshotFile(changed), fileList: next.map(snapshotFile) });
    };
    const stop = (key: string) => {
        const request = requests.current.get(key);
        requests.current.delete(key);
        request?.controller.abort();
        try {
            request?.abort?.();
        } catch {
            /* Late callbacks remain fenced even if a host abort fails. */
        }
    };
    useEffect(() => {
        live.current = true;
        const ownedRequests = requests.current;
        const ownedRemovals = pendingRemoval.current;
        return () => {
            live.current = false;
            picking.current?.abort();
            for (const request of ownedRequests.values()) {
                request.controller.abort();
                try {
                    request.abort?.();
                } catch {
                    /* Host abort failures do not release the completion fence. */
                }
            }
            ownedRequests.clear();
            ownedRemovals.clear();
        };
    }, []);
    useEffect(() => {
        const visible = new Set(files.map((file) => file.uid));
        for (const key of requests.current.keys()) if (!visible.has(key)) stop(key);
        if (preview && !visible.has(preview.uid)) setPreview(null);
    }, [files, preview]);
    useEffect(() => {
        if (disabled) picking.current?.abort();
    }, [disabled]);

    const startRequest = (item: UploadFile, upload: UploadNativeFile) => {
        const admittedIdentity = identity(item);
        const admittedFile = snapshotNativeFile(upload);
        const request: Request = { controller: new AbortController() };
        stop(item.uid);
        requests.current.set(item.uid, request);
        const publish = (patch: Partial<UploadFile>, terminal = false) => {
            if (!live.current || request.controller.signal.aborted || requests.current.get(item.uid) !== request)
                return;
            const found = current.current.find((file) => file.uid === item.uid);
            if (!found || identity(found) !== admittedIdentity) {
                stop(item.uid);
                return;
            }
            const changed = { ...found, ...patch };
            if (terminal) requests.current.delete(item.uid);
            commit(
                current.current.map((file) => (file.uid === item.uid ? changed : file)),
                changed
            );
        };
        const callbacks: UploadCustomRequestOptions = {
            file: admittedFile,
            signal: request.controller.signal,
            onProgress: (percent) => {
                if (Number.isFinite(percent))
                    publish({ percent: Math.max(0, Math.min(100, Math.round(percent))), status: 'uploading' });
            },
            onSuccess: (response) => publish({ status: 'done', percent: 100, response, error: undefined }, true),
            onError: (error) => publish({ status: 'error', error }, true),
        };
        if (customRequest) {
            try {
                const handle = customRequest(callbacks);
                if (handle) {
                    if (request.controller.signal.aborted) handle.abort();
                    else request.abort = handle.abort;
                }
            } catch (error) {
                callbacks.onError(error);
            }
        } else if (action)
            void uploadNativeFile({ ...callbacks, action, method, headers, data, name, withCredentials });
        else callbacks.onError(new Error('Provide customRequest or action; selection alone is not an upload.'));
    };
    const pick = async () => {
        if (blocked.current || picking.current || !onPickFiles) return;
        const controller = new AbortController();
        picking.current = controller;
        setPicking(true);
        setFeedback(null);
        const admitted = () =>
            live.current && !blocked.current && picking.current === controller && !controller.signal.aborted;
        try {
            const result = await onPickFiles({ accept, multiple, directory, signal: controller.signal });
            if (!admitted() || !result) return;
            const originals = (multiple || directory ? result : result.slice(0, 1))
                .filter((file) => validNativeFile(file) && matchAccept(file, accept))
                .map(snapshotNativeFile);
            const exceeded: UploadNativeFile[] = [];
            for (const original of originals) {
                const prepared = beforeUpload ? await beforeUpload(original, originals) : original;
                if (!admitted()) return;
                if (prepared === false) continue;
                const upload = prepared === true ? original : prepared;
                if (!validNativeFile(upload)) throw new Error('The upload hook returned an invalid native file.');
                const limit = maxCount && maxCount > 0 ? Math.floor(maxCount) : 0;
                if (limit > 1 && current.current.length >= limit) {
                    exceeded.push(original);
                    continue;
                }
                const admittedFile = snapshotNativeFile(upload);
                const item: UploadFile = {
                    uid: uid(),
                    name: admittedFile.name,
                    size: admittedFile.size,
                    type: admittedFile.type,
                    originFileObj: original,
                    thumbUrl: admittedFile.type?.startsWith('image/') ? admittedFile.uri : undefined,
                    status: 'uploading',
                    percent: 0,
                };
                if (limit === 1) for (const old of current.current) stop(old.uid);
                commit(limit === 1 ? [item] : [...current.current, item], item);
                if (!admitted() || !current.current.some((file) => file.uid === item.uid)) return;
                startRequest(item, admittedFile);
            }
            if (exceeded.length && admitted()) onExceed?.(exceeded, current.current.map(snapshotFile));
        } catch (error) {
            if (admitted()) {
                setFeedback('Unable to select or prepare files.');
                onPickerError?.(error);
            }
        } finally {
            if (picking.current === controller) picking.current = null;
            if (live.current) setPicking(false);
        }
    };
    const remove = async (file: UploadFile) => {
        if (blocked.current || pendingRemoval.current.has(file.uid)) return;
        pendingRemoval.current.add(file.uid);
        setRemoving([...pendingRemoval.current]);
        const originalIdentity = identity(file);
        try {
            const allowed = await onRemove?.(snapshotFile(file));
            const fresh = current.current.find((candidate) => candidate.uid === file.uid);
            if (!live.current || blocked.current || allowed === false || !fresh || identity(fresh) !== originalIdentity)
                return;
            stop(file.uid);
            commit(
                current.current.filter((candidate) => candidate.uid !== file.uid),
                { ...fresh, status: 'removed' }
            );
        } catch {
            if (live.current) setFeedback('File removal was not completed.');
        } finally {
            pendingRemoval.current.delete(file.uid);
            if (live.current) setRemoving([...pendingRemoval.current]);
        }
    };
    const config = typeof showUploadList === 'object' ? showUploadList : {};
    const previewFile = (file: UploadFile) => {
        if (onPreview) onPreview(snapshotFile(file));
        else setPreview(snapshotFile(file));
    };
    const canPick = !disabled && !!onPickFiles && !isPicking;
    return (
        <View {...rest} testID={testID} style={[styles.root, style]}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={accessibilityLabel}
                accessibilityState={{ disabled: !canPick, busy: isPicking }}
                disabled={!canPick}
                onPress={() => void pick()}
                testID={testID ? testID + '-trigger' : undefined}
                style={({ pressed }) => [
                    styles.trigger,
                    {
                        backgroundColor: pressed ? theme.colors.primaryBg : theme.colors.bgSecondary,
                        borderColor: theme.colors.border,
                        borderStyle: drag || listType === 'picture-card' ? 'dashed' : 'solid',
                        opacity: canPick ? 1 : 0.6,
                    },
                ]}
            >
                {children === undefined ? (
                    <>
                        <UploadIcon size={listType === 'picture-card' ? 28 : drag ? 16 : 18} />
                        {node(isPicking ? 'Selecting files...' : 'Select files', theme.colors.text)}
                    </>
                ) : (
                    node(children, theme.colors.text)
                )}
            </Pressable>
            {tip !== undefined ? node(tip, theme.colors.textSecondary) : null}
            {feedback ? (
                <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: theme.colors.error }}>
                    {feedback}
                </Text>
            ) : null}
            {showUploadList ? (
                <View style={listType === 'picture-card' ? styles.cards : undefined}>
                    {files.map((file) => (
                        <View
                            key={file.uid}
                            testID={testID ? testID + '-file-' + file.uid : undefined}
                            style={[
                                styles.file,
                                { backgroundColor: theme.colors.bg, borderColor: theme.colors.border },
                                listType === 'picture-card' ? styles.pictureCard : undefined,
                            ]}
                        >
                            {listType !== 'text' && (file.thumbUrl || file.url) ? (
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={'Preview ' + file.name}
                                    disabled={config.showPreviewIcon === false}
                                    onPress={() => previewFile(file)}
                                    style={styles.thumbnail}
                                >
                                    <Image
                                        accessible={false}
                                        source={{ uri: file.thumbUrl ?? file.url }}
                                        style={StyleSheet.absoluteFill}
                                        resizeMode="cover"
                                    />
                                </Pressable>
                            ) : (
                                <FileIcon size={listType === 'picture' ? 18 : 15} />
                            )}
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '600' }}>
                                    {file.name}
                                </Text>
                                <Text
                                    style={{
                                        color:
                                            file.status === 'error' ? theme.colors.error : theme.colors.textSecondary,
                                        fontSize: 12,
                                    }}
                                >
                                    {formatFileSize(file.size)}
                                    {file.status === 'uploading'
                                        ? ' ' + (file.percent ?? 0) + '%'
                                        : file.status === 'error'
                                          ? ' Upload failed'
                                          : file.status === 'done'
                                            ? ' Uploaded'
                                            : ''}
                                </Text>
                                {file.status === 'uploading' ? (
                                    <View
                                        accessible
                                        accessibilityRole="progressbar"
                                        accessibilityLabel={'Uploading ' + file.name}
                                        accessibilityValue={{ min: 0, max: 100, now: file.percent ?? 0 }}
                                        style={[styles.progress, { backgroundColor: theme.colors.borderLight }]}
                                    >
                                        <View
                                            style={{
                                                height: '100%',
                                                width: ((file.percent ?? 0) + '%') as ViewStyle['width'],
                                                backgroundColor: theme.colors.primary,
                                            }}
                                        />
                                    </View>
                                ) : null}
                            </View>
                            {file.status === 'done' ? (
                                <CheckIcon size={16} />
                            ) : file.status === 'error' ? (
                                <CloseIcon size={16} />
                            ) : null}
                            {config.showPreviewIcon !== false && (file.thumbUrl || file.url) && listType === 'text' ? (
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={'Preview ' + file.name}
                                    onPress={() => previewFile(file)}
                                    style={styles.action}
                                >
                                    <EyeIcon size={16} />
                                </Pressable>
                            ) : null}
                            {config.showRemoveIcon !== false ? (
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={'Remove ' + file.name}
                                    accessibilityState={{
                                        disabled: disabled || removing.includes(file.uid),
                                        busy: removing.includes(file.uid),
                                    }}
                                    disabled={disabled || removing.includes(file.uid)}
                                    onPress={() => void remove(file)}
                                    style={styles.action}
                                >
                                    <CloseIcon size={16} />
                                </Pressable>
                            ) : null}
                        </View>
                    ))}
                </View>
            ) : null}
            {preview ? (
                <Modal visible transparent onRequestClose={() => setPreview(null)}>
                    <View accessibilityViewIsModal style={[styles.preview, { backgroundColor: theme.colors.bg }]}>
                        <ScrollView
                            contentContainerStyle={{ flexGrow: 1, alignItems: 'center' }}
                            keyboardShouldPersistTaps="handled"
                        >
                            <Text accessibilityRole="header" style={{ color: theme.colors.text, fontSize: 18 }}>
                                {preview.name}
                            </Text>
                            <Image
                                accessibilityLabel={preview.name}
                                source={{ uri: preview.thumbUrl ?? preview.url }}
                                resizeMode="contain"
                                style={{
                                    width: Math.max(1, dimensions.width - 48),
                                    height: Math.max(44, dimensions.height * 0.6),
                                }}
                            />
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Close preview"
                                onPress={() => setPreview(null)}
                                style={styles.action}
                            >
                                <CloseIcon size={24} />
                            </Pressable>
                        </ScrollView>
                    </View>
                </Modal>
            ) : null}
        </View>
    );
};
Upload.displayName = 'Upload';
const styles = StyleSheet.create({
    root: { gap: 8 },
    trigger: {
        minHeight: 48,
        borderWidth: 2,
        borderRadius: 16,
        padding: 12,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    file: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderRadius: 16,
        padding: 8,
        marginTop: 4,
    },
    cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pictureCard: { width: 136, maxWidth: '100%', flexDirection: 'column', alignItems: 'stretch' },
    thumbnail: { width: 64, height: 64, borderRadius: 12, overflow: 'hidden' },
    action: {
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
        borderRadius: 12,
    },
    progress: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
    preview: { flex: 1, margin: 16, padding: 8, borderRadius: 20 },
});
