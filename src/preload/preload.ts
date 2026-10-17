import { contextBridge, ipcRenderer } from 'electron';
import type { SprachApi } from '../shared/types';

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
