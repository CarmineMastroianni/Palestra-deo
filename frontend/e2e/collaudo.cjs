// Collaudo end-to-end. Uso: npm run build && npx vite preview --port 4173 &  poi: node e2e/collaudo.cjs <cartella-screenshot>
const { chromium, devices } = require('playwright');
const SP = process.argv[2];
const URL = 'http://localhost:4173';
const results = [];
const ok = (name, cond, extra='') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name} ${extra}`); };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ ...devices['Pixel 7'], acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL);
  // Onboarding
  await page.getByPlaceholder('Nome').fill('Carmine');
  await page.getByRole('button', { name: 'Continua' }).click();
  await page.getByRole('button', { name: 'Inizia' }).click();
  await page.waitForSelector('text=Questa settimana');
  ok('home caricata', await page.locator('text=Ciao Carmine').count() > 0);
  ok('giorno riconosciuto (martedì=calcio)', await page.locator('h2:has-text("Allenamento calcio a 5")').count() > 0);
  await page.screenshot({ path: `${SP}/shots/01-home.png` });
  // SW installato
  await page.waitForFunction(() => navigator.serviceWorker.getRegistration().then((r) => !!r?.active), null, { timeout: 15000, polling: 500 }).catch((e) => console.log('swwait', e.message));
  const swActive = await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.active);
  ok('service worker attivo (installabile/offline)', swActive);
  const manifest = await page.evaluate(() => document.querySelector('link[rel=manifest]')?.getAttribute('href'));
  ok('manifest collegato', !!manifest, manifest);

  // Registra calcio
  await page.getByRole('button', { name: 'Segna come svolto' }).click();
  await page.getByRole('button', { name: 'Salva' }).click();
  await page.waitForSelector('text=Registrato');
  ok('attività calcio registrata', true);

  // Allenamento Scheda A
  await page.getByRole('link', { name: 'Allenamento' }).click();
  await page.getByRole('button', { name: 'Scheda A' }).first().click();
  await page.waitForSelector('text=Come hai dormito?');
  await page.screenshot({ path: `${SP}/shots/02-check.png`, fullPage: true });
  await page.getByRole('button', { name: 'INIZIA ALLENAMENTO' }).click();
  await page.waitForSelector('.plus-btn');
  ok('live: primo esercizio squat', await page.locator('.ex-name:has-text("Squat al multipower")').count() > 0);
  // imposta carico 40
  const loadInput = page.getByLabel('Carico della seduta (kg)');
  await loadInput.fill('40'); await loadInput.press('Enter');
  for (let i = 0; i < 8; i++) await page.locator('.plus-btn').click();
  await page.getByRole('button', { name: '−1' }).click();
  await page.locator('.plus-btn').click();
  await page.waitForFunction(() => document.querySelector('.big-counter .n')?.textContent?.replace(/\s/g,'').startsWith('8/8'), null, { timeout: 3000 }).catch(() => {});
  const counter = await page.locator('.big-counter .n').innerText();
  ok('contatore +1/-1', counter.replace(/\s/g,'').startsWith('8/8'), counter.replace(/\n/g,' '));
  await page.screenshot({ path: `${SP}/shots/03-live.png` });
  await page.getByRole('button', { name: 'COMPLETA SERIE' }).click();
  await page.waitForSelector('.rest-ring');
  await page.getByRole('button', { name: '2', exact: true }).click();
  const t1 = await page.locator('.rest-ring .t').innerText();
  await page.screenshot({ path: `${SP}/shots/04-rest.png` });
  // simula sospensione: ricarica dopo 3s
  await page.waitForTimeout(3000);
  await page.reload();
  await page.waitForSelector('.rest-ring');
  const t2 = await page.locator('.rest-ring .t').innerText();
  const toS = (t) => { const [m, s] = t.split(':').map(Number); return m * 60 + s; };
  ok('timer riprende con tempo assoluto dopo reload', toS(t1) - toS(t2) >= 3, `${t1} -> ${t2}`);
  // +30s e pausa
  await page.getByRole('button', { name: '+30 s' }).click();
  await page.getByRole('button', { name: 'Pausa' }).click();
  const p1 = await page.locator('.rest-ring .t').innerText(); await page.waitForTimeout(1500);
  const p2 = await page.locator('.rest-ring .t').innerText();
  ok('pausa del recupero', p1 === p2, p1);
  await page.getByRole('button', { name: 'Riprendi' }).click();
  // fine recupero: forza l'ora con timer breve via IndexedDB
  await page.evaluate(async () => {
    const req = indexedDB.open('my-fitness-futsal');
    await new Promise((r) => (req.onsuccess = r));
    const db = req.result;
    const tx = db.transaction('live', 'readwrite');
    const st = tx.objectStore('live');
    const g = st.get('live');
    await new Promise((r) => (g.onsuccess = r));
    const v = g.result; v.timer = { endsAt: Date.now() + 1000, totalMs: 120000 }; st.put(v);
    await new Promise((r) => (tx.oncomplete = r));
  });
  await page.waitForSelector('text=RECUPERO TERMINATO', { timeout: 8000 });
  ok('messaggio RECUPERO TERMINATO', true);
  await page.screenshot({ path: `${SP}/shots/05-rest-done.png` });
  await page.locator('.rest-done').click();
  ok('serie 2 di 3', await page.locator('text=Serie 2 di 3').count() > 0);
  ok('carico conservato tra le serie', (await page.locator('.big-counter').innerText()).includes('40 KG'));
  // termina
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Termina ora e salva' }).click();
  await page.getByPlaceholder('Sensazioni, tecnica, fastidi…').fill('Prima seduta di prova');
  await page.getByRole('button', { name: 'SALVA E TERMINA' }).click();
  await page.waitForSelector('text=Squat al multipower');
  const row = await page.locator('table.simple tbody tr').first().innerText();
  ok('serie registrata (8 rip, 40 kg, RIR 2)', /8\s+40\s+2/.test(row.replace(/\t/g,' ')), row.replace(/\s+/g,' '));
  await page.screenshot({ path: `${SP}/shots/06-session.png`, fullPage: true });

  // Misure
  await page.goto(URL + '/corpo');
  await page.getByRole('button', { name: '+ Misure' }).click();
  const inputs = page.locator('.modal input.input');
  await page.locator('.modal label:has-text("Peso") input').fill('86,4');
  await page.locator('.modal label:has-text("Girovita") input').fill('95');
  await page.getByRole('button', { name: 'Salva' }).click();
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForSelector('text=Misurazioni registrate');
  ok('misure persistono dopo reload', await page.locator('text=Peso 86.4').count() > 0);
  ok('grafico aggiornato', await page.locator('.recharts-line').count() > 0);
  await page.screenshot({ path: `${SP}/shots/07-body.png`, fullPage: true });

  // Dieta: PDF generato
  const pdfPage = await browser.newPage();
  await pdfPage.setContent(`<h1>Piano alimentare</h1><p>Colazione ore 7:30</p><p>- Yogurt greco 150 g</p><p>- Fiocchi d'avena 40 g oppure pane integrale 50 g</p><p>Spuntino</p><p>Frutta fresca 150 g</p><p>Pranzo</p><p>Riso basmati 80 g</p><p>Petto di pollo 150 g</p><p>Merenda</p><p>Mandorle 20 g</p><p>Cena</p><p>Salmone 150 g</p><p>Verdure a volontà</p>`);
  await pdfPage.pdf({ path: `${SP}/dieta-test.pdf` });
  await pdfPage.close();
  await page.goto(URL + '/alimentazione');
  await page.locator('input[type=file]').setInputFiles(`${SP}/dieta-test.pdf`);
  await page.waitForSelector('text=Yogurt greco', { timeout: 20000 }).catch(() => {});
  ok('PDF dieta caricato e letto', await page.locator('text=Yogurt greco').count() > 0);
  await page.getByRole('button', { name: 'Segna fatto' }).first().click();
  await page.waitForSelector('text=✓ Fatto', { timeout: 3000 }).catch(() => {});
  ok('pasto segnato', await page.locator('text=✓ Fatto').count() > 0);
  await page.screenshot({ path: `${SP}/shots/08-diet.png`, fullPage: true });
  await page.getByRole('button', { name: 'Originale' }).click();
  await page.waitForSelector('iframe.doc-frame', { timeout: 3000 }).catch(() => {});
  ok('originale consultabile', await page.locator('iframe.doc-frame').count() > 0);
  await page.keyboard.press('Escape');

  // Progressi + assistente
  await page.goto(URL + '/progressi');
  await page.waitForSelector('text=Progressione dei carichi');
  await page.screenshot({ path: `${SP}/shots/09-progress.png`, fullPage: true });
  const dl = page.waitForEvent('download', { timeout: 20000 });
  await page.getByRole('button', { name: 'Genera PDF' }).click();
  const d = await dl.catch(() => null);
  ok('report PDF generato', !!d, d ? d.suggestedFilename() : '');
  await page.goto(URL + '/assistente');
  await page.getByRole('button', { name: 'Quanti allenamenti ho completato?' }).click();
  await page.waitForSelector('.msg.assistant:not(.muted)', { timeout: 5000 });
  const ans = await page.locator('.msg.assistant').last().innerText();
  ok('assistente locale risponde dai dati', ans.includes('completati: 1'), ans.slice(0, 80));
  await page.getByRole('button', { name: "Quale peso ho usato l'ultima volta alla panca piana?" }).click();
  await page.waitForTimeout(500);
  ok('assistente non inventa', (await page.locator('.msg.assistant').last().innerText()).includes('Non ci sono ancora serie'));
  await page.screenshot({ path: `${SP}/shots/10-coach.png` });

  // 3D
  await page.goto(URL + '/esercizi/squat-multipower');
  await page.waitForSelector('canvas', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  ok('vista 3D renderizzata', await page.locator('canvas').count() > 0);
  await page.locator('.canvas3d').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SP}/shots/11-3d.png` });

  // Offline
  await ctx.setOffline(true);
  await page.goto(URL + '/corpo').catch(() => {});
  await page.waitForSelector('text=Misurazioni registrate', { timeout: 10000 }).catch(() => {});
  ok('funziona offline con dati disponibili', await page.locator('text=Peso 86.4').count() > 0);
  await ctx.setOffline(false);

  // Export
  await page.goto(URL + '/profilo/dati');
  const dl2 = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Esporta tutto in JSON (non cifrato)' }).click();
  const d2 = await dl2;
  const fs = require('fs'); const pth = await d2.path(); const j = JSON.parse(fs.readFileSync(pth, 'utf8'));
  ok('export JSON completo', j.tables.sets.length === 1 && j.tables.measurements.length === 1, `sets=${j.tables.sets.length}`);
  ok('nessun segreto nell\'export', j.tables.settings[0].ai.apiKey === '' && !j.tables.settings[0].security.pinHash);

  ok('nessun errore JS', errors.filter((e) => !/favicon|ERR_INTERNET_DISCONNECTED|Failed to fetch|net::/.test(e)).length === 0, errors.slice(0, 5).join(' | '));
  console.log(results.join('\n'));
  await browser.close();
})().catch((e) => { console.log(results.join('\n')); console.error('ERRORE', e); process.exit(1); });
