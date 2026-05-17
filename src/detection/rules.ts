import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as logger from '../utils/logger';

const MODULE = 'Rules';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface Rule {
    id: string;
    description: string;
    regex: RegExp;
    severity: Severity;
    source: 'built-in' | 'custom' | 'gitleaks';
}

export interface MatchResult {
    file: string;
    line: number;
    column: number;
    match: string;
    masked: string;
    rule: Rule;
}

let baselineHashes: Set<string> = new Set();
let baselineLoaded = false;

const BUILT_IN_RULES: Omit<Rule, 'source'>[] = [
    {
        id: 'aws-access-key',
        description: 'AWS Access Key ID',
        regex: /AKIA[0-9A-Z]{16}/g,
        severity: 'critical'
    },
    {
        id: 'aws-secret-key',
        description: 'AWS Secret Access Key',
        regex: /(?<![A-Za-z0-9/+])[A-Za-z0-9/+]{40}(?![A-Za-z0-9/+])/g,
        severity: 'critical'
    },
    {
        id: 'github-personal-token',
        description: 'GitHub Personal Access Token',
        regex: /ghp_[0-9a-zA-Z]{36}/g,
        severity: 'critical'
    },
    {
        id: 'github-oauth-token',
        description: 'GitHub OAuth Access Token',
        regex: /gho_[0-9a-zA-Z]{36}/g,
        severity: 'critical'
    },
    {
        id: 'github-app-token',
        description: 'GitHub App Token',
        regex: /ghu_[0-9a-zA-Z]{36}/g,
        severity: 'critical'
    },
    {
        id: 'gitlab-token',
        description: 'GitLab Personal Access Token',
        regex: /glpat-[0-9a-zA-Z\-]{20,}/g,
        severity: 'critical'
    },
    {
        id: 'gitlab-runner-token',
        description: 'GitLab Runner Registration Token',
        regex: /GR1348941[0-9a-zA-Z\-]{20,}/g,
        severity: 'critical'
    },
    {
        id: 'slack-bot-token',
        description: 'Slack Bot Token',
        regex: /xoxb-[0-9a-zA-Z\-]{10,}/g,
        severity: 'high'
    },
    {
        id: 'slack-user-token',
        description: 'Slack User Token',
        regex: /xoxp-[0-9a-zA-Z\-]{10,}/g,
        severity: 'high'
    },
    {
        id: 'slack-app-token',
        description: 'Slack App Token',
        regex: /xapp-[0-9a-zA-Z\-]{10,}/g,
        severity: 'high'
    },
    {
        id: 'slack-webhook',
        description: 'Slack Webhook URL',
        regex: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/[A-Za-z0-9]+/g,
        severity: 'high'
    },
    {
        id: 'private-key-rsa',
        description: 'RSA Private Key',
        regex: /-----BEGIN RSA PRIVATE KEY-----/g,
        severity: 'critical'
    },
    {
        id: 'private-key-dsa',
        description: 'DSA Private Key',
        regex: /-----BEGIN DSA PRIVATE KEY-----/g,
        severity: 'critical'
    },
    {
        id: 'private-key-ec',
        description: 'EC Private Key',
        regex: /-----BEGIN EC PRIVATE KEY-----/g,
        severity: 'critical'
    },
    {
        id: 'private-key-openssh',
        description: 'OpenSSH Private Key',
        regex: /-----BEGIN OPENSSH PRIVATE KEY-----/g,
        severity: 'critical'
    },
    {
        id: 'private-key-pgp',
        description: 'PGP Private Key',
        regex: /-----BEGIN PGP PRIVATE KEY BLOCK-----/g,
        severity: 'critical'
    },
    {
        id: 'jdbc-connection',
        description: 'JDBC Connection String',
        regex: /jdbc:[a-z]+:\/\/[^:]+:[^@]+@[^\s"']+/gi,
        severity: 'high'
    },
    {
        id: 'mongodb-connection',
        description: 'MongoDB Connection String',
        regex: /mongodb(?:\+srv)?:\/\/[^:]+:[^@]+@[^\s"']+/gi,
        severity: 'high'
    },
    {
        id: 'mysql-connection',
        description: 'MySQL Connection String',
        regex: /mysql:\/\/[^:]+:[^@]+@[^\s"']+/gi,
        severity: 'high'
    },
    {
        id: 'postgresql-connection',
        description: 'PostgreSQL Connection String',
        regex: /postgresql:\/\/[^:]+:[^@]+@[^\s"']+/gi,
        severity: 'high'
    },
    {
        id: 'generic-api-key',
        description: 'Generic API Key Pattern',
        regex: /(api[_-]?key|apikey|secret|token|password|passwd|auth)\s*[:=]\s*['"][^'"]{16,}['"]/gi,
        severity: 'high'
    },
    {
        id: 'heroku-api-key',
        description: 'Heroku API Key',
        regex: /[hH][eE][rR][oO][kK][uU].*[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/g,
        severity: 'high'
    },
    {
        id: 'stripe-api-key',
        description: 'Stripe API Key',
        regex: /(?:sk|rk)_(?:live|test)_[0-9a-zA-Z]{24,}/g,
        severity: 'critical'
    },
    {
        id: 'google-api-key',
        description: 'Google API Key',
        regex: /AIza[0-9A-Za-z\-_]{35}/g,
        severity: 'high'
    },
    {
        id: 'azure-storage-key',
        description: 'Azure Storage Account Key',
        regex: /DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[^;]+/g,
        severity: 'critical'
    },
    {
        id: 'jwt-token',
        description: 'JWT Token',
        regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
        severity: 'medium'
    }
];

function getWorkspaceRoot(): string | null {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return null;
    }
    return folders[0].uri.fsPath;
}

function loadBaselineFile(): void {
    if (baselineLoaded) {
        return;
    }

    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        baselineLoaded = true;
        return;
    }

    const baselinePath = path.join(workspaceRoot, '.secrets.baseline');
    if (!fs.existsSync(baselinePath)) {
        baselineLoaded = true;
        return;
    }

    try {
        const content = fs.readFileSync(baselinePath, 'utf-8');
        const data = JSON.parse(content);

        if (data.results && typeof data.results === 'object') {
            for (const result of Object.values(data.results) as Array<{ hashed_secret?: string }>) {
                if (result.hashed_secret) {
                    baselineHashes.add(result.hashed_secret);
                }
            }
        }

        logger.info(MODULE, `Loaded ${baselineHashes.size} entries from baseline file`);
    } catch (err) {
        logger.warn(MODULE, `Failed to load baseline file: ${err}`);
    }

    baselineLoaded = true;
}

function parseCustomRulesToml(content: string): Omit<Rule, 'source'>[] {
    const rules: Omit<Rule, 'source'>[] = [];
    const lines = content.split('\n');

    let currentRule: Partial<{ id: string; description: string; regex: string; severity: Severity }> = {};
    let inRulesArray = false;

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('[[rules]]')) {
            if (currentRule.id && currentRule.regex) {
                try {
                    rules.push({
                        id: currentRule.id,
                        description: currentRule.description || currentRule.id,
                        regex: new RegExp(currentRule.regex, 'g'),
                        severity: currentRule.severity || 'high'
                    });
                } catch {
                    logger.warn(MODULE, `Invalid regex in custom rule: ${currentRule.id}`);
                }
            }
            currentRule = {};
            inRulesArray = true;
            continue;
        }

        if (!inRulesArray) {
            continue;
        }

        const match = trimmed.match(/^(\w+)\s*=\s*["'](.+)["']\s*$/);
        if (match) {
            const [, key, value] = match;
            if (key === 'id') { currentRule.id = value; }
            if (key === 'description') { currentRule.description = value; }
            if (key === 'regex') { currentRule.regex = value; }
            if (key === 'severity') { currentRule.severity = value as Severity; }
        }
    }

    if (currentRule.id && currentRule.regex) {
        try {
            rules.push({
                id: currentRule.id,
                description: currentRule.description || currentRule.id,
                regex: new RegExp(currentRule.regex, 'g'),
                severity: currentRule.severity || 'high'
            });
        } catch {
            logger.warn(MODULE, `Invalid regex in custom rule: ${currentRule.id}`);
        }
    }

    return rules;
}

function loadCustomRules(): Rule[] {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        return [];
    }

    const config = vscode.workspace.getConfiguration('cursorSecurity');
    const customPath = config.get<string>('customRulesPath', '.cursor-security-rules.toml');
    const fullPath = path.isAbsolute(customPath)
        ? customPath
        : path.join(workspaceRoot, customPath);

    if (!fs.existsSync(fullPath)) {
        logger.info(MODULE, `Custom rules file not found: ${fullPath}`);
        return [];
    }

    try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const rules = parseCustomRulesToml(content);
        logger.info(MODULE, `Loaded ${rules.length} custom rules from ${customPath}`);
        return rules.map(r => ({ ...r, source: 'custom' as const }));
    } catch (err) {
        logger.error(MODULE, `Failed to load custom rules: ${err}`);
        return [];
    }
}

function loadGitleaksRules(): Rule[] {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        return [];
    }

    const gitleaksPath = path.join(workspaceRoot, '.gitleaks.toml');
    if (!fs.existsSync(gitleaksPath)) {
        return [];
    }

    try {
        const content = fs.readFileSync(gitleaksPath, 'utf-8');
        const rules: Rule[] = [];
        const lines = content.split('\n');

        let currentRule: Partial<{ id: string; description: string; regex: string }> = {};
        let inRulesArray = false;

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.startsWith('[[rules]]')) {
                if (currentRule.id && currentRule.regex) {
                    try {
                        rules.push({
                            id: `gitleaks-${currentRule.id}`,
                            description: currentRule.description || currentRule.id,
                            regex: new RegExp(currentRule.regex, 'g'),
                            severity: 'high',
                            source: 'gitleaks'
                        });
                    } catch { /* skip */ }
                }
                currentRule = {};
                inRulesArray = true;
                continue;
            }

            if (!inRulesArray) {
                continue;
            }

            const match = trimmed.match(/^(\w+)\s*=\s*["'](.+)["']\s*$/);
            if (match) {
                const [, key, value] = match;
                if (key === 'id') { currentRule.id = value; }
                if (key === 'description') { currentRule.description = value; }
                if (key === 'regex') { currentRule.regex = value; }
            }
        }

        if (currentRule.id && currentRule.regex) {
            try {
                rules.push({
                    id: `gitleaks-${currentRule.id}`,
                    description: currentRule.description || currentRule.id,
                    regex: new RegExp(currentRule.regex, 'g'),
                    severity: 'high',
                    source: 'gitleaks'
                });
            } catch { /* skip */ }
        }

        logger.info(MODULE, `Loaded ${rules.length} rules from .gitleaks.toml`);
        return rules;
    } catch (err) {
        logger.warn(MODULE, `Failed to load gitleaks rules: ${err}`);
        return [];
    }
}

export function getActiveRules(): Rule[] {
    loadBaselineFile();

    const config = vscode.workspace.getConfiguration('cursorSecurity');
    const ruleSource: string = config.get('sensitiveRules', 'built-in');

    const rules: Rule[] = [];

    if (ruleSource === 'built-in' || ruleSource === 'both') {
        rules.push(...BUILT_IN_RULES.map(r => ({ ...r, source: 'built-in' as const })));
    }

    if (ruleSource === 'custom' || ruleSource === 'both') {
        rules.push(...loadCustomRules());
    }

    rules.push(...loadGitleaksRules());

    logger.info(MODULE, `Active rules: ${rules.length}`);
    return rules;
}

export function maskMatch(match: string): string {
    if (match.length <= 6) {
        return '****';
    }
    return match.substring(0, 4) + '****' + match.substring(match.length - 4);
}

export function resetBaseline(): void {
    baselineHashes.clear();
    baselineLoaded = false;
}

export function getBuiltInRuleCount(): number {
    return BUILT_IN_RULES.length;
}