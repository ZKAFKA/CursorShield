var http = require('http');
var fs = require('fs');
var path = require('path');

var PORT = 3000;
var SHARED_TOKEN = process.env.CURSORSHIELD_TOKEN || 'cursor-shield-secret-token-2024';
var WEB_DIR = path.join(__dirname);
var DATA_DIR = path.join(__dirname, 'data');
var DEVICES_FILE = path.join(DATA_DIR, 'devices.json');

var MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

var allDevices = {};

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadDevices() {
  try {
    if (fs.existsSync(DEVICES_FILE)) {
      var raw = fs.readFileSync(DEVICES_FILE, 'utf-8');
      allDevices = JSON.parse(raw);
      console.log('Loaded ' + Object.keys(allDevices).length + ' device(s) from disk');
    }
  } catch (e) {
    console.error('Failed to load devices:', e.message);
  }
}

function saveDevices() {
  try {
    fs.writeFileSync(DEVICES_FILE, JSON.stringify(allDevices, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save devices:', e.message);
  }
}

function serveStatic(req, res, urlPath) {
  if (urlPath === '/') urlPath = '/index.html';
  var filePath = path.join(WEB_DIR, urlPath);
  var ext = path.extname(filePath).toLowerCase();
  var contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, function (err, data) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: ' + urlPath);
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
}

function parseBody(req, callback) {
  var chunks = [];
  req.on('data', function (chunk) { chunks.push(chunk); });
  req.on('end', function () {
    try {
      var raw = Buffer.concat(chunks).toString('utf-8');
      callback(null, raw ? JSON.parse(raw) : null);
    } catch (e) {
      callback(e, null);
    }
  });
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data));
}

function checkAuth(req, res) {
  var authHeader = req.headers['authorization'] || '';
  if (!authHeader) {
    sendJSON(res, 401, { error: 'Missing Authorization header' });
    return false;
  }
  var parts = authHeader.split(' ');
  if (parts[0] !== 'Bearer' || parts[1] !== SHARED_TOKEN) {
    sendJSON(res, 403, { error: 'Invalid token' });
    return false;
  }
  return true;
}

function validateReport(body, res) {
  if (!body || typeof body !== 'object') {
    sendJSON(res, 400, { error: 'Invalid JSON body' });
    return false;
  }
  if (!body.deviceId || typeof body.deviceId !== 'string') {
    sendJSON(res, 400, { error: 'Missing deviceId' });
    return false;
  }
  if (JSON.stringify(body).length > 500000) {
    sendJSON(res, 413, { error: 'Payload too large' });
    return false;
  }
  return true;
}

function handleReport(req, res) {
  if (!checkAuth(req, res)) return;

  parseBody(req, function (err, body) {
    if (err) { sendJSON(res, 400, { error: 'Invalid JSON' }); return; }
    if (!validateReport(body, res)) return;

    body.lastSync = Date.now();

    if (!body.id) {
      body.id = 'DEV-' + body.deviceId.replace(/[^A-Za-z0-9]/g, '-').substring(0, 20);
    }
    if (!body.employeeName) {
      body.employeeName = body.deviceId;
    }

    allDevices[body.deviceId] = body;
    saveDevices();

    console.log('Report received: ' + body.deviceId + ' (' + body.employeeName + ')');
    sendJSON(res, 200, { status: 'ok', deviceId: body.deviceId });
  });
}

function handleDevices(req, res) {
  var list = [];
  var keys = Object.keys(allDevices);
  for (var i = 0; i < keys.length; i++) {
    list.push(allDevices[keys[i]]);
  }
  sendJSON(res, 200, list);
}

function handleStats(req, res) {
  var keys = Object.keys(allDevices);
  var stats = {
    totalDevices: keys.length,
    accountAnomaly: 0,
    gitError: 0,
    mcpSkillError: 0,
    sensitiveLeaks: 0,
    totalLeaks: 0,
    criticalDevices: 0,
    highDevices: 0,
    mediumDevices: 0,
    lowDevices: 0
  };

  for (var i = 0; i < keys.length; i++) {
    var d = allDevices[keys[i]];
    if (d.account && !d.account.isCompliant) stats.accountAnomaly++;
    if (d.git && !d.git.isCompliant && d.git.originUrl) stats.gitError++;
    if (d.mcpSkill && (d.mcpSkill.unauthorizedMCPs > 0 || d.mcpSkill.unauthorizedSkills > 0)) stats.mcpSkillError++;
    if (d.sensitiveInfo && d.sensitiveInfo.totalLeaks > 0) stats.sensitiveLeaks++;
    if (d.sensitiveInfo) stats.totalLeaks += d.sensitiveInfo.totalLeaks;

    var risk = d.riskScore || 0;
    if (risk >= 30) stats.criticalDevices++;
    else if (risk >= 15) stats.highDevices++;
    else if (risk >= 5) stats.mediumDevices++;
    else stats.lowDevices++;
  }

  sendJSON(res, 200, stats);
}

function handleCORS(req, res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end();
}

var server = http.createServer(function (req, res) {
  if (req.method === 'OPTIONS') {
    handleCORS(req, res);
    return;
  }

  var urlPath = req.url.split('?')[0];

  if (req.method === 'POST' && urlPath === '/api/report') {
    handleReport(req, res);
  } else if (req.method === 'GET' && urlPath === '/api/devices') {
    handleDevices(req, res);
  } else if (req.method === 'GET' && urlPath === '/api/stats') {
    handleStats(req, res);
  } else {
    serveStatic(req, res, urlPath);
  }
});

loadDevices();

server.listen(PORT, function () {
  console.log('========================================');
  console.log('  CursorShield Monitor Server');
  console.log('========================================');
  console.log('  Dashboard : http://localhost:' + PORT);
  console.log('  API       : http://localhost:' + PORT + '/api');
  console.log('  Token     : ' + SHARED_TOKEN.substring(0, 8) + '...');
  console.log('  Devices   : ' + Object.keys(allDevices).length + ' loaded');
  console.log('========================================');
  console.log('Press Ctrl+C to stop.');
});