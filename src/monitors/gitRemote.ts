import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import * as logger from '../utils/logger';

const MODULE = 'GitRemote';

interface GitAPI {
    repositories: Repository[];
    onDidOpenRepository: vscode.Event<Repository>;
    onDidCloseRepository: vscode.Event<Repository>;
}

interface Repository {
    rootUri: vscode.Uri;
    state: RepositoryState;
    inputBox: { value: string };
}

interface RepositoryState {
    HEAD: { name: string } | undefined;
    remotes: Remote[];
    onDidChange: vscode.Event<void>;
}

interface Remote {
    name: string;
    fetchUrl?: string;
    pushUrl?: string;
}

export interface GitRepoStatus {
    repoPath: string | null;
    originUrl: string | null;
    isCompliant: boolean;
    reason: string;
    checked: boolean;
}

let currentStatus: GitRepoStatus = {
    repoPath: null,
    originUrl: null,
    isCompliant: false,
    reason: 'Not checked yet',
    checked: false
};

let statusBarItem: vscode.StatusBarItem | null = null;
let gitApi: GitAPI | null = null;
let apiReady = false;

const GIT_EXTENSION_IDS = [
    'vscode.git',
    'cursor.git',
    'built-in.git'
];

async function initGitApi(): Promise<void> {
    if (apiReady && gitApi) {
        return;
    }

    for (const extId of GIT_EXTENSION_IDS) {
        try {
            const gitExtension = vscode.extensions.getExtension(extId);
            if (gitExtension) {
                logger.info(MODULE, `Found Git extension: ${extId}`);

                if (!gitExtension.isActive) {
                    logger.info(MODULE, `Activating Git extension: ${extId}...`);
                    await gitExtension.activate();
                }

                gitApi = gitExtension.exports.getAPI(1);
                apiReady = true;
                logger.info(MODULE, `Git API ready via ${extId}, repos: ${gitApi?.repositories?.length ?? 0}`);
                return;
            }
        } catch (err) {
            logger.warn(MODULE, `Failed to init Git API via ${extId}: ${err}`);
        }
    }

    logger.warn(MODULE, 'No Git extension found via any known ID');
}

function getWorkspaceRoot(): string | null {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return null;
    }
    return folders[0].uri.fsPath;
}

function isGitRepo(dirPath: string): boolean {
    return fs.existsSync(path.join(dirPath, '.git'));
}

function getGitRemoteUrl(repoPath: string): string | null {
    try {
        const result = cp.execSync('git remote get-url origin', {
            cwd: repoPath,
            encoding: 'utf-8',
            timeout: 5000,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        return result.trim() || null;
    } catch {
        try {
            const result = cp.execSync('git remote -v', {
                cwd: repoPath,
                encoding: 'utf-8',
                timeout: 5000,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            const lines = result.trim().split('\n');
            const originLine = lines.find(l => l.startsWith('origin') && l.includes('(fetch)'));
            if (originLine) {
                const match = originLine.match(/origin\s+(\S+)/);
                return match ? match[1] : null;
            }
        } catch {
            // fallback failed too
        }
        return null;
    }
}

function extractRepoName(url: string): string {
    try {
        const cleaned = url
            .replace(/^https?:\/\//, '')
            .replace(/^git@/, '')
            .replace(/\.git$/, '')
            .replace(/:+/g, '/');

        const parts = cleaned.split('/');
        if (parts.length >= 2) {
            return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
        }
        return cleaned;
    } catch {
        return url;
    }
}

function checkRepoCompliance(url: string | null, allowedRepos: string[]): boolean {
    if (!url) {
        return false;
    }
    if (allowedRepos.length === 0) {
        return true;
    }
    return allowedRepos.some(pattern => {
        try {
            const regex = new RegExp(pattern);
            return regex.test(url);
        } catch {
            logger.warn(MODULE, `Invalid regex pattern: ${pattern}`);
            return false;
        }
    });
}

function getOriginUrl(repo: Repository): string | null {
    try {
        const origin = repo.state.remotes.find(r => r.name === 'origin');
        return origin?.fetchUrl || origin?.pushUrl || null;
    } catch {
        return null;
    }
}

export function createStatusBarItem(): vscode.StatusBarItem {
    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        999
    );
    statusBarItem.command = 'cursorSecurity.showDashboard';
    statusBarItem.show();
    return statusBarItem;
}

export function getStatusBarItem(): vscode.StatusBarItem | null {
    return statusBarItem;
}

export async function checkGitRepo(): Promise<GitRepoStatus> {
    logger.info(MODULE, 'Checking Git repository compliance...');

    let originUrl: string | null = null;
    let repoPath: string | null = null;

    await initGitApi();

    if (gitApi && gitApi.repositories.length > 0) {
        const repo = gitApi.repositories[0];
        originUrl = getOriginUrl(repo);
        repoPath = repo.rootUri?.fsPath || null;
        logger.info(MODULE, `Git API: found repo at ${repoPath}, origin: ${originUrl || 'none'}`);
    }

    if (!originUrl) {
        const wsRoot = getWorkspaceRoot();
        if (wsRoot && isGitRepo(wsRoot)) {
            repoPath = wsRoot;
            originUrl = getGitRemoteUrl(wsRoot);
            logger.info(MODULE, `FS fallback: found .git at ${wsRoot}, origin: ${originUrl || 'none'}`);
        }
    }

    if (!originUrl) {
        const wsRoot = getWorkspaceRoot();
        if (wsRoot) {
            const parentDir = path.dirname(wsRoot);
            if (isGitRepo(parentDir)) {
                repoPath = parentDir;
                originUrl = getGitRemoteUrl(parentDir);
                logger.info(MODULE, `Parent dir fallback: found .git at ${parentDir}, origin: ${originUrl || 'none'}`);
            }
        }
    }

    const config = vscode.workspace.getConfiguration('cursorSecurity');
    const allowedRepos: string[] = config.get('allowedRepos') || [];

    if (!originUrl && !repoPath) {
        currentStatus = {
            repoPath: null,
            originUrl: null,
            isCompliant: false,
            reason: 'No Git repository found',
            checked: true
        };
    } else if (!originUrl) {
        currentStatus = {
            repoPath,
            originUrl: null,
            isCompliant: true,
            reason: 'Git repository found but no origin remote configured',
            checked: true
        };
    } else {
        const isCompliant = checkRepoCompliance(originUrl, allowedRepos);
        currentStatus = {
            repoPath,
            originUrl,
            isCompliant,
            reason: isCompliant
                ? `Repository "${extractRepoName(originUrl)}" is in the allowed list`
                : `Repository "${extractRepoName(originUrl)}" is NOT in the allowed list`,
            checked: true
        };
    }

    if (currentStatus.originUrl && !currentStatus.isCompliant) {
        logger.warn(MODULE, `Unauthorized repository: ${currentStatus.originUrl}`);
    } else if (currentStatus.originUrl) {
        logger.info(MODULE, `Git repo compliant: ${currentStatus.originUrl}`);
    } else {
        logger.info(MODULE, `Git check result: ${currentStatus.reason}`);
    }

    updateStatusBar();
    return currentStatus;
}

function updateStatusBar(): void {
    if (!statusBarItem) {
        return;
    }

    if (!currentStatus.checked) {
        statusBarItem.text = '$(git-branch) Checking...';
        statusBarItem.backgroundColor = undefined;
        return;
    }

    if (!currentStatus.originUrl) {
        if (currentStatus.repoPath) {
            statusBarItem.text = '$(git-branch) No Origin';
            statusBarItem.backgroundColor = undefined;
            statusBarItem.tooltip = 'Git repository found but no origin remote';
        } else {
            statusBarItem.text = '$(git-branch) No Repo';
            statusBarItem.backgroundColor = undefined;
            statusBarItem.tooltip = 'No Git repository found';
        }
        return;
    }

    const icon = currentStatus.isCompliant ? '$(check)' : '$(warning)';
    const repoName = extractRepoName(currentStatus.originUrl);
    const shortName = repoName.length > 25 ? repoName.substring(0, 22) + '...' : repoName;

    statusBarItem.text = `${icon} ${shortName}`;

    if (!currentStatus.isCompliant) {
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        statusBarItem.tooltip = `[未授权仓库] ${currentStatus.originUrl}\n${currentStatus.reason}`;
    } else {
        statusBarItem.backgroundColor = undefined;
        statusBarItem.tooltip = `[已授权仓库] ${currentStatus.originUrl}`;
    }
}

export function getCurrentStatus(): GitRepoStatus {
    return { ...currentStatus };
}

export function getRemotesWithCompliance(repoPath: string | null, allowedRepos: string[]): Array<{ name: string; url: string; isCompliant: boolean }> {
    if (!repoPath) return [];
    const remotes = snapshotAllRemotes(repoPath);
    const result: Array<{ name: string; url: string; isCompliant: boolean }> = [];
    remotes.forEach((url, name) => {
        let isCompliant = true;
        if (allowedRepos.length > 0) {
            isCompliant = allowedRepos.some(pattern => {
                try { return new RegExp(pattern, 'i').test(url); } catch { return false; }
            });
        }
        result.push({ name, url, isCompliant });
    });
    return result;
}

let knownRemotes: Map<string, string> = new Map();

function snapshotAllRemotes(repoPath: string): Map<string, string> {
    const remotes = new Map<string, string>();
    try {
        const result = cp.execSync('git remote -v', {
            cwd: repoPath,
            encoding: 'utf-8',
            timeout: 5000,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        for (const line of result.trim().split('\n')) {
            const match = line.match(/^(\S+)\s+(\S+)\s+\(fetch\)/);
            if (match) {
                remotes.set(match[1], match[2]);
            }
        }
    } catch {
        // ignore
    }
    return remotes;
}

function checkAllRemotesCompliance(remotes: Map<string, string>, allowedRepos: string[]): string[] {
    if (allowedRepos.length === 0) {
        return [];
    }
    const violations: string[] = [];
    for (const [name, url] of remotes) {
        if (!checkRepoCompliance(url, allowedRepos)) {
            violations.push(`${name}: ${url}`);
        }
    }
    return violations;
}

async function detectRemoteChanges(): Promise<void> {
    const wsRoot = getWorkspaceRoot();
    if (!wsRoot || !isGitRepo(wsRoot)) {
        return;
    }

    const currentRemotes = snapshotAllRemotes(wsRoot);
    const config = vscode.workspace.getConfiguration('cursorSecurity');
    const allowedRepos: string[] = config.get('allowedRepos') || [];

    if (knownRemotes.size > 0) {
        for (const [name, url] of currentRemotes) {
            const oldUrl = knownRemotes.get(name);
            if (oldUrl === undefined) {
                logger.warn(MODULE, `New remote detected: ${name} -> ${url}`);
                const isCompliant = checkRepoCompliance(url, allowedRepos);
                if (!isCompliant && allowedRepos.length > 0) {
                    vscode.window.showWarningMessage(
                        `[Cursor Shield] 检测到新增未授权远程仓库：${name} (${extractRepoName(url)})`,
                        '我知道了'
                    );
                }
            } else if (oldUrl !== url) {
                logger.warn(MODULE, `Remote URL changed: ${name} ${oldUrl} -> ${url}`);
                const isCompliant = checkRepoCompliance(url, allowedRepos);
                if (!isCompliant && allowedRepos.length > 0) {
                    vscode.window.showWarningMessage(
                        `[Cursor Shield] 检测到远程仓库地址变更为未授权仓库：${name} (${extractRepoName(url)})`,
                        '我知道了'
                    );
                }
            }
        }

        for (const [name] of knownRemotes) {
            if (!currentRemotes.has(name)) {
                logger.info(MODULE, `Remote removed: ${name}`);
            }
        }
    }

    knownRemotes = currentRemotes;
}

export function registerGitMonitor(context: vscode.ExtensionContext): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];

    createStatusBarItem();
    disposables.push(statusBarItem!);

    checkGitRepo().then(() => {
        const wsRoot = getWorkspaceRoot();
        if (wsRoot && isGitRepo(wsRoot)) {
            knownRemotes = snapshotAllRemotes(wsRoot);
        }
    });

    const retryAttempts = [1000, 3000, 6000, 10000];

    retryAttempts.forEach((delay) => {
        const timer = setTimeout(async () => {
            if (currentStatus.originUrl) {
                return;
            }
            logger.info(MODULE, `Retry check after ${delay}ms...`);
            apiReady = false;
            gitApi = null;
            await checkGitRepo();
        }, delay);
        disposables.push({ dispose: () => clearTimeout(timer) });
    });

    const gitExtensionReadyListener = vscode.extensions.onDidChange(() => {
        for (const extId of GIT_EXTENSION_IDS) {
            const gitExtension = vscode.extensions.getExtension(extId);
            if (gitExtension && gitExtension.isActive) {
                apiReady = false;
                gitApi = null;
                checkGitRepo();
                break;
            }
        }
    });
    disposables.push(gitExtensionReadyListener);

    const gitConfigWatcher = vscode.workspace.createFileSystemWatcher('**/.git/config');
    gitConfigWatcher.onDidChange(async (uri) => {
        logger.info(MODULE, `.git/config changed: ${uri.fsPath}`);
        await detectRemoteChanges();
        await checkGitRepo();
    });
    gitConfigWatcher.onDidCreate(async (uri) => {
        logger.info(MODULE, `.git/config created: ${uri.fsPath}`);
        await detectRemoteChanges();
        await checkGitRepo();
    });
    disposables.push(gitConfigWatcher);

    const gitRemotesWatcher = vscode.workspace.createFileSystemWatcher('**/.git/config');
    disposables.push(gitRemotesWatcher);

    const remotePollInterval = setInterval(async () => {
        await detectRemoteChanges();
    }, 30000);
    disposables.push({ dispose: () => clearInterval(remotePollInterval) });

    const pushCheckCommand = vscode.commands.registerCommand('cursorSecurity.checkBeforePush', async () => {
        const config = vscode.workspace.getConfiguration('cursorSecurity');
        const blockPush = config.get<boolean>('blockPushOnLeak', true);

        if (!blockPush) {
            return true;
        }

        await initGitApi();

        const wsRoot = getWorkspaceRoot();
        if (!wsRoot || !isGitRepo(wsRoot)) {
            return true;
        }

        const allRemotes = snapshotAllRemotes(wsRoot);
        const allowedRepos: string[] = config.get('allowedRepos') || [];

        if (allowedRepos.length === 0) {
            return true;
        }

        const violations = checkAllRemotesCompliance(allRemotes, allowedRepos);
        if (violations.length > 0) {
            vscode.window.showErrorMessage(
                `[Cursor Shield] 检测到未授权远程仓库，禁止推送：\n${violations.join('\n')}`,
                { modal: true },
                '我知道了'
            );
            logger.warn(MODULE, `Push blocked: unauthorized remotes: ${violations.join(', ')}`);
            return false;
        }

        return true;
    });
    disposables.push(pushCheckCommand);

    const configListener = vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('cursorSecurity.allowedRepos')) {
            logger.info(MODULE, 'Allowed repos config changed, re-checking...');
            checkGitRepo();
        }
    });
    disposables.push(configListener);

    const refreshCommand = vscode.commands.registerCommand(
        'cursorSecurity._refreshGit',
        () => {
            apiReady = false;
            gitApi = null;
            checkGitRepo();
        }
    );
    disposables.push(refreshCommand);

    return disposables;
}