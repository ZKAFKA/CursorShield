# Cursor Shield - 企业级 Cursor 安全监控插件实施计划

## 概述

基于 `项目方案.md`，开发一款不可绕过的企业级 Cursor 安全监控插件（VS Code Extension），覆盖账号监控、Git 审计、MCP/Skill 扫描、敏感信息检测和防绕过机制五大核心能力。

***

## 第一步：项目脚手架搭建

### 1.1 初始化项目

* 创建 `package.json`（VS Code 扩展清单），包含：

  * `activationEvents`: `["*"]`（启动即激活）

  * `main`: `./out/extension.js`

  * `contributes.configuration`: 所有配置项（见方案第 6 节）

  * `contributes.viewsContainers` + `contributes.views`: 侧边栏仪表盘

  * 依赖：`sql.js`（SQLite 读取）、`minimatch` 等

* 创建 `tsconfig.json`

* 创建 `.vscodeignore`

* 安装依赖：`npm install`

### 1.2 目录结构创建

按方案第 7 节创建完整目录：

```
src/
├── extension.ts
├── monitors/
│   ├── account.ts
│   ├── gitRemote.ts
│   └── mcpSkill.ts
├── detection/
│   ├── engine.ts
│   ├── rules.ts
│   ├── entropy.ts
│   ├── decorator.ts
│   └── preCommit.ts
├── dashboard/
│   └── webview.ts
├── protection/
│   ├── antiTamper.ts
│   └── heartbeat.ts
├── utils/
│   ├── dbReader.ts
│   └── logger.ts
└── test/
```

***

## 第二步：核心工具模块

### 2.1 日志模块 (`utils/logger.ts`)

* 实现本地日志记录（输出到 `~/.cursor-shield/logs/`）

* 日志级别：INFO、WARN、ERROR

* 日志格式：`[时间戳] [级别] [模块] 消息`

* 日志轮转（保留最近 30 天）

### 2.2 数据库读取模块 (`utils/dbReader.ts`)

* 使用 `sql.js` 读取 Cursor 的 `state.vscdb`（SQLite）

* 跨平台路径解析：

  * Windows: `%APPDATA%\Cursor\User\globalStorage\state.vscdb`

  * macOS: `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb`

  * Linux: `~/.config/Cursor/User/globalStorage/state.vscdb`

* 查询 `cursorAuth/cachedEmail` 获取登录邮箱

* 只读模式，绝不修改数据库

### 2.3 配置管理（在 `extension.ts` 中统一管理）

* 读取所有 `cursorSecurity.*` 配置项

* 提供配置变更监听

* 配置校验（无效值时告警）

* 提供默认配置

***

## 第三步：监控模块

### 3.1 账号监控 (`monitors/account.ts`)

* 启动时读取 `state.vscdb` 中的 `cursorAuth/cachedEmail`

* 从配置 `cursorSecurity.allowedEmailDomains` 获取允许的域名列表

* 比对逻辑：提取邮箱域名，检查是否在允许列表中

* 返回结果对象：`{ email, domain, isCompliant }`

* 状态栏显示：`✅ user@mycompany.com` 或 `⚠️ user@gmail.com`

* 定期刷新（监听配置变更）

### 3.2 Git 仓库监控 (`monitors/gitRemote.ts`)

* 通过 `vscode.extensions.getExtension('vscode.git')?.exports.getAPI(1)` 获取 Git API

* 获取 `origin` 远程 `fetchUrl`

* 与 `cursorSecurity.allowedRepos`（正则列表）比对

* 监听仓库切换事件 `repository.state.onDidChange`

* 状态栏显示：`origin: github.com/myorg/project` 及合规状态

* **拦截** **`git.push`** **命令**：推送前校验目标远程地址是否合规

* 不合规时弹出警告并阻断操作

### 3.3 MCP / Skill 扫描 (`monitors/mcpSkill.ts`)

* **MCP 检测**：

  * 读取 `.cursor/mcp.json`，解析 `mcpServers` 字段

  * 列出每个 server 的 name、command、env（脱敏）

  * 与 `cursorSecurity.blockedMCPs` 比对

* **Skill 检测**：

  * 遍历 `.cursor/skills/` 子目录

  * 读取每个子目录的 `skill.json` 获取名称和描述

  * 与 `cursorSecurity.allowedSkills` 比对

* 返回列表，标记授权状态

* 状态栏显示统计：`MCP:2 Skills:3`

* 仪表盘展示详细列表（授权/未授权标色）

* 发现未授权项时弹窗提示

***

## 第四步：敏感信息检测引擎

### 4.1 规则库 (`detection/rules.ts`)

内置规则（按方案 3.5.2）：

| 类别                    | 正则表达式                                                 |
| --------------------- | ----------------------------------------------------- |
| AWS Access Key        | `AKIA[0-9A-Z]{16}`                                    |
| GitHub Personal Token | `ghp_[0-9a-zA-Z]{36}`                                 |
| GitLab Token          | `glpat-[0-9a-zA-Z\-]{20,}`                            |
| Slack Token           | `xox[baprs]-[0-9a-zA-Z\-]{10,}`                       |
| 私钥                    | `-----BEGIN (RSA\|DSA\|EC\|OPENSSH) PRIVATE KEY-----` |
| 数据库连接串                | `(jdbc\|mongodb\|mysql\|postgresql)://[^:]+:[^@]+@`   |
| 通用高熵字符串               | `[A-Za-z0-9+/]{40,}`                                  |

* 支持从 `.gitleaks.toml` 导入规则

* 支持从 `.cursor-security-rules.toml` 加载自定义规则

* 支持 `.secrets.baseline` 白名单

### 4.2 熵检测 (`detection/entropy.ts`)

* 实现香农熵计算

* 对长度 >= 20 的字符串计算熵值

* 默认阈值 4.5（可配置）

* 仅对疑似 Base64 / Hex 字符串计算（减少误报）

* 对大文件限制扫描行数（默认 5000 行）

### 4.3 扫描引擎 (`detection/engine.ts`)

* 综合正则匹配 + 熵检测

* 输入：文本内容 + 文件名

* 输出：`{ file, line, column, match, rule, severity }[]`

* 支持全量扫描和增量扫描

* 脱敏显示匹配内容（前 4 字符 + `****`）

### 4.4 编辑器装饰器 (`detection/decorator.ts`)

* 监听 `onDidChangeTextDocument`

* 对变更内容进行实时扫描

* 在疑似密钥行添加红色波浪下划线装饰

* 鼠标悬停显示匹配规则和脱敏内容

### 4.5 Git 拦截 (`detection/preCommit.ts`)

* **文件保存拦截**：监听 `onDidSaveTextDocument`，保存时扫描文件内容

* **暂存区拦截**：拦截 `git.stage` / `git.add` 命令，扫描即将暂存的文件

* **提交前拦截**：拦截 `git.commit` 命令，获取暂存区变更，逐文件扫描新增行

* 发现匹配项 → 弹出错误框，显示文件路径、行号、匹配类型（脱敏）

* 阻断操作直到问题清除

* 记录审计日志

### 4.6 剪贴板监控

* 监听 `vscode.env.clipboard.onDidWriteText`

* 对剪贴板内容进行敏感信息扫描

* 发现疑似密钥时弹出警告

* 可配置是否阻断复制操作

***

## 第五步：仪表盘与 UI

### 5.1 状态栏 (`extension.ts` 中集成)

* 优先级最高，始终显示

* 格式：`🛡️ user@company.com | origin: github.com/myorg/project | MCP:2 Skills:3 | Leaks:0`

* 各模块状态聚合更新

* 点击状态栏打开仪表盘

### 5.2 侧边栏仪表盘 (`dashboard/webview.ts`)

* 使用 Webview 实现

* 布局包含：

  * **账号信息卡片**：邮箱、域名合规状态（✅/⚠️）

  * **Git 信息卡片**：远程地址、合规状态

  * **MCP / Skill 列表**：名称、类型、授权状态、详情

  * **扫描结果**：最近发现泄漏数、上次扫描时间

  * **防护状态**：插件运行状态、心跳状态

  * **操作按钮**：立即扫描、导出日志、查看历史

* 数据通过 `postMessage` 在主进程与 Webview 间传递

* 使用纯 HTML/CSS/JS 实现（无框架依赖）

***

## 第六步：防绕过机制

### 6.1 禁用监控 (`protection/antiTamper.ts`)

* 监听 `vscode.extensions.onDidChange`

* 当自身扩展状态变为 `disabled` 时：

  * 弹出严重警告对话框

  * 记录告警日志

  * 尝试通过命令行重新启用（需管理员权限）

  * 触发心跳告警

### 6.2 卸载监控 (`protection/antiTamper.ts`)

* 使用 `fs.watch` 监控自身扩展根目录

* 检测核心文件被删除或替换时触发紧急告警

* 弹出不可关闭的警告（需管理员确认）

### 6.3 配置防篡改 (`protection/antiTamper.ts`)

* 监听 `vscode.workspace.onDidChangeConfiguration`

* 检测关键配置项变更

* 若 `cursorSecurity.enabled` 被设为 `false`，立即恢复为 `true`

* 若允许域名 / 仓库列表被清空，恢复上次可信配置

* 记录篡改尝试日志

### 6.4 心跳机制 (`protection/heartbeat.ts`)

* 每隔 5 分钟向 `cursorSecurity.heartbeatEndpoint` 发送心跳

* 心跳内容：扩展状态、账号、仓库、扫描统计

* 服务端未收到心跳可发出告警

* 心跳功能可配置关闭（默认关闭，保护隐私）

***

## 第七步：扩展入口整合

### 7.1 `extension.ts` 主入口

* `activate` 函数：

  1. 初始化日志模块
  2. 加载配置
  3. 启动账号监控
  4. 启动 Git 仓库监控（含推送拦截）
  5. 启动 MCP / Skill 扫描
  6. 初始化敏感信息检测引擎（装饰器 + 保存拦截 + Git 拦截）
  7. 初始化剪贴板监控
  8. 初始化防绕过机制
  9. 初始化心跳（如果配置启用）
  10. 注册状态栏
  11. 注册侧边栏仪表盘
  12. 注册所有命令（扫描、导出日志等）

* `deactivate` 函数：清理资源

### 7.2 命令注册

* `cursorSecurity.scanNow`：立即执行全量扫描

* `cursorSecurity.exportLogs`：导出审计日志

* `cursorSecurity.showDashboard`：打开仪表盘

* `cursorSecurity.showHistory`：查看扫描历史

* `cursorSecurity.reloadConfig`：重新加载配置

***

## 第八步：打包与部署配置

### 8.1 构建配置

* `package.json` 添加 `scripts`：

  * `vscode:prepublish`：`npm run compile`

  * `compile`：`tsc -p ./`

  * `watch`：`tsc -watch -p ./`

  * `package`：`npx vsce package`

* `.vscodeignore` 排除源码、`node_modules` 的 `devDependencies` 等

### 8.2 生成默认规则文件

* `.cursor-security-rules.toml`：默认自定义规则示例

* `.cursor-security-policy.json`：管理员可一键导入的策略模板

***

## 实施顺序

按依赖关系，建议按以下顺序实施：

1. **步骤一**：项目脚手架搭建（`package.json`、`tsconfig.json`、目录结构）
2. **步骤二**：核心工具模块（`logger.ts`、`dbReader.ts`）
3. **步骤三**：监控模块（`account.ts`、`gitRemote.ts`、`mcpSkill.ts`）
4. **步骤四**：检测引擎（`rules.ts` → `entropy.ts` → `engine.ts` → `decorator.ts` → `preCommit.ts`）
5. **步骤五**：仪表盘 UI（`webview.ts`）
6. **步骤六**：防绕过机制（`antiTamper.ts`、`heartbeat.ts`）
7. **步骤七**：扩展入口整合（`extension.ts`）
8. **步骤八**：打包配置与默认文件

***

## 技术约束

* 纯 TypeScript，无前端框架依赖（Webview 使用原生 HTML/CSS/JS）

* SQLite 读取使用 `sql.js`（WASM 版，无需原生依赖）

* 日志不通过网络传输（隐私优先）

* 所有文件操作均为异步

* 遵循 VS Code 扩展 API 最佳实践

* 最小性能影响：扫描限流、大文件行数限制

