# Avatar and Badge - RN fork

For `animal-island-ui-rn`, not the upstream DOM package. The declarations below are
verbatim from native source; rebuild `dist/index.d.ts` before relying on installed types.
Package/runtime setup: [native-host.md](native-host.md).

## Avatar

```ts
export type AvatarShape = 'circle' | 'square';

export type AvatarSize = 'small' | 'middle' | 'large';

export interface AvatarProps extends Omit<ViewProps, 'children'> {
    /** Shape of the image or placeholder. */
    shape?: AvatarShape;
    /** Preset or native logical size. */
    size?: number | AvatarSize;
    /** URI or a native image source; failures fall back to content. */
    src?: string | ImageSourcePropType;
    /** Accessible description, including after image failure. */
    alt?: string;
    /** Native icon content for the placeholder. */
    icon?: React.ReactNode;
    /** Space around placeholder content. */
    gap?: number;
    /** Returning false prevents the image fallback. */
    onError?: () => boolean | void;
    /** Text or native icon content. */
    children?: React.ReactNode;
}

export interface AvatarGroupProps extends ViewProps {
    /** Extra avatars collapse into a +N placeholder. */
    maxCount?: number;
    /** Style of the collapsed placeholder. */
    maxStyle?: StyleProp<ViewStyle>;
    /** Defaults supplied only to children without their own size. */
    size?: number | AvatarSize;
    /** Default child shape. */
    shape?: AvatarShape;
    /** Overlap between adjacent avatars. */
    gap?: number;
}
```

Import `Avatar`; grouping is `Avatar.Group`. Sizes default to middle (40 native units);
small/large are 32/48. Group overlap defaults to 8. Child size/shape choices override
group defaults. Native image failure falls back to children/icon unless onError returns
false. Text fits within the avatar; custom native content remains caller-owned.

## Badge

```ts
export type BadgeSize = 'small' | 'medium';

export type BadgeColor =
    | 'app-red'
    | 'app-pink'
    | 'app-orange'
    | 'app-yellow'
    | 'app-teal'
    | 'app-green'
    | 'app-blue'
    | 'purple'
    | 'lime-green'
    | 'yellow-green'
    | 'brown'
    | 'warm-peach-pink';

export interface BadgeProps extends ViewProps {
    /** 展示的内容：数字 / 字符串，或任意 ReactNode（如 naive-icons 图标） */
    count?: React.ReactNode;
    /** 展示封顶的数字值，超过时显示为 `${overflowCount}+` */
    overflowCount?: number;
    /** 数值为 0 时是否展示 */
    showZero?: boolean;
    /** 不展示数字，只展示一个小圆点 */
    dot?: boolean;
    /** 尺寸，仅对数字角标生效（dot 尺寸固定） */
    size?: BadgeSize;
    /** 颜色，与 Card / Tag 调色板一致 */
    color?: BadgeColor;
    /** Accessible full count, even when the visible number is capped. */
    title?: string;
    /** 徽标包裹的元素；不传即为独立使用 */
    children?: React.ReactNode;
}
```

Defaults: overflowCount 99, showZero false, dot false, size medium, color app-red.
The accessible title retains the full numeric count even when the display reads 99+.
No children means a standalone badge. CJK/two-character width can switch a circle to
a pill; reduced motion disables the entry scale without hiding the value.
