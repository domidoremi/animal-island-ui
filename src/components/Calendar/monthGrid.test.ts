import dayjs from 'dayjs';
import { gridStartOf, layoutEvents, clampToGrid, pointToCell, textOf } from './monthGrid';

it.each(['2026-01-01', '2026-02-01', '2024-02-01', '2026-12-01'])(
    'starts %s on the Sunday of the first month week',
    (month) => {
        const start = gridStartOf(dayjs(month));
        expect(start.day()).toBe(0);
        expect(start.valueOf()).toBeLessThanOrEqual(dayjs(month).valueOf());
        expect(dayjs(month).diff(start, 'day')).toBeLessThan(7);
    }
);
it('cuts a cross-week event into bounded segments and counts all three days', () => {
    const layout = layoutEvents(
        [{ title: 'Trip', start: '2026-10-03', end: '2026-10-05' }],
        dayjs('2026-09-27'),
        dayjs('2026-10-01')
    );
    expect(layout.segments.map((segment) => [segment.index, segment.span, segment.continuation])).toEqual([
        [6, 1, false],
        [7, 2, true],
    ]);
    expect(layout.counts.reduce((sum, count) => sum + count, 0)).toBe(3);
});
it('clips events before the view without repeating the start time', () => {
    const layout = layoutEvents(
        [{ title: 'Long trip', start: '2026-09-20', end: '2026-09-29' }],
        dayjs('2026-09-27'),
        dayjs('2026-10-01')
    );
    expect(layout.segments[0]).toMatchObject({ index: 0, span: 3, continuation: true });
});
it('excludes events completely outside the six-week window', () => {
    const layout = layoutEvents(
        [
            { title: 'Past', start: '2020-01-01' },
            { title: 'Future', start: '2030-01-01' },
        ],
        dayjs('2026-09-27'),
        dayjs('2026-10-01')
    );
    expect(layout.segments).toHaveLength(0);
    expect(layout.counts.every((count) => count === 0)).toBe(true);
});
it('folds real overflow but never counts a temporary preview', () => {
    const preview = { title: '', start: '2026-10-05' };
    const events = ['A', 'B', 'C'].map((title) => ({ title, start: '2026-10-05' }));
    const layout = layoutEvents([...events, preview], dayjs('2026-09-27'), dayjs('2026-10-01'), preview);
    expect(layout.counts[8]).toBe(3);
    expect(layout.segments).toHaveLength(2);
});
it('reversed declared event ends stay on their start date', () => {
    const layout = layoutEvents(
        [{ title: 'One', start: '2026-10-05', end: '2026-10-01' }],
        dayjs('2026-09-27'),
        dayjs('2026-10-01')
    );
    expect(layout.segments[0]).toMatchObject({ span: 1, index: 8 });
});
it('clamps focus dates to either grid boundary', () => {
    const start = dayjs('2026-09-27');
    expect(clampToGrid(dayjs('2020-01-01'), start).isSame(start, 'day')).toBe(true);
    expect(clampToGrid(dayjs('2030-01-01'), start).format('YYYY-MM-DD')).toBe('2026-11-07');
});
it.each(Array.from({ length: 42 }, (_, index) => index))(
    'maps native gesture cell %s using screen-relative geometry',
    (index) => {
        expect(pointToCell((index % 7) * 44 + 22, Math.floor(index / 7) * 80 + 40, 308, 80)).toBe(index);
    }
);
it.each([
    [-1, 0],
    [0, -1],
    [308, 0],
    [0, 480],
])('cancels gesture outside (%s, %s)', (x, y) => {
    expect(pointToCell(x, y, 308, 80)).toBeNull();
});
it('rejects missing layout and extracts readable numeric titles', () => {
    expect(pointToCell(0, 0, 0, 80)).toBeNull();
    expect(textOf([0, false, ' Meeting'])).toBe('0 Meeting');
});
