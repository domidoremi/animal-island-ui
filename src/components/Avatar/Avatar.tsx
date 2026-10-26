import React, { useState } from 'react';
import {
    Image,
    StyleSheet,
    Text,
    View,
    type ImageSourcePropType,
    type StyleProp,
    type ViewProps,
    type ViewStyle,
} from 'react-native';
import { UserIcon } from '../../icons';
import { useTheme } from '../../theme/ThemeProvider';

export type AvatarShape = 'circle' | 'square';
export type AvatarSize = 'small' | 'middle' | 'large';

const PRESET_SIZE = { small: 32, middle: 40, large: 48 };
const PRESET_FONT = { small: 14, middle: 16, large: 20 };

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

export const Avatar: React.FC<AvatarProps> & { Group: React.FC<AvatarGroupProps> } = ({
    shape = 'circle',
    size = 'middle',
    src,
    alt,
    icon,
    gap = 4,
    onError,
    children,
    style,
    ...rest
}) => {
    const { theme } = useTheme();
    const [failedSource, setFailedSource] = useState<typeof src>();
    const px = typeof size === 'number' ? Math.max(1, size) : PRESET_SIZE[size];
    const fontPx = typeof size === 'number' ? Math.max(12, Math.round(px * 0.4)) : PRESET_FONT[size];
    const hasImage = !!src && src !== failedSource;
    const textual = typeof children === 'string' || typeof children === 'number';
    const source = typeof src === 'string' ? { uri: src } : src;
    const label = alt ?? (textual ? String(children) : 'avatar');

    return (
        <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={label}
            {...rest}
            style={[
                styles.avatar,
                {
                    width: px,
                    height: px,
                    borderRadius: shape === 'square' ? 8 : px / 2,
                    borderColor: theme.colors.bg,
                    backgroundColor: theme.colors.primaryBg,
                },
                style,
            ]}
        >
            {hasImage ? (
                <Image
                    key={typeof src === 'string' ? src : JSON.stringify(src)}
                    source={source}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                    accessible={false}
                    testID={rest.testID ? `${rest.testID}-image` : undefined}
                    onError={() => {
                        if (onError?.() !== false) setFailedSource(src);
                    }}
                />
            ) : textual && !icon ? (
                <Text
                    accessible={false}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.1}
                    style={{
                        maxWidth: Math.max(1, px - gap * 2),
                        color: theme.colors.primary,
                        fontSize: fontPx,
                        fontWeight: '600',
                    }}
                >
                    {children}
                </Text>
            ) : (
                (icon ?? children ?? <UserIcon size={Math.round(px * 0.5)} />)
            )}
        </View>
    );
};
Avatar.displayName = 'Avatar';

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

export const AvatarGroup: React.FC<AvatarGroupProps> = ({
    maxCount,
    maxStyle,
    size,
    shape,
    gap = 8,
    children,
    style,
    ...rest
}) => {
    const kids = React.Children.toArray(children);
    const limit = maxCount && maxCount > 0 ? Math.floor(maxCount) : kids.length;
    const shown = kids.slice(0, limit);
    const remaining = kids.length - shown.length;
    return (
        <View {...rest} style={[styles.group, style]}>
            {shown.map((kid, index) => {
                if (!React.isValidElement<AvatarProps>(kid)) return kid;
                return (
                    <View key={kid.key ?? index} style={{ marginLeft: index ? -gap : 0 }}>
                        {React.cloneElement(kid, { size: kid.props.size ?? size, shape: kid.props.shape ?? shape })}
                    </View>
                );
            })}
            {remaining > 0 ? (
                <Avatar
                    size={size}
                    shape={shape}
                    style={[{ marginLeft: -gap }, maxStyle]}
                    alt={`${remaining} more avatars`}
                >
                    {`+${remaining}`}
                </Avatar>
            ) : null}
        </View>
    );
};
AvatarGroup.displayName = 'AvatarGroup';
Avatar.Group = AvatarGroup;

const styles = StyleSheet.create({
    avatar: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderWidth: 2 },
    group: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
});
