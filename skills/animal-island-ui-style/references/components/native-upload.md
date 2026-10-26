# Upload - RN fork

For `animal-island-ui-rn`, not the upstream DOM package. The declarations below are
verbatim from native source; rebuild `dist/index.d.ts` before relying on installed types.
Package/runtime setup: [native-host.md](native-host.md).

## Upload

```ts
export interface UploadNativeFile {
    /** URI owned by the host picker; the library never deletes or revokes it. */
    uri: string;
    name: string;
    size?: number;
    type?: string;
    /** Required for action uploads on Web; native uploads use the URI. */
    blob?: Blob;
}

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
```

Defaults: multiple false, disabled false, directory false, listType text, showUploadList
true, drag false, method POST, multipart name file, withCredentials false.
`onPickFiles` is the host's explicit picker port. No picker means no enabled selection;
the library never asks for permission, deletes/revokes a URI or opens a picker itself.
`directory` is only a picker option; `drag` is a visual drop-zone, not a Web drop handler.

`beforeUpload` false skips upload. A transformed descriptor is sent while originFileObj
retains the original selection. Admission/request/removal snapshots detach native metadata,
headers and form fields from mutable callback input.

customRequest takes precedence over action and must honor signal or return abort().
An action uses real XMLHttpRequest/FormData after resolving its address/data. Native file
parts use URI/name/type; Web file parts require the supplied blob. Native extra file fields
also require a URI descriptor rather than a bare Blob.
Only transport success marks done. Missing action/customRequest reports error, never
simulated progress/success. Failed-transfer retry is not an API.

Controlled fileList stays host-owned. Removal is asynchronous and refuses stale identity,
disabled/lost lifetime or onRemove false/rejection. Unmount/removal abort owned work and
ignore late callbacks, but abort is not rollback of an already-admitted remote effect.
Neither the picker fixture nor mocked transport proves permissions, URI lifetime or a
real server/device transfer. Localized labels and policy remain the host's responsibility.
