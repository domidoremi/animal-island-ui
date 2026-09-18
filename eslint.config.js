/**
 * ESLint 配置（RN 版）。
 *
 * 为什么是 CJS：本分支的 `package.json` 没有 `"type": "module"`（上游是 ESM），
 * 所以 `eslint.config.js` 按 CJS 加载。上游那份 ESM 配置（import vite /
 * react-refresh / globals）在本分支已无意义，这里整体替换。
 *
 * 基线用 `@react-native/eslint-config/flat`：它自带 react / react-hooks /
 * react-native / jest / @typescript-eslint / eslint-config-prettier，
 * 且 peerDependencies 允许 `eslint ^9`（0.87.1 起提供 `./flat` 入口）。
 * 注意它**不带** type-aware linting（parser 没传 `project`），所以跑得很快，
 * 也不会因为未移植的 Web 文件不在 tsconfig include 里而报 parser 错。
 *
 * 尚未移植的 Web 组件是**动态**忽略的，见 `unportedComponents()`：
 * 每移植一个组件不需要回来改这个文件。
 */
const fs = require('node:fs');
const path = require('node:path');
const rnConfig = require('@react-native/eslint-config/flat');

const COMPONENTS_DIR = path.join(__dirname, 'src', 'components');

/**
 * 尚未移植到 RN 的组件目录名。
 *
 * 判据：`src/components/<Name>/<Name>.tsx` 里没有 `from 'react-native'`。
 * 移植后的实现一定 import react-native，未移植的 Web 版一定不 import，
 * 所以这个判据是自洽的，不需要额外维护一张表。
 */
function unportedComponents() {
    if (!fs.existsSync(COMPONENTS_DIR)) {
        return [];
    }
    return fs
        .readdirSync(COMPONENTS_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((name) => {
            const entryFile = path.join(COMPONENTS_DIR, name, `${name}.tsx`);
            // 没有同名入口文件 = 不是「已移植」的形态，按未移植处理
            if (!fs.existsSync(entryFile)) {
                return true;
            }
            return !/from\s+['"]react-native['"]/.test(fs.readFileSync(entryFile, 'utf8'));
        });
}

const UNPORTED = unportedComponents().map((name) => `src/components/${name}/**`);

module.exports = [
    {
        ignores: [
            'dist/**',
            'coverage/**',
            'node_modules/**',

            // Web 遗留：demo 站点、vitest 测试工具、文档同步脚本
            'demo/**',
            'test/**',
            'scripts/**',

            // 上游 Web 版构建/测试配置，本分支已不使用
            'vite.config.ts',
            'vite.config.demo.ts',
            'vitest.config.ts',
            'vitest.a11y.config.ts',
            'tsconfig.test.json',

            // 尚未移植到 RN 的组件（随移植进度自动收缩）
            ...UNPORTED,
        ],
    },

    // RN 官方基线：prettier 冲突项 + react / react-hooks / react-native / jest
    ...rnConfig,

    {
        files: ['src/**/*.{ts,tsx}'],
        rules: {
            // 与上游 eslint.config.js 保持一致的几条
            '@typescript-eslint/no-unused-vars': [
                'warn',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
            ],
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-empty-function': 'off',
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'prefer-const': 'warn',
            // `null: 'ignore'`：`x != null` 是「非 null 且非 undefined」的惯用写法，
            // 上游有 9 个组件（CodeBlock / Countdown / DatePicker / Drawer / Form /
            // Modal / Notification / TimePicker / Typewriter）都这么写，强行改成
            // `!== null && !== undefined` 是无意义的改写。
            eqeqeq: ['error', 'always', { null: 'ignore' }],
        },
    },

    {
        files: ['**/*.test.{ts,tsx}'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            'no-console': 'off',
        },
    },
];
