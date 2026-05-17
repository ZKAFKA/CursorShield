import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import * as logger from '../utils/logger';
import { isTamperDetected } from './antiTamper';

const MODULE = 'Heartbeat';
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

interface HeartbeatPayload {
    timestamp: string;
    extensionId: string;
    extensionVersion: string;
    status: {
        active: boolean;
        tamperDetected: boolean;
        accountEmail: string | null;
        accountCompliant: boolean | null;
        gitOriginUrl: string | null;
        gitCompliant: boolean | null;
        mcpCount: number;
        skillCount: number;
        unauthorizedMCPs: number;
        unauthorizedSkills: number;
        lastLeakCount: number;
        hasLeak: boolean;
    };
}

let heartbeatTimer: NodeJS.Timeout | null = null;
let lastHeartbeatTime: string | null = null;
let lastHeartbeatSuccess: boolean = false;

function buildPayload(): HeartbeatPayload {
    const config = vscode.workspace.getConfiguration('cursorSecurity');

    return {
        timestamp: new Date().toISOString(),
        extensionId: 'cursor-shield.cursor-shield',
        extensionVersion: '1.0.0',
        status: {
            active: true,
            tamperDetected: isTamperDetected(),
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

function sendHeartbeat(endpoint: string, payload: HeartbeatPayload): Promise<boolean> {
    return new Promise((resolve) => {
        try {
            const url = new URL(endpoint);
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

            const reqHandler = (res: http.IncomingMessage) => {
                let body = '';
                res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        logger.info(MODULE, `Heartbeat sent successfully (${res.statusCode})`);
                        resolve(true);
                    } else {
                        logger.warn(MODULE, `Heartbeat failed: HTTP ${res.statusCode}`);
                        resolve(false);
                    }
                });
            };

            const errorHandler = (err: Error) => {
                logger.warn(MODULE, `Heartbeat network error: ${err.message}`);
                resolve(false);
            };

            let req: http.ClientRequest;
            if (url.protocol === 'https:') {
                req = https.request(options, reqHandler);
            } else {
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
        } catch (err) {
            logger.error(MODULE, `Heartbeat send error: ${err}`);
            resolve(false);
        }
    });
}

async function executeHeartbeat(): Promise<void> {
    const config = vscode.workspace.getConfiguration('cursorSecurity');
    const endpoint = config.get<string>('heartbeatEndpoint', '');

    if (!endpoint) {
        return;
    }

    logger.info(MODULE, 'Sending heartbeat...');

    const payload = buildPayload();

    try {
        const result = await sendHeartbeat(endpoint, payload);
        lastHeartbeatSuccess = result;
        lastHeartbeatTime = new Date().toISOString();
    } catch (err) {
        logger.error(MODULE, `Heartbeat execution failed: ${err}`);
        lastHeartbeatSuccess = false;
    }
}

export function registerHeartbeat(context: vscode.ExtensionContext): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];

    const config = vscode.workspace.getConfiguration('cursorSecurity');
    const endpoint = config.get<string>('heartbeatEndpoint', '');

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
            const newEndpoint = config.get<string>('heartbeatEndpoint', '');
            if (!newEndpoint && heartbeatTimer) {
                clearInterval(heartbeatTimer);
                heartbeatTimer = null;
                logger.info(MODULE, 'Heartbeat disabled');
            } else if (newEndpoint && !heartbeatTimer) {
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

export function getLastHeartbeatTime(): string | null {
    return lastHeartbeatTime;
}

export function isHeartbeatSuccessful(): boolean {
    return lastHeartbeatSuccess;
}

export function forceHeartbeat(): void {
    executeHeartbeat();
}