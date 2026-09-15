import React from 'react';
import { Card, Tag } from '../../../src';
import * as Icons from 'naive-icons';
import { DemoTag, demoBodyStyle, labelStyle, sectionStyle, sectionTitleStyle } from '../../tools';
import type { CatalogRow, RuleGroup, Scenario, TokenGroup, WorkflowStep } from './data';
import styles from './skill.module.less';

type NaiveIcon = React.FC<{ size?: number | string }>;

/** 按图标名解析 naive-icons 图标组件（如 'Book' → BookIcon） */
function resolveIcon(name: string): NaiveIcon | null {
    const Cmp = (Icons as Record<string, unknown>)[`${name}Icon`];
    return typeof Cmp === 'function' ? (Cmp as NaiveIcon) : null;
}

// ============================================
// Skill 介绍页的可复用片段
// 章节外壳沿用 demo/tools 的共享样式，页面内部样式走 skill.module.less
// ============================================

/** 章节外壳：标题 + 语义标签 + 内容区 */
export const Section: React.FC<{
    title: string;
    tags?: string[];
    dashed?: boolean;
    children: React.ReactNode;
}> = ({ title, tags = [], dashed = false, children }) => (
    <section style={dashed ? { ...sectionStyle, borderStyle: 'dashed' } : sectionStyle}>
        <div style={sectionTitleStyle}>
            {title}
            {tags.map((tag) => (
                <DemoTag key={tag}>{tag}</DemoTag>
            ))}
        </div>
        <div style={{ ...demoBodyStyle, marginTop: 10 }}>{children}</div>
    </section>
);

/** 工作原理步骤卡 */
export const StepCard: React.FC<{ step: WorkflowStep }> = ({ step }) => {
    const IconCmp = resolveIcon(step.icon);
    return (
        <div className={styles.step}>
            <Card pattern={step.pattern} className={styles.stepCard}>
                <div className={styles.cardHead}>
                    {IconCmp && <IconCmp size={26} />}
                    <span className={styles.cardTitle}>{step.title}</span>
                </div>
                <p className={styles.cardDesc}>{step.desc}</p>
            </Card>
        </div>
    );
};

/** 使用场景卡 */
export const ScenarioCard: React.FC<{ scenario: Scenario }> = ({ scenario }) => {
    const IconCmp = resolveIcon(scenario.icon);
    return (
        <Card color={scenario.color} className={styles.scenarioCard}>
            <div className={styles.cardHead}>
                {IconCmp && <IconCmp size={30} />}
                <span className={styles.scenarioTitle}>{scenario.title}</span>
            </div>
            <p className={`${styles.cardDesc} ${styles.scenarioDesc}`}>{scenario.desc}</p>
            <div className={styles.agentRow}>
                {scenario.agents.map((agent) => (
                    <Tag key={agent} size="small" variant="outlined" className={styles.pathChip}>
                        {agent}
                    </Tag>
                ))}
            </div>
            <code className={styles.pathChip}>{scenario.entry}</code>
        </Card>
    );
};

/** 组件目录的一行分类 */
export const CatalogItem: React.FC<{ row: CatalogRow }> = ({ row }) => (
    <div className={styles.catalogRow}>
        <Tag variant="soft" color={row.color} className={styles.catalogCategory}>
            {row.category}
        </Tag>
        <div className={styles.catalogComponents}>
            {row.components.map((name) => (
                <Tag key={name} size="small" variant="outlined">
                    {name}
                </Tag>
            ))}
        </div>
        <code className={styles.pathChipQuiet}>{row.reference}</code>
    </div>
);

/** 硬性规则分组卡 */
export const RuleCard: React.FC<{ group: RuleGroup }> = ({ group }) => {
    const IconCmp = resolveIcon(group.icon);
    return (
        <Card type="dashed" className={styles.ruleCard}>
            <div className={styles.cardHead}>
                {IconCmp && <IconCmp size={22} />}
                <span className={styles.cardTitle}>{group.title}</span>
                <Tag size="small" variant="soft" color={group.color}>
                    {group.rules.length} 条
                </Tag>
            </div>
            <ul className={styles.ruleList}>
                {group.rules.map((rule) => (
                    <li key={rule}>{rule}</li>
                ))}
            </ul>
        </Card>
    );
};

/** 单个令牌色卡 —— 读取页面上该变量的真实计算值 */
const Swatch: React.FC<{ token: string }> = ({ token }) => {
    const [value, setValue] = React.useState('');

    React.useEffect(() => {
        setValue(getComputedStyle(document.documentElement).getPropertyValue(token).trim());
    }, [token]);

    return (
        <div className={styles.swatch}>
            <div className={styles.swatchChip} style={{ background: `var(${token})` }} />
            <div className={styles.swatchMeta}>
                <code className={styles.swatchName}>{token.replace('--animal-', '')}</code>
                <code className={styles.swatchValue}>{value || '—'}</code>
            </div>
        </div>
    );
};

/** 一组颜色令牌 */
export const ColorTokenGroup: React.FC<{ group: TokenGroup }> = ({ group }) => (
    <div className={styles.tokenGroup}>
        <div style={labelStyle}>{group.label}</div>
        <div className={styles.swatchRow}>
            {group.tokens.map((token) => (
                <Swatch key={token} token={token} />
            ))}
        </div>
    </div>
);

/** 一组非颜色令牌 —— 只列名字 */
export const ScaleTokenGroup: React.FC<{ group: TokenGroup }> = ({ group }) => (
    <div className={styles.tokenTagRow}>
        <span className={styles.tokenTagLabel}>{group.label}</span>
        {group.tokens.map((token) => (
            <Tag key={token} size="small" variant="soft">
                {token}
            </Tag>
        ))}
    </div>
);
