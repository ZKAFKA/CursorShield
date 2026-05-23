# Cursor 安全插件与 Web 监控端联动方案

## 架构概览

```
┌──────────────────────────┐       HTTP POST (JSON)        ┌───────────────────────────┐
│  Cursor Plugin (客户端)   │ ──────────────────────────────▶ │  Web Server (监控端)       │
│                          │   /api/report  (每30s/事件)    │                           │
│  ┌────────────────────┐ │                                │  ┌──────────────────────┐ │
│  │ src/reporting/     │ │  ◀── 共享密钥 Token 认证 ──▶    │  │ Web/server.js        │ │
│  │ reporter.ts (新增) │ │                                │  │ (升级为 Express)     │ │
│  └────────────────────┘ │                                │  │ + in-memory store    │ │
│                          │       GET /api/devices         │  │ + file persistence   │ │
│  ┌────────────────────┐ │ ◀────────────────────────────── │  └──────────────────────┘ │
│  │ extension.ts       │ │       返回全部设备状况            │                           │
│  │ (注册Reporter)     │ │                                │  ┌──────────────────────┐ │
│  └────────────────────┘ │                                │  │ Web/index.html       │ │
│                          │                                │  │ (fetch /api/devices) │ │
│  ┌────────────────────┐ │                                │  └──────────────────────┘ │
│  │ VS Code Settings   │ │                                │                           │
│  │ cursorSecurity     │ │                                │                           │
│  │   .reportServerUrl │ │                                │                           │
│  │   .reportToken     │ │                                │                           │
│  │   .deviceName      │ │                                │                           │
│  └────────────────────┘ │                                │                           │
└──────────────────────────┘                                └───────────────────────────┘
```

## 设计原则

| 原则 | 说明 |
|------|------|
| **简易** | 插件端仅新增 1 个文件 ~80 行；服务端升级 server.js ~100 行；前端小改 data.js ~20 行 |
| **安全** | Token 认证 + 数据脱敏 + 仅传输摘要（不含原始密钥内容） |
| **低侵入** | 不修改现有 monitor/detection 逻辑，只读取已收集的状态 |
| **幂等上报** | 同一设备多次上报覆盖同一条记录，不会重复 |
| **容错** | 网络不通时静默跳过，不影响插件核心功能 |

---

## 步骤 1：升级 Web/server.js 为 Express API 服务器

**文件：`Web/server.js`**（重写）

### 功能
- 静态文件服务（保持现有 index.html/css/js 可用）
- `POST /api/report` — 接收插件上报的设备数据
- `GET /api/devices` — 返回全部已上报设备列表
- `GET /api/stats` — 返回聚合统计摘要

### 实现要点
- 使用 Node.js 内置 `http` 模块（零外部依赖），不引入 Express
- 内存中维护 `allDevices: Map<deviceId, DeviceReport>`
- 启动时从 `Web/data/devices.json` 加载已有数据
- 每收到一次上报，自动保存到 JSON 文件（持久化）
- Token 认证：比较请求头 `Authorization: Bearer <token>` 与预设 Token

### 数据模型

```js
// 服务端存储的数据结构
{
  deviceId: "MAC-8892-Z",
  deviceName: "Marcus-MacBook-Pro",
  os: "macOS 14.5",
  employeeName: "Marcus Holloway",
  lastSync: 1700000000000,

  account: {
    email: "m.holloway@personal.me",
    domain: "personal.me",
    isCompliant: false,
    reason: "...",
    checked: true,
    changedFrom: "m.holloway@company.com",
    changeType: "switch"
  },

  git: {
    repoPath: "/Users/marcus/projects/main-engine",
    originUrl: "https://github.com/personal/main-engine.git",
    isCompliant: false,
    reason: "...",
    checked: true,
    remotes: [
      { name: "origin", url: "...", isCompliant: false },
      { name: "upstream", url: "...", isCompliant: true }
    ]
  },

  mcpSkill: {
    mcpCount: 6,
    skillCount: 4,
    unauthorizedMCPs: 2,
    unauthorizedSkills: 1,
    checked: true,
    mcps: [
      { name: "PostgreSQL", command: "npx", args: [...], envKeys: [...], isBlocked: false, isAuthorized: true }
    ],
    skills: [
      { name: "code-review", description: "...", path: "...", isAuthorized: true }
    ]
  },

  sensitiveInfo: {
    totalLeaks: 3,
    criticalLeaks: 1,
    highLeaks: 2,
    mediumLeaks: 0,
    detections: [
      { type: "AWS_SECRET_ACCESS_KEY", severity: "critical", file: "config.yaml", line: 42, masked: "AKIA****ABCD", timestamp: 1700000000, status: "active" }
    ]
  },

  riskScore: 42
}
```

### 静态文件服务
保持现有逻辑，对 `/`、`/index.html`、`/js/*`、`/css/*` 请求返回对应文件。

---

## 步骤 2：插件端新增 Reporter 模块

**文件：`src/reporting/reporter.ts`**（新建）

### 功能
1. 从 VS Code 配置读取 `reportServerUrl`、`reportToken`、`deviceName`
2. 收集 `AccountStatus`、`GitRepoStatus` (含 remotes 详情)、`MCPSkillStatus`、`ScanSummary`
3. 拼装为上报数据对象
4. 通过 `fetch()` (Node.js 18+ 内置) POST 到服务器，携带 `Authorization: Bearer <token>` 头
5. 错误时静默处理，不抛出异常
6. 定时上报：每 30 秒（可配置 `reportInterval`）

### VS Code 配置项 (package.json contributes.configuration)

```json
{
  "cursorSecurity.reportServerUrl": {
    "type": "string",
    "default": "",
    "description": "监控端服务器地址，如 http://monitor.company.com:3000"
  },
  "cursorSecurity.reportToken": {
    "type": "string",
    "default": "",
    "description": "上报认证 Token"
  },
  "cursorSecurity.deviceName": {
    "type": "string",
    "default": "",
    "description": "设备显示名称（留空则用 hostname）"
  },
  "cursorSecurity.reportInterval": {
    "type": "number",
    "default": 30000,
    "description": "上报间隔（毫秒），默认 30000"
  }
}
```

### 关键逻辑

```ts
// reporter.ts 核心流程
export function startReporting(context: vscode.ExtensionContext): vscode.Disposable {
  const config = vscode.workspace.getConfiguration('cursorSecurity');
  const serverUrl = config.get<string>('reportServerUrl', '');
  const token = config.get<string>('reportToken', '');

  if (!serverUrl) return { dispose() {} }; // 未配置则跳过

  const timer = setInterval(async () => {
    try {
      const data = collectDeviceReport(config);
      await fetch(`${serverUrl}/api/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
    } catch (err) {
      // 静默忽略网络错误
    }
  }, config.get<number>('reportInterval', 30000));

  return { dispose: () => clearInterval(timer) };
}

function collectDeviceReport(config): DeviceReport {
  // 现有数据已经在各 monitor 中实时维护
  // 直接调用 getAccountStatus() / getGitStatus() / getMCPSkillStatus()
  // 从 detection/engine 获取 scanSummary
  // 计算 riskScore
  // 返回 DeviceReport 对象
}
```

### 数据脱敏
- `masked` 字段已经脱敏（`AKIA****ABCD`），直接传输
- 敏感文件路径仅传相对路径或无路径（或保留完整路径，由管理员决策，因为路径本身也是审计线索）
- **绝不传输原始密钥明文**

---

## 步骤 3：插件端注册 Reporter

**文件：`src/extension.ts`**（小改）

在 `registerCommands(context)` 之前新增：

```ts
import { startReporting } from './reporting/reporter';

// ...

const reporterDisposable = startReporting(context);
allDisposables.push(reporterDisposable);
context.subscriptions.push(reporterDisposable);
logger.info(MODULE, 'Reporter registered');
```

---

## 步骤 4：Web 前端接入实时数据

**文件：`Web/js/data.js`**（小改）

新增初始化函数，启动时从 `/api/devices` 拉取数据：

```js
var MOCK_EMPLOYEES = [];  // 先置空，后续从 API 填充

async function fetchDevices() {
  try {
    var res = await fetch('/api/devices');
    if (res.ok) {
      var devices = await res.json();
      if (devices.length > 0) {
        MOCK_EMPLOYEES = devices;  // 替换为真实数据
      }
    }
  } catch(e) {}
  // 如果 API 无数据或请求失败，保持 MOCK_EMPLOYEES 不变（回退到内置 Mock）
}
```

**文件：`Web/js/app.js`**（小改）

在 `init()` 中先 `await fetchDevices()` 再渲染：

```js
async function init() {
  await fetchDevices();
  filteredData = MOCK_EMPLOYEES.slice();
  applyFilters();
  renderStats();
  updateAlertDot();
}
```

---

## 步骤 5：package.json 配置

**文件：`package.json`**

在 `contributes.configuration.properties` 中新增：

```json
"cursorSecurity.reportServerUrl": {
  "type": "string",
  "default": "",
  "description": "监控端服务器地址，如 http://monitor.company.com:3000"
},
"cursorSecurity.reportToken": {
  "type": "string",
  "default": "",
  "description": "上报认证 Token"
},
"cursorSecurity.deviceName": {
  "type": "string",
  "default": "",
  "description": "设备显示名称（留空则用 OS hostname）"
},
"cursorSecurity.reportInterval": {
  "type": "number",
  "default": 30000,
  "minimum": 5000,
  "maximum": 300000,
  "description": "上报间隔（毫秒）"
}
```

---

## 安全措施清单

| 措施 | 实现 |
|------|------|
| **传输加密** | 生产环境建议在 server.js 前挂 Nginx 反向代理 + SSL |
| **Token 认证** | `Authorization: Bearer <token>` 头校验 |
| **数据脱敏** | `masked` 字段仅为 `AKIA****ABCD` 形式 |
| **输入校验** | 服务端校验 POST body 合法性，拒绝超大 payload |
| **CORS** | 仅允许白名单域名（或仅允许 fetch 跨域） |
| **不存原始密钥** | 只存脱敏片段，完整密钥绝不出插件端 |
| **日志不上报敏感字段** | 服务端日志仅记录 deviceId + 上报时间 |

---

## 实施顺序

1. **升级 `Web/server.js`** — 添加 `/api/report`、`/api/devices`、`/api/stats` 路由
2. **新建 `src/reporting/reporter.ts`** — 数据收集 + HTTP 上报
3. **修改 `src/extension.ts`** — 注册 Reporter
4. **修改 `package.json`** — 添加配置项
5. **修改 `Web/js/data.js`** — 添加 `fetchDevices()` 
6. **修改 `Web/js/app.js`** — init 中调用 `fetchDevices()`
7. **测试** — 启动 server.js → 配置插件 settings → 验证数据上报和前端展示