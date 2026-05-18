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
exports.LogLevel = void 0;
exports.info = info;
exports.warn = warn;
exports.error = error;
exports.cleanupExpiredLogs = cleanupExpiredLogs;
exports.getLogDir = getLogDir;
exports.readRecentLogs = readRecentLogs;
exports.readAllLogs = readAllLogs;
exports.close = close;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
var LogLevel;
(function (LogLevel) {
    LogLevel["INFO"] = "INFO";
    LogLevel["WARN"] = "WARN";
    LogLevel["ERROR"] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
const LOG_DIR = path.join(os.homedir(), '.cursor-shield', 'logs');
const MAX_LOG_AGE_MS = 30 * 24 * 60 * 60 * 1000;
let logStream = null;
let currentLogFile = '';
function ensureLogDir() {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
}
function getLogFileName() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `cursor-shield-${y}-${m}-${d}.log`;
}
function openLogStream() {
    ensureLogDir();
    const logFile = getLogFileName();
    const logPath = path.join(LOG_DIR, logFile);
    if (logStream && currentLogFile === logFile) {
        return;
    }
    if (logStream) {
        logStream.end();
    }
    currentLogFile = logFile;
    logStream = fs.createWriteStream(logPath, { flags: 'a' });
}
function formatTimestamp() {
    return new Date().toISOString();
}
function formatEntry(entry) {
    return `[${entry.timestamp}] [${entry.level}] [${entry.module}] ${entry.message}`;
}
function writeLog(level, module, message) {
    openLogStream();
    const entry = {
        timestamp: formatTimestamp(),
        level,
        module,
        message
    };
    const line = formatEntry(entry);
    if (logStream) {
        logStream.write(line + '\n');
    }
    const consoleMsg = `[CursorShield] ${line}`;
    switch (level) {
        case LogLevel.WARN:
            console.warn(consoleMsg);
            break;
        case LogLevel.ERROR:
            console.error(consoleMsg);
            break;
        default:
            console.log(consoleMsg);
    }
}
function info(module, message) {
    writeLog(LogLevel.INFO, module, message);
}
function warn(module, message) {
    writeLog(LogLevel.WARN, module, message);
}
function error(module, message) {
    writeLog(LogLevel.ERROR, module, message);
}
function cleanupExpiredLogs() {
    ensureLogDir();
    const now = Date.now();
    try {
        const files = fs.readdirSync(LOG_DIR);
        for (const file of files) {
            const filePath = path.join(LOG_DIR, file);
            const stat = fs.statSync(filePath);
            if (now - stat.mtimeMs > MAX_LOG_AGE_MS) {
                fs.unlinkSync(filePath);
            }
        }
    }
    catch (err) {
        console.error('[CursorShield] Failed to cleanup logs:', err);
    }
}
function getLogDir() {
    return LOG_DIR;
}
function readRecentLogs(maxLines = 200) {
    ensureLogDir();
    const logFile = getLogFileName();
    const logPath = path.join(LOG_DIR, logFile);
    if (!fs.existsSync(logPath)) {
        return [];
    }
    try {
        const content = fs.readFileSync(logPath, 'utf-8');
        const lines = content.trim().split('\n');
        return lines.slice(-maxLines);
    }
    catch {
        return [];
    }
}
function readAllLogs() {
    ensureLogDir();
    try {
        const files = fs.readdirSync(LOG_DIR)
            .filter(f => f.endsWith('.log'))
            .sort();
        const allLines = [];
        for (const file of files) {
            const filePath = path.join(LOG_DIR, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.trim().split('\n').filter(l => l.length > 0);
            allLines.push(...lines);
        }
        return allLines;
    }
    catch {
        return [];
    }
}
function close() {
    if (logStream) {
        logStream.end();
        logStream = null;
    }
}
//# sourceMappingURL=logger.js.map