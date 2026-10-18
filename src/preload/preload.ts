import { contextBridge, ipcRenderer } from 'electron';
import type { SessionApi, SprachApi } from '../shared/types';

const api: SprachApi = {
  getPreferences: () => ipcRenderer.invoke('prefs:get'),
  savePreferences: (prefs) => ipcRenderer.invoke('prefs:save', prefs),
  getKeyStatus: () => ipcRenderer.invoke('keys:status'),
  saveSecret: (name, value) => ipcRenderer.invoke('keys:save', name, value),
  testAnthropic: () => ipcRenderer.invoke('keys:testAnthropic'),
  testAzure: () => ipcRenderer.invoke('keys:testAzure'),
  startSession: (options) => ipcRenderer.invoke('session:start', options),
  stopSession: () => ipcRenderer.invoke('session:stop'),
  openSettings: () => ipcRenderer.invoke('window:settings'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
};

contextBridge.exposeInMainWorld('sprach', api);

const sessionApi: SessionApi = {
  getOptions: () => ipcRenderer.invoke('conv:options'),
  getSpeechToken: () => ipcRenderer.invoke('conv:token'),
  sendTurn: (text, rate) => ipcRenderer.invoke('conv:send', text, rate),
  cancelTurn: () => ipcRenderer.invoke('conv:cancel'),
  endSession: () => ipcRenderer.invoke('session:stop'),
  onSegment: (handler) => ipcRenderer.on('conv:segment', (_e, ev) => handler(ev)),
  onTurnDone: (handler) => ipcRenderer.on('conv:done', (_e, ev) => handler(ev)),
};

contextBridge.exposeInMainWorld('sprachSession', sessionApi);
