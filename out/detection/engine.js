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
exports.scanContent = scanContent;
exports.scanFile = scanFile;
exports.scanWorkspace = scanWorkspace;
exports.getLastScanSummary = getLastScanSummary;
exports.formatMatchMessage = formatMatchMessage;
exports.clearScanCache = clearScanCache;
exports.setActiveEditorMatches = setActiveEditorMatches;
exports.getActiveEditorStats = getActiveEditorStats;
exports.clearActiveEditorMatches = clearActiveEditorMatches;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const rules_1 = require("./rules");
const entropy_1 = require("./entropy");
const logger = __importStar(require("../utils/logger"));
const MODULE = 'Engine';
const HIGH_ENTROPY_RULE = {
    id: 'high-entropy-string',
    description: 'High Entropy String (likely secret)',
    regex: /.*/g,
    severity: 'high',
    source: 'built-in'
};
let lastScanSummary = null;
function scanText(content, fileName, rules, options = {}) {
    const lines = content.split('\n');
    const maxLines = options.maxLines ?? vscode.workspace.getConfiguration('cursorSecurity').get('maxScanLines', 5000);
    const linesToScan = lines.slice(0, maxLines);
    const matches = [];
    const includeEntropy = options.includeEntropy !== false;
    for (let lineIndex = 0; lineIndex < linesToScan.length; lineIndex++) {
        const line = linesToScan[lineIndex];
        const lineNumber = lineIndex + 1;
        for (const rule of rules) {
            const regex = new RegExp(rule.regex.source, rule.regex.flags);
            regex.lastIndex = 0;
            let match;
            while ((match = regex.exec(line)) !== null) {
                const matchedText = match[0];
                if (matchedText.length < 6) {
                    continue;
                }
                if (matchedText.length > 500) {
                    continue;
                }
                const column = match.index + 1;
                const isDuplicate = matches.some(m => m.line === lineNumber && m.match === matchedText && m.rule.id === rule.id);
                if (isDuplicate && rule.id !== 'high-entropy-string') {
                    continue;
                }
                matches.push({
                    file: fileName,
                    line: lineNumber,
                    column,
                    match: matchedText,
                    masked: (0, rules_1.maskMatch)(matchedText),
                    rule
                });
            }
        }
        if (includeEntropy) {
            const entropyMatches = (0, entropy_1.scanLineForEntropy)(line, lineNumber);
            for (const em of entropyMatches) {
                const alreadyMatched = matches.some(m => m.line === lineNumber && m.match === em.value);
                if (!alreadyMatched) {
                    matches.push({
                        file: fileName,
                        line: lineNumber,
                        column: em.index + 1,
                        match: em.value,
                        masked: (0, rules_1.maskMatch)(em.value),
                        rule: { ...HIGH_ENTROPY_RULE, description: `High Entropy String (entropy: ${em.entropy.toFixed(2)})` }
                    });
                }
            }
        }
    }
    return matches;
}
function scanContent(content, fileName, options) {
    const rules = (0, rules_1.getActiveRules)();
    return scanText(content, fileName, rules, options);
}
async function scanFile(filePath, options) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const fileName = filePath.replace(/\\/g, '/').split('/').pop() || filePath;
        return scanContent(content, fileName, options);
    }
    catch (err) {
        logger.warn(MODULE, `Failed to scan file ${filePath}: ${err}`);
        return [];
    }
}
async function scanWorkspace(options) {
    const startTime = Date.now();
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        logger.warn(MODULE, 'No workspace folder to scan');
        return {
            totalFiles: 0,
            scannedFiles: 0,
            totalMatches: 0,
            matchesBySeverity: {},
            matches: [],
            duration: 0
        };
    }
    const config = vscode.workspace.getConfiguration('cursorSecurity');
    const maxLines = options?.maxLines ?? config.get('maxScanLines', 5000);
    const scanExcludes = [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/out/**',
        '**/.cursor/**',
        '**/*.min.js',
        '**/*.map',
        '**/*.lock',
        '**/*.svg',
        '**/*.png',
        '**/*.jpg',
        '**/*.gif',
        '**/*.ico',
        '**/*.woff*',
        '**/*.ttf',
        '**/*.eot',
        '**/package-lock.json'
    ];
    const rules = (0, rules_1.getActiveRules)();
    const allMatches = [];
    for (const folder of workspaceFolders) {
        const pattern = new vscode.RelativePattern(folder, '**/*');
        const files = await vscode.workspace.findFiles(pattern, `{${scanExcludes.join(',')}}`, 10000);
        logger.info(MODULE, `Scanning ${files.length} files in ${folder.name}...`);
        for (const file of files) {
            const matches = await scanFile(file.fsPath, { ...options, maxLines });
            allMatches.push(...matches);
        }
    }
    const matchesBySeverity = {};
    for (const m of allMatches) {
        matchesBySeverity[m.rule.severity] = (matchesBySeverity[m.rule.severity] || 0) + 1;
    }
    const duration = Date.now() - startTime;
    const summary = {
        totalFiles: 0,
        scannedFiles: 0,
        totalMatches: allMatches.length,
        matchesBySeverity,
        matches: allMatches,
        duration
    };
    lastScanSummary = summary;
    logger.info(MODULE, `Scan complete: ${allMatches.length} matches in ${duration}ms`);
    return summary;
}
function getLastScanSummary() {
    return lastScanSummary;
}
function formatMatchMessage(match) {
    return `[${match.rule.severity.toUpperCase()}] ${match.rule.description}\n` +
        `  File: ${match.file}:${match.line}:${match.column}\n` +
        `  Match: ${match.masked}`;
}
function clearScanCache() {
    lastScanSummary = null;
}
let activeEditorMatchCount = 0;
let activeEditorCriticalCount = 0;
let activeEditorHighCount = 0;
let activeEditorFileName = null;
function setActiveEditorMatches(fileName, matches) {
    activeEditorFileName = fileName;
    activeEditorMatchCount = matches.length;
    activeEditorCriticalCount = matches.filter(m => m.rule.severity === 'critical').length;
    activeEditorHighCount = matches.filter(m => m.rule.severity === 'high').length;
}
function getActiveEditorStats() {
    return {
        matchCount: activeEditorMatchCount,
        criticalCount: activeEditorCriticalCount,
        highCount: activeEditorHighCount,
        fileName: activeEditorFileName
    };
}
function clearActiveEditorMatches() {
    activeEditorMatchCount = 0;
    activeEditorCriticalCount = 0;
    activeEditorHighCount = 0;
    activeEditorFileName = null;
}
//# sourceMappingURL=engine.js.map