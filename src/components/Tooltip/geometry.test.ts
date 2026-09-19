import {
    ARROW_INSET,
    ARROW_SIZE,
    ARROW_STICK_OUT,
    ISLAND_ARROW_INSET,
    ISLAND_ARROW_SIZE,
    TOOLTIP_GAP,
    arrowStyle,
    bubbleStyle,
    splitPlacement,
    verticalCenterTop,
} from './geometry';

describe('splitPlacement', () => {
    it('无后缀时 align 为 center', () => {
        expect(splitPlacement('top')).toEqual({ side: 'top', align: 'center' });
    });

    it('解析 -start / -end', () => {
        expect(splitPlacement('bottom-start')).toEqual({ side: 'bottom', align: 'start' });
        expect(splitPlacement('left-end')).toEqual({ side: 'left', align: 'end' });
    });

    it('12 个 placement 都能解析出合法 side/align', () => {
        const placements = [
            'top',
            'top-start',
            'top-end',
            'bottom',
            'bottom-start',
            'bottom-end',
            'left',
            'left-start',
            'left-end',
            'right',
            'right-start',
            'right-end',
        ] as const;
        const sides = new Set(['top', 'bottom', 'left', 'right']);
        const aligns = new Set(['center', 'start', 'end']);
        placements.forEach((p) => {
            const box = splitPlacement(p);
            expect(sides.has(box.side)).toBe(true);
            expect(aligns.has(box.align)).toBe(true);
        });
    });
});

describe('bubbleStyle', () => {
    it('top：气泡落在触发器上方，间距 = 10', () => {
        expect(bubbleStyle({ side: 'top', align: 'center' })).toEqual({
            bottom: '100%',
            marginBottom: TOOLTIP_GAP,
            alignSelf: 'center',
        });
    });

    it('bottom：气泡落在触发器下方', () => {
        expect(bubbleStyle({ side: 'bottom', align: 'center' })).toEqual({
            top: '100%',
            marginTop: TOOLTIP_GAP,
            alignSelf: 'center',
        });
    });

    it('left / right：沿水平方向推开', () => {
        expect(bubbleStyle({ side: 'left', align: 'center' })).toEqual({
            right: '100%',
            marginRight: TOOLTIP_GAP,
        });
        expect(bubbleStyle({ side: 'right', align: 'center' })).toEqual({
            left: '100%',
            marginLeft: TOOLTIP_GAP,
        });
    });

    it('上下的 start / end 用 left / right 贴边（替代 Web 的 left:0 / right:0）', () => {
        expect(bubbleStyle({ side: 'top', align: 'start' }).left).toBe(0);
        expect(bubbleStyle({ side: 'top', align: 'end' }).right).toBe(0);
        expect(bubbleStyle({ side: 'bottom', align: 'start' }).left).toBe(0);
        expect(bubbleStyle({ side: 'bottom', align: 'end' }).right).toBe(0);
    });

    it('左右的 start / end 用 top / bottom 贴边', () => {
        expect(bubbleStyle({ side: 'left', align: 'start' }).top).toBe(0);
        expect(bubbleStyle({ side: 'left', align: 'end' }).bottom).toBe(0);
        expect(bubbleStyle({ side: 'right', align: 'end' }).bottom).toBe(0);
    });

    it('左右的 center 不给垂直偏移（留给测量值），这是与 Web 的一处已知差异', () => {
        const s = bubbleStyle({ side: 'left', align: 'center' });
        expect(s.top).toBeUndefined();
        expect(s.bottom).toBeUndefined();
    });
});

describe('verticalCenterTop', () => {
    it('双重高度差的一半', () => {
        expect(verticalCenterTop(100, 40)).toBe(30);
    });

    it('气泡比触发器高时夹到 0（不出现负偏移）', () => {
        expect(verticalCenterTop(40, 100)).toBe(0);
    });

    it('任一尺寸未测到 → null（退化为顶部对齐）', () => {
        expect(verticalCenterTop(undefined, 40)).toBeNull();
        expect(verticalCenterTop(100, undefined)).toBeNull();
    });
});

describe('arrowStyle', () => {
    it('默认变体：8px 方块 + 45 度旋转', () => {
        const s = arrowStyle({ side: 'top', align: 'center' }, 'default', true);
        expect(s.width).toBe(ARROW_SIZE);
        expect(s.height).toBe(ARROW_SIZE);
        expect(s.transform).toEqual([{ rotate: '45deg' }]);
    });

    it('island：10px 方块', () => {
        expect(arrowStyle({ side: 'top', align: 'center' }, 'island', true).width).toBe(ISLAND_ARROW_SIZE);
    });

    it('沿主方向伸出气泡 5px', () => {
        expect(arrowStyle({ side: 'top', align: 'center' }, 'default', true).bottom).toBe(-ARROW_STICK_OUT);
        expect(arrowStyle({ side: 'bottom', align: 'center' }, 'default', true).top).toBe(-ARROW_STICK_OUT);
        expect(arrowStyle({ side: 'left', align: 'center' }, 'default', true).right).toBe(-ARROW_STICK_OUT);
        expect(arrowStyle({ side: 'right', align: 'center' }, 'default', true).left).toBe(-ARROW_STICK_OUT);
    });

    it('居中时用 50% + 半个身位的负 margin（RN 没有 translateX 百分比）', () => {
        const s = arrowStyle({ side: 'top', align: 'center' }, 'default', true);
        expect(s.left).toBe('50%');
        expect(s.marginLeft).toBe(-ARROW_SIZE / 2);
    });

    it('start / end 用固定内缩：默认 16px，island 20px', () => {
        expect(arrowStyle({ side: 'top', align: 'start' }, 'default', true).left).toBe(ARROW_INSET);
        expect(arrowStyle({ side: 'top', align: 'start' }, 'island', true).left).toBe(ISLAND_ARROW_INSET);
    });

    it('每个方向描它该描的两条边（Web 用 rotate(45deg) 的方块拼小三角）', () => {
        expect(arrowStyle({ side: 'top', align: 'center' }, 'default', true)).toMatchObject({
            borderRightWidth: 2,
            borderBottomWidth: 2,
        });
        expect(arrowStyle({ side: 'bottom', align: 'center' }, 'default', true)).toMatchObject({
            borderTopWidth: 2,
            borderLeftWidth: 2,
        });
        expect(arrowStyle({ side: 'left', align: 'center' }, 'default', true)).toMatchObject({
            borderTopWidth: 2,
            borderRightWidth: 2,
        });
        expect(arrowStyle({ side: 'right', align: 'center' }, 'default', true)).toMatchObject({
            borderBottomWidth: 2,
            borderLeftWidth: 2,
        });
    });

    it('borderless 时不描边', () => {
        const s = arrowStyle({ side: 'top', align: 'center' }, 'default', false);
        expect(s.borderRightWidth).toBeUndefined();
        expect(s.borderBottomWidth).toBeUndefined();
    });

    it('island + borderless：退化成一个 14px 圆点，不旋转（.island.borderless .tail）', () => {
        const s = arrowStyle({ side: 'top', align: 'center' }, 'island', false);
        expect(s.width).toBe(14);
        expect(s.height).toBe(14);
        expect(s.borderRadius).toBe(7);
        expect(s.transform).toBeUndefined();
    });
});
