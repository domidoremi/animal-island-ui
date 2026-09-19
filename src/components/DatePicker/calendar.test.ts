/**
 * `calendar.ts` 的单测。
 *
 * 这些算术在组件测试里**测不到**：面板定位靠 `measureInWindow`（被 mock 成永不回调），
 * 日期网格的边界（月末 / 闰年 / 跨年 / 首尾补格）靠点击 UI 覆盖起来极啰嗦。
 * 挪成纯函数后逐条钉住。
 */

import {
    GRID_CELLS,
    PANEL_GAP,
    PANEL_HEIGHT_ESTIMATE,
    WEEKDAYS,
    buildCells,
    buildYearCells,
    cellRangeRole,
    computePanelPosition,
    effectiveRange,
    formatDate,
    isSameDay,
    isSameMonth,
    parseRange,
    parseValue,
    toMonthValue,
    toValue,
    yearDecade,
} from './calendar';

describe('parseValue', () => {
    it('解析 YYYY-MM-DD', () => {
        const d = parseValue('2026-08-10');
        expect(d).not.toBeNull();
        expect(toValue(d as Date)).toBe('2026-08-10');
    });

    it('缺少日时按 1 号补', () => {
        expect(toValue(parseValue('2026-08') as Date)).toBe('2026-08-01');
    });

    it('个位月/日也能解析（正则允许 1~2 位）', () => {
        expect(toValue(parseValue('2026-8-9') as Date)).toBe('2026-08-09');
    });

    it('月份 > 12 判非法', () => {
        expect(parseValue('2026-13-01')).toBeNull();
    });

    it('空值 / 非日期字符串 / 完全不匹配均返回 null', () => {
        expect(parseValue(null)).toBeNull();
        expect(parseValue(undefined)).toBeNull();
        expect(parseValue('')).toBeNull();
        expect(parseValue('not-a-date')).toBeNull();
    });
});

describe('toValue / toMonthValue', () => {
    it('月与日补零到两位', () => {
        expect(toValue(new Date(2026, 0, 5))).toBe('2026-01-05');
        expect(toMonthValue(new Date(2026, 0, 5))).toBe('2026-01');
    });

    it('12 月不需要进位处理', () => {
        expect(toValue(new Date(2026, 11, 31))).toBe('2026-12-31');
        expect(toMonthValue(new Date(2026, 11, 31))).toBe('2026-12');
    });
});

describe('formatDate', () => {
    const d = new Date(2026, 7, 5);

    it('YYYY-MM-DD（默认）', () => {
        expect(formatDate(d, 'YYYY-MM-DD')).toBe('2026-08-05');
    });

    it('YYYY年MM月DD日', () => {
        expect(formatDate(d, 'YYYY年MM月DD日')).toBe('2026年08月05日');
    });

    it('单位数占位符 M / D 不补零', () => {
        expect(formatDate(d, 'YYYY-M-D')).toBe('2026-8-5');
    });

    it('YYYY-MM（月份选择模式的默认格式）', () => {
        expect(formatDate(d, 'YYYY-MM')).toBe('2026-08');
    });

    it('⚠️ 替换顺序敏感：YYYY 必须先于 M/D，否则 Y 会被误伤', () => {
        // 若先跑 .replace('M', ...) 再 .replace('YYYY', ...)，
        // 'Y' 不在 M/D 的匹配范围内，真正会出问题的是 'D' 撞上 'YYYY' 之外的字符。
        // 这里钉住的是：含字面量 M/D 的模板（如月份名）不被日期数字替换掉。
        expect(formatDate(d, 'YYYY-MM')).not.toContain('undefined');
        expect(formatDate(new Date(2026, 11, 25), 'YYYY/MM/DD')).toBe('2026/12/25');
    });
});

describe('isSameDay / isSameMonth', () => {
    it('同年同月同日', () => {
        expect(isSameDay(new Date(2026, 7, 10), new Date(2026, 7, 10))).toBe(true);
    });

    it('同一天但时不同不算跨天（只比年月日）', () => {
        expect(isSameDay(new Date(2026, 7, 10, 0, 0), new Date(2026, 7, 10, 23, 59))).toBe(true);
    });

    it('跨年同月同日为 false', () => {
        expect(isSameDay(new Date(2026, 7, 10), new Date(2027, 7, 10))).toBe(false);
    });

    it('isSameMonth 只比年月', () => {
        expect(isSameMonth(new Date(2026, 7, 1), new Date(2026, 7, 31))).toBe(true);
        expect(isSameMonth(new Date(2026, 7, 1), new Date(2026, 8, 1))).toBe(false);
    });
});

describe('parseRange', () => {
    it('两端合法 → 二元组', () => {
        const r = parseRange(['2026-08-10', '2026-08-12']);
        expect(r).not.toBeNull();
        expect(toValue((r as [Date, Date])[0])).toBe('2026-08-10');
        expect(toValue((r as [Date, Date])[1])).toBe('2026-08-12');
    });

    it('任一端非法 → null', () => {
        expect(parseRange(['2026-13-01', '2026-08-12'])).toBeNull();
        expect(parseRange(['2026-08-10', 'bad'])).toBeNull();
    });

    it('字符串 / null 不是范围 → null', () => {
        expect(parseRange('2026-08-10')).toBeNull();
        expect(parseRange(null)).toBeNull();
    });
});

describe('buildCells', () => {
    it('固定 42 格', () => {
        expect(buildCells(new Date(2026, 7, 1))).toHaveLength(GRID_CELLS);
    });

    it('2026-08：1 号是周六 → 前面补 6 天上月，末尾补下月', () => {
        const cells = buildCells(new Date(2026, 7, 1));
        expect(cells[0].getMonth()).toBe(6); // 上月 = 7 月
        expect(cells[6].getMonth()).toBe(7); // 第 7 格起才是 8 月 1 号
        expect(cells[6].getDate()).toBe(1);
        expect(cells[41].getMonth()).toBe(8); // 末尾补 9 月
    });

    it('2026-02（28 天，1 号周日）→ 前面不补，末尾补满', () => {
        const cells = buildCells(new Date(2026, 1, 1));
        expect(cells[0].getMonth()).toBe(1);
        expect(cells[0].getDate()).toBe(1);
        expect(cells[41].getMonth()).toBe(2);
    });

    it('2024-02（闰年 29 天）→ 含 2 月 29 号', () => {
        const cells = buildCells(new Date(2024, 1, 1));
        expect(cells.some((c) => c.getMonth() === 1 && c.getDate() === 29)).toBe(true);
    });

    it('2027-01：1 号是周五 → 前面补 5 天（跨回上一年 12 月）', () => {
        const cells = buildCells(new Date(2027, 0, 1));
        // 起始星期 5 → 前补 5 格，索引 0..4 = 2026-12-27..31
        expect(cells[0].getFullYear()).toBe(2026);
        expect(cells[0].getMonth()).toBe(11);
        expect(cells[0].getDate()).toBe(27);
        expect(cells[4]).toEqual(new Date(2026, 11, 31));
        expect(cells[5]).toEqual(new Date(2027, 0, 1));
    });

    it('整月天数不重不漏', () => {
        const cells = buildCells(new Date(2026, 7, 1));
        const august = cells.filter((c) => c.getMonth() === 7).map((c) => c.getDate());
        expect(august).toHaveLength(31);
        expect(august[0]).toBe(1);
        expect(august[30]).toBe(31);
    });
});

describe('buildYearCells / yearDecade', () => {
    it('12 个年份，从所在十年的前一年起', () => {
        expect(buildYearCells(2026)).toEqual([2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030]);
    });

    it('整十年的边界：2030 落在 2030~2039', () => {
        expect(buildYearCells(2030)[0]).toBe(2029);
        expect(yearDecade(2030)).toEqual([2030, 2039]);
    });

    it('yearDecade 与 buildYearCells 的首格一致（差 1）', () => {
        expect(buildYearCells(2026)[1]).toBe(yearDecade(2026)[0]);
    });
});

describe('effectiveRange（范围高亮端点）', () => {
    const d = (day: number) => new Date(2026, 7, day);
    const selected: [Date, Date] = [d(10), d(12)];

    it('无进行中的选择 → 用已提交的范围', () => {
        expect(effectiveRange({ rangeStart: null, rangeEnd: null, hoverDate: null, selectedRange: selected })).toEqual({
            start: d(10),
            end: d(12),
        });
    });

    it('已选定起止 → 用待选范围（盖掉已提交的范围）', () => {
        const r = effectiveRange({
            rangeStart: d(15),
            rangeEnd: d(20),
            hoverDate: null,
            selectedRange: selected,
        });
        expect(toValue(r.start as Date)).toBe('2026-08-15');
        expect(toValue(r.end as Date)).toBe('2026-08-20');
    });

    it('只有开始 + 正向预览 → 预览日期成为潜在终点', () => {
        const r = effectiveRange({ rangeStart: d(10), rangeEnd: null, hoverDate: d(15), selectedRange: selected });
        expect(toValue(r.start as Date)).toBe('2026-08-10');
        expect(toValue(r.end as Date)).toBe('2026-08-15');
    });

    it('只有开始 + 反向预览（早于开始）→ 预览日期成为新的潜在起点', () => {
        const r = effectiveRange({ rangeStart: d(15), rangeEnd: null, hoverDate: d(10), selectedRange: selected });
        expect(toValue(r.start as Date)).toBe('2026-08-10');
        expect(toValue(r.end as Date)).toBe('2026-08-15');
    });

    it('只有开始 + 无预览 → 起止同点（只圈出开始）', () => {
        const r = effectiveRange({ rangeStart: d(15), rangeEnd: null, hoverDate: null, selectedRange: selected });
        expect(toValue(r.start as Date)).toBe('2026-08-15');
        expect(toValue(r.end as Date)).toBe('2026-08-15');
    });

    it('只有开始 + 预览等于开始 → 仍然起止同点（既不 > 也不 <）', () => {
        const r = effectiveRange({ rangeStart: d(15), rangeEnd: null, hoverDate: d(15), selectedRange: selected });
        expect(toValue(r.start as Date)).toBe('2026-08-15');
        expect(toValue(r.end as Date)).toBe('2026-08-15');
    });

    it('既无进行中的选择也无已提交范围 → 两端皆 null', () => {
        expect(effectiveRange({ rangeStart: null, rangeEnd: null, hoverDate: null, selectedRange: null })).toEqual({
            start: null,
            end: null,
        });
    });
});

describe('cellRangeRole', () => {
    const d = (day: number) => new Date(2026, 7, day);

    it('起点 / 终点 / 区间内的格子', () => {
        const range = { start: d(10), end: d(15) };
        expect(cellRangeRole(d(10), range)).toEqual({ isStart: true, isEnd: false, inRange: false });
        expect(cellRangeRole(d(15), range)).toEqual({ isStart: false, isEnd: true, inRange: false });
        expect(cellRangeRole(d(12), range)).toEqual({ isStart: false, isEnd: false, inRange: true });
    });

    it('区间外不亮', () => {
        const range = { start: d(10), end: d(15) };
        expect(cellRangeRole(d(9), range).inRange).toBe(false);
        expect(cellRangeRole(d(16), range).inRange).toBe(false);
    });

    it('起止同点时两端都亮在同一格、无区间', () => {
        const range = { start: d(10), end: d(10) };
        const role = cellRangeRole(d(10), range);
        expect(role.isStart).toBe(true);
        expect(role.isEnd).toBe(true);
        expect(role.inRange).toBe(false);
    });

    it('端点为 null 时全 false', () => {
        expect(cellRangeRole(d(10), { start: null, end: null })).toEqual({
            isStart: false,
            isEnd: false,
            inRange: false,
        });
    });
});

describe('computePanelPosition', () => {
    const win = { width: 400, height: 800 };
    const trigger = { x: 20, y: 100, width: 200, height: 40 };

    it('下方空间充足 → 向下展开，左对齐', () => {
        expect(computePanelPosition(trigger, win, false)).toEqual({
            top: 100 + 40 + PANEL_GAP,
            left: 20,
        });
    });

    it('下方放不下且上方更宽裕 → 向上翻转', () => {
        // 触发区贴底：y=700，700+40+340 > 800，且 700 > 800-740
        expect(computePanelPosition({ ...trigger, y: 700 }, win, false)).toEqual({
            bottom: 800 - 700 + PANEL_GAP,
            left: 20,
        });
    });

    it('下方放不下但上方也不宽裕 → 仍向下（上游没有第三分支）', () => {
        // y=430：430+40+340=810 > 800；800-(430+40)=330，430 > 330 → 翻上
        expect(computePanelPosition({ ...trigger, y: 430 }, win, false)).toEqual({
            bottom: 800 - 430 + PANEL_GAP,
            left: 20,
        });
        // y=300：300+40+340=680 < 800 → 不触发翻转
        expect(computePanelPosition({ ...trigger, y: 300 }, win, false)).toEqual({
            top: 300 + 40 + PANEL_GAP,
            left: 20,
        });
    });

    it('右侧空间不足 → 右对齐', () => {
        // 20 + 300 = 320 ≤ 400 → 左对齐
        expect(computePanelPosition(trigger, win, false).left).toBe(20);
        // 150 + 300 = 450 > 400 → 右对齐
        expect(computePanelPosition({ ...trigger, x: 150 }, win, false)).toEqual({
            top: 146,
            right: 400 - (150 + 200),
        });
    });

    it('范围模式的右对齐阈值更宽（620 vs 300），会提前触发', () => {
        // 同样的 x=100：单日期 100+300=400 ≤ 400 左对齐；范围 100+620=720 > 400 右对齐
        expect(computePanelPosition({ ...trigger, x: 100 }, win, false).left).toBe(100);
        expect(computePanelPosition({ ...trigger, x: 100 }, win, true).right).toBe(400 - 300);
    });

    it('⚠️ 上游的 340 是低估：真实面板比它高，所以贴底时翻转会偏早', () => {
        // 记下这个事实，别误以为是 bug 修掉
        expect(PANEL_HEIGHT_ESTIMATE).toBe(340);
    });
});

describe('WEEKDAYS', () => {
    it('7 个，从周日开始', () => {
        expect(WEEKDAYS).toHaveLength(7);
        expect(WEEKDAYS[0]).toBe('日');
    });
});
