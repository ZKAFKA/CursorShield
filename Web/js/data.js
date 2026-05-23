var MOCK_EMPLOYEES = [
  {
    id: "EMP-001",
    name: "Marcus Holloway",
    deviceId: "MAC-8892-Z",
    deviceName: "Marcus-MacBook-Pro",
    os: "macOS 14.5",
    lastSync: Date.now() - 2 * 60 * 1000,
    account: {
      email: "m.holloway@personal.me",
      domain: "personal.me",
      accountId: "USR-8829-001",
      organization: "Mainnet Ops",
      isCompliant: false,
      reason: 'Email domain "personal.me" is NOT in the allowed list',
      checked: true,
      changeType: "switch",
      changedFrom: "m.holloway@company.com"
    },
    git: {
      repoPath: "/Users/marcus/projects/main-engine",
      originUrl: "https://github.com/personal/main-engine.git",
      isCompliant: false,
      reason: 'Repository "personal/main-engine" is NOT in the allowed list',
      checked: true,
      remotes: [
        { name: "origin", url: "https://github.com/personal/main-engine.git", isCompliant: false },
        { name: "upstream", url: "https://github.com/company/main-engine.git", isCompliant: true }
      ]
    },
    mcpSkill: {
      mcpCount: 6,
      skillCount: 4,
      unauthorizedMCPs: 2,
      unauthorizedSkills: 1,
      checked: true,
      mcps: [
        { name: "PostgreSQL", command: "npx", args: ["-y", "@cursor/mcp-postgres"], envKeys: ["PGHOST", "PGPASSWORD"], isBlocked: false, isAuthorized: true },
        { name: "Filesystem", command: "npx", args: ["-y", "@cursor/mcp-filesystem"], envKeys: [], isBlocked: true, isAuthorized: false },
        { name: "Web Search", command: "npx", args: ["-y", "@cursor/mcp-search"], envKeys: [], isBlocked: false, isAuthorized: true },
        { name: "Docker Engine", command: "docker", args: ["compose", "up"], envKeys: ["DOCKER_HOST"], isBlocked: false, isAuthorized: true },
        { name: "Slack API", command: "node", args: ["slack-mcp.js"], envKeys: ["SLACK_TOKEN"], isBlocked: true, isAuthorized: false },
        { name: "GitHub CLI", command: "gh", args: ["api"], envKeys: ["GITHUB_TOKEN"], isBlocked: false, isAuthorized: true }
      ],
      skills: [
        { name: "code-review", description: "Automated code review with security analysis", path: ".cursor/skills/code-review", isAuthorized: true },
        { name: "deploy-pipeline", description: "CI/CD deployment pipeline helper", path: ".cursor/skills/deploy-pipeline", isAuthorized: false },
        { name: "db-migration", description: "Database schema migration assistant", path: ".cursor/skills/db-migration", isAuthorized: true },
        { name: "log-analyzer", description: "Real-time log analysis and anomaly detection", path: ".cursor/skills/log-analyzer", isAuthorized: true }
      ]
    },
    sensitiveInfo: {
      totalLeaks: 12,
      criticalLeaks: 4,
      highLeaks: 6,
      mediumLeaks: 2,
      detections: [
        { type: "AWS_SECRET_ACCESS_KEY", severity: "critical", file: "~/projects/alpha/config.yaml", line: 42, masked: "AKIA****ABCD", timestamp: Date.now() - 5 * 60 * 1000, status: "active" },
        { type: "PRIVATE_SSH_KEY", severity: "high", file: "~/temp/deploy_rsa", line: 1, masked: "-----BEGIN****KEY-----", timestamp: Date.now() - 30 * 60 * 1000, status: "active" },
        { type: "GITHUB_TOKEN", severity: "critical", file: "~/projects/alpha/.env", line: 15, masked: "ghp_****WXYZ", timestamp: Date.now() - 60 * 60 * 1000, status: "active" },
        { type: "DATABASE_URL", severity: "high", file: "~/projects/alpha/config/db.js", line: 8, masked: "postgres://****", timestamp: Date.now() - 2 * 60 * 60 * 1000, status: "active" },
        { type: "JWT_SECRET", severity: "critical", file: "~/projects/alpha/config/auth.js", line: 23, masked: "eyJh****R5c", timestamp: Date.now() - 4 * 60 * 60 * 1000, status: "active" },
        { type: "NPM_AUTH_TOKEN", severity: "high", file: "~/.npmrc", line: 3, masked: "npm_****5678", timestamp: Date.now() - 8 * 60 * 60 * 1000, status: "resolved" },
        { type: "AZURE_STORAGE_KEY", severity: "critical", file: "~/projects/alpha/terraform/vars.tf", line: 67, masked: "DefaultEnd****==", timestamp: Date.now() - 12 * 60 * 60 * 1000, status: "active" }
      ]
    },
    riskScore: 42
  },
  {
    id: "EMP-002",
    name: "Elena Rodriguez",
    deviceId: "WIN-2231-A",
    deviceName: "ELENA-DESKTOP",
    os: "Windows 11 Pro",
    lastSync: Date.now() - 14 * 60 * 1000,
    account: {
      email: "e.rodriguez@company.com",
      domain: "company.com",
      accountId: "USR-5541-002",
      organization: "Data Platforms",
      isCompliant: true,
      reason: 'Email domain "company.com" is in the allowed list',
      checked: true,
      changeType: null,
      changedFrom: null
    },
    git: {
      repoPath: "C:\\Users\\elena\\projects\\data-lake",
      originUrl: "https://github.com/company/data-lake.git",
      isCompliant: true,
      reason: 'Repository "company/data-lake" is in the allowed list',
      checked: true,
      remotes: [
        { name: "origin", url: "https://github.com/company/data-lake.git", isCompliant: true }
      ]
    },
    mcpSkill: {
      mcpCount: 4,
      skillCount: 3,
      unauthorizedMCPs: 0,
      unauthorizedSkills: 0,
      checked: true,
      mcps: [
        { name: "PostgreSQL", command: "npx", args: ["-y", "@cursor/mcp-postgres"], envKeys: ["PGHOST"], isBlocked: false, isAuthorized: true },
        { name: "Redis Cache", command: "docker", args: ["run", "redis-mcp"], envKeys: ["REDIS_URL"], isBlocked: false, isAuthorized: true },
        { name: "Web Search", command: "npx", args: ["-y", "@cursor/mcp-search"], envKeys: [], isBlocked: false, isAuthorized: true },
        { name: "Snowflake", command: "python", args: ["snowflake_mcp.py"], envKeys: ["SNOWFLAKE_ACCOUNT"], isBlocked: false, isAuthorized: true }
      ],
      skills: [
        { name: "data-pipeline", description: "ETL pipeline generation and validation", path: ".cursor/skills/data-pipeline", isAuthorized: true },
        { name: "schema-designer", description: "Database schema design assistant", path: ".cursor/skills/schema-designer", isAuthorized: true },
        { name: "query-optimizer", description: "SQL query performance optimization", path: ".cursor/skills/query-optimizer", isAuthorized: true }
      ]
    },
    sensitiveInfo: {
      totalLeaks: 0,
      criticalLeaks: 0,
      highLeaks: 0,
      mediumLeaks: 0,
      detections: []
    },
    riskScore: 2
  },
  {
    id: "EMP-003",
    name: "Julian Chen",
    deviceId: "MAC-0012-K",
    deviceName: "Julians-MBP",
    os: "macOS 15.0",
    lastSync: Date.now() - 60 * 60 * 1000,
    account: {
      email: "j.chen@company.com",
      domain: "company.com",
      accountId: "USR-3390-003",
      organization: "Frontend Ops",
      isCompliant: true,
      reason: 'Email domain "company.com" is in the allowed list',
      checked: true,
      changeType: null,
      changedFrom: null
    },
    git: {
      repoPath: "/Users/julian/projects/web-app",
      originUrl: "https://github.com/freelance/side-project.git",
      isCompliant: false,
      reason: 'Repository "freelance/side-project" is NOT in the allowed list',
      checked: true,
      remotes: [
        { name: "origin", url: "https://github.com/freelance/side-project.git", isCompliant: false }
      ]
    },
    mcpSkill: {
      mcpCount: 5,
      skillCount: 3,
      unauthorizedMCPs: 0,
      unauthorizedSkills: 0,
      checked: true,
      mcps: [
        { name: "Vercel Deploy", command: "npx", args: ["-y", "vercel-mcp"], envKeys: ["VERCEL_TOKEN"], isBlocked: false, isAuthorized: true },
        { name: "Figma API", command: "node", args: ["figma-mcp.js"], envKeys: ["FIGMA_TOKEN"], isBlocked: false, isAuthorized: true },
        { name: "Chrome DevTools", command: "npx", args: ["-y", "@cursor/mcp-chrome"], envKeys: [], isBlocked: false, isAuthorized: true },
        { name: "Storybook", command: "npx", args: ["-y", "@cursor/mcp-storybook"], envKeys: [], isBlocked: false, isAuthorized: true },
        { name: "Tailwind CSS", command: "npx", args: ["-y", "@cursor/mcp-tailwind"], envKeys: [], isBlocked: false, isAuthorized: true }
      ],
      skills: [
        { name: "component-gen", description: "React component boilerplate generator", path: ".cursor/skills/component-gen", isAuthorized: true },
        { name: "css-refactor", description: "CSS refactoring and optimization", path: ".cursor/skills/css-refactor", isAuthorized: true },
        { name: "a11y-audit", description: "Accessibility audit and fix suggestions", path: ".cursor/skills/a11y-audit", isAuthorized: true }
      ]
    },
    sensitiveInfo: {
      totalLeaks: 1,
      criticalLeaks: 0,
      highLeaks: 0,
      mediumLeaks: 1,
      detections: [
        { type: "GOOGLE_MAPS_API_KEY", severity: "medium", file: "~/projects/web-app/src/config/api.ts", line: 12, masked: "AIza****efg", timestamp: Date.now() - 3 * 60 * 60 * 1000, status: "active" }
      ]
    },
    riskScore: 15
  },
  {
    id: "EMP-004",
    name: "Sarah Mitchell",
    deviceId: "WIN-9001-B",
    deviceName: "SARAH-WORKSTATION",
    os: "Windows 10 Enterprise",
    lastSync: Date.now() - 8 * 60 * 1000,
    account: {
      email: "s.mitchell@1ce8f95b71b046f39261e5157a68bc15",
      domain: "1ce8f95b71b046f39261e5157a68bc15",
      accountId: "USR-7782-004",
      organization: "Security Engineering",
      isCompliant: false,
      reason: 'Email domain is NOT in the allowed list',
      checked: true,
      changeType: "non_compliant",
      changedFrom: null
    },
    git: {
      repoPath: "C:\\Users\\sarah\\projects\\security-audit",
      originUrl: "https://github.com/company/security-audit.git",
      isCompliant: true,
      reason: 'Repository "company/security-audit" is in the allowed list',
      checked: true,
      remotes: [
        { name: "origin", url: "https://github.com/company/security-audit.git", isCompliant: true }
      ]
    },
    mcpSkill: {
      mcpCount: 8,
      skillCount: 5,
      unauthorizedMCPs: 3,
      unauthorizedSkills: 2,
      checked: true,
      mcps: [
        { name: "Splunk Query", command: "python", args: ["splunk_mcp.py"], envKeys: ["SPLUNK_TOKEN"], isBlocked: false, isAuthorized: true },
        { name: "AWS CLI", command: "aws", args: ["--region", "us-east-1"], envKeys: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"], isBlocked: true, isAuthorized: false },
        { name: "Terraform", command: "terraform", args: ["plan"], envKeys: ["TF_VAR_token"], isBlocked: false, isAuthorized: true },
        { name: "Ansible", command: "ansible-playbook", args: [], envKeys: ["ANSIBLE_VAULT_PASSWORD"], isBlocked: true, isAuthorized: false },
        { name: "Kubernetes", command: "kubectl", args: ["get", "pods"], envKeys: ["KUBECONFIG"], isBlocked: false, isAuthorized: true },
        { name: "Vault CLI", command: "vault", args: ["read", "secret/data"], envKeys: ["VAULT_TOKEN"], isBlocked: false, isAuthorized: true },
        { name: "Nessus Scanner", command: "python", args: ["nessus.py"], envKeys: ["NESSUS_KEY"], isBlocked: true, isAuthorized: false },
        { name: "Wireshark MCP", command: "tshark", args: ["-i", "eth0"], envKeys: [], isBlocked: false, isAuthorized: true }
      ],
      skills: [
        { name: "vuln-scanner", description: "Vulnerability scanning and CVE lookup", path: ".cursor/skills/vuln-scanner", isAuthorized: true },
        { name: "incident-response", description: "Incident response playbook automation", path: ".cursor/skills/incident-response", isAuthorized: false },
        { name: "compliance-check", description: "SOC2/ISO27001 compliance verification", path: ".cursor/skills/compliance-check", isAuthorized: false },
        { name: "threat-model", description: "Threat modeling with STRIDE methodology", path: ".cursor/skills/threat-model", isAuthorized: true },
        { name: "forensics", description: "Digital forensics artifact collection", path: ".cursor/skills/forensics", isAuthorized: true }
      ]
    },
    sensitiveInfo: {
      totalLeaks: 8,
      criticalLeaks: 3,
      highLeaks: 4,
      mediumLeaks: 1,
      detections: [
        { type: "AWS_SECRET_ACCESS_KEY", severity: "critical", file: "~/projects/security-audit/aws-creds.json", line: 5, masked: "wJalr****F7x", timestamp: Date.now() - 10 * 60 * 1000, status: "active" },
        { type: "SSH_PRIVATE_KEY", severity: "critical", file: "~/projects/security-audit/keys/deploy.pem", line: 1, masked: "-----BEGIN****KEY-----", timestamp: Date.now() - 20 * 60 * 1000, status: "active" },
        { type: "SLACK_WEBHOOK_URL", severity: "high", file: "~/projects/security-audit/notify.sh", line: 8, masked: "https://hooks****slack", timestamp: Date.now() - 45 * 60 * 1000, status: "active" },
        { type: "DATADOG_API_KEY", severity: "high", file: "~/projects/security-audit/.env.prod", line: 22, masked: "dd_ap****9012", timestamp: Date.now() - 90 * 60 * 1000, status: "active" },
        { type: "SENTRY_DSN", severity: "high", file: "~/projects/security-audit/config/monitoring.yaml", line: 14, masked: "https://a1****.ingest.sentry.io", timestamp: Date.now() - 2 * 60 * 60 * 1000, status: "resolved" }
      ]
    },
    riskScore: 38
  },
  {
    id: "EMP-005",
    name: "David Park",
    deviceId: "MAC-5567-P",
    deviceName: "David-Mac-Studio",
    os: "macOS 14.6",
    lastSync: Date.now() - 25 * 60 * 1000,
    account: {
      email: "d.park@company.com",
      domain: "company.com",
      accountId: "USR-1123-005",
      organization: "Backend Infrastructure",
      isCompliant: true,
      reason: 'Email domain "company.com" is in the allowed list',
      checked: true,
      changeType: null,
      changedFrom: null
    },
    git: {
      repoPath: "/Users/david/projects/api-gateway",
      originUrl: "https://github.com/company/api-gateway.git",
      isCompliant: true,
      reason: 'Repository "company/api-gateway" is in the allowed list',
      checked: true,
      remotes: [
        { name: "origin", url: "https://github.com/company/api-gateway.git", isCompliant: true },
        { name: "mirror", url: "https://gitlab.internal/api-gateway.git", isCompliant: true }
      ]
    },
    mcpSkill: {
      mcpCount: 5,
      skillCount: 4,
      unauthorizedMCPs: 1,
      unauthorizedSkills: 0,
      checked: true,
      mcps: [
        { name: "Kubernetes", command: "kubectl", args: ["get", "pods"], envKeys: ["KUBECONFIG"], isBlocked: false, isAuthorized: true },
        { name: "ArgoCD", command: "argocd", args: ["app", "list"], envKeys: ["ARGOCD_AUTH_TOKEN"], isBlocked: false, isAuthorized: true },
        { name: "Prometheus", command: "curl", args: ["http://prometheus:9090"], envKeys: [], isBlocked: false, isAuthorized: true },
        { name: "Grafana", command: "curl", args: ["http://grafana:3000"], envKeys: ["GRAFANA_API_KEY"], isBlocked: false, isAuthorized: true },
        { name: "External DB Proxy", command: "python", args: ["external_db.py"], envKeys: ["EXTERNAL_DB_PASS"], isBlocked: true, isAuthorized: false }
      ],
      skills: [
        { name: "k8s-manifests", description: "Kubernetes manifest generation and validation", path: ".cursor/skills/k8s-manifests", isAuthorized: true },
        { name: "helm-chart", description: "Helm chart scaffolding and linting", path: ".cursor/skills/helm-chart", isAuthorized: true },
        { name: "api-docs", description: "OpenAPI/Swagger documentation generator", path: ".cursor/skills/api-docs", isAuthorized: true },
        { name: "load-test", description: "K6 load test script generation", path: ".cursor/skills/load-test", isAuthorized: true }
      ]
    },
    sensitiveInfo: {
      totalLeaks: 3,
      criticalLeaks: 1,
      highLeaks: 1,
      mediumLeaks: 1,
      detections: [
        { type: "KUBERNETES_SECRET", severity: "high", file: "~/projects/api-gateway/k8s/secrets.yaml", line: 18, masked: "dGhp****JzZQ", timestamp: Date.now() - 40 * 60 * 1000, status: "active" },
        { type: "GRAFANA_API_KEY", severity: "medium", file: "~/projects/api-gateway/deploy/grafana-dash.json", line: 34, masked: "glc_****jKlm", timestamp: Date.now() - 2 * 60 * 60 * 1000, status: "active" }
      ]
    },
    riskScore: 20
  },
  {
    id: "EMP-006",
    name: "Aisha Patel",
    deviceId: "WIN-3341-C",
    deviceName: "AISHA-LAPTOP",
    os: "Windows 11 Enterprise",
    lastSync: Date.now() - 3 * 60 * 1000,
    account: {
      email: "a.patel@company.com",
      domain: "company.com",
      accountId: "USR-9981-006",
      organization: "ML Engineering",
      isCompliant: true,
      reason: 'Email domain "company.com" is in the allowed list',
      checked: true,
      changeType: null,
      changedFrom: null
    },
    git: {
      repoPath: "C:\\Users\\aisha\\projects\\ml-pipeline",
      originUrl: "https://github.com/company/ml-pipeline.git",
      isCompliant: true,
      reason: 'Repository "company/ml-pipeline" is in the allowed list',
      checked: true,
      remotes: [
        { name: "origin", url: "https://github.com/company/ml-pipeline.git", isCompliant: true }
      ]
    },
    mcpSkill: {
      mcpCount: 7,
      skillCount: 5,
      unauthorizedMCPs: 1,
      unauthorizedSkills: 1,
      checked: true,
      mcps: [
        { name: "Jupyter Kernel", command: "python", args: ["-m", "jupyter_mcp"], envKeys: [], isBlocked: false, isAuthorized: true },
        { name: "MLflow", command: "mlflow", args: ["server"], envKeys: ["MLFLOW_TRACKING_URI"], isBlocked: false, isAuthorized: true },
        { name: "Weights & Biases", command: "wandb", args: ["login"], envKeys: ["WANDB_API_KEY"], isBlocked: false, isAuthorized: true },
        { name: "S3 Data Lake", command: "aws", args: ["s3", "ls"], envKeys: ["AWS_PROFILE"], isBlocked: false, isAuthorized: true },
        { name: "HuggingFace Hub", command: "python", args: ["hf_mcp.py"], envKeys: ["HF_TOKEN"], isBlocked: false, isAuthorized: true },
        { name: "OpenAI Proxy", command: "node", args: ["openai-proxy.js"], envKeys: ["OPENAI_API_KEY"], isBlocked: true, isAuthorized: false },
        { name: "Pinecone", command: "python", args: ["pinecone_mcp.py"], envKeys: ["PINECONE_API_KEY"], isBlocked: false, isAuthorized: true }
      ],
      skills: [
        { name: "model-trainer", description: "ML model training pipeline automation", path: ".cursor/skills/model-trainer", isAuthorized: true },
        { name: "data-preprocess", description: "Data preprocessing and feature engineering", path: ".cursor/skills/data-preprocess", isAuthorized: true },
        { name: "hyperparameter-tune", description: "Automated hyperparameter optimization", path: ".cursor/skills/hyperparameter-tune", isAuthorized: true },
        { name: "model-eval", description: "Model evaluation and metrics dashboard", path: ".cursor/skills/model-eval", isAuthorized: true },
        { name: "external-data-fetch", description: "Fetch data from external unapproved APIs", path: ".cursor/skills/external-data-fetch", isAuthorized: false }
      ]
    },
    sensitiveInfo: {
      totalLeaks: 5,
      criticalLeaks: 2,
      highLeaks: 2,
      mediumLeaks: 1,
      detections: [
        { type: "OPENAI_API_KEY", severity: "critical", file: "~/projects/ml-pipeline/config/llm.yaml", line: 7, masked: "sk-pro****bQwX", timestamp: Date.now() - 15 * 60 * 1000, status: "active" },
        { type: "HUGGINGFACE_TOKEN", severity: "high", file: "~/projects/ml-pipeline/.env", line: 4, masked: "hf_zx****YtRq", timestamp: Date.now() - 35 * 60 * 1000, status: "active" },
        { type: "PINECONE_API_KEY", severity: "medium", file: "~/projects/ml-pipeline/config/vectordb.yaml", line: 10, masked: "pcsk_****5kLm", timestamp: Date.now() - 2 * 60 * 60 * 1000, status: "resolved" }
      ]
    },
    riskScore: 28
  },
  {
    id: "EMP-007",
    name: "Tomasz Kowalski",
    deviceId: "LNX-8821-T",
    deviceName: "Tomasz-ThinkPad",
    os: "Ubuntu 24.04 LTS",
    lastSync: Date.now() - 45 * 60 * 1000,
    account: {
      email: "t.kowalski@company.com",
      domain: "company.com",
      accountId: "USR-4467-007",
      organization: "DevOps Platform",
      isCompliant: true,
      reason: 'Email domain "company.com" is in the allowed list',
      checked: true,
      changeType: null,
      changedFrom: null
    },
    git: {
      repoPath: "/home/tomasz/projects/infra-tools",
      originUrl: null,
      isCompliant: true,
      reason: "Git repository found but no origin remote configured",
      checked: true,
      remotes: []
    },
    mcpSkill: {
      mcpCount: 6,
      skillCount: 4,
      unauthorizedMCPs: 0,
      unauthorizedSkills: 0,
      checked: true,
      mcps: [
        { name: "Terraform", command: "terraform", args: ["plan"], envKeys: ["TF_VAR_token"], isBlocked: false, isAuthorized: true },
        { name: "Ansible", command: "ansible-playbook", args: [], envKeys: [], isBlocked: false, isAuthorized: true },
        { name: "Packer", command: "packer", args: ["build"], envKeys: [], isBlocked: false, isAuthorized: true },
        { name: "Vagrant", command: "vagrant", args: ["up"], envKeys: [], isBlocked: false, isAuthorized: true },
        { name: "Docker", command: "docker", args: ["compose", "up"], envKeys: [], isBlocked: false, isAuthorized: true },
        { name: "Podman", command: "podman", args: ["run"], envKeys: [], isBlocked: false, isAuthorized: true }
      ],
      skills: [
        { name: "iac-generator", description: "Infrastructure-as-Code template generator", path: ".cursor/skills/iac-generator", isAuthorized: true },
        { name: "config-drift", description: "Configuration drift detection and remediation", path: ".cursor/skills/config-drift", isAuthorized: true },
        { name: "cost-optimizer", description: "Cloud cost optimization recommendations", path: ".cursor/skills/cost-optimizer", isAuthorized: true },
        { name: "runbook-gen", description: "Automated runbook generation from incidents", path: ".cursor/skills/runbook-gen", isAuthorized: true }
      ]
    },
    sensitiveInfo: {
      totalLeaks: 0,
      criticalLeaks: 0,
      highLeaks: 0,
      mediumLeaks: 0,
      detections: []
    },
    riskScore: 5
  },
  {
    id: "EMP-008",
    name: "Yuki Tanaka",
    deviceId: "MAC-7734-Y",
    deviceName: "Yuki-MBP-M3",
    os: "macOS 15.1",
    lastSync: Date.now() - 6 * 60 * 1000,
    account: {
      email: "y.tanaka@freelance.jp",
      domain: "freelance.jp",
      accountId: "USR-2201-008",
      organization: "Mobile Development",
      isCompliant: false,
      reason: 'Email domain "freelance.jp" is NOT in the allowed list',
      checked: true,
      changeType: "switch",
      changedFrom: "y.tanaka@company.com"
    },
    git: {
      repoPath: "/Users/yuki/projects/mobile-app",
      originUrl: "https://github.com/company/mobile-app.git",
      isCompliant: true,
      reason: 'Repository "company/mobile-app" is in the allowed list',
      checked: true,
      remotes: [
        { name: "origin", url: "https://github.com/company/mobile-app.git", isCompliant: true }
      ]
    },
    mcpSkill: {
      mcpCount: 5,
      skillCount: 3,
      unauthorizedMCPs: 1,
      unauthorizedSkills: 0,
      checked: true,
      mcps: [
        { name: "Firebase", command: "firebase", args: ["deploy"], envKeys: ["FIREBASE_TOKEN"], isBlocked: false, isAuthorized: true },
        { name: "Fastlane", command: "fastlane", args: ["ios", "beta"], envKeys: ["APP_STORE_CONNECT_API_KEY"], isBlocked: false, isAuthorized: true },
        { name: "TestFlight MCP", command: "npx", args: ["-y", "testflight-mcp"], envKeys: [], isBlocked: false, isAuthorized: true },
        { name: "Crashlytics", command: "npx", args: ["-y", "crashlytics-mcp"], envKeys: ["FABRIC_API_KEY"], isBlocked: false, isAuthorized: true },
        { name: "Personal Repo Syncer", command: "node", args: ["sync-personal.js"], envKeys: ["PERSONAL_GIT_TOKEN"], isBlocked: true, isAuthorized: false }
      ],
      skills: [
        { name: "ios-build", description: "iOS build configuration and signing", path: ".cursor/skills/ios-build", isAuthorized: true },
        { name: "react-native-gen", description: "React Native component scaffolding", path: ".cursor/skills/react-native-gen", isAuthorized: true },
        { name: "app-store-review", description: "App Store review guideline checker", path: ".cursor/skills/app-store-review", isAuthorized: true }
      ]
    },
    sensitiveInfo: {
      totalLeaks: 6,
      criticalLeaks: 2,
      highLeaks: 3,
      mediumLeaks: 1,
      detections: [
        { type: "FIREBASE_SERVICE_ACCOUNT", severity: "critical", file: "~/projects/mobile-app/ios/firebase.json", line: 12, masked: "firebase****gserviceaccount.com", timestamp: Date.now() - 20 * 60 * 1000, status: "active" },
        { type: "APP_STORE_CONNECT_KEY", severity: "critical", file: "~/projects/mobile-app/fastlane/AuthKey.p8", line: 1, masked: "-----BEGIN****KEY-----", timestamp: Date.now() - 50 * 60 * 1000, status: "active" },
        { type: "GOOGLE_SERVICES_JSON", severity: "high", file: "~/projects/mobile-app/android/google-services.json", line: 30, masked: "1:1234****.apps.googleusercontent.com", timestamp: Date.now() - 1 * 60 * 60 * 1000, status: "active" }
      ]
    },
    riskScore: 33
  },
  {
    id: "EMP-009",
    name: "Olivia Williams",
    deviceId: "WIN-4580-D",
    deviceName: "OLIVIA-DESKTOP",
    os: "Windows 11 Pro",
    lastSync: Date.now() - 18 * 60 * 1000,
    account: {
      email: "o.williams@company.com",
      domain: "company.com",
      accountId: "USR-6654-009",
      organization: "Product Design",
      isCompliant: true,
      reason: 'Email domain "company.com" is in the allowed list',
      checked: true,
      changeType: null,
      changedFrom: null
    },
    git: {
      repoPath: "C:\\Users\\olivia\\projects\\design-system",
      originUrl: "https://github.com/company/design-system.git",
      isCompliant: true,
      reason: 'Repository "company/design-system" is in the allowed list',
      checked: true,
      remotes: [
        { name: "origin", url: "https://github.com/company/design-system.git", isCompliant: true }
      ]
    },
    mcpSkill: {
      mcpCount: 3,
      skillCount: 2,
      unauthorizedMCPs: 0,
      unauthorizedSkills: 0,
      checked: true,
      mcps: [
        { name: "Figma API", command: "node", args: ["figma-mcp.js"], envKeys: ["FIGMA_TOKEN"], isBlocked: false, isAuthorized: true },
        { name: "Storybook", command: "npx", args: ["-y", "@cursor/mcp-storybook"], envKeys: [], isBlocked: false, isAuthorized: true },
        { name: "Chromatic", command: "npx", args: ["chromatic"], envKeys: ["CHROMATIC_TOKEN"], isBlocked: false, isAuthorized: true }
      ],
      skills: [
        { name: "component-docs", description: "Component documentation generator", path: ".cursor/skills/component-docs", isAuthorized: true },
        { name: "accessibility-check", description: "WCAG 2.1 AA compliance checker", path: ".cursor/skills/accessibility-check", isAuthorized: true }
      ]
    },
    sensitiveInfo: {
      totalLeaks: 1,
      criticalLeaks: 0,
      highLeaks: 0,
      mediumLeaks: 1,
      detections: [
        { type: "FIGMA_PERSONAL_TOKEN", severity: "medium", file: "~/projects/design-system/.env.local", line: 3, masked: "figd_****RstU", timestamp: Date.now() - 5 * 60 * 60 * 1000, status: "active" }
      ]
    },
    riskScore: 8
  },
  {
    id: "EMP-010",
    name: "Raj Kapoor",
    deviceId: "LNX-3390-R",
    deviceName: "Raj-DevStation",
    os: "Fedora 40",
    lastSync: Date.now() - 55 * 60 * 1000,
    account: {
      email: "r.kapoor@company.com",
      domain: "company.com",
      accountId: "USR-1209-010",
      organization: "Data Engineering",
      isCompliant: true,
      reason: 'Email domain "company.com" is in the allowed list',
      checked: true,
      changeType: null,
      changedFrom: null
    },
    git: {
      repoPath: "/home/raj/projects/data-warehouse",
      originUrl: "https://github.com/external-consultant/data-warehouse.git",
      isCompliant: false,
      reason: 'Repository "external-consultant/data-warehouse" is NOT in the allowed list',
      checked: true,
      remotes: [
        { name: "origin", url: "https://github.com/external-consultant/data-warehouse.git", isCompliant: false },
        { name: "internal", url: "https://github.com/company/data-warehouse.git", isCompliant: true }
      ]
    },
    mcpSkill: {
      mcpCount: 5,
      skillCount: 4,
      unauthorizedMCPs: 0,
      unauthorizedSkills: 1,
      checked: true,
      mcps: [
        { name: "Apache Spark", command: "spark-submit", args: [], envKeys: ["SPARK_HOME"], isBlocked: false, isAuthorized: true },
        { name: "dbt Core", command: "dbt", args: ["run"], envKeys: ["DBT_PROFILES_DIR"], isBlocked: false, isAuthorized: true },
        { name: "Airflow", command: "airflow", args: ["dags", "trigger"], envKeys: ["AIRFLOW_HOME"], isBlocked: false, isAuthorized: true },
        { name: "Kafka", command: "kafka-topics", args: ["--list"], envKeys: [], isBlocked: false, isAuthorized: true },
        { name: "BigQuery CLI", command: "bq", args: ["query"], envKeys: ["GOOGLE_APPLICATION_CREDENTIALS"], isBlocked: false, isAuthorized: true }
      ],
      skills: [
        { name: "etl-generator", description: "ETL pipeline code generation", path: ".cursor/skills/etl-generator", isAuthorized: true },
        { name: "sql-formatter", description: "SQL code formatting and linting", path: ".cursor/skills/sql-formatter", isAuthorized: true },
        { name: "data-quality", description: "Data quality check automation", path: ".cursor/skills/data-quality", isAuthorized: true },
        { name: "external-api-ingest", description: "Ingest data from unapproved external APIs", path: ".cursor/skills/external-api-ingest", isAuthorized: false }
      ]
    },
    sensitiveInfo: {
      totalLeaks: 4,
      criticalLeaks: 1,
      highLeaks: 2,
      mediumLeaks: 1,
      detections: [
        { type: "GOOGLE_SERVICE_ACCOUNT_KEY", severity: "critical", file: "~/projects/data-warehouse/config/gcp-key.json", line: 1, masked: "{\n  \"type****account\"", timestamp: Date.now() - 30 * 60 * 1000, status: "active" },
        { type: "SPARK_MASTER_PASSWORD", severity: "high", file: "~/projects/data-warehouse/spark-defaults.conf", line: 5, masked: "spark.a****ssword", timestamp: Date.now() - 2 * 60 * 60 * 1000, status: "active" }
      ]
    },
    riskScore: 22
  },
  {
    id: "EMP-011",
    name: "Li Wei",
    deviceId: "WIN-6672-L",
    deviceName: "LIWEI-PC",
    os: "Windows 11 Enterprise",
    lastSync: Date.now() - 1 * 60 * 1000,
    account: {
      email: null,
      domain: null,
      accountId: "USR-4450-011",
      organization: "QA Engineering",
      isCompliant: false,
      reason: "No account email found in Cursor database",
      checked: true,
      changeType: "logout",
      changedFrom: "l.wei@company.com"
    },
    git: {
      repoPath: "C:\\Users\\liwei\\projects\\test-automation",
      originUrl: "https://github.com/company/test-automation.git",
      isCompliant: true,
      reason: 'Repository "company/test-automation" is in the allowed list',
      checked: true,
      remotes: [
        { name: "origin", url: "https://github.com/company/test-automation.git", isCompliant: true }
      ]
    },
    mcpSkill: {
      mcpCount: 4,
      skillCount: 2,
      unauthorizedMCPs: 0,
      unauthorizedSkills: 0,
      checked: true,
      mcps: [
        { name: "Playwright", command: "npx", args: ["playwright", "test"], envKeys: [], isBlocked: false, isAuthorized: true },
        { name: "Cypress", command: "npx", args: ["cypress", "run"], envKeys: ["CYPRESS_BASE_URL"], isBlocked: false, isAuthorized: true },
        { name: "Selenium Grid", command: "docker", args: ["compose", "-f", "selenium.yaml"], envKeys: [], isBlocked: false, isAuthorized: true },
        { name: "TestRail API", command: "python", args: ["testrail.py"], envKeys: ["TESTRAIL_API_KEY"], isBlocked: false, isAuthorized: true }
      ],
      skills: [
        { name: "test-gen", description: "Automated test case generation", path: ".cursor/skills/test-gen", isAuthorized: true },
        { name: "bug-report", description: "Structured bug report generator", path: ".cursor/skills/bug-report", isAuthorized: true }
      ]
    },
    sensitiveInfo: {
      totalLeaks: 2,
      criticalLeaks: 0,
      highLeaks: 1,
      mediumLeaks: 1,
      detections: [
        { type: "TESTRAIL_API_KEY", severity: "medium", file: "~/projects/test-automation/config/api.yaml", line: 9, masked: "tr-ap****NopQ", timestamp: Date.now() - 40 * 60 * 1000, status: "active" }
      ]
    },
    riskScore: 19
  },
  {
    id: "EMP-012",
    name: "Carlos Mendez",
    deviceId: "MAC-1190-C",
    deviceName: "Carlos-MacBook-Air",
    os: "macOS 14.4",
    lastSync: Date.now() - 32 * 60 * 1000,
    account: {
      email: "c.mendez@company.com",
      domain: "company.com",
      accountId: "USR-9087-012",
      organization: "Fullstack Team",
      isCompliant: true,
      reason: 'Email domain "company.com" is in the allowed list',
      checked: true,
      changeType: null,
      changedFrom: null
    },
    git: {
      repoPath: "/Users/carlos/projects/booking-system",
      originUrl: "https://github.com/company/booking-system.git",
      isCompliant: true,
      reason: 'Repository "company/booking-system" is in the allowed list',
      checked: true,
      remotes: [
        { name: "origin", url: "https://github.com/company/booking-system.git", isCompliant: true }
      ]
    },
    mcpSkill: {
      mcpCount: 4,
      skillCount: 3,
      unauthorizedMCPs: 0,
      unauthorizedSkills: 0,
      checked: true,
      mcps: [
        { name: "Stripe API", command: "node", args: ["stripe-mcp.js"], envKeys: ["STRIPE_SECRET_KEY"], isBlocked: false, isAuthorized: true },
        { name: "SendGrid", command: "node", args: ["sendgrid-mcp.js"], envKeys: ["SENDGRID_API_KEY"], isBlocked: false, isAuthorized: true },
        { name: "Next.js Dev", command: "npx", args: ["next", "dev"], envKeys: [], isBlocked: false, isAuthorized: true },
        { name: "Prisma", command: "npx", args: ["prisma", "studio"], envKeys: ["DATABASE_URL"], isBlocked: false, isAuthorized: true }
      ],
      skills: [
        { name: "api-scaffold", description: "REST API scaffolding with validation", path: ".cursor/skills/api-scaffold", isAuthorized: true },
        { name: "payment-flow", description: "Payment integration flow builder", path: ".cursor/skills/payment-flow", isAuthorized: true },
        { name: "email-template", description: "Responsive email template generator", path: ".cursor/skills/email-template", isAuthorized: true }
      ]
    },
    sensitiveInfo: {
      totalLeaks: 7,
      criticalLeaks: 3,
      highLeaks: 3,
      mediumLeaks: 1,
      detections: [
        { type: "STRIPE_SECRET_KEY", severity: "critical", file: "~/projects/booking-system/.env.local", line: 2, masked: "sk_liv****AbCd", timestamp: Date.now() - 5 * 60 * 1000, status: "active" },
        { type: "SENDGRID_API_KEY", severity: "critical", file: "~/projects/booking-system/.env.local", line: 3, masked: "SG.abc****Efgh", timestamp: Date.now() - 5 * 60 * 1000, status: "active" },
        { type: "DATABASE_URL", severity: "critical", file: "~/projects/booking-system/.env.local", line: 1, masked: "postgresql://****:5432", timestamp: Date.now() - 5 * 60 * 1000, status: "active" },
        { type: "JWT_SECRET", severity: "high", file: "~/projects/booking-system/config/auth.ts", line: 4, masked: "my-supe****secret", timestamp: Date.now() - 1 * 60 * 60 * 1000, status: "active" }
      ]
    },
    riskScore: 36
  },
  {
    id: "EMP-013",
    name: "Fatima Al-Rashid",
    deviceId: "LNX-5502-F",
    deviceName: "Fatima-Workstation",
    os: "Debian 12",
    lastSync: Date.now() - 70 * 60 * 1000,
    account: {
      email: "f.alrashid@company.com",
      domain: "company.com",
      accountId: "USR-3304-013",
      organization: "Platform Engineering",
      isCompliant: true,
      reason: 'Email domain "company.com" is in the allowed list',
      checked: true,
      changeType: null,
      changedFrom: null
    },
    git: {
      repoPath: "/home/fatima/projects/platform-core",
      originUrl: "https://github.com/company/platform-core.git",
      isCompliant: true,
      reason: 'Repository "company/platform-core" is in the allowed list',
      checked: true,
      remotes: [
        { name: "origin", url: "https://github.com/company/platform-core.git", isCompliant: true }
      ]
    },
    mcpSkill: {
      mcpCount: 3,
      skillCount: 2,
      unauthorizedMCPs: 0,
      unauthorizedSkills: 0,
      checked: true,
      mcps: [
        { name: "Pulumi", command: "pulumi", args: ["up"], envKeys: ["PULUMI_ACCESS_TOKEN"], isBlocked: false, isAuthorized: true },
        { name: "Consul", command: "consul", args: ["kv", "get"], envKeys: ["CONSUL_HTTP_TOKEN"], isBlocked: false, isAuthorized: true },
        { name: "Vault", command: "vault", args: ["read", "secret/data"], envKeys: ["VAULT_TOKEN"], isBlocked: false, isAuthorized: true }
      ],
      skills: [
        { name: "tf-to-pulumi", description: "Terraform to Pulumi migration helper", path: ".cursor/skills/tf-to-pulumi", isAuthorized: true },
        { name: "service-mesh", description: "Service mesh configuration generator", path: ".cursor/skills/service-mesh", isAuthorized: true }
      ]
    },
    sensitiveInfo: {
      totalLeaks: 0,
      criticalLeaks: 0,
      highLeaks: 0,
      mediumLeaks: 0,
      detections: []
    },
    riskScore: 1
  },
  {
    id: "EMP-014",
    name: "Alexei Volkov",
    deviceId: "WIN-7981-V",
    deviceName: "ALEXEI-TOWER",
    os: "Windows 10 Pro",
    lastSync: Date.now() - 4 * 60 * 1000,
    account: {
      email: "a.volkov@personal.ru",
      domain: "personal.ru",
      accountId: "USR-5612-014",
      organization: "Game Development",
      isCompliant: false,
      reason: 'Email domain "personal.ru" is NOT in the allowed list',
      checked: true,
      changeType: "switch",
      changedFrom: "a.volkov@company.com"
    },
    git: {
      repoPath: "C:\\Users\\alexei\\projects\\game-engine",
      originUrl: "https://github.com/personal/game-engine-fork.git",
      isCompliant: false,
      reason: 'Repository "personal/game-engine-fork" is NOT in the allowed list',
      checked: true,
      remotes: [
        { name: "origin", url: "https://github.com/personal/game-engine-fork.git", isCompliant: false },
        { name: "company", url: "https://github.com/company/game-engine.git", isCompliant: true }
      ]
    },
    mcpSkill: {
      mcpCount: 6,
      skillCount: 5,
      unauthorizedMCPs: 2,
      unauthorizedSkills: 2,
      checked: true,
      mcps: [
        { name: "Unreal CLI", command: "ue-cmd", args: ["build"], envKeys: [], isBlocked: false, isAuthorized: true },
        { name: "Unity MCP", command: "unity-mcp", args: [], envKeys: [], isBlocked: false, isAuthorized: true },
        { name: "RenderFarm API", command: "node", args: ["render.js"], envKeys: ["RENDER_KEY"], isBlocked: false, isAuthorized: true },
        { name: "Blender MCP", command: "blender-mcp", args: ["--background"], envKeys: [], isBlocked: false, isAuthorized: true },
        { name: "Personal Assets CDN", command: "python", args: ["upload_assets.py"], envKeys: ["CDN_API_KEY"], isBlocked: true, isAuthorized: false },
        { name: "Discord Bot MCP", command: "node", args: ["discord-bot.js"], envKeys: ["DISCORD_TOKEN"], isBlocked: true, isAuthorized: false }
      ],
      skills: [
        { name: "shader-gen", description: "GLSL/HLSL shader code generation", path: ".cursor/skills/shader-gen", isAuthorized: true },
        { name: "asset-pipeline", description: "3D asset pipeline automation", path: ".cursor/skills/asset-pipeline", isAuthorized: true },
        { name: "physics-debug", description: "Physics simulation debugging tools", path: ".cursor/skills/physics-debug", isAuthorized: true },
        { name: "personal-asset-upload", description: "Upload assets to personal server", path: ".cursor/skills/personal-asset-upload", isAuthorized: false },
        { name: "dev-cheat-menu", description: "Developer cheat menu generator", path: ".cursor/skills/dev-cheat-menu", isAuthorized: false }
      ]
    },
    sensitiveInfo: {
      totalLeaks: 11,
      criticalLeaks: 5,
      highLeaks: 4,
      mediumLeaks: 2,
      detections: [
        { type: "DISCORD_BOT_TOKEN", severity: "critical", file: "~/projects/game-engine/bots/config.json", line: 3, masked: "MTA5O****Qw.Mjc5", timestamp: Date.now() - 10 * 60 * 1000, status: "active" },
        { type: "UNREAL_SIGNING_KEY", severity: "critical", file: "~/projects/game-engine/Config/DefaultEngine.ini", line: 45, masked: "UE_SIG****9abc", timestamp: Date.now() - 25 * 60 * 1000, status: "active" },
        { type: "RENDER_FARM_TOKEN", severity: "high", file: "~/projects/game-engine/ci/render-config.json", line: 8, masked: "rf_pro****WxYz", timestamp: Date.now() - 50 * 60 * 1000, status: "active" },
        { type: "CDN_UPLOAD_KEY", severity: "critical", file: "~/projects/game-engine/tools/upload.py", line: 12, masked: "cdn_liv****QrSt", timestamp: Date.now() - 1 * 60 * 60 * 1000, status: "active" }
      ]
    },
    riskScore: 45
  },
  {
    id: "EMP-015",
    name: "Priya Sharma",
    deviceId: "MAC-4456-S",
    deviceName: "Priya-MacBook-Pro-M2",
    os: "macOS 14.3",
    lastSync: Date.now() - 12 * 60 * 1000,
    account: {
      email: "p.sharma@company.com",
      domain: "company.com",
      accountId: "USR-7765-015",
      organization: "API Platform",
      isCompliant: true,
      reason: 'Email domain "company.com" is in the allowed list',
      checked: true,
      changeType: null,
      changedFrom: null
    },
    git: {
      repoPath: "/Users/priya/projects/api-gateway-v2",
      originUrl: "https://github.com/company/api-gateway-v2.git",
      isCompliant: true,
      reason: 'Repository "company/api-gateway-v2" is in the allowed list',
      checked: true,
      remotes: [
        { name: "origin", url: "https://github.com/company/api-gateway-v2.git", isCompliant: true }
      ]
    },
    mcpSkill: {
      mcpCount: 5,
      skillCount: 4,
      unauthorizedMCPs: 0,
      unauthorizedSkills: 1,
      checked: true,
      mcps: [
        { name: "Postman MCP", command: "npx", args: ["-y", "postman-mcp"], envKeys: ["POSTMAN_API_KEY"], isBlocked: false, isAuthorized: true },
        { name: "Swagger Hub", command: "npx", args: ["-y", "swagger-mcp"], envKeys: ["SWAGGER_TOKEN"], isBlocked: false, isAuthorized: true },
        { name: "Kong Gateway", command: "kong", args: ["config", "db_import"], envKeys: ["KONG_ADMIN_URL"], isBlocked: false, isAuthorized: true },
        { name: "Redis CLI", command: "redis-cli", args: ["INFO"], envKeys: [], isBlocked: false, isAuthorized: true },
        { name: "GraphQL Mesh", command: "npx", args: ["graphql-mesh", "serve"], envKeys: [], isBlocked: false, isAuthorized: true }
      ],
      skills: [
        { name: "openapi-gen", description: "OpenAPI spec generation from code", path: ".cursor/skills/openapi-gen", isAuthorized: true },
        { name: "rate-limiter", description: "Rate limiting configuration builder", path: ".cursor/skills/rate-limiter", isAuthorized: true },
        { name: "mocking-server", description: "Mock API server generator", path: ".cursor/skills/mocking-server", isAuthorized: true },
        { name: "graphql-to-rest", description: "GraphQL to REST API converter", path: ".cursor/skills/graphql-to-rest", isAuthorized: false }
      ]
    },
    sensitiveInfo: {
      totalLeaks: 2,
      criticalLeaks: 0,
      highLeaks: 1,
      mediumLeaks: 1,
      detections: [
        { type: "POSTMAN_API_KEY", severity: "medium", file: "~/projects/api-gateway-v2/postman/env.json", line: 5, masked: "PMAK-****vWwX", timestamp: Date.now() - 3 * 60 * 60 * 1000, status: "active" }
      ]
    },
    riskScore: 11
  }
];

function getRelativeTime(timestamp) {
  var now = Date.now();
  var diff = now - timestamp;
  var seconds = Math.floor(diff / 1000);
  var minutes = Math.floor(seconds / 60);
  var hours = Math.floor(minutes / 60);
  var days = Math.floor(hours / 24);

  if (seconds < 60) return "Just now";
  if (minutes < 60) return minutes + "m ago";
  if (hours < 24) return hours + "h ago";
  return days + "d ago";
}

var MOCK_BACKUP = MOCK_EMPLOYEES.slice();

function fetchDevices(callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', '/api/devices', true);
  xhr.timeout = 5000;
  xhr.onload = function () {
    if (xhr.status === 200) {
      try {
        var devices = JSON.parse(xhr.responseText);
        if (Array.isArray(devices) && devices.length > 0) {
          MOCK_EMPLOYEES = devices;
        }
      } catch (e) {}
    }
    callback();
  };
  xhr.onerror = function () { callback(); };
  xhr.ontimeout = function () { callback(); };
  xhr.send();
}