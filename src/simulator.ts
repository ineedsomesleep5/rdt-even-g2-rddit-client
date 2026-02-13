import { FEED_OPTIONS, TEXT_IDS, ITEMS_PER_PAGE, currentFeed, setCurrentFeed } from './constants';

/** Minimal interface to avoid circular dependency with even-client.ts */
interface SimulatorClient {
  reloadFeed(): Promise<void>;
}

let eventCounter = 0;

export function appendEventLog(text: string) {
  const logDiv = document.getElementById('sim-log');
  if (!logDiv) return;
  eventCounter++;
  const ts = new Date().toISOString().substring(11, 23);
  const entry = `#${eventCounter} [${ts}] ${text}`;
  // Prepend newest on top
  if (logDiv.textContent === '(no logs yet)') {
    logDiv.textContent = entry;
  } else {
    logDiv.textContent = entry + '\n' + logDiv.textContent;
  }
  // Trim to 200 entries max
  const lines = logDiv.textContent!.split('\n');
  if (lines.length > 200) {
    logDiv.textContent = lines.slice(0, 200).join('\n');
  }
}

let _consoleIntercepted = false;

export function interceptConsole() {
  if (_consoleIntercepted) return;
  _consoleIntercepted = true;

  const origLog = console.log.bind(console);
  const origWarn = console.warn.bind(console);
  const origError = console.error.bind(console);
  const origInfo = console.info.bind(console);

  function argsToString(args: any[]): string {
    return args.map(a => {
      if (typeof a === 'string') return a;
      try { return JSON.stringify(a); } catch { return String(a); }
    }).join(' ');
  }

  console.log = (...args: any[]) => {
    origLog(...args);
    appendEventLog(`[LOG] ${argsToString(args)}`);
  };
  console.warn = (...args: any[]) => {
    origWarn(...args);
    appendEventLog(`[WARN] ${argsToString(args)}`);
  };
  console.error = (...args: any[]) => {
    origError(...args);
    appendEventLog(`[ERROR] ${argsToString(args)}`);
  };
  console.info = (...args: any[]) => {
    origInfo(...args);
    appendEventLog(`[INFO] ${argsToString(args)}`);
  };
}

export function createSimulatorControls(client: SimulatorClient) {
  const existing = document.getElementById('simulator');
  if (existing) return;

  const container = document.createElement('div');
  container.id = 'simulator';
  container.style.marginTop = '16px';
  container.style.padding = '12px';
  container.style.border = '2px solid #0f0';
  container.style.borderRadius = '4px';
  container.style.backgroundColor = '#001a00';
  container.style.fontFamily = 'monospace';
  container.style.color = '#0f0';

  const title = document.createElement('div');
  title.textContent = '🔧 EVENT MONITOR';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '8px';
  title.style.fontSize = '14px';
  container.appendChild(title);

  const btnContainer = document.createElement('div');
  btnContainer.style.display = 'flex';
  btnContainer.style.gap = '8px';
  btnContainer.style.flexWrap = 'wrap';

  const createIndicator = (id: string, label: string) => {
    const indicator = document.createElement('div');
    indicator.id = id;
    indicator.textContent = label;
    indicator.style.padding = '8px 16px';
    indicator.style.backgroundColor = '#003300';
    indicator.style.color = '#0f0';
    indicator.style.border = '1px solid #0f0';
    indicator.style.borderRadius = '3px';
    indicator.style.fontFamily = 'monospace';
    indicator.style.fontSize = '12px';
    indicator.style.transition = 'all 0.15s';
    return indicator;
  };

  btnContainer.appendChild(createIndicator('ind-scroll-top', '← SCROLL_TOP'));
  btnContainer.appendChild(createIndicator('ind-scroll-bottom', '→ SCROLL_BOTTOM'));
  btnContainer.appendChild(createIndicator('ind-click', '◉ CLICK'));
  btnContainer.appendChild(createIndicator('ind-double-click', '◉◉ DOUBLE_CLICK'));

  container.appendChild(btnContainer);

  const statusDiv = document.createElement('div');
  statusDiv.id = 'sim-status';
  statusDiv.style.marginTop = '8px';
  statusDiv.style.fontSize = '11px';
  statusDiv.style.opacity = '0.7';
  statusDiv.textContent = 'Waiting for events...';
  container.appendChild(statusDiv);

  // Feed selector for glasses mode
  const feedDiv = document.createElement('div');
  feedDiv.style.marginTop = '8px';
  feedDiv.style.borderTop = '1px solid #0f0';
  feedDiv.style.paddingTop = '6px';

  const feedLabel = document.createElement('span');
  feedLabel.style.fontSize = '11px';
  feedLabel.textContent = 'FEED: ';
  feedDiv.appendChild(feedLabel);

  const simFeedSelect = document.createElement('select');
  simFeedSelect.id = 'sim-feed-select';
  simFeedSelect.style.backgroundColor = '#001a00';
  simFeedSelect.style.color = '#0f0';
  simFeedSelect.style.border = '1px solid #0f0';
  simFeedSelect.style.fontFamily = 'monospace';
  simFeedSelect.style.fontSize = '11px';
  simFeedSelect.style.padding = '2px 4px';
  FEED_OPTIONS.forEach((feed, idx) => {
    const opt = document.createElement('option');
    opt.value = String(idx);
    opt.textContent = `${feed.label} — ${feed.description}`;
    opt.style.backgroundColor = '#001a00';
    opt.style.color = '#0f0';
    if (feed === currentFeed) opt.selected = true;
    simFeedSelect.appendChild(opt);
  });
  simFeedSelect.onchange = () => {
    const idx = parseInt(simFeedSelect.value, 10);
    setCurrentFeed(FEED_OPTIONS[idx] ?? FEED_OPTIONS[0]);
    console.log(`🔄 Feed changed to: ${currentFeed.label} (path: ${currentFeed.path})`);
    void client.reloadFeed();
  };
  feedDiv.appendChild(simFeedSelect);
  container.appendChild(feedDiv);

  // Setup info
  const setupDiv = document.createElement('div');
  setupDiv.id = 'sim-setup';
  setupDiv.style.marginTop = '8px';
  setupDiv.style.fontSize = '10px';
  setupDiv.style.opacity = '0.6';
  setupDiv.style.borderTop = '1px solid #0f0';
  setupDiv.style.paddingTop = '6px';
  setupDiv.textContent = `Setup: ${ITEMS_PER_PAGE} text containers (IDs: ${TEXT_IDS.join(',')}), selected container has isEventCapture=1`;
  container.appendChild(setupDiv);

  // Console log
  const logTitle = document.createElement('div');
  logTitle.textContent = 'CONSOLE (newest first):';
  logTitle.style.marginTop = '8px';
  logTitle.style.fontSize = '11px';
  logTitle.style.fontWeight = 'bold';
  container.appendChild(logTitle);

  const logDiv = document.createElement('div');
  logDiv.id = 'sim-log';
  logDiv.style.maxHeight = '300px';
  logDiv.style.overflowY = 'auto';
  logDiv.style.fontSize = '10px';
  logDiv.style.lineHeight = '1.4';
  logDiv.style.whiteSpace = 'pre-wrap';
  logDiv.style.wordBreak = 'break-all';
  logDiv.style.border = '1px solid #060';
  logDiv.style.padding = '4px';
  logDiv.style.marginTop = '4px';
  logDiv.style.backgroundColor = '#000';
  logDiv.textContent = '(no logs yet)';
  container.appendChild(logDiv);

  // Intercept console.log/warn/error/info to mirror into the on-screen log
  interceptConsole();

  const app = document.getElementById('app');
  if (app) app.appendChild(container);
}

export function flashIndicator(indicatorId: string, eventName: string) {
  const el = document.getElementById(indicatorId);
  const statusEl = document.getElementById('sim-status');

  if (el) {
    el.style.backgroundColor = '#cc0000';
    el.style.borderColor = '#ff0000';
    el.style.color = '#fff';

    setTimeout(() => {
      el.style.backgroundColor = '#003300';
      el.style.borderColor = '#0f0';
      el.style.color = '#0f0';
    }, 200);
  }

  if (statusEl) {
    statusEl.textContent = `Received: ${eventName}`;
    setTimeout(() => {
      statusEl.textContent = 'Waiting for events...';
    }, 1500);
  }
}
