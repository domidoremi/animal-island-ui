/**
 * Jest 配置（RN 版）。
 *
 * preset 跟随实际安装的 RN：0.86 使用 `react-native` 内置版本；
 * **RN 0.87 把 jest preset 从 `react-native` 包里拆出去了**，改用
 * `@react-native/jest-preset`。不能把 0.87 的 preset 用在消费应用链接的 0.86 运行时上。
 *
 * testMatch 只覆盖**已移植到 RN** 的子集。
 *
 * 2026-09-19：34 / 34 组件已全部移植，`src/` 下不再有 import `vitest` /
 * `@testing-library/react` / `.module.less` 的 Web 测试文件（实测 0 个），
 * 这 40 条穷举已与磁盘上的 40 个测试文件一一对应。同理 tsconfig.json 的说明，
 * 它在功能上等价于「src 下所有 .test.ts 与 .test.tsx」的 glob，
 * 是否简化属基建决策、待定。
 */
const fs = require('node:fs');
const path = require('node:path');
// RN 0.86 still bundles its preset; 0.87 uses the standalone package. Select
// the preset for the installed runtime, including a consuming app's workspace link.
const bundledPreset = path.join(path.dirname(require.resolve('react-native/package.json')), 'jest-preset.js');

module.exports = {
    preset: fs.existsSync(bundledPreset) ? path.dirname(bundledPreset) : '@react-native/jest-preset',
    /**
     * ⚠️ transform 缓存**必须放在项目内**，不能用默认的临时目录。
     *
     * 症状：冷缓存（首次跑，或刚 `jest --clearCache`）时随机 1–3 个套件报
     *   `● Test suite failed to run`
     *   `jest: failed to cache transform results in: <Temp>/jest/jest-transform-cache-...`
     *   `Failure message: EPERM: operation not permitted, rename ...`
     * 热缓存一切正常 —— 极易误判成「组件 flaky」，但与组件无关。
     *
     * 根因：默认的 `cacheDirectory` 在系统临时目录，而本机的 fs shim 会拦
     * `renameSync`（`write-file-atomic` 靠 rename 做原子写）。冷缓存时 RN preset
     * 要 transform 整个 `react-native` 依赖树（`transformIgnorePatterns` 没把
     * `react-native` / `@react-native` 排除掉），`maxWorkers` 又默认取 CPU 核数 − 1
     * （本机 19），19 个 worker 并发写同一批缓存键就撞上 EPERM。
     *
     * 实测：换到项目内目录后 EPERM 消失；`--maxWorkers=1` 也能规避（但会拖慢热缓存）。
     */
    cacheDirectory: '<rootDir>/.jest-cache',
    /**
     * ⚠️ 单用例超时默认 5000ms，对**冷缓存**不够。
     *
     * 换掉缓存目录消除了 EPERM，但冷缓存时首个用例仍要等 RN preset 把整个
     * `react-native` 依赖树 transform 完，实测能到 11–20s，于是随机 1–2 个套件报
     * `Exceeded timeout of 5000 ms`。热缓存时所有用例都在毫秒级。
     *
     * 20s 沿用本仓 Web 时代 vitest 的同一口径（`--testTimeout=20000`）。
     * 要根治的是把 transform 缓存纳入 CI 缓存，而不是继续调这个数字。
     */
    testTimeout: 20000,
    testMatch: [
        '<rootDir>/src/components/BackTop/*.test.tsx',
        '<rootDir>/src/components/Background/*.test.tsx',
        '<rootDir>/src/components/Button/*.test.tsx',
        '<rootDir>/src/components/Card/*.test.tsx',
        '<rootDir>/src/components/Carousel/*.test.tsx',
        '<rootDir>/src/components/Checkbox/*.test.tsx',
        '<rootDir>/src/components/CodeBlock/*.test.tsx',
        '<rootDir>/src/components/Collapse/*.test.tsx',
        '<rootDir>/src/components/Countdown/*.test.tsx',
        '<rootDir>/src/components/Countdown/*.test.ts',
        '<rootDir>/src/components/Cursor/*.test.tsx',
        '<rootDir>/src/components/DatePicker/*.test.tsx',
        '<rootDir>/src/components/DatePicker/*.test.ts',
        '<rootDir>/src/components/Divider/*.test.tsx',
        '<rootDir>/src/components/Drawer/*.test.tsx',
        '<rootDir>/src/components/Footer/*.test.tsx',
        '<rootDir>/src/components/Form/*.test.tsx',
        '<rootDir>/src/components/Image/*.test.tsx',
        '<rootDir>/src/components/Input/*.test.tsx',
        '<rootDir>/src/components/Loading/*.test.tsx',
        '<rootDir>/src/components/Modal/*.test.tsx',
        '<rootDir>/src/components/Notification/*.test.tsx',
        '<rootDir>/src/components/Pagination/*.test.tsx',
        '<rootDir>/src/components/Progress/*.test.tsx',
        '<rootDir>/src/components/Radio/*.test.tsx',
        '<rootDir>/src/components/Select/*.test.tsx',
        '<rootDir>/src/components/Select/*.test.ts',
        '<rootDir>/src/components/Skeleton/*.test.tsx',
        '<rootDir>/src/components/Switch/*.test.tsx',
        '<rootDir>/src/components/Table/*.test.tsx',
        '<rootDir>/src/components/Tabs/*.test.tsx',
        '<rootDir>/src/components/Tag/*.test.tsx',
        '<rootDir>/src/components/Time/*.test.tsx',
        '<rootDir>/src/components/TimePicker/*.test.tsx',
        '<rootDir>/src/components/TimePicker/*.test.ts',
        '<rootDir>/src/components/Title/*.test.tsx',
        '<rootDir>/src/components/Typewriter/*.test.tsx',
        '<rootDir>/src/components/Tooltip/*.test.tsx',
        '<rootDir>/src/components/Tooltip/*.test.ts',
        '<rootDir>/src/theme/*.test.ts',
        '<rootDir>/src/theme/*.test.tsx',
    ],
    collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}'],
};
