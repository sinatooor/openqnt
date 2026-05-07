/**
 * Preload — exposes a synchronous URL bridge plus a few async helpers.
 *
 * The URLs MUST be available synchronously at module-load time because the
 * frontend reads them from many `import.meta`/module-init code paths
 * (services/api.ts evaluates URL at first import). We pass them via
 * `additionalArguments` so they're parsed from process.argv before any
 * renderer JS runs.
 */

import { contextBridge, ipcRenderer, shell } from 'electron';

interface InjectedUrls {
  backendUrl: string;
  orchestratorUrl: string;
  wsUrl: string;
  isDesktop: boolean;
  userDataPath: string;
}

function readArg(name: string, fallback = ''): string {
  const flag = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(flag));
  return hit ? hit.slice(flag.length) : fallback;
}

const urls: InjectedUrls = {
  backendUrl: readArg('backend-url', 'http://localhost:8000'),
  orchestratorUrl: readArg('orchestrator-url', 'http://localhost:3000'),
  wsUrl: readArg('ws-url', 'ws://localhost:3000'),
  isDesktop: true,
  userDataPath: readArg('user-data-path', ''),
};

const electronAPI = {
  ...urls,
  /** Splash and diagnostics call this every 250ms. */
  healthSnapshot: (): Promise<unknown> => ipcRenderer.invoke('health:snapshot'),
  /** Subscribe to live log lines (for the splash diagnostics panel). */
  onLogLine: (cb: (line: string) => void): (() => void) => {
    const handler = (_e: unknown, line: string) => cb(line);
    ipcRenderer.on('log:line', handler);
    return () => ipcRenderer.off('log:line', handler);
  },
  /** Reveal the userData/logs/ folder in Finder. */
  revealLogsFolder: (): Promise<void> => ipcRenderer.invoke('logs:reveal'),
  /** Tell main to dismiss splash + show the main window. */
  dismissSplash: (): Promise<void> => ipcRenderer.invoke('splash:dismiss'),
  /** Quit the entire app. */
  quit: (): Promise<void> => ipcRenderer.invoke('app:quit'),
  /** Open an external URL in the default browser. */
  openExternal: (url: string): Promise<void> => shell.openExternal(url),
  /** App version banner for the about/help dialogs. */
  appVersion: readArg('app-version', '0.0.0'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
