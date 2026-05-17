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
exports.registerAntiTamper = registerAntiTamper;
exports.isTamperDetected = isTamperDetected;
exports.getTrustedConfig = getTrustedConfig;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger = __importStar(require("../utils/logger"));
const MODULE = 'AntiTamper';
let trustedConfig = null;
let tamperDetected = false;
let fileWatcher = null;
let extensionDir = '';
const CRITICAL_FILES = [
    'package.json',
    'out/extension.js'
];
function getExtensionDir(context) {
    return context.extensionUri.fsPath;
}
function saveTrustedConfig() {
    const config = vscode.workspace.getConfiguration('cursorSecurity');
    trustedConfig = {
        enabled: config.get('enabled', true),
        allowedEmailDomains: config.get('allowedEmailDomains') || [],
        allowedRepos: config.get('allowedRepos') || [],
        blockedMCPs: config.get('blockedMCPs') || [],
        allowedSkills: config.get('allowedSkills') || [],
        blockCommitOnLeak: config.get('blockCommitOnLeak', true),
        blockPushOnLeak: config.get('blockPushOnLeak', true),
        autoRecoverEnabled: config.get('autoRecoverEnabled', true)
    };
    logger.info(MODULE, 'Trusted configuration saved');
}
function showTamperWarning(type, detail) {
    tamperDetected = true;
    logger.error(MODULE, `Tamper detected: ${type} - ${detail}`);
    vscode.window.showErrorMessage(`[Cursor Shield] 🚨 安全警告：检测到${type}！`, { modal: true }, '我知道了').then(() => {
        vscode.window.showWarningMessage(`详情：${detail}\n请立即联系安全管理员。`, { modal: true }, '确定');
    });
}
function recoverConfiguration() {
    if (!trustedConfig || !trustedConfig.autoRecoverEnabled) {
        return;
    }
    const config = vscode.workspace.getConfiguration('cursorSecurity');
    const currentEnabled = config.get('enabled', true);
    if (!currentEnabled && trustedConfig.enabled) {
        logger.warn(MODULE, 'Recovering: cursorSecurity.enabled was set to false, restoring to true');
        config.update('enabled', true, vscode.ConfigurationTarget.Global);
    }
    const currentDomains = config.get('allowedEmailDomains') || [];
    if (trustedConfig.allowedEmailDomains.length > 0 && currentDomains.length === 0) {
        logger.warn(MODULE, 'Recovering: allowedEmailDomains was cleared, restoring');
        config.update('allowedEmailDomains', trustedConfig.allowedEmailDomains, vscode.ConfigurationTarget.Global);
    }
    const currentRepos = config.get('allowedRepos') || [];
    if (trustedConfig.allowedRepos.length > 0 && currentRepos.length === 0) {
        logger.warn(MODULE, 'Recovering: allowedRepos was cleared, restoring');
        config.update('allowedRepos', trustedConfig.allowedRepos, vscode.ConfigurationTarget.Global);
    }
    const currentBlockCommit = config.get('blockCommitOnLeak', true);
    if (!currentBlockCommit && trustedConfig.blockCommitOnLeak) {
        logger.warn(MODULE, 'Recovering: blockCommitOnLeak was disabled, restoring');
        config.update('blockCommitOnLeak', true, vscode.ConfigurationTarget.Global);
    }
    const currentAutoRecover = config.get('autoRecoverEnabled', true);
    if (!currentAutoRecover && trustedConfig.autoRecoverEnabled) {
        logger.warn(MODULE, 'Recovering: autoRecoverEnabled was disabled, restoring');
        config.update('autoRecoverEnabled', true, vscode.ConfigurationTarget.Global);
    }
}
function startFileIntegrityMonitoring(context) {
    extensionDir = getExtensionDir(context);
    try {
        fileWatcher = fs.watch(extensionDir, { recursive: true }, (eventType, filename) => {
            if (!filename) {
                return;
            }
            const normalizedName = filename.replace(/\\/g, '/');
            const isCritical = CRITICAL_FILES.some(f => normalizedName.endsWith(f) || normalizedName.includes(f));
            if (isCritical && eventType === 'rename') {
                const fullPath = path.join(extensionDir, filename);
                setTimeout(() => {
                    if (!fs.existsSync(fullPath)) {
                        showTamperWarning('扩展文件被删除', `核心文件缺失: ${filename}`);
                    }
                }, 500);
            }
        });
        fileWatcher.on('error', (err) => {
            logger.error(MODULE, `File watcher error: ${err}`);
        });
        logger.info(MODULE, 'File integrity monitoring started');
    }
    catch (err) {
        logger.error(MODULE, `Failed to start file integrity monitoring: ${err}`);
    }
}
function verifyCoreFiles() {
    for (const file of CRITICAL_FILES) {
        const fullPath = path.join(extensionDir, file);
        if (!fs.existsSync(fullPath)) {
            logger.error(MODULE, `Core file missing: ${file}`);
            return false;
        }
    }
    return true;
}
function registerAntiTamper(context) {
    const disposables = [];
    extensionDir = getExtensionDir(context);
    saveTrustedConfig();
    if (!verifyCoreFiles()) {
        showTamperWarning('扩展文件完整性异常', '核心文件缺失，扩展可能已损坏');
    }
    const disableListener = vscode.extensions.onDidChange(() => {
        const selfExt = vscode.extensions.getExtension('cursor-shield.cursor-shield');
        if (!selfExt) {
            showTamperWarning('扩展被卸载', 'Cursor Shield 扩展已被移除');
            return;
        }
        if (!selfExt.isActive) {
            logger.error(MODULE, 'Extension has been disabled!');
            const config = vscode.workspace.getConfiguration('cursorSecurity');
            const autoRecover = config.get('autoRecoverEnabled', true);
            showTamperWarning('扩展被禁用', 'Cursor Shield 已被禁用，安全防护失效。' +
                (autoRecover ? '正在尝试自动恢复...' : '请联系管理员。'));
            if (autoRecover) {
                try {
                    void selfExt.activate().then(() => {
                        logger.info(MODULE, 'Extension reactivated successfully');
                        vscode.window.showInformationMessage('[Cursor Shield] 安全扩展已自动恢复运行。');
                    }, (err) => {
                        logger.error(MODULE, `Failed to reactivate: ${err}`);
                    });
                }
                catch (err) {
                    logger.error(MODULE, `Reactivation failed: ${err}`);
                }
            }
        }
    });
    disposables.push(disableListener);
    const configListener = vscode.workspace.onDidChangeConfiguration(e => {
        if (!e.affectsConfiguration('cursorSecurity')) {
            return;
        }
        const config = vscode.workspace.getConfiguration('cursorSecurity');
        const autoRecover = config.get('autoRecoverEnabled', true);
        if (!autoRecover) {
            trustedConfig = null;
            return;
        }
        const currentEnabled = config.get('enabled', true);
        if (!currentEnabled && trustedConfig?.enabled) {
            logger.warn(MODULE, 'Configuration tamper detected: enabled set to false');
            vscode.window.showWarningMessage('[Cursor Shield] 检测到安全配置被修改，正在自动恢复...', '确定');
            recoverConfiguration();
            return;
        }
        const currentDomains = config.get('allowedEmailDomains') || [];
        if (trustedConfig && trustedConfig.allowedEmailDomains.length > 0 && currentDomains.length === 0) {
            logger.warn(MODULE, 'Configuration tamper detected: allowedEmailDomains cleared');
            vscode.window.showWarningMessage('[Cursor Shield] 检测到允许域名列表被清空，正在自动恢复...', '确定');
            recoverConfiguration();
            return;
        }
        const currentRepos = config.get('allowedRepos') || [];
        if (trustedConfig && trustedConfig.allowedRepos.length > 0 && currentRepos.length === 0) {
            logger.warn(MODULE, 'Configuration tamper detected: allowedRepos cleared');
            vscode.window.showWarningMessage('[Cursor Shield] 检测到允许仓库列表被清空，正在自动恢复...', '确定');
            recoverConfiguration();
            return;
        }
        saveTrustedConfig();
    });
    disposables.push(configListener);
    startFileIntegrityMonitoring(context);
    return disposables;
}
function isTamperDetected() {
    return tamperDetected;
}
function getTrustedConfig() {
    return trustedConfig ? { ...trustedConfig } : null;
}
function deactivate() {
    if (fileWatcher) {
        fileWatcher.close();
        fileWatcher = null;
    }
}
//# sourceMappingURL=antiTamper.js.map