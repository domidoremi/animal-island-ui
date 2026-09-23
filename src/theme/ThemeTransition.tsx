import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTheme } from './ThemeProvider';
import { resolveThemeTransitionCircle, startWebThemeTransition } from './themeTransitionWeb';

export interface ThemeTransitionOptions {
    /** Viewport coordinates of the initiating press; omitted for a centered reveal. */
    origin?: { x: number; y: number };
    /** Opaque destination surface for native / older-browser cover-and-reveal. */
    color?: string;
}
export interface ThemeTransitionProviderProps {
    children?: React.ReactNode;
    /** Overrides ThemeProvider's policy; true applies changes without decorative motion. */
    reducedMotion?: boolean;
}
type RunTransition = (update: () => void, options?: ThemeTransitionOptions) => Promise<void>;
const applyImmediately: RunTransition = async (update) => {
    update();
};
const TransitionContext = createContext<RunTransition>(applyImmediately);

/** Mount once at the application root. Children keep their identity throughout a transition. */
export function ThemeTransitionProvider({ children, reducedMotion }: ThemeTransitionProviderProps) {
    const { theme, reducedMotion: themeReducedMotion } = useTheme();
    const { width, height } = useWindowDimensions();
    const reduce = reducedMotion ?? themeReducedMotion;
    const policy = useRef({ reduce, width, height, color: theme.colors.bg });
    policy.current = { reduce, width, height, color: theme.colors.bg };
    const active = useRef<{ finish(apply?: boolean): void } | undefined>(undefined);
    const mounted = useRef(true);
    const scale = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(1)).current;
    const [cover, setCover] = useState<ReturnType<typeof resolveThemeTransitionCircle> & { color: string }>();

    const run = useCallback<RunTransition>(
        (update, options = {}) => {
            // Finish the preceding mutation exactly once before starting another. This
            // preserves rapid family + mode + accent changes, not just the last closure.
            active.current?.finish();
            if (!mounted.current) return Promise.resolve();
            if (policy.current.reduce) return applyImmediately(update);
            return new Promise<void>((resolve, reject) => {
                let ended = false;
                let applied = false;
                let failed = false;
                let failure: unknown;
                let web: ReturnType<typeof startWebThemeTransition>;
                let animation: Animated.CompositeAnimation | undefined;
                const frames = new Map<number, () => void>();
                const apply = () => {
                    if (applied) return;
                    applied = true;
                    try {
                        update();
                    } catch (error) {
                        failed = true;
                        failure = error;
                    }
                };
                const job = {
                    finish(shouldApply = true) {
                        if (ended) return;
                        ended = true;
                        clearTimeout(deadline);
                        for (const [id, release] of frames) {
                            cancelAnimationFrame(id);
                            release();
                        }
                        frames.clear();
                        animation?.stop();
                        web?.stop();
                        if (shouldApply) apply();
                        if (active.current === job) {
                            active.current = undefined;
                            if (mounted.current) setCover(undefined);
                        }
                        if (failed) reject(failure);
                        else resolve();
                    },
                };
                // A decoration must never strand a settings change or cover the app.
                const deadline = setTimeout(() => job.finish(), 1200);
                const frame = () =>
                    new Promise<void>((release) => {
                        const id = requestAnimationFrame(() => {
                            frames.delete(id);
                            release();
                        });
                        frames.set(id, release);
                    });
                const painted = async () => {
                    await frame();
                    if (!ended) await frame();
                };
                active.current = job;
                const circle = resolveThemeTransitionCircle(
                    policy.current.width,
                    policy.current.height,
                    options.origin
                );
                if (Platform.OS === 'web') {
                    web = startWebThemeTransition(
                        async () => {
                            if (ended) return;
                            apply();
                            // View Transitions suppress rendering during this callback,
                            // so awaiting rAF here deadlocks until the safety deadline.
                            // Yield a task for the host's synchronous store commit instead.
                            await new Promise<void>((release) => setTimeout(release, 0));
                        },
                        () => job.finish(),
                        circle
                    );
                    if (web) return;
                }
                scale.setValue(0.001);
                opacity.setValue(1);
                setCover({ ...circle, color: options.color ?? policy.current.color });
                painted()
                    .then(() => {
                        if (ended) return;
                        animation = Animated.timing(scale, {
                            toValue: 1,
                            duration: 190,
                            easing: Easing.bezier(0.4, 0, 0.2, 1),
                            useNativeDriver: true,
                        });
                        animation.start(({ finished }) => {
                            if (ended) return;
                            if (!finished) {
                                job.finish();
                                return;
                            }
                            apply();
                            painted()
                                .then(() => {
                                    if (ended) return;
                                    animation = Animated.timing(opacity, {
                                        toValue: 0,
                                        duration: 130,
                                        useNativeDriver: true,
                                    });
                                    animation.start(() => job.finish());
                                })
                                .catch(() => job.finish());
                        });
                    })
                    .catch(() => job.finish());
            });
        },
        [opacity, scale]
    );

    useEffect(() => {
        // Resize / OS reduced-motion changes invalidate a running circle.
        active.current?.finish();
    }, [reduce, width, height]);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            active.current?.finish(false);
        };
    }, []);

    return (
        <TransitionContext.Provider value={run}>
            {children}
            {cover ? (
                <View
                    testID="theme-transition-cover"
                    pointerEvents="none"
                    aria-hidden
                    importantForAccessibility="no-hide-descendants"
                    style={styles.cover}
                >
                    <Animated.View
                        style={[
                            styles.circle,
                            {
                                left: cover.x - cover.radius,
                                top: cover.y - cover.radius,
                                width: cover.radius * 2,
                                height: cover.radius * 2,
                                borderRadius: cover.radius,
                                backgroundColor: cover.color,
                                opacity,
                                transform: [{ scale }],
                            },
                        ]}
                    />
                </View>
            ) : null}
        </TransitionContext.Provider>
    );
}
ThemeTransitionProvider.displayName = 'ThemeTransitionProvider';

export const useThemeTransition = () => useContext(TransitionContext);

const styles = StyleSheet.create({
    circle: { position: 'absolute' },
    cover: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        overflow: 'hidden',
        zIndex: 10000,
        elevation: 100,
    },
});
