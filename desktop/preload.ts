import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopBridge } from '../src/desktop/contracts';

const bridge: DesktopBridge = {
  analyze: (input) => ipcRenderer.invoke('aebot:analyze', input),
  catalog: () => ipcRenderer.invoke('aebot:catalog'),
  status: () => ipcRenderer.invoke('aebot:status'),
  restartModel: () => ipcRenderer.invoke('aebot:restart'),
  importRules: () => ipcRenderer.invoke('aebot:import-rules'),
  saveFeedback: (input) => ipcRenderer.invoke('aebot:feedback', input),
  exportReport: () => ipcRenderer.invoke('aebot:export'),
};
contextBridge.exposeInMainWorld('aebotDesktop', bridge);
