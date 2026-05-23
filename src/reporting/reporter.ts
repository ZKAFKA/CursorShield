import * as vscode from 'vscode';
import * as os from 'os';
import * as logger from '../utils/logger';
import { AccountStatus, getCurrentStatus as getAccountStatus } from '../monitors/account';
import { GitRepoStatus, getCurrentStatus as getGitStatus, getRemotesWithCompliance } from '../monitors/gitRemote';
import { MCPSkillStatus, getCurrentStatus as getMCPSkillStatus } from '../monitors/mcpSkill';
import { getLastScanSummary, ScanSummary, MatchResult } from '../detection/engine';

const MODULE = 'Reporter';

interface RemoteInfo {
    name: string;
    url: string;
    isCompliant: boolean;
}

interface DetectionInfo {
    type: string;
    severity: string;
    file: string;
    line: number;
    masked: string;
    timestamp: number;
    status: 'active' | 'resolved';
}

interface DeviceReport {
    deviceId: string;
    deviceName: string;
    os: string;
    employeeName: string;
    account: AccountStatus;
    git: GitRepoStatus & { remotes: RemoteInfo[] };
    mcpSkill: MCPSkillStatus;
    sensitiveInfo: {
        totalLeaks: number;
        criticalLeaks: number;
        highLeaks: number;
        mediumLeaks: number;
        detections: DetectionInfo[];
    };
    riskScore: number;
}

function collectDetections(summary: ScanSummary | null): DetectionInfo[] {
    if (!summary || !summary.matches) return [];
    return summary.matches.slice(0, 200).map((m: MatchResult) => ({
        type: m.rule.description,
        severity: m.rule.severity,
        file: m.file,
        line: m.line,
        masked: m.masked,
        timestamp: Date.now(),
        status: 'active' as const
    }));
}

function computeRiskScore(
    account: AccountStatus,
    git: GitRepoStatus,
    mcpSkill: MCPSkillStatus,
    summary: ScanSummary | null
): number {
    let score = 0;
    if (!account.isCompliant) {
        score += 15;
        if (account.changeType === 'switch' || account.changeType === 'logout') score += 10;
    }
    if (git.originUrl && !git.isCompliant) score += 10;
    if (mcpSkill.unauthorizedMCPs > 0) score += mcpSkill.unauthorizedMCPs * 3;
    if (mcpSkill.unauthorizedSkills > 0) score += mcpSkill.unauthorizedSkills * 2;
    if (summary) {
        const critical = summary.matchesBySeverity['critical'] || 0;
        const high = summary.matchesBySeverity['high'] || 0;
        const medium = summary.matchesBySeverity['medium'] || 0;
        score += critical * 5 + high * 3 + medium * 1;
    }
    return Math.min(100, score);
}

function collectDeviceReport(config: vscode.WorkspaceConfiguration): DeviceReport {
    const account = getAccountStatus();
    const git = getGitStatus();
    const mcpSkill = getMCPSkillStatus();
    const summary = getLastScanSummary();

    const allowedRepos: string[] = config.get('allowedRepos', []);
    const remotes = getRemotesWithCompliance(git.repoPath, allowedRepos);

    const detections = collectDetections(summary);

    let criticalLeaks = 0;
    let highLeaks = 0;
    let mediumLeaks = 0;
    for (const d of detections) {
        if (d.severity === 'critical') criticalLeaks++;
        else if (d.severity === 'high') highLeaks++;
        else if (d.severity === 'medium') mediumLeaks++;
    }

    const deviceId = config.get<string>('deviceName', '') || os.hostname();
    const deviceName = config.get<string>('deviceName', '') || os.hostname();

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

async function sendReport(serverUrl: string, token: string, data: DeviceReport): Promise<void> {
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
        } else {
            logger.info(MODULE, `Report sent: ${data.deviceId} risk=${data.riskScore}`);
        }
    } catch (err: any) {
        if (err.name === 'AbortError') return;
        logger.warn(MODULE, `Report network error: ${err.message}`);
    } finally {
        clearTimeout(timeout);
    }
}

export function startReporting(context: vscode.ExtensionContext): vscode.Disposable {
    const config = vscode.workspace.getConfiguration('cursorSecurity');
    const serverUrl = config.get<string>('reportServerUrl', '');

    if (!serverUrl) {
        logger.info(MODULE, 'Reporting disabled (no reportServerUrl configured)');
        return { dispose() {} };
    }

    const token = config.get<string>('reportToken', '');
    const interval = Math.max(5000, config.get<number>('reportInterval', 30000));

    logger.info(MODULE, `Reporting enabled: url=${serverUrl}, interval=${interval}ms`);

    (async () => {
        try {
            const data = collectDeviceReport(config);
            await sendReport(serverUrl, token, data);
        } catch { /* silent */ }
    })();

    const timer = setInterval(async () => {
        try {
            const data = collectDeviceReport(config);
            await sendReport(serverUrl, token, data);
        } catch { /* silent - timer failure should not crash */ }
    }, interval);

    return { dispose: () => clearInterval(timer) };
}