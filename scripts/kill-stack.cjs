#!/usr/bin/env node
/* eslint-disable no-console */
// Mata SOLO procesos que pertenecen al proyecto PeaKu, identificados por
// su command line. NO toca procesos de otros proyectos que pudieran estar
// escuchando en los mismos puertos.
//
// Estrategia:
//   1. Por cada puerto del proyecto, listar PIDs LISTENING
//   2. Para cada PID, obtener su command line completa
//   3. Killear SOLO si el cmdline contiene marcadores del proyecto:
//       - "@peaku/"        (filter de pnpm workspace)
//       - "dev-service.cjs" (nuestro helper)
//       - path absoluto al directorio del proyecto
//   4. Saltear cualquier otro proceso (Docker, otros proyectos, etc.)
//
// Para los containers de Mongo usamos `docker compose down` que es
// específico de este proyecto (lee este directorio's docker-compose.yml).

const { execSync } = require('child_process');
const path = require('path');

const NODE_PORTS = [4050, 3001, 3002, 4200]; // gateway, auth, products, frontend
const isWindows = process.platform === 'win32';

// Marcadores que identifican un proceso como "nuestro".
// Si el command line de un PID contiene CUALQUIERA de estos strings, lo matamos.
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PEAKU_MARKERS = [
  '@peaku/',
  'dev-service.cjs',
  PROJECT_ROOT, // Path absoluto del repo (D:\WalterNights\... o /Users/...)
  // Normalizamos slashes para que match en Windows con \ y POSIX con /
  PROJECT_ROOT.replace(/\\/g, '/'),
];

function getPidsListening(port) {
  try {
    const cmd = isWindows
      ? `netstat -ano | findstr LISTENING | findstr ":${port} "`
      : `lsof -ti:${port}`;
    const out = execSync(cmd, { encoding: 'utf8' });
    if (!out) return [];
    if (isWindows) {
      const pids = new Set();
      for (const line of out.split('\n').filter(Boolean)) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0') pids.add(pid);
      }
      return [...pids];
    }
    return out.split('\n').map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function getCommandLine(pid) {
  if (isWindows) {
    // PowerShell Get-CimInstance: estable, no deprecated. Más confiable que wmic.
    try {
      const ps = `Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" | Select-Object -ExpandProperty CommandLine`;
      const out = execSync(`powershell -NoProfile -NonInteractive -Command "${ps}"`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return out.trim();
    } catch {
      // Fallback a wmic (deprecated pero funciona en máquinas viejas)
      try {
        const out = execSync(
          `wmic process where ProcessId=${pid} get CommandLine /value`,
          { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
        );
        const m = out.match(/CommandLine=(.*)/);
        return m ? m[1].trim() : '';
      } catch {
        return '';
      }
    }
  }
  try {
    const out = execSync(`ps -p ${pid} -o args=`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.trim();
  } catch {
    return '';
  }
}

function isPeakuProcess(cmdline) {
  if (!cmdline) return false;
  // El path puede tener mayúsculas/minúsculas distintas en Windows
  const lower = cmdline.toLowerCase();
  return PEAKU_MARKERS.some((m) => lower.includes(m.toLowerCase()));
}

function killTree(pid) {
  try {
    if (isWindows) {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
    } else {
      execSync(`kill -KILL ${pid}`, { stdio: 'ignore' });
    }
    return true;
  } catch {
    return false;
  }
}

let killed = 0;
let skipped = 0;
let foreign = 0;

for (const port of NODE_PORTS) {
  const pids = getPidsListening(port);
  for (const pid of pids) {
    const cmd = getCommandLine(pid);

    if (!cmd) {
      // No pudimos leer el cmdline (permisos, proceso protegido). Salteamos
      // por seguridad — preferimos dejar un zombie vivo que matar Docker.
      console.log(`⚠️  port ${port} PID ${pid} — cannot read cmdline, skipping`);
      skipped++;
      continue;
    }

    if (isPeakuProcess(cmd)) {
      const ok = killTree(pid);
      if (ok) {
        console.log(`✓ port ${port} PID ${pid} killed (PeaKu process)`);
        killed++;
      }
    } else {
      // Otro proyecto / Docker / proceso del sistema. NO tocar.
      const short = cmd.length > 80 ? cmd.slice(0, 80) + '...' : cmd;
      console.log(`⏭️  port ${port} PID ${pid} — foreign process, leaving alone: ${short}`);
      foreign++;
    }
  }
}

// Bajar containers de PeaKu (docker-compose lee SOLO este proyecto's compose file)
try {
  execSync('docker compose down', { stdio: 'ignore' });
  console.log('✓ docker compose down (PeaKu containers)');
} catch {
  // No es error si Docker no corre / no hay containers PeaKu
}

const summary = [];
if (killed > 0) summary.push(`${killed} PeaKu killed`);
if (foreign > 0) summary.push(`${foreign} foreign processes preserved`);
if (skipped > 0) summary.push(`${skipped} skipped`);
console.log(summary.length > 0 ? `✓ ${summary.join(', ')}` : '✓ Stack limpio (sin procesos colgados)');
