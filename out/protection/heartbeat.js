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
exports.registerHeartbeat = registerHeartbeat;
exports.getLastHeartbeatTime = getLastHeartbeatTime;
exports.isHeartbeatSuccessful = isHeartbeatSuccessful;
exports.forceHeartbeat = forceHeartbeat;
const vscode = __importStar(require("vscode"));
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const url_1 = require("url");
const logger = __importStar(require("../utils/logger"));
const antiTamper_1 = require("./antiTamper");
const MODULE = 'Heartbeat';
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
let heartbeatTimer = null;
let lastHeartbeatTime = null;
let lastHeartbeatSuccess = false;
function buildPayload() {
    const config = vscode.workspace.getConfiguration('cursorSecurity');
    return {
        timestamp: new Date().toISOString(),
        extensionId: 'cursor-shield.cursor-shield',
        extensionVersion: '1.0.0',
        status: {
            active: true,
            tamperDetected: (0, antiTamper_1.isTamperDetected)(),
            accountEmail: null,
            accountCompliant: null,
            gitOriginUrl: null,
            gitCompliant: null,
            mcpCount: 0,
            skillCount: 0,
            unauthorizedMCPs: 0,
            unauthorizedSkills: 0,
            lastLeakCount: 0,
            hasLeak: false
        }
    };
}
function sendHeartbeat(endpoint, payload) {
    return new Promise((resolve) => {
        try {
            const url = new url_1.URL(endpoint);
            const data = JSON.stringify(payload);
            const options = {
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname + url.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data),
                    'User-Agent': 'CursorShield/1.0.0'
                },
                timeout: 10000
            };
            const reqHandler = (res) => {
                let body = '';
                res.on('data', (chunk) => { body += chunk.toString(); });
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        logger.info(MODULE, `Heartbeat sent successfully (${res.statusCode})`);
                        resolve(true);
                    }
                    else {
                        logger.warn(MODULE, `Heartbeat failed: HTTP ${res.statusCode}`);
                        resolve(false);
                    }
                });
            };
            const errorHandler = (err) => {
                logger.warn(MODULE, `Heartbeat network error: ${err.message}`);
                resolve(false);
            };
            let req;
            if (url.protocol === 'https:') {
                req = https.request(options, reqHandler);
            }
            else {
                req = http.request(options, reqHandler);
            }
            req.on('error', errorHandler);
            req.on('timeout', () => {
                req.destroy();
                logger.warn(MODULE, 'Heartbeat timed out');
                resolve(false);
            });
            req.write(data);
            req.end();
        }
        catch (err) {
            logger.error(MODULE, `Heartbeat send error: ${err}`);
            resolve(false);
        }
    });
}
async function executeHeartbeat() {
    const config = vscode.workspace.getConfiguration('cursorSecurity');
    const endpoint = config.get('heartbeatEndpoint', '');
    if (!endpoint) {
        return;
    }
    logger.info(MODULE, 'Sending heartbeat...');
    const payload = buildPayload();
    try {
        const result = await sendHeartbeat(endpoint, payload);
        lastHeartbeatSuccess = result;
        lastHeartbeatTime = new Date().toISOString();
    }
    catch (err) {
        logger.error(MODULE, `Heartbeat execution failed: ${err}`);
        lastHeartbeatSuccess = false;
    }
}
function registerHeartbeat(context) {
    const disposables = [];
    const config = vscode.workspace.getConfiguration('cursorSecurity');
    const endpoint = config.get('heartbeatEndpoint', '');
    if (!endpoint) {
        logger.info(MODULE, 'Heartbeat disabled (no endpoint configured)');
        return disposables;
    }
    logger.info(MODULE, `Heartbeat enabled, endpoint: ${endpoint.replace(/\/\/.*@/, '//***@')}`);
    executeHeartbeat();
    heartbeatTimer = setInterval(() => {
        executeHeartbeat();
    }, DEFAULT_INTERVAL_MS);
    const configListener = vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('cursorSecurity.heartbeatEndpoint')) {
            const newEndpoint = config.get('heartbeatEndpoint', '');
            if (!newEndpoint && heartbeatTimer) {
                clearInterval(heartbeatTimer);
                heartbeatTimer = null;
                logger.info(MODULE, 'Heartbeat disabled');
            }
            else if (newEndpoint && !heartbeatTimer) {
                heartbeatTimer = setInterval(() => executeHeartbeat(), DEFAULT_INTERVAL_MS);
                logger.info(MODULE, 'Heartbeat re-enabled');
                executeHeartbeat();
            }
        }
    });
    disposables.push(configListener);
    disposables.push({
        dispose: () => {
            if (heartbeatTimer) {
                clearInterval(heartbeatTimer);
                heartbeatTimer = null;
            }
        }
    });
    return disposables;
}
function getLastHeartbeatTime() {
    return lastHeartbeatTime;
}
function isHeartbeatSuccessful() {
    return lastHeartbeatSuccess;
}
function forceHeartbeat() {
    executeHeartbeat();
}
//# sourceMappingURL=heartbeat.js.map