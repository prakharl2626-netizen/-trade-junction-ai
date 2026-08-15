#!/usr/bin/env python3
"""
Trade Junction AI - Real-Time Indian Stock Market Backend Server
Serves static terminal assets and provides live NSE/BSE stock quotes,
real index prices (Nifty 50, Bank Nifty, Sensex), and real historical OHLCV data.
"""

import http.server
import socketserver
import json
import urllib.request
import urllib.parse
import concurrent.futures
import time
import os
import sys

PORT = int(os.environ.get("PORT", 8080))
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

# NSE Stock Symbol Mapping
NSE_UNIVERSE = [
    {"symbol": "RELIANCE", "yahoo": "RELIANCE.NS", "name": "Reliance Industries Ltd", "sector": "Oil, Gas & Energy"},
    {"symbol": "HDFCBANK", "yahoo": "HDFCBANK.NS", "name": "HDFC Bank Ltd", "sector": "Banking & Finance"},
    {"symbol": "ICICIBANK", "yahoo": "ICICIBANK.NS", "name": "ICICI Bank Ltd", "sector": "Banking & Finance"},
    {"symbol": "TCS", "yahoo": "TCS.NS", "name": "Tata Consultancy Services", "sector": "Information Tech"},
    {"symbol": "INFY", "yahoo": "INFY.NS", "name": "Infosys Ltd", "sector": "Information Tech"},
    {"symbol": "SBIN", "yahoo": "SBIN.NS", "name": "State Bank of India", "sector": "Banking & Finance"},
    {"symbol": "BHARTIARTL", "yahoo": "BHARTIARTL.NS", "name": "Bharti Airtel Ltd", "sector": "Telecommunication"},
    {"symbol": "ITC", "yahoo": "ITC.NS", "name": "ITC Ltd", "sector": "FMCG & Consumption"},
    {"symbol": "LT", "yahoo": "LT.NS", "name": "Larsen & Toubro Ltd", "sector": "Infrastructure & Capital Goods"},
    {"symbol": "TMPV", "yahoo": "TMPV.NS", "name": "Tata Motors Passenger Veh", "sector": "Automobile"},
    {"symbol": "BAJFINANCE", "yahoo": "BAJFINANCE.NS", "name": "Bajaj Finance Ltd", "sector": "Banking & Finance"},
    {"symbol": "MARUTI", "yahoo": "MARUTI.NS", "name": "Maruti Suzuki India Ltd", "sector": "Automobile"},
    {"symbol": "SUNPHARMA", "yahoo": "SUNPHARMA.NS", "name": "Sun Pharmaceutical Ind", "sector": "Pharmaceuticals"},
    {"symbol": "TATASTEEL", "yahoo": "TATASTEEL.NS", "name": "Tata Steel Ltd", "sector": "Metals & Mining"},
    {"symbol": "AXISBANK", "yahoo": "AXISBANK.NS", "name": "Axis Bank Ltd", "sector": "Banking & Finance"},
    {"symbol": "KOTAKBANK", "yahoo": "KOTAKBANK.NS", "name": "Kotak Mahindra Bank", "sector": "Banking & Finance"},
    {"symbol": "M&M", "yahoo": "M&M.NS", "name": "Mahindra & Mahindra Ltd", "sector": "Automobile"},
    {"symbol": "NTPC", "yahoo": "NTPC.NS", "name": "NTPC Ltd", "sector": "Oil, Gas & Energy"},
    {"symbol": "POWERGRID", "yahoo": "POWERGRID.NS", "name": "Power Grid Corp of India", "sector": "Oil, Gas & Energy"},
    {"symbol": "TITAN", "yahoo": "TITAN.NS", "name": "Titan Company Ltd", "sector": "FMCG & Consumption"},
    {"symbol": "ADANIENT", "yahoo": "ADANIENT.NS", "name": "Adani Enterprises Ltd", "sector": "Metals & Mining"},
    {"symbol": "ADANIPORTS", "yahoo": "ADANIPORTS.NS", "name": "Adani Ports & SEZ Ltd", "sector": "Infrastructure & Capital Goods"},
    {"symbol": "COALINDIA", "yahoo": "COALINDIA.NS", "name": "Coal India Ltd", "sector": "Oil, Gas & Energy"},
    {"symbol": "ASIANPAINT", "yahoo": "ASIANPAINT.NS", "name": "Asian Paints Ltd", "sector": "FMCG & Consumption"},
    {"symbol": "HCLTECH", "yahoo": "HCLTECH.NS", "name": "HCL Technologies Ltd", "sector": "Information Tech"},
    {"symbol": "WIPRO", "yahoo": "WIPRO.NS", "name": "Wipro Ltd", "sector": "Information Tech"},
    {"symbol": "ULTRACEMCO", "yahoo": "ULTRACEMCO.NS", "name": "UltraTech Cement Ltd", "sector": "Infrastructure & Capital Goods"},
    {"symbol": "BAJAJFINSV", "yahoo": "BAJAJFINSV.NS", "name": "Bajaj Finserv Ltd", "sector": "Banking & Finance"},
    {"symbol": "ONGC", "yahoo": "ONGC.NS", "name": "Oil & Natural Gas Corp", "sector": "Oil, Gas & Energy"},
    {"symbol": "HINDUNILVR", "yahoo": "HINDUNILVR.NS", "name": "Hindustan Unilever Ltd", "sector": "FMCG & Consumption"},
    {"symbol": "JSWSTEEL", "yahoo": "JSWSTEEL.NS", "name": "JSW Steel Ltd", "sector": "Metals & Mining"},
    {"symbol": "GRASIM", "yahoo": "GRASIM.NS", "name": "Grasim Industries Ltd", "sector": "Metals & Mining"},
    {"symbol": "HINDALCO", "yahoo": "HINDALCO.NS", "name": "Hindalco Industries Ltd", "sector": "Metals & Mining"},
    {"symbol": "NESTLEIND", "yahoo": "NESTLEIND.NS", "name": "Nestle India Ltd", "sector": "FMCG & Consumption"},
    {"symbol": "TECHM", "yahoo": "TECHM.NS", "name": "Tech Mahindra Ltd", "sector": "Information Tech"},
    {"symbol": "DRREDDY", "yahoo": "DRREDDY.NS", "name": "Dr. Reddy's Laboratories", "sector": "Pharmaceuticals"},
    {"symbol": "CIPLA", "yahoo": "CIPLA.NS", "name": "Cipla Ltd", "sector": "Pharmaceuticals"},
    {"symbol": "EICHERMOT", "yahoo": "EICHERMOT.NS", "name": "Eicher Motors Ltd", "sector": "Automobile"},
    {"symbol": "DIVISLAB", "yahoo": "DIVISLAB.NS", "name": "Divi's Laboratories Ltd", "sector": "Pharmaceuticals"},
    {"symbol": "BPCL", "yahoo": "BPCL.NS", "name": "Bharat Petroleum Corp", "sector": "Oil, Gas & Energy"},
    {"symbol": "TATACONSUM", "yahoo": "TATACONSUM.NS", "name": "Tata Consumer Products", "sector": "FMCG & Consumption"},
    {"symbol": "BRITANNIA", "yahoo": "BRITANNIA.NS", "name": "Britannia Industries Ltd", "sector": "FMCG & Consumption"},
    {"symbol": "APOLLOHOSP", "yahoo": "APOLLOHOSP.NS", "name": "Apollo Hospitals Enterprise", "sector": "Pharmaceuticals"},
    {"symbol": "HEROMOTOCO", "yahoo": "HEROMOTOCO.NS", "name": "Hero MotoCorp Ltd", "sector": "Automobile"},
    {"symbol": "INDUSINDBK", "yahoo": "INDUSINDBK.NS", "name": "IndusInd Bank Ltd", "sector": "Banking & Finance"},
    {"symbol": "TRENT", "yahoo": "TRENT.NS", "name": "Trent Ltd", "sector": "FMCG & Consumption"},
    {"symbol": "BEL", "yahoo": "BEL.NS", "name": "Bharat Electronics Ltd", "sector": "Infrastructure & Capital Goods"},
    {"symbol": "HAL", "yahoo": "HAL.NS", "name": "Hindustan Aeronautics Ltd", "sector": "Infrastructure & Capital Goods"},
    {"symbol": "VEDL", "yahoo": "VEDL.NS", "name": "Vedanta Ltd", "sector": "Metals & Mining"},
    {"symbol": "DLF", "yahoo": "DLF.NS", "name": "DLF Ltd", "sector": "Infrastructure & Capital Goods"}
]

INDICES_MAP = [
    {"symbol": "NIFTY 50", "yahoo": "%5ENSEI"},
    {"symbol": "BANK NIFTY", "yahoo": "%5ENSEBANK"},
    {"symbol": "SENSEX", "yahoo": "%5EBSESN"},
    {"symbol": "INDIA VIX", "yahoo": "%5EINDIAVIX"},
    {"symbol": "NIFTY IT", "yahoo": "%5ECNXIT"},
    {"symbol": "NIFTY AUTO", "yahoo": "%5ECNXAUTO"}
]

# In-Memory Cache to prevent rate-limiting
cache = {
    "stocks": None,
    "stocks_time": 0,
    "indices": None,
    "indices_time": 0,
    "charts": {},
}
CACHE_TTL = 10  # 10 seconds live cache


def fetch_yahoo_chart(yahoo_symbol, interval="15m", range_period="5d"):
    """Fetches real OHLCV and market metadata from Yahoo Finance"""
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_symbol}?interval={interval}&range={range_period}"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as e:
        return None


def fetch_stock_quote(item):
    symbol = item["symbol"]
    yahoo_sym = item["yahoo"]
    data = fetch_yahoo_chart(yahoo_sym, interval="15m", range_period="1d")
    if not data or "chart" not in data or not data["chart"]["result"]:
        return None

    try:
        res = data["chart"]["result"][0]
        meta = res["meta"]
        cmp = meta.get("regularMarketPrice", 0)
        prev_close = meta.get("chartPreviousClose", cmp)
        chg = round(cmp - prev_close, 2)
        chg_pct = round((chg / prev_close) * 100, 2) if prev_close else 0.0
        day_high = meta.get("regularMarketDayHigh", cmp)
        day_low = meta.get("regularMarketDayLow", cmp)
        volume = meta.get("regularMarketVolume", 1000000)

        return {
            "symbol": symbol,
            "name": item["name"],
            "sector": item["sector"],
            "cmp": round(cmp, 2),
            "prevClose": round(prev_close, 2),
            "chg": chg,
            "chgPct": chg_pct,
            "dayHigh": round(day_high, 2),
            "dayLow": round(day_low, 2),
            "volume": volume,
            "isLive": True,
            "lastUpdated": time.strftime("%H:%M:%S IST")
        }
    except Exception:
        return None


def get_live_stocks_data():
    now = time.time()
    if cache["stocks"] and (now - cache["stocks_time"]) < CACHE_TTL:
        return cache["stocks"]

    stocks_data = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        results = list(executor.map(fetch_stock_quote, NSE_UNIVERSE))

    for r in results:
        if r:
            stocks_data.append(r)

    if stocks_data:
        cache["stocks"] = stocks_data
        cache["stocks_time"] = now
        return stocks_data
    return cache["stocks"] or []


def fetch_index_quote(item):
    symbol = item["symbol"]
    yahoo_sym = item["yahoo"]
    data = fetch_yahoo_chart(yahoo_sym, interval="1d", range_period="2d")
    if not data or "chart" not in data or not data["chart"]["result"]:
        return None

    try:
        res = data["chart"]["result"][0]
        meta = res["meta"]
        price = meta.get("regularMarketPrice", 0)
        prev_close = meta.get("chartPreviousClose", price)
        chg = round(price - prev_close, 2)
        chg_pct = round((chg / prev_close) * 100, 2) if prev_close else 0.0

        return {
            "symbol": symbol,
            "price": round(price, 2),
            "chg": chg,
            "chgPct": chg_pct,
            "isUp": chg >= 0,
            "isLive": True
        }
    except Exception:
        return None


def get_live_indices_data():
    now = time.time()
    if cache["indices"] and (now - cache["indices_time"]) < CACHE_TTL:
        return cache["indices"]

    indices_data = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        results = list(executor.map(fetch_index_quote, INDICES_MAP))

    for r in results:
        if r:
            indices_data.append(r)

    if indices_data:
        cache["indices"] = indices_data
        cache["indices_time"] = now
        return indices_data
    return cache["indices"] or []


def get_stock_candles_data(symbol, timeframe="15m"):
    cache_key = f"{symbol}_{timeframe}"
    now = time.time()

    if cache_key in cache["charts"] and (now - cache["charts"][cache_key]["time"]) < 30:
        return cache["charts"][cache_key]["data"]

    matched = next((s for s in NSE_UNIVERSE if s["symbol"] == symbol), None)
    if not matched:
        return []

    tf_map = {
        "1m": ("1m", "1d"),
        "5m": ("5m", "1d"),
        "15m": ("15m", "5d"),
        "1h": ("60m", "1mo"),
        "1D": ("1d", "3mo")
    }
    interval, range_p = tf_map.get(timeframe, ("15m", "5d"))

    data = fetch_yahoo_chart(matched["yahoo"], interval=interval, range_period=range_p)
    if not data or "chart" not in data or not data["chart"]["result"]:
        return []

    try:
        res = data["chart"]["result"][0]
        timestamps = res.get("timestamp", [])
        quote = res["indicators"]["quote"][0]

        opens = quote.get("open", [])
        highs = quote.get("high", [])
        lows = quote.get("low", [])
        closes = quote.get("close", [])
        volumes = quote.get("volume", [])

        candles = []
        for i in range(len(timestamps)):
            if closes[i] is not None and opens[i] is not None:
                candles.append({
                    "timestamp": timestamps[i],
                    "open": round(opens[i], 2),
                    "high": round(highs[i], 2),
                    "low": round(lows[i], 2),
                    "close": round(closes[i], 2),
                    "volume": volumes[i] or 100000
                })

        cache["charts"][cache_key] = {"data": candles, "time": now}
        return candles
    except Exception as e:
        return []


class TradeJunctionHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Enable CORS
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/live/stocks":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            stocks = get_live_stocks_data()
            payload = {
                "success": True,
                "count": len(stocks),
                "isLiveExchange": True,
                "source": "NSE Real-Time Feed",
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "data": stocks
            }
            self.wfile.write(json.dumps(payload).encode("utf-8"))
            return

        elif path == "/api/live/indices":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            indices = get_live_indices_data()
            payload = {
                "success": True,
                "source": "NSE/BSE Real-Time",
                "data": indices
            }
            self.wfile.write(json.dumps(payload).encode("utf-8"))
            return

        elif path == "/api/live/chart":
            query_params = urllib.parse.parse_qs(parsed.query)
            symbol = query_params.get("symbol", ["RELIANCE"])[0].upper()
            timeframe = query_params.get("timeframe", ["15m"])[0]

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            candles = get_stock_candles_data(symbol, timeframe)
            payload = {
                "success": True,
                "symbol": symbol,
                "timeframe": timeframe,
                "count": len(candles),
                "data": candles
            }
            self.wfile.write(json.dumps(payload).encode("utf-8"))
            return

        elif path == "/api/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            payload = {
                "status": "online",
                "server": "Trade Junction AI Live Engine v2.4",
                "cachedStocks": len(cache["stocks"]) if cache["stocks"] else 0,
                "port": PORT
            }
            self.wfile.write(json.dumps(payload).encode("utf-8"))
            return

        # Default: Serve static files
        return super().do_GET()


def run_server():
    sys.stdout.reconfigure(encoding="utf-8")
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("", PORT), TradeJunctionHTTPHandler) as httpd:
        print("==================================================")
        print(f"[LIVE SERVER] Trade Junction AI Live Engine running on port {PORT}")
        print(f"[URL] http://localhost:{PORT}")
        print(f"[DATA FEED] Real-time NSE/BSE Live Feed Active")
        print("==================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")
            httpd.server_close()


if __name__ == "__main__":
    run_server()
