/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * a11y 烟雾测试专用配置
 * 独立于 vitest.config.ts：主配置的 include 只覆盖 src/**，a11y 测试放在 test/ 下，
 * 因此需要单独的 include 才能被收集。test/a11y.test.tsx 是跨组件集成测试，不归属任何单个组件。
 *
 * 为什么单独一个 config（而不是把 test/** 塞进主配置的 include）：
 *   - test:cov 的覆盖率口径保持只统计 src/ 下的单测，a11y 不参与阈值计算
 *   - 日常跑单测时 a11y 仍是独立的一档，可单独调试
 * 注意：npm run test:run 会串联本 config，所以「全绿」= 单测 + a11y 都跑过了，
 *      不要用 npx vitest run 直接指向 test/a11y.test.tsx（会被主配置的 include 过滤掉）。
 *
 * 与主配置唯一差异：
 *   - include 只指向 test/a11y.test.tsx
 * 其余（@ alias、jsdom、less 预处理、setup.ts）完全复用主配置，保持一致
 */
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
            '@test': resolve(__dirname, 'test'),
        },
    },
    css: {
        modules: {
            generateScopedName: 'animal-[local]-[hash:base64:5]',
            localsConvention: 'camelCase',
        },
        preprocessorOptions: {
            less: {
                javascriptEnabled: true,
                additionalData: `@import "${resolve(__dirname, 'src/styles/variables.less')}";`,
            },
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './test/setup.ts',
        css: true,
        include: ['test/a11y.test.tsx'],
    },
});
