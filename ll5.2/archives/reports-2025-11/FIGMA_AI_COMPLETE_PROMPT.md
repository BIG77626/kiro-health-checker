# 🎨 Figma AI 完整设计提示词 - 考研英语学习小程序

> **用途**: 直接复制到 Figma AI 插件（Diagram/Magician/Automator）生成完整UI设计  
> **包含**: 8个完整页面 + 13个核心组件 + 完整设计系统  
> **版本**: v1.0 Complete

---

## 📋 目录

- [完整设计系统规范](#完整设计系统规范)
- [全部页面提示词](#全部页面提示词)
- [核心组件库提示词](#核心组件库提示词)
- [使用指南](#使用指南)

---

## 🎯 完整设计系统规范

### MASTER DESIGN SYSTEM PROMPT

```
Create a complete UI design system for a Chinese Postgraduate English Learning Mini-Program.

【DESIGN PHILOSOPHY】
Style: Warm & Friendly (Social style) + Neumorphism
Visual Language: Contrasting color card system + Soft shadows + Minimalist line icons
Brand Identity: Educational, modern, professional yet approachable

【COLOR SYSTEM】

Primary Brand Color (Gentle Blue):
- brand-500: #4F7FE8 (main buttons, links, emphasis)
- brand-600: #4973E0 (hover state)
- brand-700: #3D5FC8 (active/pressed state)

Contrasting Color Card System (CORE DESIGN LANGUAGE) ⭐:
4 color pairs for module differentiation:

1. ORANGE PAIR (Reading Comprehension):
   - Light: #FED7AA (warm peach, card background)
   - Dark: #DC2626 (deep red, accent wedge, contrast 4.6:1 vs white)
   
2. VIOLET PAIR (Cloze Test):
   - Light: #C7D2FE (soft lavender, card background)
   - Dark: #6366F1 (indigo, accent wedge, contrast ≥4.5:1)
   
3. GREEN PAIR (Translation):
   - Light: #A7F3D0 (mint green, card background)
   - Dark: #065F46 (deep teal, accent wedge, contrast 4.7:1)
   
4. PINK PAIR (Vocabulary):
   - Light: #FECACA (soft pink, card background)
   - Dark: #DB2777 (magenta, accent wedge, contrast 4.5:1)

Neutral Colors:
- neutral-50: #F8F9FB (page background - soft blue-gray)
- surface-card: #FFFFFF (all card backgrounds)
- text-primary: #0F172A (titles, important text)
- text-secondary: #374151 (body text)
- text-muted: #6B7280 (auxiliary text)
- border-default: #E5E7EB (dividers, borders)

Semantic Colors:
- success: #10B981 (green, correct answers)
- warning: #F59E0B (orange, warnings)
- error: #EF4444 (red, errors)
- info: #4F7FE8 (brand blue, info messages)

【TYPOGRAPHY】

Font Family: System UI, -apple-system, PingFang SC, Microsoft YaHei, sans-serif

Font Sizes (rpx = 0.5px for design):
- H1: 64rpx (32px) - Page main titles
- H2: 48rpx (24px) - Section titles
- H3: 32rpx (16px) - Card titles
- Body: 28rpx (14px) - Main content
- Caption: 24rpx (12px) - Auxiliary text
- Stat: 40rpx (20px) - Statistics numbers

Font Weights:
- Regular: 400 (body text)
- Medium: 500 (list items)
- Semibold: 600 (card titles)
- Bold: 700 (page titles, stats)

Line Heights:
- H1: 1.25x (80rpx / 40px)
- H2: 1.33x (64rpx / 32px)
- H3: 1.375x (44rpx / 22px)
- Body: 1.57x (44rpx / 22px) - comfortable reading
- Caption: 1.5x (36rpx / 18px)

【SPACING SYSTEM - 8pt Grid】
- spacing-1: 8rpx (4px) - Icon to text
- spacing-2: 12rpx (6px) - Small gaps
- spacing-3: 16rpx (8px) - Card gaps
- spacing-4: 20rpx (10px)
- spacing-5: 24rpx (12px) - Card padding
- spacing-6: 32rpx (16px) - Page margins
- spacing-7: 40rpx (20px) - Section gaps
- spacing-8: 48rpx (24px) - Large section gaps

【BORDER RADIUS】
- radius-sm: 8rpx (4px) - Small tags
- radius-md: 12rpx (6px) - Buttons, inputs
- radius-lg: 16rpx (8px) - Default cards
- radius-xl: 16rpx (8px) - Large cards (consistent)
- radius-2xl: 24rpx (12px) - Modals
- radius-full: 9999rpx - Circular elements
- accent-wedge-radius: 0 0 0 80rpx (0 0 0 40px) - Accent wedge (ONLY bottom-left rounded)

【SHADOW SYSTEM - Soft Neumorphism】
- shadow-xs: 0 2rpx 8rpx rgba(0,0,0,0.04) - Inputs
- shadow-sm: 0 4rpx 12rpx rgba(0,0,0,0.08) - Floating cards
- shadow-md: 0 6rpx 16rpx rgba(0,0,0,0.08) - Main cards (softened)
- shadow-lg: 0 20rpx 50rpx rgba(0,0,0,0.15) - Modals, emphasis

【ANIMATION】
- Duration-fast: 150ms (small elements)
- Duration-base: 200ms (default)
- Duration-slow: 300ms (page transitions)
- Easing: cubic-bezier(0.2, 0.6, 0.2, 1) - Standard easing

【CONTRASTING COLOR CARD STRUCTURE】⭐ CORE DESIGN ELEMENT

Card Layout:
1. Main card body: Light pastel background (from 4 color pairs)
2. Top-right accent wedge: Dark color (high contrast, irregular shape)
3. White icon: Top-left corner, 48rpx (24px)
4. Card text: Title + subtitle, bottom-left positioning
5. Optional badge: Top-left or top-right for notifications

Accent Wedge Details:
- Size: 100rpx × 100rpx (50px × 50px)
- Position: Absolute top-right (top: 0, right: 0)
- Border-radius: 0 0 0 80rpx (ONLY bottom-left rounded, creating irregular wedge shape)
- Z-index: 1 (behind text and icon, above background)
- Purpose: High visual differentiation between modules

Card Interaction:
- Default: Box-shadow shadow-md
- Hover: Transform translateY(-2rpx), shadow-lg
- Active: Transform scale(0.98), shadow-sm
- Transition: all 0.2s ease

【SCREEN SPECIFICATIONS】
- Device: iPhone X (375px × 812px)
- Safe area: Top 44px, Bottom 34px
- Page padding: 32rpx (16px) left/right
- Background: #F8F9FB for all pages
```

---

## 📱 全部页面提示词

### 1️⃣ HOME PAGE (首页)

```
Design a HOME page for Chinese Postgraduate English Learning app.

CANVAS: 375px × 812px, Background #F8F9FB

【PAGE STRUCTURE - Top to Bottom】

1. PAGE HEADER (Top section, 0-140px):
   Position: Sticky top
   Background: #F8F9FB
   Padding: 32rpx (16px) horizontal, 24rpx (12px) top
   
   Content:
   - Emoji icon: 📚 (32rpx / 16px)
   - Title: "今日学习" (H1: 64rpx/32px, Bold 700, #0F172A)
   - Subtitle: "继续保持学习习惯" (Caption: 28rpx/14px, Regular 400, #6B7280)
   
   Layout: Vertical stack, 8rpx (4px) gap

2. STATS OVERVIEW (140-300px):
   Container: White background, 16rpx (8px) border-radius, shadow-sm
   Layout: Horizontal 3-column grid, 16rpx (8px) gap
   Padding: 24rpx (12px) all sides
   
   Each Stat Item:
   - Icon (emoji): 🕐/🎯/📖 (32rpx/16px)
   - Value: "42分钟"/"75%"/"250道" (Stat: 40rpx/20px, Bold 700, Gradient text #4F7FE8 to #3870D9)
   - Label: "今日学习"/"正确率"/"完成题目" (Caption: 24rpx/12px, #6B7280)
   - Layout: Vertical stack, centered, 8rpx (4px) gap

3. QUICK START BUTTON (320-420px):
   Position: Full width minus 32rpx (16px) margins
   Height: 88rpx (44px)
   Background: Linear gradient 135deg, #4F7FE8 0%, #3870D9 100%
   Border-radius: 16rpx (8px)
   Box-shadow: shadow-sm
   
   Content:
   - Text: "开始学习" (H3: 32rpx/16px, Medium 500, #FFFFFF)
   - Icon (optional): ▶️ right side
   
   Interaction:
   - Hover: Gradient darkens 5%
   - Active: Transform translateY(1rpx), opacity 0.85

4. LEARNING SUGGESTIONS CARD (440-640px):
   Container: White, 16rpx (8px) border-radius, shadow-sm
   Padding: 24rpx (12px)
   
   Header:
   - Icon: 📋 (24rpx/12px)
   - Title: "今日建议" (H3: 32rpx/16px, Semibold 600, #0F172A)
   
   Content: 3 recommendation items
   Each item:
   - Checkbox (unchecked): 32rpx (16px) circle, border #E5E7EB
   - Text: "复习20个单词" etc. (Body: 28rpx/14px, #374151)
   - Time estimate: "预计10分钟" (Caption: 24rpx/12px, #6B7280)
   - Layout: Horizontal, 12rpx (6px) gap
   
   Vertical spacing: 16rpx (8px) between items

5. RECENT ACTIVITY (660-812px):
   Section title: "最近学习" (H2: 48rpx/24px, Semibold 600, #0F172A)
   Margin-top: 32rpx (16px)
   
   Activity cards (2-3 items):
   Each card: White, 12rpx (6px) border-radius, shadow-xs
   Padding: 16rpx (8px)
   
   Content:
   - Left: Color-coded icon (32rpx/16px) based on module type
   - Middle: Activity name + timestamp
   - Right: Progress indicator (circular progress, 48rpx/24px)
   
   Layout: Vertical list, 12rpx (6px) gap

【INTERACTION STATES】
- Cards: Hover lift 2rpx, shadow-md
- Button: Active press down 1rpx, darken 10%
- Checkboxes: Tap to check, animate checkmark

【SPACING】
- Section gaps: 32rpx (16px)
- Card internal padding: 24rpx (12px)
- Element gaps: 8-16rpx (4-8px)
```

---

### 2️⃣ STUDY PAGE (学习页) - 撞色卡片 ⭐

```
Design a STUDY page featuring 4 contrasting color module cards in 2×2 grid.

CANVAS: 375px × 812px, Background #F8F9FB

【PAGE STRUCTURE】

1. PAGE HEADER (0-100px):
   Similar to home page header
   Title: "学习中心"
   Subtitle: "选择学习模块"

2. MODULE CARDS GRID (120-520px):
   Container: 2 columns × 2 rows grid
   Gap: 16rpx (8px) between cards
   Horizontal margins: 32rpx (16px)
   
   Card dimensions: ((375px - 64px - 16px) / 2) = 147.5px width × 140px height minimum

【CONTRASTING COLOR CARD DESIGN】⭐ CORE

Each card structure:

CARD 1: READING COMPREHENSION (阅读理解) - ORANGE
- Main background: #FED7AA (light warm peach)
- Accent wedge (top-right): #DC2626 (deep red)
  * Size: 50px × 50px
  * Position: Absolute top 0, right 0
  * Border-radius: 0 0 0 40px (ONLY bottom-left rounded)
  * Z-index: 1
- Icon: 📖 Book icon (white, 24px, top-left 12px/12px position)
  * Filter: brightness(0) invert(1) to force pure white
  * Z-index: 2
- Title: "阅读理解" (16px, Semibold 600, #0F172A, bottom-left 12px/32px)
  * Z-index: 2
- Subtitle: "4篇文章" (12px, Regular 400, #374151, below title)
  * Z-index: 2
- Border-radius: 8px
- Box-shadow: shadow-md (0 3px 8px rgba(0,0,0,0.08))
- Padding: 12px

CARD 2: CLOZE TEST (完形填空) - VIOLET
- Main background: #C7D2FE (soft lavender)
- Accent wedge: #6366F1 (indigo)
- Icon: 📝 Pencil (white, 24px)
- Title: "完形填空"
- Subtitle: "20道题"
- Same layout as Card 1

CARD 3: TRANSLATION (翻译练习) - GREEN
- Main background: #A7F3D0 (mint green)
- Accent wedge: #065F46 (deep teal)
- Icon: 🔄 Translation (white, 24px)
- Title: "翻译练习"
- Subtitle: "10段文字"
- Same layout as Card 1

CARD 4: VOCABULARY (词汇学习) - PINK
- Main background: #FECACA (soft pink)
- Accent wedge: #DB2777 (magenta)
- Icon: 📚 Books (white, 24px)
- Title: "词汇学习"
- Subtitle: "50个单词"
- Same layout as Card 1

【OPTIONAL COUNT BADGE】
If showing error count or new items:
- Position: Top-left corner (8px/8px)
- Size: 32px × 32px circle
- Background: #EF4444 (red) or #F59E0B (orange)
- Text: Number (20px, Bold 700, #FFFFFF)
- Z-index: 3 (above everything)

3. EXAM PAPERS SECTION (540-812px):
   Section title: "历年真题" (H2: 24px, Semibold 600, #0F172A)
   Margin-top: 16px
   
   Paper list: Vertical scrollable
   Each item: White card, 8px radius, shadow-xs
   Content: Year + exam type + completion status
   Layout: Horizontal, icon + text + arrow

【CARD INTERACTION】
- Default: shadow-md
- Hover: Transform translateY(-2px), shadow-lg, duration 200ms
- Active: Transform scale(0.98), shadow-sm
- Tap feedback: Subtle scale animation

【LAYOUT NOTES】
- Grid uses CSS Grid: display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
- Cards use flexbox for internal layout
- Accent wedge uses absolute positioning
- All text has z-index: 2 to appear above wedge
```

---

### 3️⃣ VOCABULARY PAGE (词汇学习页)

```
Design a VOCABULARY LEARNING page with morpheme cards and root detail carousel.

CANVAS: 375px × 812px, Background #F8F9FB

【PAGE STRUCTURE】

1. PROGRESS CARD (Top, 0-180px):
   Container: White, 8px radius, shadow-sm
   Padding: 12px
   Margins: 16px horizontal
   
   Content:
   - Title: "今日学习进度" (12px, Semibold 600, #0F172A)
   - Progress bar (8px gap below title):
     * Container: #E5E7EB background, 7px height, full rounded
     * Fill: Linear gradient 135deg, #4DB584 to #2D8A6F, width: 60%
     * Smooth animation on load
   - Stats below (4px gap):
     * Text: "12个词素 / 50个单词" (12px, #6B7280)
     * Right-aligned: "60%" (14px, Bold 700, #4DB584)

2. ROOT DETAIL CARD (200-650px):
   Container: White, 12px radius, shadow-md
   Padding: 16px
   Margins: 16px horizontal
   
   【Top Section - Root Info】
   - Root form: "port" (24px, Bold 700, #0F172A)
   - Meaning: "搬运" (16px, Regular 400, #374151)
   - Origin: "Latin: portare" (12px, Italic, #6B7280)
   - Vertical stack, 4px gaps
   
   【Middle Section - Origin Story】 (Expandable)
   - Background: #F8F9FB (light gray box)
   - Border-radius: 8px
   - Padding: 12px
   - Text: Multi-line story (14px, line-height 1.6, #374151)
   - "展开更多" button if text truncated (12px, #4F7FE8)
   
   【Bottom Section - Word Carousel】
   Swiper component (full width):
   
   Each word card (swipeable):
   - Breakdown visualization:
     * "im- + port" with color coding
     * Prefix "im-" in #6366F1 (violet)
     * Root "port" in #4F7FE8 (blue)
     * Connected with "+" sign
     * Size: 16px, Semibold 600
   
   - Word: "import" (20px, Bold 700, #0F172A)
   - Phonetic: "/ɪmˈpɔːrt/" (12px, #6B7280)
   - Part of speech: "v." (12px, italic, #6B7280)
   - Meaning: "进口；输入" (14px, #374151)
   
   - Example section:
     * English: "We import coffee from Brazil." (14px, #0F172A)
     * Chinese: "我们从巴西进口咖啡。" (14px, #6B7280)
   
   - Image (optional):
     * Full width, 100px height
     * Border-radius: 8px
     * Source: Unsplash placeholder
     * Margin-top: 12px
   
   Swiper indicators (dots): Bottom center, 8px circles

3. LEARNING MODE TABS (670-730px):
   Container: Horizontal scrollable pills
   Background: transparent
   Padding: 0 16px
   
   Each tab:
   - Pill shape (border-radius: 9999px)
   - Height: 30px
   - Padding: 6px 16px
   
   Active tab:
   - Background: #4F7FE8
   - Text: #FFFFFF (14px, Medium 500)
   
   Inactive tab:
   - Background: #E5E7EB
   - Text: #6B7280 (14px, Regular 400)
   
   Tabs: "词素学习" | "词汇练习" | "词汇测试"
   Gap: 8px between tabs

4. MORPHEME GRID (750-812px):
   Layout: 3 columns grid
   Gap: 8px
   Margins: 16px horizontal
   
   Each morpheme card:
   - Background: #F1F5F9 (light gray)
   - Border-radius: 6px
   - Padding: 8px
   - Height: 80px
   
   Content:
   - Label: "前缀"/"词根"/"后缀" (10px, #6B7280)
   - Morpheme: "im-" (16px, Semibold 600, #0F172A)
   - Count: "15个单词" (10px, #9CA3AF)
   
   Vertical stack, centered

【INTERACTIONS】
- Swipe cards left/right for next/previous word
- Tap origin story to expand/collapse
- Tap morpheme card to navigate to detail
- Progress bar animates on page load
```

---

### 4️⃣ PRACTICE PAGE (练习页) - 含AI提示卡片

```
Design a PRACTICE page with question display and floating AI hint card.

CANVAS: 375px × 812px, Background #F8F9FB

【PAGE STRUCTURE】

1. QUESTION HEADER (0-80px):
   Container: White, sticky top
   Border-bottom: 1px solid #E5E7EB
   Padding: 12px 16px
   
   Content:
   - Left: Back button "< 返回" (14px, #4F7FE8)
   - Center: Question number "1/20" (16px, Semibold 600, #0F172A)
   - Right: Timer "05:30" (14px, #6B7280) with clock icon
   
   Layout: Horizontal space-between

2. QUESTION CARD (100-500px):
   Container: White, 8px radius, shadow-sm
   Margins: 16px
   Padding: 16px
   
   【Reading Passage】(if reading question)
   - Title: "Passage 1" (16px, Semibold 600, #0F172A)
   - Paragraph numbers: [1], [2], [3] inline (12px, #6B7280)
   - Text: Multi-paragraph (14px, line-height 1.6, #0F172A)
   - Highlighted keywords: Yellow background (#FEF3C7)
   
   【Question Stem】
   - Number: "21." (14px, Semibold 600, #0F172A)
   - Question text: Multi-line (14px, line-height 1.5, #0F172A)
   - Spacing: 16px above, 12px below
   
   【Answer Options】
   Layout: Vertical stack, 8px gap
   
   Each option:
   - Container: 100% width, 8px radius, 8px padding
   - Default state:
     * Background: #FFFFFF
     * Border: 2px solid #E5E7EB
   - Selected state:
     * Background: #EFF6FF (light blue)
     * Border: 2px solid #4F7FE8
   - Correct state (after submit):
     * Background: #D1FAE5 (light green)
     * Border: 2px solid #10B981
     * Checkmark icon ✓ right side (16px, #10B981)
   - Wrong state (after submit):
     * Background: #FEE2E2 (light red)
     * Border: 2px solid #EF4444
     * Cross icon ✗ right side (16px, #EF4444)
   
   Content:
   - Label: "[A]", "[B]", "[C]", "[D]" (14px, Bold 700, #374151)
   - Text: Option content (14px, #0F172A)
   - Layout: Horizontal, 8px gap

3. AI HINT FLOATING CARD (Bottom-right) ⭐ CORE FEATURE:
   Position: Fixed bottom-right
   Right: 16px, Bottom: 100px (above button bar)
   Max-width: 85% of screen (320px)
   Z-index: 999
   
   【Collapsed State - Icon Only】
   - Size: 48px × 48px circle
   - Background: Linear gradient 135deg, #FFB84D 0%, #FF9500 100%
   - Icon: 💡 Lightbulb (24px, centered)
   - Box-shadow: shadow-lg
   - Animation: Subtle bounce every 3s to attract attention
   
   【Expanded State - 3 Steps Progressive Reveal】
   
   Container:
   - Background: #FFFFFF
   - Border-radius: 8px
   - Box-shadow: 0 6px 14px rgba(0,0,0,0.10) (strong emphasis)
   - Padding: 12px
   
   Step Indicators (Top):
   - 3 dots: Active #4F7FE8, Inactive #E5E7EB
   - Size: 6px circles, 4px gap
   - Horizontal centered
   
   Close button:
   - Position: Absolute top-right (8px/8px)
   - Icon: × (16px, #6B7280)
   
   【Step 1 - Focus Hint】
   Content:
   - Background tint: #FFFBEB (light yellow)
   - Border-radius: 6px
   - Padding: 8px
   - Text: "识别前后句对立逻辑" (14px, Semibold 600, #0F172A)
   - Icon: 🎯 left side (16px)
   - Max-width: 1 line, ~9 Chinese characters
   
   Button:
   - "下一步" (12px, #4F7FE8)
   - Position: Bottom-right
   - Tap to reveal Step 2
   
   【Step 2 - First 2 Scaffold Points】
   Previous content visible (Step 1)
   Add below with 8px gap:
   
   Divider: 1px solid #E5E7EB
   
   Scaffold list:
   - Numbered list (1., 2.)
   - Left accent border: 2px solid #4F7FE8, 8px left margin
   - Padding-left: 12px
   
   Items:
   - "1. 找到句子中的转折词" (12px, #374151)
   - "2. 分析前后句的逻辑关系" (12px, #374151)
   - Line-height: 1.5
   - Vertical gap: 8px
   
   Button: "下一步" → Reveal Step 3
   
   【Step 3 - Full 3 Scaffold Points】
   Previous content visible (Steps 1 & 2)
   Add 3rd scaffold item:
   - "3. 判断空格处应填对立词还是递进词" (12px, #374151)
   
   Optional "展开更多" if additional hints available
   
   【Hint Card Animation】
   - Expand: Height transition 300ms ease, fade-in opacity
   - Collapse: Height transition 300ms ease, fade-out opacity
   - Step reveal: Slide down 200ms cubic-bezier(0.2,0.6,0.2,1)
   - Icon bounce: Scale 1 → 1.1 → 1, duration 600ms, repeat 3s interval

4. ANSWER BUTTON BAR (Fixed bottom):
   Container: White background
   Border-top: 1px solid #E5E7EB
   Height: 64px + safe-area-inset-bottom
   Padding: 8px 16px
   
   Layout: Horizontal 3 buttons with gap 8px
   
   Buttons:
   - "上一题" (Secondary): White, #4F7FE8 text, #4F7FE8 border
   - "提交答案" (Primary): #4F7FE8 gradient, #FFFFFF text
   - "下一题" (Secondary): Same as 上一题
   
   Button specs:
   - Height: 44px
   - Border-radius: 6px
   - Font: 14px, Medium 500
   - Shadow: shadow-xs

【INTERACTION FLOWS】
1. Idle 30s → AI hint icon appears with bounce
2. Tap icon → Expand to Step 1
3. Tap "下一步" → Reveal Step 2
4. Tap "下一步" → Reveal Step 3
5. Tap outside or × → Collapse to icon
6. Select option → Border highlights blue
7. Tap "提交答案" → Show correct/wrong states
```

---

### 5️⃣ REPORT PAGE (报告页)

```
Design a REPORT page with statistics and ECharts visualizations.

CANVAS: 375px × 812px, Background #F8F9FB

【PAGE STRUCTURE】

1. PAGE HEADER (0-100px):
   Title: "学习报告"
   Date range selector: "最近7天" dropdown

2. STATS OVERVIEW (120-300px):
   Layout: 2×2 grid
   Gap: 8px
   Margins: 16px horizontal
   
   Each stat card:
   - Background: White
   - Border-radius: 6px
   - Box-shadow: shadow-sm
   - Padding: 12px
   - Height: 80px
   
   Content per card:
   - Icon (emoji): Top-left (16px)
   - Value: Center-large (20px, Bold 700, Gradient #4F7FE8 to #3870D9)
   - Label: Below value (12px, #6B7280)
   - Trend: Bottom-right
     * Positive: "↑12%" (10px, #10B981)
     * Negative: "↓5%" (10px, #EF4444)
   
   Cards:
   1. 📝 Complete: "1,250" | "完成题目"
   2. ✅ Accuracy: "75%" | "正确率"
   3. ⏱ Duration: "42h" | "学习时长"
   4. 🔥 Streak: "15天" | "连续天数"

3. ACCURACY TREND CHART (320-620px):
   Container: White, 8px radius, shadow-sm
   Padding: 16px
   Margins: 16px horizontal
   
   Header:
   - Title: "正确率趋势" (16px, Semibold 600, #0F172A)
   - Date range: "10/21 - 10/28" (12px, #6B7280)
   
   ECharts Line Chart:
   - Canvas: 343px × 240px
   - Background: Transparent
   - Line color: #4F7FE8 (3px width)
   - Area fill: Linear gradient from rgba(79,127,232,0.2) to transparent
   - Data points: Circular markers (6px), white fill, #4F7FE8 border (2px)
   - Grid lines: #E5E7EB, dashed (1px)
   - X-axis: Last 7 days dates (10px, #6B7280)
   - Y-axis: 0-100% (10px, #6B7280)
   - Tooltip: White card, shadow-sm, shows date + accuracy percentage
   
   Chart config:
   - Smooth: true
   - Animation: 750ms ease
   - Responsive: true

4. ERROR ANALYSIS PIE CHART (640-812px):
   Container: White, 8px radius, shadow-sm
   Padding: 16px
   Margins: 16px horizontal
   
   Header:
   - Title: "错题分析" (16px, Semibold 600, #0F172A)
   
   ECharts Pie Chart:
   - Canvas: 200px diameter
   - Position: Center-left
   
   Segments (match 4 color pairs):
   1. 阅读理解: #DC2626 (orange-red), 35%
   2. 完形填空: #6366F1 (violet), 25%
   3. 翻译练习: #065F46 (green), 20%
   4. 词汇语法: #DB2777 (pink), 20%
   
   Labels:
   - Inside: Category name (12px, #FFFFFF)
   - Outside: Percentage (12px, #0F172A)
   - Leader lines: #E5E7EB
   
   Legend:
   - Position: Right side, vertical stack
   - Color square (12px) + text (12px, #374151)
   - Gap: 8px between items
   
   Chart config:
   - Label position: Outside
   - Animation: 750ms ease
   - Emphasis: Scale 1.1, shadow

【CHART SPECIFICATIONS】
- ECharts version: 5.x
- Font family: Inherit system font
- Colors: Match brand color system
- Responsive: true
- Tooltip follow: true
- Animation easing: cubicOut
```

---

### 6️⃣ AI ASSISTANT PAGE (AI助手页)

```
Design an AI ASSISTANT page with chat interface.

CANVAS: 375px × 812px, Background #F8F9FB

【PAGE STRUCTURE】

1. PAGE HEADER (0-120px):
   Background: Linear gradient #FFFFFF to #F8F9FB
   Padding: 16px
   Border-bottom: 1px solid #E5E7EB
   
   Content:
   - Title: "AI 学习助手" (24px, Bold 700, #0F172A)
   - Subtitle: "智能解答学习疑问" (12px, #6B7280)
   - AI avatar: 🤖 (32px) top-right
   
   Quick question chips (below, horizontal scroll):
   - Container: Horizontal scrollable
   - No scrollbar visible
   
   Each chip:
   - Background: #FFFFFF
   - Border: 1px solid #E5E7EB
   - Border-radius: 9999px (pill)
   - Padding: 6px 12px
   - Text: "如何提高阅读速度？" etc. (12px, #374151)
   - Shadow: shadow-xs
   - Gap: 8px between chips
   
   Chips: ["如何提高阅读速度？", "词根记忆法", "翻译技巧"]

2. CHAT MESSAGES AREA (140-688px):
   Container: Scrollable vertical
   Padding: 16px
   Auto-scroll to bottom
   
   【USER MESSAGE (Right-aligned)】
   Layout: Flex-end alignment
   
   Structure:
   - Avatar: Right side, 32px circle, user photo
   - Message bubble:
     * Background: #4F7FE8 (brand blue)
     * Text color: #FFFFFF
     * Border-radius: 12px 12px 4px 12px (small radius top-right)
     * Max-width: 70% (262px)
     * Padding: 6px 12px
     * Box-shadow: 0 1px 4px rgba(79,127,232,0.15)
   - Text: 14px, Regular 400, line-height 1.5
   - Timestamp: Below bubble, 10px, #9CA3AF, right-aligned
   
   【AI MESSAGE (Left-aligned)】
   Layout: Flex-start alignment
   
   Structure:
   - Avatar: Left side, 32px circle, 🤖 robot icon
   - Message bubble:
     * Background: #FFFFFF
     * Text color: #0F172A
     * Border-radius: 4px 12px 12px 12px (small radius top-left)
     * Max-width: 75% (281px)
     * Padding: 6px 12px
     * Box-shadow: shadow-sm (0 2px 4px rgba(0,0,0,0.08))
   - Text: 14px, Regular 400, line-height 1.6, #0F172A
   - Timestamp: Below bubble, 10px, #9CA3AF, left-aligned
   
   【TYPING INDICATOR】
   - 3 animated dots (6px each)
   - Color: #6B7280
   - Animation: Bounce sequentially, 600ms duration
   - Container: Same as AI message bubble
   
   【ACTION CARD】(AI can send)
   - Background: #FFFFFF
   - Border: 2px solid #E5E7EB
   - Border-radius: 8px
   - Padding: 12px
   - Max-width: 75%
   
   Content:
   - Icon: Top-left (24px)
   - Title: "开始词汇练习" (14px, Semibold 600, #0F172A)
   - Description: "巩固今天学习的20个单词" (12px, #6B7280)
   - Action button: Bottom, full width
     * Background: #4F7FE8
     * Text: "开始" (14px, Medium 500, #FFFFFF)
     * Height: 36px
     * Border-radius: 6px
   
   Vertical gap: 8px between elements
   
   【MESSAGE SPACING】
   - Between different users: 16px
   - Same user consecutive: 4px
   - Message to timestamp: 4px

3. INPUT BAR (Fixed bottom, 688-812px):
   Position: Fixed bottom
   Height: 64px + safe-area-inset-bottom
   Background: #FFFFFF
   Border-top: 1px solid #E5E7EB
   Padding: 8px 16px
   
   Layout: Horizontal
   
   Components:
   - Plus button (optional): Left side
     * Icon: + (20px, #6B7280)
     * Size: 36px circle
     * Background: #F3F4F6
     * For attachments
   
   - Input field: Center, flex-grow
     * Background: #F3F4F6
     * Border-radius: 9999px (pill)
     * Height: 40px
     * Padding: 0 16px
     * Placeholder: "输入问题..." (14px, #9CA3AF)
     * Text: 14px, #0F172A
     * No border
   
   - Send button: Right side
     * Size: 40px circle
     * Background when empty: #E5E7EB (gray, disabled)
     * Background with text: Linear gradient #4F7FE8 to #3870D9
     * Icon: ▶️ or paper plane (16px, #FFFFFF)
     * Disabled when input empty
   
   Gap: 8px between elements

【INTERACTIONS】
- Tap chip → Auto-fill input and send
- Type message → Enable send button with animation
- Send → Message slides up, typing indicator appears
- AI responds → Typing indicator disappears, message fades in
- Tap action card button → Navigate to corresponding feature
- Long press message → Show copy/delete options
- Scroll to load history (infinite scroll)

【ANIMATIONS】
- New message: Slide up + fade in, 200ms ease
- Typing dots: Sequential bounce, 600ms loop
- Send button: Scale 0.95 on tap
- Chips: Horizontal scroll momentum
```

---

### 7️⃣ PROFILE PAGE (个人中心)

```
Design a PROFILE page with user info, stats, and settings.

CANVAS: 375px × 812px, Background #F8F9FB

【PAGE STRUCTURE】

1. USER HEADER CARD (0-220px):
   Container: White, rounded-bottom 16px only
   Padding: 16px
   Shadow: shadow-sm
   
   Background: Linear gradient 135deg, #4F7FE8 20% height, then #FFFFFF
   
   Content:
   - Avatar: 64px circle, center-top
     * Border: 3px solid #FFFFFF
     * Shadow: shadow-sm
   - Username: Below avatar, 20px, Bold 700, #0F172A
   - User ID: "ID: 123456" (12px, #6B7280)
   - Level badge: "Lv.5 学霸" (12px, gradient background pill)
   
   Stats row (horizontal, 3 columns, equal width):
   - Dividers: 1px solid #E5E7EB
   - Each stat:
     * Value: 20px, Bold 700, #0F172A
     * Label: 12px, #6B7280
   - Stats: "学习天数 42" | "完成题目 1,250" | "正确率 75%"

2. LEARNING DATA SECTION (240-400px):
   Section title: "学习数据" (16px, Semibold 600, #0F172A)
   Margin: 16px horizontal, 16px top
   
   Cards (2 rows):
   Layout: 2 columns grid, 8px gap
   
   Card 1: Weekly summary
   - Background: White, 8px radius, shadow-xs
   - Padding: 12px
   - Icon: 📊 (16px)
   - Title: "本周学习" (14px, #0F172A)
   - Value: "240分钟" (20px, Bold 700, gradient text)
   - Trend: "+15%" (12px, #10B981)
   
   Card 2: Accuracy
   Card 3: Streak
   Card 4: Weak points
   
   Same structure as Card 1, different data

3. ACHIEVEMENTS SECTION (420-620px):
   Section title: "成就徽章" (16px, Semibold 600, #0F172A)
   "查看全部" link (12px, #4F7FE8) right-aligned
   
   Container: White, 8px radius, shadow-xs
   Padding: 16px
   Margins: 16px horizontal
   
   Achievement grid: 3 columns
   Gap: 12px
   
   Each achievement:
   - Size: 96px × 96px
   - Background: #F8F9FB
   - Border-radius: 8px
   - Padding: 8px
   
   Unlocked state:
   - Icon: 🏆🎯⭐ etc. (32px) colored
   - Title: "连续7天" (12px, #0F172A)
   - Progress: "已解锁" (10px, #10B981)
   - Badge corner: Gold ✓ (16px) top-right
   
   Locked state:
   - Opacity: 0.5
   - Grayscale filter
   - Progress: "3/7" (10px, #6B7280)

4. MENU LIST (640-812px):
   Container: White, 8px radius, shadow-xs
   Margins: 16px horizontal
   
   Menu items (vertical stack):
   Each item:
   - Height: 48px
   - Padding: 0 16px
   - Border-bottom: 1px solid #F3F4F6 (except last)
   
   Layout: Icon + Text + Arrow
   - Left icon: 24px, colored based on function
   - Text: 14px, #0F172A
   - Right arrow: › (20px, #9CA3AF)
   
   Items:
   - ⚙️ Settings | "设置"
   - 📚 Study plan | "学习计划"
   - 🔔 Notifications | "通知"
   - 💬 Feedback | "意见反馈"
   - ℹ️ About | "关于我们"
   - 🚪 Logout | "退出登录" (red text #EF4444)

【INTERACTIONS】
- Tap avatar → Edit profile modal
- Tap stats → Navigate to detailed report
- Tap achievement → Show achievement detail modal
- Tap menu item → Navigate to corresponding page
- Pull down → Refresh user data
```

---

### 8️⃣ WRONG QUESTIONS PAGE (错题本)

```
Design a WRONG QUESTIONS page with filtering and question list.

CANVAS: 375px × 812px, Background #F8F9FB

【PAGE STRUCTURE】

1. PAGE HEADER (0-60px):
   Title: "错题本"
   Right: "批量操作" button (14px, #4F7FE8)

2. FILTER BAR (80-140px):
   Container: White, bottom shadow-xs
   Padding: 12px 16px
   
   Layout: Horizontal scrollable
   
   Filter chips:
   Each chip:
   - Border-radius: 9999px
   - Padding: 6px 12px
   - Height: 32px
   
   Active chip:
   - Background: #4F7FE8
   - Text: #FFFFFF (12px, Medium 500)
   
   Inactive chip:
   - Background: #F3F4F6
   - Text: #6B7280 (12px, Regular 400)
   
   Chips: "全部" | "阅读理解" | "完形填空" | "翻译" | "词汇"
   Gap: 8px

3. QUESTIONS LIST (160-812px):
   Container: Scrollable vertical
   Padding: 16px
   
   【Each Question Card】
   Container: White, 8px radius, shadow-sm
   Margin-bottom: 12px
   Padding: 12px
   
   【Card Header】
   Layout: Horizontal space-between
   
   Left:
   - Type badge: Pill shape
     * Background: Based on type (orange/violet/green/pink light colors)
     * Text: "阅读理解" (10px, corresponding dark color)
     * Padding: 2px 8px
   
   Right:
   - Date: "2025-10-25" (10px, #9CA3AF)
   
   【Question Content】
   Margin-top: 8px
   - Question number: "21." (12px, Semibold 600, #0F172A)
   - Question text: Multi-line, max 3 lines, ellipsis (12px, line-height 1.5, #374151)
   - "展开" link if truncated (10px, #4F7FE8)
   
   【Answer Section】
   Margin-top: 12px
   Background: #F8F9FB
   Border-radius: 6px
   Padding: 8px
   
   Layout: Horizontal grid, 2 rows
   
   Row 1:
   - Label: "你的答案：" (12px, #6B7280)
   - Answer: "B" (14px, Bold 700, #EF4444 red - wrong)
   
   Row 2:
   - Label: "正确答案：" (12px, #6B7280)
   - Answer: "C" (14px, Bold 700, #10B981 green - correct)
   
   【Action Buttons】
   Margin-top: 12px
   Layout: Horizontal, gap 8px
   
   Buttons:
   - "重新练习" (Secondary): White, #4F7FE8 text/border, small size
   - "查看解析" (Secondary): Same style
   - "已掌握" (Success): #10B981 gradient, white text, small size
   
   Button specs:
   - Height: 32px
   - Border-radius: 6px
   - Padding: 4px 12px
   - Font: 12px, Medium 500

4. EMPTY STATE (If no wrong questions):
   Position: Center of screen
   
   Content:
   - Icon: 🎉 (64px)
   - Title: "暂无错题" (20px, Semibold 600, #0F172A)
   - Subtitle: "继续保持！" (14px, #6B7280)
   - Action button: "开始练习" (primary style)
   
   Vertical stack, centered, 12px gaps

【INTERACTIONS】
- Tap filter chip → Filter questions by type
- Tap question card → Expand to show full question
- Tap "查看解析" → Show explanation modal
- Tap "重新练习" → Navigate to practice with this question
- Tap "已掌握" → Move to mastered, show success toast
- Swipe card left → Show delete option
- Pull down → Refresh list
```

---

## 🧩 核心组件库提示词

### COMPONENT 1: Contrasting Color Card ⭐

```
Design a reusable CONTRASTING COLOR CARD component (module card).

SPECIFICATIONS:

Container:
- Width: Flexible (typically 147.5px in 2-column grid)
- Height: Minimum 140px (auto-expand with content)
- Border-radius: 8px
- Box-shadow: 0 3px 8px rgba(0,0,0,0.08)
- Padding: 12px
- Position: Relative (for absolute child positioning)
- Overflow: hidden (to clip accent wedge)

Background:
- Variable based on module type (4 options):
  * Orange: #FED7AA
  * Violet: #C7D2FE
  * Green: #A7F3D0
  * Pink: #FECACA

Accent Wedge (Top-right corner):
- Element: <div> with absolute positioning
- Size: 50px × 50px
- Position: top: 0, right: 0
- Border-radius: 0 0 0 40px (ONLY bottom-left rounded)
- Z-index: 1
- Background: Variable based on type:
  * Orange pair: #DC2626 (deep red)
  * Violet pair: #6366F1 (indigo)
  * Green pair: #065F46 (deep teal)
  * Pink pair: #DB2777 (magenta)

White Icon (Top-left):
- Element: <img> or <svg>
- Size: 24px × 24px
- Position: Absolute or flex-start, top-left (12px, 12px)
- Color: Pure white #FFFFFF
- Filter: brightness(0) invert(1) (to force white color)
- Z-index: 2 (above wedge, below text)
- Icons: 📖 (reading), 📝 (cloze), 🔄 (translation), 📚 (vocabulary)

Card Title:
- Text: Module name (e.g., "阅读理解")
- Position: Bottom-left area (12px from bottom, 12px from left)
- Font-size: 16px
- Font-weight: 600 (Semibold)
- Color: #0F172A (dark text)
- Z-index: 2 (above wedge)

Card Subtitle:
- Text: Item count (e.g., "4篇文章")
- Position: Below title, same left alignment
- Font-size: 12px
- Font-weight: 400 (Regular)
- Color: #374151 (secondary text)
- Margin-top: 4px
- Z-index: 2

Optional Count Badge:
- Element: Circle or rounded rectangle
- Size: 32px × 32px circle OR auto-width × 24px pill
- Position: Absolute top-left (8px, 8px) OR top-right (8px, 8px)
- Background: #EF4444 (red) for errors, #F59E0B (orange) for new items
- Text: Number (e.g., "5")
- Font-size: 12px
- Font-weight: 700 (Bold)
- Color: #FFFFFF
- Z-index: 3 (highest, above everything)

INTERACTION STATES:

Default:
- Box-shadow: 0 3px 8px rgba(0,0,0,0.08)
- Transform: none
- Transition: all 0.2s ease

Hover:
- Transform: translateY(-2px)
- Box-shadow: 0 10px 25px rgba(0,0,0,0.15)
- Transition: all 0.2s ease

Active (Pressed):
- Transform: scale(0.98)
- Box-shadow: 0 2px 4px rgba(0,0,0,0.08)
- Transition: all 0.1s ease

USAGE EXAMPLES:

4 variants:
1. Reading (Orange): Light #FED7AA, Dark #DC2626, Icon 📖
2. Cloze (Violet): Light #C7D2FE, Dark #6366F1, Icon 📝
3. Translation (Green): Light #A7F3D0, Dark #065F46, Icon 🔄
4. Vocabulary (Pink): Light #FECACA, Dark #DB2777, Icon 📚
```

---

### COMPONENT 2: AI Hint Floating Card ⭐

```
Design an AI HINT FLOATING CARD component with 3-step progressive reveal.

SPECIFICATIONS:

【Initial State - Icon Only】

Container:
- Size: 48px × 48px circle
- Position: Fixed bottom-right
  * Right: 16px
  * Bottom: 100px (above button bar)
- Background: Linear gradient 135deg, #FFB84D 0%, #FF9500 100%
- Box-shadow: 0 6px 14px rgba(0,0,0,0.15) (strong emphasis)
- Z-index: 999
- Cursor: pointer

Icon:
- Content: 💡 Lightbulb emoji OR <svg> lightbulb
- Size: 24px
- Color: #FFFFFF
- Position: Centered (flex center)

Animation (Idle):
- Keyframes: Scale 1 → 1.1 → 1
- Duration: 600ms
- Easing: cubic-bezier(0.4, 0.0, 0.2, 1)
- Iteration: Infinite
- Delay: 3s (bounces every 3 seconds)

【Expanded State - Container】

Container:
- Max-width: 85% of screen (320px)
- Width: Auto (content-based)
- Position: Fixed bottom-right (same as icon)
- Background: #FFFFFF
- Border-radius: 8px
- Box-shadow: 0 6px 14px rgba(0,0,0,0.10)
- Padding: 12px
- Z-index: 999
- Overflow: hidden (for smooth height transition)

Expand Animation:
- From: Height 48px, opacity 0
- To: Height auto, opacity 1
- Duration: 300ms
- Easing: ease
- Property: height, opacity

【Header Section】

Step Indicators (Top center):
- Layout: Horizontal flex, centered
- Gap: 4px between dots
- Each dot:
  * Size: 6px circle
  * Active: Background #4F7FE8
  * Inactive: Background #E5E7EB
  * Transition: background 200ms ease
- Total dots: 3 (representing steps 1/2/3)

Close Button (Top-right):
- Position: Absolute top 8px, right 8px
- Icon: × (cross)
- Size: 16px
- Color: #6B7280
- Hover: Color #0F172A
- Cursor: pointer

【Step 1 - Focus Hint】

Container:
- Background: #FFFBEB (light yellow tint)
- Border-radius: 6px
- Padding: 8px
- Margin-top: 8px (below indicators)

Layout: Horizontal
- Icon: 🎯 Target emoji (16px) left side
- Text: Focus hint (e.g., "识别前后句对立逻辑")
  * Font-size: 14px
  * Font-weight: 600 (Semibold)
  * Color: #0F172A
  * Max-width: ~9 Chinese characters (1 line)
  * Line-height: 1.4
- Gap: 8px between icon and text

Next Button:
- Position: Bottom-right of card
- Margin-top: 8px
- Text: "下一步" (Next Step)
- Font-size: 12px
- Font-weight: 500 (Medium)
- Color: #4F7FE8
- Background: transparent
- Cursor: pointer
- Hover: Underline

【Step 2 - Scaffold Points (First 2)】

Previous content remains visible (Step 1)

Divider:
- Margin: 8px vertical
- Height: 1px
- Background: #E5E7EB

Scaffold Container:
- Padding-left: 12px
- Border-left: 2px solid #4F7FE8 (accent bar)

List Items (Numbered):
- Layout: Vertical stack
- Gap: 8px between items

Each item:
- Number prefix: "1.", "2." (12px, #6B7280)
- Text: Scaffold point (e.g., "找到句子中的转折词")
  * Font-size: 12px
  * Font-weight: 400 (Regular)
  * Color: #374151
  * Line-height: 1.5
  * Max-width: 100%

Items shown in Step 2:
- Item 1: First scaffold point
- Item 2: Second scaffold point

Next Button: Same as Step 1

【Step 3 - Full Scaffold (All 3)】

Previous content remains visible (Steps 1 & 2)

Add 3rd scaffold item below:
- Same styling as Step 2 items
- Number: "3."
- Text: Third scaffold point

Optional Expand Button (if more content):
- Text: "展开更多" (Expand more)
- Style: Same as Next button
- Position: Bottom-right

【Interaction Animations】

Step Reveal:
- New content: Slide down from top
- Animation: translateY(-10px) → translateY(0), opacity 0 → 1
- Duration: 200ms
- Easing: cubic-bezier(0.2, 0.6, 0.2, 1)

Collapse:
- Entire card: Height auto → 48px
- Opacity: 1 → 0 for content, keep icon
- Duration: 300ms
- Easing: ease

Tap Outside:
- Event: Click outside card bounds
- Action: Collapse to icon state

【State Management】

States:
- collapsed: Icon only
- step1: Icon + Step 1 content
- step2: Icon + Step 1 + Step 2 content
- step3: Icon + Step 1 + Step 2 + Step 3 content

Transitions:
- collapsed → step1: Tap icon
- step1 → step2: Tap "下一步"
- step2 → step3: Tap "下一步"
- Any → collapsed: Tap ×, tap outside, or automatic after answer submit
```

---

### COMPONENT 3: Button System

```
Design a complete BUTTON SYSTEM with 3 variants.

【PRIMARY BUTTON】

Default State:
- Background: Linear gradient 135deg, #4F7FE8 0%, #3870D9 100%
- Text color: #FFFFFF
- Font-size: 14px (16px for large variant)
- Font-weight: 500 (Medium)
- Border-radius: 6px (8px for large variant)
- Padding: 8px 16px (12px 24px for large)
- Height: 36px (44px for large)
- Box-shadow: 0 2px 4px rgba(0,0,0,0.08)
- Border: none
- Cursor: pointer

Hover:
- Background: Gradient darkens 5% (use filter: brightness(0.95))
- Box-shadow: 0 4px 8px rgba(0,0,0,0.12)
- Transition: all 0.2s ease

Active (Pressed):
- Transform: translateY(1px)
- Background: Gradient darkens 10%
- Box-shadow: 0 1px 2px rgba(0,0,0,0.08)
- Opacity: 0.85
- Transition: all 0.1s ease

Disabled:
- Background: #E5E7EB (gray)
- Text color: #9CA3AF (light gray)
- Box-shadow: none
- Cursor: not-allowed
- Opacity: 0.6

【SECONDARY BUTTON】

Default State:
- Background: #FFFFFF
- Text color: #4F7FE8
- Border: 2px solid #4F7FE8
- Font-size: 14px (16px for large)
- Font-weight: 500 (Medium)
- Border-radius: 6px (8px for large)
- Padding: 6px 14px (10px 22px for large, -2px to account for border)
- Height: 36px (44px for large)
- Box-shadow: 0 2px 4px rgba(0,0,0,0.04)
- Cursor: pointer

Hover:
- Background: rgba(79, 127, 232, 0.05) (light blue tint)
- Border-color: #4973E0 (darker blue)
- Box-shadow: 0 4px 8px rgba(0,0,0,0.08)
- Transition: all 0.2s ease

Active:
- Background: rgba(79, 127, 232, 0.10)
- Border-color: #3D5FC8
- Transform: scale(0.98)
- Transition: all 0.1s ease

Disabled:
- Background: #FFFFFF
- Text color: #9CA3AF
- Border-color: #E5E7EB
- Cursor: not-allowed
- Opacity: 0.6

【SUCCESS BUTTON】

Default State:
- Background: Linear gradient 135deg, #10B981 0%, #059669 100%
- Text color: #FFFFFF
- Other specs: Same as Primary Button
- Use case: Confirm actions, mark as complete

Hover/Active/Disabled: Same patterns as Primary Button

【SIZE VARIANTS】

Small (sm):
- Height: 32px
- Font-size: 12px
- Padding: 6px 12px
- Border-radius: 6px

Default (base):
- Height: 36px
- Font-size: 14px
- Padding: 8px 16px
- Border-radius: 6px

Large (lg):
- Height: 44px
- Font-size: 16px
- Padding: 12px 24px
- Border-radius: 8px

【ICON BUTTONS】

Specs:
- Square or circle shape
- Size: 32px, 40px, or 48px
- Padding: 8px
- Icon size: 16px, 20px, or 24px (proportional)
- Icon centered (flex center)
- Background: Same as button variants
- Hover/Active: Same interactions

【BUTTON GROUPS】

Horizontal group:
- Gap: 8px between buttons
- Layout: Flex row, wrap
- Alignment: Center or space-between

Vertical group:
- Gap: 8px between buttons
- Layout: Flex column
- Full-width buttons

【ACCESSIBILITY】

- Focus state: 2px outline #4F7FE8, offset 2px
- Keyboard navigation: Tab order, Enter to activate
- Minimum touch target: 44px × 44px
- Sufficient contrast: WCAG AA (4.5:1)
```

---

## 📚 使用指南

### 如何在 Figma 中使用这些提示词

#### **方法 1: Figma AI插件（推荐）**

**适用插件**：
- **Diagram** (AI design generator)
- **Magician** (AI design assistant)
- **Automator** (AI workflow)

**操作步骤**：

1. **安装插件**
   ```
   Figma → Plugins → Browse Plugins → 搜索 "Diagram" 或 "Magician"
   → Install
   ```

2. **创建新文件**
   ```
   Figma → New Design File
   尺寸: iPhone 14 Pro (393 × 852px) 或 iPhone X (375 × 812px)
   ```

3. **运行AI插件**
   ```
   Plugins → Diagram / Magician → Text to Design
   ```

4. **复制完整提示词**
   - 方案A: 复制【完整设计系统规范】+ 某一页面提示词
   - 方案B: 复制某一组件提示词

5. **粘贴并生成**
   ```
   粘贴到插件输入框 → Generate / Create
   等待10-30秒 → AI自动生成设计
   ```

6. **调整和优化**
   ```
   检查生成结果 → 手动调整细节 → 应用Design Tokens
   ```

---

#### **方法 2: 手动设计（参考提示词）**

**步骤**：

1. **阅读完整设计系统规范**
   - 理解色彩系统
   - 记住间距规则（8pt Grid）
   - 了解阴影层级

2. **创建Design System**
   ```
   在 Figma 中创建:
   - Color Styles (所有颜色变量)
   - Text Styles (H1-Caption, 6个层级)
   - Effect Styles (4个阴影层级)
   ```

3. **创建组件库**
   ```
   根据【核心组件库提示词】创建:
   - Contrasting Color Card (4个变体)
   - AI Hint Floating Card (4个状态)
   - Button System (3个变体×3个尺寸)
   ```

4. **设计页面**
   ```
   参考页面提示词，逐个元素设计:
   - 创建Frame (375 × 812px)
   - 添加背景色 (#F8F9FB)
   - 按从上到下顺序布局
   - 应用组件和样式
   ```

---

#### **方法 3: 分模块生成**

**策略**: 逐个组件生成，再组合成页面

**步骤**：

1. **先生成组件**
   ```
   使用【核心组件库提示词】生成:
   → Contrasting Color Card × 1
   → AI Hint Floating Card × 1
   → Button System × 1
   → 其他组件...
   ```

2. **创建Component**
   ```
   Figma → 选中生成的元素 → Create Component
   创建变体 (Variants) 对应不同状态
   ```

3. **组装页面**
   ```
   新建Page Frame → 拖拽组件实例 → 按提示词布局
   ```

---

### 🎨 Design Tokens 应用

**在 Figma 中创建全局样式**：

#### **Color Styles**
```
创建 Local Styles:
- brand-500: #4F7FE8
- neutral-50: #F8F9FB
- text-primary: #0F172A
- accent-orange-light: #FED7AA
- accent-orange-dark: #DC2626
... (共30+个颜色)
```

#### **Text Styles**
```
创建 Text Styles:
- H1 / Bold / 32px / 40px line-height
- H2 / Semibold / 24px / 32px line-height
- H3 / Semibold / 16px / 22px line-height
- Body / Regular / 14px / 22px line-height
- Caption / Regular / 12px / 18px line-height
- Stat / Bold / 20px / 24px line-height
```

#### **Effect Styles (Shadows)**
```
创建 Effect Styles:
- shadow-xs: Drop shadow, 0 1 4 rgba(0,0,0,0.04)
- shadow-sm: Drop shadow, 0 2 6 rgba(0,0,0,0.08)
- shadow-md: Drop shadow, 0 3 8 rgba(0,0,0,0.08)
- shadow-lg: Drop shadow, 0 10 25 rgba(0,0,0,0.15)
```

---

### ⚡ 快速生成流程（推荐）

**最快方式**: 分3次生成

**第1次 - 生成设计系统**：
```
Prompt: 
【完整设计系统规范】section only
```
→ 创建 Color/Text/Effect Styles

**第2次 - 生成核心组件**：
```
Prompt:
【完整设计系统规范】+ 【核心组件库提示词】全部3个组件
```
→ 创建 Component Library

**第3次 - 生成所有页面**：
```
Prompt:
【完整设计系统规范】+ 【全部页面提示词】8个页面（分批，每次2-3个页面）
```
→ 完成所有页面设计

**总耗时**: 约30-60分钟（含手动调整）

---

### 📊 质量检查清单

生成后请检查：

```
[ ] 色彩系统
  [ ] 品牌蓝 #4F7FE8 应用正确
  [ ] 4组撞色配对正确
  [ ] 对比度达标 (≥4.5:1)

[ ] 间距系统
  [ ] 所有间距为8rpx倍数
  [ ] 页面边距 16px
  [ ] 卡片间距 8px

[ ] 字体系统
  [ ] 字号正确 (16/14/12px)
  [ ] 字重正确 (700/600/500/400)
  [ ] 行高正确 (1.25-1.6x)

[ ] 圆角系统
  [ ] 卡片圆角 8px
  [ ] 撞色角标 0 0 0 40px

[ ] 阴影系统
  [ ] 使用柔和阴影
  [ ] 透明度正确 (0.04-0.15)

[ ] 组件完整性
  [ ] 撞色卡片结构正确
  [ ] AI提示卡片3步渐进
  [ ] 按钮状态完整

[ ] 交互状态
  [ ] Hover状态
  [ ] Active状态
  [ ] Disabled状态
```

---

## ✅ 总结

### 📦 本文档包含：

- ✅ **1套完整设计系统规范** (色彩/字体/间距/阴影)
- ✅ **8个完整页面提示词** (home/study/vocabulary/practice/report/ai-assistant/profile/wrong-questions)
- ✅ **3个核心组件提示词** (撞色卡片/AI提示卡片/按钮系统)
- ✅ **3种使用方法** (AI插件/手动设计/分模块生成)
- ✅ **完整实施指南** (操作步骤/质量检查/最佳实践)

### 🎯 预期成果：

使用这些提示词，你可以在 **30-60分钟** 内生成一套完整的：
- ✅ 8个主要页面设计
- ✅ 13+个核心组件
- ✅ 完整的Design System
- ✅ 所有交互状态
- ✅ 符合WCAG AA标准

### 🚀 下一步：

1. 打开 Figma
2. 安装 Diagram 或 Magician 插件
3. 复制【完整设计系统规范】
4. 开始生成第一个页面（建议从 Study Page 撞色卡片开始）
5. 创建 Component Library
6. 生成剩余页面
7. 导出给开发团队

---

**📅 版本**: v1.0 Complete  
**🎨 状态**: ✅ 完整可用  
**💡 建议**: 先生成1-2个页面测试效果，满意后批量生成  
**⏱️ 预计耗时**: 30-60分钟（含调整）


