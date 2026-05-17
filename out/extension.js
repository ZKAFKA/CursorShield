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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const logger = __importStar(require("./utils/logger"));
const account_1 = require("./monitors/account");
const gitRemote_1 = require("./monitors/gitRemote");
const mcpSkill_1 = require("./monitors/mcpSkill");
const terminalMonitor_1 = require("./monitors/terminalMonitor");
const decorator_1 = require("./detection/decorator");
const preCommit_1 = require("./detection/preCommit");
const antiTamper_1 = require("./protection/antiTamper");
const heartbeat_1 = require("./protection/heartbeat");
const webview_1 = require("./dashboard/webview");
const engine_1 = require("./detection/engine");
const preCommit_2 = require("./detection/preCommit");
const MODULE = 'Extension';
let leakStatusBarItem;
let allDisposables = [];
function activate(context) {
    logger.info(MODULE, '========================================');
    logger.info(MODULE, 'Cursor Shield activating...');
    logger.info(MODULE, '========================================');
    logger.cleanupExpiredLogs();
    const config = vscode.workspace.getConfiguration('cursorSecurity');
    const enabled = config.get('enabled', true);
    if (!enabled) {
        logger.warn(MODULE, 'Cursor Shield is disabled by configuration');
        vscode.window.showWarningMessage('[Cursor Shield] 安全监控已被配置禁用。如需启用，请将 cursorSecurity.enabled 设为 true。');
        return;
    }
    leakStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 997);
    leakStatusBarItem.command = 'cursorSecurity.showDashboard';
    leakStatusBarItem.tooltip = 'Cursor Shield - 敏感信息检测状态';
    leakStatusBarItem.show();
    updateLeakStatusBar();
    const accountDisposables = (0, account_1.registerAccountMonitor)(context);
    allDisposables.push(...accountDisposables);
    context.subscriptions.push(...accountDisposables);
    logger.info(MODULE, 'Account monitor registered');
    const gitDisposables = (0, gitRemote_1.registerGitMonitor)(context);
    allDisposables.push(...gitDisposables);
    context.subscriptions.push(...gitDisposables);
    logger.info(MODULE, 'Git monitor registered');
    const mcpSkillDisposables = (0, mcpSkill_1.registerMCPSkillMonitor)(context);
    allDisposables.push(...mcpSkillDisposables);
    context.subscriptions.push(...mcpSkillDisposables);
    logger.info(MODULE, 'MCP/Skill monitor registered');
    const terminalDisposables = (0, terminalMonitor_1.registerTerminalMonitor)(context);
    allDisposables.push(...terminalDisposables);
    context.subscriptions.push(...terminalDisposables);
    logger.info(MODULE, 'Terminal monitor registered');
    const decoratorDisposables = (0, decorator_1.registerDecorator)(context);
    allDisposables.push(...decoratorDisposables);
    context.subscriptions.push(...decoratorDisposables);
    logger.info(MODULE, 'Editor decorator registered');
    const preCommitDisposables = (0, preCommit_1.registerPreCommitHooks)(context);
    allDisposables.push(...preCommitDisposables);
    context.subscriptions.push(...preCommitDisposables);
    logger.info(MODULE, 'Pre-commit hooks registered');
    const antiTamperDisposables = (0, antiTamper_1.registerAntiTamper)(context);
    allDisposables.push(...antiTamperDisposables);
    context.subscriptions.push(...antiTamperDisposables);
    logger.info(MODULE, 'Anti-tamper protection registered');
    const heartbeatDisposables = (0, heartbeat_1.registerHeartbeat)(context);
    allDisposables.push(...heartbeatDisposables);
    context.subscriptions.push(...heartbeatDisposables);
    logger.info(MODULE, 'Heartbeat module registered');
    const dashboardDisposables = (0, webview_1.registerDashboard)(context);
    allDisposables.push(...dashboardDisposables);
    context.subscriptions.push(...dashboardDisposables);
    logger.info(MODULE, 'Dashboard registered');
    registerCommands(context);
    const dashboardRefreshInterval = setInterval(() => {
        updateLeakStatusBar();
        (0, webview_1.refreshDashboard)();
    }, 10000);
    context.subscriptions.push({ dispose: () => clearInterval(dashboardRefreshInterval) });
    const leakCheckListener = vscode.workspace.onDidSaveTextDocument(() => {
        updateLeakStatusBar();
        (0, webview_1.refreshDashboard)();
    });
    context.subscriptions.push(leakCheckListener);
    updateLeakStatusBar();
    (0, webview_1.refreshDashboard)();
    logger.info(MODULE, '========================================');
    logger.info(MODULE, 'Cursor Shield activated successfully');
    logger.info(MODULE, '========================================');
    vscode.window.showInformationMessage('[Cursor Shield] 企业安全监控已启动 🛡️');
}
function deactivate() {
    logger.info(MODULE, 'Cursor Shield deactivating...');
    logger.close();
    const { deactivate: antiTamperDeactivate } = require('./protection/antiTamper');
    if (typeof antiTamperDeactivate === 'function') {
        antiTamperDeactivate();
    }
}
function updateLeakStatusBar() {
    const hasLeak = (0, preCommit_2.hasLeakDetected)();
    const leakMatches = (0, preCommit_2.getLastLeakMatches)();
    const scanSummary = (0, engine_1.getLastScanSummary)();
    if (hasLeak && leakMatches.length > 0) {
        leakStatusBarItem.text = `$(error) Leaks:${leakMatches.length}`;
        leakStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        leakStatusBarItem.tooltip = `检测到 ${leakMatches.length} 处敏感信息泄露 - 上次操作已被阻断`;
    }
    else if (scanSummary && scanSummary.totalMatches > 0) {
        leakStatusBarItem.text = `$(warning) Leaks:${scanSummary.totalMatches}`;
        leakStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        leakStatusBarItem.tooltip = `最近扫描发现 ${scanSummary.totalMatches} 处敏感信息`;
    }
    else {
        leakStatusBarItem.text = '$(shield) Leaks:0';
        leakStatusBarItem.backgroundColor = undefined;
        leakStatusBarItem.tooltip = '敏感信息检测：安全';
    }
}
function registerCommands(context) {
    context.subscriptions.push(vscode.commands.registerCommand('cursorSecurity.scanNow', async () => {
        logger.info(MODULE, 'Manual scan triggered');
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Cursor Shield: 正在扫描敏感信息...',
            cancellable: true
        }, async (progress, token) => {
            (0, engine_1.clearScanCache)();
            const summary = await (0, engine_1.scanWorkspace)();
            if (token.isCancellationRequested) {
                return;
            }
            updateLeakStatusBar();
            (0, webview_1.refreshDashboard)();
            if (summary.totalMatches === 0) {
                vscode.window.showInformationMessage(`[Cursor Shield] 扫描完成：未发现敏感信息 ✅ (${(summary.duration / 1000).toFixed(1)}s)`);
            }
            else {
                const critical = summary.matchesBySeverity['critical'] || 0;
                const high = summary.matchesBySeverity['high'] || 0;
                const items = summary.matches.slice(0, 5).map(m => `  ${m.file}:${m.line} - [${m.rule.severity}] ${m.rule.description}: ${m.masked}`);
                const msg = [
                    `[Cursor Shield] 扫描完成：发现 ${summary.totalMatches} 处敏感信息 ⚠️`,
                    `  🔴 Critical: ${critical}`,
                    `  🟠 High: ${high}`,
                    ...items,
                    summary.totalMatches > 5 ? `  ... 还有 ${summary.totalMatches - 5} 处` : ''
                ].join('\n');
                vscode.window.showWarningMessage(msg, '查看详情', '我知道了').then(choice => {
                    if (choice === '查看详情') {
                        vscode.commands.executeCommand('cursorSecurity.showDashboard');
                    }
                });
            }
        });
    }));
    context.subscriptions.push(vscode.commands.registerCommand('cursorSecurity.exportLogs', async () => {
        const recentLogs = logger.readRecentLogs(500);
        if (recentLogs.length === 0) {
            vscode.window.showInformationMessage('[Cursor Shield] 暂无日志可导出');
            return;
        }
        const defaultUri = vscode.Uri.file(path.join(logger.getLogDir(), `export-${new Date().toISOString().replace(/:/g, '-')}.log`));
        const uri = await vscode.window.showSaveDialog({
            defaultUri,
            filters: { 'Log Files': ['log'], 'All Files': ['*'] }
        });
        if (uri) {
            fs.writeFileSync(uri.fsPath, recentLogs.join('\n'), 'utf-8');
            vscode.window.showInformationMessage(`[Cursor Shield] 日志已导出：${uri.fsPath} (${recentLogs.length} 条)`);
            logger.info(MODULE, `Logs exported to: ${uri.fsPath}`);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('cursorSecurity.showDashboard', () => {
        vscode.commands.executeCommand('workbench.view.extension.cursorShield');
        (0, webview_1.refreshDashboard)();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('cursorSecurity.showHistory', async () => {
        const panel = vscode.window.createWebviewPanel('cursorShieldHistory', 'Cursor Shield - 扫描历史', vscode.ViewColumn.One, { enableScripts: true });
        const scanSummary = (0, engine_1.getLastScanSummary)();
        const leakMatches = (0, preCommit_2.getLastLeakMatches)();
        const hasLeak = (0, preCommit_2.hasLeakDetected)();
        const recentLogs = logger.readRecentLogs(100);
        const summaryHtml = scanSummary
            ? `<h3>最近扫描结果</h3>
                   <p>时间：${new Date(Date.now() - scanSummary.duration).toLocaleString('zh-CN')}</p>
                   <p>文件数：${scanSummary.scannedFiles} | 匹配数：${scanSummary.totalMatches}</p>
                   <p>耗时：${(scanSummary.duration / 1000).toFixed(1)}s</p>
                   <h4>按严重程度：</h4>
                   <ul>
                     ${Object.entries(scanSummary.matchesBySeverity).map(([sev, count]) => `<li>${sev}: ${count}</li>`).join('')}
                   </ul>
                   ${scanSummary.matches.length > 0 ? '<h4>匹配详情（前 20 条）：</h4><pre>' +
                scanSummary.matches.slice(0, 20).map(m => `[${m.rule.severity}] ${m.file}:${m.line}:${m.column} - ${m.rule.description} - ${m.masked}`).join('\n') + '</pre>' : ''}`
            : '<p>尚未执行全量扫描</p>';
        const leakHtml = hasLeak
            ? `<h3>上次阻断记录</h3>
                   <p>拦截时间：${new Date().toLocaleString('zh-CN')}</p>
                   <p>匹配数：${leakMatches.length}</p>
                   <pre>${leakMatches.slice(0, 10).map(m => `[${m.rule.severity}] ${m.file}:${m.line}:${m.column} - ${m.masked}`).join('\n')}</pre>`
            : '<p>无阻断记录</p>';
        const logHtml = `<h3>最近日志</h3><pre>${recentLogs.join('\n')}</pre>`;
        panel.webview.html = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>扫描历史</title>
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground);
         background: var(--vscode-editor-background); padding: 20px; }
  h2 { border-bottom: 1px solid var(--vscode-widget-border); padding-bottom: 8px; }
  h3 { margin-top: 20px; color: var(--vscode-textLink-foreground); }
  h4 { margin-bottom: 4px; }
  pre { background: var(--vscode-textCodeBlock-background); padding: 12px;
        border-radius: 6px; overflow-x: auto; font-size: 12px; line-height: 1.6; }
  ul { padding-left: 20px; }
</style></head>
<body>
  <h2>📋 Cursor Shield - 扫描历史</h2>
  ${summaryHtml}
  ${leakHtml}
  ${logHtml}
</body></html>`;
    }));
    context.subscriptions.push(vscode.commands.registerCommand('cursorSecurity.reloadConfig', () => {
        logger.info(MODULE, 'Configuration reload requested');
        const config = vscode.workspace.getConfiguration('cursorSecurity');
        const enabled = config.get('enabled', true);
        updateLeakStatusBar();
        (0, webview_1.refreshDashboard)();
        vscode.window.showInformationMessage(`[Cursor Shield] 配置已重新加载（安全监控：${enabled ? '已启用' : '已禁用'}）`);
    }));
}
//# sourceMappingURL=extension.js.map