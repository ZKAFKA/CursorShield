import * as vscode from 'vscode';
import * as logger from '../utils/logger';

const MODULE = 'Entropy';

const BASE64_CHARS = /^[A-Za-z0-9+/=]+$/;
const HEX_CHARS = /^[0-9A-Fa-f]+$/;

function shannonEntropy(str: string): number {
    const freq: Record<string, number> = {};
    const len = str.length;

    for (let i = 0; i < len; i++) {
        const char = str[i];
        freq[char] = (freq[char] || 0) + 1;
    }

    let entropy = 0;
    for (const count of Object.values(freq)) {
        const prob = count / len;
        entropy -= prob * Math.log2(prob);
    }

    return entropy;
}

function looksLikeSecret(str: string): boolean {
    let upper = 0;
    let lower = 0;
    let digit = 0;
    let special = 0;

    for (const ch of str) {
        if (ch >= 'A' && ch <= 'Z') { upper++; }
        else if (ch >= 'a' && ch <= 'z') { lower++; }
        else if (ch >= '0' && ch <= '9') { digit++; }
        else { special++; }
    }

    const total = str.length;
    if (digit === total) { return false; }
    if (lower === total) { return false; }
    if (upper === total) { return false; }

    const upperRatio = upper / total;
    const lowerRatio = lower / total;
    const digitRatio = digit / total;

    if (upperRatio > 0 && lowerRatio > 0 && digitRatio > 0) {
        return true;
    }

    if (digitRatio > 0.1 && (upperRatio > 0 || lowerRatio > 0)) {
        return true;
    }

    return special < total * 0.3 && (BASE64_CHARS.test(str) || HEX_CHARS.test(str));
}

function extractPotentialSecrets(line: string): Array<{ value: string; index: number }> {
    const results: Array<{ value: string; index: number }> = [];

    const candidates = [
        /[A-Za-z0-9+/]{40,}/g,
        /[A-Za-z0-9]{32,}/g,
        /[0-9A-Fa-f]{32,}/g
    ];

    const seen = new Set<string>();

    for (const regex of candidates) {
        let match: RegExpExecArray | null;
        regex.lastIndex = 0;

        while ((match = regex.exec(line)) !== null) {
            const value = match[0];
            const normalized = value.toLowerCase();

            if (seen.has(normalized)) {
                continue;
            }

            if (value.length < 20) {
                continue;
            }

            if (looksLikeSecret(value)) {
                seen.add(normalized);
                results.push({ value, index: match.index });
            }
        }
    }

    return results;
}

export interface EntropyMatch {
    value: string;
    index: number;
    line: number;
    entropy: number;
}

export function scanLineForEntropy(
    line: string,
    lineNumber: number,
    threshold?: number
): EntropyMatch[] {
    const config = vscode.workspace.getConfiguration('cursorSecurity');
    const entropyThreshold = threshold ?? config.get<number>('entropyThreshold', 4.5);

    const candidates = extractPotentialSecrets(line);
    const matches: EntropyMatch[] = [];

    for (const candidate of candidates) {
        const entropy = shannonEntropy(candidate.value);

        if (entropy >= entropyThreshold) {
            matches.push({
                value: candidate.value,
                index: candidate.index,
                line: lineNumber,
                entropy
            });
        }
    }

    return matches;
}

export function calculateEntropy(str: string): number {
    return shannonEntropy(str);
}