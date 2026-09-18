import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * `prefers-reduced-motion: reduce` 的 React Native 对应物。
 *
 * 上游 `progress.module.less` 末尾有一条媒体查询：
 *   @media (prefers-reduced-motion: reduce) { .fill { transition: none } }
 * CSS 媒体查询在 RN 里不存在，对应的系统开关是「减弱动态效果」
 * （iOS: 设置 → 辅助功能 → 动态效果；Android: 开发者选项 → 动画缩放 / 移除动画），
 * RN 通过 `AccessibilityInfo.isReduceMotionEnabled()` + `reduceMotionChanged` 事件暴露。
 * RN 没有内置 hook，所以这里自己包一个。
 *
 * 初始值是 `false`（读系统开关是异步的）：首帧按「不减弱」处理，读到之后再纠正。
 * 对本组件无副作用 —— 首帧本来就不播放动画（见 Progress.tsx 的挂载分支）。
 */
export const useReduceMotion = (): boolean => {
    const [reduceMotion, setReduceMotion] = useState(false);

    useEffect(() => {
        let active = true;
        AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
            if (active) setReduceMotion(enabled);
        });
        const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
        return () => {
            active = false;
            subscription.remove();
        };
    }, []);

    return reduceMotion;
};
