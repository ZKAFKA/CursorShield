import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as logger from '../utils/logger';

const MODULE = 'AntiTamper';

interface TrustedConfig {
    enabled: boolean;
    allowedEmailDomains: string[];
    allowedRepos: string[];
    blockedMCPs: string[];
    allowedSkills: string[];
    blockCommitOnLeak: boolean;
    blockPushOnLeak: boolean;
    autoRecoverEnabled: boolean;
}

let trustedConfig: TrustedConfig | null = null;
let tamperDetected: boolean = false;
let fileWatcher: fs.FSWatcher | null = null;
let extensionDir: string = '';
const CRITICAL_FILES = [
    'package.json',
    'out/extension.js'
];

function getExtensionDir(context: vscode.ExtensionContext): string {
    return context.extensionUri.fsPath;
}

function saveTrustedConfig(): void {
    const config = vscode.workspace.getConfiguration('cursorSecurity');

    trustedConfig = {
        enabled: config.get<boolean>('enabled', true),
        allowedEmailDomains: config.get<string[]>('allowedEmailDomains') || [],
        allowedRepos: config.get<string[]>('allowedRepos') || [],
        blockedMCPs: config.get<string[]>('blockedMCPs') || [],
        allowedSkills: config.get<string[]>('allowedSkills') || [],
        blockCommitOnLeak: config.get<boolean>('blockCommitOnLeak', true),
        blockPushOnLeak: config.get<boolean>('blockPushOnLeak', true),
        autoRecoverEnabled: config.get<boolean>('autoRecoverEnabled', true)
    };

    logger.info(MODULE, 'Trusted configuration saved');
}

function showTamperWarning(type: string, detail: string): void {
    tamperDetected = true;

    logger.error(MODULE, `Tamper detected: ${type} - ${detail}`);

    vscode.window.showErrorMessage(
        `[Cursor Shield] 🚨 安全警告：检测到${type}！`,
        { modal: true },
        '我知道了'
    ).then(() => {
        vscode.window.showWarningMessage(
            `详情：${detail}\n请立即联系安全管理员。`,
            { modal: true },
            '确定'
        );
    });
}

function recoverConfiguration(): void {
    if (!trustedConfig || !trustedConfig.autoRecoverEnabled) {
        return;
    }

    const config = vscode.workspace.getConfiguration('cursorSecurity');

    const currentEnabled = config.get<boolean>('enabled', true);
    if (!currentEnabled && trustedConfig.enabled) {
        logger.warn(MODULE, 'Recovering: cursorSecurity.enabled was set to false, restoring to true');
        config.update('enabled', true, vscode.ConfigurationTarget.Global);
    }

    const currentDomains = config.get<string[]>('allowedEmailDomains') || [];
    if (trustedConfig.allowedEmailDomains.length > 0 && currentDomains.length === 0) {
        logger.warn(MODULE, 'Recovering: allowedEmailDomains was cleared, restoring');
        config.update('allowedEmailDomains', trustedConfig.allowedEmailDomains, vscode.ConfigurationTarget.Global);
    }

    const currentRepos = config.get<string[]>('allowedRepos') || [];
    if (trustedConfig.allowedRepos.length > 0 && currentRepos.length === 0) {
        logger.warn(MODULE, 'Recovering: allowedRepos was cleared, restoring');
        config.update('allowedRepos', trustedConfig.allowedRepos, vscode.ConfigurationTarget.Global);
    }

    const currentBlockCommit = config.get<boolean>('blockCommitOnLeak', true);
    if (!currentBlockCommit && trustedConfig.blockCommitOnLeak) {
        logger.warn(MODULE, 'Recovering: blockCommitOnLeak was disabled, restoring');
        config.update('blockCommitOnLeak', true, vscode.ConfigurationTarget.Global);
    }

    const currentAutoRecover = config.get<boolean>('autoRecoverEnabled', true);
    if (!currentAutoRecover && trustedConfig.autoRecoverEnabled) {
        logger.warn(MODULE, 'Recovering: autoRecoverEnabled was disabled, restoring');
        config.update('autoRecoverEnabled', true, vscode.ConfigurationTarget.Global);
    }
}

function startFileIntegrityMonitoring(context: vscode.ExtensionContext): void {
    extensionDir = getExtensionDir(context);

    try {
        fileWatcher = fs.watch(extensionDir, { recursive: true }, (eventType, filename) => {
            if (!filename) {
                return;
            }

            const normalizedName = filename.replace(/\\/g, '/');

            const isCritical = CRITICAL_FILES.some(f =>
                normalizedName.endsWith(f) || normalizedName.includes(f)
            );

            if (isCritical && eventType === 'rename') {
                const fullPath = path.join(extensionDir, filename);

                setTimeout(() => {
                    if (!fs.existsSync(fullPath)) {
                        showTamperWarning(
                            '扩展文件被删除',
                            `核心文件缺失: ${filename}`
                        );
                    }
                }, 500);
            }
        });

        fileWatcher.on('error', (err) => {
            logger.error(MODULE, `File watcher error: ${err}`);
        });

        logger.info(MODULE, 'File integrity monitoring started');
    } catch (err) {
        logger.error(MODULE, `Failed to start file integrity monitoring: ${err}`);
    }
}

function verifyCoreFiles(): boolean {
    for (const file of CRITICAL_FILES) {
        const fullPath = path.join(extensionDir, file);
        if (!fs.existsSync(fullPath)) {
            logger.error(MODULE, `Core file missing: ${file}`);
            return false;
        }
    }
    return true;
}

export function registerAntiTamper(context: vscode.ExtensionContext): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];

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
            const autoRecover = config.get<boolean>('autoRecoverEnabled', true);

            showTamperWarning(
                '扩展被禁用',
                'Cursor Shield 已被禁用，安全防护失效。' +
                (autoRecover ? '正在尝试自动恢复...' : '请联系管理员。')
            );

            if (autoRecover) {
                try {
                    void selfExt.activate().then(() => {
                        logger.info(MODULE, 'Extension reactivated successfully');
                        vscode.window.showInformationMessage(
                            '[Cursor Shield] 安全扩展已自动恢复运行。'
                        );
                    }, (err: unknown) => {
                        logger.error(MODULE, `Failed to reactivate: ${err}`);
                    });
                } catch (err) {
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
        const autoRecover = config.get<boolean>('autoRecoverEnabled', true);

        if (!autoRecover) {
            trustedConfig = null;
            return;
        }

        const currentEnabled = config.get<boolean>('enabled', true);
        if (!currentEnabled && trustedConfig?.enabled) {
            logger.warn(MODULE, 'Configuration tamper detected: enabled set to false');
            vscode.window.showWarningMessage(
                '[Cursor Shield] 检测到安全配置被修改，正在自动恢复...',
                '确定'
            );
            recoverConfiguration();
            return;
        }

        const currentDomains = config.get<string[]>('allowedEmailDomains') || [];
        if (trustedConfig && trustedConfig.allowedEmailDomains.length > 0 && currentDomains.length === 0) {
            logger.warn(MODULE, 'Configuration tamper detected: allowedEmailDomains cleared');
            vscode.window.showWarningMessage(
                '[Cursor Shield] 检测到允许域名列表被清空，正在自动恢复...',
                '确定'
            );
            recoverConfiguration();
            return;
        }

        const currentRepos = config.get<string[]>('allowedRepos') || [];
        if (trustedConfig && trustedConfig.allowedRepos.length > 0 && currentRepos.length === 0) {
            logger.warn(MODULE, 'Configuration tamper detected: allowedRepos cleared');
            vscode.window.showWarningMessage(
                '[Cursor Shield] 检测到允许仓库列表被清空，正在自动恢复...',
                '确定'
            );
            recoverConfiguration();
            return;
        }

        saveTrustedConfig();
    });
    disposables.push(configListener);

    startFileIntegrityMonitoring(context);

    return disposables;
}

export function isTamperDetected(): boolean {
    return tamperDetected;
}

export function getTrustedConfig(): TrustedConfig | null {
    return trustedConfig ? { ...trustedConfig } : null;
}

export function deactivate(): void {
    if (fileWatcher) {
        fileWatcher.close();
        fileWatcher = null;
    }
}