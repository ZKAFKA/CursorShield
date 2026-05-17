import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export enum LogLevel {
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR'
}

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    module: string;
    message: string;
}

const LOG_DIR = path.join(os.homedir(), '.cursor-shield', 'logs');
const MAX_LOG_AGE_MS = 30 * 24 * 60 * 60 * 1000;

let logStream: fs.WriteStream | null = null;
let currentLogFile: string = '';

function ensureLogDir(): void {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
}

function getLogFileName(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `cursor-shield-${y}-${m}-${d}.log`;
}

function openLogStream(): void {
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

function formatTimestamp(): string {
    return new Date().toISOString();
}

function formatEntry(entry: LogEntry): string {
    return `[${entry.timestamp}] [${entry.level}] [${entry.module}] ${entry.message}`;
}

function writeLog(level: LogLevel, module: string, message: string): void {
    openLogStream();
    const entry: LogEntry = {
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

export function info(module: string, message: string): void {
    writeLog(LogLevel.INFO, module, message);
}

export function warn(module: string, message: string): void {
    writeLog(LogLevel.WARN, module, message);
}

export function error(module: string, message: string): void {
    writeLog(LogLevel.ERROR, module, message);
}

export function cleanupExpiredLogs(): void {
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
    } catch (err) {
        console.error('[CursorShield] Failed to cleanup logs:', err);
    }
}

export function getLogDir(): string {
    return LOG_DIR;
}

export function readRecentLogs(maxLines: number = 200): string[] {
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
    } catch {
        return [];
    }
}

export function close(): void {
    if (logStream) {
        logStream.end();
        logStream = null;
    }
}