import * as vscode from 'vscode';
import * as fs from 'fs';
import { getActiveRules, MatchResult, maskMatch, Rule } from './rules';
export type { MatchResult } from './rules';
import { scanLineForEntropy, EntropyMatch } from './entropy';
import * as logger from '../utils/logger';

const MODULE = 'Engine';

const HIGH_ENTROPY_RULE: Rule = {
    id: 'high-entropy-string',
    description: 'High Entropy String (likely secret)',
    regex: /.*/g,
    severity: 'high',
    source: 'built-in'
};

export interface ScanOptions {
    maxLines?: number;
    includeEntropy?: boolean;
}

export interface ScanSummary {
    totalFiles: number;
    scannedFiles: number;
    totalMatches: number;
    matchesBySeverity: Record<string, number>;
    matches: MatchResult[];
    duration: number;
}

let lastScanSummary: ScanSummary | null = null;

function scanText(
    content: string,
    fileName: string,
    rules: Rule[],
    options: ScanOptions = {}
): MatchResult[] {
    const lines = content.split('\n');
    const maxLines = options.maxLines ?? vscode.workspace.getConfiguration('cursorSecurity').get<number>('maxScanLines', 5000);
    const linesToScan = lines.slice(0, maxLines);

    const matches: MatchResult[] = [];
    const includeEntropy = options.includeEntropy !== false;

    for (let lineIndex = 0; lineIndex < linesToScan.length; lineIndex++) {
        const line = linesToScan[lineIndex];
        const lineNumber = lineIndex + 1;

        for (const rule of rules) {
            const regex = new RegExp(rule.regex.source, rule.regex.flags);
            regex.lastIndex = 0;

            let match: RegExpExecArray | null;
            while ((match = regex.exec(line)) !== null) {
                const matchedText = match[0];

                if (matchedText.length < 6) {
                    continue;
                }

                if (matchedText.length > 500) {
                    continue;
                }

                const column = match.index + 1;

                const isDuplicate = matches.some(
                    m => m.line === lineNumber && m.match === matchedText && m.rule.id === rule.id
                );
                if (isDuplicate && rule.id !== 'high-entropy-string') {
                    continue;
                }

                matches.push({
                    file: fileName,
                    line: lineNumber,
                    column,
                    match: matchedText,
                    masked: maskMatch(matchedText),
                    rule
                });
            }
        }

        if (includeEntropy) {
            const entropyMatches = scanLineForEntropy(line, lineNumber);

            for (const em of entropyMatches) {
                const alreadyMatched = matches.some(
                    m => m.line === lineNumber && m.match === em.value
                );

                if (!alreadyMatched) {
                    matches.push({
                        file: fileName,
                        line: lineNumber,
                        column: em.index + 1,
                        match: em.value,
                        masked: maskMatch(em.value),
                        rule: { ...HIGH_ENTROPY_RULE, description: `High Entropy String (entropy: ${em.entropy.toFixed(2)})` }
                    });
                }
            }
        }
    }

    return matches;
}

export function scanContent(
    content: string,
    fileName: string,
    options?: ScanOptions
): MatchResult[] {
    const rules = getActiveRules();
    return scanText(content, fileName, rules, options);
}

export async function scanFile(
    filePath: string,
    options?: ScanOptions
): Promise<MatchResult[]> {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const fileName = filePath.replace(/\\/g, '/').split('/').pop() || filePath;
        return scanContent(content, fileName, options);
    } catch (err) {
        logger.warn(MODULE, `Failed to scan file ${filePath}: ${err}`);
        return [];
    }
}

export async function scanWorkspace(options?: ScanOptions): Promise<ScanSummary> {
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
    const maxLines = options?.maxLines ?? config.get<number>('maxScanLines', 5000);

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

    const rules = getActiveRules();
    const allMatches: MatchResult[] = [];

    for (const folder of workspaceFolders) {
        const pattern = new vscode.RelativePattern(folder, '**/*');
        const files = await vscode.workspace.findFiles(pattern, `{${scanExcludes.join(',')}}`, 10000);

        logger.info(MODULE, `Scanning ${files.length} files in ${folder.name}...`);

        for (const file of files) {
            const matches = await scanFile(file.fsPath, { ...options, maxLines });
            allMatches.push(...matches);
        }
    }

    const matchesBySeverity: Record<string, number> = {};
    for (const m of allMatches) {
        matchesBySeverity[m.rule.severity] = (matchesBySeverity[m.rule.severity] || 0) + 1;
    }

    const duration = Date.now() - startTime;

    const summary: ScanSummary = {
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

export function getLastScanSummary(): ScanSummary | null {
    return lastScanSummary;
}

export function formatMatchMessage(match: MatchResult): string {
    return `[${match.rule.severity.toUpperCase()}] ${match.rule.description}\n` +
        `  File: ${match.file}:${match.line}:${match.column}\n` +
        `  Match: ${match.masked}`;
}

export function clearScanCache(): void {
    lastScanSummary = null;
}

let activeEditorMatchCount = 0;
let activeEditorCriticalCount = 0;
let activeEditorHighCount = 0;
let activeEditorFileName: string | null = null;

export interface ActiveEditorStats {
    matchCount: number;
    criticalCount: number;
    highCount: number;
    fileName: string | null;
}

export function setActiveEditorMatches(fileName: string, matches: MatchResult[]): void {
    activeEditorFileName = fileName;
    activeEditorMatchCount = matches.length;
    activeEditorCriticalCount = matches.filter(m => m.rule.severity === 'critical').length;
    activeEditorHighCount = matches.filter(m => m.rule.severity === 'high').length;
}

export function getActiveEditorStats(): ActiveEditorStats {
    return {
        matchCount: activeEditorMatchCount,
        criticalCount: activeEditorCriticalCount,
        highCount: activeEditorHighCount,
        fileName: activeEditorFileName
    };
}

export function clearActiveEditorMatches(): void {
    activeEditorMatchCount = 0;
    activeEditorCriticalCount = 0;
    activeEditorHighCount = 0;
    activeEditorFileName = null;
}