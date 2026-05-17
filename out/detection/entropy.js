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
exports.scanLineForEntropy = scanLineForEntropy;
exports.calculateEntropy = calculateEntropy;
const vscode = __importStar(require("vscode"));
const MODULE = 'Entropy';
const BASE64_CHARS = /^[A-Za-z0-9+/=]+$/;
const HEX_CHARS = /^[0-9A-Fa-f]+$/;
function shannonEntropy(str) {
    const freq = {};
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
function looksLikeSecret(str) {
    let upper = 0;
    let lower = 0;
    let digit = 0;
    let special = 0;
    for (const ch of str) {
        if (ch >= 'A' && ch <= 'Z') {
            upper++;
        }
        else if (ch >= 'a' && ch <= 'z') {
            lower++;
        }
        else if (ch >= '0' && ch <= '9') {
            digit++;
        }
        else {
            special++;
        }
    }
    const total = str.length;
    if (digit === total) {
        return false;
    }
    if (lower === total) {
        return false;
    }
    if (upper === total) {
        return false;
    }
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
function extractPotentialSecrets(line) {
    const results = [];
    const candidates = [
        /[A-Za-z0-9+/]{40,}/g,
        /[A-Za-z0-9]{32,}/g,
        /[0-9A-Fa-f]{32,}/g
    ];
    const seen = new Set();
    for (const regex of candidates) {
        let match;
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
function scanLineForEntropy(line, lineNumber, threshold) {
    const config = vscode.workspace.getConfiguration('cursorSecurity');
    const entropyThreshold = threshold ?? config.get('entropyThreshold', 4.5);
    const candidates = extractPotentialSecrets(line);
    const matches = [];
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
function calculateEntropy(str) {
    return shannonEntropy(str);
}
//# sourceMappingURL=entropy.js.map