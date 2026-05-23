# Cursor Shield — 企业级 Cursor 安全监控插件

> 一款针对企业使用 Cursor AI开发场景下的安全管理插件，通过客户端监控和管理台下发实现对员工AI使用的安全防护。覆盖账号监控、Git 审计、MCP/Skill 扫描和敏感信息检测四大核心能力。  

***

## 🚀 当前进展

### 已完成

- [x] ~~客户端监控功能搭建~~
- [x] ~~服务器 Web 端建设~~

### 生产自定义部分

- [ ] 可根据实际需要自行添加登录页面，修改部署方式或技术架构

***

## 📋 目录

- [核心能力](#-核心能力)
- [功能清单](#-功能清单)
- [安装](#-安装)
- [配置项](#-配置项)
- [内置检测规则](#-内置检测规则)
- [能力矩阵](#-能力矩阵)
- [技术架构](#-技术架构)
- [开发](#-开发)

***

## 🎯 核心能力

| 能力                 | 说明                                                  |
| ------------------ | --------------------------------------------------- |
| **账号监控**           | 读取 Cursor 登录邮箱，校验域名是否在企业白名单内                        |
| **Git 审计**         | 实时监控远程仓库变更、推送拦截、终端可疑命令检测                            |
| **MCP / Skill 扫描** | 自动发现并校验 `.cursor/mcp.json` 和 `.cursor/skills/` 中的扩展 |
| **敏感信息检测**         | 26 条内置规则 + 熵检测，覆盖编辑器实时标注、保存拦截、提交拦截                  |

***

## 🖼️界面展示
<img width="1640" height="1060" alt="屏幕截图 2026-05-23 183101" src="https://github.com/user-attachments/assets/1952a6b5-cbb6-4db1-b3e2-46ef42293f7d" />
<img width="2513" height="1200" alt="屏幕截图 2026-05-23 194428" src="https://github.com/user-attachments/assets/23a3f137-3e31-45e0-8087-765f973d812d" />
<img width="2519" height="1199" alt="屏幕截图 2026-05-23 194441" src="https://github.com/user-attachments/assets/127becc8-62b9-42bc-885b-41e0d6149c6e" />
<img width="2517" height="1195" alt="屏幕截图 2026-05-23 194455" src="https://github.com/user-attachments/assets/4becddf6-8c33-4b8a-bf3d-5bdac8bfb440" />
<img width="2508" height="1196" alt="屏幕截图 2026-05-23 194514" src="https://github.com/user-attachments/assets/64133418-67a1-4f57-8305-309e04114870" />
  
## 📝 功能清单

### 1. 账号监控

#### 账号合规检测

| 功能    | 说明                                           |
| ----- | -------------------------------------------- |
| 邮箱读取  | 从 Cursor `state.vscdb` 数据库读取登录邮箱             |
| 域名校验  | 提取邮箱域名，与 `allowedEmailDomains` 白名单比对         |
| 状态栏显示 | `✅ user@mycompany.com` 或 `⚠️ user@gmail.com` |
| 配置联动  | 白名单变更时自动重新校验                                 |
| 告警弹窗  | 不合规账号弹出 ErrorMessage                         |

#### 账号变动监测

通过 **30 秒轮询** + **双重检测机制**（邮箱变化 + 认证状态变化）实时监控账号变动

### 2. Git 远程仓库监控

#### 仓库合规检测（三层降级）

```
第 1 层：Git 扩展 API（vscode.git / cursor.git / built-in.git）
    ↓ 失败
第 2 层：工作区根目录 .git/ + git remote get-url origin
    ↓ 失败
第 3 层：工作区父目录 .git/ + git remote -v
```

#### 远程仓库实时监控

| 功能          | 检测方式                  | 触发时机                      | 告警行为        |
| ----------- | --------------------- | ------------------------- | ----------- |
| Origin 合规校验 | 三层降级获取 URL + 正则白名单    | 插件激活 + 延迟重试               | 状态栏红/绿色     |
| 新增远程仓库      | `git remote -v` 快照对比  | `.git/config` 变更 + 30s 轮询 | 弹窗告警        |
| 远程 URL 变更   | 同名 remote 的 URL diff  | 同上                        | 弹窗告警        |
| 远程仓库删除      | 快照中消失的 name           | 同上                        | 日志记录        |
| 推送前全远程校验    | 检查所有远程（非仅 origin）     | `checkBeforePush` 命令      | 模态弹窗阻断      |
| 推送阻断        | 与 `allowedRepos` 正则比对 | 同上                        | 返回 false 阻止 |

### 3. MCP / Skill 扫描

| 功能       | 说明                                                  |
| -------- | --------------------------------------------------- |
| MCP 检测   | 读取 `.cursor/mcp.json`，解析所有 `mcpServers`             |
| Skill 检测 | 遍历 `.cursor/skills/*/skill.json`，提取名称和描述            |
| 合规判断     | 与 `blockedMCPs` / `allowedSkills` 配置比对              |
| 文件监控     | `FileSystemWatcher` 监听 `mcp.json` 和 `skill.json` 变更 |
| 状态栏      | `✅ M:2 ✅ S:3` 或 `⚠️ M:2 ✅ S:3`                      |

### 4. 敏感信息检测

#### 检测卡点

| 卡点      | 触发时机                                | 行为            |
| ------- | ----------------------------------- | ------------- |
| 编辑器实时装饰 | `onDidChangeTextDocument`（500ms 防抖） | 红色波浪线 + 悬停卡片  |
| 文件保存拦截  | `onDidSaveTextDocument`             | critical 匹配弹窗 |
| 暂存前拦截   | `cursorSecurity.checkBeforeStage`   | 模态弹窗阻断        |
| 提交前拦截   | `cursorSecurity.checkBeforeCommit`  | 模态弹窗阻断        |
| 全量工作区扫描 | `cursorSecurity.scanNow` 命令         | 进度通知 + 结果统计   |

#### 检测引擎

- **正则匹配**：26 条内置规则 + 自定义 TOML 规则 + Gitleaks 规则
- **熵检测**：香农熵计算，默认阈值 4.5，仅对疑似 Base64/Hex 字符串触发
- **脱敏显示**：匹配内容显示为 `AKIA****PLE` 格式
- **排除规则**：自动跳过 `node_modules`、`.git`、`dist`、二进制文件等

***

## 📦 安装

### Step 1 部署监控端

```powershell
# 启动 Web 监控服务器
node Web/server.js

# 默认监听 http://localhost:3000
# 可通过环境变量设置认证 Token
$env:CURSORSHIELD_TOKEN = "your-secret-token"
node Web/server.js
```

> 首次启动会自动创建 `Web/data/` 目录用于持久化设备数据。无插件上报时，前端使用内置 Mock 数据展示。

### Step 2 安装插件

- 方式一：VSIX 安装

```powershell
# 打包
npx vsce package

# 在 Cursor / VS Code 中安装
# Ctrl+Shift+X → ... → Install from VSIX → 选择 cursor-shield-1.0.0.vsix
```

- 方式二：命令行安装

```powershell
cursor --install-extension cursor-shield-1.0.0.vsix
```

- 方式三：企业分发

通过 MDM / Group Policy 强制推送 `.vsix` 文件到终端设备。

### Step 3 配置插件上报

在 Cursor / VS Code 的 `settings.json` 中添加监控端连接配置：

```jsonc
{
    "cursorSecurity.reportServerUrl": "http://monitor.company.com:3000",
    "cursorSecurity.reportToken": "your-secret-token",
    "cursorSecurity.deviceName": "Employee-MacBook",
    "cursorSecurity.reportInterval": 30000
}
```

> `reportServerUrl` 为空时插件不会上报，不影响本地监控功能。

***

## ⚙️ 配置项

| 配置键                                  | 类型        | 默认值                             | 说明                                                      |
| ------------------------------------ | --------- | ------------------------------- | ------------------------------------------------------- |
| `cursorSecurity.enabled`             | boolean   | `true`                          | 启用或禁用安全监控                                               |
| `cursorSecurity.allowedEmailDomains` | string\[] | `[]`                            | 允许的邮箱域名列表，如 `["mycompany.com"]`                         |
| `cursorSecurity.allowedRepos`        | string\[] | `[]`                            | 允许的 Git 仓库地址正则列表，如 `["^https://github\\.com/myorg/.*"]` |
| `cursorSecurity.blockedMCPs`         | string\[] | `[]`                            | 禁用的 MCP 服务名称列表                                          |
| `cursorSecurity.allowedSkills`       | string\[] | `[]`                            | 允许的 Skill 名称列表，为空则允许所有                                  |
| `cursorSecurity.sensitiveRules`      | string    | `"built-in"`                    | 规则来源：`built-in` / `custom` / `both`                     |
| `cursorSecurity.customRulesPath`     | string    | `".cursor-security-rules.toml"` | 自定义敏感信息规则文件路径                                           |
| `cursorSecurity.heartbeatEndpoint`   | string    | `""`                            | 心跳上报端点 URL，为空则禁用                                        |
| `cursorSecurity.blockCommitOnLeak`   | boolean   | `true`                          | 检测到敏感信息时是否阻断提交                                          |
| `cursorSecurity.blockPushOnLeak`     | boolean   | `true`                          | 检测到未授权仓库时是否阻断推送                                         |
| `cursorSecurity.maxScanLines`        | number    | `5000`                          | 单文件最大扫描行数                                               |
| `cursorSecurity.entropyThreshold`    | number    | `4.5`                           | 高熵字符串检测阈值                                               |
| `cursorSecurity.autoRecoverEnabled`  | boolean   | `true`                          | 是否允许自动恢复安全配置                                            |

### 快速配置示例

```jsonc
{
    "cursorSecurity.enabled": true,
    "cursorSecurity.allowedEmailDomains": ["mycompany.com", "mycompany.cn"],
    "cursorSecurity.allowedRepos": [
        "^https://github\\.com/myorg/.*",
        "^git@github\\.com:myorg/.*"
    ],
    "cursorSecurity.blockedMCPs": ["untrusted-mcp"],
    "cursorSecurity.sensitiveRules": "both",
    "cursorSecurity.blockCommitOnLeak": true,
    "cursorSecurity.heartbeatEndpoint": "https://security.internal/heartbeat"
}
```

***

## 🔍 内置检测规则

| 类别     | 规则                    | 模式                                            |
| ------ | --------------------- | --------------------------------------------- |
| AWS    | Access Key ID         | `AKIA[0-9A-Z]{16}`                            |
| AWS    | Secret Access Key     | 40 字符 Base64                                  |
| GitHub | Personal Access Token | `ghp_[0-9a-zA-Z]{36}`                         |
| GitHub | OAuth Access Token    | `gho_[0-9a-zA-Z]{36}`                         |
| GitHub | App Token             | `ghu_[0-9a-zA-Z]{36}`                         |
| GitLab | Personal Access Token | `glpat-[0-9a-zA-Z\-]{20,}`                    |
| GitLab | Runner Token          | `GR1348941[0-9a-zA-Z\-]{20,}`                 |
| Slack  | Bot Token             | `xoxb-[0-9a-zA-Z\-]{10,}`                     |
| Slack  | User Token            | `xoxp-[0-9a-zA-Z\-]{10,}`                     |
| Slack  | App Token             | `xapp-[0-9a-zA-Z\-]{10,}`                     |
| Slack  | Webhook URL           | `https://hooks.slack.com/services/...`        |
| 私钥     | RSA Private Key       | `-----BEGIN RSA PRIVATE KEY-----`             |
| 私钥     | DSA Private Key       | `-----BEGIN DSA PRIVATE KEY-----`             |
| 私钥     | EC Private Key        | `-----BEGIN EC PRIVATE KEY-----`              |
| 私钥     | OpenSSH Private Key   | `-----BEGIN OPENSSH PRIVATE KEY-----`         |
| 私钥     | PGP Private Key       | `-----BEGIN PGP PRIVATE KEY BLOCK-----`       |
| 数据库    | JDBC Connection       | `jdbc:[db]://user:pass@host`                  |
| 数据库    | MongoDB Connection    | `mongodb://user:pass@host`                    |
| 数据库    | MySQL Connection      | `mysql://user:pass@host`                      |
| 数据库    | PostgreSQL Connection | `postgresql://user:pass@host`                 |
| 第三方    | Heroku API Key        | UUID 格式                                       |
| 第三方    | Stripe API Key        | `sk_live_` / `rk_live_` 前缀                    |
| 第三方    | Google API Key        | `AIza[0-9A-Za-z\-_]{35}`                      |
| 第三方    | Azure Storage Key     | `DefaultEndpointsProtocol=...;AccountKey=...` |
| 通用     | API Key Pattern       | `api_key = "..."` / `secret = "..."`          |
| 通用     | JWT Token             | `eyJ...` 三段式                                  |

### 自定义规则

在项目根目录创建 `.cursor-security-rules.toml`：

```toml
[[rules]]
id = "custom-openai-api-key"
description = "OpenAI API Key"
regex = "sk-[A-Za-z0-9]{32,}"
severity = "critical"

[[rules]]
id = "custom-jwt-token"
description = "JWT Token"
regex = "eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}"
severity = "medium"
```

### 白名单

在项目根目录创建 `.secrets.baseline` 排除已知安全匹配：

```json
{
    "results": {
        "known-safe-key": {
            "hashed_secret": "sha256:..."
        }
    }
}
```

***

## 🏗️ 技术架构

```
src/
├── extension.ts              # 主入口，编排所有模块
├── monitors/
│   ├── account.ts            # 账号监控（state.vscdb 读取）
│   ├── gitRemote.ts          # Git 远程仓库监控（三层降级 + 实时变更检测）
│   ├── mcpSkill.ts           # MCP / Skill 扫描
│   └── terminalMonitor.ts    # 终端命令监控
├── detection/
│   ├── rules.ts              # 26 条内置规则 + 自定义规则加载
│   ├── entropy.ts            # 香农熵检测
│   ├── engine.ts             # 扫描引擎（正则 + 熵综合）
│   ├── decorator.ts          # 编辑器实时装饰器
│   └── preCommit.ts          # 保存/暂存/提交拦截
├── dashboard/
│   └── webview.ts            # 侧边栏仪表盘
├── reporting/
│   └── reporter.ts           # 数据上报（HTTP POST → 监控端）
├── protection/
│   ├── antiTamper.ts         # 4 层自保护
│   └── heartbeat.ts          # 心跳上报
├── utils/
│   ├── logger.ts             # 日志模块（分级/轮转/导出）
│   └── dbReader.ts           # SQLite 读取 state.vscdb
└── types/
    └── sql.js.d.ts           # sql.js 类型声明
```

### 技术栈

- **语言**：TypeScript（strict 模式）
- **运行时**：VS Code Extension Host
- **数据库**：sql.js（WASM，只读模式读取 Cursor state.vscdb）
- **UI**：原生 HTML/CSS/JS Webview（零框架依赖，自动适配暗/亮主题）
- **日志**：本地文件 `~/.cursor-shield/logs/`，30 天自动轮转

***

## 🔧 开发

### 环境要求

- Node.js >= 18
- VS Code / Cursor >= 1.85.0

### 构建

```powershell
# 安装依赖
npm install

# 编译
npm run compile

# 监听模式
npm run watch

# 类型检查
npm run lint

# 打包
npm run package
```

### 调试

1. 在项目根目录创建 `.vscode/launch.json`：

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Run Cursor Shield",
            "type": "extensionHost",
            "request": "launch",
            "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
            "outFiles": ["${workspaceFolder}/out/**/*.js"]
        }
    ]
}
```

1. 按 `F5` 启动 Extension Development Host 窗口
2. 在新窗口中测试插件功能

### 日志查看

```
# 输出面板
Ctrl+Shift+U → 选择 "Cursor Shield" 频道

# 本地日志文件
cat ~/.cursor-shield/logs/cursor-shield-$(date +%Y-%m-%d).log
```

***

## 📄 联系邮箱

<zkafka0609@163.com>
