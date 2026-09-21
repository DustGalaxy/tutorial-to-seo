/**
 * SEO Shodynky Maximus - Game Engine
 * Map coordinates, responsive layout, road generator, audio, quest flow.
 */
(() => {
            'use strict';
            const initialMap = document.getElementById('world').innerHTML;
            const initialMapStyle = document.getElementById('world').getAttribute('style') || '';
            try {
                if (typeof document.getElementById('mission').showModal !== 'function') throw new Error('Dialog API unavailable');
                const KEY = 'maximus-seo-school-v1';
                const $ = id => document.getElementById(id);
                const mascotSource = document.querySelector('.mascotstage img').getAttribute('src');
                const mobileQuery = matchMedia('(max-width: 790px), (max-width: 1024px) and (pointer: coarse)');
                const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
                const allIds = new Set(MISSIONS.map(m => m.id));
                function fresh() { return { version: 1, courseRevision: COURSE_REVISION, completed: {}, run: null, sound: false } }
                function clean(raw) {
                    const out = fresh(); if (!raw || raw.version !== 1) return out;
                    if (raw.completed && typeof raw.completed === 'object') for (const [id, v] of Object.entries(raw.completed)) { if (allIds.has(id) && Number.isInteger(v) && v >= 1 && v <= 3) out.completed[id] = v }
                    // A corrupted or old checkpoint cannot unlock a later island on its own.
                    for (const m of MISSIONS) if (m.requires.some(id => !out.completed[id])) delete out.completed[m.id];
                    out.sound = raw.sound === true;
                    const r = raw.run, m = r && MISSIONS.find(x => x.id === r.id);
                    if (raw.courseRevision === COURSE_REVISION && m && m.requires.every(id => out.completed[id]) && Number.isInteger(r.step) && r.step >= 0 && r.step <= m.steps.length) { out.run = { id: m.id, step: r.step, misses: Math.max(0, Math.min(999, Number(r.misses) || 0)), hints: Math.max(0, Math.min(999, Number(r.hints) || 0)), hinted: Array.isArray(r.hinted) ? r.hinted.filter(x => Number.isInteger(x) && x >= 0 && x < m.steps.length) : [], grumbled: Array.isArray(r.grumbled) ? r.grumbled.filter(x => Number.isInteger(x) && x >= 0 && x < m.steps.length) : [], firstTry: r.firstTry === true } }
                    return out;
                }
                let storageOK = true, readWarning = false, state;
                try { const value = localStorage.getItem(KEY); state = value ? clean(JSON.parse(value)) : fresh() } catch { state = fresh(); storageOK = false; readWarning = true }
                let assembled = [], selected = null, matchValues = [], numericValue = '', checked = false, correctNow = false, showHint = false, toastTimer = null, audio = null, lastMission = null, returnToNode = null;
                let lockedPageY = null, layoutSignature = '', layoutFrame = null;
                const unlocked = (m, s = state) => m.requires.every(id => Boolean(s.completed[id]));
                const nextMission = (s = state) => MISSIONS.find(m => !s.completed[m.id] && unlocked(m, s));
                const starsFor = run => run.misses === 0 && run.hints === 0 ? 3 : run.misses <= 2 ? 2 : 1;
                function isCorrect(step, value) {
                    if (step.type === 'choice') return value === step.correct;
                    if (step.type === 'number') { const str = String(value).trim().replace(',', '.'); return str !== '' && Number.isFinite(Number(str)) && Math.abs(Number(str) - step.answer) < .000001 }
                    if (step.type === 'assemble') return Array.isArray(value) && value.length === step.answer.length && step.answer.every((id, i) => value[i] === id);
                    if (step.type === 'match') return Array.isArray(value) && value.length === step.pairs.length && step.pairs.every((p, i) => value[i] === p.answer);
                    return false;
                }
                function mapGeometry(width, mobile, unit = 16) {
                    const w = Math.max(240, width), positions = {};
                    if (!mobile) { const height = w * 2 / 3; MISSIONS.forEach(m => positions[m.id] = { x: m.x / 100 * w, y: m.y / 100 * height }); return { width: w, height, positions, mobile: false } }
                    const common = MISSIONS.filter(m => m.id.startsWith('m'));
                    const scale = Math.max(1, unit / 16), gap = 120 * scale, start = 110 * scale, last = start + (common.length - 1) * gap;
                    MISSIONS.forEach(m => {
                        if (m.id.startsWith('m')) { const n = common.indexOf(m); positions[m.id] = { x: w * (n % 2 ? .74 : .26), y: start + n * gap } }
                        else { const n = Number(m.id.slice(1)) - 1; positions[m.id] = { x: w * (m.id.startsWith('c') ? .26 : .74), y: last + 250 * scale + n * 170 * scale } }
                    });
                    return { width: w, height: last + 730 * scale, positions, mobile: true, headingY: last + 150 * scale, fork: { x: w / 2, y: last + 95 * scale }, labelWidth: Math.min(150, w * .43) };
                }
                // Pure learning and layout rules can be checked without running a browser.
                globalThis.MaximusRules = { clean, unlocked, nextMission, starsFor, isCorrect, mapGeometry };
                function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); storageOK = true } catch { storageOK = false } updateStorageLabel() }
                function updateStorageLabel() { const e = $('savestatus'); if (e) e.textContent = storageOK ? 'Прогресс сохранён на этом компьютере' : 'Браузер не сохраняет прогресс — он доступен до закрытия игры' }
                function toast(text) { clearTimeout(toastTimer); $('toast').textContent = text; $('toast').hidden = false; toastTimer = setTimeout(() => $('toast').hidden = true, 4500) }
                function tune(kind) { if (!state.sound) return; try { if (!audio) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; audio = new AC() } if (audio.state === 'suspended') audio.resume().catch(() => { }); const notes = kind === 'win' ? [523, 659, 784, 1047] : kind === 'right' ? [523, 784] : kind === 'wrong' ? [260, 220] : [440]; notes.forEach((f, i) => { const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + i * .105; o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(.035, t); g.gain.exponentialRampToValueAtTime(.001, t + .14); o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + .15) }) } catch { } }
                function syncSound() { $('soundbtn').textContent = '♪ Звук: ' + (state.sound ? 'вкл.' : 'выкл.'); $('soundbtn').setAttribute('aria-pressed', String(state.sound)) }
                function mapRender() {
                    const total = Object.keys(state.completed).length, next = nextMission();
                    $('count').textContent = total + ' / ' + MISSIONS.length; $('stars').textContent = '★ ' + Object.values(state.completed).reduce((a, b) => a + b, 0);
                    $('progress').style.width = (total / MISSIONS.length * 100) + '%'; document.querySelector('.meter').setAttribute('aria-valuenow', String(total));
                    $('nodes').innerHTML = MISSIONS.map(m => { const done = Boolean(state.completed[m.id]), available = unlocked(m), current = next && next.id === m.id; return '<button class="mapnode ' + (done ? 'done' : available ? '' : 'locked') + ' ' + (current ? 'current' : '') + '" style="--x:' + m.x + ';--y:' + m.y + '" data-node="' + m.id + '" aria-disabled="' + (!available) + '" aria-label="' + esc(m.n + '. ' + m.name + '. ' + (done ? 'Пройдено, ' + state.completed[m.id] + ' из 3 звёзд' : available ? 'Доступно' : 'Сначала пройди предыдущее задание')) + '"><span class="num">' + (done ? '✓' : esc(m.n)) + '</span><span class="nodelabel">' + esc(m.label) + '</span></button>' }).join('');
                    $('nodes').querySelectorAll('[data-node]').forEach(b => b.addEventListener('click', () => startMission(b.dataset.node)));
                    const resume = state.run && MISSIONS.find(m => m.id === state.run.id && state.run.step < m.steps.length);
                    if (total === MISSIONS.length) { $('guidecopy').innerHTML = '<p><strong>Всё прошёл. Надо же.</strong></p><p>Обе специализации закрыты. Я бы похвалил, но у меня на это мало оперативной памяти. Можешь повторить любую остановку.</p>'; $('continuebtn').textContent = 'Повторить первое задание' }
                    else if (resume) { $('guidecopy').innerHTML = '<p><strong>Вернулся. Сохранение на месте.</strong></p><p>' + esc(resume.name) + '. Этап ' + (state.run.step + 1) + ' из ' + resume.steps.length + '. Хоть кто-то здесь помнит, на чём мы остановились.</p>'; $('continuebtn').textContent = 'Продолжить задание' }
                    else if (state.completed.m12 && !state.completed.c1 && !state.completed.i1) { $('guidecopy').innerHTML = '<p><strong>До развилки дошли.</strong></p><p>Выбирай К1 или И1: классические проекты или iGaming. Вторая ветка никуда не денется. В отличие от моего терпения.</p>'; $('continuebtn').textContent = 'Классические проекты →' }
                    else { $('guidecopy').innerHTML = total ? '<p><strong>Ладно, двигаемся дальше.</strong></p><p>Следующая остановка: ' + esc(next.name) + '. Нажми на золотую точку или кнопку ниже.</p>' : '<p><strong>Максимус. Будем знакомы.</strong></p><p>Токсично-прямолинейный, но по-доброму. Ворчу на поспешные выводы, потом помогаю с ними разобраться. Начинай с первой точки. Я пока погудю.</p>'; $('continuebtn').textContent = total ? 'Следующая остановка →' : 'Ладно, начнём' }
                    syncSound(); updateStorageLabel(); layoutMap(true);
                }
                function roadRender(g) {
                    const point = id => g.positions[id], xy = p => p.x + ',' + p.y;
                    const common = MISSIONS.filter(m => m.id.startsWith('m')).map(m => point(m.id));
                    const curve = points => points.reduce((d, p, i) => { if (!i) return 'M ' + xy(p); const a = points[i - 1], mid = (a.y + p.y) / 2; return d + ' C ' + a.x + ',' + mid + ' ' + p.x + ',' + mid + ' ' + xy(p) }, '');
                    let routes;
                    if (g.mobile) { routes = [curve([...common, g.fork]), curve([g.fork, ...['c1', 'c2', 'c3'].map(point)]), curve([g.fork, ...['i1', 'i2', 'i3'].map(point)])] }
                    else { const w = g.width, h = g.height; routes = ['M ' + common.map(xy).join(' L '), 'M ' + [point('m12'), ...['c1', 'c2', 'c3'].map(point)].map(xy).join(' L '), 'M ' + xy(point('m12')) + ' Q ' + w * .945 + ',' + h * .573 + ' ' + w * .945 + ',' + h * .66 + ' L ' + w * .945 + ',' + h * .85 + ' Q ' + w * .945 + ',' + h * .89 + ' ' + xy(point('i1')) + ' L ' + ['i2', 'i3'].map(point).map(xy).join(' L ')] }
                    document.querySelector('.roads').setAttribute('viewBox', '0 0 ' + g.width + ' ' + g.height);
                    $('roadpaths').innerHTML = routes.map(d => '<path class="roadbed" d="' + d + '"/><path class="road" d="' + d + '"/><path class="roadline" d="' + d + '"/>').join('');
                }
                function layoutMap(force = false) {
                    const width = $('world').clientWidth || $('mapviewport').clientWidth || 900, unit = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
                    const signature = width + ':' + mobileQuery.matches + ':' + unit; if (!force && signature === layoutSignature) return; layoutSignature = signature;
                    const g = mapGeometry(width, mobileQuery.matches, unit);
                    $('world').style.height = g.height + 'px';
                    if (g.mobile) $('world').style.setProperty('--node-label-width', g.labelWidth + 'px'); else $('world').style.removeProperty('--node-label-width');
                    $('nodes').querySelectorAll('[data-node]').forEach(b => { const p = g.positions[b.dataset.node]; b.style.left = p.x + 'px'; b.style.top = p.y + 'px' });
                    for (const name of ['classic', 'igaming']) { const el = document.querySelector('.region.' + name); if (g.mobile) el.style.top = g.headingY + 'px'; else el.style.removeProperty('top') }
                    const caption = document.querySelector('.maptoolbar span'); caption.textContent = g.mobile ? 'Листай карту вниз. Золотые точки открыты.' : 'Нажми на точку, чтобы открыть задание';
                    roadRender(g);
                }
                function focusNode(target) {
                    const b = $('nodes').querySelector('[data-node="' + target + '"]'); if (!b) return;
                    const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
                    if (mobileQuery.matches) { const rect = b.getBoundingClientRect(); window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - window.innerHeight * .36), behavior }) }
                    else { const v = $('mapviewport'); v.scrollTo({ left: Math.max(0, b.offsetLeft - v.clientWidth / 2), top: Math.max(0, b.offsetTop - v.clientHeight / 2), behavior }); b.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior }) }
                    b.focus({ preventScroll: true });
                }
                function focusCurrent() { focusNode(state.run ? state.run.id : nextMission()?.id || 'm1') }
                function updateViewportMetrics() {
                    const v = window.visualViewport;
                    document.documentElement.style.setProperty('--visual-height', Math.round(v ? v.height : window.innerHeight) + 'px');
                    document.documentElement.style.setProperty('--visual-top', Math.round(v ? v.offsetTop : 0) + 'px');
                }
                function syncPageLock() {
                    if (document.querySelector('dialog[open]')) {
                        if (lockedPageY === null) { lockedPageY = window.scrollY; document.body.style.position = 'fixed'; document.body.style.top = -lockedPageY + 'px'; document.body.style.width = '100%' }
                    } else if (lockedPageY !== null) { const y = lockedPageY; lockedPageY = null; document.body.style.removeProperty('position'); document.body.style.removeProperty('top'); document.body.style.removeProperty('width'); window.scrollTo({ top: y, behavior: 'instant' }) }
                }
                function openDialog(id) { updateViewportMetrics(); if (!$(id).open) $(id).showModal(); syncPageLock() }
                function scrollMissionTop() { $('mission').scrollTop = 0; $('missioncontent').scrollTop = 0 }
                function syncActionDock() {
                    const dock = $('missiondock'); if (!dock) return;
                    if (mobileQuery.matches) {
                        const actions = $('missioncontent').querySelector('.actions,.endchoices');
                        if (actions) { const anchor = document.createElement('span'); anchor.id = 'actionanchor'; anchor.hidden = true; actions.before(anchor); dock.replaceChildren(actions) }
                    } else {
                        const actions = dock.firstElementChild, anchor = $('actionanchor'); if (actions && anchor) { anchor.replaceWith(actions) }
                    }
                }
                function prepareTables() {
                    $('missioncontent').querySelectorAll('.brief table').forEach(table => {
                        const rows = Array.from(table.querySelectorAll('tr')), headers = rows[0] ? Array.from(rows[0].querySelectorAll('th')) : [];
                        if (!headers.length) return; rows[0].classList.add('tableheader'); headers.forEach(th => th.setAttribute('scope', 'col'));
                        rows.slice(1).forEach(row => row.querySelectorAll('td').forEach((td, i) => td.dataset.label = headers[i]?.textContent || ''));
                    });
                }
                function onViewportChange() {
                    updateViewportMetrics(); syncActionDock(); cancelAnimationFrame(layoutFrame); layoutFrame = requestAnimationFrame(() => layoutMap());
                }
                function clearAnswer() { assembled = []; selected = null; matchValues = []; numericValue = ''; checked = false; correctNow = false; showHint = false }
                function startMission(id) {
                    const m = MISSIONS.find(x => x.id === id); if (!m) return;
                    if (!unlocked(m)) { const prerequisite = MISSIONS.find(x => x.id === m.requires.find(r => !state.completed[r])); toast('Максимус: сначала пройди «' + prerequisite.name + '».'); tune('wrong'); return }
                    if (!state.run || state.run.id !== id || state.run.step >= m.steps.length) state.run = { id, step: 0, misses: 0, hints: 0, hinted: [], grumbled: [], firstTry: !state.completed[id] };
                    lastMission = id; returnToNode = null; clearAnswer(); save(); renderMission(); openDialog('mission'); scrollMissionTop(); tune('open');
                }
                function assembledTitle(step, ids) {
                    return ids.map((id, i) => (i === 0 ? '' : i === 1 ? ' — ' : ' | ') + step.pieces.find(p => p.id === id).text).join('');
                }
                function renderAssembler(step) {
                    $('titlepreview').textContent = assembled.length ? assembledTitle(step, assembled) : 'Здесь появится твой Title';
                    $('assemblycount').textContent = assembled.length + ' / ' + step.answer.length + ' блоков';
                    $('chosenpieces').innerHTML = assembled.map((id, i) => '<button type="button" class="titlechip selectedchip" data-remove="' + id + '" aria-label="Убрать блок ' + esc(step.pieces.find(p => p.id === id).text) + '">' + (i + 1) + '. ' + esc(step.pieces.find(p => p.id === id).text) + ' ×</button>').join('');
                    $('chosenpieces').querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => { if (checked) return; const id = b.dataset.remove; assembled = assembled.filter(x => x !== id); renderAssembler(step); $('missioncontent').querySelector('[data-piece="' + id + '"]').focus() }));
                    $('missioncontent').querySelectorAll('[data-piece]').forEach(b => { b.disabled = checked || assembled.includes(b.dataset.piece) || assembled.length >= step.answer.length; b.setAttribute('aria-pressed', String(assembled.includes(b.dataset.piece))) });
                    $('clearassembly').disabled = checked || !assembled.length;
                    $('checkbutton').disabled = assembled.length !== step.answer.length;
                }
                function sourceMarkup(m) { return '<div class="source">' + (m.case ? 'Все организации, цифры и результаты этого кейса вымышлены. ' : '') + 'Материалы для объяснений: ' + m.source.map(k => '<a href="' + SOURCES[k].url + '" target="_blank" rel="noopener noreferrer">' + esc(SOURCES[k].name) + '</a>').join(' · ') + '<br>Материалы проверены: 07.09.2026.</div>' }
                function missionShell(m, body) {
                    $('missionwindowtitle').textContent = 'Остановка ' + m.n + ' — ' + m.name;
                    $('missiondock').replaceChildren();
                    $('missioncontent').innerHTML = '<div class="missionmeta"><span class="missiontag">' + esc(m.group) + '</span><span id="stagecaption">Этап ' + Math.min(state.run.step + 1, m.steps.length) + ' / ' + m.steps.length + '</span><div class="stepdots" aria-hidden="true">' + m.steps.map((_, i) => '<span class="stepdot ' + (i < state.run.step ? 'filled' : i === state.run.step ? 'active' : '') + '"></span>').join('') + '</div><div class="missionlayout"><aside class="missionaside"><img class="dialogmascot" src="' + esc(mascotSource) + '" alt="Максимус"><div class="curator"><b>Максимус</b>' + esc(m.intro) + '</div></aside><section class="sheet">' + body + '</section></div>';
                    prepareTables(); syncActionDock();
                }
                function renderMission() {
                    const r = state.run; if (!r) return; const m = MISSIONS.find(x => x.id === r.id); if (r.step >= m.steps.length) { renderResult(m); return }
                    const s = m.steps[r.step]; showHint = r.hinted.includes(r.step);
                    let inputs = '';
                    if (s.type === 'choice') {
                        const order = s.options.map((_, i) => i); for (let j = order.length - 1; j > 0; j--) { const k = Math.floor(Math.random() * (j + 1));[order[j], order[k]] = [order[k], order[j]] }
                        inputs = '<div class="answerlist" role="group" aria-label="Варианты ответа">' + order.map((original, i) => '<button class="answer" data-answer="' + original + '" aria-pressed="false"><span class="letter">' + String.fromCharCode(65 + i) + '</span><span>' + esc(s.options[original]) + '</span></button>').join('') + '</div>';
                    }
                    if (s.type === 'assemble') {
                        const groups = [...new Set(s.pieces.map(p => p.group))];
                        inputs = '<div class="titlebuilder"><div class="titlepreview" id="titlepreview" aria-live="polite">Здесь появится твой Title</div><div class="assemblymeta"><span id="assemblycount">0 / ' + s.answer.length + ' блоков</span><button type="button" class="winbtn" id="clearassembly" disabled>Очистить</button></div><div id="chosenpieces" class="chiprow" aria-label="Выбранные блоки"></div>' + groups.map(group => '<fieldset class="piecegroup"><legend>' + esc(group) + '</legend><div class="chiprow">' + s.pieces.filter(p => p.group === group).map(p => '<button type="button" class="titlechip" data-piece="' + p.id + '" aria-pressed="false">' + esc(p.text) + '</button>').join('') + '</div></fieldset>').join('') + '</div>';
                    }
                    if (s.type === 'number') inputs = '<label for="numberanswer" class="sr">Ответ в процентах</label><input id="numberanswer" class="numberinput" type="text" inputmode="decimal" autocomplete="off" maxlength="16" placeholder="?"> <span>' + esc(s.unit) + '</span>';
                    if (s.type === 'match') inputs = '<div class="matches">' + s.pairs.map((p, i) => '<div class="matchrow" id="matchrow' + i + '"><label for="match' + i + '">' + esc(p.text) + '</label><select id="match' + i + '" data-match="' + i + '"><option value="">Выбери страницу…</option>' + s.choices.map((c, j) => '<option value="' + j + '">' + esc(c) + '</option>').join('') + '</select></div>').join('') + '</div>';
                    missionShell(m, '<h2 id="questionheading">' + esc(s.title) + '</h2><div class="story">' + s.story + '</div>' + (s.evidence ? '<div class="brief"><div class="brieftitle">' + esc(s.evidence.title) + '</div><div class="briefbody">' + s.evidence.body + '</div></div>' : '') + '<p class="questiontitle">' + esc(s.prompt) + '</p>' + inputs + '<div id="feedback" aria-live="polite"></div><div class="actions"><button class="winbtn" id="hintbutton" aria-controls="hintbox" aria-expanded="' + showHint + '">? Подсказка Максимуса</button><button class="primary" id="checkbutton" disabled>Проверить</button></div><div class="hint" id="hintbox" role="status" aria-live="polite" ' + (showHint ? '' : 'hidden') + '>' + esc(s.hint) + '</div>' + sourceMarkup(m));
                    if (s.type === 'choice') $('missioncontent').querySelectorAll('[data-answer]').forEach(b => b.addEventListener('click', () => { if (checked) return; selected = Number(b.dataset.answer); $('missioncontent').querySelectorAll('[data-answer]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); $('checkbutton').disabled = false }));
                    if (s.type === 'assemble') {
                        $('missioncontent').querySelectorAll('[data-piece]').forEach(b => b.addEventListener('click', () => { if (checked || assembled.includes(b.dataset.piece) || assembled.length >= s.answer.length) return; assembled.push(b.dataset.piece); renderAssembler(s); $('chosenpieces').querySelector('[data-remove="' + b.dataset.piece + '"]').focus() }));
                        $('clearassembly').addEventListener('click', () => { if (checked) return; assembled = []; renderAssembler(s); $('missioncontent').querySelector('[data-piece]').focus() });
                        renderAssembler(s);
                    }
                    if (s.type === 'number') {
                        $('numberanswer').addEventListener('input', e => { numericValue = e.target.value; $('checkbutton').disabled = !numericValue.trim() });
                        $('numberanswer').addEventListener('keydown', e => { if (e.key === 'Enter' && !$('checkbutton').disabled) { e.preventDefault(); $('numberanswer').blur(); checkAnswer() } });
                    }
                    if (s.type === 'match') $('missioncontent').querySelectorAll('[data-match]').forEach(el => el.addEventListener('change', () => { matchValues = Array.from($('missioncontent').querySelectorAll('[data-match]')).map(e => e.value === '' ? null : Number(e.value)); $('checkbutton').disabled = matchValues.some(v => v === null) }));
                    const hintButton = $('hintbutton'), hintBox = $('hintbox');
                    if (showHint) hintButton.textContent = 'Скрыть подсказку';
                    else if (s.hintGrumble && r.grumbled.includes(r.step) && !r.hinted.includes(r.step)) hintButton.textContent = 'Ладно, подскажи';
                    hintButton.addEventListener('click', () => {
                        if (s.hintGrumble && !r.hinted.includes(r.step) && !r.grumbled.includes(r.step)) {
                            r.grumbled.push(r.step); save();
                            hintBox.innerHTML = '<p class="maximus-grumble">' + esc(s.hintGrumble) + '</p><p class="hint-followup">Нажми «Ладно, подскажи» — получишь подсказку. Ворчание бесплатное.</p>';
                            hintBox.hidden = false; hintButton.textContent = 'Ладно, подскажи'; hintButton.setAttribute('aria-expanded', 'true');
                        } else {
                            showHint = !showHint; hintBox.textContent = s.hint; hintBox.hidden = !showHint;
                            hintButton.textContent = showHint ? 'Скрыть подсказку' : '? Подсказка Максимуса'; hintButton.setAttribute('aria-expanded', String(showHint));
                            if (showHint && !r.hinted.includes(r.step)) { r.hinted.push(r.step); r.hints++; save() }
                        }
                        if (!hintBox.hidden) hintBox.scrollIntoView({ block: 'nearest', behavior: 'auto' });
                    });
                    $('checkbutton').addEventListener('click', checkAnswer);
                    scrollMissionTop();
                }
                function feedbackVoice(right, m, step) {
                    const lines = right ? ['Верно. Ладно, это было неплохо.', 'Верно. Даже возразить нечего. Непривычно.', 'Верно. Можно выдохнуть. Вентилятором займусь я.', 'Верно. Записываю в редкий случай, когда всё сошлось.'] : ['Мимо. Но ничего не сгорело. Читаем разбор.', 'Не то. Паника отменяется, разбор прилагается.', 'Нет. Рабочая гипотеза оказалась нерабочей. Бывает.', 'Не сошлось. Я бы вздохнул, но у меня вентилятор.'];
                    return lines[(MISSIONS.indexOf(m) + step) % lines.length];
                }
                function checkAnswer() {
                    const r = state.run, m = MISSIONS.find(x => x.id === r.id), s = m.steps[r.step];
                    if (checked) {
                        if (!correctNow) { clearAnswer(); renderMission(); $('missioncontent').querySelector('.answer,input,select')?.focus(); return }
                        r.step++; clearAnswer(); save(); renderMission(); return;
                    }
                    const value = s.type === 'choice' ? selected : s.type === 'number' ? numericValue : s.type === 'assemble' ? assembled : matchValues;
                    correctNow = isCorrect(s, value); checked = true; if (!correctNow) { r.misses++; save() }
                    $('missioncontent').querySelectorAll('.answer').forEach(b => { b.disabled = true; if (correctNow && Number(b.dataset.answer) === s.correct) b.classList.add('good'); if (!correctNow && Number(b.dataset.answer) === selected) b.classList.add('bad') });
                    if (s.type === 'assemble') $('missioncontent').querySelectorAll('.titlebuilder button').forEach(b => b.disabled = true);
                    if (s.type === 'number') { $('numberanswer').blur(); $('numberanswer').disabled = true }
                    if (s.type === 'match') $('missioncontent').querySelectorAll('[data-match]').forEach((el, i) => { el.disabled = true; $('matchrow' + i).classList.add(matchValues[i] === s.pairs[i].answer ? 'correct' : 'wrong') });
                    $('feedback').innerHTML = '<div class="feedback ' + (correctNow ? '' : 'bad') + '"><strong>' + esc(feedbackVoice(correctNow, m, r.step)) + '</strong><p>' + esc(s.explain) + '</p></div>';
                    $('checkbutton').textContent = correctNow ? (r.step === m.steps.length - 1 ? 'Посмотреть результат →' : 'Следующий этап →') : 'Попробовать ещё';
                    tune(correctNow ? 'right' : 'wrong'); $('feedback').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest' }); $('checkbutton').focus({ preventScroll: true });
                }
                function renderResult(m) {
                    const earned = starsFor(state.run), previous = state.completed[m.id] || 0; state.completed[m.id] = Math.max(previous, earned); save(); mapRender();
                    const total = Object.keys(state.completed).length, allDone = total === MISSIONS.length;
                    missionShell(m, '<div class="resultstamp"><div class="bigstar" aria-label="' + earned + ' из трёх звёзд">' + ('★'.repeat(earned)) + '<span style="color:#acaa8a">' + ('☆'.repeat(3 - earned)) + '</span></div><h2>' + (allDone ? 'Всё. Обе ветки пройдены.' : 'Остановка пройдена.') + '</h2><div>' + (earned === 3 ? 'Три звезды. Без подсказок и лишнего шума. Уважаю.' : earned === 2 ? 'Две звезды. Разобрался — и ладно. Для этого я тут и греюсь.' : 'Одна звезда. Зато дошёл до решения. Упрямство засчитано.') + '</div></div><div class="resultbody">' + m.outcome + '</div>' + (allDone ? '<div class="hint"><b>Ладно. Я впечатлён.</b> Только не делай из этого событие. Обе специализации пройдены; теперь можешь повторять задания, а я — немного помолчать.</div>' : '') + '<div class="endchoices"><button class="primary" id="resultmap">' + (m.id === 'm12' ? 'Выбрать специализацию на карте' : 'Вернуться на карту') + '</button><button class="winbtn" id="replay">Пройти ещё раз</button></div>' + sourceMarkup(m));
                    $('stagecaption').textContent = 'Пройдено этапов: ' + m.steps.length + ' / ' + m.steps.length;
                    $('resultmap').addEventListener('click', () => { state.run = null; save(); mapRender(); returnToNode = nextMission()?.id || m.id; closeDialog('mission') });
                    $('replay').addEventListener('click', () => { state.run = null; startMission(m.id) }); tune('win'); scrollMissionTop();
                }
                function updateNotebook() {
                    $('bookcontent').innerHTML = GLOSSARY.map(([word, text]) => '<div class="bookentry"><strong>' + esc(word) + '</strong><p>' + esc(text) + '</p></div>').join('') + '<h2>Конспекты пройденных остановок</h2><p>Открывай объяснения повторно без прохождения вопросов.</p>' + MISSIONS.filter(m => state.completed[m.id]).map(m => '<details class="lessonnotes"><summary>' + esc(m.n + '. ' + m.name) + '</summary><div class="resultbody">' + m.outcome + '</div>' + sourceMarkup(m) + '</details>').join('');
                }
                function closeDialog(id) { $(id).close(); syncPageLock(); if (id === 'mission') mapRender() }
                document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeDialog(b.dataset.close)));
                document.querySelectorAll('dialog').forEach(d => d.addEventListener('close', () => { syncPageLock(); if (d.id === 'mission') { mapRender(); if (returnToNode) { focusNode(returnToNode); returnToNode = null } else { const b = $('nodes').querySelector('[data-node="' + lastMission + '"]'); if (b) b.focus({ preventScroll: true }) } } }));
                $('mapbtn').addEventListener('click', () => { for (const id of ['mission', 'book', 'help', 'reset']) if ($(id).open) closeDialog(id); focusCurrent() });
                $('centerbtn').addEventListener('click', focusCurrent);
                $('continuebtn').addEventListener('click', () => { const resume = state.run && MISSIONS.find(m => m.id === state.run.id && state.run.step < m.steps.length); startMission((resume || nextMission() || MISSIONS[0]).id) });
                $('soundbtn').addEventListener('click', () => { state.sound = !state.sound; save(); syncSound(); tune('right') });
                $('bookcontent').innerHTML = GLOSSARY.map(([word, text]) => '<div class="bookentry"><strong>' + esc(word) + '</strong><p>' + esc(text) + '</p></div>').join('');
                $('bookbtn').addEventListener('click', () => { updateNotebook(); openDialog('book') });
                $('helpcontent').innerHTML = '<h2>Инструкция. Да, её иногда читают.</h2><p>Это самостоятельная учебная игра. Все картинки, задания и звуки работают из одного HTML-файла. Для перехода к внешним источникам нужен интернет.</p><h3>Кто такой Максимус</h3><p>Максимус — системный блок старой закалки: токсично-прямолинейный, но по-доброму. Не изображает вечный восторг, ворчит на поспешные выводы и всё равно остаётся рядом, пока ты разбираешься. Под корпусом у него нормальное отношение к людям. Просто вентилятор громкий.</p><h3>Как проходить</h3><ol><li>Открой первую золотую точку.</li><li>Прочитай историю и данные. Ответь на вопрос.</li><li>Посмотри объяснение. Если ошибся — попробуй снова.</li><li>Пройди все этапы, чтобы открыть следующую остановку.</li><li>После большого дела № 11 выбери любую специализацию. Вторую тоже можно пройти.</li></ol><h3>Звёзды и подсказки</h3><p>На некоторых вопросах Максимус сначала ворчит. Кнопка «Ладно, подскажи» со второго нажатия открывает настоящую подсказку. Ворчание не влияет на звёзды; помощь учитывается только после показа подсказки. Повторно за тот же вопрос он не ворчит, даже если ты ошибся и пробуешь снова.</p><p>Три звезды — без ошибок и подсказок. Две — если понадобилась помощь и было не больше двух ошибок. Одна — за завершение после большего числа попыток. Все звёзды открывают следующий уровень одинаково. При повторе остаётся лучший результат.</p><h3>Сохранение</h3><p>Прогресс хранится в этом браузере на этом устройстве. Если браузер разрешает локальное хранилище, можно закрыть и снова открыть тот же файл. При запрете хранения игра предупредит в нижней строке. При переносе файла на другое устройство прогресс автоматически не переносится.</p><h3>Карта и управление</h3><p>На телефоне карта перестраивается в вертикальный маршрут. Листай её вниз; после общего пути откроются две ветки. Кнопка «К моему заданию» найдёт текущую точку. В заданиях кнопки остаются внизу экрана, а таблицы показываются читаемыми карточками. Title собирается нажатием на блоки; выбранный блок можно убрать и добавить заново. Конспекты пройденных остановок доступны в словарике. Кнопки доступны с клавиатуры; Escape закрывает окно. Звук включается по желанию.</p><h3>О заданиях</h3><p>Практические кейсы, компании и числовые результаты придуманы для обучения. После каждого задания доступны первоисточники, по которым подготовлены объяснения. Игра не моделирует реальные гарантии роста трафика.</p><h3>Материалы</h3><ul>' + Object.values(SOURCES).map(s => '<li><a href="' + s.url + '" target="_blank" rel="noopener noreferrer">' + esc(s.name) + '</a></li>').join('') + '</ul><p>Учебный проект «Максимус и тайны поиска», версия 1.4. Визуальный оммаж обучающим компьютерным играм начала 2000-х; самостоятельная игра о SEO.</p><button class="winbtn" id="resetbtn">Начать игру заново…</button>';
                $('helpbtn').addEventListener('click', () => openDialog('help'));
                $('resetbtn').addEventListener('click', () => { closeDialog('help'); openDialog('reset') });
                $('confirmreset').addEventListener('click', () => { state = fresh(); clearAnswer(); save(); mapRender(); closeDialog('reset'); focusCurrent(); toast('Опять с начала. Ладно. Я всё равно никуда не ухожу.') });
                if (mobileQuery.addEventListener) mobileQuery.addEventListener('change', onViewportChange); else mobileQuery.addListener(onViewportChange);
                window.addEventListener('resize', onViewportChange, { passive: true });
                if (window.visualViewport) { window.visualViewport.addEventListener('resize', onViewportChange, { passive: true }); window.visualViewport.addEventListener('scroll', updateViewportMetrics, { passive: true }) }
                if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => layoutMap()).observe($('mapviewport'));
                updateViewportMetrics(); mapRender(); document.documentElement.classList.add('game-ready'); if (readWarning) toast('Не удалось прочитать сохранение. Игра запущена с начала; статус хранения показан внизу.');
            } catch (error) {
                document.documentElement.classList.remove('game-ready');
                const world = document.getElementById('world'); world.innerHTML = initialMap; world.setAttribute('style', initialMapStyle);
                document.getElementById('launch-notice').setAttribute('data-startup', 'failed');
                console.error('Maximus: game startup failed; reading mode remains available.', error);
            }
        })();
