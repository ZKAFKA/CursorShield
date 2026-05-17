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
exports.getLastLeakMatches = getLastLeakMatches;
exports.hasLeakDetected = hasLeakDetected;
exports.clearLeakState = clearLeakState;
exports.registerPreCommitHooks = registerPreCommitHooks;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const engine_1 = require("./engine");
const logger = __importStar(require("../utils/logger"));
const MODULE = 'PreCommit';
let leakDetected = false;
let lastLeakMatches = [];
let gitApi = null;
let gitApiReady = false;
async function initGitApi() {
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
    }
    catch {
        return null;
    }
}
function parseDiffForNewLines(diff) {
    const hunks = [];
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
        }
        else if (!line.startsWith('-') && !line.startsWith('---')) {
            currentNewLine++;
        }
    }
    return hunks;
}
async function scanStagedChanges(repo) {
    const allMatches = [];
    try {
        const diffs = await repo.diffIndexWithHEAD();
        for (const diff of diffs) {
            const hunks = parseDiffForNewLines(diff.diff);
            if (hunks.length === 0) {
                continue;
            }
            const content = hunks.map(h => h.content).join('\n');
            const fileName = diff.uri.fsPath.replace(/\\/g, '/').split('/').pop() || diff.uri.fsPath;
            let matches;
            if (fs.existsSync(diff.uri.fsPath)) {
                matches = await (0, engine_1.scanFile)(diff.uri.fsPath, { includeEntropy: true });
            }
            else {
                matches = (0, engine_1.scanContent)(content, fileName, { includeEntropy: true });
            }
            const relevantMatches = matches.filter(m => {
                return hunks.some(h => h.newLine === m.line);
            });
            allMatches.push(...relevantMatches);
        }
    }
    catch (err) {
        logger.warn(MODULE, `Failed to scan staged changes: ${err}`);
    }
    return allMatches;
}
async function scanFileContent(filePath) {
    return (0, engine_1.scanFile)(filePath, { includeEntropy: true });
}
function showLeakDialog(matches, operation) {
    const criticalCount = matches.filter(m => m.rule.severity === 'critical').length;
    const highCount = matches.filter(m => m.rule.severity === 'high').length;
    const message = [
        `[Cursor Shield] 在 ${operation} 时检测到 ${matches.length} 处敏感信息！`,
        `  🔴 Critical: ${criticalCount}`,
        `  🟠 High: ${highCount}`,
        '',
        ...matches.slice(0, 10).map(m => (0, engine_1.formatMatchMessage)(m)),
        matches.length > 10 ? `  ... 还有 ${matches.length - 10} 处匹配` : ''
    ].join('\n');
    vscode.window.showErrorMessage(message, { modal: true }, '我知道了').then(() => {
        logger.warn(MODULE, `Sensitive info blocked during ${operation}: ${matches.length} matches`);
    });
}
function getLastLeakMatches() {
    return [...lastLeakMatches];
}
function hasLeakDetected() {
    return leakDetected;
}
function clearLeakState() {
    leakDetected = false;
    lastLeakMatches = [];
}
function registerPreCommitHooks(context) {
    const disposables = [];
    const config = vscode.workspace.getConfiguration('cursorSecurity');
    const saveListener = vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (!config.get('enabled', true)) {
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
                    vscode.window.showWarningMessage(`[Cursor Shield] 保存的文件包含 ${criticalCount} 处高危敏感信息：${document.fileName}`, '查看详情').then(choice => {
                        if (choice === '查看详情') {
                            showLeakDialog(matches, '文件保存');
                        }
                    });
                }
            }
            else {
                leakDetected = false;
            }
        }
        catch (err) {
            logger.error(MODULE, `Save scan failed: ${err}`);
        }
    });
    disposables.push(saveListener);
    const commitCheckCommand = vscode.commands.registerCommand('cursorSecurity.checkBeforeCommit', async () => {
        if (!config.get('enabled', true) || !config.get('blockCommitOnLeak', true)) {
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
        }
        catch (err) {
            logger.error(MODULE, `Pre-commit scan failed: ${err}`);
        }
        return true;
    });
    disposables.push(commitCheckCommand);
    const stageCheckCommand = vscode.commands.registerCommand('cursorSecurity.checkBeforeStage', async () => {
        if (!config.get('enabled', true) || !config.get('blockCommitOnLeak', true)) {
            return true;
        }
        const api = await initGitApi();
        if (!api || api.repositories.length === 0) {
            return true;
        }
        const repo = api.repositories[0];
        const workingChanges = repo.state.workingTreeChanges || [];
        const matches = [];
        for (const change of workingChanges) {
            try {
                const fileMatches = await scanFileContent(change.uri.fsPath);
                matches.push(...fileMatches);
            }
            catch { /* skip */ }
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
//# sourceMappingURL=preCommit.js.map