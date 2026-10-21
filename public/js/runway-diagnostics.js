// Opt-in observation only. Freeze the capture before showing the report;
// never drive playback, fetch media, or upload/persist the report.
const version = '20260912-first-data-gate';
const events = [], samples = [];
const started = performance.now();
const stamp = () => Math.round(performance.now() - started);
const round = value => Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
const listen = new AbortController();
const video = document.querySelector('#beach video');
let armed = false, entry, input = null;
function beach() {
  const state = window.runwaySnapshot;
  const film = state?.films.find(film => film.key === 'beach');
  const buffered = video?.buffered;
  const ranges = buffered ? Array.from({ length: buffered.length }, (_, i) => [round(buffered.start(i)), round(buffered.end(i))]) : [];
  return { mode: film?.mode, active: film?.active, currentTime: round(video?.currentTime),
    readyState: video?.readyState, initialReadyState: film?.initialReadyState, networkState: video?.networkState, seeking: video?.seeking,
    paused: video?.paused, error: video?.error?.code || null,
    buffered: ranges.length > 8 ? [...ranges.slice(0, 2), ...ranges.slice(-6)] : ranges,
    decodedTime: round(film?.decodedTime), paintedTime: round(film?.paintedTime), paintCount: film?.paintCount,
    decodedFrames: film?.decodedFrames, pending: film?.intent.pending, failed: film?.failed,
    priming: film?.priming, primed: film?.primed, autoplayBlocked: film?.autoplayBlocked,
    renderLost: film?.renderLost, navControlled: film?.navControlled, revealTime: round(film?.revealTime),
    intent: film?.intent };
}
function record(event, detail = {}) {
  events.push({ ms: stamp(), event, time: round(video?.currentTime), ...detail });
  if (events.length > 10) events.shift();
}
if (video) {
  for (const event of ['loadstart', 'loadedmetadata', 'loadeddata', 'canplay', 'play', 'playing', 'pause', 'waiting', 'stalled', 'seeking', 'seeked', 'error', 'ended']) {
    video.addEventListener(event, () => record(event, { ready: video.readyState, seeking: video.seeking }), { signal: listen.signal });
  }
}
for (const type of ['touchmove', 'touchend', 'wheel', 'click']) {
  window.addEventListener(type, event => { if (event.isTrusted) input = { ms: stamp(), type }; }, { passive: true, signal: listen.signal });
}
for (const type of ['fashion:render-lost', 'fashion:render-restored', 'fashion:render-error']) {
  document.addEventListener(type, event => { if (event.target.closest('#beach')) record(type); }, { signal: listen.signal });
}
for (const type of ['error', 'unhandledrejection']) {
  // No error messages/stacks: they may contain URLs or user data.
  window.addEventListener(type, () => record(type), { signal: listen.signal });
}
function showReport(report) {
  const json = JSON.stringify(report);
  const b = report.beach, known = value => value ?? '—';
  const first = report.samples[0], last = report.samples.at(-1);
  const delta = Number.isFinite(first?.count) && Number.isFinite(last?.count)
    ? `${round((last.ms - first.ms) / 1000)}s / +${last.count - first.count}` : '—';
  const dialog = document.createElement('dialog');
  dialog.id = 'runway-diagnostic';
  dialog.setAttribute('aria-labelledby', 'runway-diagnostic-title');
  dialog.innerHTML = `<style>
    #runway-diagnostic{width:min(420px,calc(100% - 32px));max-height:calc(100% - 32px);margin:auto;padding:20px;border:1px solid var(--l-line-2);background:var(--l-bg);color:var(--l-ink);font:14px/1.5 var(--l-font);overflow:auto;overscroll-behavior:contain;box-shadow:var(--l-shadow)}
    #runway-diagnostic::backdrop{background:rgba(17,17,17,.6)}
    #runway-diagnostic h2{margin:0 0 6px;font-size:22px;font-weight:500}
    #runway-diagnostic p{margin:0 0 12px}
    #runway-diagnostic pre{margin:0 0 16px;padding:12px 0;border-block:1px solid var(--l-line);font:12px/1.65 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;user-select:text}
    #runway-diagnostic .report-actions{display:flex;gap:8px}
    #runway-diagnostic .btn{flex:1;padding:12px 8px;letter-spacing:0;font-size:14px;transition:none}
    #runway-diagnostic .report-copy{background:var(--l-ink);color:var(--l-bg)}
    #runway-diagnostic [role=status]{margin:12px 0 0;color:var(--l-ink-2);font-size:12px}
  </style>
  <h2 id="runway-diagnostic-title">Beach 診斷已擷取</h2>
  <p>直接截圖這張卡傳給我，不用選取文字。</p>
  <pre></pre>
  <div class="report-actions">
    <button type="button" class="btn btn--md report-copy" autofocus>複製完整紀錄</button>
    <button type="button" class="btn btn--md btn--ghost report-close">關閉</button>
  </div>
  <p role="status">資料只留在此頁，不會自動上傳。</p>`;
  dialog.querySelector('pre').textContent = [
    `${report.version}`,
    `入場 ${report.entry.outcome} · ${known(report.entry.percent)}%`,
    `目前 ${known(report.active)} · 方向 ${known(report.direction)}`,
    `Beach ${known(b.mode)} · 暫停 ${known(b.paused)}`,
    `播放 ${known(b.currentTime)} · 解碼 ${known(b.decodedTime)}`,
    `畫面 ${known(b.paintedTime)} · 畫格 ${known(b.paintCount)}`,
    `最近畫格 ${delta}`,
    `Ready ${known(b.readyState)} · Network ${known(b.networkState)}`,
    `Seeking ${known(b.seeking)} · Pending ${known(b.pending)}`,
    `Play pending ${known(b.intent?.playPending)}`,
    `Autoplay blocked ${known(b.autoplayBlocked)}`,
    `Priming ${known(b.priming)} · GPU lost ${known(b.renderLost)}`,
    `Error ${b.error ?? 'none'} · Failed ${known(b.failed)}`,
    `緩衝 ${b.buffered.map(range => range.join('–')).join(', ') || 'none'}`,
  ].join('\n');
  // Diagnostic gestures must not reach the runway's window-level input handlers.
  for (const type of ['wheel', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'pointerdown', 'click', 'keydown']) {
    dialog.addEventListener(type, event => event.stopPropagation());
  }
  dialog.querySelector('.report-copy').addEventListener('click', async () => {
    const status = dialog.querySelector('[role=status]');
    try {
      // Call inside the user's click: Safari requires a fresh user gesture.
      await navigator.clipboard.writeText(json);
      status.textContent = '已複製，回到對話貼上即可。';
    } catch {
      status.textContent = '瀏覽器未允許複製，直接截圖這張卡傳給我即可。';
    }
  });
  dialog.querySelector('.report-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  document.body.append(dialog);
  dialog.showModal();
}
function arm() {
  if (armed) return;
  armed = true;
  const state = window.runwaySnapshot;
  const percent = parseFloat(document.querySelector('[data-entry-value]')?.textContent);
  entry = { outcome: state?.entry?.outcome || 'direct', percent: Number.isFinite(percent) ? percent : null };
  const timer = setInterval(() => {
    const b = beach();
    samples.push({ ms: stamp(), active: b.active, mode: b.mode, time: b.currentTime, decoded: b.decodedTime,
      painted: b.paintedTime, count: b.paintCount, pending: b.pending, ready: b.readyState, seeking: b.seeking });
    if (samples.length > 4) samples.shift();
  }, 1000);
  setTimeout(() => {
    clearInterval(timer);
    listen.abort();
    const state = window.runwaySnapshot;
    const report = { version, userAgent: navigator.userAgent.slice(0, 240), elapsed: stamp(), entry,
      active: state?.active, direction: state?.direction, reduced: state?.reduced, hidden: document.hidden,
      entryLocked: state?.entryLocked, sceneCovered: state?.sceneCovered, navigation: state?.navigation,
      input, beach: beach(), samples, events };
    // Drop old history, never truncate JSON or the current failure state.
    while (JSON.stringify(report).length > 3400 && events.length) events.shift();
    while (JSON.stringify(report).length > 3400 && samples.length) samples.shift();
    showReport(report);
  }, 30000);
}
document.addEventListener('runway:entered', arm, { once: true, signal: listen.signal });
if (!window.RunwayEntry || window.RunwayEntry.state.released || window.runwaySnapshot?.entry?.released) arm();
