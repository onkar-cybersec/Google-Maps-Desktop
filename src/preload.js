const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('googleMapsDesktop', {
  appName: 'Google Maps Desktop',
  homeUrl: 'https://www.google.com/maps',
  back: () => ipcRenderer.invoke('maps:back'),
  forward: () => ipcRenderer.invoke('maps:forward'),
  refresh: () => ipcRenderer.invoke('maps:refresh'),
  home: () => ipcRenderer.invoke('maps:home'),
  onNavigationState: (callback) => {
    ipcRenderer.on('maps:navigation-state', (_event, state) => callback(state));
  },
  onStatus: (callback) => {
    ipcRenderer.on('maps:status', (_event, status) => callback(status));
  }
});
