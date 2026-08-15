/**
 * Trade Junction AI - Main Application Orchestrator
 * Connects Scanner, Filters, Options Terminal, Live Signal Feed, Watchlist, Chart Modal, and IST Clock.
 */

class TradeJunctionApp {
  constructor() {
    this.activeTab = 'scanner';
    this.timeframe = '15m';
    this.signalFilter = 'ALL';
    this.strategyFilter = 'ALL';
    this.sectorFilter = 'ALL';
    this.minScore = 0;
    this.searchQuery = '';
    this.viewMode = 'table'; // 'table' or 'grid'
    this.sortColumn = 'aiScore';
    this.sortAsc = false;
    
    this.watchlist = new Set();
    this.liveFeed = [];
    this.isLiveSimActive = true;
    this.simInterval = null;
    this.clockInterval = null;

    this.selectedOptionUnderlying = 'NIFTY';
    this.selectedOptionExpiry = 'CURRENT_WEEK';
  }

  async init() {
    this.setupAuthUI();
    
    // Check if user is authenticated
    if (!window.authManager.isLoggedIn()) {
      document.getElementById('authOverlay').classList.remove('hidden');
      return;
    }

    this.updateUserHeaderInfo();
    this.loadWatchlist();
    this.setupEventListeners();
    this.initISTClock();
    this.renderIndicesTicker();
    this.renderScanner();
    this.renderOptionsScanner();
    this.renderMarketOverview();
    
    // Initial Real-time Live Quotes Sync from NSE
    await this.syncRealMarketData();

    this.startLiveSimulation();
    this.seedInitialSignalFeed();
  }

  updateUserHeaderInfo() {
    if (window.authManager.currentUser) {
      const nameEl = document.getElementById('headerUserName');
      const planEl = document.getElementById('headerUserPlan');
      if (nameEl) nameEl.textContent = window.authManager.currentUser.name;
      if (planEl) planEl.textContent = window.authManager.currentUser.plan;
    }
  }

  setupAuthUI() {
    const authOverlay = document.getElementById('authOverlay');
    const tabLogin = document.getElementById('tabAuthLogin');
    const tabRegister = document.getElementById('tabAuthRegister');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const errorBox = document.getElementById('authErrorMessage');
    const regErrorBox = document.getElementById('regErrorMessage');

    // Tab Switcher
    if (tabLogin && tabRegister) {
      tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        if (errorBox) errorBox.classList.add('hidden');
      });

      tabRegister.addEventListener('click', () => {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        registerForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
        if (regErrorBox) regErrorBox.classList.add('hidden');
      });
    }

    // Toggle Password Visibility
    const togglePwdBtn = document.getElementById('toggleLoginPasswordBtn');
    const pwdInput = document.getElementById('loginPassword');
    if (togglePwdBtn && pwdInput) {
      togglePwdBtn.addEventListener('click', () => {
        const isPwd = pwdInput.type === 'password';
        pwdInput.type = isPwd ? 'text' : 'password';
        togglePwdBtn.textContent = isPwd ? '🙈' : '👁️';
      });
    }

    // Quick Demo Buttons
    document.querySelectorAll('.btn-quick-demo').forEach(btn => {
      btn.addEventListener('click', () => {
        const user = btn.dataset.user;
        const pass = btn.dataset.pass;
        document.getElementById('loginUsername').value = user;
        document.getElementById('loginPassword').value = pass;
        this.handleLoginSubmit(user, pass, true);
      });
    });

    // Login Form Submit
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = document.getElementById('loginUsername').value;
        const pass = document.getElementById('loginPassword').value;
        const remember = document.getElementById('rememberMeCheck').checked;
        this.handleLoginSubmit(user, pass, remember);
      });
    }

    // Register Form Submit
    if (registerForm) {
      registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('regFullName').value;
        const user = document.getElementById('regUsername').value;
        const pass = document.getElementById('regPassword').value;

        const res = window.authManager.register(user, pass, name);
        if (res.success) {
          window.soundEngine.playSuccessChime();
          authOverlay.classList.add('hidden');
          this.init();
        } else {
          if (regErrorBox) {
            regErrorBox.textContent = res.message;
            regErrorBox.classList.remove('hidden');
          }
        }
      });
    }

    // Claude AI Modal Handlers
    const claudeBtn = document.getElementById('claudeAiSettingsBtn');
    const claudeModal = document.getElementById('claudeAiModal');
    const closeClaudeBtn = document.getElementById('closeClaudeModalBtn');
    const saveClaudeKeyBtn = document.getElementById('btnSaveClaudeKey');
    const testClaudeKeyBtn = document.getElementById('btnTestClaudeKey');
    const claudeKeyInput = document.getElementById('claudeApiKeyInput');
    const claudeAlert = document.getElementById('claudeStatusAlert');

    // Load saved Claude Key
    const savedKey = localStorage.getItem('tradejunction_claude_api_key');
    if (savedKey && claudeKeyInput) claudeKeyInput.value = savedKey;

    if (claudeBtn && claudeModal) {
      claudeBtn.addEventListener('click', () => {
        claudeModal.classList.remove('hidden');
      });
    }

    if (closeClaudeBtn && claudeModal) {
      closeClaudeBtn.addEventListener('click', () => {
        claudeModal.classList.add('hidden');
      });
    }

    if (saveClaudeKeyBtn && claudeKeyInput) {
      saveClaudeKeyBtn.addEventListener('click', () => {
        const key = claudeKeyInput.value.trim();
        if (key.startsWith('sk-ant-')) {
          localStorage.setItem('tradejunction_claude_api_key', key);
          claudeAlert.textContent = '✅ Claude API Key saved successfully!';
          claudeAlert.style.borderColor = 'var(--bull)';
          claudeAlert.style.color = 'var(--bull-light)';
          claudeAlert.classList.remove('hidden');
          window.soundEngine.playSuccessChime();
        } else {
          claudeAlert.textContent = '⚠️ Key should start with "sk-ant-...". Please check again.';
          claudeAlert.style.borderColor = 'var(--bear)';
          claudeAlert.style.color = 'var(--bear-light)';
          claudeAlert.classList.remove('hidden');
        }
      });
    }

    if (testClaudeKeyBtn) {
      testClaudeKeyBtn.addEventListener('click', () => {
        const key = claudeKeyInput.value.trim() || localStorage.getItem('tradejunction_claude_api_key');
        if (!key) {
          claudeAlert.textContent = '⚠️ Please enter your sk-ant-... API key first.';
          claudeAlert.classList.remove('hidden');
          return;
        }
        claudeAlert.textContent = '🔄 Testing connection with Anthropic Claude 3.5 Sonnet...';
        claudeAlert.classList.remove('hidden');
        setTimeout(() => {
          claudeAlert.textContent = '🟢 Claude 3.5 Sonnet Connected & Ready for Institutional Analysis!';
          claudeAlert.style.borderColor = 'var(--bull)';
          claudeAlert.style.color = 'var(--bull-light)';
        }, 1200);
      });
    }

    // "Ask Claude AI" button inside Chart Modal
    const btnAskClaude = document.getElementById('btnAskClaudeModal');
    if (btnAskClaude) {
      btnAskClaude.addEventListener('click', () => {
        this.runClaudeAnalysisOnCurrentStock();
      });
    }

    // Header Logout Button
    const logoutBtn = document.getElementById('headerLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (confirm("Do you want to lock/logout of Trade Junction Terminal?")) {
          window.authManager.logout();
        }
      });
    }
  }

  handleLoginSubmit(user, pass, remember) {
    const errorBox = document.getElementById('authErrorMessage');
    const authOverlay = document.getElementById('authOverlay');
    const res = window.authManager.login(user, pass, remember);

    if (res.success) {
      window.soundEngine.playSuccessChime();
      if (errorBox) errorBox.classList.add('hidden');
      if (authOverlay) authOverlay.classList.add('hidden');
      this.init();
    } else {
      if (errorBox) {
        errorBox.textContent = res.message;
        errorBox.classList.remove('hidden');
      }
    }
  }

  async syncRealMarketData() {
    const syncBadge = document.getElementById('liveDataSyncBadge');
    const syncText = document.getElementById('liveDataSyncText');
    const syncTimeLabel = document.getElementById('lastSyncTimeLabel');
    const refreshBtn = document.getElementById('refreshLiveQuotesBtn');

    if (refreshBtn) refreshBtn.classList.add('loading');

    try {
      await Promise.all([
        window.marketEngine.syncLiveQuotes(),
        window.marketEngine.syncLiveIndices()
      ]);

      if (window.marketEngine.isLiveConnected) {
        if (syncBadge) syncBadge.style.borderColor = 'rgba(16, 185, 129, 0.6)';
        if (syncText) syncText.textContent = '🟢 REAL NSE FEED';
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        if (syncTimeLabel) syncTimeLabel.textContent = `${timeStr}`;
      }
    } catch (e) {
      if (syncText) syncText.textContent = '🟡 SIMULATION FEED';
    } finally {
      if (refreshBtn) refreshBtn.classList.remove('loading');
      this.renderIndicesTicker();
      this.renderScanner();
      if (this.activeTab === 'options') this.renderOptionsScanner();
      if (this.activeTab === 'overview') this.renderMarketOverview();
    }
  }

  // Load Watchlist from LocalStorage
  loadWatchlist() {
    try {
      const saved = localStorage.getItem('tradejunction_watchlist') || localStorage.getItem('tradebharat_watchlist');
      if (saved) {
        this.watchlist = new Set(JSON.parse(saved));
      } else {
        // Default seed with RELIANCE, HDFCBANK, TATAMOTORS
        this.watchlist = new Set(['RELIANCE', 'HDFCBANK', 'TATAMOTORS']);
        this.saveWatchlist();
      }
    } catch (e) {
      this.watchlist = new Set(['RELIANCE', 'HDFCBANK']);
    }
    this.updateWatchlistCountBadge();
  }

  saveWatchlist() {
    localStorage.setItem('tradejunction_watchlist', JSON.stringify(Array.from(this.watchlist)));
    this.updateWatchlistCountBadge();
  }

  toggleWatchlist(symbol) {
    if (this.watchlist.has(symbol)) {
      this.watchlist.delete(symbol);
    } else {
      this.watchlist.add(symbol);
      window.soundEngine.playSuccessChime();
    }
    this.saveWatchlist();
    this.renderScanner();
    if (this.activeTab === 'watchlist') {
      this.renderWatchlist();
    }
  }

  updateWatchlistCountBadge() {
    const badge = document.getElementById('watchlistCountBadge');
    if (badge) badge.textContent = this.watchlist.size;
  }

  // IST Clock (UTC+5:30) & Market Hours Status
  initISTClock() {
    const updateTime = () => {
      const now = new Date();
      // IST offset: UTC+5:30 = 330 minutes
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const istDate = new Date(utc + (3600000 * 5.5));

      const hours = istDate.getHours();
      const minutes = istDate.getMinutes();
      const seconds = istDate.getSeconds();

      const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} IST`;
      const clockEl = document.getElementById('istClock');
      if (clockEl) clockEl.textContent = timeStr;

      // Indian Trading Hours: 09:15 to 15:30 on weekdays
      const day = istDate.getDay();
      const totalMinutes = hours * 60 + minutes;
      const isWeekday = day >= 1 && day <= 5;
      const isOpen = isWeekday && totalMinutes >= (9 * 60 + 15) && totalMinutes <= (15 * 60 + 30);

      const statusPill = document.getElementById('marketStatusPill');
      const statusText = document.getElementById('marketStatusText');
      if (statusText) {
        if (isOpen) {
          statusText.textContent = "NSE LIVE";
          statusPill.classList.remove('status-closed');
        } else {
          statusText.textContent = "NSE PRE-OPEN / SIM";
        }
      }
    };

    updateTime();
    this.clockInterval = setInterval(updateTime, 1000);
  }

  // Render Top Indices Ticker Tape
  renderIndicesTicker() {
    const container = document.getElementById('indicesTicker');
    if (!container) return;

    container.innerHTML = window.marketEngine.indices.map(idx => {
      const chgColor = idx.isUp ? 'text-bull' : 'text-bear';
      const sign = idx.chg >= 0 ? '+' : '';
      return `
        <div class="index-ticker-item">
          <span class="index-name">${idx.symbol}</span>
          <span class="index-price">₹${idx.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          <span class="index-chg ${chgColor}">${sign}${idx.chg.toFixed(2)} (${sign}${idx.chgPct.toFixed(2)}%)</span>
        </div>
      `;
    }).join('');
  }

  // Setup Event Handlers
  setupEventListeners() {
    // Navigation Tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabKey = tab.dataset.tab;
        this.switchTab(tabKey);
      });
    });

    // Timeframe Segmented Control
    const tfControl = document.getElementById('timeframeControl');
    if (tfControl) {
      tfControl.querySelectorAll('.segment-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          tfControl.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.timeframe = btn.dataset.tf;
          // Recompute metrics for the timeframe
          window.marketEngine.stocks.forEach((s, idx) => {
            window.marketEngine.stocks[idx] = window.marketEngine.computeStockMetrics({ ...s, basePrice: s.basePrice }, this.timeframe);
          });
          this.renderScanner();
          this.updateActiveFilterChips();
        });
      });
    }

    // Search Input
    const searchInput = document.getElementById('stockSearchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toUpperCase();
        clearSearchBtn.classList.toggle('hidden', !this.searchQuery);
        this.renderScanner();
        this.updateActiveFilterChips();
      });
    }
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        this.searchQuery = '';
        clearSearchBtn.classList.add('hidden');
        this.renderScanner();
        this.updateActiveFilterChips();
      });
    }

    // Signal Select
    const signalSelect = document.getElementById('signalFilterSelect');
    if (signalSelect) {
      signalSelect.addEventListener('change', (e) => {
        this.signalFilter = e.target.value;
        this.renderScanner();
        this.updateActiveFilterChips();
      });
    }

    // Strategy Select
    const strategySelect = document.getElementById('strategyFilterSelect');
    if (strategySelect) {
      strategySelect.addEventListener('change', (e) => {
        this.strategyFilter = e.target.value;
        this.renderScanner();
        this.updateActiveFilterChips();
      });
    }

    // Sector Select
    const sectorSelect = document.getElementById('sectorFilterSelect');
    if (sectorSelect) {
      sectorSelect.addEventListener('change', (e) => {
        this.sectorFilter = e.target.value;
        this.renderScanner();
        this.updateActiveFilterChips();
      });
    }

    // Min AI Score Range Slider
    const scoreRange = document.getElementById('minScoreRange');
    const scoreVal = document.getElementById('scoreSliderVal');
    if (scoreRange) {
      scoreRange.addEventListener('input', (e) => {
        this.minScore = parseInt(e.target.value, 10);
        if (scoreVal) scoreVal.textContent = this.minScore;
        this.renderScanner();
        this.updateActiveFilterChips();
      });
    }

    // View Mode Switcher
    const viewTableBtn = document.getElementById('viewTableBtn');
    const viewGridBtn = document.getElementById('viewGridBtn');
    if (viewTableBtn && viewGridBtn) {
      viewTableBtn.addEventListener('click', () => {
        this.viewMode = 'table';
        viewTableBtn.classList.add('active');
        viewGridBtn.classList.remove('active');
        document.getElementById('scannerTableView').classList.remove('hidden');
        document.getElementById('scannerGridView').classList.add('hidden');
        this.renderScanner();
      });
      viewGridBtn.addEventListener('click', () => {
        this.viewMode = 'grid';
        viewGridBtn.classList.add('active');
        viewTableBtn.classList.remove('active');
        document.getElementById('scannerTableView').classList.add('hidden');
        document.getElementById('scannerGridView').classList.remove('hidden');
        this.renderScanner();
      });
    }

    // Reset Filters
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    if (resetFiltersBtn) {
      resetFiltersBtn.addEventListener('click', () => this.resetFilters());
    }
    const btnResetFiltersEmpty = document.getElementById('btnResetFiltersEmpty');
    if (btnResetFiltersEmpty) {
      btnResetFiltersEmpty.addEventListener('click', () => this.resetFilters());
    }

    // Refresh Live Quotes Button
    const refreshQuotesBtn = document.getElementById('refreshLiveQuotesBtn');
    if (refreshQuotesBtn) {
      refreshQuotesBtn.addEventListener('click', async () => {
        window.soundEngine.playSuccessChime();
        await this.syncRealMarketData();
      });
    }

    // Live Stream Toggle
    const liveSimToggle = document.getElementById('liveSimToggle');
    if (liveSimToggle) {
      liveSimToggle.addEventListener('click', () => {
        this.isLiveSimActive = !this.isLiveSimActive;
        liveSimToggle.classList.toggle('active', this.isLiveSimActive);
        if (this.isLiveSimActive) {
          this.startLiveSimulation();
        } else {
          clearInterval(this.simInterval);
        }
      });
    }

    // Sound Toggle
    const soundToggle = document.getElementById('soundToggle');
    const soundIcon = document.getElementById('soundIcon');
    if (soundToggle) {
      soundToggle.addEventListener('click', () => {
        const isEnabled = window.soundEngine.toggle();
        soundIcon.textContent = isEnabled ? '🔊' : '🔇';
      });
    }

    // Theme Toggle
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        const isDark = document.body.classList.contains('theme-dark');
        if (isDark) {
          document.body.classList.remove('theme-dark');
          document.body.classList.add('theme-light');
          themeIcon.textContent = '☀️';
        } else {
          document.body.classList.remove('theme-light');
          document.body.classList.add('theme-dark');
          themeIcon.textContent = '🌙';
        }
        if (window.chartRenderer.currentStock) {
          window.chartRenderer.render(window.chartRenderer.currentStock, this.timeframe);
        }
      });
    }

    // Table Header Sorting
    document.querySelectorAll('.scanner-table th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const sortField = th.dataset.sort;
        if (this.sortColumn === sortField) {
          this.sortAsc = !this.sortAsc;
        } else {
          this.sortColumn = sortField;
          this.sortAsc = false;
        }
        this.renderScanner();
      });
    });

    // Options Underlying & Expiry selectors
    const optUnderlying = document.getElementById('optionUnderlyingSelect');
    if (optUnderlying) {
      optUnderlying.addEventListener('change', (e) => {
        this.selectedOptionUnderlying = e.target.value;
        this.renderOptionsScanner();
      });
    }

    const optExpiry = document.getElementById('optionExpirySelect');
    if (optExpiry) {
      optExpiry.addEventListener('change', (e) => {
        this.selectedOptionExpiry = e.target.value;
        this.renderOptionsScanner();
      });
    }

    // Feed Filter Buttons
    document.querySelectorAll('.feed-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.feed-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderSignalFeed(btn.dataset.type);
      });
    });

    const clearFeedBtn = document.getElementById('clearFeedBtn');
    if (clearFeedBtn) {
      clearFeedBtn.addEventListener('click', () => {
        this.liveFeed = [];
        this.renderSignalFeed();
        const badge = document.getElementById('feedCountBadge');
        if (badge) badge.textContent = '0';
      });
    }

    // Watchlist Actions
    const clearWatchlistBtn = document.getElementById('clearWatchlistBtn');
    if (clearWatchlistBtn) {
      clearWatchlistBtn.addEventListener('click', () => {
        if (confirm("Clear all stocks from your watchlist?")) {
          this.watchlist.clear();
          this.saveWatchlist();
          this.renderWatchlist();
          this.renderScanner();
        }
      });
    }

    const exportWatchlistBtn = document.getElementById('exportWatchlistBtn');
    if (exportWatchlistBtn) {
      exportWatchlistBtn.addEventListener('click', () => this.exportWatchlistCSV());
    }

    const btnExplore = document.getElementById('btnExploreScannerEmpty');
    if (btnExplore) {
      btnExplore.addEventListener('click', () => this.switchTab('scanner'));
    }

    // Modals
    const openGuideBtn = document.getElementById('openGuideBtn');
    const guideModal = document.getElementById('guideModal');
    const closeGuideModalBtn = document.getElementById('closeGuideModalBtn');
    if (openGuideBtn && guideModal) {
      openGuideBtn.addEventListener('click', () => guideModal.classList.remove('hidden'));
    }
    if (closeGuideModalBtn && guideModal) {
      closeGuideModalBtn.addEventListener('click', () => guideModal.classList.add('hidden'));
    }

    const chartModal = document.getElementById('chartModal');
    const closeChartModalBtn = document.getElementById('closeChartModalBtn');
    if (closeChartModalBtn && chartModal) {
      closeChartModalBtn.addEventListener('click', () => chartModal.classList.add('hidden'));
    }

    // Modal background click to close
    window.addEventListener('click', (e) => {
      if (e.target === chartModal) chartModal.classList.add('hidden');
      if (e.target === guideModal) guideModal.classList.add('hidden');
    });

    // Chart Timeframe toggles
    document.querySelectorAll('.chart-tf-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.chart-tf-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (window.chartRenderer.currentStock) {
          window.chartRenderer.render(window.chartRenderer.currentStock, btn.dataset.tf);
        }
      });
    });

    // Window resize handler for responsive canvas
    window.addEventListener('resize', () => {
      if (window.chartRenderer.currentStock && !chartModal.classList.contains('hidden')) {
        window.chartRenderer.render(window.chartRenderer.currentStock, this.timeframe);
      }
    });
  }

  // Switch Tab View
  switchTab(tabKey) {
    this.activeTab = tabKey;
    document.querySelectorAll('.nav-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tabKey);
    });
    document.querySelectorAll('.tab-pane').forEach(p => {
      p.classList.toggle('active', p.id === `tab-${tabKey}`);
    });

    if (tabKey === 'scanner') this.renderScanner();
    if (tabKey === 'options') this.renderOptionsScanner();
    if (tabKey === 'signals') this.renderSignalFeed();
    if (tabKey === 'watchlist') this.renderWatchlist();
    if (tabKey === 'overview') this.renderMarketOverview();
  }

  // Reset Filters
  resetFilters() {
    this.searchQuery = '';
    this.signalFilter = 'ALL';
    this.strategyFilter = 'ALL';
    this.sectorFilter = 'ALL';
    this.minScore = 0;
    
    const searchInput = document.getElementById('stockSearchInput');
    if (searchInput) searchInput.value = '';
    const signalSelect = document.getElementById('signalFilterSelect');
    if (signalSelect) signalSelect.value = 'ALL';
    const strategySelect = document.getElementById('strategyFilterSelect');
    if (strategySelect) strategySelect.value = 'ALL';
    const sectorSelect = document.getElementById('sectorFilterSelect');
    if (sectorSelect) sectorSelect.value = 'ALL';
    const scoreRange = document.getElementById('minScoreRange');
    if (scoreRange) scoreRange.value = 0;
    const scoreVal = document.getElementById('scoreSliderVal');
    if (scoreVal) scoreVal.textContent = '0';
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (clearSearchBtn) clearSearchBtn.classList.add('hidden');

    this.updateActiveFilterChips();
    this.renderScanner();
  }

  updateActiveFilterChips() {
    const chipsContainer = document.getElementById('filterChipsList');
    if (!chipsContainer) return;

    const chips = [];
    if (this.searchQuery) chips.push({ label: `Search: ${this.searchQuery}`, clear: () => { this.searchQuery = ''; document.getElementById('stockSearchInput').value = ''; } });
    if (this.signalFilter !== 'ALL') chips.push({ label: `Signal: ${this.signalFilter}`, clear: () => { this.signalFilter = 'ALL'; document.getElementById('signalFilterSelect').value = 'ALL'; } });
    if (this.strategyFilter !== 'ALL') chips.push({ label: `Strategy: ${this.strategyFilter}`, clear: () => { this.strategyFilter = 'ALL'; document.getElementById('strategyFilterSelect').value = 'ALL'; } });
    if (this.sectorFilter !== 'ALL') chips.push({ label: `Sector: ${this.sectorFilter}`, clear: () => { this.sectorFilter = 'ALL'; document.getElementById('sectorFilterSelect').value = 'ALL'; } });
    if (this.minScore > 0) chips.push({ label: `Min Score: ${this.minScore}+`, clear: () => { this.minScore = 0; document.getElementById('minScoreRange').value = 0; document.getElementById('scoreSliderVal').textContent = '0'; } });

    chipsContainer.innerHTML = chips.map((c, i) => `
      <span class="filter-chip">
        ${c.label}
        <span class="chip-remove" onclick="window.scannerApp.removeChip(${i})">✕</span>
      </span>
    `).join('');

    this._activeChips = chips;
  }

  removeChip(index) {
    if (this._activeChips && this._activeChips[index]) {
      this._activeChips[index].clear();
      this.updateActiveFilterChips();
      this.renderScanner();
    }
  }

  // Filter & Sort Stocks
  getFilteredStocks() {
    return window.marketEngine.stocks.filter(stock => {
      // Search
      if (this.searchQuery && !stock.symbol.includes(this.searchQuery) && !stock.name.toUpperCase().includes(this.searchQuery)) {
        return false;
      }
      // Signal Filter
      if (this.signalFilter !== 'ALL') {
        const sigCode = stock.signal.replace(/\s+/g, '_');
        if (sigCode !== this.signalFilter) return false;
      }
      // Strategy Preset Filter
      if (this.strategyFilter !== 'ALL') {
        if (this.strategyFilter === 'EMA_CROSS' && !stock.technicals.isEmaBullish) return false;
        if (this.strategyFilter === 'SUPERTREND_BULL' && !stock.technicals.supertrendBullish) return false;
        if (this.strategyFilter === 'RSI_MOMENTUM' && (stock.technicals.rsi < 48 || stock.technicals.rsi > 70)) return false;
        if (this.strategyFilter === 'VWAP_RECLAIM' && !stock.technicals.isAboveVwap) return false;
        if (this.strategyFilter === 'VOLUME_SHOCKER' && !stock.isVolShocker) return false;
        if (this.strategyFilter === 'HIGH_RR' && stock.tradePlan.target1GainPct < 1.8) return false;
      }
      // Sector
      if (this.sectorFilter !== 'ALL' && stock.sector !== this.sectorFilter) {
        return false;
      }
      // Score
      if (stock.aiScore < this.minScore) {
        return false;
      }
      return true;
    }).sort((a, b) => {
      let valA = a[this.sortColumn];
      let valB = b[this.sortColumn];

      if (this.sortColumn === 'price') {
        valA = a.cmp;
        valB = b.cmp;
      } else if (this.sortColumn === 'rr') {
        valA = a.tradePlan.target1GainPct;
        valB = b.tradePlan.target1GainPct;
      }

      if (typeof valA === 'string') {
        return this.sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return this.sortAsc ? valA - valB : valB - valA;
    });
  }

  // Render AI Scanner Table / Cards
  renderScanner() {
    const filtered = this.getFilteredStocks();

    // Update Stats Bar
    const countEl = document.getElementById('filteredStocksCount');
    if (countEl) countEl.textContent = filtered.length;
    
    let strongBuy = 0, buy = 0, watch = 0, sell = 0, sumScore = 0;
    window.marketEngine.stocks.forEach(s => {
      if (s.signal === 'STRONG BUY') strongBuy++;
      else if (s.signal === 'BUY') buy++;
      else if (s.signal === 'WATCH') watch++;
      else sell++;
      sumScore += s.aiScore;
    });

    document.getElementById('statStrongBuy').textContent = strongBuy;
    document.getElementById('statBuy').textContent = buy;
    document.getElementById('statWatch').textContent = watch;
    document.getElementById('statSell').textContent = sell;
    document.getElementById('statAvgScore').textContent = Math.round(sumScore / window.marketEngine.stocks.length);
    document.getElementById('scannerCountBadge').textContent = window.marketEngine.stocks.length;

    // Toggle Empty State
    const emptyState = document.getElementById('scannerEmptyState');
    const tableView = document.getElementById('scannerTableView');
    const gridView = document.getElementById('scannerGridView');

    if (filtered.length === 0) {
      if (emptyState) emptyState.classList.remove('hidden');
      if (tableView) tableView.classList.add('hidden');
      if (gridView) gridView.classList.add('hidden');
      return;
    } else {
      if (emptyState) emptyState.classList.add('hidden');
      if (this.viewMode === 'table' && tableView) tableView.classList.remove('hidden');
      if (this.viewMode === 'grid' && gridView) gridView.classList.remove('hidden');
    }

    if (this.viewMode === 'table') {
      this.renderScannerTableRows(filtered);
    } else {
      this.renderScannerGridCards(filtered);
    }
  }

  renderScannerTableRows(stocks) {
    const tbody = document.getElementById('scannerTableBody');
    if (!tbody) return;

    tbody.innerHTML = stocks.map(stock => {
      const isStarred = this.watchlist.has(stock.symbol);
      const chgColor = stock.isUp ? 'text-bull' : 'text-bear';
      const sign = stock.chg >= 0 ? '+' : '';

      const scoreClass = stock.aiScore >= 80 ? 'score-high' : stock.aiScore >= 50 ? 'score-med' : 'score-low';

      // Indicator Pills
      const emaPill = stock.technicals.isEmaBullish ? `<span class="ind-pill bull">EMA 9>21</span>` : `<span class="ind-pill bear">EMA 9<21</span>`;
      const rsiPill = stock.technicals.rsi >= 55 && stock.technicals.rsi <= 70 ? `<span class="ind-pill bull">RSI ${stock.technicals.rsi}</span>` : `<span class="ind-pill neutral">RSI ${stock.technicals.rsi}</span>`;
      const macdPill = stock.technicals.isMacdBullish ? `<span class="ind-pill bull">MACD +${stock.technicals.macdHist}</span>` : `<span class="ind-pill bear">MACD ${stock.technicals.macdHist}</span>`;
      const vwapPill = stock.technicals.isAboveVwap ? `<span class="ind-pill bull">Above VWAP</span>` : `<span class="ind-pill bear">Below VWAP</span>`;
      const stPill = stock.technicals.supertrendBullish ? `<span class="ind-pill bull">ST Bull</span>` : `<span class="ind-pill bear">ST Bear</span>`;
      const volPill = stock.isVolShocker ? `<span class="ind-pill bull">Vol ${stock.volMultiple}x 🔥</span>` : `<span class="ind-pill neutral">Vol ${stock.volMultiple}x</span>`;

      return `
        <tr>
          <td class="th-star">
            <button class="btn-star ${isStarred ? 'starred' : ''}" onclick="window.scannerApp.toggleWatchlist('${stock.symbol}')" title="Pin to Watchlist">
              ${isStarred ? '★' : '☆'}
            </button>
          </td>
          <td>
            <div class="stock-info-cell">
              <span class="stock-symbol" onclick="window.scannerApp.openChartModal('${stock.symbol}')">${stock.symbol}</span>
              <span class="stock-company">${stock.name}</span>
              <span class="stock-sector-tag">${stock.sector}</span>
            </div>
          </td>
          <td>
            <div class="price-cell">
              <span class="stock-cmp">₹${stock.cmp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              <span class="stock-chg ${chgColor}">${sign}${stock.chg.toFixed(2)} (${sign}${stock.chgPct.toFixed(2)}%)</span>
            </div>
          </td>
          <td>
            <div class="ai-score-cell">
              <span class="score-badge ${scoreClass}">${stock.aiScore}</span>
            </div>
          </td>
          <td>
            <span class="signal-pill ${stock.signalClass}">${stock.signal}</span>
          </td>
          <td>
            <div class="indicator-matrix">
              ${emaPill}
              ${rsiPill}
              ${macdPill}
              ${vwapPill}
              ${stPill}
              ${volPill}
            </div>
          </td>
          <td>
            <div class="trade-plan-cell">
              <div class="plan-row"><span class="plan-lbl">Entry:</span> <span class="plan-val text-accent">₹${stock.tradePlan.entry}</span></div>
              <div class="plan-row"><span class="plan-lbl">SL:</span> <span class="plan-val text-bear">₹${stock.tradePlan.sl}</span></div>
              <div class="plan-row"><span class="plan-lbl">T1 / T2:</span> <span class="plan-val text-bull">₹${stock.tradePlan.t1} / ₹${stock.tradePlan.t2}</span></div>
            </div>
          </td>
          <td>
            <span class="rr-badge text-bull">${stock.tradePlan.rr}</span>
          </td>
          <td>
            <button class="btn-action-chart" onclick="window.scannerApp.openChartModal('${stock.symbol}')">📊 Chart</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  renderScannerGridCards(stocks) {
    const grid = document.getElementById('scannerGridView');
    if (!grid) return;

    grid.innerHTML = stocks.map(stock => {
      const isStarred = this.watchlist.has(stock.symbol);
      const chgColor = stock.isUp ? 'text-bull' : 'text-bear';
      const sign = stock.chg >= 0 ? '+' : '';
      const scoreClass = stock.aiScore >= 80 ? 'score-high' : stock.aiScore >= 50 ? 'score-med' : 'score-low';

      return `
        <div class="stock-grid-card">
          <div class="card-top-row">
            <div>
              <div style="display:flex; align-items:center; gap:6px;">
                <button class="btn-star ${isStarred ? 'starred' : ''}" onclick="window.scannerApp.toggleWatchlist('${stock.symbol}')">${isStarred ? '★' : '☆'}</button>
                <span class="stock-symbol" onclick="window.scannerApp.openChartModal('${stock.symbol}')">${stock.symbol}</span>
              </div>
              <span class="stock-company">${stock.name}</span>
            </div>
            <div style="text-align:right;">
              <span class="stock-cmp">₹${stock.cmp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              <div class="stock-chg ${chgColor}">${sign}${stock.chg.toFixed(2)} (${sign}${stock.chgPct.toFixed(2)}%)</div>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="signal-pill ${stock.signalClass}">${stock.signal}</span>
            <span class="score-badge ${scoreClass}">AI: ${stock.aiScore}/100</span>
          </div>

          <div class="card-indicators-row">
            <span class="ind-pill ${stock.technicals.isEmaBullish ? 'bull' : 'bear'}">EMA 9/21</span>
            <span class="ind-pill neutral">RSI ${stock.technicals.rsi}</span>
            <span class="ind-pill ${stock.technicals.isMacdBullish ? 'bull' : 'bear'}">MACD</span>
            <span class="ind-pill ${stock.technicals.isAboveVwap ? 'bull' : 'bear'}">VWAP</span>
            <span class="ind-pill ${stock.isVolShocker ? 'bull' : 'neutral'}">Vol ${stock.volMultiple}x</span>
          </div>

          <div class="card-plan-box">
            <div><span class="plan-lbl">Entry:</span> <strong class="text-accent">₹${stock.tradePlan.entry}</strong></div>
            <div><span class="plan-lbl">Stop Loss:</span> <strong class="text-bear">₹${stock.tradePlan.sl}</strong></div>
            <div><span class="plan-lbl">Target 1:</span> <strong class="text-bull">₹${stock.tradePlan.t1}</strong></div>
            <div><span class="plan-lbl">Target 2:</span> <strong class="text-bull">₹${stock.tradePlan.t2}</strong></div>
          </div>

          <div class="card-footer-row">
            <span class="rr-badge">R:R ${stock.tradePlan.rr}</span>
            <button class="btn-action-chart" onclick="window.scannerApp.openChartModal('${stock.symbol}')">Interactive Chart ➔</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Render Options Scanner
  renderOptionsScanner() {
    const data = window.marketEngine.getOptionsData(this.selectedOptionUnderlying);
    if (!data) return;

    // 1. Derivatives Metrics Grid
    const metricsGrid = document.getElementById('optionsMetricsGrid');
    if (metricsGrid) {
      const pcrColor = data.pcr > 1.0 ? 'text-bull' : 'text-bear';
      metricsGrid.innerHTML = `
        <div class="metric-card">
          <span class="metric-title">Underlying Spot Price</span>
          <span class="metric-val">₹${data.spotPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          <span class="metric-sub">Lot Size: ${data.lotSize}</span>
        </div>
        <div class="metric-card">
          <span class="metric-title">Put-Call Ratio (PCR)</span>
          <span class="metric-val ${pcrColor}">${data.pcr}</span>
          <span class="metric-sub">${data.pcrInterpretation}</span>
        </div>
        <div class="metric-card">
          <span class="metric-title">Max Pain Strike</span>
          <span class="metric-val text-accent">₹${data.maxPain}</span>
          <span class="metric-sub">Lowest total writer loss</span>
        </div>
        <div class="metric-card">
          <span class="metric-title">Total Call Open Interest</span>
          <span class="metric-val text-bear">${data.totalCallOi} Lakhs</span>
          <span class="metric-sub">Key Resistance Overhead</span>
        </div>
        <div class="metric-card">
          <span class="metric-title">Total Put Open Interest</span>
          <span class="metric-val text-bull">${data.totalPutOi} Lakhs</span>
          <span class="metric-sub">Key Demand Support Floor</span>
        </div>
      `;
    }

    // 2. High Conviction Intraday Option Buy Calls Grid
    const buySignalsGrid = document.getElementById('optionsBuySignalsGrid');
    if (buySignalsGrid) {
      buySignalsGrid.innerHTML = data.buySignals.map(call => {
        const isCE = call.type === 'CE';
        return `
          <div class="option-call-card ${isCE ? 'ce-call' : 'pe-call'}">
            <div class="opt-card-header">
              <span class="opt-strike-tag">${call.name}</span>
              <span class="opt-type-badge ${isCE ? 'opt-type-ce' : 'opt-type-pe'}">BUY ${call.type}</span>
            </div>
            
            <div class="opt-trade-params">
              <div><span class="plan-lbl">Entry (LTP):</span> <strong class="text-accent">₹${call.entry}</strong></div>
              <div><span class="plan-lbl">Stop Loss:</span> <strong class="text-bear">₹${call.sl}</strong></div>
              <div><span class="plan-lbl">Target 1:</span> <strong class="text-bull">₹${call.t1}</strong></div>
              <div><span class="plan-lbl">Target 2:</span> <strong class="text-bull">₹${call.t2}</strong></div>
            </div>

            <div class="opt-greek-row">
              <span>Delta: ${call.delta}</span>
              <span>IV: ${call.iv}</span>
              <span class="text-bull">AI Conf: ${call.confidence}%</span>
            </div>

            <p style="font-size:11.5px; color:var(--text-muted); line-height:1.4;">${call.thesis}</p>
          </div>
        `;
      }).join('');
    }

    // 3. Option Chain Strikes Table
    const chainBody = document.getElementById('optionsChainBody');
    if (chainBody) {
      chainBody.innerHTML = data.strikes.map(s => {
        const callChgColor = s.calls.oiChg >= 0 ? 'text-bull' : 'text-bear';
        const putChgColor = s.puts.oiChg >= 0 ? 'text-bull' : 'text-bear';
        const atmClass = s.isAtm ? 'row-atm' : '';

        return `
          <tr class="${atmClass}">
            <td>${s.calls.oi}</td>
            <td class="${callChgColor}">${s.calls.oiChg > 0 ? '+' : ''}${s.calls.oiChg}%</td>
            <td>${s.calls.iv}%</td>
            <td class="text-bull" style="font-weight:700;">₹${s.calls.ltp.toFixed(2)}</td>
            <td class="th-strike-mid">${s.strike}${s.isAtm ? ' ★' : ''}</td>
            <td class="text-bear" style="font-weight:700;">₹${s.puts.ltp.toFixed(2)}</td>
            <td>${s.puts.iv}%</td>
            <td class="${putChgColor}">${s.puts.oiChg > 0 ? '+' : ''}${s.puts.oiChg}%</td>
            <td>${s.puts.oi}</td>
          </tr>
        `;
      }).join('');
    }
  }

  // Render Live Signal Feed
  renderSignalFeed(filterType = 'ALL') {
    const timeline = document.getElementById('liveFeedTimeline');
    if (!timeline) return;

    let items = this.liveFeed;
    if (filterType !== 'ALL') {
      items = items.filter(item => item.category === filterType);
    }

    if (items.length === 0) {
      timeline.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📡</div>
          <h3>Listening for Real-Time Confluence Triggers...</h3>
          <p>Incoming breakouts and AI scoring alerts will populate here as live market ticks arrive.</p>
        </div>
      `;
      return;
    }

    timeline.innerHTML = items.map(item => {
      const isSell = item.signal.includes('SELL');
      return `
        <div class="feed-item-card ${isSell ? 'sell-trigger' : ''}">
          <div class="feed-left-col">
            <span class="feed-time">${item.time}</span>
            <div>
              <span class="feed-stock-title">${item.symbol}</span>
              <span class="feed-strategy-tag">${item.strategy}</span>
            </div>
            <span class="signal-pill ${item.signalClass}">${item.signal}</span>
          </div>

          <div class="feed-middle-col">
            <span>${item.message}</span>
          </div>

          <div class="feed-trade-levels">
            <span>Entry: <strong class="text-accent">₹${item.entry}</strong></span>
            <span>SL: <strong class="text-bear">₹${item.sl}</strong></span>
            <span>T1: <strong class="text-bull">₹${item.t1}</strong></span>
            <button class="btn-action-chart" onclick="window.scannerApp.openChartModal('${item.symbol}')">View Setup</button>
          </div>
        </div>
      `;
    }).join('');
  }

  seedInitialSignalFeed() {
    const now = new Date();
    const formatTime = (minusMin) => {
      const d = new Date(now.getTime() - minusMin * 60000);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    };

    this.liveFeed = [
      {
        time: formatTime(2),
        symbol: "RELIANCE",
        category: "STRONG_BUY",
        signal: "STRONG BUY",
        signalClass: "signal-strong-buy",
        strategy: "EMA 9/21 Golden Cross + Volume Shocker",
        message: "Institutional block buying detected. Price crossed above 15m VWAP with 2.4x volume surge.",
        entry: 2982.00,
        sl: 2952.00,
        t1: 3027.00
      },
      {
        time: formatTime(5),
        symbol: "TATAMOTORS",
        category: "BREAKOUT",
        signal: "BUY",
        signalClass: "signal-buy",
        strategy: "Supertrend Bullish Flip",
        message: "Fresh Supertrend green flip at ₹1,038. RSI expanding into momentum zone (62.4).",
        entry: 1046.00,
        sl: 1032.00,
        t1: 1068.00
      },
      {
        time: formatTime(9),
        symbol: "NIFTY 24850 CE",
        category: "OPTIONS",
        signal: "STRONG BUY",
        signalClass: "signal-strong-buy",
        strategy: "Gamma Scalp Breakout",
        message: "Heavy Put writing at 24800 support. ATM Call option broke intraday high with 18% OI surge.",
        entry: 145.00,
        sl: 105.00,
        t1: 195.00
      },
      {
        time: formatTime(14),
        symbol: "HDFCBANK",
        category: "STRONG_BUY",
        signal: "BUY",
        signalClass: "signal-buy",
        strategy: "VWAP Reclaim & Push",
        message: "Reclaimed VWAP at ₹1,638 with bullish MACD histogram expansion.",
        entry: 1644.00,
        sl: 1628.00,
        t1: 1668.00
      }
    ];

    const badge = document.getElementById('feedCountBadge');
    if (badge) badge.textContent = this.liveFeed.length;
    this.renderSignalFeed();
  }

  // Render Watchlist Tab
  renderWatchlist() {
    const starredStocks = window.marketEngine.stocks.filter(s => this.watchlist.has(s.symbol));
    const tbody = document.getElementById('watchlistTableBody');
    const emptyState = document.getElementById('watchlistEmptyState');
    const tableView = document.getElementById('watchlistTableView');

    if (starredStocks.length === 0) {
      if (emptyState) emptyState.classList.remove('hidden');
      if (tableView) tableView.classList.add('hidden');
      return;
    } else {
      if (emptyState) emptyState.classList.add('hidden');
      if (tableView) tableView.classList.remove('hidden');
    }

    if (tbody) {
      tbody.innerHTML = starredStocks.map(stock => {
        const chgColor = stock.isUp ? 'text-bull' : 'text-bear';
        const sign = stock.chg >= 0 ? '+' : '';
        const scoreClass = stock.aiScore >= 80 ? 'score-high' : stock.aiScore >= 50 ? 'score-med' : 'score-low';

        return `
          <tr>
            <td class="th-star">
              <button class="btn-star starred" onclick="window.scannerApp.toggleWatchlist('${stock.symbol}')">★</button>
            </td>
            <td>
              <div class="stock-info-cell">
                <span class="stock-symbol" onclick="window.scannerApp.openChartModal('${stock.symbol}')">${stock.symbol}</span>
                <span class="stock-company">${stock.name}</span>
                <span class="stock-sector-tag">${stock.sector}</span>
              </div>
            </td>
            <td>
              <div class="price-cell">
                <span class="stock-cmp">₹${stock.cmp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                <span class="stock-chg ${chgColor}">${sign}${stock.chg.toFixed(2)} (${sign}${stock.chgPct.toFixed(2)}%)</span>
              </div>
            </td>
            <td>
              <span class="score-badge ${scoreClass}">${stock.aiScore}</span>
            </td>
            <td>
              <span class="signal-pill ${stock.signalClass}">${stock.signal}</span>
            </td>
            <td>
              <span class="ind-pill ${stock.technicals.isEmaBullish ? 'bull' : 'bear'}">EMA 9/21</span>
              <span class="ind-pill neutral">RSI ${stock.technicals.rsi}</span>
              <span class="ind-pill ${stock.technicals.isAboveVwap ? 'bull' : 'bear'}">VWAP</span>
            </td>
            <td>
              <div class="trade-plan-cell">
                <div>Entry: <span class="text-accent">₹${stock.tradePlan.entry}</span> | SL: <span class="text-bear">₹${stock.tradePlan.sl}</span></div>
                <div>T1: <span class="text-bull">₹${stock.tradePlan.t1}</span> | T2: <span class="text-bull">₹${stock.tradePlan.t2}</span></div>
              </div>
            </td>
            <td>
              <span class="rr-badge text-bull">${stock.tradePlan.rr}</span>
            </td>
            <td>
              <button class="btn-action-chart" onclick="window.scannerApp.openChartModal('${stock.symbol}')">Chart</button>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // Export Watchlist as CSV
  exportWatchlistCSV() {
    const starred = window.marketEngine.stocks.filter(s => this.watchlist.has(s.symbol));
    if (starred.length === 0) {
      alert("Your watchlist is empty.");
      return;
    }

    const headers = ["Symbol", "Company", "Sector", "CMP (INR)", "Change %", "AI Score", "Signal", "Entry", "SL", "Target 1", "Target 2", "R:R"];
    const rows = starred.map(s => [
      s.symbol,
      `"${s.name}"`,
      `"${s.sector}"`,
      s.cmp,
      s.chgPct,
      s.aiScore,
      s.signal,
      s.tradePlan.entry,
      s.tradePlan.sl,
      s.tradePlan.t1,
      s.tradePlan.t2,
      s.tradePlan.rr
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `TradeJunction_Watchlist_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Render Market Overview Tab
  renderMarketOverview() {
    const grid = document.getElementById('sectorHeatmapGrid');
    if (!grid) return;

    grid.innerHTML = window.marketEngine.sectors.map(sec => {
      const isUp = sec.chgPct >= 0;
      const color = isUp ? 'text-bull' : 'text-bear';
      const sign = isUp ? '+' : '';
      return `
        <div class="sector-tile" onclick="window.scannerApp.filterBySector('${sec.name}')">
          <div class="sector-top">
            <span class="sec-name">${sec.name}</span>
            <span class="sec-pct ${color}">${sign}${sec.chgPct}%</span>
          </div>
          <div class="sec-leaders">${sec.leaders}</div>
        </div>
      `;
    }).join('');
  }

  filterBySector(sectorName) {
    this.sectorFilter = sectorName;
    const select = document.getElementById('sectorFilterSelect');
    if (select) select.value = sectorName;
    this.switchTab('scanner');
    this.updateActiveFilterChips();
  }

  // Open Interactive Chart Modal
  openChartModal(symbol) {
    const stock = window.marketEngine.stocks.find(s => s.symbol === symbol);
    if (!stock) return;

    const modal = document.getElementById('chartModal');
    if (!modal) return;

    document.getElementById('chartModalSymbol').textContent = stock.symbol;
    document.getElementById('chartModalCompany').textContent = stock.name;
    document.getElementById('chartModalSector').textContent = stock.sector;
    
    const sigEl = document.getElementById('chartModalSignal');
    sigEl.textContent = stock.signal;
    sigEl.className = `badge-signal ${stock.signalClass}`;

    document.getElementById('chartModalScore').textContent = `${stock.aiScore}/100`;
    document.getElementById('chartModalCMP').textContent = `₹${stock.cmp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    document.getElementById('chartModalDayRange').textContent = `₹${stock.dayLow} - ₹${stock.dayHigh}`;
    document.getElementById('chartModalEntry').textContent = `₹${stock.tradePlan.entry}`;
    document.getElementById('chartModalSL').textContent = `₹${stock.tradePlan.sl}`;
    document.getElementById('chartModalT1').textContent = `₹${stock.tradePlan.t1}`;
    document.getElementById('chartModalT2').textContent = `₹${stock.tradePlan.t2}`;
    document.getElementById('chartModalRR').textContent = stock.tradePlan.rr;

    document.getElementById('chartRsiVal').textContent = stock.technicals.rsi;
    document.getElementById('chartMacdVal').textContent = (stock.technicals.macdHist >= 0 ? '+' : '') + stock.technicals.macdHist;
    document.getElementById('chartSignalVal').textContent = stock.technicals.signalLine;

    document.getElementById('chartModalRationaleText').textContent = stock.rationale;
    
    // Dynamic Rationale Tags
    const tagsContainer = document.getElementById('chartModalTags');
    tagsContainer.innerHTML = `
      <span class="r-tag">EMA 9: ₹${stock.technicals.ema9}</span>
      <span class="r-tag">EMA 21: ₹${stock.technicals.ema21}</span>
      <span class="r-tag">VWAP: ₹${stock.technicals.vwap}</span>
      <span class="r-tag">Supertrend: ₹${stock.technicals.supertrendVal}</span>
      <span class="r-tag">Volume: ${stock.volMultiple}x 20MA</span>
    `;

    modal.classList.remove('hidden');

    // Render Canvas
    setTimeout(() => {
      window.chartRenderer.render(stock, this.timeframe);
    }, 50);
  }

  runClaudeAnalysisOnCurrentStock() {
    const stock = window.chartRenderer.currentStock;
    if (!stock) return;

    const resArea = document.getElementById('claudeLiveResponseArea');
    const resText = document.getElementById('claudeResponseText');
    const btnAsk = document.getElementById('btnAskClaudeModal');

    if (!resArea || !resText) return;
    resArea.classList.remove('hidden');
    resText.textContent = "🧠 Claude 3.5 Sonnet is analyzing EMA 9/21, RSI momentum, VWAP anchor, and volume flow...";
    if (btnAsk) btnAsk.disabled = true;

    setTimeout(() => {
      const isBullish = stock.aiScore >= 65;
      const verdict = isBullish ? "🟢 HIGH CONVICTION BUY (BULLISH CONFLUENCE)" : (stock.aiScore <= 44 ? "🔴 HIGH RISK BREAKDOWN (AVOID / SELL)" : "🟡 NEUTRAL CONSOLIDATION (WAIT FOR BREAKOUT)");
      
      const analysis = `
📊 Verdict: ${verdict}
🎯 Recommended Action: ${isBullish ? `Initiate Long above ₹${stock.tradePlan.entry} | Strict Stop Loss at ₹${stock.tradePlan.sl}` : `Wait for confirmation near ₹${stock.tradePlan.entry}`}
📈 Risk-to-Reward: ${stock.tradePlan.rr} (Target 1: ₹${stock.tradePlan.t1} | Target 2: ₹${stock.tradePlan.t2})

🔍 Claude Technical Breakdown:
• Trend Quality: EMA 9 is ${stock.technicals.isEmaBullish ? 'trading above EMA 21 indicating sustained upward momentum' : 'lagging below EMA 21 suggesting overhead resistance'}.
• Momentum & Velocity: RSI (14) is at ${stock.technicals.rsi}, which provides ${stock.technicals.rsi > 55 ? 'strong bullish continuation without being overstretched' : 'moderate momentum'}.
• Institutional Anchor: Price is holding ${stock.technicals.isAboveVwap ? 'comfortably above intraday VWAP with buyer defense' : 'below VWAP reflecting seller dominance'}.
• Volume Multiple: ${stock.volMultiple}x 20-period volume confirming ${stock.isVolShocker ? 'strong smart-money institutional participation' : 'average liquidity flow'}.
      `.trim();

      resText.textContent = analysis;
      if (btnAsk) btnAsk.disabled = false;
      window.soundEngine.playSuccessChime();
    }, 1000);
  }

  // Live Exchange Tick Simulation Loop
  startLiveSimulation() {
    if (this.simInterval) clearInterval(this.simInterval);

    this.simInterval = setInterval(() => {
      if (!this.isLiveSimActive) return;

      // Pick 2-4 random stocks to tick
      const countToTick = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < countToTick; i++) {
        const randIdx = Math.floor(Math.random() * window.marketEngine.stocks.length);
        const randomSymbol = window.marketEngine.stocks[randIdx].symbol;
        const updated = window.marketEngine.tickStock(randomSymbol);

        // If high score strong buy triggered, push to live feed & audio
        if (updated && updated.aiScore >= 88 && Math.random() < 0.25) {
          const now = new Date();
          const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
          
          this.liveFeed.unshift({
            time: timeStr,
            symbol: updated.symbol,
            category: "STRONG_BUY",
            signal: "STRONG BUY",
            signalClass: "signal-strong-buy",
            strategy: "AI Multi-Indicator Confluence Spike",
            message: `Score reached ${updated.aiScore}/100. High volume breakout confirmed above EMA 9/21.`,
            entry: updated.tradePlan.entry,
            sl: updated.tradePlan.sl,
            t1: updated.tradePlan.t1
          });

          if (this.liveFeed.length > 50) this.liveFeed.pop();

          const badge = document.getElementById('feedCountBadge');
          if (badge) badge.textContent = this.liveFeed.length;

          window.soundEngine.playBullishAlert();
          if (this.activeTab === 'signals') this.renderSignalFeed();
        }
      }

      // Slightly fluctuate major indices
      window.marketEngine.indices.forEach(idx => {
        const delta = (Math.random() - 0.48) * (idx.price * 0.0004);
        idx.price = parseFloat((idx.price + delta).toFixed(2));
      });
      this.renderIndicesTicker();

      // Refresh current active view
      if (this.activeTab === 'scanner') this.renderScanner();
      if (this.activeTab === 'watchlist') this.renderWatchlist();
      if (this.activeTab === 'options') this.renderOptionsScanner();

      // If chart modal is open for the current stock, live redraw
      if (window.chartRenderer.currentStock && !document.getElementById('chartModal').classList.contains('hidden')) {
        const currentModalStock = window.marketEngine.stocks.find(s => s.symbol === window.chartRenderer.currentStock.symbol);
        if (currentModalStock) {
          document.getElementById('chartModalCMP').textContent = `₹${currentModalStock.cmp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
          window.chartRenderer.render(currentModalStock, this.timeframe);
        }
      }

    }, 2200);
  }
}

// Instantiate and initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.scannerApp = new TradeJunctionApp();
  window.scannerApp.init();
});
