import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
import { ensureSeed } from './db/seed';
import { requestPersistentStorage } from './db/db';
import { installSyncListeners } from './lib/sync';

async function boot() {
  await ensureSeed();
  void requestPersistentStorage();
  installSyncListeners();
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
}

boot().catch((e) => {
  document.getElementById('root')!.innerHTML = `<div style="padding:24px;color:#fff;font-family:sans-serif"><h2>Impossibile avviare l'app</h2><p>${String(e?.message ?? e)}</p><p>Il browser potrebbe bloccare l'archivio locale (es. navigazione privata).</p></div>`;
});
