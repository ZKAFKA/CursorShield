"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTerminalLogs = getTerminalLogs;
exports.registerTerminalMonitor = registerTerminalMonitor;
const vscode = __importStar(require("vscode"));
const logger = __importStar(require("../utils/logger"));
const MODULE = 'TerminalMonitor';
const DANGEROUS_GIT_COMMANDS = [
    { pattern: /git\s+push\s+(?!origin\b)\S+/i, description: '推送到非 origin 远程仓库' },
    { pattern: /git\s+push\s+--all/i, description: '推送所有分支到所有远程' },
    { pattern: /git\s+push\s+--mirror/i, description: '镜像推送（含所有远程）' },
    { pattern: /git\s+remote\s+add\s+/i, description: '添加新的远程仓库' },
    { pattern: /git\s+remote\s+set-url\s+/i, description: '修改远程仓库地址' },
    { pattern: /git\s+remote\s+rm\s+/i, description: '删除远程仓库配置' },
    { pattern: /git\s+config\s+--global/i, description: '修改全局 Git 配置' },
    { pattern: /git\s+credential/i, description: '操作 Git 凭证' },
];
const SENSITIVE_PATTERNS = [
    { pattern: /export\s+\w*(key|token|secret|password|credential)\w*=/i, description: '在终端设置敏感环境变量' },
    { pattern: /curl\s+.*-H\s+.*["']Authorization[:\s]/i, description: 'curl 请求中包含 Authorization 头' },
    { pattern: /ssh-keygen/i, description: '生成 SSH 密钥' },
    { pattern: /aws\s+\w+\s+.*--secret/i, description: 'AWS CLI 使用密钥参数' },
];
const terminalLogs = [];
const MAX_LOG_ENTRIES = 500;
let terminalDataBuffer = new Map();
function analyzeTerminalData(terminalId, data, terminalName) {
    let buffer = terminalDataBuffer.get(terminalId) || '';
    buffer += data;
    terminalDataBuffer.set(terminalId, buffer);
    const lines = buffer.split('\n');
    if (lines.length > 1) {
        for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i].trim();
            if (line) {
                checkCommand(line, terminalName);
            }
        }
        terminalDataBuffer.set(terminalId, lines[lines.length - 1]);
    }
    if (buffer.length > 10000) {
        terminalDataBuffer.set(terminalId, buffer.slice(-5000));
    }
}
function checkCommand(line, terminalName) {
    const allPatterns = [...DANGEROUS_GIT_COMMANDS, ...SENSITIVE_PATTERNS];
    for (const { pattern, description } of allPatterns) {
        if (pattern.test(line)) {
            const entry = {
                timestamp: new Date().toISOString(),
                terminalName,
                command: line.substring(0, 200),
                warning: description
            };
            terminalLogs.push(entry);
            if (terminalLogs.length > MAX_LOG_ENTRIES) {
                terminalLogs.shift();
            }
            logger.warn(MODULE, `Suspicious command in terminal "${terminalName}": ${description} | ${line.substring(0, 100)}`);
            vscode.window.showWarningMessage(`[Cursor Shield] 检测到可疑终端命令：${description}`, '查看详情', '我知道了').then(choice => {
                if (choice === '查看详情') {
                    showTerminalWarningDetail(entry);
                }
            });
            break;
        }
    }
}
function showTerminalWarningDetail(entry) {
    const panel = vscode.window.createWebviewPanel('cursorShieldTerminalWarning', 'Cursor Shield - 终端告警', vscode.ViewColumn.One, { enableScripts: false });
    panel.webview.html = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground);
         background: var(--vscode-editor-background); padding: 20px; }
  .card { background: var(--vscode-textCodeBlock-background); padding: 16px;
          border-radius: 8px; margin-bottom: 16px; border-left: 4px solid var(--vscode-errorForeground); }
  h2 { color: var(--vscode-errorForeground); }
  .label { color: var(--vscode-descriptionForeground); font-size: 12px; }
  .value { font-family: var(--vscode-editor-font-family); font-size: 13px; margin-top: 4px; }
  pre { background: var(--vscode-textCodeBlock-background); padding: 12px; border-radius: 6px; overflow-x: auto; }
</style></head>
<body>
  <h2>⚠️ 终端可疑命令告警</h2>
  <div class="card">
    <div class="label">告警类型</div>
    <div class="value" style="color:var(--vscode-errorForeground)">${entry.warning}</div>
  </div>
  <div class="card">
    <div class="label">终端名称</div>
    <div class="value">${entry.terminalName}</div>
  </div>
  <div class="card">
    <div class="label">时间</div>
    <div class="value">${new Date(entry.timestamp).toLocaleString('zh-CN')}</div>
  </div>
  <div class="card">
    <div class="label">命令内容</div>
    <pre>${entry.command}</pre>
  </div>
  <p style="color:var(--vscode-descriptionForeground);font-size:12px;margin-top:20px">
    此告警由 Cursor Shield 终端监控自动检测。如需调整，请修改 cursorSecurity 配置。
  </p>
</body></html>`;
}
function getTerminalLogs() {
    return [...terminalLogs];
}
function registerTerminalMonitor(context) {
    const disposables = [];
    const config = vscode.workspace.getConfiguration('cursorSecurity');
    if (!config.get('enabled', true)) {
        return disposables;
    }
    const openListener = vscode.window.onDidOpenTerminal((terminal) => {
        logger.info(MODULE, `Terminal opened: ${terminal.name} (id: ${terminal.processId})`);
        const creationOptions = terminal.creationOptions;
        if (creationOptions?.shellPath) {
            logger.info(MODULE, `Shell: ${creationOptions.shellPath}`);
        }
    });
    disposables.push(openListener);
    const closeListener = vscode.window.onDidCloseTerminal((terminal) => {
        const pid = terminal.processId;
        if (typeof pid === 'number') {
            terminalDataBuffer.delete(pid);
        }
        logger.info(MODULE, `Terminal closed: ${terminal.name}`);
    });
    disposables.push(closeListener);
    try {
        const profileListener = vscode.window.registerTerminalProfileProvider('cursorSecurity.secureTerminal', {
            provideTerminalProfile: () => {
                return new vscode.TerminalProfile({
                    name: 'Cursor Shield - 安全终端',
                    shellPath: process.platform === 'win32' ? 'powershell.exe' : undefined,
                    env: {
                        CURSOR_SHIELD_ACTIVE: '1'
                    }
                });
            }
        });
        disposables.push(profileListener);
    }
    catch (err) {
        logger.warn(MODULE, `Terminal profile registration failed: ${err}`);
    }
    logger.info(MODULE, 'Terminal monitor registered');
    return disposables;
}
//# sourceMappingURL=terminalMonitor.js.map