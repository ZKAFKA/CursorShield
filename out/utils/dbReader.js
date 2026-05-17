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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readAccountEmail = readAccountEmail;
exports.getDbPath = getDbPath;
exports.isDbAvailable = isDbAvailable;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const sql_js_1 = __importDefault(require("sql.js"));
const logger = __importStar(require("./logger"));
const MODULE = 'DBReader';
function getStateDbPath() {
    const platform = os.platform();
    const home = os.homedir();
    switch (platform) {
        case 'win32':
            return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Cursor', 'User', 'globalStorage', 'state.vscdb');
        case 'darwin':
            return path.join(home, 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'state.vscdb');
        case 'linux':
            return path.join(home, '.config', 'Cursor', 'User', 'globalStorage', 'state.vscdb');
        default:
            throw new Error(`Unsupported platform: ${platform}`);
    }
}
function getSqlJsWasmPath() {
    const possiblePaths = [
        path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
        path.join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
    ];
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    return possiblePaths[0];
}
let sqlInstance = null;
async function getSqlJs() {
    if (sqlInstance) {
        return sqlInstance;
    }
    const wasmPath = getSqlJsWasmPath();
    logger.info(MODULE, `Loading sql.js WASM from: ${wasmPath}`);
    sqlInstance = await (0, sql_js_1.default)({
        locateFile: (file) => {
            if (file.endsWith('.wasm')) {
                const wasmDir = path.dirname(wasmPath);
                return path.join(wasmDir, file);
            }
            return file;
        }
    });
    return sqlInstance;
}
function querySingleValue(db, sql) {
    try {
        const result = db.exec(sql);
        if (result.length > 0 && result[0].values.length > 0) {
            const row = result[0].values[0];
            if (row && row.length > 0 && row[0]) {
                return String(row[0]);
            }
        }
    }
    catch {
        // table/column may not exist
    }
    return null;
}
function queryAllMatchingKeys(db, pattern) {
    const results = [];
    try {
        const sql = `SELECT key, value FROM ItemTable WHERE key LIKE '${pattern}'`;
        const result = db.exec(sql);
        if (result.length > 0 && result[0].values.length > 0) {
            for (const row of result[0].values) {
                if (row[0] && row[1]) {
                    results.push({ key: String(row[0]), value: String(row[1]) });
                }
            }
        }
    }
    catch {
        // ignore
    }
    return results;
}
function queryAccountEmail(db) {
    const queries = [
        "SELECT value FROM ItemTable WHERE key = 'cursorAuth/cachedEmail'",
        "SELECT value FROM ItemTable WHERE key LIKE '%cachedEmail%'",
        "SELECT value FROM ItemTable WHERE key LIKE '%email%'"
    ];
    for (const sql of queries) {
        const value = querySingleValue(db, sql);
        if (value) {
            if (value.includes('@')) {
                return value;
            }
            try {
                const parsed = JSON.parse(value);
                if (parsed.email && parsed.email.emailIncludes?.('@')) {
                    return parsed.email;
                }
                if (typeof parsed === 'string' && parsed.includes('@')) {
                    return parsed;
                }
            }
            catch {
                // not JSON
            }
        }
    }
    return null;
}
function checkAuthState(db) {
    const authKeys = [
        'cursorAuth/cachedEmail',
        'cursorAuth/session',
        'cursorAuth/token',
        'cursorAuth/accessToken',
        'cursorAuth/refreshToken',
        'cursorAuth/accountStatus',
        'auth/loginType',
        'auth/status'
    ];
    const authKeyPatterns = [
        '%cursorAuth%',
        '%auth%',
        '%token%',
        '%session%',
        '%account%'
    ];
    const foundValues = [];
    let hasTokenOrSession = false;
    for (const key of authKeys) {
        const sql = `SELECT value FROM ItemTable WHERE key = '${key}'`;
        const value = querySingleValue(db, sql);
        if (value) {
            foundValues.push(`${key}=${value.substring(0, 20)}`);
            if (key.includes('token') || key.includes('session') || key.includes('accessToken') || key.includes('refreshToken')) {
                hasTokenOrSession = true;
            }
        }
    }
    for (const pattern of authKeyPatterns) {
        const rows = queryAllMatchingKeys(db, pattern);
        for (const row of rows) {
            foundValues.push(`${row.key}=${row.value.substring(0, 20)}`);
            if (row.key.includes('token') || row.key.includes('session') || row.key.includes('accessToken')) {
                hasTokenOrSession = true;
            }
        }
    }
    const hashInput = foundValues.join('|');
    let authStateHash = 'empty';
    if (hashInput.length > 0) {
        let hash = 0;
        for (let i = 0; i < hashInput.length; i++) {
            const char = hashInput.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        authStateHash = hash.toString(36);
    }
    logger.info(MODULE, `Auth state: hash=${authStateHash}, keysFound=${foundValues.length}, hasToken=${hasTokenOrSession}`);
    return {
        isAuthenticated: foundValues.length > 0 && hasTokenOrSession,
        authStateHash
    };
}
async function readAccountEmail() {
    const dbPath = getStateDbPath();
    logger.info(MODULE, `Reading state database: ${dbPath}`);
    if (!fs.existsSync(dbPath)) {
        logger.warn(MODULE, `State database not found at: ${dbPath}`);
        return { email: null, domain: null, found: false, isAuthenticated: false, authStateHash: 'no-db', error: 'Database file not found' };
    }
    try {
        const SQL = await getSqlJs();
        const buffer = fs.readFileSync(dbPath);
        const db = new SQL.Database(buffer);
        const email = queryAccountEmail(db);
        const authState = checkAuthState(db);
        db.close();
        if (email) {
            const domain = email.split('@')[1] || null;
            logger.info(MODULE, `Found account email: ${email}, authenticated: ${authState.isAuthenticated}, hash: ${authState.authStateHash}`);
            return { email, domain, found: true, isAuthenticated: authState.isAuthenticated, authStateHash: authState.authStateHash };
        }
        logger.warn(MODULE, `No email found in state database, authenticated: ${authState.isAuthenticated}`);
        return { email: null, domain: null, found: false, isAuthenticated: authState.isAuthenticated, authStateHash: authState.authStateHash };
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error(MODULE, `Failed to read state database: ${errorMsg}`);
        return { email: null, domain: null, found: false, isAuthenticated: false, authStateHash: 'error', error: errorMsg };
    }
}
function getDbPath() {
    return getStateDbPath();
}
function isDbAvailable() {
    return fs.existsSync(getStateDbPath());
}
//# sourceMappingURL=dbReader.js.map