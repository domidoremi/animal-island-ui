import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { StarIcon } from '../../icons';

export function RateStar({
    size,
    color,
    filled,
    animate,
    delay,
}: {
    size: number;
    color: string;
    filled: boolean;
    animate: boolean;
    delay: number;
}) {
    const scale = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        if (!animate) {
            scale.setValue(1);
            return;
        }
        scale.setValue(0.65);
        const animation = Animated.sequence([
            Animated.delay(delay),
            Animated.timing(scale, {
                toValue: 1.2,
                duration: 150,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(scale, { toValue: 1, duration: 150, useNativeDriver: true }),
        ]);
        animation.start();
        return () => animation.stop();
    }, [animate, delay, scale]);
    return (
        <Animated.View accessible={false} style={{ transform: [{ scale }] }}>
            <StarIcon size={size} color={color} style={{ opacity: filled ? 1 : 0.4 }} />
        </Animated.View>
    );
}
RateStar.displayName = 'RateStar';
