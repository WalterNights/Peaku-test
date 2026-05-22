#!/usr/bin/env node
/* eslint-disable no-console */
// Helper para arrancar un servicio en modo dev desde el monorepo root.
//
// Resuelve dos problemas críticos en Windows:
//   1. .env raíz: lo carga `node --env-file=.env` antes de invocar este script.
//      Aquí mapeamos MONGO_<SVC>_URI_LOCAL → MONGO_URI según el servicio.
//   2. Cleanup de procesos: con `shell: true` (necesario para pnpm.cmd en
//      Windows), los grandchildren (pnpm → nest → tsc + node) no reciben
//      SIGTERM al matar el padre. Solución: en SIGINT/SIGTERM ejecutamos
//      `taskkill /F /T` (Windows) o `kill -KILL -<pgid>` (Unix) para
//      garantizar que el árbol entero muera. Sin esto, quedan procesos
//      consumiendo RAM (lo que el usuario quería prevenir).
//
// Uso desde package.json:
//   "dev:auth": "node --env-file=.env scripts/dev-service.cjs auth"

const { spawn, execSync } = require('child_process');

const FILTER_MAP = {
  auth: '@peaku/auth-service',
  products: '@peaku/products-service',
  gateway: '@peaku/api-gateway',
};
const MONGO_URI_MAP = {
  auth: 'MONGO_AUTH_URI_LOCAL',
  products: 'MONGO_PRODUCTS_URI_LOCAL',
};

const service = process.argv[2];

if (!FILTER_MAP[service]) {
  console.error(
    `[dev-service] Invalid service "${service}". Use one of: ${Object.keys(FILTER_MAP).join(', ')}`,
  );
  process.exit(1);
}

const runningOutsideDocker = !process.env.INSIDE_DOCKER;

// Mapear URI local → MONGO_URI cuando se corre fuera de Docker.
const localUriVar = MONGO_URI_MAP[service];
if (localUriVar && process.env[localUriVar] && runningOutsideDocker) {
  process.env.MONGO_URI = process.env[localUriVar];
}

// El gateway hace forward a auth-service / products-service. Esas URLs por
// default apuntan al hostname interno de Docker (`auth-service:3001`) que
// NO resuelve fuera del docker network. Mapeamos a las URLs *_LOCAL que
// apuntan a 127.0.0.1.
if (service === 'gateway' && runningOutsideDocker) {
  if (process.env.AUTH_SERVICE_URL_LOCAL) {
    process.env.AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL_LOCAL;
  }
  if (process.env.PRODUCTS_SERVICE_URL_LOCAL) {
    process.env.PRODUCTS_SERVICE_URL = process.env.PRODUCTS_SERVICE_URL_LOCAL;
  }
}

const filter = FILTER_MAP[service];
const isWindows = process.platform === 'win32';

// shell: true es necesario en Windows para resolver pnpm.cmd. Trade-off:
// los grandchildren no reciben SIGTERM → lo resolvemos en el handler abajo.
const child = spawn('pnpm', ['--filter', filter, 'start:dev'], {
  stdio: 'inherit',
  env: process.env,
  shell: true,
  // detached: true permite usar `kill(-pid)` en Unix para matar el grupo entero.
  detached: !isWindows,
});

let killed = false;
const killTree = (signal = 'SIGTERM') => {
  if (killed || !child.pid) return;
  killed = true;
  try {
    if (isWindows) {
      // /F = force, /T = tree (mata el árbol completo de procesos hijos)
      execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' });
    } else {
      // Negativo = matar el process group entero (gracias a detached: true)
      process.kill(-child.pid, signal);
    }
  } catch {
    // El proceso ya puede haber muerto; no es un error real.
  }
};

process.on('SIGINT', () => killTree('SIGINT'));
process.on('SIGTERM', () => killTree('SIGTERM'));
process.on('exit', () => killTree('SIGTERM'));

child.on('exit', (code, signal) => {
  process.exit(signal ? 0 : code ?? 0);
});
