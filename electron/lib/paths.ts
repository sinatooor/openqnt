/**
 * Resolved on-disk paths used throughout the main process.
 *
 * Two roots:
 *   - resourcesRoot  read-only, lives inside .app/Contents/Resources/ in
 *                    packaged builds, or alongside the repo in dev mode.
 *   - userDataRoot   writable, ~/Library/Application Support/OpenQnt/
 *
 * In dev (`--dev`), resourcesRoot points at the repo root so we don't need a
 * fully-bundled Python tree to iterate.
 */

import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

export interface AppPaths {
  resourcesRoot: string;
  userDataRoot: string;
  logsDir: string;
  configFile: string;
  pgDataDir: string;
  redisDir: string;
  agentsDir: string;
  chromaDir: string;
  pythonBin: string;
  pythonLibs: string;
  modelsDir: string;
  backendDir: string;
  orchestratorBinary: string;
  orchestratorEnginesDir: string;
  postgresBinDir: string;
  redisBin: string;
  frontendIndex: string;
  preloadJs: string;
  splashHtml: string;
}

let cached: AppPaths | null = null;

export function paths(): AppPaths {
  if (cached) return cached;

  const isDev = process.argv.includes('--dev');
  const repoRoot = path.resolve(__dirname, '..', '..');

  // In packaged builds Electron sets `process.resourcesPath` to .app/Contents/Resources.
  // Our extraResources land directly there.
  const resourcesRoot = isDev ? repoRoot : process.resourcesPath;

  const userDataRoot = app.getPath('userData');
  const logsDir = path.join(userDataRoot, 'logs');
  const pgDataDir = path.join(userDataRoot, 'pgdata');
  const redisDir = path.join(userDataRoot, 'redis');

  // Pick the postgres / orchestrator / python tree by arch — we bundle both
  // when shipping universal2, but inside one .app the runtime arch is fixed
  // by macOS at launch time, so process.arch is authoritative here.
  const archDir = process.arch === 'arm64' ? 'arm64' : 'x64';

  const postgresBinDir = isDev
    ? '' // postgres won't actually be started in dev
    : path.join(resourcesRoot, 'postgres', archDir, 'bin');
  const redisBin = isDev
    ? ''
    : path.join(resourcesRoot, 'redis', `redis-server-${archDir}`);

  const pythonBin = isDev
    ? '/opt/miniconda3/envs/fyer/bin/python' // dev: use the conda env
    : path.join(resourcesRoot, 'python', 'bin', 'python3');
  const pythonLibs = path.join(resourcesRoot, 'python-libs');
  const modelsDir = path.join(resourcesRoot, 'models');
  const backendDir = isDev
    ? path.join(repoRoot, 'backend')
    : path.join(resourcesRoot, 'backend');

  const orchestratorBinary = isDev
    ? ''
    : path.join(resourcesRoot, `orchestrator-${archDir}`);
  const orchestratorEnginesDir = path.join(resourcesRoot, 'orchestrator-engines');

  const frontendIndex = isDev
    ? 'http://localhost:5173/'
    : path.join(resourcesRoot, 'frontend', 'index.html');

  // __dirname is electron/dist/lib at runtime. preload.js sits one up; the
  // splash.html sits TWO up (in electron/, not electron/dist/) because we
  // ship the source HTML alongside the compiled JS rather than copying it.
  const preloadJs = path.join(__dirname, '..', 'preload.js');
  const splashHtml = path.join(__dirname, '..', '..', 'splash.html');

  for (const dir of [logsDir, userDataRoot]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  cached = {
    resourcesRoot,
    userDataRoot,
    logsDir,
    configFile: path.join(userDataRoot, 'config.json'),
    pgDataDir,
    redisDir,
    agentsDir: path.join(userDataRoot, 'agents'),
    chromaDir: path.join(userDataRoot, 'chroma_db_v2'),
    pythonBin,
    pythonLibs,
    modelsDir,
    backendDir,
    orchestratorBinary,
    orchestratorEnginesDir,
    postgresBinDir,
    redisBin,
    frontendIndex,
    preloadJs,
    splashHtml,
  };
  return cached;
}

export const isDev = (): boolean => process.argv.includes('--dev');
