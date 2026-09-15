import React from 'react';
import { Footer as FooterComponent } from '../../../src';
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

const FooterDemo: React.FC = () => {
    return (
        <div style={sectionStyle}>
            <div style={sectionTitleStyle}>
                Footer <DemoTag>版权栏</DemoTag>
            </div>
            <div style={labelStyle}>
                Footer 版权栏 — 默认展示 © 当前年份 All Rights Reserved.，年份动态获取、文案可传参自定义。
            </div>

            <div style={labelStyle}>默认</div>
            <div style={demoBodyStyle}>
                <FooterComponent />
            </div>

            <div style={labelStyle}>自定义文案</div>
            <div style={demoBodyStyle}>
                <FooterComponent text="Pocket Projects Inc." />
            </div>

            <div style={labelStyle}>自定义年份 / 样式</div>
            <div style={demoBodyStyle}>
                <FooterComponent text="Acme Ltd." year={2020} style={{ background: '#f7f3ea', borderRadius: 8 }} />
            </div>

            <CodeBlock
                code={`import React from 'react';
import { Footer } from 'animal-island-ui';

const App = () => (
    <div>
        <Footer />                       {/* © 2026 All Rights Reserved. */}
        <Footer text="Acme Ltd." />      {/* 自定义文案 */}
        <Footer text="Acme" year={2020} />{/* 自定义年份 */}
    </div>
);`}
            />
            <ApiTable rows={FOOTER_API} />
        </div>
    );
};

const FOOTER_API: ApiRow[] = [
    { prop: 'text', desc: '版权文案，默认 All Rights Reserved.', type: 'string', defaultVal: "'All Rights Reserved.'" },
    { prop: 'year', desc: '年份，默认取当前年份（动态获取）', type: 'number', defaultVal: '-' },
    { prop: 'className', desc: '自定义类名', type: 'string', defaultVal: '-' },
    { prop: 'style', desc: '自定义样式', type: 'CSSProperties', defaultVal: '-' },
];

export default FooterDemo;
