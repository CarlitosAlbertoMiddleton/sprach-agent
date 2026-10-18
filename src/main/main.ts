import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, Notification, screen, session, Tray } from 'electron';
import { join } from 'node:path';
import type { Preferences, SecretName, SessionOptions } from '../shared/types';
import { loadPreferences, savePreferences } from './preferences';
import { keyStatus, saveSecret } from './secrets';
import { testAnthropic, testAzure } from './keyTests';
import { Conversation } from './conversation';
import { speechToken } from './speech';

const ASSETS = join(__dirname, '..', '..', 'assets');
const RENDERER = join(__dirname, '..', 'web', 'renderer');
const PRELOAD = join(__dirname, '..', 'preload', 'preload.js');

let tray: Tray | null = null;
let quickStartWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let sessionWindow: BrowserWindow | null = null;
let activeSession: SessionOptions | null = null;
let conversation: Conversation | null = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function createWindow(page: string, width: number, height: number, extra: Electron.BrowserWindowConstructorOptions = {}): BrowserWindow {
  const win = new BrowserWindow({
    width,
    height,
    ...extra,
    resizable: true,
    minimizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    title: 'Sprach-Agent',
    icon: join(ASSETS, 'icon.png'),
    show: false,
    webPreferences: { preload: PRELOAD, contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  win.loadFile(join(RENDERER, page));
  win.once('ready-to-show', () => win.show());
  return win;
}

function showQuickStart(): void {
  if (quickStartWindow && !quickStartWindow.isDestroyed()) {
    quickStartWindow.focus();
    return;
  }
  quickStartWindow = createWindow('quickstart.html', 470, 760);
  quickStartWindow.on('closed', () => (quickStartWindow = null));
}

function showSettings(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = createWindow('settings.html', 540, 720);
  settingsWindow.on('closed', () => (settingsWindow = null));
}

/** The hotkey and the tray click both toggle: start options when idle, stop when active. */
function toggle(): void {
  if (activeSession) stopSession();
  else showQuickStart();
}

function startSession(options: SessionOptions): void {
  activeSession = options;
  conversation = null;
  savePreferences({ lastSession: options });
  quickStartWindow?.close();
  updateTray();
  // Small window at the bottom right that shows what is heard and said.
  const area = screen.getPrimaryDisplay().workArea;
  const width = 400;
  const height = 560;
  sessionWindow = createWindow('session.html', width, height, {
    x: area.x + area.width - width - 16,
    y: area.y + area.height - height - 16,
    alwaysOnTop: true,
  });
  sessionWindow.on('closed', () => {
    sessionWindow = null;
    stopSession();
  });
}

function stopSession(): void {
  if (!activeSession) return;
  activeSession = null;
  conversation?.cancel();
  conversation = null;
  if (sessionWindow && !sessionWindow.isDestroyed()) sessionWindow.close();
  updateTray();
  notify('Sitzung beendet', 'Bis zum nächsten Mal!');
}

function notify(title: string, body: string): void {
  if (Notification.isSupported()) new Notification({ title, body, icon: join(ASSETS, 'icon.png') }).show();
}

function updateTray(): void {
  if (!tray) return;
  const active = activeSession !== null;
  tray.setImage(nativeImage.createFromPath(join(ASSETS, active ? 'tray-active.png' : 'tray-idle.png')));
  const hotkey = loadPreferences().hotkey;
  tray.setToolTip(active ? 'Sprach-Agent: Sitzung aktiv' : `Sprach-Agent: bereit (${hotkey})`);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      active
        ? { label: 'Sitzung beenden', click: stopSession }
        : { label: 'Sitzung starten…', click: showQuickStart },
      { label: 'Einstellungen…', click: showSettings },
      { type: 'separator' },
      { label: 'Sprach-Agent beenden', click: () => app.quit() },
    ]),
  );
}

function registerHotkey(prefs: Preferences): void {
  globalShortcut.unregisterAll();
  if (!globalShortcut.register(prefs.hotkey, toggle)) {
    notify('Tastenkürzel belegt', `${prefs.hotkey} wird schon von einem anderen Programm benutzt. Bitte in den Einstellungen ändern.`);
  }
}

function registerIpc(): void {
  ipcMain.handle('prefs:get', () => loadPreferences());
  ipcMain.handle('prefs:save', (_e, update: Partial<Preferences>) => {
    const before = loadPreferences();
    const saved = savePreferences(update);
    if (saved.hotkey !== before.hotkey) registerHotkey(saved);
    updateTray();
    return saved;
  });
  ipcMain.handle('keys:status', () => keyStatus());
  ipcMain.handle('keys:save', (_e, name: SecretName, value: string) => {
    if (name !== 'anthropicKey' && name !== 'azureSpeechKey') throw new Error('Unbekannter Schlüssel');
    saveSecret(name, value);
    return keyStatus();
  });
  ipcMain.handle('keys:testAnthropic', () => testAnthropic());
  ipcMain.handle('keys:testAzure', () => testAzure(loadPreferences().azureRegion));
  ipcMain.handle('session:start', (_e, options: SessionOptions) => startSession(options));
  ipcMain.handle('session:stop', () => stopSession());
  ipcMain.handle('window:settings', () => showSettings());
  ipcMain.handle('conv:options', () => activeSession);
  ipcMain.handle('conv:token', () => speechToken(loadPreferences().azureRegion));
  ipcMain.handle('conv:send', (e, text: string | null, rate: number) => {
    if (!activeSession) throw new Error('Keine Sitzung aktiv.');
    if (!conversation) {
      const sender = e.sender;
      const prefs = loadPreferences();
      conversation = new Conversation(activeSession, prefs.model, prefs.azureRegion, {
        segment: (ev) => !sender.isDestroyed() && sender.send('conv:segment', ev),
        done: (ev) => !sender.isDestroyed() && sender.send('conv:done', ev),
      });
    }
    return conversation.send(text, rate);
  });
  ipcMain.handle('conv:cancel', () => conversation?.cancel());
  ipcMain.handle('window:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close());
}

app.on('second-instance', toggle);

// Keep running in the tray when all windows are closed.
app.on('window-all-closed', () => {});

app.on('will-quit', () => globalShortcut.unregisterAll());

app.whenReady().then(() => {
  app.setAppUserModelId('com.carlitos.sprachagent');
  // Only the microphone is needed, and only our own windows can ask for it.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(permission === 'media'));
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media');
  registerIpc();
  tray = new Tray(nativeImage.createFromPath(join(ASSETS, 'tray-idle.png')));
  tray.on('click', toggle);
  updateTray();
  const prefs = loadPreferences();
  registerHotkey(prefs);
  const keys = keyStatus();
  if (!keys.anthropicKey || !keys.azureSpeechKey) showSettings();
  else notify('Sprach-Agent ist bereit', `${prefs.hotkey} drücken oder auf das Symbol in der Taskleiste klicken.`);
});
