// Desktop wrapper: serves www/ on http://127.0.0.1:5173 (needed for OAuth redirects + YouTube embeds)
const { app, BrowserWindow, shell } = require('electron');
const http = require('http'), fs = require('fs'), path = require('path');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
http.createServer((req, res) => {
  const f = path.join(__dirname, 'www', req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!f.startsWith(path.join(__dirname, 'www'))) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'text/plain' }); res.end(d); });
}).listen(5173, '127.0.0.1');
app.whenReady().then(() => {
  const w = new BrowserWindow({ width: 1100, height: 750, autoHideMenuBar: true });
  w.loadURL('http://127.0.0.1:5173/');
  w.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
});
app.on('window-all-closed', () => app.quit());
