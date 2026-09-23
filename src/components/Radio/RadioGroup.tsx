import React, { useEffect, useRef } from 'react';
import { Platform, View, type ViewProps } from 'react-native';
import { attachRadioGroupKeyboard } from './radioGroupWeb';

export type RadioGroupProps = Omit<ViewProps, 'accessible' | 'role' | 'accessibilityRole' | 'ref'>;

/** Unstyled group for custom radios. Each child radio remains a native accessibility node. */
export function RadioGroup({ children, ...props }: RadioGroupProps) {
    const ref = useRef<React.ComponentRef<typeof View>>(null);
    useEffect(() => {
        if (Platform.OS === 'web') return attachRadioGroupKeyboard(ref.current);
        return undefined;
    }, []);
    return (
        <View {...props} ref={ref} role="radiogroup" accessible={false}>
            {children}
        </View>
    );
}
