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
exports.SensitiveInfoHoverProvider = void 0;
exports.registerDecorator = registerDecorator;
exports.clearAllDecorations = clearAllDecorations;
const vscode = __importStar(require("vscode"));
const engine_1 = require("./engine");
const engine_2 = require("./engine");
const logger = __importStar(require("../utils/logger"));
const MODULE = 'Decorator';
const decorationType = vscode.window.createTextEditorDecorationType({
    borderWidth: '0 0 0 3px',
    borderStyle: 'solid',
    borderColor: new vscode.ThemeColor('editorError.foreground'),
    backgroundColor: new vscode.ThemeColor('editorError.background'),
    overviewRulerColor: new vscode.ThemeColor('editorError.foreground'),
    overviewRulerLane: vscode.OverviewRulerLane.Right
});
const hoverDecorationType = vscode.window.createTextEditorDecorationType({
    after: {
        contentText: ' ⚠️',
        color: new vscode.ThemeColor('editorError.foreground'),
        fontWeight: 'bold'
    }
});
let activeDecorations = new Map();
let debounceTimer = null;
const DEBOUNCE_MS = 500;
class SensitiveInfoHoverProvider {
    matches = new Map();
    updateMatches(filePath, matches) {
        this.matches.set(filePath, matches);
    }
    provideHover(document, position) {
        const fileMatches = this.matches.get(document.fileName);
        if (!fileMatches || fileMatches.length === 0) {
            return null;
        }
        const line = position.line + 1;
        const lineMatches = fileMatches.filter(m => m.line === line);
        if (lineMatches.length === 0) {
            return null;
        }
        const contents = lineMatches.map(m => {
            const severityIcon = m.rule.severity === 'critical'
                ? '🔴' : m.rule.severity === 'high'
                ? '🟠' : '🟡';
            return new vscode.MarkdownString(`**${severityIcon} [${m.rule.severity.toUpperCase()}] ${m.rule.description}**  \n` +
                `*Match:* \`${m.masked}\`  \n` +
                `*Rule:* \`${m.rule.id}\`  \n` +
                `*Line:* ${m.line}, *Column:* ${m.column}`);
        });
        const range = document.lineAt(position.line).range;
        return new vscode.Hover(contents, range);
    }
}
exports.SensitiveInfoHoverProvider = SensitiveInfoHoverProvider;
const hoverProvider = new SensitiveInfoHoverProvider();
function registerDecorator(context) {
    const disposables = [];
    const hoverRegistration = vscode.languages.registerHoverProvider({ scheme: 'file' }, hoverProvider);
    disposables.push(hoverRegistration);
    const changeListener = vscode.workspace.onDidChangeTextDocument(e => {
        if (e.document.uri.scheme !== 'file') {
            return;
        }
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
            scanAndDecorate(e.document);
        }, DEBOUNCE_MS);
    });
    disposables.push(changeListener);
    const openListener = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && editor.document.uri.scheme === 'file') {
            scanAndDecorate(editor.document);
        }
    });
    disposables.push(openListener);
    const saveListener = vscode.workspace.onDidSaveTextDocument(document => {
        if (document.uri.scheme === 'file') {
            scanAndDecorate(document);
        }
    });
    disposables.push(saveListener);
    if (vscode.window.activeTextEditor) {
        scanAndDecorate(vscode.window.activeTextEditor.document);
    }
    context.subscriptions.push(decorationType);
    context.subscriptions.push(hoverDecorationType);
    return disposables;
}
async function scanAndDecorate(document) {
    const config = vscode.workspace.getConfiguration('cursorSecurity');
    if (!config.get('enabled', true)) {
        return;
    }
    try {
        const content = document.getText();
        if (content.length === 0) {
            clearDecorations(document.fileName);
            return;
        }
        const fileName = document.fileName.replace(/\\/g, '/').split('/').pop() || document.fileName;
        const matches = (0, engine_1.scanContent)(content, fileName, { includeEntropy: true, maxLines: 5000 });
        hoverProvider.updateMatches(document.fileName, matches);
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document !== document) {
            return;
        }
        const ranges = [];
        for (const match of matches) {
            const line = match.line - 1;
            if (line >= document.lineCount) {
                continue;
            }
            const textLine = document.lineAt(line);
            const startIndex = match.column - 1;
            const endIndex = startIndex + match.match.length;
            const startPos = new vscode.Position(line, startIndex);
            const endPos = new vscode.Position(line, endIndex);
            ranges.push(new vscode.Range(startPos, endPos));
        }
        activeDecorations.set(document.fileName, ranges);
        editor.setDecorations(decorationType, ranges);
        const hoverRanges = matches.map(m => {
            const line = m.line - 1;
            const lastChar = document.lineAt(line).range.end;
            return new vscode.Range(new vscode.Position(line, lastChar.character), new vscode.Position(line, lastChar.character));
        });
        editor.setDecorations(hoverDecorationType, hoverRanges);
        if (matches.length > 0) {
            const criticalMatches = matches.filter(m => m.rule.severity === 'critical').length;
            const highMatches = matches.filter(m => m.rule.severity === 'high').length;
            logger.warn(MODULE, `Found ${matches.length} sensitive matches in ${fileName} (critical: ${criticalMatches}, high: ${highMatches})`);
        }
        (0, engine_2.setActiveEditorMatches)(fileName, matches);
        try {
            const { refreshDashboard } = await Promise.resolve().then(() => __importStar(require('../dashboard/webview')));
            refreshDashboard();
        }
        catch {
            // dashboard may not be loaded yet
        }
    }
    catch (err) {
        logger.error(MODULE, `Decorator scan failed: ${err}`);
    }
}
function clearDecorations(fileName) {
    activeDecorations.delete(fileName);
    hoverProvider.updateMatches(fileName, []);
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.fileName === fileName) {
        editor.setDecorations(decorationType, []);
        editor.setDecorations(hoverDecorationType, []);
    }
}
function clearAllDecorations() {
    activeDecorations.clear();
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        editor.setDecorations(decorationType, []);
        editor.setDecorations(hoverDecorationType, []);
    }
}
//# sourceMappingURL=decorator.js.map