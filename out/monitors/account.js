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
exports.getAccountChangeLog = getAccountChangeLog;
exports.createStatusBarItem = createStatusBarItem;
exports.getStatusBarItem = getStatusBarItem;
exports.checkAccount = checkAccount;
exports.getCurrentStatus = getCurrentStatus;
exports.registerAccountMonitor = registerAccountMonitor;
const vscode = __importStar(require("vscode"));
const dbReader_1 = require("../utils/dbReader");
const logger = __importStar(require("../utils/logger"));
const MODULE = 'Account';
const ACCOUNT_CHANGE_LOG = [];
const MAX_CHANGE_LOG = 200;
let currentStatus = {
    email: null,
    domain: null,
    isCompliant: false,
    reason: 'Not checked yet',
    checked: false,
    changedFrom: null,
    changeType: null
};
let previousEmail = null;
let previousAuthHash = '';
let previousAuthenticated = false;
let statusBarItem = null;
let pollTimer = null;
const POLL_INTERVAL_MS = 30000;
function checkDomainCompliance(domain, allowedDomains) {
    if (!domain) {
        return false;
    }
    if (allowedDomains.length === 0) {
        return true;
    }
    return allowedDomains.some(allowed => domain.toLowerCase() === allowed.toLowerCase());
}
function recordChangeEvent(event) {
    ACCOUNT_CHANGE_LOG.push(event);
    if (ACCOUNT_CHANGE_LOG.length > MAX_CHANGE_LOG) {
        ACCOUNT_CHANGE_LOG.shift();
    }
}
function getAccountChangeLog() {
    return [...ACCOUNT_CHANGE_LOG];
}
function createStatusBarItem() {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1000);
    statusBarItem.command = 'cursorSecurity.showDashboard';
    statusBarItem.tooltip = 'Cursor Shield - 点击查看安全仪表盘';
    statusBarItem.show();
    return statusBarItem;
}
function getStatusBarItem() {
    return statusBarItem;
}
function detectChangeType(prevEmail, newEmail) {
    if (!prevEmail && newEmail) {
        return { changeType: 'login', changedFrom: null };
    }
    if (prevEmail && !newEmail) {
        return { changeType: 'logout', changedFrom: prevEmail };
    }
    if (prevEmail && newEmail && prevEmail !== newEmail) {
        return { changeType: 'switch', changedFrom: prevEmail };
    }
    return { changeType: 'non_compliant', changedFrom: null };
}
async function handleAccountChange(prevEmail, newEmail, isCompliant) {
    const { changeType, changedFrom } = detectChangeType(prevEmail, newEmail);
    if (changeType === 'non_compliant' && prevEmail === newEmail) {
        return;
    }
    const event = {
        timestamp: new Date().toISOString(),
        previousEmail: prevEmail,
        currentEmail: newEmail,
        changeType,
        isCompliant
    };
    recordChangeEvent(event);
    switch (changeType) {
        case 'login':
            logger.info(MODULE, `Account logged in: ${newEmail}`);
            if (!isCompliant) {
                vscode.window.showErrorMessage(`[Cursor Shield] 🚨 检测到账号登录：${newEmail}\n该账号不在企业允许的域名列表中，请立即切换到企业账号！`, { modal: true }, '我知道了');
            }
            else {
                vscode.window.showInformationMessage(`[Cursor Shield] 账号已登录：${newEmail}（合规）`);
            }
            break;
        case 'logout':
            logger.warn(MODULE, `Account logged out: ${prevEmail}`);
            vscode.window.showWarningMessage(`[Cursor Shield] 检测到账号登出：${prevEmail || '未知'}\n安全监控可能无法正常工作。`, '我知道了');
            break;
        case 'switch':
            logger.warn(MODULE, `Account switched: ${prevEmail} → ${newEmail}`);
            if (!isCompliant) {
                vscode.window.showErrorMessage(`[Cursor Shield] 🚨 检测到账号切换：${prevEmail} → ${newEmail}\n新账号不在企业允许的域名列表中，请立即切换回企业账号！`, { modal: true }, '我知道了', '切换回原账号').then(choice => {
                    if (choice === '切换回原账号') {
                        vscode.commands.executeCommand('cursorSecurity._refreshAccount');
                    }
                });
            }
            else {
                vscode.window.showInformationMessage(`[Cursor Shield] 账号已切换：${prevEmail} → ${newEmail}（合规）`);
            }
            break;
        case 'non_compliant':
            logger.warn(MODULE, `Non-compliant account detected: ${newEmail}`);
            vscode.window.showErrorMessage(`[Cursor Shield] 🚨 当前账号不合规：${newEmail}\n该账号不在企业允许的域名列表中，请切换到企业账号！`, { modal: false }, '我知道了');
            break;
    }
}
async function checkAccount() {
    logger.info(MODULE, 'Checking account compliance...');
    const account = await (0, dbReader_1.readAccountEmail)();
    const authHashChanged = previousAuthHash !== '' && account.authStateHash !== previousAuthHash;
    const authLost = previousAuthenticated && !account.isAuthenticated;
    if (!account.found || !account.email) {
        const hadPreviousAccount = previousEmail !== null;
        const oldEmail = previousEmail;
        currentStatus = {
            email: null,
            domain: null,
            isCompliant: false,
            reason: account.error || 'No account email found in Cursor database',
            checked: true,
            changedFrom: oldEmail,
            changeType: null
        };
        if (hadPreviousAccount) {
            await handleAccountChange(oldEmail, null, false);
            previousEmail = null;
        }
        previousAuthHash = account.authStateHash;
        previousAuthenticated = account.isAuthenticated;
        logger.warn(MODULE, `Account check failed: ${currentStatus.reason}`);
        updateStatusBar();
        return currentStatus;
    }
    const config = vscode.workspace.getConfiguration('cursorSecurity');
    const allowedDomains = config.get('allowedEmailDomains') || [];
    const isCompliant = checkDomainCompliance(account.domain, allowedDomains);
    const emailChanged = previousEmail !== account.email;
    currentStatus = {
        email: account.email,
        domain: account.domain,
        isCompliant,
        reason: isCompliant
            ? `Email domain "${account.domain}" is in the allowed list`
            : `Email domain "${account.domain}" is NOT in the allowed list: [${allowedDomains.join(', ')}]`,
        checked: true,
        changedFrom: emailChanged ? previousEmail : null,
        changeType: null
    };
    if (emailChanged) {
        await handleAccountChange(previousEmail, account.email, isCompliant);
    }
    else if (authLost && previousEmail) {
        logger.warn(MODULE, `Auth state lost (hash: ${previousAuthHash} → ${account.authStateHash}, authenticated: ${previousAuthenticated} → ${account.isAuthenticated})`);
        await handleAccountChange(previousEmail, null, false);
        previousEmail = null;
    }
    else if (authHashChanged && !account.isAuthenticated && previousEmail) {
        logger.warn(MODULE, `Auth hash changed and not authenticated (hash: ${previousAuthHash} → ${account.authStateHash})`);
        await handleAccountChange(previousEmail, null, false);
        previousEmail = null;
    }
    else if (!isCompliant && previousEmail === null) {
        await handleAccountChange(null, account.email, false);
    }
    else if (!isCompliant) {
        currentStatus.changeType = 'non_compliant';
        logger.warn(MODULE, `Non-compliant account: ${account.email}`);
        vscode.window.showErrorMessage(`[Cursor Shield] 当前账号不合规：${account.email} 不在允许的域名列表中。`, '我知道了');
    }
    else {
        logger.info(MODULE, `Compliant account: ${account.email}`);
    }
    previousEmail = account.email;
    previousAuthHash = account.authStateHash;
    previousAuthenticated = account.isAuthenticated;
    updateStatusBar();
    return currentStatus;
}
function updateStatusBar() {
    if (!statusBarItem) {
        return;
    }
    if (!currentStatus.checked) {
        statusBarItem.text = '$(shield) Checking...';
        statusBarItem.backgroundColor = undefined;
        return;
    }
    if (!currentStatus.email) {
        statusBarItem.text = '$(warning) No Account';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        return;
    }
    const icon = currentStatus.isCompliant ? '$(check)' : '$(warning)';
    const emailShort = currentStatus.email.length > 30
        ? currentStatus.email.substring(0, 27) + '...'
        : currentStatus.email;
    statusBarItem.text = `${icon} ${emailShort}`;
    if (!currentStatus.isCompliant) {
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        statusBarItem.tooltip = `[不合法账号] ${currentStatus.email}\n${currentStatus.reason}`;
    }
    else {
        statusBarItem.backgroundColor = undefined;
        statusBarItem.tooltip = `[合法账号] ${currentStatus.email}\n${currentStatus.reason}`;
    }
}
function getCurrentStatus() {
    return { ...currentStatus };
}
function registerAccountMonitor(context) {
    const disposables = [];
    createStatusBarItem();
    disposables.push(statusBarItem);
    checkAccount();
    pollTimer = setInterval(() => {
        checkAccount().then(() => {
            try {
                const { refreshDashboard } = require('../dashboard/webview');
                if (typeof refreshDashboard === 'function') {
                    refreshDashboard();
                }
            }
            catch {
                // dashboard may not be loaded
            }
        });
    }, POLL_INTERVAL_MS);
    disposables.push({
        dispose: () => {
            if (pollTimer) {
                clearInterval(pollTimer);
                pollTimer = null;
            }
        }
    });
    const configListener = vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('cursorSecurity.allowedEmailDomains')) {
            logger.info(MODULE, 'Allowed domains config changed, re-checking...');
            checkAccount();
        }
    });
    disposables.push(configListener);
    const refreshCommand = vscode.commands.registerCommand('cursorSecurity._refreshAccount', () => checkAccount());
    disposables.push(refreshCommand);
    const showChangeLogCommand = vscode.commands.registerCommand('cursorSecurity.showAccountChangeLog', () => {
        const panel = vscode.window.createWebviewPanel('cursorShieldAccountLog', 'Cursor Shield - 账号变动记录', vscode.ViewColumn.One, { enableScripts: false });
        const logs = getAccountChangeLog();
        const rows = logs.map(e => {
            const typeLabel = e.changeType === 'login' ? '🟢 登录' :
                e.changeType === 'logout' ? '🔴 登出' :
                    e.changeType === 'switch' ? '🟡 切换' :
                        '⚠️ 不合规';
            const compliantLabel = e.isCompliant ? '✅ 合规' : '❌ 不合规';
            return `<tr>
                    <td>${new Date(e.timestamp).toLocaleString('zh-CN')}</td>
                    <td>${typeLabel}</td>
                    <td>${e.previousEmail || '-'}</td>
                    <td>${e.currentEmail || '-'}</td>
                    <td>${compliantLabel}</td>
                </tr>`;
        }).join('');
        panel.webview.html = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground);
         background: var(--vscode-editor-background); padding: 20px; }
  h2 { border-bottom: 1px solid var(--vscode-widget-border); padding-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--vscode-widget-border); font-size: 13px; }
  th { color: var(--vscode-descriptionForeground); font-weight: 600; }
  .empty { text-align: center; padding: 40px; color: var(--vscode-descriptionForeground); }
</style></head>
<body>
  <h2>📋 账号变动记录</h2>
  ${logs.length > 0
            ? `<table><thead><tr><th>时间</th><th>类型</th><th>原账号</th><th>新账号</th><th>合规</th></tr></thead><tbody>${rows}</tbody></table>`
            : '<div class="empty">暂无账号变动记录</div>'}
</body></html>`;
    });
    disposables.push(showChangeLogCommand);
    return disposables;
}
//# sourceMappingURL=account.js.map