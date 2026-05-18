import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as logger from './utils/logger';
import { registerAccountMonitor } from './monitors/account';
import { registerGitMonitor } from './monitors/gitRemote';
import { registerMCPSkillMonitor } from './monitors/mcpSkill';
import { registerTerminalMonitor } from './monitors/terminalMonitor';
import { registerDecorator } from './detection/decorator';
import { registerPreCommitHooks } from './detection/preCommit';
import { registerAntiTamper } from './protection/antiTamper';
import { registerHeartbeat } from './protection/heartbeat';
import { registerDashboard, refreshDashboard, getDashboardProvider } from './dashboard/webview';
import { scanWorkspace, getLastScanSummary, clearScanCache, getActiveEditorStats } from './detection/engine';
import { getLastLeakMatches, hasLeakDetected } from './detection/preCommit';

const MODULE = 'Extension';

let leakStatusBarItem: vscode.StatusBarItem;
let allDisposables: vscode.Disposable[] = [];

export function activate(context: vscode.ExtensionContext) {
    logger.info(MODULE, '========================================');
    logger.info(MODULE, 'Cursor Shield activating...');
    logger.info(MODULE, '========================================');

    logger.cleanupExpiredLogs();

    const config = vscode.workspace.getConfiguration('cursorSecurity');
    const enabled = config.get<boolean>('enabled', true);

    if (!enabled) {
        logger.warn(MODULE, 'Cursor Shield is disabled by configuration');
        vscode.window.showWarningMessage(
            '[Cursor Shield] 安全监控已被配置禁用。如需启用，请将 cursorSecurity.enabled 设为 true。'
        );
        return;
    }

    leakStatusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        997
    );
    leakStatusBarItem.command = 'cursorSecurity.showDashboard';
    leakStatusBarItem.tooltip = 'Cursor Shield - 敏感信息检测状态';
    leakStatusBarItem.show();
    updateLeakStatusBar();

    const accountDisposables = registerAccountMonitor(context);
    allDisposables.push(...accountDisposables);
    context.subscriptions.push(...accountDisposables);
    logger.info(MODULE, 'Account monitor registered');

    const gitDisposables = registerGitMonitor(context);
    allDisposables.push(...gitDisposables);
    context.subscriptions.push(...gitDisposables);
    logger.info(MODULE, 'Git monitor registered');

    const mcpSkillDisposables = registerMCPSkillMonitor(context);
    allDisposables.push(...mcpSkillDisposables);
    context.subscriptions.push(...mcpSkillDisposables);
    logger.info(MODULE, 'MCP/Skill monitor registered');

    const terminalDisposables = registerTerminalMonitor(context);
    allDisposables.push(...terminalDisposables);
    context.subscriptions.push(...terminalDisposables);
    logger.info(MODULE, 'Terminal monitor registered');

    const decoratorDisposables = registerDecorator(context);
    allDisposables.push(...decoratorDisposables);
    context.subscriptions.push(...decoratorDisposables);
    logger.info(MODULE, 'Editor decorator registered');

    const preCommitDisposables = registerPreCommitHooks(context);
    allDisposables.push(...preCommitDisposables);
    context.subscriptions.push(...preCommitDisposables);
    logger.info(MODULE, 'Pre-commit hooks registered');

    const antiTamperDisposables = registerAntiTamper(context);
    allDisposables.push(...antiTamperDisposables);
    context.subscriptions.push(...antiTamperDisposables);
    logger.info(MODULE, 'Anti-tamper protection registered');

    const heartbeatDisposables = registerHeartbeat(context);
    allDisposables.push(...heartbeatDisposables);
    context.subscriptions.push(...heartbeatDisposables);
    logger.info(MODULE, 'Heartbeat module registered');

    const dashboardDisposables = registerDashboard(context);
    allDisposables.push(...dashboardDisposables);
    context.subscriptions.push(...dashboardDisposables);
    logger.info(MODULE, 'Dashboard registered');

    registerCommands(context);

    const dashboardRefreshInterval = setInterval(() => {
        updateLeakStatusBar();
        refreshDashboard();
    }, 10000);
    context.subscriptions.push({ dispose: () => clearInterval(dashboardRefreshInterval) });

    const leakCheckListener = vscode.workspace.onDidSaveTextDocument(() => {
        updateLeakStatusBar();
        refreshDashboard();
    });
    context.subscriptions.push(leakCheckListener);

    const editorSwitchListener = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && editor.document.uri.scheme === 'file') {
            updateLeakStatusBar();
        }
    });
    context.subscriptions.push(editorSwitchListener);

    let editorChangeTimer: NodeJS.Timeout | null = null;
    const editorChangeListener = vscode.workspace.onDidChangeTextDocument(e => {
        if (e.document.uri.scheme !== 'file') {
            return;
        }
        if (editorChangeTimer) {
            clearTimeout(editorChangeTimer);
        }
        editorChangeTimer = setTimeout(() => {
            updateLeakStatusBar();
        }, 800);
    });
    context.subscriptions.push(editorChangeListener);
    context.subscriptions.push({ dispose: () => { if (editorChangeTimer) { clearTimeout(editorChangeTimer); } } });

    updateLeakStatusBar();
    refreshDashboard();

    (async () => {
        try {
            clearScanCache();
            const summary = await scanWorkspace();
            updateLeakStatusBar();
            refreshDashboard();
            const provider = getDashboardProvider();
            if (provider) {
                provider.notifyScanComplete();
            }
            logger.info(MODULE, `Auto-scan complete: ${summary.totalMatches} matches`);
        } catch (err) {
            logger.error(MODULE, `Auto-scan failed: ${err}`);
        }
    })();

    logger.info(MODULE, '========================================');
    logger.info(MODULE, 'Cursor Shield activated successfully');
    logger.info(MODULE, '========================================');

    vscode.window.showInformationMessage('[Cursor Shield] 企业安全监控已启动 🛡️');
}

export function deactivate() {
    logger.info(MODULE, 'Cursor Shield deactivating...');
    logger.close();

    const { deactivate: antiTamperDeactivate } = require('./protection/antiTamper');
    if (typeof antiTamperDeactivate === 'function') {
        antiTamperDeactivate();
    }
}

function updateLeakStatusBar(): void {
    const hasLeak = hasLeakDetected();
    const leakMatches = getLastLeakMatches();
    const scanSummary = getLastScanSummary();
    const activeStats = getActiveEditorStats();

    if (hasLeak && leakMatches.length > 0) {
        leakStatusBarItem.text = `$(error) Leaks:${leakMatches.length}`;
        leakStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        leakStatusBarItem.tooltip = `检测到 ${leakMatches.length} 处敏感信息泄露 - 上次操作已被阻断`;
    } else if (scanSummary && scanSummary.totalMatches > 0) {
        leakStatusBarItem.text = `$(warning) Leaks:${scanSummary.totalMatches}`;
        leakStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        leakStatusBarItem.tooltip = `最近扫描发现 ${scanSummary.totalMatches} 处敏感信息`;
    } else if (activeStats.matchCount > 0) {
        leakStatusBarItem.text = `$(warning) Leaks:${activeStats.matchCount}`;
        leakStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        leakStatusBarItem.tooltip = `当前文件检测到 ${activeStats.matchCount} 处敏感信息 (Critical: ${activeStats.criticalCount}, High: ${activeStats.highCount})`;
    } else {
        leakStatusBarItem.text = '$(shield) Leaks:0';
        leakStatusBarItem.backgroundColor = undefined;
        leakStatusBarItem.tooltip = '敏感信息检测：安全';
    }
}

function registerCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('cursorSecurity._refreshStatusBar', () => {
            updateLeakStatusBar();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('cursorSecurity.scanNow', async () => {
            logger.info(MODULE, 'Manual scan triggered');

            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Cursor Shield: 正在扫描敏感信息...',
                cancellable: true
            }, async (progress, token) => {
                clearScanCache();

                const summary = await scanWorkspace();

                if (token.isCancellationRequested) {
                    return;
                }

                updateLeakStatusBar();
                refreshDashboard();

                const provider = getDashboardProvider();
                if (provider) {
                    provider.notifyScanComplete();
                }

                if (summary.totalMatches === 0) {
                    vscode.window.showInformationMessage(
                        `[Cursor Shield] ✅ 未发现敏感信息`
                    );
                } else {
                    const critical = summary.matchesBySeverity['critical'] || 0;
                    const high = summary.matchesBySeverity['high'] || 0;

                    vscode.window.showWarningMessage(
                        `[Cursor Shield] ⚠️ ${summary.totalMatches} 处敏感信息 (Critical: ${critical} / High: ${high})`,
                        '查看详情'
                    ).then(choice => {
                        if (choice === '查看详情') {
                            vscode.commands.executeCommand('cursorSecurity.showDashboard');
                        }
                    });
                }
            });
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('cursorSecurity.exportLogs', async () => {
            const allLogs = logger.readAllLogs();

            if (allLogs.length === 0) {
                vscode.window.showInformationMessage('[Cursor Shield] 暂无日志可导出');
                return;
            }

            const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
            const defaultUri = vscode.Uri.file(
                path.join(logger.getLogDir(), `cursor-shield-export-${timestamp}.log`)
            );

            const uri = await vscode.window.showSaveDialog({
                defaultUri,
                filters: { 'Log Files': ['log'], 'All Files': ['*'] }
            });

            if (!uri) {
                return;
            }

            const scanSummary = getLastScanSummary();
            const leakMatches = getLastLeakMatches();
            const hasLeak = hasLeakDetected();
            const activeStats = getActiveEditorStats();

            const header = [
                '======================================================================',
                '  Cursor Shield - 日志导出',
                '======================================================================',
                `  导出时间 : ${new Date().toLocaleString('zh-CN')}`,
                `  日志条数 : ${allLogs.length}`,
                '',
                '--- 检测摘要 ---',
            ];

            if (scanSummary) {
                header.push(`  最近扫描 : ${scanSummary.totalMatches} 处匹配 (扫描 ${scanSummary.scannedFiles} 个文件, 耗时 ${(scanSummary.duration / 1000).toFixed(1)}s)`);
                const sev = scanSummary.matchesBySeverity;
                header.push(`  严重程度 : critical=${sev['critical'] || 0}, high=${sev['high'] || 0}, medium=${sev['medium'] || 0}, low=${sev['low'] || 0}`);
                if (scanSummary.matches.length > 0) {
                    header.push('  匹配详情 :');
                    for (const m of scanSummary.matches.slice(0, 50)) {
                        header.push(`    [${m.rule.severity}] ${m.file}:${m.line}:${m.column} - ${m.rule.id} - ${m.masked}`);
                    }
                    if (scanSummary.matches.length > 50) {
                        header.push(`    ... 还有 ${scanSummary.matches.length - 50} 处`);
                    }
                }
            } else {
                header.push('  最近扫描 : 尚未执行');
            }

            if (hasLeak) {
                header.push(`  阻断记录 : ${leakMatches.length} 处`);
                for (const m of leakMatches.slice(0, 20)) {
                    header.push(`    [${m.rule.severity}] ${m.file}:${m.line}:${m.column} - ${m.rule.id} - ${m.masked}`);
                }
            }

            if (activeStats.matchCount > 0) {
                header.push(`  当前文件 : ${activeStats.fileName} (${activeStats.matchCount} 处, critical=${activeStats.criticalCount}, high=${activeStats.highCount})`);
            }

            header.push('');
            header.push('======================================================================');
            header.push('');

            const content = header.join('\n') + allLogs.join('\n');

            fs.writeFileSync(uri.fsPath, content, 'utf-8');
            vscode.window.showInformationMessage(
                `[Cursor Shield] 日志已导出：${uri.fsPath} (${allLogs.length} 条)`
            );
            logger.info(MODULE, `Logs exported to: ${uri.fsPath}`);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('cursorSecurity.showDashboard', () => {
            vscode.commands.executeCommand('workbench.view.extension.cursorShield');
            refreshDashboard();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('cursorSecurity.reloadConfig', () => {
            logger.info(MODULE, 'Configuration reload requested');

            const config = vscode.workspace.getConfiguration('cursorSecurity');
            const enabled = config.get<boolean>('enabled', true);

            updateLeakStatusBar();
            refreshDashboard();

            vscode.window.showInformationMessage(
                `[Cursor Shield] 配置已重新加载（安全监控：${enabled ? '已启用' : '已禁用'}）`
            );
        })
    );
}