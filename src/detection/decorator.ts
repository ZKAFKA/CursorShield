import * as vscode from 'vscode';
import { scanContent } from './engine';
import { setActiveEditorMatches, clearActiveEditorMatches } from './engine';
import { MatchResult } from './rules';
import * as logger from '../utils/logger';

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

let activeDecorations: Map<string, vscode.Range[]> = new Map();
let debounceTimer: NodeJS.Timeout | null = null;
const DEBOUNCE_MS = 500;

export class SensitiveInfoHoverProvider implements vscode.HoverProvider {
    private matches: Map<string, MatchResult[]> = new Map();

    updateMatches(filePath: string, matches: MatchResult[]): void {
        this.matches.set(filePath, matches);
    }

    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.Hover | null {
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

            return new vscode.MarkdownString(
                `**${severityIcon} [${m.rule.severity.toUpperCase()}] ${m.rule.description}**  \n` +
                `*Match:* \`${m.masked}\`  \n` +
                `*Rule:* \`${m.rule.id}\`  \n` +
                `*Line:* ${m.line}, *Column:* ${m.column}`
            );
        });

        const range = document.lineAt(position.line).range;
        return new vscode.Hover(contents, range);
    }
}

const hoverProvider = new SensitiveInfoHoverProvider();

export function registerDecorator(context: vscode.ExtensionContext): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];

    const hoverRegistration = vscode.languages.registerHoverProvider(
        { scheme: 'file' },
        hoverProvider
    );
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

async function scanAndDecorate(document: vscode.TextDocument): Promise<void> {
    const config = vscode.workspace.getConfiguration('cursorSecurity');
    if (!config.get<boolean>('enabled', true)) {
        return;
    }

    try {
        const content = document.getText();

        if (content.length === 0) {
            clearDecorations(document.fileName);
            return;
        }

        const fileName = document.fileName.replace(/\\/g, '/').split('/').pop() || document.fileName;
        const matches = scanContent(content, fileName, { includeEntropy: true, maxLines: 5000 });

        hoverProvider.updateMatches(document.fileName, matches);

        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document !== document) {
            return;
        }

        const ranges: vscode.Range[] = [];

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
            return new vscode.Range(
                new vscode.Position(line, lastChar.character),
                new vscode.Position(line, lastChar.character)
            );
        });
        editor.setDecorations(hoverDecorationType, hoverRanges);

        if (matches.length > 0) {
            const criticalMatches = matches.filter(m => m.rule.severity === 'critical').length;
            const highMatches = matches.filter(m => m.rule.severity === 'high').length;
            logger.warn(MODULE, `Found ${matches.length} sensitive matches in ${fileName} (critical: ${criticalMatches}, high: ${highMatches})`);
        }

        setActiveEditorMatches(fileName, matches);

        try {
            const { refreshDashboard } = await import('../dashboard/webview');
            refreshDashboard();
        } catch {
            // dashboard may not be loaded yet
        }
    } catch (err) {
        logger.error(MODULE, `Decorator scan failed: ${err}`);
    }
}

function clearDecorations(fileName: string): void {
    activeDecorations.delete(fileName);
    hoverProvider.updateMatches(fileName, []);

    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.fileName === fileName) {
        editor.setDecorations(decorationType, []);
        editor.setDecorations(hoverDecorationType, []);
    }
}

export function clearAllDecorations(): void {
    activeDecorations.clear();

    const editor = vscode.window.activeTextEditor;
    if (editor) {
        editor.setDecorations(decorationType, []);
        editor.setDecorations(hoverDecorationType, []);
    }
}