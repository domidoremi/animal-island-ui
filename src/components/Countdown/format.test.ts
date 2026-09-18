import {
    COUNTDOWN_INTERVAL_MS,
    DIGIT_CYCLE,
    DIGIT_FACES,
    FACES_PER_STRIP,
    FACE_HEIGHT_RATIO,
    ROLL_DURATION_MS,
    SIZE_SPEC,
    WRAP_BREAKPOINT,
    colonOffsetY,
    computeRoll,
    faceHeight,
    formatRemaining,
    pad,
    parseFormat,
    rollTranslateY,
    shouldWrap,
    splitRemaining,
    toTimestamp,
} from './format';

/**
 * 这些逻辑在组件里**覆盖不到或只能间接验证**（滚动靠 DOM transition / Animated、
 * 模板解析与进位是纯边界条件），所以单独测纯函数。见 `format.ts` 顶部注释。
 */

describe('常量与上游样式表一致', () => {
    it('轮询周期与滚动时长', () => {
        // 上游 `window.setInterval(update, 250)` / `.digitStrip { transition: transform 0.35s }`
        expect(COUNTDOWN_INTERVAL_MS).toBe(250);
        expect(ROLL_DURATION_MS).toBe(350);
    });

    it('数字条面数与面高比例', () => {
        // `[...DIGIT_FACES, ...DIGIT_FACES]` = 20 面；`.digitCell { height: 1.2em }`
        expect(DIGIT_FACES).toHaveLength(DIGIT_CYCLE);
        expect(FACES_PER_STRIP).toBe(2 * DIGIT_CYCLE);
        expect(FACES_PER_STRIP).toBe(20);
        expect(FACE_HEIGHT_RATIO).toBe(1.2);
    });

    it('尺寸规格与 Less 的 .small / .middle / .large 一致', () => {
        // .small { min-height: 40px; font-size: 13px } .small .digitCell { font-size: 20px }
        expect(SIZE_SPEC.small).toEqual({ minHeight: 40, fontSize: 13, digitFontSize: 20 });
        expect(SIZE_SPEC.middle).toEqual({ minHeight: 48, fontSize: 14, digitFontSize: 26 });
        expect(SIZE_SPEC.large).toEqual({ minHeight: 56, fontSize: 16, digitFontSize: 34 });
    });

    it('换行断点 = Less 的 @media (max-width: 480px)', () => {
        expect(WRAP_BREAKPOINT).toBe(480);
        expect(shouldWrap(480)).toBe(true);
        expect(shouldWrap(481)).toBe(false);
        expect(shouldWrap(320)).toBe(true);
    });
});

describe('toTimestamp / pad', () => {
    it('Date 取毫秒时间戳，数字原样返回', () => {
        expect(toTimestamp(new Date(1_700_000_000_000))).toBe(1_700_000_000_000);
        expect(toTimestamp(42)).toBe(42);
    });

    it('补零到两位（不足补、超出不动）', () => {
        expect(pad(0)).toBe('00');
        expect(pad(7)).toBe('07');
        expect(pad(59)).toBe('59');
        expect(pad(100)).toBe('100');
    });
});

describe('parseFormat', () => {
    it('token 与字面量交替切分', () => {
        expect(parseFormat('HH:mm:ss')).toEqual([
            { kind: 'token', token: 'HH' },
            { kind: 'literal', text: ':' },
            { kind: 'token', token: 'mm' },
            { kind: 'literal', text: ':' },
            { kind: 'token', token: 'ss' },
        ]);
    });

    it('带中文与空格的字面量原样保留', () => {
        expect(parseFormat('DD 天 HH:mm:ss')).toEqual([
            { kind: 'token', token: 'DD' },
            { kind: 'literal', text: ' 天 ' },
            { kind: 'token', token: 'HH' },
            { kind: 'literal', text: ':' },
            { kind: 'token', token: 'mm' },
            { kind: 'literal', text: ':' },
            { kind: 'token', token: 'ss' },
        ]);
    });

    it('无 token 时整体是一个字面量；token 区分大小写（mm 是分钟，MM 不是）', () => {
        expect(parseFormat('稍后')).toEqual([{ kind: 'literal', text: '稍后' }]);
        expect(parseFormat('MM')).toEqual([{ kind: 'literal', text: 'MM' }]);
    });

    it('同一 token 可重复出现（正则的 lastIndex 不会跨调用残留）', () => {
        expect(parseFormat('ss:HH:ss')).toEqual([
            { kind: 'token', token: 'ss' },
            { kind: 'literal', text: ':' },
            { kind: 'token', token: 'HH' },
            { kind: 'literal', text: ':' },
            { kind: 'token', token: 'ss' },
        ]);
        // 第二次调用必须给出同样的结果（RegExp 的全局 lastIndex 必须被重置）
        expect(parseFormat('ss')).toEqual([{ kind: 'token', token: 'ss' }]);
    });
});

describe('splitRemaining', () => {
    it('秒向上取整：剩 1ms 也显示 01 秒', () => {
        expect(splitRemaining(1, 'HH:mm:ss').ss).toBe('01');
        expect(splitRemaining(0, 'HH:mm:ss')).toEqual({ DD: '00', HH: '00', mm: '00', ss: '00' });
    });

    it('65 秒 → 00:01:05', () => {
        expect(formatRemaining(65_000, 'HH:mm:ss')).toBe('00:01:05');
    });

    it('模板含 DD 时 HH 是「天内的时」，不含 DD 时 HH 可以超过 24', () => {
        const remaining = (24 * 60 * 60 + 2 * 60 * 60 + 3 * 60 + 4) * 1_000;
        expect(formatRemaining(remaining, 'DD 天 HH:mm:ss')).toBe('01 天 02:03:04');
        // 同一个剩余时间，不带 DD 时小时进位到 26
        expect(formatRemaining(remaining, 'HH:mm:ss')).toBe('26:03:04');
    });

    it('天数按 24 小时整除（25 小时 → 01 天 01 时）', () => {
        expect(formatRemaining(25 * 60 * 60 * 1_000, 'DD:HH')).toBe('01:01');
    });

    it('零值稳定输出全零', () => {
        expect(formatRemaining(0, 'mm:ss')).toBe('00:00');
    });

    it('入参为负会算出负号 —— 所以组件必须先 clamp', () => {
        // Math.ceil(-1000 / 1000) = -1，pad(-1) = '-1'。
        // 纯函数**不做** clamp，这是有意的：clamp 发生在组件的
        // `Math.max(0, toTimestamp(value) - Date.now())` 里。
        // 这条断言把该前提钉住，将来谁想「顺手在纯函数里补个 max」会先看到它。
        expect(formatRemaining(-1_000, 'mm:ss')).toBe('-1:-1');
    });
});

describe('faceHeight / rollTranslateY / colonOffsetY', () => {
    it('面高 = 1.2 × 数字字号', () => {
        expect(faceHeight(20)).toBeCloseTo(24);
        expect(faceHeight(26)).toBeCloseTo(31.2);
        expect(faceHeight(34)).toBeCloseTo(40.8);
    });

    it('第 n 面（20 面数字条，每面 5%）对应 translateY(-n × 面高)', () => {
        // Web: `translateY(-${pos * 5}%)`，5% × 20 面 = 一面高
        expect(rollTranslateY(0, 26)).toBeCloseTo(0);
        expect(rollTranslateY(1, 26)).toBeCloseTo(-31.2);
        expect(rollTranslateY(5, 26)).toBeCloseTo(-156);
        expect(rollTranslateY(9, 26)).toBeCloseTo(-280.8);
    });

    it('冒号上移 = -0.08 × 冒号字号（.colon { top: -0.08em }）', () => {
        expect(colonOffsetY(20)).toBeCloseTo(-1.6);
        expect(colonOffsetY(26)).toBeCloseTo(-2.08);
        expect(colonOffsetY(34)).toBeCloseTo(-2.72);
    });
});

describe('computeRoll', () => {
    it('数字不变 → 原地不动', () => {
        expect(computeRoll(5, '5', '5')).toEqual({ from: 5, to: 5, jumped: false });
    });

    it('减 1 走 1 步（向下滚）', () => {
        expect(computeRoll(5, '5', '4')).toEqual({ from: 5, to: 4, jumped: false });
        expect(computeRoll(9, '9', '8')).toEqual({ from: 9, to: 8, jumped: false });
    });

    it('0 → 9 的回绕同样只走 1 步', () => {
        // 初值 pos = 0（显示 0），下一秒变成 9：delta = (0 - 9 + 10) % 10 = 1
        expect(computeRoll(0, '0', '9')).toEqual({ from: 10, to: 9, jumped: true });
    });

    it('9 → 0 要走 9 步（不是反向跳一格）', () => {
        expect(computeRoll(9, '9', '0')).toEqual({ from: 9, to: 0, jumped: false });
    });

    it('跌出数字条时先 +10 瞬移，再滚——保证方向永远向下', () => {
        // 显示 3（pos = 3），下一秒要显示 9：delta = (3 - 9 + 10) % 10 = 4，
        // to = 3 - 4 = -1 < 0 → from = 13（同数字的下一循环位置），to = 9
        const step = computeRoll(3, '3', '9');
        expect(step).toEqual({ from: 13, to: 9, jumped: true });
        // 起点与终点都落在合法区间 [0, 20)
        expect(step.from).toBeGreaterThanOrEqual(0);
        expect(step.to).toBeGreaterThanOrEqual(0);
        expect(step.to).toBeLessThan(FACES_PER_STRIP);
    });

    it('终点始终 >= 0 且 < 20，且 to % 10 就是新数字', () => {
        // 不变量：当前位置必然满足 `current % 10 === Number(prevDigit)`
        // （数字条上「正显示的那一面」）。脱离这个不变量的组合在真实运行中不会出现。
        for (let prev = 0; prev < DIGIT_CYCLE; prev++) {
            for (let current = prev; current < FACES_PER_STRIP; current += DIGIT_CYCLE) {
                for (let next = 0; next < DIGIT_CYCLE; next++) {
                    const { to, from, jumped } = computeRoll(current, String(prev), String(next));
                    expect(to).toBeGreaterThanOrEqual(0);
                    expect(to).toBeLessThan(FACES_PER_STRIP);
                    expect(to % DIGIT_CYCLE).toBe(next);
                    expect(from).toBeLessThan(FACES_PER_STRIP);
                    if (jumped) expect(from - current).toBe(DIGIT_CYCLE);
                    else expect(from).toBe(current);
                }
            }
        }
    });

    it('每一步的位移都是 delta', () => {
        for (let prev = 0; prev < DIGIT_CYCLE; prev++) {
            // 取循环中段的位置（prev + 10），此时不会触发回绕
            for (let next = 0; next < DIGIT_CYCLE; next++) {
                if (prev === next) continue;
                const delta = (prev - next + DIGIT_CYCLE) % DIGIT_CYCLE;
                const { from, to } = computeRoll(prev + DIGIT_CYCLE, String(prev), String(next));
                expect(from - to).toBe(delta);
            }
        }
    });
});
