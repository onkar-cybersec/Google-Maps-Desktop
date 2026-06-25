const { app, BrowserView, BrowserWindow, ipcMain, shell, session } = require('electron');
const path = require('path');

const HOME_URL = 'https://www.google.com/maps';
const TOOLBAR_HEIGHT = 42;
const TRUSTED_HOSTS = new Set([
  'www.google.com',
  'www.google.co.in',
  'google.com',
  'google.co.in',
  'maps.google.com',
  'accounts.google.com',
  'myaccount.google.com',
  'ogs.google.com',
  'support.google.com',
  'apis.google.com',
  'ssl.gstatic.com',
  'www.gstatic.com',
  'fonts.gstatic.com',
  'fonts.googleapis.com',
  'lh3.googleusercontent.com',
  'lh4.googleusercontent.com',
  'lh5.googleusercontent.com',
  'lh6.googleusercontent.com'
]);
const GEOLOCATION_HOSTS = new Set(['www.google.com', 'www.google.co.in', 'maps.google.com']);

let activeMapsView = null;

function isTrustedGoogleUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'https:' && TRUSTED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function isGoogleMapsGeolocationUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'https:' && GEOLOCATION_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function configurePermissions() {
  const mapsSession = session.defaultSession;
  console.log('[permissions] Google Maps BrowserView session: defaultSession');

  mapsSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    const origin = requestingOrigin || webContents.getURL();
    const allowed = permission === 'geolocation' && isGoogleMapsGeolocationUrl(origin);

    console.log(
      `[permissions] check permission=${permission} origin=${origin || 'unknown'} allowed=${allowed}`
    );

    return allowed;
  });

  mapsSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const origin = details.requestingUrl || webContents.getURL();
    const allowed = permission === 'geolocation' && isGoogleMapsGeolocationUrl(origin);

    console.log(
      `[permissions] request permission=${permission} origin=${origin || 'unknown'} allowed=${allowed}`
    );

    callback(allowed);
  });
}

function sendNavigationState(mainWindow, mapsView) {
  if (mainWindow.isDestroyed() || mapsView.webContents.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send('maps:navigation-state', {
    canGoBack: mapsView.webContents.canGoBack(),
    canGoForward: mapsView.webContents.canGoForward()
  });
}

function updateMapsBounds(mainWindow, mapsView) {
  if (mainWindow.isDestroyed() || mapsView.webContents.isDestroyed()) {
    return;
  }

  const [contentWidth, contentHeight] = mainWindow.getContentSize();
  mapsView.setBounds({
    x: 0,
    y: TOOLBAR_HEIGHT,
    width: contentWidth,
    height: Math.max(0, contentHeight - TOOLBAR_HEIGHT)
  });
  mapsView.setAutoResize({ width: true, height: true });
}

function createMapsView(mainWindow) {
  const mapsView = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setBrowserView(mapsView);
  activeMapsView = mapsView;
  updateMapsBounds(mainWindow, mapsView);

  mapsView.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedGoogleUrl(url)) {
      mapsView.webContents.loadURL(url);
    } else {
      shell.openExternal(url);
    }

    return { action: 'deny' };
  });

  mapsView.webContents.on('did-start-loading', () => {
    mainWindow.webContents.send('maps:status', 'Loading Maps');
  });

  mapsView.webContents.on('did-stop-loading', () => {
    mainWindow.webContents.send('maps:status', 'Ready');
    sendNavigationState(mainWindow, mapsView);
    mapsView.webContents.executeJavaScript("window.dispatchEvent(new Event('resize'));", true).catch(() => {});
  });

  mapsView.webContents.on('did-navigate', () => sendNavigationState(mainWindow, mapsView));
  mapsView.webContents.on('did-navigate-in-page', () => sendNavigationState(mainWindow, mapsView));

  mapsView.webContents.on('did-fail-load', (_event, errorCode) => {
    if (errorCode !== -3) {
      mainWindow.webContents.send('maps:status', 'Unable to load');
    }
  });

  mapsView.webContents.loadURL(HOME_URL);
  return mapsView;
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 620,
    title: 'Google Maps Desktop',
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    backgroundColor: '#f8fafc',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  let mapsView = null;

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedGoogleUrl(url)) {
      return { action: 'allow' };
    }

    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'), {
    query: { home: HOME_URL }
  });

  mainWindow.webContents.once('did-finish-load', () => {
    mapsView = createMapsView(mainWindow);
    sendNavigationState(mainWindow, mapsView);
  });

  mainWindow.on('resize', () => {
    if (mapsView) {
      updateMapsBounds(mainWindow, mapsView);
    }
  });

  mainWindow.on('maximize', () => {
    if (mapsView) {
      updateMapsBounds(mainWindow, mapsView);
    }
  });

  mainWindow.on('unmaximize', () => {
    if (mapsView) {
      updateMapsBounds(mainWindow, mapsView);
    }
  });

}

ipcMain.handle('maps:back', () => {
  if (activeMapsView?.webContents.canGoBack()) {
    activeMapsView.webContents.goBack();
  }
});

ipcMain.handle('maps:forward', () => {
  if (activeMapsView?.webContents.canGoForward()) {
    activeMapsView.webContents.goForward();
  }
});

ipcMain.handle('maps:refresh', () => {
  activeMapsView?.webContents.reload();
});

ipcMain.handle('maps:home', () => {
  activeMapsView?.webContents.loadURL(HOME_URL);
});

app.whenReady().then(() => {
  configurePermissions();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
