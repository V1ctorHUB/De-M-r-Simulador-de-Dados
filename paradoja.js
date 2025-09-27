// =====================
// paradoja.js (completo)
// =====================

// Utilidades
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const pick = (n) => Math.floor(Math.random() * n);

// Probabilidades teóricas
const THEORETICAL = {
    one_die: 1 - Math.pow(5 / 6, 4),
    two_dice: 1 - Math.pow(35 / 36, 24)
};

// ----- DOM -----
const landing = document.getElementById('landing');
const btnStart = document.getElementById('btnStart');
const modeCards = document.querySelectorAll('.mode-card');
const btnHiddenSettings = document.getElementById('btnHiddenSettings');

const appWrap = document.querySelector('.wrap');
const diceZone = document.getElementById('diceZone');
const rollsOut = document.getElementById('rollsOut');
const kpis = document.getElementById('kpis');
const btnRun = document.getElementById('btnRun');
const btnBack = document.getElementById('btnBack');
const statusEl = document.getElementById('status');

// Ajustes
const settings = document.getElementById('settings');
const btnSettingsBack = document.getElementById('btnSettingsBack');
const btnCsv = document.getElementById('btnCsv');
const btnClear = document.getElementById('btnClear');
const settingsInfo = document.getElementById('settingsInfo');

// Estado
let selectedMode = 'one_die'; // 'one_die' | 'two_dice'

// setStatus tolerante
function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || '';
}

// ----- Persistencia local -----
const STORAGE_KEY = 'demere_runs_v1';
const runs = []; // {trial_id, game, timestamp, n_lanzamientos, exitos, ocurrio, detalles_json}

function loadRuns() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const arr = JSON.parse(saved);
            if (Array.isArray(arr)) runs.push(...arr);
            setStatus(`Histórico cargado: ${runs.length} corridas.`);
        }
    } catch (e) {
        console.warn('No se pudo cargar histórico:', e);
        setStatus('⚠️ Persistencia local deshabilitada.');
    }
}

function saveRuns() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(runs)); }
    catch (e) {
        console.warn('No se pudo guardar histórico:', e);
        setStatus('⚠️ No se pudo guardar en localStorage.');
    }
}

function appendRun(result) {
    const trial_id = runs.length + 1;
    const detalles_json = JSON.stringify(result.tiradas);
    runs.push({
        trial_id,
        game: result.game,
        timestamp: new Date().toISOString(),
        n_lanzamientos: result.n_lanzamientos,
        exitos: result.exitos,
        ocurrio: Number(result.ocurrio),
        detalles_json
    });
    saveRuns();
}

// ----- CSV -----
function toCSV(rows) {
    const header = ['trial_id', 'game', 'timestamp', 'n_lanzamientos', 'exitos', 'ocurrio', 'detalles_json'];
    const body = rows.map(r => [
        r.trial_id, r.game, r.timestamp, r.n_lanzamientos, r.exitos, r.ocurrio,
        '"' + String(r.detalles_json).replaceAll('"', '""') + '"'
    ].join(','));
    return [header.join(','), ...body].join('\n');
}
function downloadCSV(filename, csvText) {
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ----- Simulaciones -----
function simularJuegoUno() {
    const lanzamientos = 4, tiradas = []; let exitos = 0;
    for (let i = 0; i < lanzamientos; i++) {
        const v = 1 + pick(6);
        tiradas.push({ roll: i + 1, value: v });
        if (v === 6) exitos++;
    }
    return { game: 'one_die', n_lanzamientos: lanzamientos, tiradas, exitos, ocurrio: (exitos > 0) };
}

function simularJuegoDos() {
    const lanzamientos = 24, tiradas = []; let exitos = 0;
    for (let i = 0; i < lanzamientos; i++) {
        const d1 = 1 + pick(6), d2 = 1 + pick(6);
        tiradas.push({ roll: i + 1, d1, d2 });
        if (d1 === 6 && d2 === 6) exitos++;
    }
    return { game: 'two_dice', n_lanzamientos: lanzamientos, tiradas, exitos, ocurrio: (exitos > 0) };
}

// ----- Dados (DOM) -----
function makeDie() {
    const die = document.createElement('div'); die.className = 'die';
    const p = document.createElement('div'); p.className = 'pips';
    const cells = []; for (let i = 0; i < 9; i++) { const dot = document.createElement('div'); dot.className = 'pip'; p.appendChild(dot); cells.push(dot); }
    die.appendChild(p); return { el: die, cells };
}
const FACE_MAP = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
function renderFace(die, value) { die.cells.forEach((c, idx) => c.classList.toggle('on', FACE_MAP[value].includes(idx))); }

async function animateToValue(die, finalValue, duration = 520) {
    die.el.classList.add('anim'); const frames = 4 + pick(3); const start = performance.now();
    for (let i = 0; i < frames; i++) {
        renderFace(die, 1 + pick(6));
        const t = performance.now() - start; const left = Math.max(0, duration - t);
        await sleep(Math.max(60, left / (frames - i + 0.5)));
    }
    renderFace(die, finalValue); await sleep(60); die.el.classList.remove('anim');
}

// ----- UI de juego -----
function renderKPIs(result) {
    const teor = THEORETICAL[result.game];
    const etiqueta = result.ocurrio ? `<span class="tag ok">¡Ocurrió al menos uno!</span>` : `<span class="tag bad">No ocurrió</span>`;
    kpis.innerHTML = `
    <div class="kpi">Teórica<b>${teor.toFixed(4)}</b></div>
    <div class="kpi">Éxitos<b>${result.exitos}</b></div>
    <div class="kpi">Estado<b>${etiqueta}</b></div>
    <div class="kpi">Lanzamientos<b>${result.n_lanzamientos}</b></div>
  `;
}
function printRollsText(result) {
    const lines = (result.game === 'one_die')
        ? result.tiradas.map(t => `#${t.roll}: ${t.value}`)
        : result.tiradas.map(t => `#${t.roll}: (${t.d1}, ${t.d2})`);
    rollsOut.textContent = lines.join('\n');
}

async function runOnce() {
    btnRun.disabled = true; setStatus('Rodando dados…');
    rollsOut.textContent = ''; kpis.innerHTML = ''; diceZone.innerHTML = '';

    const mode = selectedMode;
    const result = (mode === 'one_die') ? simularJuegoUno() : simularJuegoDos();

    if (mode === 'one_die') {
        for (const t of result.tiradas) {
            const cell = document.createElement('div');
            const die = makeDie();
            const label = document.createElement('div');
            label.style.marginTop = '6px'; label.style.textAlign = 'center'; label.style.color = 'var(--muted)'; label.style.fontSize = '12px';
            label.textContent = `Tirada ${t.roll}`;
            cell.appendChild(die.el); cell.appendChild(label); diceZone.appendChild(cell);
            await animateToValue(die, t.value);
        }
    } else {
        for (const t of result.tiradas) {
            const cell = document.createElement('div');
            const pair = document.createElement('div'); pair.style.display = 'grid'; pair.style.gap = '10px';
            const d1 = makeDie(), d2 = makeDie(); pair.appendChild(d1.el); pair.appendChild(d2.el);
            const label = document.createElement('div');
            label.style.marginTop = '6px'; label.style.textAlign = 'center'; label.style.color = 'var(--muted)'; label.style.fontSize = '12px';
            label.textContent = `Tirada ${t.roll}`;
            cell.appendChild(pair); cell.appendChild(label); diceZone.appendChild(cell);
            await Promise.all([animateToValue(d1, t.d1), animateToValue(d2, t.d2)]);
        }
    }

    renderKPIs(result);
    printRollsText(result);
    appendRun(result);
    setStatus(`Listo. Corridas guardadas: ${runs.length}`);
    btnRun.disabled = false;
}

// ----- Navegación entre pantallas -----
function showLanding() {
    landing.classList.remove('hide');
    appWrap.classList.add('hidden');
    appWrap.classList.remove('show');
    settings.classList.add('hide');
}
function showApp() {
    landing.classList.add('hide');
    appWrap.classList.remove('hidden');
    appWrap.classList.add('show');
    settings.classList.add('hide');
}
function showSettings() {
    settings.classList.remove('hide');
    // Info de ayuda
    if (settingsInfo) settingsInfo.textContent = `Corridas guardadas: ${runs.length}`;
}

// Selección de tarjetas de modo
modeCards.forEach(card => {
    card.addEventListener('click', () => {
        modeCards.forEach(c => c.setAttribute('aria-pressed', 'false'));
        card.setAttribute('aria-pressed', 'true');
        selectedMode = card.dataset.mode; // "one_die" | "two_dice"
    });
});

// Listeners de navegación y acciones
btnStart?.addEventListener('click', showApp);
btnBack?.addEventListener('click', showLanding);
btnHiddenSettings?.addEventListener('click', showSettings);
btnSettingsBack?.addEventListener('click', showLanding);

btnRun?.addEventListener('click', () => runOnce());

btnCsv?.addEventListener('click', () => {
    if (!runs.length) { setStatus('No hay corridas guardadas. Ejecuta una simulación.'); return; }
    const csv = toCSV(runs);
    downloadCSV('demere_results.csv', csv);
    setStatus('CSV exportado.');
    if (settingsInfo) settingsInfo.textContent = `Corridas guardadas: ${runs.length}`;
});

btnClear?.addEventListener('click', () => {
    runs.length = 0;
    saveRuns();
    localStorage.removeItem(STORAGE_KEY);
    setStatus('Histórico borrado.');
    if (settingsInfo) settingsInfo.textContent = `Corridas guardadas: ${runs.length}`;
});

// Inicializar: mostrar landing, ocultar app, cargar histórico
appWrap.classList.add('hidden');
loadRuns();
