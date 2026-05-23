var currentPage = 1;
var pageSize = 10;
var currentDrawerEmployee = null;
var filteredData = [];

var SETTINGS_CONFIG = {
  allowedEmailDomains: ["company.com"],
  allowedRepos: ["github.com/company/.*", "gitlab.internal/.*"],
  blockedMCPs: ["Filesystem", "Slack API", "AWS CLI", "Ansible", "Nessus Scanner", "OpenAI Proxy", "Personal Assets CDN", "Discord Bot MCP", "External DB Proxy", "Personal Repo Syncer"],
  allowedSkills: ["code-review", "deploy-pipeline", "db-migration", "log-analyzer", "data-pipeline", "schema-designer", "query-optimizer", "component-gen", "css-refactor", "a11y-audit", "vuln-scanner", "threat-model", "forensics", "k8s-manifests", "helm-chart", "api-docs", "load-test", "model-trainer", "data-preprocess", "hyperparameter-tune", "model-eval", "iac-generator", "config-drift", "cost-optimizer", "runbook-gen", "ios-build", "react-native-gen", "app-store-review", "component-docs", "accessibility-check", "etl-generator", "sql-formatter", "data-quality", "test-gen", "bug-report", "api-scaffold", "payment-flow", "email-template", "tf-to-pulumi", "service-mesh", "shader-gen", "asset-pipeline", "physics-debug", "openapi-gen", "rate-limiter", "mocking-server"],
  scanEnabled: true,
  blockOnLeak: true,
  maxScanLines: 5000,
  pollingInterval: 30000
};

function init() {
  fetchDevices(function () {
    filteredData = MOCK_EMPLOYEES.slice();
    applyFilters();
    renderStats();
    updateAlertDot();
  });
}

function renderStats() {
  var total = MOCK_EMPLOYEES.length;
  var accountAnomaly = 0;
  var gitError = 0;
  var mcpSkillError = 0;
  var sensitiveLeaks = 0;
  var totalLeaks = 0;

  for (var i = 0; i < MOCK_EMPLOYEES.length; i++) {
    var e = MOCK_EMPLOYEES[i];
    if (!e.account.isCompliant) accountAnomaly++;
    if (!e.git.isCompliant && e.git.originUrl) gitError++;
    if (e.mcpSkill.unauthorizedMCPs > 0 || e.mcpSkill.unauthorizedSkills > 0) mcpSkillError++;
    if (e.sensitiveInfo.totalLeaks > 0) sensitiveLeaks++;
    totalLeaks += e.sensitiveInfo.totalLeaks;
  }

  var statsHTML =
    '<div class="bg-surface-container-low border border-outline-variant rounded-lg p-4">' +
      '<div class="flex items-center gap-3">' +
        '<div class="w-10 h-10 rounded-lg bg-error-container/30 flex items-center justify-center">' +
          '<span class="material-symbols-outlined text-error">person_alert</span>' +
        '</div>' +
        '<div>' +
          '<p class="text-[10px] text-on-surface-variant font-mono-label uppercase">Account Anomaly</p>' +
          '<p class="text-headline-sm font-bold text-error">' + accountAnomaly + '<span class="text-body-sm text-on-surface-variant font-normal"> / ' + total + '</span></p>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="bg-surface-container-low border border-outline-variant rounded-lg p-4">' +
      '<div class="flex items-center gap-3">' +
        '<div class="w-10 h-10 rounded-lg bg-yellow-900/30 flex items-center justify-center">' +
          '<span class="material-symbols-outlined text-yellow-500">link_off</span>' +
        '</div>' +
        '<div>' +
          '<p class="text-[10px] text-on-surface-variant font-mono-label uppercase">Git Alerts</p>' +
          '<p class="text-headline-sm font-bold text-yellow-500">' + gitError + '<span class="text-body-sm text-on-surface-variant font-normal"> / ' + total + '</span></p>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="bg-surface-container-low border border-outline-variant rounded-lg p-4">' +
      '<div class="flex items-center gap-3">' +
        '<div class="w-10 h-10 rounded-lg bg-blue-900/30 flex items-center justify-center">' +
          '<span class="material-symbols-outlined text-blue-400">extension_off</span>' +
        '</div>' +
        '<div>' +
          '<p class="text-[10px] text-on-surface-variant font-mono-label uppercase">MCP/Skill Alerts</p>' +
          '<p class="text-headline-sm font-bold text-blue-400">' + mcpSkillError + '<span class="text-body-sm text-on-surface-variant font-normal"> / ' + total + '</span></p>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="bg-surface-container-low border border-outline-variant rounded-lg p-4">' +
      '<div class="flex items-center gap-3">' +
        '<div class="w-10 h-10 rounded-lg bg-error-container/20 flex items-center justify-center">' +
          '<span class="material-symbols-outlined text-error">lock</span>' +
        '</div>' +
        '<div>' +
          '<p class="text-[10px] text-on-surface-variant font-mono-label uppercase">Sensitive Leaks</p>' +
          '<p class="text-headline-sm font-bold text-error">' + totalLeaks + '</p>' +
        '</div>' +
      '</div>' +
    '</div>';

  document.getElementById("statsOverview").innerHTML = statsHTML;
}

function getRiskLevel(score) {
  if (score >= 30) return "critical";
  if (score >= 15) return "high";
  if (score >= 5) return "medium";
  return "low";
}

function getRiskBg(level) {
  if (level === "critical") return "bg-error-container/10 risk-glow";
  if (level === "high") return "bg-error-container/5";
  return "";
}

function getAccountBadge(acc) {
  if (!acc.email) return '<span class="px-2 py-0.5 rounded-full bg-error-container/20 border border-error text-[10px] font-bold text-error uppercase">No Account</span>';
  if (!acc.isCompliant) return '<span class="px-2 py-0.5 rounded-full bg-error-container/20 border border-error text-[10px] font-bold text-error uppercase">Flagged</span>';
  return '<span class="px-2 py-0.5 rounded-full bg-green-900/20 border border-green-500 text-[10px] font-bold text-green-500 uppercase">Verified</span>';
}

function getGitBadge(git) {
  if (!git.originUrl) return '<span class="px-2 py-0.5 rounded-full bg-gray-700/20 border border-gray-500 text-[10px] font-bold text-gray-400 uppercase">No Origin</span>';
  if (!git.isCompliant) return '<span class="px-2 py-0.5 rounded-full bg-error-container/20 border border-error text-[10px] font-bold text-error uppercase">Error</span>';
  return '<span class="px-2 py-0.5 rounded-full bg-green-900/20 border border-green-500 text-[10px] font-bold text-green-500 uppercase">Secure</span>';
}

function getMCPBadge(ms) {
  if (ms.unauthorizedMCPs > 0 || ms.unauthorizedSkills > 0) {
    var total = ms.unauthorizedMCPs + ms.unauthorizedSkills;
    return '<span class="px-2 py-0.5 rounded-full bg-error-container/20 border border-error text-[10px] font-bold text-error uppercase">' + total + ' Unauthorized</span>';
  }
  if (!ms.checked) return '<span class="px-2 py-0.5 rounded-full bg-gray-700/20 border border-gray-500 text-[10px] font-bold text-gray-400 uppercase">Scanning</span>';
  return '<span class="px-2 py-0.5 rounded-full bg-green-900/20 border border-green-500 text-[10px] font-bold text-green-500 uppercase">Active</span>';
}

function getSensitiveBadge(si) {
  if (si.totalLeaks === 0) return '<span class="px-2 py-0.5 rounded-full bg-green-900/20 border border-green-500 text-[10px] font-bold text-green-500 uppercase">0 Leaks</span>';
  return '<span class="font-mono-code text-error font-bold">' + si.totalLeaks + ' Leaks</span>';
}

function getSeverityClass(severity) {
  if (severity === "critical") return "bg-error-container/30 text-error border border-error/50";
  if (severity === "high") return "bg-yellow-900/20 text-yellow-400 border border-yellow-500/30";
  return "bg-blue-900/20 text-blue-300 border border-blue-500/30";
}

function applyFilters() {
  var searchTerm = (document.getElementById("searchInput").value || "").toLowerCase();
  var checkboxes = document.querySelectorAll("#filterCheckboxes input[type=checkbox]");
  var activeFilters = [];
  for (var i = 0; i < checkboxes.length; i++) {
    if (checkboxes[i].checked) {
      activeFilters.push(checkboxes[i].value);
    }
  }
  var sortBy = document.getElementById("sortSelect").value;

  var allFiltersUnchecked = activeFilters.length === 0;

  filteredData = MOCK_EMPLOYEES.filter(function (e) {
    if (searchTerm) {
      var matchSearch = e.name.toLowerCase().indexOf(searchTerm) > -1 ||
        e.deviceId.toLowerCase().indexOf(searchTerm) > -1 ||
        e.deviceName.toLowerCase().indexOf(searchTerm) > -1;
      if (!matchSearch) return false;
    }

    if (allFiltersUnchecked) return true;

    for (var j = 0; j < activeFilters.length; j++) {
      var f = activeFilters[j];
      if (f === "account" && !e.account.isCompliant) return true;
      if (f === "git" && !e.git.isCompliant && e.git.originUrl) return true;
      if (f === "mcpSkill" && (e.mcpSkill.unauthorizedMCPs > 0 || e.mcpSkill.unauthorizedSkills > 0)) return true;
      if (f === "sensitive" && e.sensitiveInfo.totalLeaks > 0) return true;
    }
    return false;
  });

  filteredData.sort(function (a, b) {
    if (sortBy === "risk-desc") return b.riskScore - a.riskScore;
    if (sortBy === "leaks-desc") return b.sensitiveInfo.totalLeaks - a.sensitiveInfo.totalLeaks;
    if (sortBy === "name-asc") return a.name.localeCompare(b.name);
    return b.riskScore - a.riskScore;
  });

  currentPage = 1;
  renderTable();
  renderPagination();
}

function renderTable() {
  var tbody = document.getElementById("tableBody");
  var emptyState = document.getElementById("emptyState");

  if (filteredData.length === 0) {
    tbody.innerHTML = "";
    emptyState.classList.remove("hidden");
    document.getElementById("pagination").innerHTML = "";
    return;
  }

  emptyState.classList.add("hidden");

  var start = (currentPage - 1) * pageSize;
  var end = Math.min(start + pageSize, filteredData.length);
  var pageData = filteredData.slice(start, end);
  var rows = "";

  for (var i = 0; i < pageData.length; i++) {
    var e = pageData[i];
    var level = getRiskLevel(e.riskScore);
    var riskBg = getRiskBg(level);
    var initials = e.name.split(" ").map(function (n) { return n[0]; }).join("");
    var accountDisplay = e.account.email || e.name;

    rows += '<tr class="border-b border-outline-variant hover:bg-surface-container-highest cursor-pointer transition-colors ' + riskBg + '" onclick="openDrawer(\'' + e.id + '\')">' +
      '<td class="px-4 py-4 flex items-center gap-3">' +
        '<div class="w-8 h-8 rounded bg-surface-container-highest border border-outline-variant flex items-center justify-center text-xs font-bold text-secondary">' + initials + '</div>' +
        '<div class="flex flex-col"><span class="font-bold">' + e.name + '</span><span class="text-[11px] font-mono-code text-on-surface-variant">' + accountDisplay + '</span></div>' +
      '</td>' +
      '<td class="px-4 py-4">' + getAccountBadge(e.account) + '</td>' +
      '<td class="px-4 py-4">' + getGitBadge(e.git) + '</td>' +
      '<td class="px-4 py-4">' + getMCPBadge(e.mcpSkill) + '</td>' +
      '<td class="px-4 py-4">' + getSensitiveBadge(e.sensitiveInfo) + '</td>' +
      '<td class="px-4 py-4 font-bold ' + (level === "critical" ? "text-error" : level === "high" ? "text-yellow-500" : "text-on-surface-variant") + '">' + e.riskScore + '</td>' +
    '</tr>';
  }

  tbody.innerHTML = rows;
}

function renderPagination() {
  var totalPages = Math.ceil(filteredData.length / pageSize);
  if (totalPages <= 1) {
    document.getElementById("pagination").innerHTML =
      '<span class="text-on-surface-variant">Showing ' + filteredData.length + ' of ' + MOCK_EMPLOYEES.length + ' records</span>';
    return;
  }

  var html = '<span>Showing ' + ((currentPage - 1) * pageSize + 1) + '-' + Math.min(currentPage * pageSize, filteredData.length) + ' of ' + filteredData.length + ' records</span>';
  html += '<div class="flex items-center gap-2">';
  html += '<button class="px-3 py-1 border border-outline-variant rounded hover:bg-surface-container-highest transition-colors disabled:opacity-30" ' + (currentPage === 1 ? "disabled" : "") + ' onclick="goToPage(' + (currentPage - 1) + ')">Prev</button>';

  var maxButtons = 5;
  var startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  var endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage < maxButtons - 1) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  for (var p = startPage; p <= endPage; p++) {
    html += '<button class="w-8 h-8 rounded text-xs font-mono-label transition-colors ' + (p === currentPage ? "bg-secondary text-on-secondary" : "border border-outline-variant hover:bg-surface-container-highest") + '" onclick="goToPage(' + p + ')">' + p + '</button>';
  }
  html += '<button class="px-3 py-1 border border-outline-variant rounded hover:bg-surface-container-highest transition-colors disabled:opacity-30" ' + (currentPage === totalPages ? "disabled" : "") + ' onclick="goToPage(' + (currentPage + 1) + ')">Next</button>';
  html += '</div>';

  document.getElementById("pagination").innerHTML = html;
}

function goToPage(page) {
  var totalPages = Math.ceil(filteredData.length / pageSize);
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  renderTable();
  renderPagination();
}

function openDrawer(employeeId) {
  for (var i = 0; i < MOCK_EMPLOYEES.length; i++) {
    if (MOCK_EMPLOYEES[i].id === employeeId) {
      currentDrawerEmployee = MOCK_EMPLOYEES[i];
      break;
    }
  }
  if (!currentDrawerEmployee) return;

  var e = currentDrawerEmployee;
  var level = getRiskLevel(e.riskScore);

  var iconDiv = document.getElementById("drawerRiskIcon");
  var label = document.getElementById("drawerRiskLabel");

  if (level === "critical") {
    iconDiv.className = "w-12 h-12 rounded-lg bg-error-container/30 flex items-center justify-center";
    iconDiv.innerHTML = '<span class="material-symbols-outlined text-3xl text-error">security</span>';
    label.className = "font-mono-code text-[11px] text-error animate-pulse";
    label.textContent = "CRITICAL RISK DETECTED";
  } else if (level === "high") {
    iconDiv.className = "w-12 h-12 rounded-lg bg-yellow-900/30 flex items-center justify-center";
    iconDiv.innerHTML = '<span class="material-symbols-outlined text-3xl text-yellow-500">warning</span>';
    label.className = "font-mono-code text-[11px] text-yellow-500";
    label.textContent = "HIGH RISK - Review Required";
  } else if (level === "medium") {
    iconDiv.className = "w-12 h-12 rounded-lg bg-blue-900/30 flex items-center justify-center";
    iconDiv.innerHTML = '<span class="material-symbols-outlined text-3xl text-blue-400">info</span>';
    label.className = "font-mono-code text-[11px] text-blue-400";
    label.textContent = "MODERATE RISK";
  } else {
    iconDiv.className = "w-12 h-12 rounded-lg bg-green-900/20 flex items-center justify-center";
    iconDiv.innerHTML = '<span class="material-symbols-outlined text-3xl text-green-500">verified</span>';
    label.className = "font-mono-code text-[11px] text-green-500";
    label.textContent = "COMPLIANT - No Issues";
  }

  renderDrawerContent(e);

  var panel = document.getElementById("statusDetailPanel");
  var overlay = document.getElementById("drawerOverlay");
  panel.classList.remove("translate-x-full");
  overlay.classList.remove("opacity-0", "pointer-events-none");
  overlay.classList.add("opacity-100");
}

function renderDrawerContent(e) {
  var html = "";

  html += '<div class="flex items-center gap-3 mb-4 pb-4 border-b border-outline-variant">' +
    '<div class="w-10 h-10 rounded bg-surface-container-highest border border-outline-variant flex items-center justify-center text-sm font-bold text-secondary">' +
      e.name.split(" ").map(function (n) { return n[0]; }).join("") +
    '</div>' +
    '<div>' +
      '<p class="font-headline-sm text-headline-sm">' + e.name + '</p>' +
      '<p class="text-body-sm text-on-surface-variant">' + e.deviceName + ' · ' + e.os + ' · ' + e.deviceId + '</p>' +
    '</div>' +
  '</div>';

  html += '<section>' +
    '<div class="flex items-center gap-2 mb-4">' +
      '<span class="material-symbols-outlined text-secondary text-sm">account_circle</span>' +
      '<h4 class="font-mono-label text-mono-label uppercase tracking-widest text-on-surface-variant">Current Account</h4>' +
    '</div>' +
    '<div class="bg-surface-container-low border border-outline-variant p-4 rounded space-y-2">';

  if (e.account.email) {
    html += '<div class="flex justify-between"><span class="text-body-sm text-on-surface-variant">Email</span><span class="text-body-sm font-mono-code">' + e.account.email + '</span></div>';
    html += '<div class="flex justify-between"><span class="text-body-sm text-on-surface-variant">Account ID</span><span class="text-body-sm font-mono-code">' + e.account.accountId + '</span></div>';
    html += '<div class="flex justify-between"><span class="text-body-sm text-on-surface-variant">Organization</span><span class="text-body-sm font-bold">' + e.account.organization + '</span></div>';
    html += '<div class="flex justify-between"><span class="text-body-sm text-on-surface-variant">Compliance</span>' +
      (e.account.isCompliant
        ? '<span class="text-body-sm font-bold text-green-500">Compliant</span>'
        : '<span class="text-body-sm font-bold text-error">Non-Compliant</span>') +
      '</div>';
    if (e.account.changedFrom) {
      html += '<div class="flex justify-between"><span class="text-body-sm text-on-surface-variant">Changed From</span><span class="text-body-sm font-mono-code text-error">' + e.account.changedFrom + '</span></div>';
    }
    if (e.account.changeType) {
      var typeLabel = e.account.changeType === "switch" ? "Account Switch" : e.account.changeType === "logout" ? "Logged Out" : "Non-Compliant";
      html += '<div class="flex justify-between"><span class="text-body-sm text-on-surface-variant">Event</span><span class="text-body-sm font-bold text-error uppercase">' + typeLabel + '</span></div>';
    }
    html += '<div class="pt-2 mt-2 border-t border-outline-variant"><span class="text-[10px] text-on-surface-variant">' + e.account.reason + '</span></div>';
  } else {
    html += '<div class="flex justify-between"><span class="text-body-sm text-on-surface-variant">Status</span><span class="text-body-sm font-bold text-error">No Account Detected</span></div>';
    html += '<div class="pt-2 mt-2 border-t border-outline-variant"><span class="text-[10px] text-on-surface-variant">' + e.account.reason + '</span></div>';
  }

  html += '</div></section>';

  html += '<section>' +
    '<div class="flex items-center gap-2 mb-4">' +
      '<span class="material-symbols-outlined text-secondary text-sm">terminal</span>' +
      '<h4 class="font-mono-label text-mono-label uppercase tracking-widest text-on-surface-variant">Connected Git Remotes</h4>' +
    '</div>' +
    '<div class="space-y-2">';

  if (e.git.remotes && e.git.remotes.length > 0) {
    for (var r = 0; r < e.git.remotes.length; r++) {
      var remote = e.git.remotes[r];
      var icon = remote.isCompliant ? "check_circle" : "error";
      var iconColor = remote.isCompliant ? "text-green-500" : "text-error";
      html += '<div class="bg-surface-container-low border border-outline-variant p-3 rounded flex items-center justify-between">' +
        '<div class="flex items-center gap-3">' +
          '<span class="material-symbols-outlined ' + iconColor + ' text-sm">' + icon + '</span>' +
          '<span class="text-body-sm font-mono-code">' + remote.url + '</span>' +
        '</div>' +
        '<span class="text-[10px] text-on-surface-variant uppercase">' + remote.name + '</span>' +
      '</div>';
    }
  } else if (e.git.repoPath) {
    html += '<div class="bg-surface-container-low border border-outline-variant p-3 rounded flex items-center gap-3">' +
      '<span class="material-symbols-outlined text-on-surface-variant text-sm">info</span>' +
      '<span class="text-body-sm">No remote configured (local repo: ' + e.git.repoPath + ')</span>' +
    '</div>';
  } else {
    html += '<div class="bg-surface-container-low border border-outline-variant p-3 rounded flex items-center gap-3">' +
      '<span class="material-symbols-outlined text-on-surface-variant text-sm">folder_off</span>' +
      '<span class="text-body-sm">No Git repository detected</span>' +
    '</div>';
  }

  html += '</div></section>';

  html += '<section>' +
    '<div class="flex items-center gap-2 mb-4">' +
      '<span class="material-symbols-outlined text-secondary text-sm">auto_fix_high</span>' +
      '<h4 class="font-mono-label text-mono-label uppercase tracking-widest text-on-surface-variant">MCP / Skill Scan Results</h4>' +
      '<span class="ml-auto text-[10px] text-on-surface-variant">MCP:' + e.mcpSkill.mcpCount + ' Skill:' + e.mcpSkill.skillCount + '</span>' +
    '</div>';

  if (e.mcpSkill.mcps.length > 0 || e.mcpSkill.skills.length > 0) {
    html += '<div class="grid grid-cols-2 gap-2">';

    for (var m = 0; m < e.mcpSkill.mcps.length; m++) {
      var mcp = e.mcpSkill.mcps[m];
      var isOk = mcp.isAuthorized && !mcp.isBlocked;
      var cardClass = isOk ? "bg-surface-container-low border border-outline-variant" : "bg-error-container/10 border border-error/50";
      var dotColor = isOk ? "bg-green-500" : "bg-error";
      var statusText = mcp.isBlocked ? "BLOCKED" : (mcp.isAuthorized ? "READY" : "UNAUTHORIZED");
      var statusClass = isOk ? "text-body-sm font-bold" : "text-body-sm font-bold text-error";

      html += '<div class="p-3 ' + cardClass + ' rounded">' +
        '<p class="text-[10px] ' + (isOk ? "text-on-surface-variant" : "text-error") + ' font-mono-label mb-1 uppercase">' + mcp.name + '</p>' +
        '<div class="flex items-center gap-2">' +
          '<div class="w-1.5 h-1.5 rounded-full ' + dotColor + '"></div>' +
          '<span class="' + statusClass + '">' + statusText + '</span>' +
        '</div>' +
      '</div>';
    }

    for (var s = 0; s < e.mcpSkill.skills.length; s++) {
      var skill = e.mcpSkill.skills[s];
      var sIsOk = skill.isAuthorized;
      var sCardClass = sIsOk ? "bg-surface-container-low border border-outline-variant" : "bg-error-container/10 border border-error/50";
      var sDotColor = sIsOk ? "bg-green-500" : "bg-error";
      var sStatusText = sIsOk ? "AUTHORIZED" : "UNAUTHORIZED";
      var sStatusClass = sIsOk ? "text-body-sm font-bold" : "text-body-sm font-bold text-error";

      html += '<div class="p-3 ' + sCardClass + ' rounded">' +
        '<p class="text-[10px] ' + (sIsOk ? "text-on-surface-variant" : "text-error") + ' font-mono-label mb-1 uppercase">' + skill.name + '</p>' +
        '<div class="flex items-center gap-2">' +
          '<div class="w-1.5 h-1.5 rounded-full ' + sDotColor + '"></div>' +
          '<span class="' + sStatusClass + '">' + sStatusText + '</span>' +
        '</div>' +
        '<span class="text-[9px] text-on-surface-variant block mt-1 truncate">' + skill.description + '</span>' +
      '</div>';
    }

    html += '</div>';
  } else {
    html += '<div class="bg-surface-container-low border border-outline-variant p-4 rounded text-center">' +
      '<span class="text-body-sm text-on-surface-variant">No MCP/Skill configurations detected</span>' +
    '</div>';
  }

  html += '</section>';

  html += '<section>' +
    '<div class="flex items-center gap-2 mb-4">' +
      '<span class="material-symbols-outlined text-error text-sm">warning</span>' +
      '<h4 class="font-mono-label text-mono-label uppercase tracking-widest ' + (e.sensitiveInfo.totalLeaks > 0 ? "text-error" : "text-green-500") + '">Sensitive Information Detection</h4>' +
      '<span class="ml-auto text-[10px] text-on-surface-variant">' + e.sensitiveInfo.totalLeaks + ' total</span>' +
    '</div>';

  if (e.sensitiveInfo.detections.length > 0) {
    html += '<div class="' + (e.sensitiveInfo.criticalLeaks > 0 ? "bg-error-container/5" : "bg-surface-container-low") + ' border ' + (e.sensitiveInfo.criticalLeaks > 0 ? "border-error/20" : "border-outline-variant") + ' rounded p-4 space-y-4">';

    for (var d = 0; d < e.sensitiveInfo.detections.length; d++) {
      var det = e.sensitiveInfo.detections[d];
      var isFirst = d === 0;
      var isResolved = det.status === "resolved";
      var opacity = isResolved ? "opacity-50" : "";
      var sevClass = getSeverityClass(det.severity);
      var dotColor = det.severity === "critical" ? "bg-error shadow-[0_0_8px_#ffb4ab]" : det.severity === "high" ? "bg-yellow-500" : "bg-blue-400";

      if (d > 0) {
        html += '<div class="h-px bg-outline-variant/30 ' + opacity + '"></div>';
      }

      html += '<div class="flex items-start gap-3 ' + opacity + '">' +
        '<div class="mt-1 w-2 h-2 rounded-full ' + dotColor + '"></div>' +
        '<div>' +
          '<p class="text-body-sm font-bold ' + (det.severity === "critical" ? "text-error" : det.severity === "high" ? "text-yellow-400" : "text-blue-300") + '">' + det.type + '</p>' +
          '<p class="text-[11px] font-mono-code text-on-surface-variant mt-1">Detected in <span class="text-secondary">' + det.file + '</span></p>' +
          '<div class="mt-2 flex items-center gap-2 flex-wrap">' +
            '<span class="px-1.5 py-0.5 ' + sevClass + ' text-[10px] font-bold rounded">' + det.severity.toUpperCase() + ' SEVERITY</span>' +
            '<span class="text-[10px] text-on-surface-variant">L:' + det.line + '</span>' +
            (isResolved ? '<span class="px-1.5 py-0.5 bg-green-900/20 text-green-500 text-[10px] font-bold rounded">RESOLVED</span>' : '<span class="px-1.5 py-0.5 bg-error-container/20 text-error text-[10px] font-bold rounded">ACTIVE</span>') +
          '</div>' +
        '</div>' +
      '</div>';
    }

    html += '</div>';
  } else {
    html += '<div class="bg-surface-container-low border border-outline-variant rounded p-4 text-center">' +
      '<span class="material-symbols-outlined text-3xl text-green-500 mb-2 block">verified_user</span>' +
      '<span class="text-body-sm text-green-500 font-bold">No sensitive information detected</span>' +
    '</div>';
  }

  html += '</section>';

  document.getElementById("drawerContent").innerHTML = html;
}

function closeDrawer() {
  var panel = document.getElementById("statusDetailPanel");
  var overlay = document.getElementById("drawerOverlay");
  panel.classList.add("translate-x-full");
  overlay.classList.add("opacity-0", "pointer-events-none");
  overlay.classList.remove("opacity-100");
  currentDrawerEmployee = null;
}

function updateAlertDot() {
  var hasCritical = false;
  for (var i = 0; i < MOCK_EMPLOYEES.length; i++) {
    if (getRiskLevel(MOCK_EMPLOYEES[i].riskScore) === "critical") {
      hasCritical = true;
      break;
    }
  }
  var dot = document.getElementById("alertDot");
  if (hasCritical) {
    dot.classList.remove("hidden");
  } else {
    dot.classList.add("hidden");
  }
}

function exportAudit() {
  var rows = [];
  rows.push("Employee Name,Device ID,OS,Account Email,Account Compliant,Git Remote,Git Compliant,MCP Count,Unauthorized MCP,Skill Count,Unauthorized Skill,Sensitive Leaks,Risk Score");
  for (var i = 0; i < MOCK_EMPLOYEES.length; i++) {
    var e = MOCK_EMPLOYEES[i];
    var gitUrl = e.git.originUrl || "None";
    rows.push([
      e.name, e.deviceId, e.os,
      e.account.email || "None", e.account.isCompliant ? "Yes" : "No",
      gitUrl, e.git.isCompliant ? "Yes" : "No",
      e.mcpSkill.mcpCount, e.mcpSkill.unauthorizedMCPs,
      e.mcpSkill.skillCount, e.mcpSkill.unauthorizedSkills,
      e.sensitiveInfo.totalLeaks, e.riskScore
    ].join(","));
  }

  var csv = rows.join("\n");
  var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  var url = URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.href = url;
  link.download = "cursorshield-audit-" + new Date().toISOString().slice(0, 10) + ".csv";
  link.click();
  URL.revokeObjectURL(url);
}

function switchTab(tab) {
  var navLinks = document.querySelectorAll("nav a");
  for (var i = 0; i < navLinks.length; i++) {
    navLinks[i].classList.remove("bg-surface-container-highest", "text-secondary", "border-l-2", "border-secondary");
    navLinks[i].classList.add("text-on-surface-variant");
  }
  var target = document.querySelector("nav a[onclick=\"switchTab('" + tab + "')\"]");
  if (target) {
    target.classList.add("bg-surface-container-highest", "text-secondary", "border-l-2", "border-secondary");
    target.classList.remove("text-on-surface-variant");
  }

  document.getElementById("dashboardContent").classList.add("hidden");
  document.getElementById("reportsContent").classList.add("hidden");
  document.getElementById("settingsContent").classList.add("hidden");

  if (tab === "dashboard") {
    document.getElementById("dashboardContent").classList.remove("hidden");
    applyFilters();
    renderStats();
  } else if (tab === "reports") {
    document.getElementById("reportsContent").classList.remove("hidden");
    renderReports();
  } else if (tab === "settings") {
    document.getElementById("settingsContent").classList.remove("hidden");
    renderSettings();
  }
}

function triggerAlert() {
  if (!currentDrawerEmployee) return;
  alert("[CursorShield] Alert triggered for " + currentDrawerEmployee.name + " (" + currentDrawerEmployee.deviceId + ")\nRisk Score: " + currentDrawerEmployee.riskScore + "\nPlease review the security status immediately.");
}

function renderReports() {
  var total = MOCK_EMPLOYEES.length;
  var critical = 0;
  var high = 0;
  var medium = 0;
  var low = 0;
  var totalIncidents = 0;
  var resolvedIssues = 0;
  var activeThreats = 0;

  for (var i = 0; i < MOCK_EMPLOYEES.length; i++) {
    var e = MOCK_EMPLOYEES[i];
    var level = getRiskLevel(e.riskScore);
    if (level === "critical") critical++;
    else if (level === "high") high++;
    else if (level === "medium") medium++;
    else low++;

    totalIncidents += e.sensitiveInfo.totalLeaks;
    for (var d = 0; d < e.sensitiveInfo.detections.length; d++) {
      if (e.sensitiveInfo.detections[d].status === "resolved") resolvedIssues++;
      else activeThreats++;
    }
  }

  document.getElementById("reportsStats").innerHTML =
    '<div class="stat-card">' +
      '<p class="text-[10px] text-on-surface-variant font-mono-label uppercase mb-1">Total Incidents</p>' +
      '<p class="text-headline-sm font-bold text-error">' + totalIncidents + '</p>' +
      '<p class="text-[10px] text-on-surface-variant mt-1">All time</p>' +
    '</div>' +
    '<div class="stat-card">' +
      '<p class="text-[10px] text-on-surface-variant font-mono-label uppercase mb-1">Resolved Issues</p>' +
      '<p class="text-headline-sm font-bold text-green-500">' + resolvedIssues + '</p>' +
      '<p class="text-[10px] text-on-surface-variant mt-1">' + (totalIncidents > 0 ? Math.round(resolvedIssues / (resolvedIssues + activeThreats) * 100) : 0) + '% resolution rate</p>' +
    '</div>' +
    '<div class="stat-card">' +
      '<p class="text-[10px] text-on-surface-variant font-mono-label uppercase mb-1">Active Threats</p>' +
      '<p class="text-headline-sm font-bold text-error">' + activeThreats + '</p>' +
      '<p class="text-[10px] text-on-surface-variant mt-1">Requires attention</p>' +
    '</div>';

  renderRiskDonut(critical, high, medium, low, total);
  renderTopViolators();
  renderIncidentTimeline();
}

function renderRiskDonut(critical, high, medium, low, total) {
  var segments = [];
  if (critical > 0) segments.push({ color: "#ffb4ab", label: "Critical", count: critical });
  if (high > 0) segments.push({ color: "#f4b740", label: "High", count: high });
  if (medium > 0) segments.push({ color: "#6690f4", label: "Medium", count: medium });
  if (low > 0) segments.push({ color: "#4ade80", label: "Low", count: low });

  var conicParts = [];
  var cumulative = 0;
  for (var s = 0; s < segments.length; s++) {
    var pct = segments[s].count / total * 100;
    conicParts.push(segments[s].color + " " + cumulative + "% " + (cumulative + pct) + "%");
    cumulative += pct;
  }

  document.getElementById("riskDonut").innerHTML =
    '<div class="risk-donut" style="background: conic-gradient(' + conicParts.join(", ") + ')">' +
      '<div class="risk-donut-inner">' +
        '<span class="text-headline-sm font-bold text-on-surface">' + total + '</span>' +
        '<span class="text-[10px] text-on-surface-variant">Devices</span>' +
      '</div>' +
    '</div>';

  var legendHTML = "";
  for (var l = 0; l < segments.length; l++) {
    legendHTML += '<div class="flex items-center gap-2">' +
      '<span class="risk-legend-dot" style="background:' + segments[l].color + '"></span>' +
      '<span class="text-body-sm text-on-surface-variant">' + segments[l].label + '</span>' +
      '<span class="text-body-sm font-bold text-on-surface ml-auto">' + segments[l].count + '</span>' +
    '</div>';
  }
  document.getElementById("riskLegend").innerHTML = legendHTML;
}

function renderTopViolators() {
  var sorted = MOCK_EMPLOYEES.slice().sort(function (a, b) { return b.riskScore - a.riskScore; });
  var top = sorted.slice(0, 5);
  var html = "";

  for (var i = 0; i < top.length; i++) {
    var e = top[i];
    var initials = e.name.split(" ").map(function (n) { return n[0]; }).join("");
    var level = getRiskLevel(e.riskScore);
    var barColor = level === "critical" ? "bg-error" : level === "high" ? "bg-yellow-500" : level === "medium" ? "bg-blue-400" : "bg-green-500";
    var barWidth = Math.min(100, Math.max(10, e.riskScore / 50 * 100));

    html += '<div class="flex items-center gap-3 p-2 hover:bg-surface-container-highest rounded cursor-pointer transition-colors" onclick="openDrawer(\'' + e.id + '\')">' +
      '<div class="w-7 h-7 rounded bg-surface-container-highest border border-outline-variant flex items-center justify-center text-[10px] font-bold text-secondary flex-shrink-0">' + initials + '</div>' +
      '<div class="flex-1 min-w-0">' +
        '<div class="flex justify-between items-baseline">' +
          '<span class="text-body-sm font-bold truncate">' + e.name + '</span>' +
          '<span class="text-body-sm font-mono-code text-error ml-2">' + e.riskScore + '</span>' +
        '</div>' +
        '<div class="w-full h-1.5 bg-surface-container-highest rounded-full mt-1">' +
          '<div class="h-full rounded-full ' + barColor + '" style="width:' + barWidth + '%"></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  document.getElementById("topViolators").innerHTML = html;
}

function renderIncidentTimeline() {
  var allIncidents = [];
  for (var i = 0; i < MOCK_EMPLOYEES.length; i++) {
    var e = MOCK_EMPLOYEES[i];
    for (var d = 0; d < e.sensitiveInfo.detections.length; d++) {
      allIncidents.push({
        employee: e.name,
        employeeId: e.id,
        type: e.sensitiveInfo.detections[d].type,
        severity: e.sensitiveInfo.detections[d].severity,
        timestamp: e.sensitiveInfo.detections[d].timestamp,
        file: e.sensitiveInfo.detections[d].file,
        status: e.sensitiveInfo.detections[d].status
      });
    }
  }

  allIncidents.sort(function (a, b) { return b.timestamp - a.timestamp; });

  if (allIncidents.length === 0) {
    document.getElementById("incidentTimeline").innerHTML =
      '<div class="text-center py-8 text-on-surface-variant">' +
        '<span class="material-symbols-outlined text-3xl mb-2 block">verified_user</span>' +
        '<p class="font-mono-label">No incidents recorded</p>' +
      '</div>';
    return;
  }

  var html = "";
  for (var t = 0; t < allIncidents.length; t++) {
    var inc = allIncidents[t];
    var sevColor = inc.severity === "critical" ? "bg-error" : inc.severity === "high" ? "bg-yellow-500" : "bg-blue-400";
    var sevBorder = inc.severity === "critical" ? "border-l-error" : inc.severity === "high" ? "border-l-yellow-500" : "border-l-blue-400";
    var isResolved = inc.status === "resolved";
    var timeStr = getRelativeTime(inc.timestamp);

    html += '<div class="relative pl-6 pb-5 timeline-item">' +
      '<div class="incident-dot ' + sevColor + '"></div>' +
      '<div class="timeline-line"></div>' +
      '<div class="bg-surface-container-highest border-l-2 ' + sevBorder + ' rounded p-3 ' + (isResolved ? "opacity-50" : "") + '">' +
        '<div class="flex items-center justify-between mb-1">' +
          '<span class="text-body-sm font-bold cursor-pointer hover:text-secondary transition-colors" onclick="openDrawer(\'' + inc.employeeId + '\')">' + inc.employee + '</span>' +
          '<span class="text-[10px] text-on-surface-variant">' + timeStr + '</span>' +
        '</div>' +
        '<p class="text-body-sm font-mono-code text-on-surface-variant">' + inc.type + ' · <span class="text-secondary">' + inc.file + '</span></p>' +
        '<div class="flex items-center gap-2 mt-1">' +
          '<span class="px-1.5 py-0.5 bg-error-container/20 text-error text-[9px] font-bold rounded uppercase">' + inc.severity + '</span>' +
          (isResolved ? '<span class="px-1.5 py-0.5 bg-green-900/20 text-green-500 text-[9px] font-bold rounded">RESOLVED</span>' : '<span class="px-1.5 py-0.5 bg-error-container/20 text-error text-[9px] font-bold rounded">ACTIVE</span>') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  document.getElementById("incidentTimeline").innerHTML = html;
}

function exportFullReport() {
  var rows = [];
  rows.push("=== CursorShield Security Audit Report ===");
  rows.push("Generated: " + new Date().toISOString());
  rows.push("Total Devices: " + MOCK_EMPLOYEES.length);
  rows.push("");

  var critical = 0, high = 0, medium = 0, low = 0, totalLeaks = 0, totalUnauth = 0;

  for (var i = 0; i < MOCK_EMPLOYEES.length; i++) {
    var e = MOCK_EMPLOYEES[i];
    var level = getRiskLevel(e.riskScore);
    if (level === "critical") critical++;
    else if (level === "high") high++;
    else if (level === "medium") medium++;
    else low++;
    totalLeaks += e.sensitiveInfo.totalLeaks;
    totalUnauth += e.mcpSkill.unauthorizedMCPs + e.mcpSkill.unauthorizedSkills;
  }

  rows.push("--- Summary ---");
  rows.push("Critical: " + critical + ", High: " + high + ", Medium: " + medium + ", Low: " + low);
  rows.push("Total Sensitive Leaks: " + totalLeaks);
  rows.push("Total Unauthorized MCP/Skills: " + totalUnauth);
  rows.push("");
  rows.push("--- Device Details ---");

  for (var j = 0; j < MOCK_EMPLOYEES.length; j++) {
    var emp = MOCK_EMPLOYEES[j];
    rows.push("");
    rows.push(emp.name + " | " + emp.deviceId + " | " + emp.os + " | Risk: " + emp.riskScore);
    rows.push("  Account: " + (emp.account.email || "None") + " (" + (emp.account.isCompliant ? "Compliant" : "Non-Compliant") + ")");
    rows.push("  Git: " + (emp.git.originUrl || "None") + " (" + (emp.git.isCompliant ? "Compliant" : "Non-Compliant") + ")");
    rows.push("  MCP Unauthorized: " + emp.mcpSkill.unauthorizedMCPs + ", Skill Unauthorized: " + emp.mcpSkill.unauthorizedSkills);
    rows.push("  Sensitive Leaks: " + emp.sensitiveInfo.totalLeaks + " (Critical: " + emp.sensitiveInfo.criticalLeaks + ", High: " + emp.sensitiveInfo.highLeaks + ")");
    if (emp.sensitiveInfo.detections.length > 0) {
      for (var d = 0; d < emp.sensitiveInfo.detections.length; d++) {
        var det = emp.sensitiveInfo.detections[d];
        rows.push("    [" + det.severity + "] " + det.type + " - " + det.file + ":" + det.line + " (" + det.status + ")");
      }
    }
  }

  var blob = new Blob([rows.join("\n")], { type: "text/plain;charset=utf-8;" });
  var url = URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.href = url;
  link.download = "cursorshield-full-report-" + new Date().toISOString().slice(0, 10) + ".txt";
  link.click();
  URL.revokeObjectURL(url);
}

function renderSettings() {
  renderSettingsTags("domainTags", SETTINGS_CONFIG.allowedEmailDomains, "domain");
  renderSettingsTags("repoTags", SETTINGS_CONFIG.allowedRepos, "repo");
  renderSettingsTags("mcpTags", SETTINGS_CONFIG.blockedMCPs, "mcp");
  renderSettingsTags("skillTags", SETTINGS_CONFIG.allowedSkills, "skill");

  updateToggleUI("toggleScanEnabled", SETTINGS_CONFIG.scanEnabled);
  updateToggleUI("toggleBlockOnLeak", SETTINGS_CONFIG.blockOnLeak);
  document.getElementById("maxScanLinesInput").value = SETTINGS_CONFIG.maxScanLines;
  document.getElementById("pollingIntervalSelect").value = SETTINGS_CONFIG.pollingInterval;
}

function renderSettingsTags(containerId, items, type) {
  var html = "";
  for (var i = 0; i < items.length; i++) {
    html += '<span class="tag-chip text-body-sm font-mono-code text-secondary">' +
      items[i] +
      '<span class="tag-chip-remove" onclick="removeSettingsTag(\'' + type + '\', ' + i + ')">x</span>' +
    '</span>';
  }
  document.getElementById(containerId).innerHTML = html;
}

function addSettingsTag(type) {
  var inputId;
  var configKey;
  if (type === "domain") { inputId = "domainInput"; configKey = "allowedEmailDomains"; }
  else if (type === "repo") { inputId = "repoInput"; configKey = "allowedRepos"; }
  else if (type === "mcp") { inputId = "mcpInput"; configKey = "blockedMCPs"; }
  else if (type === "skill") { inputId = "skillInput"; configKey = "allowedSkills"; }
  else return;

  var input = document.getElementById(inputId);
  var value = input.value.trim();
  if (!value) return;
  if (SETTINGS_CONFIG[configKey].indexOf(value) > -1) { input.value = ""; return; }

  SETTINGS_CONFIG[configKey].push(value);
  input.value = "";

  var tagId = type === "domain" ? "domainTags" : type === "repo" ? "repoTags" : type === "mcp" ? "mcpTags" : "skillTags";
  renderSettingsTags(tagId, SETTINGS_CONFIG[configKey], type);
}

function removeSettingsTag(type, index) {
  var configKey;
  if (type === "domain") configKey = "allowedEmailDomains";
  else if (type === "repo") configKey = "allowedRepos";
  else if (type === "mcp") configKey = "blockedMCPs";
  else if (type === "skill") configKey = "allowedSkills";
  else return;

  SETTINGS_CONFIG[configKey].splice(index, 1);

  var tagId = type === "domain" ? "domainTags" : type === "repo" ? "repoTags" : type === "mcp" ? "mcpTags" : "skillTags";
  renderSettingsTags(tagId, SETTINGS_CONFIG[configKey], type);
}

function toggleSwitch(key) {
  SETTINGS_CONFIG[key] = !SETTINGS_CONFIG[key];
  var btnId = key === "scanEnabled" ? "toggleScanEnabled" : "toggleBlockOnLeak";
  updateToggleUI(btnId, SETTINGS_CONFIG[key]);
}

function updateToggleUI(btnId, isActive) {
  var btn = document.getElementById(btnId);
  if (isActive) {
    btn.classList.add("active");
  } else {
    btn.classList.remove("active");
  }
}

function saveSettings() {
  SETTINGS_CONFIG.maxScanLines = parseInt(document.getElementById("maxScanLinesInput").value, 10) || 5000;
  SETTINGS_CONFIG.pollingInterval = parseInt(document.getElementById("pollingIntervalSelect").value, 10);

  var toast = document.getElementById("settingsToast");
  toast.textContent = "Configuration saved successfully";
  toast.classList.add("settings-toast-show");
  setTimeout(function () { toast.classList.remove("settings-toast-show"); }, 2500);
}

function resetSettings() {
  SETTINGS_CONFIG.allowedEmailDomains = ["company.com"];
  SETTINGS_CONFIG.allowedRepos = ["github.com/company/.*", "gitlab.internal/.*"];
  SETTINGS_CONFIG.blockedMCPs = ["Filesystem", "Slack API", "AWS CLI", "Ansible", "Nessus Scanner", "OpenAI Proxy", "Personal Assets CDN", "Discord Bot MCP", "External DB Proxy", "Personal Repo Syncer"];
  SETTINGS_CONFIG.allowedSkills = ["code-review", "deploy-pipeline", "db-migration", "log-analyzer", "data-pipeline", "schema-designer", "query-optimizer", "component-gen", "css-refactor", "a11y-audit", "vuln-scanner", "threat-model", "forensics", "k8s-manifests", "helm-chart", "api-docs", "load-test", "model-trainer", "data-preprocess", "hyperparameter-tune", "model-eval", "iac-generator", "config-drift", "cost-optimizer", "runbook-gen", "ios-build", "react-native-gen", "app-store-review", "component-docs", "accessibility-check", "etl-generator", "sql-formatter", "data-quality", "test-gen", "bug-report", "api-scaffold", "payment-flow", "email-template", "tf-to-pulumi", "service-mesh", "shader-gen", "asset-pipeline", "physics-debug", "openapi-gen", "rate-limiter", "mocking-server"];
  SETTINGS_CONFIG.scanEnabled = true;
  SETTINGS_CONFIG.blockOnLeak = true;
  SETTINGS_CONFIG.maxScanLines = 5000;
  SETTINGS_CONFIG.pollingInterval = 30000;

  renderSettings();

  var toast = document.getElementById("settingsToast");
  toast.textContent = "Settings reset to defaults";
  toast.classList.add("settings-toast-show");
  setTimeout(function () { toast.classList.remove("settings-toast-show"); }, 2500);
}

document.addEventListener("DOMContentLoaded", function () {
  init();
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    closeDrawer();
  }
});