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
exports.createStatusBarItem = createStatusBarItem;
exports.getStatusBarItem = getStatusBarItem;
exports.scanMCPSkills = scanMCPSkills;
exports.getCurrentStatus = getCurrentStatus;
exports.registerMCPSkillMonitor = registerMCPSkillMonitor;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger = __importStar(require("../utils/logger"));
const MODULE = 'MCPSkill';
let currentStatus = {
    mcps: [],
    skills: [],
    mcpCount: 0,
    skillCount: 0,
    unauthorizedMCPs: 0,
    unauthorizedSkills: 0,
    checked: false
};
let statusBarItem = null;
function getWorkspaceRoot() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return null;
    }
    return folders[0].uri.fsPath;
}
function maskEnvValue(value) {
    if (!value) {
        return '***';
    }
    if (value.length <= 4) {
        return '****';
    }
    return value.substring(0, 2) + '****' + value.substring(value.length - 2);
}
function parseMCPConfig(workspaceRoot) {
    const mcpJsonPath = path.join(workspaceRoot, '.cursor', 'mcp.json');
    if (!fs.existsSync(mcpJsonPath)) {
        logger.info(MODULE, `MCP config not found at: ${mcpJsonPath}`);
        return [];
    }
    try {
        const content = fs.readFileSync(mcpJsonPath, 'utf-8');
        const config = JSON.parse(content);
        if (!config.mcpServers || typeof config.mcpServers !== 'object') {
            logger.warn(MODULE, 'mcp.json has no mcpServers field');
            return [];
        }
        const config2 = vscode.workspace.getConfiguration('cursorSecurity');
        const blockedMCPs = config2.get('blockedMCPs') || [];
        const mcps = [];
        for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
            const cfg = serverConfig;
            const command = String(cfg.command || 'unknown');
            const args = Array.isArray(cfg.args) ? cfg.args.map(String) : [];
            const env = cfg.env || {};
            const envKeys = Object.keys(env);
            const isBlocked = blockedMCPs.includes(name);
            const isAuthorized = !isBlocked && (blockedMCPs.length === 0 || !blockedMCPs.includes(name));
            mcps.push({
                name,
                command,
                args,
                envKeys,
                isBlocked,
                isAuthorized
            });
        }
        logger.info(MODULE, `Found ${mcps.length} MCP server(s)`);
        return mcps;
    }
    catch (err) {
        logger.error(MODULE, `Failed to parse MCP config: ${err}`);
        return [];
    }
}
function parseSkills(workspaceRoot) {
    const skillsDir = path.join(workspaceRoot, '.cursor', 'skills');
    if (!fs.existsSync(skillsDir)) {
        logger.info(MODULE, `Skills directory not found at: ${skillsDir}`);
        return [];
    }
    try {
        const config = vscode.workspace.getConfiguration('cursorSecurity');
        const allowedSkills = config.get('allowedSkills') || [];
        const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
        const skills = [];
        for (const entry of entries) {
            if (!entry.isDirectory()) {
                continue;
            }
            const skillDir = path.join(skillsDir, entry.name);
            const skillJsonPath = path.join(skillDir, 'skill.json');
            let name = entry.name;
            let description = '';
            if (fs.existsSync(skillJsonPath)) {
                try {
                    const content = fs.readFileSync(skillJsonPath, 'utf-8');
                    const skillDef = JSON.parse(content);
                    if (skillDef.name) {
                        name = skillDef.name;
                    }
                    if (skillDef.description) {
                        description = skillDef.description;
                    }
                }
                catch {
                    logger.warn(MODULE, `Failed to parse skill.json in: ${skillDir}`);
                }
            }
            const isAuthorized = allowedSkills.length === 0 || allowedSkills.includes(name);
            skills.push({
                name,
                description,
                path: skillDir,
                isAuthorized
            });
        }
        logger.info(MODULE, `Found ${skills.length} Skill(s)`);
        return skills;
    }
    catch (err) {
        logger.error(MODULE, `Failed to scan skills: ${err}`);
        return [];
    }
}
function createStatusBarItem() {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 998);
    statusBarItem.command = 'cursorSecurity.showDashboard';
    statusBarItem.show();
    return statusBarItem;
}
function getStatusBarItem() {
    return statusBarItem;
}
async function scanMCPSkills() {
    logger.info(MODULE, 'Scanning MCP and Skill configurations...');
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        currentStatus = {
            mcps: [],
            skills: [],
            mcpCount: 0,
            skillCount: 0,
            unauthorizedMCPs: 0,
            unauthorizedSkills: 0,
            checked: true,
            error: 'No workspace folder open'
        };
        updateStatusBar();
        return currentStatus;
    }
    const mcps = parseMCPConfig(workspaceRoot);
    const skills = parseSkills(workspaceRoot);
    const unauthorizedMCPs = mcps.filter(m => !m.isAuthorized).length;
    const unauthorizedSkills = skills.filter(s => !s.isAuthorized).length;
    currentStatus = {
        mcps,
        skills,
        mcpCount: mcps.length,
        skillCount: skills.length,
        unauthorizedMCPs,
        unauthorizedSkills,
        checked: true
    };
    if (unauthorizedMCPs > 0) {
        const blockedNames = mcps.filter(m => !m.isAuthorized).map(m => m.name).join(', ');
        logger.warn(MODULE, `Found ${unauthorizedMCPs} unauthorized MCP(s): ${blockedNames}`);
        vscode.window.showWarningMessage(`[Cursor Shield] 发现 ${unauthorizedMCPs} 个未授权的 MCP 服务：${blockedNames}`);
    }
    if (unauthorizedSkills > 0) {
        const unapproved = skills.filter(s => !s.isAuthorized).map(s => s.name).join(', ');
        logger.warn(MODULE, `Found ${unauthorizedSkills} unauthorized Skill(s): ${unapproved}`);
    }
    updateStatusBar();
    return currentStatus;
}
function updateStatusBar() {
    if (!statusBarItem) {
        return;
    }
    if (!currentStatus.checked) {
        statusBarItem.text = '$(extensions) Scanning...';
        statusBarItem.backgroundColor = undefined;
        return;
    }
    const mcpIcon = currentStatus.unauthorizedMCPs > 0 ? '$(warning)' : '$(check)';
    const skillIcon = currentStatus.unauthorizedSkills > 0 ? '$(warning)' : '$(check)';
    statusBarItem.text = `${mcpIcon} M:${currentStatus.mcpCount} ${skillIcon} S:${currentStatus.skillCount}`;
    statusBarItem.tooltip = [
        `MCP 服务: ${currentStatus.mcpCount} (${currentStatus.unauthorizedMCPs} 未授权)`,
        `Skills: ${currentStatus.skillCount} (${currentStatus.unauthorizedSkills} 未授权)`
    ].join('\n');
    if (currentStatus.unauthorizedMCPs > 0 || currentStatus.unauthorizedSkills > 0) {
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
    else {
        statusBarItem.backgroundColor = undefined;
    }
}
function getCurrentStatus() {
    return {
        ...currentStatus,
        mcps: currentStatus.mcps.map(m => ({ ...m })),
        skills: currentStatus.skills.map(s => ({ ...s }))
    };
}
function registerMCPSkillMonitor(context) {
    const disposables = [];
    createStatusBarItem();
    disposables.push(statusBarItem);
    scanMCPSkills();
    const configListener = vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('cursorSecurity.blockedMCPs') ||
            e.affectsConfiguration('cursorSecurity.allowedSkills')) {
            logger.info(MODULE, 'MCP/Skill config changed, re-scanning...');
            scanMCPSkills();
        }
    });
    disposables.push(configListener);
    const mcpFileWatcher = vscode.workspace.createFileSystemWatcher('**/.cursor/mcp.json');
    mcpFileWatcher.onDidChange(() => scanMCPSkills());
    mcpFileWatcher.onDidCreate(() => scanMCPSkills());
    mcpFileWatcher.onDidDelete(() => scanMCPSkills());
    disposables.push(mcpFileWatcher);
    const skillsFileWatcher = vscode.workspace.createFileSystemWatcher('**/.cursor/skills/**/skill.json');
    skillsFileWatcher.onDidChange(() => scanMCPSkills());
    skillsFileWatcher.onDidCreate(() => scanMCPSkills());
    skillsFileWatcher.onDidDelete(() => scanMCPSkills());
    disposables.push(skillsFileWatcher);
    const refreshCommand = vscode.commands.registerCommand('cursorSecurity._refreshMCPSkill', () => scanMCPSkills());
    disposables.push(refreshCommand);
    return disposables;
}
//# sourceMappingURL=mcpSkill.js.map