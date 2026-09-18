import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { Image } from './Image';

/**
 * RN 版测试，对应 Web 版 `Image.test.tsx` 的 16 个用例。
 *
 * **被丢弃的用例 / 断言**：
 *   - 「preview：按 ESC 关闭预览」—— RN 没有 DOM 键盘事件。等价物是
 *     `Modal.onRequestClose`（Android 实体返回键），已单独补测。
 *   - 上游打开预览时的焦点管理（`closeBtnRef.focus()`、Tab 圈定、关闭后焦点归还）
 *     —— RN 没有 DOM 焦点，整条丢弃（上游也没为它写用例）。
 *   - `className` 断言（`styles.image` / `styles['image-app-pink']` / `styles.loaded` /
 *     `styles.error`）—— RN 无 className，全部改成断言对应 style 字段。
 *   - `screen.getByRole('img', { name })` 查主图 —— 正常分支下 RN 的相框是
 *     `Pressable`（preview 默认开启），可访问名来自内部 `Image` 的 `alt`，
 *     而 RNTL 的可访问名计算不会走进子节点的 `accessibilityLabel`，
 *     所以改为断言宿主 `Image` 的 `alt` / `source`。
 *   - 「`loading="lazy"`」—— RN 无懒加载，`lazy` 是空操作，改成钉住这条差异的用例。
 *   - 「stamp 变体应用齿孔类」—— 齿孔（`mask-composite`）、`filter: drop-shadow`、
 *     `::after` 网点在 RN 里没有等价物（见 `Image.tsx` 文件头），只断言可移植的部分。
 *
 * **RN 侧新增**：
 *   - 预览弹层声明自己会吃掉触摸（防穿透），对应上游 `e.stopPropagation()`。
 *   - `Modal.onRequestClose` 关闭预览。
 *   - 错误占位的装饰性图标带 `aria-hidden`，默认被查询排除。
 *   - `preview={false}` 时根节点不是按钮。
 *
 * ⚠️ **读断言前必须知道：jest preset 把 `View` / `Image` / `Modal` 都 mock 掉了**
 *   - `View` 的 mock 把 props **原样**透传，不做 RN 的 aria-* 改写
 *     （见 `RN-PORT.md` 的 `View`-mock 表）。所以这里断言的 `props['aria-label']` /
 *     `props['aria-modal']` / `props['aria-hidden']` 在真机上会变成
 *     `accessibilityLabel` / 对应字段；**`Pressable` 上的断言则与真机一致**。
 *   - `Modal` 的 mock 在 `visible === false` 时**渲染 null**，所以「关掉后查不到」
 *     这条断言是有效的。
 *   - `Image` 的 mock 把 props 原样透传，所以能直接读 `source` / `alt` / `resizeMode`。
 *
 * 本套测试**看不到**的东西：真实图片的加载与尺寸（RN 的 `Image` 不会按固有尺寸自适应，
 * 不传 `width` / `height` 时相框是 0×0 —— 见 `Image.tsx` 里 `width` 的注释）、
 * 阴影 / 圆角 / 齿孔等一切视觉效果。
 */

const HIDDEN = { includeHiddenElements: true } as const;

/**
 * 展开后的样式对象。
 * `toHaveStyle` 是子集匹配，键不存在时会直接失败，所以「某属性**没有**被设上」
 * （例如加载完成后的 `opacity`）只能读值。
 */
const styleOf = (node: TestInstance): Record<string, unknown> =>
    (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, unknown>;

const DEFAULT_FRAME_SHADOW =
    '0 13px 27px -5px rgba(50, 50, 93, 0.25), 0 8px 16px -8px rgba(0, 0, 0, 0.3), 0 -6px 16px -6px rgba(0, 0, 0, 0.03)';

describe('Image', () => {
    it('渲染图片并透传 src / alt', async () => {
        const { getByTestId } = await render(<Image src="photo.png" alt="岛屿风景" testID="im" />);
        const img = getByTestId('im-img');
        expect(img.props.source).toEqual({ uri: 'photo.png' });
        expect(img.props.alt).toBe('岛屿风景');
    });

    it('默认相框（variant=default）的样式 —— 替代 Web 版的 className 断言', async () => {
        const { getByTestId } = await render(<Image src="photo.png" alt="x" testID="im" />);
        expect(getByTestId('im')).toHaveStyle({
            padding: 0,
            backgroundColor: 'transparent',
            borderRadius: 12,
            boxShadow: DEFAULT_FRAME_SHADOW,
        });
    });

    it('bordered 相框保留基类的白底 / 内边距 / 小圆角', async () => {
        const { getByTestId } = await render(<Image src="photo.png" alt="x" testID="im" variant="bordered" />);
        expect(getByTestId('im')).toHaveStyle({
            backgroundColor: '#fff',
            padding: 12,
            borderRadius: 8,
            boxShadow: '0 8px 14px 0 rgba(0, 0, 0, 0.08)',
        });
    });

    it('width / height 生效', async () => {
        const { getByTestId } = await render(<Image src="photo.png" alt="x" testID="im" width={200} height={120} />);
        expect(getByTestId('im')).toHaveStyle({ width: 200, height: 120 });
    });

    it('color 应用对应调色板底色（非 white 时，仅 bordered 生效）', async () => {
        const bordered = await render(
            <Image src="photo.png" alt="x" testID="im" color="app-pink" variant="bordered" />
        );
        expect(bordered.getByTestId('im')).toHaveStyle({ backgroundColor: '#fde4e8' });

        // default 变体不吃色板
        const def = await render(<Image src="photo.png" alt="x" testID="im" color="app-pink" variant="default" />);
        expect(def.getByTestId('im')).toHaveStyle({ backgroundColor: 'transparent' });
    });

    it('未传 color 或 color=white 时用基类的白色衬板', async () => {
        const undef = await render(<Image src="photo.png" alt="x" testID="im" variant="bordered" />);
        expect(undef.getByTestId('im')).toHaveStyle({ backgroundColor: '#fff' });

        const white = await render(<Image src="photo.png" alt="x" testID="im" color="white" variant="bordered" />);
        expect(white.getByTestId('im')).toHaveStyle({ backgroundColor: '#fff' });
    });

    it('color=default 应用奶油色（仅 bordered 生效）', async () => {
        const bordered = await render(<Image src="photo.png" alt="x" testID="im" color="default" variant="bordered" />);
        expect(bordered.getByTestId('im')).toHaveStyle({ backgroundColor: 'rgb(247, 243, 223)' });

        const def = await render(<Image src="photo.png" alt="x" testID="im" color="default" variant="default" />);
        expect(def.getByTestId('im')).toHaveStyle({ backgroundColor: 'transparent' });
    });

    it('stamp 变体只保留可移植的邮票外观，且不叠加色板背景', async () => {
        const { getByTestId } = await render(
            <Image src="photo.png" alt="x" testID="im" variant="stamp" color="app-pink" />
        );
        const root = getByTestId('im');
        expect(root).toHaveStyle({ backgroundColor: '#fbfaf5', padding: 14, borderRadius: 0 });
        // 色板不生效；基类的柔和阴影也不出现（上游 `.variant-stamp { box-shadow: none }`）
        expect(styleOf(root).boxShadow).toBeUndefined();
    });

    it('stamp + stampYear 渲染年份覆盖层，未传则不渲染', async () => {
        const withYear = await render(<Image src="photo.png" alt="x" testID="im" variant="stamp" stampYear="2026" />);
        expect(withYear.getByTestId('im-stamp-year').children[0]).toBe('2026');

        const withoutYear = await render(<Image src="photo.png" alt="x" testID="im" variant="stamp" />);
        expect(withoutYear.queryByTestId('im-stamp-year')).toBeNull();
    });

    it('lazy 在 RN 侧是空操作（Web 的 loading="lazy" 无对应能力）', async () => {
        const { getByTestId } = await render(<Image src="photo.png" alt="x" testID="im" lazy />);
        expect(getByTestId('im-img').props.loading).toBeUndefined();
    });

    it('onLoad 触发后图片才可见（替代 Web 版的 .loaded 类断言）', async () => {
        const onLoad = jest.fn();
        const { getByTestId } = await render(<Image src="photo.png" alt="x" testID="im" onLoad={onLoad} />);
        expect(styleOf(getByTestId('im-img')).opacity).toBe(0);

        await fireEvent(getByTestId('im-img'), 'load');
        expect(onLoad).toHaveBeenCalledTimes(1);
        expect(styleOf(getByTestId('im-img')).opacity).toBeUndefined();
    });

    it('onError：加载失败时显示错误占位', async () => {
        const onError = jest.fn();
        const { getByTestId, getByText } = await render(
            <Image src="broken.png" alt="坏图" testID="im" onError={onError} />
        );
        await fireEvent(getByTestId('im-img'), 'error');

        expect(onError).toHaveBeenCalledTimes(1);
        expect(getByTestId('im')).toHaveStyle({ flexDirection: 'column' });
        expect(getByText('图片加载失败')).toBeTruthy();
        // `role="img"` + `aria-label={alt || '图片加载失败'}`（View 的 aria-* 在测试里是原样透传）
        expect(getByTestId('im').props.role).toBe('img');
        expect(getByTestId('im').props['aria-label']).toBe('坏图');
    });

    it('错误占位里 alt 为空时回退到默认可访问名', async () => {
        const { getByTestId } = await render(<Image src="broken.png" testID="im" />);
        await fireEvent(getByTestId('im-img'), 'error');
        expect(getByTestId('im').props['aria-label']).toBe('图片加载失败');
    });

    it('错误占位的装饰性图标带 aria-hidden，默认被查询排除', async () => {
        const { getByTestId } = await render(<Image src="broken.png" alt="x" testID="im" />);
        await fireEvent(getByTestId('im-img'), 'error');
        expect(() => getByTestId('im-error-icon')).toThrow();
        expect(getByTestId('im-error-icon', HIDDEN).props['aria-hidden']).toBe(true);
    });

    it('应用 style（替代 Web 版的 className + style 断言）', async () => {
        const { getByTestId } = await render(
            <Image src="photo.png" alt="x" testID="im" style={{ margin: 4 }} preview={false} />
        );
        expect(getByTestId('im')).toHaveStyle({ margin: 4 });
    });

    it('preview 默认开启：未传 preview 也可点击预览', async () => {
        const { getByTestId } = await render(<Image src="photo.png" alt="默认预览" testID="im" />);
        await fireEvent.press(getByTestId('im'));
        expect(getByTestId('im-dialog')).toBeTruthy();
    });

    it('preview：点击图片打开大图预览', async () => {
        const { getByTestId } = await render(<Image src="photo.png" alt="预览图" testID="im" />);
        await fireEvent.press(getByTestId('im'));

        const dialog = getByTestId('im-dialog');
        expect(dialog.props.role).toBe('dialog');
        expect(dialog.props['aria-modal']).toBe(true);
        expect(dialog.props['aria-label']).toBe('查看图片：预览图');
        expect(getByTestId('im-preview-image').props.source).toEqual({ uri: 'photo.png' });
    });

    it('preview：alt 为空时用默认对话框标签', async () => {
        const { getByTestId } = await render(<Image src="photo.png" testID="im" />);
        await fireEvent.press(getByTestId('im'));
        expect(getByTestId('im-dialog').props['aria-label']).toBe('图片预览');
    });

    it('preview：点击关闭按钮关闭预览', async () => {
        const { getByTestId, queryByTestId } = await render(<Image src="photo.png" alt="预览图" testID="im" />);
        await fireEvent.press(getByTestId('im'));
        await fireEvent.press(getByTestId('im-close'));
        expect(queryByTestId('im-dialog')).toBeNull();
    });

    it('preview：关闭按钮带可访问名', async () => {
        const { getByTestId, getByLabelText } = await render(<Image src="photo.png" alt="预览图" testID="im" />);
        await fireEvent.press(getByTestId('im'));
        expect(getByLabelText('关闭预览')).toBe(getByTestId('im-close'));
    });

    it('preview：点击遮罩空白处关闭预览', async () => {
        const { getByTestId, queryByTestId } = await render(<Image src="photo.png" alt="预览图" testID="im" />);
        await fireEvent.press(getByTestId('im'));
        await fireEvent.press(getByTestId('im-mask'));
        expect(queryByTestId('im-dialog')).toBeNull();
    });

    it('preview：Android 返回键（Modal.onRequestClose）关闭预览 —— 替代 Web 版的 Escape', async () => {
        const { getByTestId, queryByTestId, container } = await render(
            <Image src="photo.png" alt="预览图" testID="im" />
        );
        await fireEvent.press(getByTestId('im'));

        // RNTL v14 没有 `UNSAFE_getByType`；用 `queryAll` 按 prop 定位 Modal 的宿主节点
        const modals = container.queryAll((node) => typeof node.props.onRequestClose === 'function');
        expect(modals).toHaveLength(1);

        await act(async () => {
            modals[0].props.onRequestClose();
        });
        expect(queryByTestId('im-dialog')).toBeNull();
    });

    it('preview：弹层声明自己会吃掉触摸（替代上游的 stopPropagation）', async () => {
        const { getByTestId } = await render(<Image src="photo.png" alt="预览图" testID="im" />);
        await fireEvent.press(getByTestId('im'));
        // 注意：这里断言的是**机制**而不是行为。RNTL 的 `fireEvent.press` 是向上找 `onPress`，
        // 遮罩是弹层的**父**节点，所以「点弹层不会关掉预览」这条用 press 测出来是假象。
        expect(getByTestId('im-dialog').props.onStartShouldSetResponder?.()).toBe(true);
    });

    it('preview：加载失败时不渲染预览按钮', async () => {
        const { getByTestId, getByText, queryByRole } = await render(
            <Image src="broken.png" alt="坏图" testID="im" preview />
        );
        await fireEvent(getByTestId('im-img'), 'error');
        expect(queryByRole('button')).toBeNull();
        expect(getByText('图片加载失败')).toBeTruthy();
    });

    it('preview=false 时根节点不是按钮', async () => {
        const { getByTestId, queryByRole } = await render(
            <Image src="photo.png" alt="x" testID="im" preview={false} />
        );
        expect(queryByRole('button')).toBeNull();
        expect(getByTestId('im-img')).toBeTruthy();
    });

    it('preview=false 时点击不打开预览', async () => {
        const { getByTestId, queryByTestId } = await render(
            <Image src="photo.png" alt="x" testID="im" preview={false} />
        );
        await fireEvent.press(getByTestId('im'));
        expect(queryByTestId('im-dialog')).toBeNull();
    });

    it('错误占位仍叠加色板底色（上游这条分支没有 variant 判断，是不对称的）', async () => {
        const { getByTestId } = await render(
            <Image src="broken.png" alt="x" testID="im" color="app-pink" variant="default" />
        );
        await fireEvent(getByTestId('im-img'), 'error');
        // `.error`（L142）在 `.image-app-pink`（L163）之前，样式表顺序上后者胜：
        // 底色来自色板，文字色也来自色板（不是 `.error` 的 #c4b89e）
        expect(getByTestId('im')).toHaveStyle({ backgroundColor: '#fde4e8' });
        expect(getByTestId('im-error-text')).toHaveStyle({ color: '#a85565' });
    });

    it('src 变化时重置加载 / 失败状态', async () => {
        const { getByTestId, rerender, queryByTestId } = await render(<Image src="broken.png" alt="x" testID="im" />);
        await fireEvent(getByTestId('im-img'), 'error');
        expect(getByTestId('im').props.role).toBe('img');

        await rerender(<Image src="fixed.png" alt="x" testID="im" />);
        // 回到正常分支：有图片节点，且不再是 role="img" 的错误占位
        expect(getByTestId('im-img').props.source).toEqual({ uri: 'fixed.png' });
        expect(getByTestId('im').props.role).toBeUndefined();
        expect(queryByTestId('im-error-icon', HIDDEN)).toBeNull();
    });

    it('resizeMode 用 stretch 对应 CSS 的 object-fit: fill（RN 默认是 cover）', async () => {
        const { getByTestId } = await render(<Image src="photo.png" alt="x" testID="im" />);
        expect(getByTestId('im-img').props.resizeMode).toBe('stretch');
    });
});
