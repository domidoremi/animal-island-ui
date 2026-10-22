import React, { useRef, useState } from 'react';
import { Button, CountUp } from '../../../src';
import { ApiRow, ApiTable, CodeBlock, DemoTag, labelStyle, sectionStyle, sectionTitleStyle } from '../../tools';

const COUNT_UP_API: ApiRow[] = [
    { prop: 'end', desc: '目标值（本局总分）', type: 'number', defaultVal: '-', required: true },
    { prop: 'start', desc: '起始值', type: 'number', defaultVal: '0' },
    { prop: 'duration', desc: '动画时长（秒），0 表示直接到位', type: 'number', defaultVal: '2' },
    {
        prop: 'isCounting',
        desc: '是否正在计数；置 false 暂停并保留当前值，再置 true 从暂停处继续',
        type: 'boolean',
        defaultVal: 'false',
    },
    { prop: 'decimalPlaces', desc: '小数位数，默认取 start / end 中较大的小数位数', type: 'number', defaultVal: '-' },
    { prop: 'decimalSeparator', desc: '小数点符号', type: 'string', defaultVal: "'.'" },
    { prop: 'thousandsSeparator', desc: '千分位符号', type: 'string', defaultVal: "''" },
    {
        prop: 'easing',
        desc: '缓动曲线，或自定义 (progress: number) => number',
        type: `'linear' | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic' | 'easeOutExpo' | CountUpEasingFunction`,
        defaultVal: "'easeOutCubic'",
    },
    {
        prop: 'formatter',
        desc: '完全自定义数字格式化，优先级最高',
        type: '(value: number) => ReactNode',
        defaultVal: '-',
    },
    { prop: 'updateInterval', desc: '展示值刷新间隔（秒），0 表示每帧刷新', type: 'number', defaultVal: '0' },
    { prop: 'prefix / suffix', desc: '数字前后缀，如 ¥ / 分', type: 'ReactNode', defaultVal: '-' },
    { prop: 'size', desc: '尺寸', type: `'small' | 'middle' | 'large'`, defaultVal: "'middle'" },
    { prop: 'variant', desc: '显示风格', type: `'default' | 'island'`, defaultVal: "'default'" },
    { prop: 'bordered', desc: '数字块是否带边框', type: 'boolean', defaultVal: 'false' },
    {
        prop: 'celebrate',
        desc: '计数结束后的庆祝动效：数字弹跳 + 光环 + 星芒；传 text 会额外弹出一张文案贴纸',
        type: 'boolean | { text?: ReactNode }',
        defaultVal: 'false',
    },
    { prop: 'onUpdate', desc: '展示值更新时触发（每帧）', type: '(value: number) => void', defaultVal: '-' },
    {
        prop: 'onComplete',
        desc: '计数结束时触发，返回 { shouldRepeat, delay, newStartAt } 可重播',
        type: '(elapsedTime: number) => void | CountUpCompleteResult',
        defaultVal: '-',
    },
    {
        prop: 'children',
        desc: '渲染函数，可完全接管数字渲染',
        type: '({ value, reset }) => ReactNode',
        defaultVal: '-',
    },
];

const SCORES = [1320, 2480, 960, 3060];

const pickScore = (current: number) => {
    const next = SCORES[Math.floor(Math.random() * SCORES.length)];
    return next === current ? SCORES[(SCORES.indexOf(next) + 1) % SCORES.length] : next;
};

const replayRowStyle: React.CSSProperties = { marginTop: 16 };

/** 每捡一次材料固定增加的数量 */
const WOOD_PER_PICK = 15;

const CountUpDemo: React.FC = () => {
    // 换一局用 key 重播：与 use-count-up 文档推荐的 key 用法一致。
    // 注意 key 必须在同级之间唯一，所以每个重播计数器都带自己的前缀。
    const [scoreRound, setScoreRound] = useState(0);
    const [score, setScore] = useState(SCORES[0]);
    const [wood, setWood] = useState(0);
    const [celebrateRound, setCelebrateRound] = useState(0);
    const [celebrateScore, setCelebrateScore] = useState(2480);
    const [formatRound, setFormatRound] = useState(0);
    const [easingRound, setEasingRound] = useState(0);
    // 渲染函数输出的 reset 交给外部按钮使用（见下方 children 示例）
    const resetRef = useRef<((newStartAt?: number) => void) | null>(null);

    const settle = () => {
        setScore((current) => pickScore(current));
        setScoreRound((value) => value + 1);
    };

    const replayCelebrate = () => {
        setCelebrateScore((current) => pickScore(current));
        setCelebrateRound((value) => value + 1);
    };

    return (
        <div style={sectionStyle}>
            <div style={sectionTitleStyle}>
                CountUp <DemoTag>数字滚动</DemoTag> <DemoTag>游戏结算</DemoTag>
            </div>

            <div style={labelStyle}>游戏结算：从 0 滚到本局总分，结束时庆祝一下</div>
            <CountUp
                key={`score-${scoreRound}`}
                isCounting
                end={score}
                duration={2}
                thousandsSeparator=","
                suffix="分"
                size="large"
                variant="island"
                celebrate
            />
            <div style={replayRowStyle}>
                <Button size="small" onClick={settle}>
                    再来一局
                </Button>
            </div>

            <div style={labelStyle}>累加计数：每捡一次木头 +{WOOD_PER_PICK}，接着上一个数往上滚</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <CountUp
                    // start / end 一起往后挪，就会从上一段继续涨（不是从 0 重来）
                    isCounting
                    start={Math.max(0, wood - WOOD_PER_PICK)}
                    end={wood}
                    duration={0.6}
                    suffix=" 木头"
                />
                <Button size="small" onClick={() => setWood((value) => value + WOOD_PER_PICK)}>
                    捡到木头 +{WOOD_PER_PICK}
                </Button>
                <Button size="small" onClick={() => setWood(0)}>
                    重置
                </Button>
            </div>

            <div style={labelStyle}>庆祝动效：celebrate 开启，传 text 可以放任意文案</div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
                <CountUp
                    key={`plain-${celebrateRound}`}
                    isCounting
                    end={celebrateScore}
                    duration={1.6}
                    suffix="分"
                    celebrate
                />
                <CountUp
                    key={`perfect-${celebrateRound}`}
                    isCounting
                    end={celebrateScore}
                    duration={1.6}
                    suffix="分"
                    celebrate={{ text: '完美！' }}
                />
                <CountUp
                    key={`ding-${celebrateRound}`}
                    isCounting
                    end={celebrateScore}
                    duration={1.6}
                    suffix="分"
                    celebrate={{ text: '当当！' }}
                />
            </div>
            <div style={replayRowStyle}>
                <Button size="small" onClick={replayCelebrate}>
                    重播
                </Button>
            </div>

            <div style={labelStyle}>格式化：千分位 / 小数位 / 前后缀</div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                <CountUp key={`thousand-${formatRound}`} isCounting end={1320} duration={1.5} thousandsSeparator="," />
                <CountUp
                    key={`decimal-${formatRound}`}
                    isCounting
                    end={1320.5}
                    duration={1.5}
                    decimalPlaces={1}
                    thousandsSeparator=","
                />
                <CountUp key={`prefix-${formatRound}`} isCounting end={88} duration={1.5} prefix="¥" />
                <CountUp
                    key={`separator-${formatRound}`}
                    isCounting
                    end={99.9}
                    duration={1.5}
                    decimalPlaces={1}
                    decimalSeparator=","
                    suffix="分"
                />
            </div>
            <div style={replayRowStyle}>
                <Button size="small" onClick={() => setFormatRound((value) => value + 1)}>
                    重播
                </Button>
            </div>

            <div style={labelStyle}>缓动曲线（同为 2 秒 7890 分）</div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                <CountUp
                    key={`linear-${easingRound}`}
                    isCounting
                    end={7890}
                    duration={2}
                    easing="linear"
                    thousandsSeparator=","
                />
                <CountUp
                    key={`cubic-${easingRound}`}
                    isCounting
                    end={7890}
                    duration={2}
                    easing="easeOutCubic"
                    thousandsSeparator=","
                />
                <CountUp
                    key={`expo-${easingRound}`}
                    isCounting
                    end={7890}
                    duration={2}
                    easing="easeOutExpo"
                    thousandsSeparator=","
                />
            </div>
            <div style={replayRowStyle}>
                <Button size="small" onClick={() => setEasingRound((value) => value + 1)}>
                    重播
                </Button>
            </div>

            <div style={labelStyle}>尺寸 / 风格 / 边框</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <CountUp isCounting end={960} duration={1.5} size="small" />
                <CountUp isCounting end={960} duration={1.5} />
                <CountUp isCounting end={960} duration={1.5} size="large" />
                <CountUp isCounting end={960} duration={1.5} variant="island" />
                <CountUp isCounting end={960} duration={1.5} variant="island" bordered />
            </div>

            <div style={labelStyle}>children 渲染函数：接管数字渲染，reset 可交给外部按钮重播</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <CountUp isCounting end={86} duration={1.2}>
                    {({ value, reset }) => {
                        // 渲染函数输出在 aria-hidden 区域里，可聚焦元素必须放在外面
                        resetRef.current = reset;
                        return <span>第 {Math.round(value)} 关</span>;
                    }}
                </CountUp>
                <Button size="small" onClick={() => resetRef.current?.(0)}>
                    重播本关计数
                </Button>
            </div>

            <CodeBlock
                code={`import { CountUp } from 'animal-island-ui';

// 游戏结算页：从 0 滚到总分，结束时庆祝一下
<CountUp
    isCounting
    end={score}
    duration={2}
    thousandsSeparator=","
    suffix="分"
    size="large"
    variant="island"
    celebrate
    onComplete={() => console.log('结算完成')}
/>

// 想要贴纸就传 text，文案随意
<CountUp isCounting end={score} celebrate={{ text: '完美！' }} />

// 换一局自动重播：换 key 是最省事的做法
<CountUp key={round} isCounting end={score} celebrate />

// 累加：捡材料时 start / end 一起往后挪，就从上一段接着涨
<CountUp isCounting start={Math.max(0, wood - 15)} end={wood} duration={0.6} suffix=" 木头" />

// 自定义渲染；渲染函数输出位于 aria-hidden 区域，按钮要放在外面
<CountUp isCounting end={86} duration={1.2}>
    {({ value, reset }) => {
        resetRef.current = reset;
        return <span>第 {Math.round(value)} 关</span>;
    }}
</CountUp>
<button onClick={() => resetRef.current?.(0)}>重播</button>`}
            />
            <ApiTable rows={COUNT_UP_API} />
        </div>
    );
};

export default CountUpDemo;
