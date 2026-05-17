import * as vscode from 'vscode';
import * as fs from 'fs';
import { scanContent, scanFile, formatMatchMessage } from './engine';
import { MatchResult } from './rules';
import * as logger from '../utils/logger';

const MODULE = 'PreCommit';

interface GitRepository {
    rootUri: vscode.Uri;
    state: {
        index: {
            changes: Array<{
                uri: vscode.Uri;
                status: number;
            }>;
        };
        workingTreeChanges: Array<{
            uri: vscode.Uri;
            status: number;
        }>;
    };
    diffIndexWithHEAD(): Promise<GitDiff[]>;
}

interface GitDiff {
    uri: vscode.Uri;
    diff: string;
}

interface GitAPI {
    repositories: GitRepository[];
    getRepository(uri: vscode.Uri): GitRepository | null;
}

let leakDetected: boolean = false;
let lastLeakMatches: MatchResult[] = [];
let gitApi: GitAPI | null = null;
let gitApiReady = false;

async function initGitApi(): Promise<GitAPI | null> {
    if (gitApiReady && gitApi) {
        return gitApi;
    }

    try {
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (!gitExtension) {
            return null;
        }

        if (!gitExtension.isActive) {
            await gitExtension.activate();
        }

        gitApi = gitExtension.exports.getAPI(1);
        gitApiReady = true;
        return gitApi;
    } catch {
        return null;
    }
}

function parseDiffForNewLines(diff: string): Array<{ oldLine: number; newLine: number; content: string }> {
    const hunks: Array<{ oldLine: number; newLine: number; content: string }> = [];
    const lines = diff.split('\n');

    let currentNewLine = 0;

    for (const line of lines) {
        if (line.startsWith('@@')) {
            const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
            if (match) {
                currentNewLine = parseInt(match[1], 10) - 1;
            }
            continue;
        }

        if (line.startsWith('+') && !line.startsWith('+++')) {
            currentNewLine++;
            hunks.push({
                oldLine: 0,
                newLine: currentNewLine,
                content: line.substring(1)
            });
        } else if (!line.startsWith('-') && !line.startsWith('---')) {
            currentNewLine++;
        }
    }

    return hunks;
}

async function scanStagedChanges(repo: GitRepository): Promise<MatchResult[]> {
    const allMatches: MatchResult[] = [];

    try {
        const diffs = await repo.diffIndexWithHEAD();

        for (const diff of diffs) {
            const hunks = parseDiffForNewLines(diff.diff);

            if (hunks.length === 0) {
                continue;
            }

            const content = hunks.map(h => h.content).join('\n');
            const fileName = diff.uri.fsPath.replace(/\\/g, '/').split('/').pop() || diff.uri.fsPath;

            let matches: MatchResult[];

            if (fs.existsSync(diff.uri.fsPath)) {
                matches = await scanFile(diff.uri.fsPath, { includeEntropy: true });
            } else {
                matches = scanContent(content, fileName, { includeEntropy: true });
            }

            const relevantMatches = matches.filter(m => {
                return hunks.some(h => h.newLine === m.line);
            });

            allMatches.push(...relevantMatches);
        }
    } catch (err) {
        logger.warn(MODULE, `Failed to scan staged changes: ${err}`);
    }

    return allMatches;
}

async function scanFileContent(filePath: string): Promise<MatchResult[]> {
    return scanFile(filePath, { includeEntropy: true });
}

function showLeakDialog(matches: MatchResult[], operation: string): void {
    const criticalCount = matches.filter(m => m.rule.severity === 'critical').length;
    const highCount = matches.filter(m => m.rule.severity === 'high').length;

    const message = [
        `[Cursor Shield] 在 ${operation} 时检测到 ${matches.length} 处敏感信息！`,
        `  🔴 Critical: ${criticalCount}`,
        `  🟠 High: ${highCount}`,
        '',
        ...matches.slice(0, 10).map(m => formatMatchMessage(m)),
        matches.length > 10 ? `  ... 还有 ${matches.length - 10} 处匹配` : ''
    ].join('\n');

    vscode.window.showErrorMessage(message, { modal: true }, '我知道了').then(() => {
        logger.warn(MODULE, `Sensitive info blocked during ${operation}: ${matches.length} matches`);
    });
}

export function getLastLeakMatches(): MatchResult[] {
    return [...lastLeakMatches];
}

export function hasLeakDetected(): boolean {
    return leakDetected;
}

export function clearLeakState(): void {
    leakDetected = false;
    lastLeakMatches = [];
}

export function registerPreCommitHooks(context: vscode.ExtensionContext): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];
    const config = vscode.workspace.getConfiguration('cursorSecurity');

    const saveListener = vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (!config.get<boolean>('enabled', true)) {
            return;
        }

        if (document.uri.scheme !== 'file') {
            return;
        }

        try {
            const matches = await scanFileContent(document.uri.fsPath);

            if (matches.length > 0) {
                leakDetected = true;
                lastLeakMatches = matches;
                logger.warn(MODULE, `Sensitive info detected on save: ${document.fileName} (${matches.length} match(es))`);

                const criticalCount = matches.filter(m => m.rule.severity === 'critical').length;

                if (criticalCount > 0) {
                    vscode.window.showWarningMessage(
                        `[Cursor Shield] 保存的文件包含 ${criticalCount} 处高危敏感信息：${document.fileName}`,
                        '查看详情'
                    ).then(choice => {
                        if (choice === '查看详情') {
                            showLeakDialog(matches, '文件保存');
                        }
                    });
                }
            } else {
                leakDetected = false;
            }
        } catch (err) {
            logger.error(MODULE, `Save scan failed: ${err}`);
        }
    });
    disposables.push(saveListener);

    const commitCheckCommand = vscode.commands.registerCommand('cursorSecurity.checkBeforeCommit', async () => {
        if (!config.get<boolean>('enabled', true) || !config.get<boolean>('blockCommitOnLeak', true)) {
            return true;
        }

        const api = await initGitApi();
        if (!api || api.repositories.length === 0) {
            return true;
        }

        try {
            const repo = api.repositories[0];
            logger.info(MODULE, 'Scanning staged changes before commit...');

            const matches = await scanStagedChanges(repo);

            if (matches.length > 0) {
                leakDetected = true;
                lastLeakMatches = matches;
                showLeakDialog(matches, 'Git 提交');
                logger.warn(MODULE, `Commit blocked: ${matches.length} sensitive info match(es)`);
                return false;
            }

            leakDetected = false;
            logger.info(MODULE, 'Pre-commit scan passed');
        } catch (err) {
            logger.error(MODULE, `Pre-commit scan failed: ${err}`);
        }

        return true;
    });
    disposables.push(commitCheckCommand);

    const stageCheckCommand = vscode.commands.registerCommand('cursorSecurity.checkBeforeStage', async () => {
        if (!config.get<boolean>('enabled', true) || !config.get<boolean>('blockCommitOnLeak', true)) {
            return true;
        }

        const api = await initGitApi();
        if (!api || api.repositories.length === 0) {
            return true;
        }

        const repo = api.repositories[0];
        const workingChanges = repo.state.workingTreeChanges || [];

        const matches: MatchResult[] = [];
        for (const change of workingChanges) {
            try {
                const fileMatches = await scanFileContent(change.uri.fsPath);
                matches.push(...fileMatches);
            } catch { /* skip */ }
        }

        if (matches.length > 0) {
            leakDetected = true;
            lastLeakMatches = matches;
            showLeakDialog(matches, 'Git 暂存');
            logger.warn(MODULE, `Stage blocked: ${matches.length} sensitive info match(es)`);
            return false;
        }

        return true;
    });
    disposables.push(stageCheckCommand);

    return disposables;
}