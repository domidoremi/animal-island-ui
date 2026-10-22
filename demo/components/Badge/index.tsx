import React from 'react';
import { Badge, Avatar, type BadgeColor } from '../../../src';
import { BellIcon, GiftIcon, MailIcon } from 'naive-icons';
import {
    CodeBlock,
    ApiTable,
    ApiRow,
    sectionStyle,
    sectionTitleStyle,
    DemoTag,
    demoBodyStyle,
    labelStyle,
} from '../../tools';

const S = {
    row: {
        display: 'flex',
        gap: 28,
        flexWrap: 'wrap',
        alignItems: 'center',
    } as React.CSSProperties,
    colorRow: {
        display: 'flex',
        gap: 18,
        flexWrap: 'wrap',
        alignItems: 'center',
    } as React.CSSProperties,
    colorItem: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
    } as React.CSSProperties,
    colorLabel: {
        fontSize: 11,
        color: '#a0936e',
        fontWeight: 500,
    } as React.CSSProperties,
};

const BADGE_API: ApiRow[] = [
    {
        prop: 'count',
        desc: '展示的内容：数字 / 字符串，或任意 ReactNode（如 naive-icons 图标）',
        type: 'ReactNode',
        defaultVal: '-',
    },
    {
        prop: 'overflowCount',
        desc: '展示封顶的数字值，超过时显示为 `${overflowCount}+`',
        type: 'number',
        defaultVal: '99',
    },
    { prop: 'showZero', desc: '数值为 0 时是否展示', type: 'boolean', defaultVal: 'false' },
    { prop: 'dot', desc: '不展示数字，只展示一个小圆点', type: 'boolean', defaultVal: 'false' },
    {
        prop: 'size',
        desc: '尺寸，仅对数字角标生效（dot 尺寸固定）',
        type: `'small' | 'medium'`,
        defaultVal: "'medium'",
    },
    {
        prop: 'color',
        desc: '颜色（与 Card / Tag 同款调色板）',
        type: `'app-red' | 'app-pink' | 'app-orange' | 'app-yellow' | 'app-teal' | 'app-green' | 'app-blue' | 'purple' | 'lime-green' | 'yellow-green' | 'brown' | 'warm-peach-pink'`,
        defaultVal: "'app-red'",
    },
    { prop: 'children', desc: '徽标包裹的元素；不传即为独立使用', type: 'ReactNode', defaultVal: '-' },
    { prop: 'className', desc: '自定义类名', type: 'string', defaultVal: '-' },
    { prop: 'style', desc: '自定义样式', type: 'CSSProperties', defaultVal: '-' },
];

const COLORS: BadgeColor[] = [
    'app-red',
    'app-pink',
    'app-orange',
    'app-yellow',
    'app-teal',
    'app-green',
    'app-blue',
    'purple',
    'lime-green',
    'yellow-green',
    'brown',
    'warm-peach-pink',
];

const BadgeDemo: React.FC = () => (
    <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
            Badge <DemoTag>数字角标</DemoTag> <DemoTag>封顶数字</DemoTag> <DemoTag>小红点</DemoTag>{' '}
            <DemoTag>12 colors</DemoTag>
        </div>
        <div style={demoBodyStyle}>
            <div style={labelStyle}>基本：图标 / 头像右上角的徽标数</div>
            <div style={S.row}>
                <Badge count={5}>
                    <Avatar shape="square" size="large">
                        <BellIcon size={24} />
                    </Avatar>
                </Badge>
                <Badge count={12}>
                    <Avatar shape="square" size="large">
                        狸
                    </Avatar>
                </Badge>
                <Badge count={<GiftIcon size={12} />} color="purple">
                    <Avatar shape="square" size="large">
                        <MailIcon size={24} />
                    </Avatar>
                </Badge>
            </div>

            <div style={labelStyle}>count 为 0 时默认隐藏，showZero 可强制展示</div>
            <div style={S.row}>
                <Badge count={0}>
                    <Avatar shape="square" size="large">
                        零
                    </Avatar>
                </Badge>
                <Badge count={0} showZero>
                    <Avatar shape="square" size="large">
                        零
                    </Avatar>
                </Badge>
            </div>

            <div style={labelStyle}>独立使用：不包裹任何元素，可单独作为计数展示</div>
            <div style={S.row}>
                <Badge count={11} />
                <Badge count={25} color="app-teal" />
                <Badge count="新" color="app-orange" />
                <Badge count={0} showZero color="brown" />
            </div>

            <div style={labelStyle}>封顶数字：超过 overflowCount（默认 99）时显示为「99+」</div>
            <div style={S.row}>
                <Badge count={99}>
                    <Avatar shape="square" size="large">
                        99
                    </Avatar>
                </Badge>
                <Badge count={100}>
                    <Avatar shape="square" size="large">
                        100
                    </Avatar>
                </Badge>
                <Badge count={99} overflowCount={10}>
                    <Avatar shape="square" size="large">
                        10+
                    </Avatar>
                </Badge>
                <Badge count={1000} overflowCount={999}>
                    <Avatar shape="square" size="large">
                        <span style={{ fontSize: 16 }}>999+</span>
                    </Avatar>
                </Badge>
            </div>

            <div style={labelStyle}>讨嫌的小红点：没有具体数字，只有一个小圆点</div>
            <div style={S.row}>
                <Badge dot>
                    <Avatar shape="square" size="large">
                        <BellIcon size={24} />
                    </Avatar>
                </Badge>
                <Badge dot color="app-green">
                    <BellIcon size={26} />
                </Badge>
                <Badge dot color="app-teal">
                    <span style={{ fontSize: 14, color: '#725d42', fontWeight: 600 }}>一段文字</span>
                </Badge>
            </div>

            <div style={labelStyle}>size 尺寸（medium / small）</div>
            <div style={S.row}>
                <Badge count={5} size="medium">
                    <Avatar shape="square" size="large">
                        M
                    </Avatar>
                </Badge>
                <Badge count={5} size="small">
                    <Avatar shape="square" size="large">
                        S
                    </Avatar>
                </Badge>
                <Badge count={5} size="small" color="app-blue" />
            </div>

            <div style={labelStyle}>color 多彩徽标（与 Card / Tag 同一调色板）</div>
            <div style={S.colorRow}>
                {COLORS.map((color) => (
                    <div key={color} style={S.colorItem}>
                        <Badge count={12} color={color} />
                        <span style={S.colorLabel}>{color}</span>
                    </div>
                ))}
            </div>
        </div>
        <CodeBlock
            code={`import { Badge, Avatar } from 'animal-island-ui';
import { BellIcon } from 'naive-icons';

const App = () => (
    <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
        {/* 基本：包裹图标 / 头像 */}
        <Badge count={5}>
            <Avatar shape="square" size="large">
                <BellIcon size={24} />
            </Avatar>
        </Badge>

        {/* 0 默认隐藏，showZero 强制展示 */}
        <Badge count={0} showZero>
            <Avatar shape="square" size="large">零</Avatar>
        </Badge>

        {/* 独立使用：不包裹任何元素 */}
        <Badge count={25} color="app-teal" />

        {/* 封顶数字：100 → "99+" */}
        <Badge count={100} overflowCount={99}>
            <Avatar shape="square" size="large">100</Avatar>
        </Badge>

        {/* 小红点 */}
        <Badge dot>
            <Avatar shape="square" size="large">
                <BellIcon size={24} />
            </Avatar>
        </Badge>

        {/* 尺寸 */}
        <Badge count={5} size="small" color="app-blue">
            <Avatar shape="square" size="large">S</Avatar>
        </Badge>
    </div>
);

export default App;`}
        />
        <ApiTable rows={BADGE_API} />
    </div>
);

export default BadgeDemo;
