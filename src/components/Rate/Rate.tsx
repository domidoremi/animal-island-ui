import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewProps } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { RateStar } from './RateStar';
import { attachRateKeyboard } from './rateWeb';

export type RateSize = 'small' | 'middle' | 'large';
export interface RateProps extends Omit<ViewProps, 'children'> {
    /** Controlled rating. */
    value?: number;
    /** Uncontrolled initial rating. */
    defaultValue?: number;
    /** Number of stars. */
    count?: number;
    /** Visual star size; interactive targets remain at least 44 logical units. */
    size?: RateSize;
    /** Display only. */
    readonly?: boolean;
    /** Pressing the selected star clears the rating. */
    allowClear?: boolean;
    /** Called with the committed rating, including zero on clear. */
    onChange?: (value: number) => void;
}
const STAR_SIZE = { small: 20, middle: 26, large: 34 };
const clamp = (value: number, count: number) =>
    Math.min(count, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));

export const Rate: React.FC<RateProps> = ({
    value,
    defaultValue = 0,
    count = 5,
    size = 'middle',
    readonly = false,
    allowClear = true,
    onChange,
    style,
    testID,
    accessibilityLabel = 'Rating',
    ...rest
}) => {
    const { theme, reducedMotion } = useTheme();
    const [innerValue, setInnerValue] = useState(defaultValue);
    const [focusedStar, setFocusedStar] = useState<number | null>(null);
    const [hoverValue, setHoverValue] = useState(0);
    const groupRef = useRef<React.ComponentRef<typeof View>>(null);
    const [burst, setBurst] = useState({ from: 0, to: 0, seq: 0 });
    const total = Math.max(0, Math.floor(Number.isFinite(count) ? count : 5));
    const current = clamp(value ?? innerValue, total);
    const filled = !readonly && hoverValue ? hoverValue : current;
    const commit = (next: number) => {
        if (readonly || next === current) return;
        if (value === undefined) setInnerValue(next);
        setHoverValue(0);
        setBurst((previous) => ({ from: current, to: next, seq: previous.seq + 1 }));
        onChange?.(next);
    };
    useEffect(() => {
        if (Platform.OS !== 'web' || readonly) return;
        return attachRateKeyboard(groupRef.current, current, total, commit);
    });
    if (readonly)
        return (
            <View
                {...rest}
                testID={testID}
                accessible
                accessibilityRole="image"
                accessibilityLabel={accessibilityLabel}
                accessibilityValue={{ min: 0, max: total, now: current, text: current + ' / ' + total }}
                style={[styles.group, style]}
            >
                {Array.from({ length: total }, (_, index) => (
                    <RateStar
                        key={index}
                        size={STAR_SIZE[size]}
                        color={index < current ? theme.colors.warning : theme.colors.border}
                        filled={index < current}
                        animate={false}
                        delay={0}
                    />
                ))}
            </View>
        );
    return (
        <View
            {...rest}
            ref={groupRef}
            accessible={false}
            role="radiogroup"
            testID={testID}
            accessibilityLabel={accessibilityLabel}
            style={[styles.group, style]}
        >
            {Array.from({ length: total }, (_, index) => {
                const next = index + 1;
                const selected = next === current;
                const animating = !reducedMotion && burst.to > burst.from && index >= burst.from && index < burst.to;
                return (
                    <Pressable
                        key={index}
                        accessibilityRole="radio"
                        accessibilityLabel={next + ' stars'}
                        accessibilityState={{ checked: selected }}
                        tabIndex={current === 0 ? (index === 0 ? 0 : -1) : selected ? 0 : -1}
                        testID={testID ? testID + '-star-' + next : undefined}
                        onPress={() => commit(allowClear && selected ? 0 : next)}
                        onFocus={() => setFocusedStar(next)}
                        onBlur={() => setFocusedStar(null)}
                        onHoverIn={() => setHoverValue(next)}
                        onHoverOut={() => setHoverValue(0)}
                        style={({ pressed }) => [
                            styles.item,
                            {
                                backgroundColor: pressed ? theme.colors.primaryBg : undefined,
                                borderColor: focusedStar === next ? theme.colors.primary : 'transparent',
                            },
                        ]}
                    >
                        <RateStar
                            key={animating ? burst.seq : 'idle'}
                            size={STAR_SIZE[size]}
                            color={index < filled ? theme.colors.warning : theme.colors.border}
                            filled={index < filled}
                            animate={animating}
                            delay={(index - burst.from) * 60}
                        />
                        <Text style={styles.hidden} accessible={false}>
                            {next}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
};
Rate.displayName = 'Rate';
const styles = StyleSheet.create({
    group: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', alignSelf: 'flex-start' },
    item: {
        minWidth: 44,
        minHeight: 44,
        borderWidth: 2,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    hidden: { position: 'absolute', width: 0, height: 0, opacity: 0 },
});
