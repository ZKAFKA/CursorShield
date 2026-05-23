# 完善 Reports、Settings 功能 & 移除 Documentation/Help

## 涉及文件

| 文件                  | 操作                                                   |
| ------------------- | ---------------------------------------------------- |
| `Web/index.html`    | 修改 - 移除 Documentation/Help 导航、添加 Reports/Settings 面板 |
| `Web/js/app.js`     | 修改 - 添加 Reports 渲染逻辑、Settings 配置逻辑、Tab 切换增强          |
| `Web/css/style.css` | 修改 - 添加 Reports 图表样式、Settings 表单样式                   |

***

## 步骤 1：移除 Documentation 和 Help 导航项

**文件：`Web/index.html`**

删除 Sidebar 底部区域中的两条导航链接：

```html
<a ... onclick="switchTab('reports')"> ... <span>Documentation</span> </a>
<a ... onclick="switchTab('reports')"> ... <span>Help</span> </a>
```

仅保留用户头像区域和 System Operator 信息。

***

## 步骤 2：实现 Reports 面板

### 2.1 HTML 容器（index.html）

在 main 区域中，Dashboard 的 `<div id="dashboardContent">` 保持原样作为默认 Tab 内容。新增：

* `<div id="reportsContent" class="hidden">` — Reports 面板

* `<div id="settingsContent" class="hidden">` — Settings 面板

### 2.2 Reports 面板内部布局

```
Reports 面板
├── 标题行：Reports · Security Audit Summary
├── 第一行（双栏）
│   ├── 左：Risk Distribution Chart（仿饼图）
│   │   └── 用纯 CSS + JS 绘制的环形图，四种风险等级分布
│   └── 右：Top 5 Violators（最高风险员工排名列表）
│       └── 列表 + 风险分数 + 点击可跳转详情面板
├── 第二行（全宽）
│   └── Security Incidents Timeline（时间线）
│       └── 按时间排序的泄露事件流，每条显示：时间、员工、事件类型、严重等级
├── 第三行（三栏统计卡片）
│   ├── Total Incidents This Month
│   ├── Resolved Issues
│   └── Active Threats
└── Export 按钮：Export Full Report
```

### 2.3 JS 渲染逻辑（app.js）

新增函数：

* `renderReports()` — 主入口，生成 Reports 面板全部 HTML

* `renderRiskDonut(data)` — 环形风险分布图

* `renderTopViolators(data, limit)` — Top N 违规员工列表

* `renderIncidentTimeline(data)` — 事件时间线

* Dashboard 的无数据统计卡片也整合到 Reports 面板中

### 2.4 环形图实现方案（纯 CSS/JS）

用 SVG 或 CSS conic-gradient 绘制：

* Critical（红色）、High（黄色）、Medium（蓝色）、Low（绿色）四段弧线

* 中央显示总设备数

* 图例在右侧列出各等级数量

***

## 步骤 3：实现 Settings 面板

### 3.1 Settings 面板内部布局

```
Settings 面板
├── 标题行：Settings · Security Policy Configuration
├── Section 1：Allowed Email Domains
│   ├── 多行文本输入框 + Add 按钮
│   └── 已添加域名 tag chips（每个带 × 删除按钮）
│       └── 默认值：company.com
├── Section 2：Allowed Git Repositories
│   ├── 文本输入框 + Add 按钮（输入正则表达式）
│   └── 已添加仓库 tag chips
│       └── 默认值：github.com/company/.*, gitlab.internal/.*
├── Section 3：Blocked MCP Servers
│   ├── 文本输入框 + Add 按钮
│   └── 已添加 MCP tag chips
│       └── 默认值：Filesystem, OpenAI Proxy, Personal Assets CDN...
├── Section 4：Allowed Skills
│   ├── 文本输入框 + Add 按钮
│   └── 已添加 Skill tag chips
│       └── 默认值：所有当前授权的 skills
├── Section 5：Scan Configuration
│   ├── Toggle：Sensitive Info Scan（ON/OFF）
│   ├── Toggle：Auto Block on Leak（ON/OFF）
│   ├── Input：Max Scan Lines（数值输入）
│   └── Select：Polling Interval（下拉选择 10s/30s/60s/5min）
├── 底部操作栏
│   ├── Save Configuration 按钮（Primary）
│   └── Reset to Defaults 按钮（Secondary）
```

### 3.2 交互逻辑

* 点击 Add 按钮 → 将输入值加到 tag chips 列表，清空输入框

* 点击 tag chip 上的 × → 从列表中移除

* Save Configuration → 收集所有配置值存入 `SETTINGS_CONFIG` 对象，显示 toast 提示

* Reset to Defaults → 恢复默认值

### 3.3 Settings 数据模型

```js
var SETTINGS_CONFIG = {
  allowedEmailDomains: ["company.com"],
  allowedRepos: ["github.com/company/.*", "gitlab.internal/.*"],
  blockedMCPs: ["Filesystem", "Slack API", "AWS CLI", "Ansible", ...],
  allowedSkills: ["code-review", "deploy-pipeline", ...],
  scanEnabled: true,
  blockOnLeak: true,
  maxScanLines: 5000,
  pollingInterval: 30000
};
```

***

## 步骤 4：增强 switchTab 函数

```js
function switchTab(tab) {
  // 更新导航高亮
  // 隐藏所有 tab 内容面板 (dashboardContent, reportsContent, settingsContent)
  // 显示对应 tab 面板
  if (tab === "dashboard") { applyFilters(); renderStats(); }
  if (tab === "reports") { renderReports(); }
  if (tab === "settings") { renderSettings(); }
}
```

### 修改点

* [index.html](#L179-L248)：将现有 main 区域内容包裹在 `<div id="dashboardContent">` 中

* [index.html](#L179-L248)：新增 `<div id="reportsContent" class="hidden">` 和 `<div id="settingsContent" class="hidden">`

* [app.js](#L543-L554)：扩展 `switchTab()` 函数

***

## 步骤 5：CSS 样式补充

* Reports 环形图容器样式

* Settings 表单输入框 / tag chip / toggle switch 样式

* 响应式布局适配

***

## 实施顺序

1. 先修改 `index.html` — 结构层（移除导航 + 添加面板容器）
2. 再修改 `css/style.css` — 样式层
3. 最后修改 `js/app.js` — 逻辑层（Reports 渲染 + Settings 配置 + Tab 切换）
4. 验证：在浏览器中切换三个 Tab，确认 Reports 图表正常、Settings 交互正常

