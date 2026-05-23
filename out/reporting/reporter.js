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
exports.startReporting = startReporting;
const vscode = __importStar(require("vscode"));
const os = __importStar(require("os"));
const logger = __importStar(require("../utils/logger"));
const account_1 = require("../monitors/account");
const gitRemote_1 = require("../monitors/gitRemote");
const mcpSkill_1 = require("../monitors/mcpSkill");
const engine_1 = require("../detection/engine");
const MODULE = 'Reporter';
function collectDetections(summary) {
    if (!summary || !summary.matches)
        return [];
    return summary.matches.slice(0, 200).map((m) => ({
        type: m.rule.description,
        severity: m.rule.severity,
        file: m.file,
        line: m.line,
        masked: m.masked,
        timestamp: Date.now(),
        status: 'active'
    }));
}
function computeRiskScore(account, git, mcpSkill, summary) {
    let score = 0;
    if (!account.isCompliant) {
        score += 15;
        if (account.changeType === 'switch' || account.changeType === 'logout')
            score += 10;
    }
    if (git.originUrl && !git.isCompliant)
        score += 10;
    if (mcpSkill.unauthorizedMCPs > 0)
        score += mcpSkill.unauthorizedMCPs * 3;
    if (mcpSkill.unauthorizedSkills > 0)
        score += mcpSkill.unauthorizedSkills * 2;
    if (summary) {
        const critical = summary.matchesBySeverity['critical'] || 0;
        const high = summary.matchesBySeverity['high'] || 0;
        const medium = summary.matchesBySeverity['medium'] || 0;
        score += critical * 5 + high * 3 + medium * 1;
    }
    return Math.min(100, score);
}
function collectDeviceReport(config) {
    const account = (0, account_1.getCurrentStatus)();
    const git = (0, gitRemote_1.getCurrentStatus)();
    const mcpSkill = (0, mcpSkill_1.getCurrentStatus)();
    const summary = (0, engine_1.getLastScanSummary)();
    const allowedRepos = config.get('allowedRepos', []);
    const remotes = (0, gitRemote_1.getRemotesWithCompliance)(git.repoPath, allowedRepos);
    const detections = collectDetections(summary);
    let criticalLeaks = 0;
    let highLeaks = 0;
    let mediumLeaks = 0;
    for (const d of detections) {
        if (d.severity === 'critical')
            criticalLeaks++;
        else if (d.severity === 'high')
            highLeaks++;
        else if (d.severity === 'medium')
            mediumLeaks++;
    }
    const deviceId = config.get('deviceName', '') || os.hostname();
    const deviceName = config.get('deviceName', '') || os.hostname();
    return {
        deviceId,
        deviceName,
        os: `${os.platform()} ${os.release()}`,
        employeeName: account.email || deviceName,
        account,
        git: { ...git, remotes },
        mcpSkill,
        sensitiveInfo: {
            totalLeaks: detections.length,
            criticalLeaks,
            highLeaks,
            mediumLeaks,
            detections
        },
        riskScore: computeRiskScore(account, git, mcpSkill, summary)
    };
}
async function sendReport(serverUrl, token, data) {
    const body = JSON.stringify(data);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch(`${serverUrl}/api/report`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body,
            signal: controller.signal
        });
        if (!response.ok) {
            logger.warn(MODULE, `Report failed: HTTP ${response.status} ${response.statusText}`);
        }
        else {
            logger.info(MODULE, `Report sent: ${data.deviceId} risk=${data.riskScore}`);
        }
    }
    catch (err) {
        if (err.name === 'AbortError')
            return;
        logger.warn(MODULE, `Report network error: ${err.message}`);
    }
    finally {
        clearTimeout(timeout);
    }
}
function startReporting(context) {
    const config = vscode.workspace.getConfiguration('cursorSecurity');
    const serverUrl = config.get('reportServerUrl', '');
    if (!serverUrl) {
        logger.info(MODULE, 'Reporting disabled (no reportServerUrl configured)');
        return { dispose() { } };
    }
    const token = config.get('reportToken', '');
    const interval = Math.max(5000, config.get('reportInterval', 30000));
    logger.info(MODULE, `Reporting enabled: url=${serverUrl}, interval=${interval}ms`);
    (async () => {
        try {
            const data = collectDeviceReport(config);
            await sendReport(serverUrl, token, data);
        }
        catch { /* silent */ }
    })();
    const timer = setInterval(async () => {
        try {
            const data = collectDeviceReport(config);
            await sendReport(serverUrl, token, data);
        }
        catch { /* silent - timer failure should not crash */ }
    }, interval);
    return { dispose: () => clearInterval(timer) };
}
//# sourceMappingURL=reporter.js.map