/**
 * Electron main process.
 *
 * Lifecycle:
 *   1. app.whenReady() → create splash window immediately so the user has
 *      something to look at while we boot services.
 *   2. supervisor.startAll() — postgres → redis → backend → orchestrator.
 *   3. Once ready, register the `app://` protocol pointing at the bundled
 *      frontend, create the main window with the runtime URLs injected via
 *      `additionalArguments`, and dismiss the splash.
 *   4. Before-quit: graceful shutdown of every child.
 */

import { app, BrowserWindow, ipcMain, protocol, dialog, shell } from 'electron';
import { net as electronNet } from 'electron';
import path from 'node:path';
import url from 'node:url';
import fs from 'node:fs';

// Pre-import diagnostic — logs to /tmp BEFORE we touch app.getPath('userData')
// so we have a trail even when paths.ts blows up.
const diagPath = `/tmp/openqnt-electron-${process.pid}.log`;
const diag = (msg: string) => {
  try { fs.appendFileSync(diagPath, new Date().toISOString() + ' ' + msg + '\n'); } catch {}
};
diag(`main.js loaded; argv=${process.argv.join(' ')}`);
process.on('uncaughtException', (e) => diag(`uncaughtException: ${e.stack ?? e}`));
process.on('unhandledRejection', (e) => diag(`unhandledRejection: ${(e as any)?.stack ?? e}`));

import { paths, isDev } from './lib/paths';
import { log, snapshot as logSnapshot, subscribe as subscribeLogs, closeAll as closeLogs } from './lib/logger';
import { supervisor } from './services/supervisor';
diag('imports complete');

let splash: BrowserWindow | null = null;
let main: BrowserWindow | null = null;
let mainSpawned = false;

// macOS sandboxed binaries spawned from Resources/ need their LC_RPATH already
// rewritten — this is handled by electron/scripts/relocate-dylibs.sh at bundle
// time. Nothing to do at runtime.

function appVersion(): string {
  try {
    return app.getVersion();
  } catch {
    return '0.0.0';
  }
}

function createSplash(): BrowserWindow {
  const win = new BrowserWindow({
    width: 480,
    height: 360,
    frame: false,
    transparent: false,
    resizable: false,
    movable: true,
    show: false,
    backgroundColor: '#0c0d12',
    title: 'OpenQnt',
    webPreferences: {
      preload: paths().preloadJs,
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [`--app-version=${appVersion()}`],
    },
  });
  win.loadFile(paths().splashHtml);
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => {
    splash = null;
  });
  return win;
}

function registerAppProtocol(): void {
  // app://localhost/<path>  →  resourcesPath/frontend/<path>
  protocol.handle('app', async (req) => {
    const u = new URL(req.url);
    const requested = decodeURIComponent(u.pathname.replace(/^\//, ''));
    const frontendDir = path.dirname(paths().frontendIndex);
    let target = path.normalize(path.join(frontendDir, requested || 'index.html'));
    // Block traversal
    if (!target.startsWith(frontendDir)) {
      return new Response('forbidden', { status: 403 });
    }
    // SPA fallback
    if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
      target = path.join(frontendDir, 'index.html');
    }
    return electronNet.fetch(url.pathToFileURL(target).toString());
  });
}

function createMainWindow(): BrowserWindow {
  const urls = supervisor.getUrls();
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    backgroundColor: '#0c0d12',
    title: 'OpenQnt',
    webPreferences: {
      preload: paths().preloadJs,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // required so the preload can use ipcRenderer/shell
      devTools: true, // Cmd-Option-I works in production builds too
      additionalArguments: [
        `--backend-url=${urls.backend}`,
        `--orchestrator-url=${urls.orchestrator}`,
        `--ws-url=${urls.ws}`,
        `--user-data-path=${paths().userDataRoot}`,
        `--app-version=${appVersion()}`,
      ],
    },
  });

  // Capture every renderer console message + load failure into renderer.log
  // so we can diagnose blank-page / runtime-error issues in shipped builds
  // without round-tripping the user through DevTools.
  win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    const sev = ['VERBOSE', 'INFO', 'WARN', 'ERROR'][level] ?? 'INFO';
    log('renderer', `[${sev}] ${message} (${sourceId}:${line})`);
  });
  win.webContents.on('did-fail-load', (_e, code, desc, validatedURL) => {
    log('renderer', `did-fail-load code=${code} desc=${desc} url=${validatedURL}`);
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    log('renderer', `render-process-gone reason=${details.reason} exitCode=${details.exitCode}`);
  });
  win.webContents.on('preload-error', (_e, preloadPath, err) => {
    log('renderer', `preload-error path=${preloadPath} err=${err.stack ?? err.message}`);
  });

  if (isDev()) {
    win.loadURL(paths().frontendIndex);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Load at the root path, NOT /index.html — React Router uses BrowserRouter
    // and treats `/index.html` as a route that doesn't exist (→ 404 page).
    // The app:// protocol handler resolves `/` to index.html on disk.
    win.loadURL('app://localhost/');
    // Auto-open DevTools while we stabilize the renderer. Set
    // OPENQNT_DEVTOOLS=0 to disable. Will be flipped to off-by-default
    // once the dashboard renders cleanly on a fresh install.
    if (process.env.OPENQNT_DEVTOOLS !== '0') {
      win.webContents.openDevTools({ mode: 'detach' });
    }
  }

  win.once('ready-to-show', () => {
    win.show();
    if (splash && !splash.isDestroyed()) splash.close();
  });

  win.on('closed', () => {
    main = null;
  });

  return win;
}

function registerIpc(): void {
  ipcMain.handle('health:snapshot', () => supervisor.snapshot());
  ipcMain.handle('logs:reveal', () => shell.openPath(paths().logsDir));
  ipcMain.handle('app:quit', () => app.quit());
  ipcMain.handle('splash:dismiss', () => {
    if (mainSpawned) return;
    mainSpawned = true;
    main = createMainWindow();
  });

  // Stream new log lines to any open window (splash diagnostics + future
  // in-app log viewer). Wrapped in try/catch — once a renderer is being
  // torn down `webContents.send` throws "Render frame was disposed" until
  // the next tick. We want logging to keep working through that window.
  subscribeLogs((line) => {
    for (const w of BrowserWindow.getAllWindows()) {
      if (w.isDestroyed()) continue;
      const wc = w.webContents;
      if (wc.isDestroyed() || wc.isCrashed() || wc.isLoading()) continue;
      try { wc.send('log:line', line); } catch { /* renderer mid-teardown */ }
    }
  });
}

async function bootstrap(): Promise<void> {
  registerIpc();
  splash = createSplash();
  registerAppProtocol();

  log('main', `OpenQnt ${appVersion()} bootstrap (dev=${isDev()}, arch=${process.arch})`);
  log('main', `userData=${paths().userDataRoot}`);

  try {
    await supervisor.startAll();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log('main', `Bootstrap failed: ${msg}`);
    dialog.showMessageBox({
      type: 'error',
      title: 'OpenQnt — startup failed',
      message: 'OpenQnt could not start one of its services.',
      detail: `${msg}\n\nLogs: ${paths().logsDir}`,
      buttons: ['Reveal logs', 'Quit'],
      defaultId: 0,
    }).then((res) => {
      if (res.response === 0) shell.openPath(paths().logsDir);
      app.quit();
    });
    return;
  }

  // Belt-and-suspenders: if the splash window never made the IPC call (e.g.
  // because splash.html failed to load) but services are ready, spawn the
  // main window after a short grace period so the user isn't stuck with
  // nothing visible.
  setTimeout(() => {
    if (!mainSpawned) {
      log('main', 'Splash never dismissed — spawning main window directly.');
      mainSpawned = true;
      main = createMainWindow();
      if (splash && !splash.isDestroyed()) splash.close();
    }
  }, 2_000);
}

// Single-instance lock — second launch focuses the existing window.
const lock = app.requestSingleInstanceLock();
if (!lock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (main && !main.isDestroyed()) {
      if (main.isMinimized()) main.restore();
      main.focus();
    } else if (splash && !splash.isDestroyed()) {
      splash.focus();
    }
  });
}

// macOS: register `app://` as standard so fetches and asset URLs work.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

diag('about to call app.whenReady');
app.whenReady().then(() => { diag('app.whenReady fired'); return bootstrap(); }).catch((err) => {
  diag(`bootstrap error: ${err instanceof Error ? err.stack : err}`);
  log('main', `whenReady error: ${err instanceof Error ? err.stack : err}`);
});

let didBeginShutdown = false;
async function gracefulShutdown(): Promise<void> {
  if (didBeginShutdown) return;
  didBeginShutdown = true;
  supervisor.beginShutdown();
  await supervisor.stopAll();
  closeLogs();
}

app.on('before-quit', (event) => {
  if (didBeginShutdown) return;
  event.preventDefault();
  gracefulShutdown().finally(() => app.exit(0));
});

app.on('window-all-closed', () => {
  // On macOS the convention is to keep the app running until Cmd-Q. But our
  // app holds heavy services, so we quit on window close to stop them.
  if (process.platform !== 'darwin' || isDev()) {
    app.quit();
  }
});

app.on('activate', () => {
  if (!main && supervisor.snapshot().ready) {
    main = createMainWindow();
  }
});
