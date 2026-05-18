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
exports.DashboardViewProvider = void 0;
exports.registerDashboard = registerDashboard;
exports.getDashboardProvider = getDashboardProvider;
exports.refreshDashboard = refreshDashboard;
const vscode = __importStar(require("vscode"));
const logger = __importStar(require("../utils/logger"));
const account_1 = require("../monitors/account");
const gitRemote_1 = require("../monitors/gitRemote");
const mcpSkill_1 = require("../monitors/mcpSkill");
const engine_1 = require("../detection/engine");
const preCommit_1 = require("../detection/preCommit");
const MODULE = 'Dashboard';
function collectDashboardData() {
    return {
        account: (0, account_1.getCurrentStatus)(),
        git: (0, gitRemote_1.getCurrentStatus)(),
        mcpSkill: (0, mcpSkill_1.getCurrentStatus)(),
        scanSummary: (0, engine_1.getLastScanSummary)(),
        leakDetected: (0, preCommit_1.hasLeakDetected)(),
        lastLeakCount: (0, preCommit_1.getLastLeakMatches)().length,
        activeEditor: (0, engine_1.getActiveEditorStats)()
    };
}
function getWebviewHtml(webview, extensionUri) {
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'dashboard.css'));
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cursor Shield Dashboard</title>
    <style>
        :root {
            --bg-primary: var(--vscode-editor-background);
            --bg-secondary: var(--vscode-sideBar-background);
            --bg-card: var(--vscode-editorWidget-background);
            --text-primary: var(--vscode-foreground);
            --text-secondary: var(--vscode-descriptionForeground);
            --border-color: var(--vscode-widget-border);
            --success-color: var(--vscode-terminal-ansiGreen);
            --warning-color: var(--vscode-terminal-ansiYellow);
            --error-color: var(--vscode-terminal-ansiRed);
            --info-color: var(--vscode-terminal-ansiBlue);
            --button-bg: var(--vscode-button-background);
            --button-fg: var(--vscode-button-foreground);
            --button-hover: var(--vscode-button-hoverBackground);
            --button-secondary-bg: var(--vscode-button-secondaryBackground);
            --button-secondary-fg: var(--vscode-button-secondaryForeground);
            --button-secondary-hover: var(--vscode-button-secondaryHoverBackground);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--text-primary);
            background: var(--bg-primary);
            padding: 12px;
            line-height: 1.5;
        }

        .header {
            display: flex;
            align-items: center;
            gap: 10px;
            padding-bottom: 14px;
            border-bottom: 1px solid var(--border-color);
            margin-bottom: 14px;
        }

        .header-icon {
            font-size: 24px;
            line-height: 1;
        }

        .header-title {
            font-size: 16px;
            font-weight: 600;
        }

        .header-status {
            margin-left: auto;
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            padding: 3px 10px;
            border-radius: 12px;
            font-weight: 600;
        }

        .status-active {
            background: rgba(0, 200, 0, 0.15);
            color: var(--success-color);
        }

        .status-inactive {
            background: rgba(255, 0, 0, 0.15);
            color: var(--error-color);
        }

        .card {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 14px;
            margin-bottom: 12px;
        }

        .card-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 10px;
        }

        .card-icon {
            font-size: 18px;
            line-height: 1;
        }

        .card-title {
            font-size: 13px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--text-secondary);
        }

        .card-badge {
            margin-left: auto;
            font-size: 11px;
            padding: 2px 8px;
            border-radius: 10px;
            font-weight: 600;
        }

        .badge-compliant { background: rgba(0, 200, 0, 0.12); color: var(--success-color); }
        .badge-warning { background: rgba(255, 180, 0, 0.12); color: var(--warning-color); }
        .badge-error { background: rgba(255, 0, 0, 0.12); color: var(--error-color); }
        .badge-info { background: rgba(80, 140, 255, 0.12); color: var(--info-color); }

        .info-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 0;
            font-size: 12px;
        }

        .info-label {
            color: var(--text-secondary);
            flex-shrink: 0;
        }

        .info-value {
            text-align: right;
            word-break: break-all;
            max-width: 60%;
            font-family: var(--vscode-editor-font-family);
            font-size: 11px;
        }

        .info-value.mono {
            font-family: var(--vscode-editor-font-family);
            font-size: 11px;
        }

        .mcp-skill-list {
            max-height: 200px;
            overflow-y: auto;
            margin-top: 4px;
        }

        .mcp-skill-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 5px 0;
            font-size: 12px;
            border-bottom: 1px solid color-mix(in srgb, var(--border-color) 50%, transparent);
        }

        .mcp-skill-item:last-child {
            border-bottom: none;
        }

        .mcp-skill-icon {
            font-size: 14px;
            line-height: 1;
        }

        .mcp-skill-name {
            flex: 1;
            font-weight: 500;
        }

        .mcp-skill-type {
            font-size: 10px;
            color: var(--text-secondary);
            background: var(--bg-secondary);
            padding: 1px 6px;
            border-radius: 4px;
        }

        .scan-stats {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 8px;
            margin-top: 4px;
        }

        .scan-stat {
            text-align: center;
            padding: 8px 4px;
            background: var(--bg-secondary);
            border-radius: 6px;
        }

        .scan-stat-value {
            font-size: 22px;
            font-weight: 700;
            line-height: 1.2;
        }

        .scan-stat-label {
            font-size: 10px;
            color: var(--text-secondary);
            margin-top: 2px;
        }

        .stat-critical { color: var(--error-color); }
        .stat-high { color: var(--warning-color); }
        .stat-total { color: var(--info-color); }

        .scan-stat.clickable {
            cursor: pointer;
            transition: background 0.15s;
        }

        .scan-stat.clickable:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .detail-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
        }

        .detail-back-btn {
            background: none;
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            padding: 2px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-family: inherit;
        }

        .detail-back-btn:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .detail-count {
            font-size: 11px;
            color: var(--text-secondary);
        }

        .detail-list {
            max-height: 300px;
            overflow-y: auto;
        }

        .detail-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 5px 8px;
            font-size: 12px;
            border-bottom: 1px solid color-mix(in srgb, var(--border-color) 50%, transparent);
            cursor: pointer;
            transition: background 0.1s;
        }

        .detail-item:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .detail-item:last-child {
            border-bottom: none;
        }

        .detail-severity {
            font-size: 10px;
            padding: 1px 6px;
            border-radius: 4px;
            font-weight: 600;
            flex-shrink: 0;
        }

        .sev-critical { background: rgba(255,0,0,0.12); color: var(--error-color); }
        .sev-high { background: rgba(255,180,0,0.12); color: var(--warning-color); }
        .sev-medium { background: rgba(80,140,255,0.12); color: var(--info-color); }
        .sev-low { background: rgba(128,128,128,0.12); color: var(--text-secondary); }

        .detail-file {
            flex: 1;
            font-family: var(--vscode-editor-font-family);
            font-size: 11px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .detail-line {
            font-size: 10px;
            color: var(--text-secondary);
            flex-shrink: 0;
        }

        .detail-masked {
            font-size: 11px;
            color: var(--text-secondary);
            font-family: var(--vscode-editor-font-family);
            max-width: 180px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .detail-hint {
            font-size: 10px;
            color: var(--text-secondary);
            margin-top: 4px;
            text-align: center;
        }

        .actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 14px;
        }

        .btn {
            flex: 1;
            min-width: 80px;
            padding: 7px 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-family: inherit;
            font-weight: 500;
            text-align: center;
            transition: opacity 0.15s;
        }

        .btn:hover { opacity: 0.85; }

        .btn-primary {
            background: var(--button-bg);
            color: var(--button-fg);
        }

        .btn-secondary {
            background: var(--button-secondary-bg);
            color: var(--button-secondary-fg);
        }

        .footer {
            margin-top: 16px;
            padding-top: 12px;
            border-top: 1px solid var(--border-color);
            text-align: center;
            font-size: 10px;
            color: var(--text-secondary);
        }

        .empty-state {
            text-align: center;
            padding: 20px;
            color: var(--text-secondary);
            font-size: 12px;
        }

        .empty-state-icon {
            font-size: 28px;
            margin-bottom: 8px;
        }
    </style>
</head>
<body>
    <div class="header">
        <span class="header-icon">🛡️</span>
        <span class="header-title">Cursor Shield</span>
        <span id="statusBadge" class="header-status status-active">● 运行中</span>
    </div>

    <div class="card">
        <div class="card-header">
            <span class="card-icon">👤</span>
            <span class="card-title">账号信息</span>
            <span id="accountBadge" class="card-badge badge-info">检查中...</span>
        </div>
        <div id="accountContent">
            <div class="empty-state">
                <div class="empty-state-icon">📡</div>
                <div>等待数据...</div>
            </div>
        </div>
    </div>

    <div class="card">
        <div class="card-header">
            <span class="card-icon">📂</span>
            <span class="card-title">Git 仓库</span>
            <span id="gitBadge" class="card-badge badge-info">检查中...</span>
        </div>
        <div id="gitContent">
            <div class="empty-state">
                <div class="empty-state-icon">📡</div>
                <div>等待数据...</div>
            </div>
        </div>
    </div>

    <div class="card">
        <div class="card-header">
            <span class="card-icon">🧩</span>
            <span class="card-title">MCP / Skill</span>
            <span id="mcpSkillBadge" class="card-badge badge-info">扫描中...</span>
        </div>
        <div id="mcpSkillContent">
            <div class="empty-state">
                <div class="empty-state-icon">📡</div>
                <div>等待数据...</div>
            </div>
        </div>
    </div>

    <div class="card">
        <div class="card-header">
            <span class="card-icon">🔍</span>
            <span class="card-title">敏感信息扫描</span>
            <span id="scanBadge" class="card-badge badge-info">就绪</span>
        </div>
        <div id="scanContent">
            <div class="empty-state">
                <div class="empty-state-icon">🛡️</div>
                <div>尚未执行扫描</div>
            </div>
        </div>
    </div>

    <div class="actions">
        <button id="scanBtn" class="btn btn-primary">🔍 立即扫描</button>
        <button id="exportBtn" class="btn btn-secondary">📥 导出日志</button>
    </div>

    <div class="footer">
        Cursor Shield v1.0.0 · 企业级安全监控
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        let isScanning = false;

        function scanNow() {
            if (isScanning) { return; }
            isScanning = true;
            const btn = document.getElementById('scanBtn');
            if (btn) {
                btn.textContent = '⏳ 扫描中...';
                btn.disabled = true;
                btn.style.opacity = '0.6';
                btn.style.cursor = 'not-allowed';
            }
            const badge = document.getElementById('scanBadge');
            if (badge) {
                badge.className = 'card-badge badge-info';
                badge.textContent = '扫描中...';
            }
            vscode.postMessage({ command: 'scanNow' });
        }

        function exportLogs() {
            vscode.postMessage({ command: 'exportLogs' });
        }

        document.getElementById('scanBtn').addEventListener('click', scanNow);
        document.getElementById('exportBtn').addEventListener('click', exportLogs);

        window.addEventListener('message', event => {
            const data = event.data;
            if (data.type === 'update') {
                updateDashboard(data.payload);
            } else if (data.type === 'scanComplete') {
                isScanning = false;
                const btn = document.getElementById('scanBtn');
                if (btn) {
                    btn.textContent = '🔍 立即扫描';
                    btn.disabled = false;
                    btn.style.opacity = '';
                    btn.style.cursor = '';
                }
                updateDashboard(data.payload);
            }
        });

        function updateDashboard(d) {
            updateAccount(d.account);
            updateGit(d.git);
            updateMCPSkill(d.mcpSkill);
            updateScan(d.scanSummary, d.leakDetected, d.lastLeakCount, d.activeEditor);
            updateStatusBadge(d);
        }

        function updateAccount(a) {
            const badge = document.getElementById('accountBadge');
            const content = document.getElementById('accountContent');

            if (!a.checked) {
                badge.className = 'card-badge badge-info';
                badge.textContent = '检查中...';
                return;
            }

            if (!a.email) {
                badge.className = 'card-badge badge-warning';
                badge.textContent = '⚠️ 未检测到账号';
                content.innerHTML = '<div class="info-row"><span class="info-label">邮箱</span><span class="info-value">未找到 Cursor 账号信息</span></div>';
                return;
            }

            if (a.isCompliant) {
                badge.className = 'card-badge badge-compliant';
                badge.textContent = '✅ 合规';
            } else {
                badge.className = 'card-badge badge-error';
                badge.textContent = '⚠️ 不合规';
            }

            content.innerHTML =
                '<div class="info-row"><span class="info-label">邮箱</span><span class="info-value mono">' + esc(a.email) + '</span></div>';
        }

        function updateGit(g) {
            const badge = document.getElementById('gitBadge');
            const content = document.getElementById('gitContent');

            if (!g.checked) {
                badge.className = 'card-badge badge-info';
                badge.textContent = '检查中...';
                return;
            }

            if (!g.originUrl) {
                badge.className = 'card-badge badge-info';
                badge.textContent = '无仓库';
                content.innerHTML = '<div class="info-row"><span class="info-label">状态</span><span class="info-value">未检测到 Git 仓库</span></div>';
                return;
            }

            if (g.isCompliant) {
                badge.className = 'card-badge badge-compliant';
                badge.textContent = 'Allowed';
            } else {
                badge.className = 'card-badge badge-error';
                badge.textContent = 'Denied';
            }

            content.innerHTML =
                '<div class="info-row"><span class="info-label">远程地址</span><span class="info-value mono">' + esc(g.originUrl) + '</span></div>';
        }

        function updateMCPSkill(ms) {
            const badge = document.getElementById('mcpSkillBadge');
            const content = document.getElementById('mcpSkillContent');

            if (!ms.checked) {
                badge.className = 'card-badge badge-info';
                badge.textContent = '扫描中...';
                return;
            }

            const hasIssue = ms.unauthorizedMCPs > 0 || ms.unauthorizedSkills > 0;
            badge.className = hasIssue ? 'card-badge badge-warning' : 'card-badge badge-compliant';
            badge.textContent = 'M:' + ms.mcpCount + ' S:' + ms.skillCount;

            let html = '';

            if (ms.mcps.length > 0 || ms.skills.length > 0) {
                html += '<div class="mcp-skill-list">';

                for (const m of ms.mcps) {
                    const icon = m.isAuthorized ? '✅' : '⚠️';
                    html += '<div class="mcp-skill-item">' +
                        '<span class="mcp-skill-icon">' + icon + '</span>' +
                        '<span class="mcp-skill-name">' + esc(m.name) + '</span>' +
                        '<span class="mcp-skill-type">MCP</span>' +
                        '</div>';
                }

                for (const s of ms.skills) {
                    const icon = s.isAuthorized ? '✅' : '⚠️';
                    html += '<div class="mcp-skill-item">' +
                        '<span class="mcp-skill-icon">' + icon + '</span>' +
                        '<span class="mcp-skill-name" title="' + esc(s.description) + '">' + esc(s.name) + '</span>' +
                        '<span class="mcp-skill-type">Skill</span>' +
                        '</div>';
                }

                html += '</div>';
            } else {
                html += '<div class="empty-state"><div class="empty-state-icon">📭</div><div>未检测到 MCP 或 Skill</div></div>';
            }

            content.innerHTML = html;
        }

        let scanData = null;
        let showDetail = false;

        function updateScan(summary, leakDetected, lastLeakCount, activeEditor) {
            const badge = document.getElementById('scanBadge');
            const content = document.getElementById('scanContent');

            const hasActiveMatches = activeEditor && activeEditor.matchCount > 0;
            const activeCount = hasActiveMatches ? activeEditor.matchCount : 0;
            const activeCritical = hasActiveMatches ? activeEditor.criticalCount : 0;
            const activeHigh = hasActiveMatches ? activeEditor.highCount : 0;

            scanData = summary;

            if (showDetail && summary && summary.matches.length > 0) {
                renderDetailView(summary.matches);
                return;
            }

            if (leakDetected && lastLeakCount > 0) {
                badge.className = 'card-badge badge-error';
                badge.textContent = '⚠️ 发现泄露';
            } else if (hasActiveMatches || (summary && summary.totalMatches > 0)) {
                const total = summary ? summary.totalMatches : activeCount;
                badge.className = 'card-badge badge-warning';
                badge.textContent = '⚠️ ' + total + ' 处';
            } else if (summary && summary.totalMatches === 0) {
                badge.className = 'card-badge badge-compliant';
                badge.textContent = '✅ 安全';
            } else {
                badge.className = 'card-badge badge-info';
                badge.textContent = '就绪';
            }

            if (summary) {
                const critical = summary.matchesBySeverity['critical'] || 0;
                const high = summary.matchesBySeverity['high'] || 0;
                const total = summary.totalMatches;
                const canClick = total > 0;

                content.innerHTML =
                    '<div class="scan-stats">' +
                    '<div class="scan-stat' + (canClick && critical > 0 ? ' clickable' : '') + '" data-action="showDetail"' +
                    '><div class="scan-stat-value stat-critical">' + critical + '</div><div class="scan-stat-label">Critical</div></div>' +
                    '<div class="scan-stat' + (canClick && high > 0 ? ' clickable' : '') + '" data-action="showDetail"' +
                    '><div class="scan-stat-value stat-high">' + high + '</div><div class="scan-stat-label">High</div></div>' +
                    '<div class="scan-stat' + (canClick ? ' clickable' : '') + '" data-action="showDetail"' +
                    '><div class="scan-stat-value stat-total">' + total + '</div><div class="scan-stat-label">总计</div></div>' +
                    '</div>';
            } else if (leakDetected && lastLeakCount > 0) {
                content.innerHTML =
                    '<div class="info-row"><span class="info-label">上次拦截</span><span class="info-value" style="color:var(--error-color)">' + lastLeakCount + ' 处敏感信息</span></div>' +
                    '<div class="info-row"><span class="info-label">建议</span><span class="info-value">请处理敏感信息后重试</span></div>';
            } else if (hasActiveMatches) {
                content.innerHTML =
                    '<div class="scan-stats">' +
                    '<div class="scan-stat"><div class="scan-stat-value stat-critical">' + activeCritical + '</div><div class="scan-stat-label">Critical</div></div>' +
                    '<div class="scan-stat"><div class="scan-stat-value stat-high">' + activeHigh + '</div><div class="scan-stat-label">High</div></div>' +
                    '<div class="scan-stat"><div class="scan-stat-value stat-total">' + activeCount + '</div><div class="scan-stat-label">总计</div></div>' +
                    '</div>' +
                    '<div class="info-row" style="margin-top:8px"><span class="info-label">当前文件</span><span class="info-value" style="color:var(--warning-color)">' + (activeEditor.fileName ? esc(activeEditor.fileName) : '未知') + '</span></div>';
            } else {
                content.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🛡️</div><div>尚未执行扫描<br><span style="font-size:11px">点击下方"立即扫描"开始</span></div></div>';
            }
        }

        function renderDetailView(matches) {
            showDetail = true;
            const badge = document.getElementById('scanBadge');
            const content = document.getElementById('scanContent');

            badge.className = 'card-badge badge-warning';
            badge.textContent = matches.length + ' 处';

            const displayMatches = matches.slice(0, 200);
            let html = '<div class="detail-header">' +
                '<button class="detail-back-btn">← 返回</button>' +
                '<span class="detail-count">共 ' + matches.length + ' 处' + (matches.length > 200 ? '（显示前200条）' : '') + '</span>' +
                '</div>' +
                '<div class="detail-list">';

            for (let i = 0; i < displayMatches.length; i++) {
                const m = displayMatches[i];
                const sevClass = 'sev-' + m.rule.severity;
                const shortFile = m.file.replace(/^.*[\\/]/, '');
                html += '<div class="detail-item" data-file="' + escAttr(m.file) + '" data-line="' + m.line + '">' +
                    '<span class="detail-severity ' + sevClass + '">' + m.rule.severity + '</span>' +
                    '<span class="detail-file" title="' + escAttr(m.file) + '">' + esc(shortFile) + '</span>' +
                    '<span class="detail-line">L' + m.line + '</span>' +
                    '<span class="detail-masked" title="' + escAttr(m.rule.description) + '">' + esc(m.masked) + '</span>' +
                    '</div>';
            }

            html += '</div><div class="detail-hint">点击条目可跳转至源码位置</div>';
            content.innerHTML = html;
        }

        function backToOverview() {
            showDetail = false;
            const content = document.getElementById('scanContent');
            const badge = document.getElementById('scanBadge');

            if (scanData && scanData.totalMatches > 0) {
                const critical = scanData.matchesBySeverity['critical'] || 0;
                const high = scanData.matchesBySeverity['high'] || 0;
                const total = scanData.totalMatches;

                badge.className = 'card-badge badge-warning';
                badge.textContent = '⚠️ ' + total + ' 处';

                content.innerHTML =
                    '<div class="scan-stats">' +
                    '<div class="scan-stat clickable" data-action="showDetail">' +
                    '<div class="scan-stat-value stat-critical">' + critical + '</div><div class="scan-stat-label">Critical</div></div>' +
                    '<div class="scan-stat clickable" data-action="showDetail">' +
                    '<div class="scan-stat-value stat-high">' + high + '</div><div class="scan-stat-label">High</div></div>' +
                    '<div class="scan-stat clickable" data-action="showDetail">' +
                    '<div class="scan-stat-value stat-total">' + total + '</div><div class="scan-stat-label">总计</div></div>' +
                    '</div>';
            } else if (scanData) {
                badge.className = 'card-badge badge-compliant';
                badge.textContent = '✅ 安全';
                content.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🛡️</div><div>未发现敏感信息</div></div>';
            } else {
                badge.className = 'card-badge badge-info';
                badge.textContent = '就绪';
                content.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🛡️</div><div>尚未执行扫描</div></div>';
            }
        }

        function updateStatusBadge(d) {
            const badge = document.getElementById('statusBadge');
            const hasAccountIssue = d.account.checked && !d.account.isCompliant;
            const hasGitIssue = d.git.checked && d.git.originUrl && !d.git.isCompliant;
            const hasLeak = d.leakDetected && d.lastLeakCount > 0;
            const hasActiveMatches = d.activeEditor && d.activeEditor.matchCount > 0;

            if (hasLeak) {
                badge.className = 'header-status status-inactive';
                badge.innerHTML = '⚠️ 发现泄露';
            } else if (hasActiveMatches || hasAccountIssue || hasGitIssue) {
                badge.className = 'header-status status-inactive';
                badge.innerHTML = '⚠️ 合规警告';
            } else {
                badge.className = 'header-status status-active';
                badge.innerHTML = '● 运行中';
            }
        }

        function esc(str) {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function escAttr(str) {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;');
        }

        document.getElementById('scanContent').addEventListener('click', function(e) {
            const stat = e.target.closest('.scan-stat.clickable');
            if (stat) {
                if (scanData && scanData.matches && scanData.matches.length > 0) {
                    renderDetailView(scanData.matches);
                }
                return;
            }

            const backBtn = e.target.closest('.detail-back-btn');
            if (backBtn) {
                backToOverview();
                return;
            }

            const detailItem = e.target.closest('.detail-item');
            if (detailItem) {
                const file = detailItem.getAttribute('data-file');
                const line = parseInt(detailItem.getAttribute('data-line') || '1', 10);
                if (file) {
                    vscode.postMessage({ command: 'navigateTo', file: file, line: line });
                }
                return;
            }
        });

        vscode.postMessage({ command: 'ready' });
    </script>
</body>
</html>`;
}
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
function navigateToMatch(filePath, line) {
    const uri = vscode.Uri.file(filePath);
    vscode.window.showTextDocument(uri, { selection: new vscode.Range(line - 1, 0, line - 1, 999) });
}
class DashboardViewProvider {
    _extensionUri;
    static viewType = 'cursorShield.dashboard';
    _view;
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
    }
    resolveWebviewView(webviewView, _context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        webviewView.webview.html = getWebviewHtml(webviewView.webview, this._extensionUri);
        webviewView.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'ready':
                    this.refresh();
                    break;
                case 'scanNow':
                    vscode.commands.executeCommand('cursorSecurity.scanNow');
                    break;
                case 'exportLogs':
                    vscode.commands.executeCommand('cursorSecurity.exportLogs');
                    break;
                case 'navigateTo':
                    navigateToMatch(message.file, message.line);
                    break;
            }
        });
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this.refresh();
            }
        });
    }
    refresh() {
        if (!this._view) {
            return;
        }
        try {
            const data = collectDashboardData();
            this._view.webview.postMessage({
                type: 'update',
                payload: data
            });
        }
        catch (err) {
            logger.error(MODULE, `Dashboard refresh failed: ${err}`);
        }
    }
    notifyScanComplete() {
        if (!this._view) {
            return;
        }
        try {
            const data = collectDashboardData();
            this._view.webview.postMessage({
                type: 'scanComplete',
                payload: data
            });
        }
        catch (err) {
            logger.error(MODULE, `ScanComplete notify failed: ${err}`);
        }
    }
}
exports.DashboardViewProvider = DashboardViewProvider;
let provider = null;
function registerDashboard(context) {
    const disposables = [];
    provider = new DashboardViewProvider(context.extensionUri);
    const viewRegistration = vscode.window.registerWebviewViewProvider(DashboardViewProvider.viewType, provider);
    disposables.push(viewRegistration);
    const refreshCommand = vscode.commands.registerCommand('cursorSecurity._refreshDashboard', () => {
        if (provider) {
            provider.refresh();
        }
    });
    disposables.push(refreshCommand);
    return disposables;
}
function getDashboardProvider() {
    return provider;
}
function refreshDashboard() {
    if (provider) {
        provider.refresh();
    }
}
//# sourceMappingURL=webview.js.map