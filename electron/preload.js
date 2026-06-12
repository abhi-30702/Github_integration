const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Auth
  startOAuth:   ()       => ipcRenderer.invoke('oauth:start'),
  signOut:      ()       => ipcRenderer.invoke('oauth:signout'),
  getAuthState: ()       => ipcRenderer.invoke('auth:get-state'),

  // GitHub data
  fetchRepos:         () => ipcRenderer.invoke('github:fetch-repos'),
  fetchActivity:      () => ipcRenderer.invoke('github:fetch-activity'),
  fetchContributions: () => ipcRenderer.invoke('github:fetch-contributions'),

  // Repo creation
  createRepo: (opts)     => ipcRenderer.invoke('github:create-repo', opts),

  // File watcher
  pickWatchDir:  ()      => ipcRenderer.invoke('watcher:pick-dir'),
  getWatchDir:   ()      => ipcRenderer.invoke('watcher:get-dir'),
  skipFolder: (fp)       => ipcRenderer.invoke('watcher:skip-folder', fp),
  onFolderDetected: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('folder-detected', handler);
    return () => ipcRenderer.removeListener('folder-detected', handler);
  },
});
