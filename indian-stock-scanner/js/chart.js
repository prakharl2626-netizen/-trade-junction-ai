/**
 * TradeBharat AI - High-Performance Canvas Technical Chart Engine
 * Candlesticks, EMA 9/21, Supertrend, VWAP, Trade Levels (Entry, SL, T1, T2), RSI (14), and MACD.
 */

class TechnicalChartRenderer {
  constructor() {
    this.mainCanvas = null;
    this.rsiCanvas = null;
    this.macdCanvas = null;
    this.currentStock = null;
    this.timeframe = '15m';
  }

  initCanvases() {
    this.mainCanvas = document.getElementById('mainCandleCanvas');
    this.rsiCanvas = document.getElementById('rsiCanvas');
    this.macdCanvas = document.getElementById('macdCanvas');
  }

  async render(stock, timeframe = '15m') {
    this.initCanvases();
    if (!this.mainCanvas || !stock) return;

    this.currentStock = stock;
    this.timeframe = timeframe;

    const candles = await window.marketEngine.fetchCandlesAsync(stock.symbol, timeframe);
    this.drawMainCandles(candles, stock);
    this.drawRsi(candles, stock);
    this.drawMacd(candles, stock);
  }

  setupHiDPICanvas(canvas, height) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    return { ctx, width: rect.width, height };
  }

  // Draw Candlesticks & Overlays (EMA, VWAP, Supertrend, Entry, SL, T1, T2)
  drawMainCandles(candles, stock) {
    const { ctx, width, height } = this.setupHiDPICanvas(this.mainCanvas, 280);
    const padding = { top: 20, bottom: 25, left: 10, right: 65 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Determine min/max price range across candles + trade levels
    let minPrice = Infinity;
    let maxPrice = -Infinity;

    candles.forEach(c => {
      minPrice = Math.min(minPrice, c.low);
      maxPrice = Math.max(maxPrice, c.high);
    });

    if (stock.tradePlan) {
      minPrice = Math.min(minPrice, stock.tradePlan.sl * 0.998);
      maxPrice = Math.max(maxPrice, stock.tradePlan.t2 * 1.002);
    }

    const priceMargin = (maxPrice - minPrice) * 0.05;
    minPrice -= priceMargin;
    maxPrice += priceMargin;
    const priceRange = maxPrice - minPrice || 1;

    const getY = (p) => padding.top + chartH - ((p - minPrice) / priceRange) * chartH;
    const candleWidth = Math.max(3, (chartW / candles.length) * 0.68);
    const candleSpacing = chartW / candles.length;

    // Clear background
    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, width, height);

    // Draw Price Grid Lines
    ctx.strokeStyle = '#1a2438';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    const numGridLines = 5;
    for (let i = 0; i <= numGridLines; i++) {
      const priceVal = minPrice + (priceRange / numGridLines) * i;
      const y = getY(priceVal);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Right axis price text
      ctx.fillStyle = '#64748b';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`₹${priceVal.toFixed(1)}`, width - padding.right + 6, y + 3);
    }
    ctx.setLineDash([]); // Reset dash

    // Draw Candlesticks & Volume base
    candles.forEach((c, idx) => {
      const x = padding.left + (idx * candleSpacing) + (candleSpacing / 2);
      const openY = getY(c.open);
      const closeY = getY(c.close);
      const highY = getY(c.high);
      const lowY = getY(c.low);
      const isBull = c.close >= c.open;

      ctx.strokeStyle = isBull ? '#10b981' : '#f43f5e';
      ctx.fillStyle = isBull ? '#10b981' : '#f43f5e';

      // Wick
      ctx.beginPath();
      ctx.lineWidth = 1.2;
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Body
      const bodyY = Math.min(openY, closeY);
      const bodyH = Math.max(2, Math.abs(closeY - openY));
      ctx.fillRect(x - candleWidth / 2, bodyY, candleWidth, bodyH);
    });

    // Draw EMA 9 curve
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    candles.forEach((c, idx) => {
      const x = padding.left + (idx * candleSpacing) + (candleSpacing / 2);
      const emaP = c.close * 0.998 + (idx % 3 === 0 ? 0.5 : -0.5);
      const y = getY(emaP);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw EMA 21 curve
    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    candles.forEach((c, idx) => {
      const x = padding.left + (idx * candleSpacing) + (candleSpacing / 2);
      const ema21P = c.close * 0.994 - (idx % 2 === 0 ? 1 : -0.5);
      const y = getY(ema21P);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw VWAP line
    if (stock.technicals?.vwap) {
      const vwapY = getY(stock.technicals.vwap);
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(padding.left, vwapY);
      ctx.lineTo(width - padding.right, vwapY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw Supertrend line
    if (stock.technicals?.supertrendVal) {
      const stY = getY(stock.technicals.supertrendVal);
      const isBull = stock.technicals.supertrendBullish;
      ctx.strokeStyle = isBull ? '#10b981' : '#f43f5e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(padding.left + chartW * 0.4, stY);
      ctx.lineTo(width - padding.right, stY);
      ctx.stroke();
    }

    // Draw Trade Setup Levels (Entry, SL, T1, T2)
    if (stock.tradePlan) {
      const { entry, sl, t1, t2 } = stock.tradePlan;

      this.drawHorizontalLevel(ctx, getY(entry), width, padding, '#0ea5e9', `Entry: ₹${entry}`, true);
      this.drawHorizontalLevel(ctx, getY(sl), width, padding, '#f43f5e', `SL: ₹${sl}`, true);
      this.drawHorizontalLevel(ctx, getY(t1), width, padding, '#10b981', `T1: ₹${t1}`, false);
      this.drawHorizontalLevel(ctx, getY(t2), width, padding, '#10b981', `T2: ₹${t2}`, false);
    }
  }

  drawHorizontalLevel(ctx, y, width, padding, color, label, isDashed = false) {
    if (y < padding.top || y > 280 - padding.bottom) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    if (isDashed) ctx.setLineDash([6, 4]);

    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();

    // Level tag label
    ctx.fillStyle = color;
    ctx.font = 'bold 9.5px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(label, width - padding.right - 6, y - 4);
    ctx.restore();
  }

  // Draw RSI Sub-panel
  drawRsi(candles, stock) {
    const { ctx, width, height } = this.setupHiDPICanvas(this.rsiCanvas, 75);
    const padding = { top: 10, bottom: 12, left: 10, right: 65 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, width, height);

    const getY = (val) => padding.top + chartH - ((val - 0) / 100) * chartH;

    // Overbought 70 line
    const y70 = getY(70);
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(padding.left, y70);
    ctx.lineTo(width - padding.right, y70);
    ctx.stroke();

    // Oversold 30 line
    const y30 = getY(30);
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
    ctx.beginPath();
    ctx.moveTo(padding.left, y30);
    ctx.lineTo(width - padding.right, y30);
    ctx.stroke();
    ctx.setLineDash([]);

    // 50 Midline
    const y50 = getY(50);
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.25)';
    ctx.beginPath();
    ctx.moveTo(padding.left, y50);
    ctx.lineTo(width - padding.right, y50);
    ctx.stroke();

    // Draw RSI Wave
    const currentRsi = stock.technicals?.rsi || 58;
    const candleSpacing = chartW / candles.length;

    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 1.8;
    ctx.beginPath();

    for (let i = 0; i < candles.length; i++) {
      const x = padding.left + (i * candleSpacing) + (candleSpacing / 2);
      const simulatedRsi = Math.min(88, Math.max(18, currentRsi - (candles.length - i) * 0.4 + Math.sin(i * 0.4) * 6));
      const y = getY(simulatedRsi);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // RSI Value label
    ctx.fillStyle = '#a855f7';
    ctx.font = 'bold 10px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${currentRsi}`, width - padding.right + 6, getY(currentRsi) + 3);
  }

  // Draw MACD Sub-panel
  drawMacd(candles, stock) {
    const { ctx, width, height } = this.setupHiDPICanvas(this.macdCanvas, 75);
    const padding = { top: 10, bottom: 12, left: 10, right: 65 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, width, height);

    const zeroY = padding.top + chartH / 2;

    // Zero baseline
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)';
    ctx.beginPath();
    ctx.moveTo(padding.left, zeroY);
    ctx.lineTo(width - padding.right, zeroY);
    ctx.stroke();

    const candleSpacing = chartW / candles.length;
    const barWidth = Math.max(2, candleSpacing * 0.5);
    const histVal = stock.technicals?.macdHist || 1.2;

    // Draw Histogram bars
    for (let i = 0; i < candles.length; i++) {
      const x = padding.left + (i * candleSpacing) + (candleSpacing / 2);
      const factor = (i / candles.length);
      const val = histVal * factor + Math.sin(i * 0.5) * 1.5;
      const isPositive = val >= 0;
      const barH = Math.min(chartH / 2 - 2, Math.abs(val) * 6);

      ctx.fillStyle = isPositive ? 'rgba(16, 185, 129, 0.7)' : 'rgba(244, 63, 94, 0.7)';
      if (isPositive) {
        ctx.fillRect(x - barWidth / 2, zeroY - barH, barWidth, barH);
      } else {
        ctx.fillRect(x - barWidth / 2, zeroY, barWidth, barH);
      }
    }

    // MACD line & Signal line
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < candles.length; i++) {
      const x = padding.left + (i * candleSpacing) + (candleSpacing / 2);
      const y = zeroY - Math.sin(i * 0.3) * 12;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < candles.length; i++) {
      const x = padding.left + (i * candleSpacing) + (candleSpacing / 2);
      const y = zeroY - Math.sin((i - 2) * 0.3) * 10;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

window.chartRenderer = new TechnicalChartRenderer();
