import React from 'react';
import { Avatar, AvatarGroup, Radio, type AvatarShape } from '../../../src';
import {
    ImageIcon,
    MapIcon,
    CoffeeCupIcon,
    RabbitIcon,
    OwlIcon,
    CameraIcon,
    SunIcon,
    RainbowIcon,
    CloudIcon,
    StarIcon,
    LeafIcon,
    MushroomIcon,
    StrawberryIcon,
    DonutIcon,
    IcecreamIcon,
    CoffeeIcon,
    BalloonIcon,
    RocketIcon,
    SailboatIcon,
    MusicIcon,
    HeartIcon,
} from 'naive-icons';
import { sectionStyle, sectionTitleStyle, DemoTag, ApiTable, ApiRow, CodeBlock } from '../../tools';

/** 演示照片池：复用 demo/assets/images 照片，头像裁切展示 */
const pictures = Object.values(import.meta.glob('../../assets/images/*.{jpg,jpeg,png}', { eager: true })).map(
    (m) => (m as { default: string }).default
);
const pick = (i: number) => pictures[i % Math.max(pictures.length, 1)];

const AVATAR_API: ApiRow[] = [
    {
        prop: 'shape',
        desc: "形状：'circle' 圆形（默认） / 'square' 圆角方形",
        type: `'circle' | 'square'`,
        defaultVal: "'circle'",
    },
    {
        prop: 'size',
        desc: "尺寸：'small' / 'middle' / 'large' 预设，或任意像素数值",
        type: `number | 'small' | 'middle' | 'large'`,
        defaultVal: "'middle'",
    },
    { prop: 'src', desc: '图片地址；加载失败自动回退到图标 / 文字', type: 'string', defaultVal: '-' },
    { prop: 'alt', desc: '图片替代文本（无障碍）', type: 'string', defaultVal: '-' },
    { prop: 'icon', desc: '图标占位：src 为空或加载失败时展示', type: 'ReactNode', defaultVal: '用户图标' },
    {
        prop: 'gap',
        desc: '文字 / 图标与头像边界的间距（px），文字过宽时按比例自动缩小字号',
        type: 'number',
        defaultVal: '4',
    },
    {
        prop: 'onError',
        desc: '图片加载失败回调；返回 false 可阻止回退到占位内容',
        type: '() => boolean',
        defaultVal: '-',
    },
    {
        prop: 'children',
        desc: '头像内容：文字作为文字头像；传入 naive-icons 图标组件时创建图标头像',
        type: 'ReactNode',
        defaultVal: '-',
    },
];

const GROUP_API: ApiRow[] = [
    { prop: 'maxCount', desc: '最多显示的头像数量，超出部分折叠为 "+N"', type: 'number', defaultVal: '-' },
    { prop: 'maxStyle', desc: '折叠 "+N" 头像的自定义样式', type: 'React.CSSProperties', defaultVal: '-' },
    {
        prop: 'size',
        desc: '传递给子 Avatar 的尺寸（子级未显式指定时生效）',
        type: `number | 'small' | 'middle' | 'large'`,
        defaultVal: '-',
    },
    { prop: 'shape', desc: '传递给子 Avatar 的形状', type: `'circle' | 'square'`, defaultVal: '-' },
    { prop: 'gap', desc: '头像组内头像间距（px），头像间相互叠加', type: 'number', defaultVal: '8' },
];

/** 图标头像展示：20 个 naive-icons 图标作为 children 创建图标头像（动物 / 天气 / 食物 / 物件随机混合） */
const ICON_AVATARS = [
    ImageIcon,
    CoffeeCupIcon,
    RabbitIcon,
    OwlIcon,
    CameraIcon,
    SunIcon,
    RainbowIcon,
    CloudIcon,
    StarIcon,
    LeafIcon,
    MushroomIcon,
    StrawberryIcon,
    DonutIcon,
    IcecreamIcon,
    CoffeeIcon,
    BalloonIcon,
    RocketIcon,
    SailboatIcon,
    MusicIcon,
    HeartIcon,
];

export default function AvatarDemo() {
    const [shape, setShape] = React.useState<AvatarShape>('circle');
    return (
        <div>
            <section style={sectionStyle}>
                <div style={{ ...sectionTitleStyle, marginBottom: 20 }}>
                    <DemoTag>基础用法</DemoTag> 文字 / 图标 / 图片三种形态
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                    <Avatar>岛</Avatar>
                    <Avatar>
                        <ImageIcon />
                    </Avatar>
                    <Avatar src={pick(0)} alt="岛屿风景" />
                </div>
            </section>

            <section style={sectionStyle}>
                <div style={{ ...sectionTitleStyle, marginBottom: 20 }}>
                    <DemoTag>形状</DemoTag> 圆形 / 方形
                </div>
                <div style={{ marginBottom: 12 }}>
                    <Radio
                        options={[
                            { label: '圆形', value: 'circle' },
                            { label: '方形', value: 'square' },
                        ]}
                        value={shape}
                        onChange={(v) => setShape(v as AvatarShape)}
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                    <Avatar shape={shape}>岛</Avatar>
                    <Avatar shape={shape} icon={<MapIcon />} />
                    <Avatar shape={shape} src={pick(4)} alt="阳光田野" />
                    <Avatar shape={shape} size="large" src={pick(5)} alt="湖畔清晨" />
                </div>
            </section>

            <section style={sectionStyle}>
                <div style={{ ...sectionTitleStyle, marginBottom: 20 }}>
                    <DemoTag>头像组</DemoTag> 叠加展示 + 超出折叠
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 40, flexWrap: 'wrap' }}>
                    <AvatarGroup>
                        <Avatar src={pick(0)} alt="岛民 A" />
                        <Avatar src={pick(1)} alt="岛民 B" />
                        <Avatar src={pick(2)} alt="岛民 C" />
                        <Avatar src={pick(3)} alt="岛民 D" />
                    </AvatarGroup>
                    <AvatarGroup maxCount={3}>
                        <Avatar src={pick(4)} alt="岛民 E" />
                        <Avatar src={pick(5)} alt="岛民 F" />
                        <Avatar src={pick(0)} alt="岛民 J" />
                        <Avatar src={pick(1)} alt="岛民 K" />
                    </AvatarGroup>
                    <AvatarGroup size="small" shape="square" gap={12}>
                        <Avatar src={pick(6)} alt="岛民 G" />
                        <Avatar src={pick(7)} alt="岛民 H" />
                        <Avatar src={pick(8)} alt="岛民 I" />
                    </AvatarGroup>
                </div>
            </section>

            <section style={sectionStyle}>
                <div style={{ ...sectionTitleStyle, marginBottom: 20 }}>
                    <DemoTag>尺寸</DemoTag> 预设三档 + 任意数值
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
                    <Avatar size="small">S</Avatar>
                    <Avatar size="middle">M</Avatar>
                    <Avatar size="large">L</Avatar>
                    <Avatar size={64}>64</Avatar>
                    <Avatar size={96} src={pick(14)} alt="岛屿远眺" />
                </div>
            </section>

            <section style={sectionStyle}>
                <div style={{ ...sectionTitleStyle, marginBottom: 20 }}>
                    <DemoTag>加载失败</DemoTag> 自动回退到图标 / 文字
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                    <Avatar src="/broken-avatar.png" icon={<MapIcon />} />
                    <Avatar src="/broken-avatar.png">岛</Avatar>
                </div>
            </section>

            <section style={sectionStyle}>
                <div style={{ ...sectionTitleStyle, marginBottom: 20 }}>
                    <DemoTag>图标头像</DemoTag> naive-icons 图标作为 children
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    {ICON_AVATARS.map((Icon, i) => (
                        <Avatar key={i} size="middle">
                            <Icon />
                        </Avatar>
                    ))}
                </div>
            </section>

            <CodeBlock
                code={`<Avatar>岛</Avatar>
<Avatar icon={<UserIcon />} />
<Avatar src="/photo.png" alt="岛屿风景" />
<Avatar size={64}>64</Avatar>

{/* 图标头像：naive-icons 图标组件直接作为 children */}
<Avatar>
    <ChargerIcon />
</Avatar>

{/* 头像组：默认叠加，超出折叠为 +N */}
<AvatarGroup maxCount={3}>
    <Avatar src="/a.png" alt="A" />
    <Avatar src="/b.png" alt="B" />
    <Avatar>C</Avatar>
    <Avatar>D</Avatar>
</AvatarGroup>`}
            />

            <section style={sectionStyle}>
                <div style={sectionTitleStyle}>API — Avatar</div>
                <ApiTable rows={AVATAR_API} />
            </section>

            <section style={sectionStyle}>
                <div style={sectionTitleStyle}>API — Avatar.Group</div>
                <ApiTable rows={GROUP_API} />
            </section>
        </div>
    );
}
