(() => {
  const STORAGE_KEY = "tj-watchlist-v1";
  const state = { stocks: [], watchlist: JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") };
  const $ = (id) => document.getElementById(id);

  const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));

  function activateTab(name) {
    document.querySelectorAll("[data-insights-tab]").forEach(button => button.classList.toggle("active", button.dataset.insightsTab === name));
    document.querySelectorAll("[data-insights-panel]").forEach(panel => panel.classList.toggle("active", panel.dataset.insightsPanel === name));
  }

  function renderNews(items) {
    $("tjNewsList").innerHTML = items.length ? items.map(item => `
      <a class="tj-news-item" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">
        <span class="tj-news-source">${escapeHtml(item.source)}</span>
        <strong>${escapeHtml(item.title)}</strong>
        <span class="tj-news-time">${escapeHtml(item.published ? new Date(item.published).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "Open article")}</span>
      </a>`).join("") : '<div class="tj-insights-empty">No headlines available right now.</div>';
  }

  function renderAlerts(items) {
    $("tjAlertCount").textContent = items.length;
    $("tjAlertsList").innerHTML = items.length ? items.map(item => `
      <button class="tj-alert-item ${escapeHtml(item.severity)}" data-symbol="${escapeHtml(item.symbol)}">
        <span class="tj-alert-symbol">${escapeHtml(item.symbol)}</span>
        <span class="tj-alert-type">${escapeHtml(item.type)}</span>
        <strong>${escapeHtml(item.message)}</strong>
        <small>₹${Number(item.price || 0).toLocaleString("en-IN")}</small>
      </button>`).join("") : '<div class="tj-insights-empty">No scanner alerts right now.</div>';
    $("tjAlertsList").querySelectorAll("[data-symbol]").forEach(button => button.addEventListener("click", () => {
      const row = document.querySelector('[data-symbol="' + CSS.escape(button.dataset.symbol) + '"]');
      if (row) row.click();
    }));
  }

  function saveWatchlist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.watchlist));
  }

  function renderWatchlist() {
    const watched = state.stocks.filter(stock => state.watchlist.includes(stock.symbol));
    $("tjWatchlistList").innerHTML = watched.length ? watched.map(stock => {
      const isUp = Number(stock.chgPct) >= 0;
      return `<div class="tj-watch-item">
        <button class="tj-watch-main" data-symbol="${escapeHtml(stock.symbol)}"><strong>${escapeHtml(stock.symbol)}</strong><span>₹${Number(stock.cmp).toLocaleString("en-IN")}</span><em class="${isUp ? "up" : "down"}">${isUp ? "+" : ""}${Number(stock.chgPct).toFixed(2)}%</em></button>
        <button class="tj-watch-remove" data-remove="${escapeHtml(stock.symbol)}" aria-label="Remove ${escapeHtml(stock.symbol)}">×</button>
      </div>`;
    }).join("") : '<div class="tj-insights-empty">Add stocks to track their live price here.</div>';
    $("tjWatchlistList").querySelectorAll("[data-remove]").forEach(button => button.addEventListener("click", () => {
      state.watchlist = state.watchlist.filter(symbol => symbol !== button.dataset.remove);
      saveWatchlist(); renderWatchlist(); fillWatchlistSelect();
    }));
    $("tjWatchlistList").querySelectorAll(".tj-watch-main").forEach(button => button.addEventListener("click", () => {
      const row = document.querySelector('[data-symbol="' + CSS.escape(button.dataset.symbol) + '"]');
      if (row) row.click();
    }));
  }

  function fillWatchlistSelect() {
    const select = $("tjWatchlistSelect");
    const current = select.value;
    select.innerHTML = '<option value="">Choose a stock</option>' + state.stocks
      .filter(stock => !state.watchlist.includes(stock.symbol))
      .map(stock => `<option value="${escapeHtml(stock.symbol)}">${escapeHtml(stock.symbol)} — ${escapeHtml(stock.name)}</option>`).join("");
    select.value = current;
  }

  async function loadStocks() {
    const response = await fetch("/api/live/stocks");
    const payload = await response.json();
    state.stocks = payload.data || [];
    fillWatchlistSelect();
    renderWatchlist();
  }

  async function loadFeed() {
    const [news, alerts] = await Promise.allSettled([
      fetch("/api/live/news").then(response => response.json()),
      fetch("/api/live/alerts").then(response => response.json())
    ]);
    if (news.status === "fulfilled") renderNews(news.value.data || []);
    if (alerts.status === "fulfilled") renderAlerts(alerts.value.data || []);
  }

  function initialise() {
    document.querySelectorAll("[data-insights-tab]").forEach(button => button.addEventListener("click", () => activateTab(button.dataset.insightsTab)));
    $("tjInsightsToggle").addEventListener("click", () => $("tjInsights").classList.add("open"));
    $("tjInsightsClose").addEventListener("click", () => $("tjInsights").classList.remove("open"));
    $("tjWatchlistAdd").addEventListener("click", () => {
      const symbol = $("tjWatchlistSelect").value;
      if (!symbol || state.watchlist.includes(symbol)) return;
      state.watchlist.push(symbol); saveWatchlist(); renderWatchlist(); fillWatchlistSelect();
    });
    loadStocks().catch(() => {});
    loadFeed().catch(() => {});
    setInterval(() => { loadStocks().catch(() => {}); loadFeed().catch(() => {}); }, 60000);
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", initialise) : initialise();
})();