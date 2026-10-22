import React, { useState } from 'react';
import { Rate } from '../../../src';
import {
    labelStyle,
    ApiTable,
    CodeBlock,
    ApiRow,
    sectionStyle,
    sectionTitleStyle,
    DemoTag,
    demoBoxStyle,
} from '../../tools';

const RATE_API: ApiRow[] = [
    { prop: 'value', desc: '当前评分（受控）', type: 'number', defaultVal: '-' },
    { prop: 'defaultValue', desc: '默认评分（非受控）', type: 'number', defaultVal: '0' },
    { prop: 'count', desc: '星星总数', type: 'number', defaultVal: '5' },
    { prop: 'size', desc: '尺寸', type: "'small' | 'middle' | 'large'", defaultVal: "'middle'" },
    { prop: 'readonly', desc: '只读，仅展示不可交互', type: 'boolean', defaultVal: 'false' },
    { prop: 'allowClear', desc: '再次点击同一颗星时清空评分', type: 'boolean', defaultVal: 'true' },
    { prop: 'onChange', desc: '评分变化回调，清空时为 0', type: '(value: number) => void', defaultVal: '-' },
    { prop: 'className', desc: '自定义类名', type: 'string', defaultVal: '-' },
    { prop: 'style', desc: '自定义样式', type: 'React.CSSProperties', defaultVal: '-' },
];

const SCORE_TEXT: Record<number, string> = {
    0: '还没有评分',
    1: '不太满意',
    2: '一般般',
    3: '还不错',
    4: '很满意',
    5: '超级喜欢！',
};

const scoreStyle: React.CSSProperties = { marginBottom: 8, fontSize: 13, color: '#a08060' };
const scoreValueStyle: React.CSSProperties = { color: '#19c8b9', fontWeight: 600 };

const RateDemo: React.FC = () => {
    const [score, setScore] = useState(3);
    const [clearable, setClearable] = useState(4);
    const [countScore, setCountScore] = useState(7);

    return (
        <div style={sectionStyle}>
            <div style={sectionTitleStyle}>
                Rate <DemoTag>评分</DemoTag>
            </div>

            <div style={labelStyle}>基础用法（受控）— 点击星星评分</div>
            <div style={scoreStyle}>
                当前评分：<span style={scoreValueStyle}>{SCORE_TEXT[score]}</span>
            </div>
            <div style={demoBoxStyle}>
                <Rate value={score} onChange={setScore} size="large" aria-label="岛屿满意度" />
            </div>

            <div style={labelStyle}>悬停预览 + 再次点击清空（allowClear 默认开启）</div>
            <div style={scoreStyle}>
                当前评分：<span style={scoreValueStyle}>{clearable} 星</span>
            </div>
            <div style={demoBoxStyle}>
                <Rate value={clearable} onChange={setClearable} size="large" />
            </div>

            <div style={labelStyle}>allowClear=false — 再次点击同一颗星不清空</div>
            <div style={demoBoxStyle}>
                <Rate defaultValue={3} allowClear={false} size="large" />
            </div>

            <div style={labelStyle}>三种尺寸</div>
            <div style={demoBoxStyle}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }}>
                    <Rate defaultValue={5} size="small" />
                    <Rate defaultValue={4} size="middle" />
                    <Rate defaultValue={3} size="large" />
                </div>
            </div>

            <div style={labelStyle}>自定义星星数量（count=10）</div>
            <div style={scoreStyle}>
                当前评分：<span style={scoreValueStyle}>{countScore} / 10</span>
            </div>
            <div style={demoBoxStyle}>
                <Rate count={10} value={countScore} onChange={setCountScore} />
            </div>

            <div style={labelStyle}>只读 — 用于展示已有评分，不响应点击与悬停</div>
            <div style={demoBoxStyle}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }}>
                    <Rate defaultValue={5} readonly aria-label="海岛驿站评分" />
                    <Rate defaultValue={3} readonly size="small" aria-label="椰子摊评分" />
                    <Rate defaultValue={2} readonly size="large" aria-label="沙滩躺椅评分" />
                </div>
            </div>

            <CodeBlock
                code={`import React, { useState } from 'react';
import { Rate } from 'animal-island-ui';

const App = () => {
    const [score, setScore] = useState(3);
    return (
        <div>
            {/* 受控 */}
            <Rate value={score} onChange={setScore} />
            {/* 非受控 + 尺寸 */}
            <Rate defaultValue={4} size="large" />
            {/* 自定义星星数量 */}
            <Rate count={10} defaultValue={7} />
            {/* 只读展示 */}
            <Rate defaultValue={5} readonly size="small" />
        </div>
    );
};

export default App;`}
            />
            <ApiTable rows={RATE_API} />
        </div>
    );
};

export default RateDemo;
