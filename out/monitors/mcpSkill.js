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
const os = __importStar(require("os"));
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
function getCursorSettingsPath() {
    const home = os.homedir();
    const candidates = [
        path.join(home, 'AppData', 'Roaming', 'Cursor', 'User', 'settings.json'),
        path.join(home, 'Library', 'Application Support', 'Cursor', 'User', 'settings.json'),
        path.join(home, '.config', 'Cursor', 'User', 'settings.json'),
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    return null;
}
function getGlobalMCPJsonPath() {
    const home = os.homedir();
    const p = path.join(home, '.cursor', 'mcp.json');
    return fs.existsSync(p) ? p : null;
}
function parseMCPFromJson(jsonPath, sourceLabel) {
    try {
        const content = fs.readFileSync(jsonPath, 'utf-8');
        const config = JSON.parse(content);
        if (!config.mcpServers || typeof config.mcpServers !== 'object') {
            return [];
        }
        const blockedMCPs = vscode.workspace.getConfiguration('cursorSecurity').get('blockedMCPs') || [];
        const mcps = [];
        for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
            const cfg = serverConfig;
            const command = String(cfg.command || 'unknown');
            const args = Array.isArray(cfg.args) ? cfg.args.map(String) : [];
            const env = cfg.env || {};
            const envKeys = Object.keys(env);
            const isBlocked = blockedMCPs.includes(name);
            const isAuthorized = !isBlocked && (blockedMCPs.length === 0 || !blockedMCPs.includes(name));
            mcps.push({ name, command, args, envKeys, isBlocked, isAuthorized });
        }
        logger.info(MODULE, `Found ${mcps.length} MCP server(s) from ${sourceLabel}`);
        return mcps;
    }
    catch (err) {
        logger.warn(MODULE, `Failed to parse MCP from ${sourceLabel}: ${err}`);
        return [];
    }
}
function scanCursorProjectsMCPS() {
    const home = os.homedir();
    const projectsDir = path.join(home, '.cursor', 'projects');
    if (!fs.existsSync(projectsDir)) {
        return [];
    }
    const blockedMCPs = vscode.workspace.getConfiguration('cursorSecurity').get('blockedMCPs') || [];
    const mcps = [];
    const seen = new Set();
    try {
        const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true });
        for (const projectDir of projectDirs) {
            if (!projectDir.isDirectory()) {
                continue;
            }
            const mcpsDir = path.join(projectsDir, projectDir.name, 'mcps');
            if (!fs.existsSync(mcpsDir)) {
                continue;
            }
            const mcpDirs = fs.readdirSync(mcpsDir, { withFileTypes: true });
            for (const mcpDir of mcpDirs) {
                if (!mcpDir.isDirectory()) {
                    continue;
                }
                const metadataPath = path.join(mcpsDir, mcpDir.name, 'SERVER_METADATA.json');
                let name = mcpDir.name;
                let command = 'unknown';
                if (fs.existsSync(metadataPath)) {
                    try {
                        const content = fs.readFileSync(metadataPath, 'utf-8');
                        const meta = JSON.parse(content);
                        if (meta.name) {
                            name = meta.name;
                        }
                        if (meta.command) {
                            command = meta.command;
                        }
                    }
                    catch { /* ignore */ }
                }
                if (name.startsWith('cursor-')) {
                    continue;
                }
                if (!seen.has(name)) {
                    seen.add(name);
                    const isBlocked = blockedMCPs.includes(name);
                    const isAuthorized = !isBlocked && (blockedMCPs.length === 0 || !blockedMCPs.includes(name));
                    mcps.push({ name, command, args: [], envKeys: [], isBlocked, isAuthorized });
                }
            }
        }
        if (mcps.length > 0) {
            logger.info(MODULE, `Found ${mcps.length} MCP server(s) from ~/.cursor/projects/`);
        }
    }
    catch (err) {
        logger.warn(MODULE, `Failed to scan ~/.cursor/projects/mcps: ${err}`);
    }
    return mcps;
}
function parseMCPConfig(workspaceRoot) {
    const allMCPs = [];
    const seen = new Set();
    const addUnique = (mcps) => {
        for (const m of mcps) {
            if (!seen.has(m.name)) {
                seen.add(m.name);
                allMCPs.push(m);
            }
        }
    };
    const projectPath = path.join(workspaceRoot, '.cursor', 'mcp.json');
    if (fs.existsSync(projectPath)) {
        addUnique(parseMCPFromJson(projectPath, 'project .cursor/mcp.json'));
    }
    const globalPath = getGlobalMCPJsonPath();
    if (globalPath) {
        addUnique(parseMCPFromJson(globalPath, 'global ~/.cursor/mcp.json'));
    }
    const settingsPath = getCursorSettingsPath();
    if (settingsPath) {
        try {
            const content = fs.readFileSync(settingsPath, 'utf-8');
            const settings = JSON.parse(content);
            if (settings.mcpServers && typeof settings.mcpServers === 'object') {
                const tempFile = path.join(os.tmpdir(), '.cursor-shield-mcp-temp.json');
                fs.writeFileSync(tempFile, JSON.stringify({ mcpServers: settings.mcpServers }), 'utf-8');
                addUnique(parseMCPFromJson(tempFile, 'Cursor settings.json'));
                try {
                    fs.unlinkSync(tempFile);
                }
                catch { /* ignore */ }
            }
        }
        catch (err) {
            logger.warn(MODULE, `Failed to read Cursor settings.json: ${err}`);
        }
    }
    addUnique(scanCursorProjectsMCPS());
    logger.info(MODULE, `Total MCP servers found: ${allMCPs.length}`);
    return allMCPs;
}
function parseSkills(workspaceRoot) {
    const config = vscode.workspace.getConfiguration('cursorSecurity');
    const allowedSkills = config.get('allowedSkills') || [];
    const skills = [];
    const seen = new Set();
    const addSkill = (name, description, skillPath) => {
        if (!seen.has(name)) {
            seen.add(name);
            skills.push({
                name,
                description,
                path: skillPath,
                isAuthorized: allowedSkills.length === 0 || allowedSkills.includes(name)
            });
        }
    };
    const projectSkillsDir = path.join(workspaceRoot, '.cursor', 'skills');
    if (fs.existsSync(projectSkillsDir)) {
        try {
            const entries = fs.readdirSync(projectSkillsDir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const skillDir = path.join(projectSkillsDir, entry.name);
                    const skillJsonPath = path.join(skillDir, 'skill.json');
                    const skillMdPath = path.join(skillDir, 'skill.md');
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
                    else if (fs.existsSync(skillMdPath)) {
                        const raw = fs.readFileSync(skillMdPath, 'utf-8');
                        description = raw.substring(0, 120).replace(/\n/g, ' ').trim();
                    }
                    addSkill(name, description, skillDir);
                }
                else if (entry.isFile() && entry.name.endsWith('.md')) {
                    const name = entry.name.replace(/\.md$/, '');
                    const raw = fs.readFileSync(path.join(projectSkillsDir, entry.name), 'utf-8');
                    const description = raw.substring(0, 120).replace(/\n/g, ' ').trim();
                    addSkill(name, description, path.join(projectSkillsDir, entry.name));
                }
            }
        }
        catch (err) {
            logger.error(MODULE, `Failed to scan project skills: ${err}`);
        }
    }
    const globalSkillsDir = path.join(os.homedir(), '.cursor', 'skills-cursor');
    if (fs.existsSync(globalSkillsDir)) {
        try {
            const entries = fs.readdirSync(globalSkillsDir, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory()) {
                    continue;
                }
                const skillDir = path.join(globalSkillsDir, entry.name);
                const skillMdPath = path.join(skillDir, 'SKILL.md');
                let name = entry.name;
                let description = '';
                if (fs.existsSync(skillMdPath)) {
                    const raw = fs.readFileSync(skillMdPath, 'utf-8');
                    const firstLine = raw.split('\n').find(l => l.trim().length > 0) || '';
                    description = firstLine.replace(/^#+\s*/, '').substring(0, 120).trim();
                    if (!description) {
                        description = raw.substring(0, 120).replace(/\n/g, ' ').trim();
                    }
                }
                addSkill(name, description, skillDir);
            }
            if (entries.length > 0) {
                logger.info(MODULE, `Scanned ~/.cursor/skills-cursor/: ${entries.length} entries`);
            }
        }
        catch (err) {
            logger.warn(MODULE, `Failed to scan ~/.cursor/skills-cursor/: ${err}`);
        }
    }
    logger.info(MODULE, `Found ${skills.length} Skill(s)`);
    return skills;
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
    const skillsFileWatcher = vscode.workspace.createFileSystemWatcher('**/.cursor/skills/**/*');
    skillsFileWatcher.onDidChange(() => scanMCPSkills());
    skillsFileWatcher.onDidCreate(() => scanMCPSkills());
    skillsFileWatcher.onDidDelete(() => scanMCPSkills());
    disposables.push(skillsFileWatcher);
    const globalMCPWatcher = vscode.workspace.createFileSystemWatcher(path.join(os.homedir(), '.cursor', 'mcp.json'));
    globalMCPWatcher.onDidChange(() => scanMCPSkills());
    globalMCPWatcher.onDidCreate(() => scanMCPSkills());
    globalMCPWatcher.onDidDelete(() => scanMCPSkills());
    disposables.push(globalMCPWatcher);
    const cursorProjectsWatcher = vscode.workspace.createFileSystemWatcher(path.join(os.homedir(), '.cursor', 'projects', '*', 'mcps', '*', 'SERVER_METADATA.json'));
    cursorProjectsWatcher.onDidChange(() => scanMCPSkills());
    cursorProjectsWatcher.onDidCreate(() => scanMCPSkills());
    cursorProjectsWatcher.onDidDelete(() => scanMCPSkills());
    disposables.push(cursorProjectsWatcher);
    const globalSkillsWatcher = vscode.workspace.createFileSystemWatcher(path.join(os.homedir(), '.cursor', 'skills-cursor', '*', 'SKILL.md'));
    globalSkillsWatcher.onDidChange(() => scanMCPSkills());
    globalSkillsWatcher.onDidCreate(() => scanMCPSkills());
    globalSkillsWatcher.onDidDelete(() => scanMCPSkills());
    disposables.push(globalSkillsWatcher);
    const refreshCommand = vscode.commands.registerCommand('cursorSecurity._refreshMCPSkill', () => scanMCPSkills());
    disposables.push(refreshCommand);
    return disposables;
}
//# sourceMappingURL=mcpSkill.js.map