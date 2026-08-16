/* Single-page dashboard enhancement. Uses the existing market engine and scanner API contract. */
(function () {
  const sections = [
    ['tab-scanner', 'AI Scanner & Top Opportunities', 'Filter live confluence signals and open any instrument for the full technical chart.'],
    ['tab-options', 'Options Momentum Desk', 'F&O opportunity signals, open interest, and expiry context in the same workspace.'],
    ['tab-signals', 'Live Signal Feed', 'A chronological stream of confluence, breakout, and momentum events.'],
    ['tab-watchlist', 'My Watchlist', 'Your selected instruments, kept locally in this browser.'],
    ['tab-overview', 'Market Breadth & Sectors', 'Breadth, institutional flow, sector leadership, and volatility context.']
  ];

  const money = value => '₹' + Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = stock => (stock.chg >= 0 ? '+' : '') + Number(stock.chg || 0).toFixed(2) + ' (' + (stock.chgPct >= 0 ? '+' : '') + Number(stock.chgPct || 0).toFixed(2) + '%)';

  function bestStocks() {
    return (window.marketEngine && window.marketEngine.stocks ? [...window.marketEngine.stocks] : [])
      .sort((a, b) => b.aiScore - a.aiScore).slice(0, 3);
  }

  function openStock(symbol) {
    if (window.scannerApp && typeof window.scannerApp.openChartModal === 'function') window.scannerApp.openChartModal(symbol);
  }

  function renderHero() {
    const root = document.getElementById('dashboardHero');
    const picks = bestStocks();
    if (!root || !picks.length) return;
    const stock = picks[0];
    const bullish = stock.chg >= 0 ? 'text-bull' : 'text-bear';
    root.innerHTML = '<article class="dashboard-focus">' +
      '<div class="focus-label">SELECTED SETUP · LIVE CONFLUENCE</div>' +
      '<div class="focus-top"><div><div class="focus-symbol">' + stock.symbol + '</div><div class="focus-company">' + stock.name + ' · ' + stock.sector + '</div></div>' +
      '<div class="focus-price"><strong>' + money(stock.cmp) + '</strong><div class="focus-change ' + bullish + '">' + pct(stock) + '</div></div></div>' +
      '<div class="focus-metrics">' +
      '<div class="focus-metric"><span>AI score</span><strong>' + stock.aiScore + ' / 100</strong></div>' +
      '<div class="focus-metric"><span>Entry</span><strong>' + money(stock.tradePlan.entry) + '</strong></div>' +
      '<div class="focus-metric"><span>Stop loss</span><strong class="text-bear">' + money(stock.tradePlan.sl) + '</strong></div>' +
      '<div class="focus-metric"><span>Target 1 / R:R</span><strong class="text-bull">' + money(stock.tradePlan.t1) + ' · ' + stock.tradePlan.rr + '</strong></div>' +
      '</div><div class="focus-actions"><button type="button" data-open-stock="' + stock.symbol + '">Open selected-stock chart →</button>' +
      '<span class="focus-tags">EMA 9/21 · VWAP · RSI · MACD · Supertrend · Volume · Breakout</span></div></article>' +
      '<aside class="dashboard-opportunities"><div class="opps-label">TOP OPPORTUNITIES · AI RANKED</div><div class="dashboard-opps-list">' +
      picks.map((item, index) => '<div class="dashboard-opp" data-open-stock="' + item.symbol + '"><div><strong>#' + (index + 1) + ' ' + item.symbol + '</strong><small>' + money(item.cmp) + ' · ' + item.sector + '</small></div><span class="dashboard-opp-score">' + item.aiScore + '</span><span class="dashboard-opp-signal">' + item.signal + '</span></div>').join('') +
      '</div></aside>';
    root.querySelectorAll('[data-open-stock]').forEach(el => el.addEventListener('click', () => openStock(el.dataset.openStock)));
  }

  function buildPage() {
    if (document.getElementById('dashboardHero')) return;
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.add('active'));
    const header = document.querySelector('.terminal-header');
    const main = document.querySelector('.terminal-main');
    if (!header || !main) return;

    const nav = document.createElement('nav');
    nav.className = 'single-page-nav';
    nav.setAttribute('aria-label', 'Dashboard sections');
    nav.innerHTML = '<button data-target="dashboardHero">Overview</button>' + sections.map(item => '<button data-target="' + item[0] + '">' + item[1].replace(' & Top Opportunities', '').replace('Market Breadth & Sectors', 'Market') + '</button>').join('');
    header.after(nav);
    nav.querySelectorAll('button').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.target).scrollIntoView({ behavior: 'smooth', block: 'start' })));

    const hero = document.createElement('section');
    hero.id = 'dashboardHero';
    hero.className = 'dashboard-hero';
    main.prepend(hero);

    sections.forEach(([id, title, subtitle]) => {
      const pane = document.getElementById(id);
      if (!pane) return;
      const label = document.createElement('div');
      label.className = 'dashboard-section-title';
      label.innerHTML = '<div><div class="dashboard-eyebrow">TRADE JUNCTION AI · LIVE WORKSPACE</div><h2>' + title + '</h2><p>' + subtitle + '</p></div>';
      pane.prepend(label);
    });
    renderHero();
  }

  function initialise() {
    buildPage();
    renderHero();
    if (window.scannerApp) {
      window.scannerApp.renderOptionsScanner();
      window.scannerApp.renderSignalFeed();
      window.scannerApp.renderWatchlist();
      window.scannerApp.renderMarketOverview();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const ready = setInterval(() => {
      if (window.marketEngine && window.scannerApp) {
        clearInterval(ready);
        initialise();
        setInterval(renderHero, 30000);
      }
    }, 150);
  });
})();