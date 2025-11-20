# 🎨 考研英语小程序 - 完整视觉系统方案

> **目标**: 统一视觉风格，形成完整的AI生成提示词库  
> **基于**: 现有设计规范 + Design Tokens v0.2 + 扇贝单词参考  
> **适用**: 所有页面、组件、卡片、弹窗

---

## 📋 目录

1. [当前UI情况总览](#一当前ui情况总览)
2. [核心设计元素](#二核心设计元素)
3. [完整页面视觉方案](#三完整页面视觉方案)
4. [AI生成提示词库](#四ai生成提示词库)
5. [实施指南](#五实施指南)

---

## 一、当前UI情况总览

### 1.1 设计规范文档盘点

#### ✅ **已有规范文档**（4份核心文档）

| 文档名称 | 状态 | 内容 | 重要性 |
|---------|------|------|--------|
| **plan.md** | ✅ 定稿 | UI设计系统指南 (Tokens v0.2) | ⭐⭐⭐⭐⭐ |
| **design-tokens-v0.2.json** | ✅ 定稿 | 设计令牌数据 | ⭐⭐⭐⭐⭐ |
| **UI_DESIGN_GUIDE.md** | ✅ 定稿 | 扇贝风格设计系统 | ⭐⭐⭐⭐ |
| **DESIGN_QUICK_REFERENCE.md** | ✅ 定稿 | 快速参考卡 | ⭐⭐⭐⭐ |
| **docs/ui-design-spec.md** | ✅ 定稿 | 学习页面规范 | ⭐⭐⭐ |
| **SHANBAY_UI_DETAILED_ANALYSIS.md** | ✅ 参考 | 扇贝详细分析 | ⭐⭐⭐ |

---

### 1.2 设计风格定位

#### 🎯 **核心设计哲学**

```
风格定位: 温暖亲和（社交风）+ 新拟物主义（Neumorphism）
视觉语言: 撞色卡片系统 + 柔和阴影 + 极简线条图标
品牌色调: 温和蓝 #4F7FE8 + 四组撞色（橙/紫/绿/粉）
```

**设计融合**：
- ✅ **新拟物主义** - 柔和阴影、立体深度
- ✅ **极简主义** - 去繁就简、突出核心
- ✅ **卡片式** - 模块化、易于浏览
- ✅ **撞色系统** - 高识别度、情感化

---

### 1.3 已实现的UI组件

#### ✅ **核心组件清单**（13个）

| 组件名称 | 位置 | 完成度 | 使用页面 |
|---------|------|--------|----------|
| **hint-float-card** ⭐ | components/ | 100% | practice |
| **word-popup** | components/ | 100% | reading-article |
| **sentence-card** | components/ | 100% | reading-article |
| **morpheme-card** | components/ | 100% | vocabulary |
| **learning-card** | components/ | 100% | home |
| **recommendation-card** | components/ | 100% | home, study |
| **achievement-badge** | components/ | 100% | profile |
| **stat-card** | components/ | 100% | home, report |
| **first-time-setup** | components/theme/ | 100% | 首次启动 |
| **reading-question** | practice/components/ | 100% | practice |
| **cloze-question** | practice/components/ | 100% | practice |
| **translation-question** | practice/components/ | 90% | practice |
| **writing-question** | practice/components/ | 60% | practice |

---

### 1.4 页面UI完成度

| 页面 | 完成度 | UI质量 | 需优化 |
|------|--------|--------|--------|
| **home** | 90% | ⭐⭐⭐⭐ | 学习建议卡片 |
| **study** | 70% | ⭐⭐⭐⭐ | 撞色卡片完善 |
| **vocabulary** | 85% | ⭐⭐⭐⭐⭐ | 发音按钮 |
| **practice** | 95% | ⭐⭐⭐⭐⭐ | 写作UI |
| **report** | 90% | ⭐⭐⭐⭐⭐ | 更多图表类型 |
| **ai-assistant** | 60% | ⭐⭐⭐⭐ | 对话气泡优化 |
| **profile** | 75% | ⭐⭐⭐⭐ | 成就系统UI |
| **wrong-questions** | 80% | ⭐⭐⭐⭐ | 筛选UI |

---

## 二、核心设计元素

### 2.1 色彩系统（Design Tokens v0.2）

#### 🎨 **品牌色（温和蓝）**

```css
/* 主品牌色 */
--brand-500: #4F7FE8;  /* 主色：按钮、链接、强调 */
--brand-600: #4973E0;  /* hover 状态 */
--brand-700: #3D5FC8;  /* active/pressed 状态 */

/* 选择理由：从刺目蓝 #2563EB 改为温和蓝 #4F7FE8 */
/* 饱和度 -5%，亮度 +6%，对比度 4.52:1 达 WCAG AA 标准 */
```

---

#### 🌈 **四组撞色卡片系统**（核心设计语言）

**设计特征**：
- 卡片主体：浅色（柔和、低饱和度）
- 右上角：深色撞色块（高饱和度、高对比）
- 撞色形状：左下大圆角 80rpx，不规则边缘
- 白色图标：位于卡片左上角

```css
/* 1. 橙色对 - 阅读理解、写作 */
--accent-orange-light: #FED7AA;  /* 浅橙色背景 */
--accent-orange-dark: #DC2626;   /* 深红色角标（AA达标：4.6:1）*/

/* 2. 紫色对 - 完形填空、新题型 */
--accent-violet-light: #C7D2FE;  /* 浅紫色背景 */
--accent-violet-dark: #6366F1;   /* 深紫色角标（AA达标）*/

/* 3. 绿色对 - 翻译练习 */
--accent-green-light: #A7F3D0;   /* 浅绿色背景 */
--accent-green-dark: #065F46;    /* 深绿色角标（AA达标：4.7:1）*/

/* 4. 粉色对 - 词汇学习、词汇语法 */
--accent-pink-light: #FECACA;    /* 浅粉色背景 */
--accent-pink-dark: #DB2777;     /* 深粉色角标（AA达标：4.5:1）*/
```

**对比度要求**：
- ✅ 所有深色撞色块 vs 白色文字/图标 ≥ 4.5:1 (WCAG AA)
- ✅ 已修正橙/绿/粉深色位加深以达标

---

#### 🎨 **中性色系统**

```css
/* 页面背景 */
--neutral-50: #F8F9FB;   /* 所有页面底色（柔和蓝灰）*/

/* 卡片与表面 */
--color-white: #FFFFFF;  /* 卡片背景 */
--surface-card: #FFFFFF;
--surface-elevated: #FFFFFF;

/* 边框与分隔 */
--neutral-200: #E5E7EB;  /* 分隔线 */
--border-subtle: #EEF2F7;
--border-default: #E5E7EB;
--border-strong: #CBD5E1;

/* 文本色 */
--text-primary: #0F172A;     /* 标题、重要文字（深色）*/
--text-secondary: #374151;   /* 正文 */
--text-muted: #6B7280;       /* 辅助信息（灰色）*/
--text-inverse: #FFFFFF;     /* 白色文字（用于撞色块/按钮）*/
```

---

#### 🎯 **语义色**

```css
--semantic-success: #10B981;  /* 成功、完成状态（绿色）*/
--semantic-warning: #F59E0B;  /* 警告（橙色）*/
--semantic-error: #EF4444;    /* 错误（红色）*/
--semantic-info: #4F7FE8;     /* 信息提示（品牌蓝）*/
```

---

### 2.2 字体系统

#### 📝 **字体家族**

```css
font-family: system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
```

#### 📏 **字号层级** (rpx单位)

```css
/* 标题层级 */
--font-h1: 64rpx;    /* 页面主标题 */
--font-h2: 48rpx;    /* 区块标题 */
--font-h3: 32rpx;    /* 卡片标题、列表标题 */

/* 正文层级 */
--font-body: 28rpx;  /* 正文、描述 */
--font-caption: 24rpx; /* 辅助说明 */

/* 特殊层级 */
--font-stat: 40rpx;  /* 统计数字 */
```

#### 📊 **行高**

```css
--line-height-h1: 80rpx;    /* 1.25x */
--line-height-h2: 64rpx;    /* 1.33x */
--line-height-h3: 44rpx;    /* 1.375x */
--line-height-body: 44rpx;  /* 1.57x - 舒适阅读 */
--line-height-caption: 36rpx; /* 1.5x */
--line-height-stat: 48rpx;  /* 1.2x */
```

#### 🔤 **字重**

```css
--font-regular: 400;   /* 正文 */
--font-medium: 500;    /* 列表项 */
--font-semibold: 600;  /* 卡片标题 */
--font-bold: 700;      /* 页面标题、统计数字 */
```

---

### 2.3 间距系统（8pt Grid）

```css
--spacing-0: 0;
--spacing-1: 8rpx;    /* 最小间距，图标与文字 */
--spacing-2: 12rpx;   /* 小间距 */
--spacing-3: 16rpx;   /* 卡片间距 */
--spacing-4: 20rpx;
--spacing-5: 24rpx;   /* 卡片内边距 */
--spacing-6: 32rpx;   /* 页面边距 */
--spacing-7: 40rpx;   /* 区块间距 */
--spacing-8: 48rpx;   /* 大区块间距 */
```

**应用规则**：
- 页面左右边距：32rpx (`--spacing-6`)
- 卡片内边距：24rpx (`--spacing-5`)
- 卡片间距：16rpx (`--spacing-3`)
- 元素间距：8-12rpx (`--spacing-1` ~ `--spacing-2`)

---

### 2.4 圆角系统

```css
--radius-sm: 8rpx;      /* 小标签 */
--radius-md: 12rpx;     /* 按钮、输入框 */
--radius-lg: 16rpx;     /* 卡片默认 */
--radius-xl: 16rpx;     /* 大卡片（保持一致）*/
--radius-2xl: 24rpx;    /* 模态框 */
--radius-full: 9999rpx; /* 圆形、胶囊 */

/* 特殊：撞色角标 */
--accent-wedge-radius: 0 0 0 80rpx; /* 左下大圆角 */
```

---

### 2.5 阴影系统（柔和新拟物）

#### 🌊 **浅色模式**

```css
--shadow-xs: 0 2rpx 8rpx rgba(0,0,0,0.04);   /* 输入框 */
--shadow-sm: 0 4rpx 12rpx rgba(0,0,0,0.08);  /* 悬浮卡片 */
--shadow-md: 0 6rpx 16rpx rgba(0,0,0,0.08);  /* 主要卡片 - 柔和化 */
--shadow-lg: 0 20rpx 50rpx rgba(0,0,0,0.15); /* 模态框 */
```

**特点**：
- 低对比度（3%-15%）
- 多层次（模糊范围大）
- 柔和不生硬

#### 🌙 **暗色模式**

```css
--shadow-xs: 0 2rpx 8rpx rgba(0,0,0,0.35);   /* 增加透明度 */
--shadow-sm: 0 4rpx 12rpx rgba(0,0,0,0.45);
--shadow-md: 0 6rpx 16rpx rgba(0,0,0,0.50);
--shadow-lg: 0 20rpx 50rpx rgba(0,0,0,0.55);
```

---

### 2.6 动效系统

```css
/* 持续时间 */
--duration-fast: 150ms;  /* 小元素 */
--duration-base: 200ms;  /* 默认 */
--duration-slow: 300ms;  /* 页面切换 */

/* 缓动函数 */
--easing-standard: cubic-bezier(0.2, 0.6, 0.2, 1);
```

---

## 三、完整页面视觉方案

### 3.1 首页 (home)

#### 🎨 **设计特点**

```
布局结构: 垂直滚动
背景色: #F8F9FB (柔和蓝灰)
核心元素: 学习统计 + 快速开始按钮 + 学习建议卡片
```

#### 📦 **核心区块**

**1. 页面头部**
```xml
<view class="page-header">
  <text class="page-title">📚 今日学习</text>
  <text class="page-subtitle">继续保持学习习惯</text>
</view>
```
- 标题：64rpx，bold，#0F172A
- 副标题：28rpx，regular，#6B7280
- 背景：#F8F9FB
- 内边距：32rpx 左右，24rpx 上下

**2. 学习统计卡片**
```xml
<view class="stats-overview">
  <view class="stat-item">
    <image src="/images/clock.png" class="stat-icon"></image>
    <text class="stat-value">42</text>
    <text class="stat-label">今日学习(分钟)</text>
  </view>
  <!-- 其他统计项 -->
</view>
```
- 卡片背景：#FFFFFF
- 圆角：16rpx
- 阴影：shadow-sm
- 内边距：24rpx
- 间距：16rpx（卡片间）

**3. 快速开始按钮**
```xml
<button class="btn-start">
  <text>开始学习</text>
</button>
```
- 背景：linear-gradient(135deg, #4F7FE8 0%, #3870D9 100%)
- 文字：#FFFFFF，32rpx，medium
- 圆角：16rpx
- 阴影：shadow-sm
- 高度：88rpx

---

### 3.2 学习页 (study)

#### 🎨 **设计特点**

```
布局结构: 2x2 网格撞色卡片 + 试卷列表
背景色: #F8F9FB
核心元素: 4张撞色卡片（阅读/完形/翻译/写作）
```

#### 📦 **撞色卡片实现**

**HTML 结构**
```xml
<view class="module-card card-orange" bindtap="handleClick">
  <!-- 撞色角标（右上） -->
  <view class="accent-wedge wedge-orange"></view>
  
  <!-- 白色图标（左上） -->
  <image src="/images/reading.png" class="card-icon"/>
  
  <!-- 标题 -->
  <text class="card-title">阅读理解</text>
  
  <!-- 副标题 -->
  <text class="card-subtitle">4篇文章</text>
  
  <!-- 角标（可选，如错题数） -->
  <view class="count-badge">
    <text>5</text>
  </view>
</view>
```

**CSS 规范**
```css
/* 卡片主体 */
.module-card {
  position: relative;
  border-radius: 16rpx;
  padding: 24rpx;
  min-height: 140rpx;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-end;
  overflow: hidden;
  box-shadow: 0 6rpx 16rpx rgba(0,0,0,0.08);
  transition: all 0.2s ease;
}

.module-card:active {
  transform: scale(0.98);
}

/* 4组浅色背景 */
.card-orange { background: #FED7AA; }
.card-violet { background: #C7D2FE; }
.card-green  { background: #A7F3D0; }
.card-pink   { background: #FECACA; }

/* 撞色角标（右上，不规则边缘） */
.accent-wedge {
  position: absolute;
  top: 0;
  right: 0;
  width: 100rpx;
  height: 100rpx;
  border-radius: 0 0 0 80rpx; /* 左下大圆角 */
  z-index: 1;
}

.wedge-orange { background: #DC2626; }
.wedge-violet { background: #6366F1; }
.wedge-green  { background: #065F46; }
.wedge-pink   { background: #DB2777; }

/* 白色图标 */
.card-icon {
  width: 48rpx;
  height: 48rpx;
  margin-bottom: 12rpx;
  z-index: 2;
  filter: brightness(0) invert(1); /* 转为纯白色 */
}

/* 卡片文字 */
.card-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #0F172A;
  z-index: 2;
}

.card-subtitle {
  font-size: 24rpx;
  color: #374151;
  z-index: 2;
}
```

---

### 3.3 词汇学习页 (vocabulary)

#### 🎨 **设计特点**

```
布局结构: 进度卡片 + 词素学习卡片 + 学习模式切换
背景色: #F8F9FB
核心元素: 词根详情卡片轮播
```

#### 📦 **词根详情卡片**

```xml
<view class="root-detail-card">
  <!-- 词根信息 -->
  <view class="root-header">
    <text class="root-form">port</text>
    <text class="root-meaning">搬运</text>
    <text class="root-origin">Latin: portare</text>
  </view>
  
  <!-- 起源故事 -->
  <view class="origin-story">
    <text class="story-text">...</text>
  </view>
  
  <!-- 单词轮播 -->
  <swiper class="word-carousel">
    <swiper-item>
      <view class="word-card">
        <text class="word-breakdown">im- + port</text>
        <text class="word-text">import</text>
        <text class="word-phonetic">/ɪmˈpɔːrt/</text>
        <text class="word-meaning">进口；输入</text>
        <text class="word-example">We import coffee from Brazil.</text>
        <image class="word-image" src="{{unsplashImage}}"></image>
      </view>
    </swiper-item>
  </swiper>
</view>
```

**设计特点**：
- 卡片翻转动画
- Unsplash 配图
- 词素拆解可视化
- 例句中英对照

---

### 3.4 练习页 (practice)

#### 🎨 **设计特点**

```
布局结构: 题目卡片 + 答题区 + AI提示浮动卡片
背景色: #F8F9FB
核心元素: hint-float-card（AI提示）
```

#### 📦 **AI提示浮动卡片** ⭐ 核心

```xml
<hint-float-card
  visible="{{showHint}}"
  message="{{hintMessage}}"
  scaffoldPoints="{{hintPoints}}"
  keywords="{{hintKeywords}}"
  autoExpand="{{hintAutoExpand}}"
  bind:expand="onHintExpand"
  bind:collapse="onHintCollapse"
/>
```

**渐进式展示**：
1. **图标状态** - 提醒有提示可用
2. **Step1** - 聚焦提示（一行，9字）
3. **Step2** - 前2条思维步骤
4. **Step3** - 完整3条思维步骤

**样式特点**：
- 位置：右下角固定
- 背景：#FFFFFF
- 圆角：16rpx
- 阴影：shadow-lg
- 动画：平滑展开/收起

---

### 3.5 报告页 (report)

#### 🎨 **设计特点**

```
布局结构: 统计概览 + ECharts图表 + 错题分析
背景色: #F8F9FB
核心元素: 数据可视化（ECharts）
```

#### 📦 **统计卡片**

```xml
<view class="stats-grid">
  <view class="stat-card">
    <text class="stat-label">完成题目</text>
    <text class="stat-value">1,250</text>
    <text class="stat-trend positive">↑ 12%</text>
  </view>
  <!-- 其他统计卡片 -->
</view>
```

**设计特点**：
- 4列网格布局
- 渐变文字（统计数字）
- 趋势指示器（上升/下降箭头）
- ECharts 响应式图表

---

### 3.6 AI助手页 (ai-assistant)

#### 🎨 **设计特点**

```
布局结构: 聊天气泡列表 + 快速问题按钮 + 输入框
背景色: #F8F9FB
核心元素: 对话气泡
```

#### 📦 **对话气泡**

```xml
<!-- 用户消息 -->
<view class="message message-user">
  <view class="message-bubble bubble-user">
    <text class="message-text">如何提高阅读速度？</text>
  </view>
  <image class="message-avatar" src="{{userAvatar}}"></image>
</view>

<!-- AI消息 -->
<view class="message message-ai">
  <image class="message-avatar" src="/images/ai.png"></image>
  <view class="message-bubble bubble-ai">
    <text class="message-text">建议从以下几个方面入手...</text>
  </view>
</view>
```

**样式特点**：
- 用户气泡：#4F7FE8（品牌蓝）
- AI气泡：#FFFFFF（白色 + shadow-sm）
- 圆角：12rpx（左上小圆角4rpx）
- 最大宽度：70%

---

### 3.7 个人中心 (profile)

#### 🎨 **设计特点**

```
布局结构: 用户卡片 + 学习数据 + 成就系统 + 菜单列表
背景色: #F8F9FB
核心元素: 成就徽章
```

#### 📦 **成就徽章**

```xml
<view class="achievement-grid">
  <view class="achievement-item" wx:for="{{achievements}}">
    <image class="achievement-icon" src="{{item.icon}}"></image>
    <text class="achievement-title">{{item.title}}</text>
    <text class="achievement-progress">{{item.progress}}%</text>
    <view class="achievement-badge" wx:if="{{item.unlocked}}">
      <text>✓</text>
    </view>
  </view>
</view>
```

**设计特点**：
- 3列网格布局
- 未解锁：灰显（opacity: 0.5）
- 已解锁：彩色 + 金色徽章
- 进度条：绿色渐变

---

### 3.8 错题本 (wrong-questions)

#### 🎨 **设计特点**

```
布局结构: 筛选栏 + 错题列表 + 操作按钮
背景色: #F8F9FB
核心元素: 错题卡片
```

#### 📦 **错题卡片**

```xml
<view class="wrong-question-item">
  <view class="question-header">
    <text class="question-type badge badge-soft-orange">阅读理解</text>
    <text class="question-date">2025-10-25</text>
  </view>
  
  <text class="question-content">{{question.content}}</text>
  
  <view class="answer-section">
    <text class="answer-label">你的答案：</text>
    <text class="answer-wrong">B</text>
    <text class="answer-label">正确答案：</text>
    <text class="answer-correct">C</text>
  </view>
  
  <view class="question-actions">
    <button class="btn-secondary btn-sm">重新练习</button>
    <button class="btn-success btn-sm">已掌握</button>
  </view>
</view>
```

**设计特点**：
- 错误答案：#EF4444（红色）
- 正确答案：#10B981（绿色）
- 解析按钮：展开/收起动画

---

## 四、AI生成提示词库

### 4.1 通用页面提示词模板

#### 📱 **基础页面框架**

```
Prompt for AI Image Generation:

Design a modern mobile app page for a Chinese postgraduate English learning application.

LAYOUT:
- Screen size: 375px × 812px (iPhone X)
- Background: Light blue-gray (#F8F9FB)
- Safe area padding: Top 44px, Bottom 34px
- Left/Right margin: 32rpx (16px)

STYLE:
- Design philosophy: Warm and friendly (Social style) + Neumorphism
- Visual language: Contrasting color card system + Soft shadows + Minimalist line icons
- Brand color: Gentle blue #4F7FE8

COMPONENTS:
- Cards: White background, 16rpx border-radius, soft shadow (0 6rpx 16rpx rgba(0,0,0,0.08))
- Typography: System font, Title 32rpx bold, Body 28rpx regular, Caption 24rpx
- Spacing: 8px grid system (8rpx, 16rpx, 24rpx, 32rpx)

COLOR PALETTE:
- Brand blue: #4F7FE8
- Text primary: #0F172A
- Text secondary: #374151
- Text muted: #6B7280
- Success green: #10B981
- Warning orange: #F59E0B
- Error red: #EF4444

MOOD: Professional, warm, educational, modern, clean
```

---

### 4.2 首页 (home) 提示词

```
Prompt for Home Page:

Design a mobile app HOME page for a Chinese postgraduate English learning app.

LAYOUT:
- Screen: 375px × 812px
- Background: #F8F9FB (light blue-gray)
- Components arranged vertically with 32rpx spacing

KEY SECTIONS:
1. Page Header (Top):
   - Emoji icon 📚 + "今日学习" (Today's Study) in 64rpx bold, color #0F172A
   - Subtitle "继续保持学习习惯" (Keep learning habit) in 28rpx, color #6B7280
   - Background: transparent
   - Padding: 32rpx horizontal, 24rpx vertical

2. Learning Statistics (3 stat cards in row):
   - White cards with soft shadow
   - Each card: Icon (32rpx) + Value (40rpx bold gradient blue) + Label (24rpx gray)
   - Icons: 🕐 Clock, 🎯 Target, 📖 Book
   - Values: "42分钟" (42 minutes), "75%" (accuracy), "250道" (250 questions)
   - Border-radius: 16rpx
   - Card spacing: 16rpx between cards

3. Quick Start Button:
   - Large button "开始学习" (Start Learning)
   - Background: Linear gradient (135deg, #4F7FE8 0%, #3870D9 100%)
   - Text: White, 32rpx, medium weight
   - Size: Full width × 88rpx height
   - Border-radius: 16rpx
   - Shadow: 0 4rpx 12rpx rgba(0,0,0,0.08)

4. Learning Suggestions Card:
   - White card with soft shadow
   - Title "📋 今日建议" (Today's Suggestions)
   - 2-3 recommendation items with checkboxes
   - Border-radius: 16rpx
   - Padding: 24rpx

STYLE:
- Neumorphism: Soft shadows, subtle depth
- Clean and spacious: Generous whitespace
- Icons: Minimalist line style, 32-48rpx
- Typography: System font, clear hierarchy

MOOD: Welcoming, motivating, clean, modern
```

---

### 4.3 学习页 (study) - 撞色卡片提示词

```
Prompt for Study Page with Contrasting Color Cards:

Design a STUDY page featuring 4 contrasting color cards in 2×2 grid layout.

LAYOUT:
- Screen: 375px × 812px, Background: #F8F9FB
- Grid: 2 columns, 16rpx gap between cards
- Card size: (Width - 64rpx - 16rpx) / 2 per card, Height: 140rpx minimum

CONTRASTING COLOR CARD DESIGN (核心设计语言):

Card Structure:
1. Main card body: Light pastel background (low saturation)
2. Top-right corner wedge: Dark saturated color (high contrast)
3. White icon: Top-left corner, 48rpx
4. Card text: Title + Subtitle, positioned bottom-left

Corner Wedge (Accent):
- Size: 100rpx × 100rpx
- Position: Absolute top-right
- Border-radius: 0 0 0 80rpx (ONLY bottom-left rounded, creating irregular shape)
- Z-index: 1 (behind text and icon)

4 Color Pairs (符合 WCAG AA 对比度标准):

1. ORANGE PAIR (阅读理解 Reading Comprehension):
   - Light background: #FED7AA (warm peach)
   - Dark wedge: #DC2626 (deep red, contrast ratio 4.6:1 vs white)
   - Icon: 📖 Book (white, 48rpx)
   - Title: "阅读理解" (32rpx, semibold, #0F172A)
   - Subtitle: "4篇文章" (24rpx, regular, #374151)

2. VIOLET PAIR (完形填空 Cloze Test):
   - Light background: #C7D2FE (soft lavender)
   - Dark wedge: #6366F1 (indigo, contrast ratio ≥4.5:1)
   - Icon: 📝 Pencil (white, 48rpx)
   - Title: "完形填空" (32rpx, semibold, #0F172A)
   - Subtitle: "20道题" (24rpx, regular, #374151)

3. GREEN PAIR (翻译练习 Translation):
   - Light background: #A7F3D0 (mint green)
   - Dark wedge: #065F46 (deep teal, contrast ratio 4.7:1)
   - Icon: 🔄 Translation (white, 48rpx)
   - Title: "翻译练习" (32rpx, semibold, #0F172A)
   - Subtitle: "10段文字" (24rpx, regular, #374151)

4. PINK PAIR (词汇学习 Vocabulary):
   - Light background: #FECACA (soft pink)
   - Dark wedge: #DB2777 (magenta, contrast ratio 4.5:1)
   - Icon: 📚 Books (white, 48rpx)
   - Title: "词汇学习" (32rpx, semibold, #0F172A)
   - Subtitle: "50个单词" (24rpx, regular, #374151)

Card Details:
- Border-radius: 16rpx
- Padding: 24rpx
- Box-shadow: 0 6rpx 16rpx rgba(0,0,0,0.08)
- Icon filter: brightness(0) invert(1) to force pure white
- Text z-index: 2 (above wedge)

Interaction:
- Active state: transform scale(0.98), slight press-down effect
- Transition: all 0.2s ease

Grid Layout:
- Display: Grid 2 columns
- Gap: 16rpx
- Margin: 32rpx horizontal

STYLE:
- Modern, playful, high recognition
- Soft shadows, rounded corners
- High color differentiation for each module
- Professional yet friendly

MOOD: Energetic, organized, motivating
```

---

### 4.4 词汇学习页 (vocabulary) 提示词

```
Prompt for Vocabulary Learning Page:

Design a VOCABULARY LEARNING page with morpheme cards and root detail carousel.

LAYOUT:
- Screen: 375px × 812px, Background: #F8F9FB

KEY COMPONENTS:

1. Progress Card (Top):
   - White card, 16rpx border-radius, shadow
   - Title "今日学习进度" (24rpx, semibold)
   - Progress bar: Green gradient (#4DB584 to #2D8A6F), 14rpx height, full rounded
   - Stats: "12个词素 / 50个单词" below bar
   - Padding: 24rpx

2. Root Detail Card (Main feature):
   - Large white card, 24rpx border-radius
   - Top section: Root info
     * Root form "port" (48rpx, bold, #0F172A)
     * Meaning "搬运" (32rpx, regular, #374151)
     * Origin "Latin: portare" (24rpx, italic, #6B7280)
   - Middle: Origin story (expandable text area)
   - Bottom: Word carousel (Swiper component)
     * Word card with flip animation
     * Breakdown: "im- + port" (color-coded)
     * Phonetic: /ɪmˈpɔːrt/ (24rpx, gray)
     * Example sentence with English + Chinese
     * Unsplash image (full width, 200rpx height, 16rpx radius)

3. Learning Mode Switches:
   - 3 pills: "词素学习" | "词汇练习" | "词汇测试"
   - Active: #4F7FE8 background, white text
   - Inactive: #E5E7EB background, gray text
   - Border-radius: 9999rpx (full rounded)
   - Height: 60rpx

4. Morpheme Grid (Bottom):
   - 3 columns grid
   - Each morpheme card:
     * Light background (#F1F5F9)
     * Prefix/Suffix/Root label
     * Morpheme text (bold)
     * Example words count
     * Border-radius: 12rpx

INTERACTIONS:
- Card flip animation for word reveal
- Swipe left/right for next/previous word
- Tap to expand origin story
- Progress bar animates on load

STYLE:
- Educational, clean, organized
- Soft colors, high readability
- Visual hierarchy clear
- Generous whitespace

MOOD: Scholarly, systematic, encouraging
```

---

### 4.5 练习页 (practice) - 含AI提示卡片提示词

```
Prompt for Practice Page with AI Hint Floating Card:

Design a PRACTICE page with question display and floating AI hint card.

LAYOUT:
- Screen: 375px × 812px, Background: #F8F9FB

KEY COMPONENTS:

1. Question Card (Center):
   - Large white card, 16rpx border-radius, shadow
   - Passage text: 28rpx, line-height 44rpx, color #0F172A
   - Question stem: 32rpx, semibold, color #0F172A
   - Options: A/B/C/D in white rounded buttons
     * Unselected: #FFFFFF, border #E5E7EB
     * Selected: #4F7FE8 border, light blue background
     * Correct: #10B981 background, white text, ✓ icon
     * Wrong: #EF4444 background, white text, ✗ icon

2. AI Hint Floating Card (Bottom-right) ⭐ CORE:
   - Position: Fixed bottom-right, 32rpx from edges
   - Size: Initially collapsed (icon only), expands to max-width 85%
   - Background: #FFFFFF
   - Border-radius: 16rpx
   - Box-shadow: 0 12rpx 28rpx rgba(0,0,0,0.10) (strong shadow)
   - Z-index: 999

   Collapsed State (Icon):
   - Lightbulb icon 💡 (48rpx)
   - Subtle bounce animation to attract attention

   Expanded State (3-step progressive reveal):
   
   Step 1 (Focus hint):
   - Single line text: "识别前后句对立逻辑" (28rpx, semibold, #0F172A)
   - Background: Light yellow tint (#FFFBEB)
   - Padding: 16rpx

   Step 2 (First 2 scaffold points):
   - Previous step visible
   - Add 2 scaffold items:
     * "1. 找到句子中的转折词" (24rpx, #374151)
     * "2. 分析前后句的逻辑关系" (24rpx, #374151)
   - Numbered list with subtle left border accent (#4F7FE8)

   Step 3 (Full 3 scaffold points):
   - All previous visible
   - Add 3rd item:
     * "3. 判断空格处应填对立词还是递进词" (24rpx, #374151)
   - "展开更多" button at bottom if additional content

   Interaction:
   - Tap icon → Expand to Step 1
   - Tap "下一步" → Show Step 2
   - Tap "下一步" → Show Step 3
   - Tap anywhere outside → Collapse
   - Smooth height transition animation (300ms ease)

3. Answer Buttons (Bottom):
   - Row of buttons: "上一题" | "提交答案" | "下一题"
   - Primary button (提交答案): Blue gradient, white text
   - Secondary buttons: White, blue border, blue text
   - Full width with 16rpx gaps

HINT CARD VISUAL DETAILS:
- Icon color: #FFB84D (warm orange)
- Step indicator: Small dots at top (Step 1/2/3)
- Close button (×): Top-right, 32rpx, #6B7280
- Divider lines between steps: 1px solid #E5E7EB
- Fade-in animation for each step reveal

STYLE:
- AI hint card stands out with strong shadow
- Clean question display, generous line spacing
- Clear visual feedback for answer selection
- Smooth animations, no jarring transitions

MOOD: Supportive, intelligent, guiding (not revealing answer)
```

---

### 4.6 报告页 (report) 提示词

```
Prompt for Report Page with ECharts Visualizations:

Design a REPORT page featuring learning statistics and data visualizations.

LAYOUT:
- Screen: 375px × 812px, Background: #F8F9FB

KEY COMPONENTS:

1. Stats Overview (Top, 4 cards in 2×2 grid):
   - Each stat card:
     * White background, 12rpx border-radius, shadow
     * Icon (emoji, 32rpx) at top
     * Large number (40rpx, bold, gradient text #4F7FE8 to #3870D9)
     * Label below (24rpx, #6B7280)
     * Trend indicator: ↑12% in green or ↓5% in red (20rpx)
   - Cards: "完成题目" (1,250) | "正确率" (75%) | "学习时长" (42h) | "连续天数" (15)
   - Gap: 16rpx between cards

2. Accuracy Trend Chart (ECharts Line Chart):
   - White card container, 16rpx border-radius, shadow
   - Title "正确率趋势" (32rpx, semibold) with date range
   - Chart area: 600rpx height
   - Line color: #4F7FE8 (brand blue), 3px width
   - Area fill: Linear gradient from rgba(79,127,232,0.2) to transparent
   - Grid lines: Light gray (#E5E7EB), dashed
   - X-axis: Last 7 days dates
   - Y-axis: 0-100% accuracy
   - Data points: Circular markers, white fill, blue border
   - Tooltip: White card with shadow, shows date + accuracy

3. Error Analysis (ECharts Pie Chart):
   - White card container
   - Title "错题分析" (32rpx, semibold)
   - Pie chart: 400rpx diameter
   - Segments:
     * 阅读理解 (Reading): #DC2626 (orange-red), 35%
     * 完形填空 (Cloze): #6366F1 (violet), 25%
     * 翻译练习 (Translation): #065F46 (green), 20%
     * 词汇语法 (Vocabulary): #DB2777 (pink), 20%
   - Legend: Right side, colored squares + text
   - Label: Percentage outside, category name inside

4. Recommended Practice (Bottom):
   - Section title "推荐练习" (32rpx, semibold)
   - 2-3 recommendation cards:
     * Horizontal layout (icon + text)
     * Icon: Color-coded by category
     * Title + brief description
     * Arrow (›) on right for navigation
     * Light background (#F1F5F9)
     * Border-radius: 12rpx

CHART SPECIFICATIONS:
- ECharts responsive: true
- Animation duration: 750ms
- Tooltip: Follow mouse/touch
- Colors match brand accent colors (4 contrasting pairs)
- Font: System font, 24-28rpx
- Background: White (#FFFFFF)

INTERACTIONS:
- Tap chart segments → Show detail modal
- Swipe charts horizontally if multiple
- Tap recommendation → Navigate to practice

STYLE:
- Data-driven, professional
- Clean charts with subtle animations
- Color-coded by category
- High readability

MOOD: Analytical, insightful, motivating
```

---

### 4.7 AI助手页 (ai-assistant) 提示词

```
Prompt for AI Assistant Page with Chat Bubbles:

Design an AI ASSISTANT page with conversational chat interface.

LAYOUT:
- Screen: 375px × 812px, Background: #F8F9FB
- Chat area: Scrollable, bottom-aligned

KEY COMPONENTS:

1. Page Header:
   - Title "AI 学习助手" (48rpx, bold, #0F172A)
   - Subtitle "智能解答学习疑问" (24rpx, #6B7280)
   - Background: Gradient from #FFFFFF to #F8F9FB
   - Padding: 32rpx horizontal, 24rpx vertical

2. Quick Question Chips (Below header):
   - Horizontal scrollable row of suggestion chips
   - Each chip:
     * Text: "如何提高阅读速度？" etc. (24rpx)
     * Background: #FFFFFF, border #E5E7EB
     * Border-radius: 9999rpx (pill shape)
     * Padding: 12rpx 20rpx
     * Shadow: 0 2rpx 8rpx rgba(0,0,0,0.04)

3. Chat Messages:
   
   USER Message (Right-aligned):
   - Bubble background: #4F7FE8 (brand blue)
   - Text color: #FFFFFF (white)
   - Max-width: 70% of screen
   - Border-radius: 12rpx 12rpx 4rpx 12rpx (small radius top-right)
   - Padding: 12rpx 16rpx
   - Shadow: 0 2rpx 8rpx rgba(79,127,232,0.15)
   - Avatar: Right side, 32rpx circle, user photo

   AI Message (Left-aligned):
   - Bubble background: #FFFFFF (white)
   - Text color: #0F172A (dark)
   - Max-width: 75% of screen
   - Border-radius: 4rpx 12rpx 12rpx 12rpx (small radius top-left)
   - Padding: 12rpx 16rpx
   - Shadow: 0 2rpx 8rpx rgba(0,0,0,0.08)
   - Avatar: Left side, 32rpx circle, AI robot icon 🤖
   - Typing indicator: 3 animated dots when loading

4. Action Cards (AI can send):
   - White card with border
   - Icon + Title + Description
   - Action button at bottom
   - Border-radius: 12rpx
   - Examples:
     * "开始词汇练习" (vocabulary practice)
     * "查看错题本" (review mistakes)
     * "生成学习计划" (generate plan)

5. Input Bar (Bottom, fixed):
   - Background: #FFFFFF
   - Border-top: 1px solid #E5E7EB
   - Height: 96rpx + safe-area-inset-bottom
   - Components:
     * Input field (flex-grow, 28rpx text)
     * Placeholder: "输入问题..." (gray #9CA3AF)
     * Send button (circle, 64rpx, blue gradient when text entered, gray when empty)
     * Plus icon (+) for attachments (optional)

INTERACTIONS:
- Tap quick chip → Auto-fill input and send
- Tap action card → Execute action
- Messages auto-scroll to bottom
- Typing animation for AI response (3 dots)
- Smooth appear animation for new messages (fade + slide up)

STYLE:
- Conversational, friendly
- Clear sender distinction (blue vs white)
- Generous spacing between messages (16rpx)
- Timestamp: Small text (20rpx, #9CA3AF) above each message

MOOD: Helpful, intelligent, conversational, supportive
```

---

### 4.8 弹窗卡片提示词模板

```
Prompt for Modal/Dialog Cards:

Design MODAL DIALOG cards for various interactions.

GENERAL MODAL STRUCTURE:
- Overlay: rgba(15, 23, 42, 0.6) (dark transparent)
- Card: White #FFFFFF, centered
- Border-radius: 24rpx (large for modals)
- Shadow: 0 20rpx 50rpx rgba(0,0,0,0.15) (strong)
- Max-width: 85% of screen width
- Padding: 32rpx

MODAL TYPES:

1. CONFIRMATION DIALOG:
   - Icon at top (emoji or svg, 64rpx)
   - Title: "确认操作" (32rpx, semibold, #0F172A)
   - Message: Multi-line description (28rpx, #374151)
   - Buttons: Row at bottom
     * Cancel: White, gray text, gray border
     * Confirm: Blue gradient, white text
   - Button height: 72rpx
   - Gap between buttons: 16rpx

2. WORD DEFINITION POPUP:
   - Header: Word + phonetic (32rpx, semibold)
   - Divider: 1px solid #E5E7EB
   - Definitions: Numbered list (28rpx)
   - Example sentences: Italic, gray (24rpx)
   - Actions: "加入生词本" button at bottom (blue)
   - Close (×): Top-right corner

3. SENTENCE ANALYSIS POPUP:
   - Sentence: Highlighted with structure colors
   - Structure breakdown:
     * Subject: Blue underline
     * Predicate: Green underline
     * Object: Orange underline
   - Translation: Below, gray background box
   - Grammar points: Bullet list (24rpx)
   - Close button

4. SETTINGS MODAL:
   - Title: "设置" (Settings)
   - List items: Each with label + control
     * Font size: Slider control
     * Theme: Radio buttons (light/dark/auto)
     * Line spacing: Slider
   - Each item: 96rpx height, divider between
   - Save button at bottom (full-width, blue)

5. SUCCESS/ERROR TOAST:
   - Small card, 480rpx max-width
   - Icon + Text (horizontal layout)
   - Success: Green icon ✓, green text
   - Error: Red icon ✗, red text
   - Auto-dismiss: 2 seconds
   - Position: Top center, slide down animation

INTERACTIONS:
- Fade-in overlay: 200ms ease
- Scale-up card: 300ms cubic-bezier(0.2, 0.6, 0.2, 1)
- Tap overlay → Dismiss (optional)
- Swipe down → Dismiss (gesture)

STYLE:
- Clean, focused content
- Clear primary action
- No overwhelming information
- Smooth animations

MOOD: Contextual, clear, decisive
```

---

## 五、实施指南

### 5.1 开发流程

#### 📝 **Step 1: 设计阶段**

1. **选择页面/组件类型**
   - 确定页面功能（首页/学习页/练习页等）
   - 确定核心元素（卡片/列表/表单等）

2. **使用对应提示词**
   - 从本文档第四章选择对应提示词
   - 根据具体需求调整细节参数

3. **AI 生成设计**
   - 输入提示词到 AI 图像生成工具（Midjourney/DALL-E/Stable Diffusion）
   - 生成多个版本
   - 选择最佳方案

4. **设计审核**
   - 检查是否符合 Design Tokens v0.2 规范
   - 检查色彩对比度（WCAG AA）
   - 检查间距是否符合 8pt Grid

---

#### 💻 **Step 2: 开发阶段**

1. **创建页面文件**
```bash
# 创建页面目录
cd ll5.2/pages/your-page-name/

# 创建4个文件
touch your-page-name.wxml
touch your-page-name.js
touch your-page-name.wxss
touch your-page-name.json
```

2. **应用 Design Tokens**
```css
/* your-page-name.wxss */

/* 使用全局变量 */
page {
  background-color: var(--neutral-50); /* #F8F9FB */
}

.card {
  background: var(--surface-card); /* #FFFFFF */
  border-radius: var(--radius-lg); /* 16rpx */
  box-shadow: var(--shadow-md); /* 0 6rpx 16rpx rgba(0,0,0,0.08) */
  padding: var(--spacing-5); /* 24rpx */
}
```

3. **使用全局样式类**
```xml
<!-- your-page-name.wxml -->
<view class="your-page-name">
  <view class="page-header">
    <text class="page-title">标题</text>
  </view>
  
  <view class="card-shadow p-4 mb-3">
    <!-- 使用全局类: shadow, padding, margin -->
    卡片内容
  </view>
</view>
```

---

#### ✅ **Step 3: 验收阶段**

**设计规范检查清单**：

```
[ ] 色彩检查
  [ ] 品牌蓝使用 #4F7FE8
  [ ] 页面背景使用 #F8F9FB
  [ ] 撞色卡片使用4组配对
  [ ] 撞色深色位对比度 ≥ 4.5:1

[ ] 布局检查
  [ ] 间距使用 8rpx 倍数
  [ ] 卡片圆角 16rpx
  [ ] 撞色角标左下圆角 80rpx
  [ ] 2列网格 gap 16rpx

[ ] 文字检查
  [ ] 标题使用 H2(48rpx) 或 H3(32rpx)
  [ ] 正文使用 28rpx
  [ ] 辅助文字使用 24rpx
  [ ] 字重：标题 600-700，正文 400

[ ] 交互检查
  [ ] 卡片点击有 scale(0.98) 反馈
  [ ] 按钮点击有颜色加深
  [ ] 列表项点击有背景变化
  [ ] 过渡动画 200ms

[ ] 暗色检查
  [ ] 所有页面支持 themeClass
  [ ] 文字颜色正确反转
  [ ] 阴影透明度增加
  [ ] 对比度仍然达标
```

---

### 5.2 工具推荐

#### 🎨 **AI 图像生成工具**

1. **Midjourney** (推荐)
   - 优点：质量最高，细节丰富
   - 适用：所有页面设计

2. **DALL-E 3**
   - 优点：准确度高，遵循提示词
   - 适用：具体元素设计

3. **Stable Diffusion**
   - 优点：可控性强，可本地部署
   - 适用：批量生成变体

---

#### 🛠️ **开发工具**

1. **微信开发者工具** (必须)
   - 实时预览
   - 调试工具

2. **Figma/Sketch** (可选)
   - 设计稿制作
   - 标注工具

3. **Color Contrast Checker**
   - 检查对比度
   - 确保可访问性

---

### 5.3 最佳实践

#### ✅ **DO（应该做）**

```
✅ 始终使用 Design Tokens v0.2 定义的颜色
✅ 始终使用 8pt Grid 间距系统
✅ 为所有可交互元素提供触摸反馈
✅ 使用柔和阴影创造深度
✅ 保持文字层级清晰
✅ 支持暗色模式
✅ 使用圆润圆角（16rpx起）
```

---

#### ❌ **DON'T（不应该做）**

```
❌ 不要使用硬编码颜色值
❌ 不要使用非8倍数间距（如13rpx）
❌ 不要使用生硬的直角（0rpx）
❌ 不要移除阴影（会显得扁平）
❌ 不要过度使用颜色
❌ 不要忽略暗色模式
❌ 不要混合不同的设计风格
```

---

## 六、总结

### 6.1 核心设计元素汇总

```
设计风格: 温暖亲和 + 新拟物主义
品牌色: #4F7FE8 (温和蓝)
撞色系统: 橙/紫/绿/粉 四组配对
背景色: #F8F9FB (柔和蓝灰)
字体: System font, 28-64rpx
间距: 8pt Grid (8-48rpx)
圆角: 8-24rpx (16rpx默认)
阴影: 柔和多层次 (0.04-0.15透明度)
动画: 150-300ms, ease曲线
```

---

### 6.2 文档价值

✅ **统一视觉风格** - 所有页面遵循同一设计语言  
✅ **提高开发效率** - AI 提示词库快速生成设计  
✅ **确保质量** - Design Tokens 保证一致性  
✅ **易于维护** - 中心化设计规范  
✅ **支持扩展** - 模块化组件系统

---

### 6.3 下一步行动

1. **Week 1**: 应用撞色卡片系统到 study 页面
2. **Week 2**: 优化 practice 页面 AI 提示卡片
3. **Week 3**: 完善 vocabulary 页面词根详情卡片
4. **Week 4**: 统一所有页面的暗色模式

---

**📚 相关文档**：
- `plan.md` - UI设计系统指南 (Tokens v0.2)
- `design-tokens-v0.2.json` - 设计令牌数据
- `UI_DESIGN_GUIDE.md` - 扇贝风格设计系统
- `DESIGN_QUICK_REFERENCE.md` - 快速参考卡

---

**🎨 版本**: v1.0 Complete  
**📅 更新时间**: 2025-10-28  
**👤 维护者**: UI/UX 团队  
**✅ 状态**: ✅ 完成并定稿


