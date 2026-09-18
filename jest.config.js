/**
 * Jest 配置（RN 版）。
 *
 * preset 用 `@react-native/jest-preset`：**RN 0.87 把 jest preset 从 `react-native`
 * 包里拆出去了**（`react-native@0.87.1` 已无 `jest-preset.js`，写 `preset: 'react-native'`
 * 会报 `Module react-native should have "jest-preset.js"`）。官方模板 `@react-native-community/template@0.87.1`
 * 用的就是 `preset: '@react-native/jest-preset'` + `jest@^29.7.0`。
 *
 * testMatch 只覆盖**已移植到 RN** 的子集：`src/` 下还留着上游 Web 版的测试文件
 * （import `vitest` / `@testing-library/react` / `.module.less`），跑不了也没必要跑。
 * 每移植一个组件，往 testMatch 里加一条。
 */
module.exports = {
    preset: '@react-native/jest-preset',
    testMatch: [
        '<rootDir>/src/components/Divider/*.test.tsx',
        '<rootDir>/src/components/Button/*.test.tsx',
        '<rootDir>/src/components/Collapse/*.test.tsx',
        '<rootDir>/src/components/TimePicker/*.test.tsx',
        '<rootDir>/src/components/TimePicker/*.test.ts',
        '<rootDir>/src/theme/*.test.ts',
    ],
    collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}'],
};
