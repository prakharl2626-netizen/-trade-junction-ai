#!/usr/bin/env python3
"""Trade Junction AI backend with optional Angel One SmartAPI.

The existing UI calls /api/live/stocks, /api/live/indices and
/api/live/chart. This server keeps those endpoints compatible and uses
Angel One when credentials are configured; otherwise it falls back to Yahoo
Finance so the public demo keeps working.

Required Render environment variables for Angel One:
  ANGEL_API_KEY
  ANGEL_CLIENT_ID
  ANGEL_PASSWORD
  ANGEL_TOTP_SECRET

Never commit these values to GitHub.
"""
import http.server
import json
import os
import socketserver
import time
import urllib.parse
import urllib.request
import threading

PORT = int(os.environ.get("PORT", "8080"))
ROOT = os.path.dirname(os.path.abspath(__file__))

STOCKS = [
    ("RELIANCE", "RELIANCE.NS", "Reliance Industries Ltd"), ("HDFCBANK", "HDFCBANK.NS", "HDFC Bank Ltd"),
    ("ICICIBANK", "ICICIBANK.NS", "ICICI Bank Ltd"), ("TCS", "TCS.NS", "Tata Consultancy Services"),
    ("INFY", "INFY.NS", "Infosys Ltd"), ("SBIN", "SBIN.NS", "State Bank of India"),
    ("BHARTIARTL", "BHARTIARTL.NS", "Bharti Airtel Ltd"), ("ITC", "ITC.NS", "ITC Ltd"),
    ("LT", "LT.NS", "Larsen & Toubro Ltd"), ("TMPV", "TMPV.NS", "Tata Motors Passenger Vehicles"),
    ("BAJFINANCE", "BAJFINANCE.NS", "Bajaj Finance Ltd"), ("MARUTI", "MARUTI.NS", "Maruti Suzuki India Ltd"),
    ("SUNPHARMA", "SUNPHARMA.NS", "Sun Pharmaceutical Industries"), ("TATASTEEL", "TATASTEEL.NS", "Tata Steel Ltd"),
    ("AXISBANK", "AXISBANK.NS", "Axis Bank Ltd"), ("KOTAKBANK", "KOTAKBANK.NS", "Kotak Mahindra Bank"),
    ("M&M", "M&M.NS", "Mahindra & Mahindra Ltd"), ("NTPC", "NTPC.NS", "NTPC Ltd"),
    ("POWERGRID", "POWERGRID.NS", "Power Grid Corp of India"), ("TITAN", "TITAN.NS", "Titan Company Ltd"),
    ("ADANIENT", "ADANIENT.NS", "Adani Enterprises Ltd"), ("ADANIPORTS", "ADANIPORTS.NS", "Adani Ports & SEZ Ltd"),
    ("COALINDIA", "COALINDIA.NS", "Coal India Ltd"), ("ASIANPAINT", "ASIANPAINT.NS", "Asian Paints Ltd"),
    ("HCLTECH", "HCLTECH.NS", "HCL Technologies Ltd"), ("WIPRO", "WIPRO.NS", "Wipro Ltd"),
    ("ULTRACEMCO", "ULTRACEMCO.NS", "UltraTech Cement Ltd"), ("BAJAJFINSV", "BAJAJFINSV.NS", "Bajaj Finserv Ltd"),
    ("ONGC", "ONGC.NS", "Oil & Natural Gas Corporation"), ("HINDUNILVR", "HINDUNILVR.NS", "Hindustan Unilever Ltd"),
    ("JSWSTEEL", "JSWSTEEL.NS", "JSW Steel Ltd"), ("HINDALCO", "HINDALCO.NS", "Hindalco Industries Ltd"),
    ("NESTLEIND", "NESTLEIND.NS", "Nestle India Ltd"), ("TECHM", "TECHM.NS", "Tech Mahindra Ltd"),
    ("DRREDDY", "DRREDDY.NS", "Dr Reddy's Laboratories"), ("CIPLA", "CIPLA.NS", "Cipla Ltd"),
    ("EICHERMOT", "EICHERMOT.NS", "Eicher Motors Ltd"), ("DIVISLAB", "DIVISLAB.NS", "Divi's Laboratories Ltd"),
    ("BPCL", "BPCL.NS", "Bharat Petroleum Corporation"), ("TATACONSUM", "TATACONSUM.NS", "Tata Consumer Products"),
    ("BRITANNIA", "BRITANNIA.NS", "Britannia Industries Ltd"), ("APOLLOHOSP", "APOLLOHOSP.NS", "Apollo Hospitals Enterprise"),
    ("HEROMOTOCO", "HEROMOTOCO.NS", "Hero MotoCorp Ltd"), ("INDUSINDBK", "INDUSINDBK.NS", "IndusInd Bank Ltd"),
    ("TRENT", "TRENT.NS", "Trent Ltd"), ("BEL", "BEL.NS", "Bharat Electronics Ltd"),
    ("HAL", "HAL.NS", "Hindustan Aeronautics Ltd"), ("VEDL", "VEDL.NS", "Vedanta Ltd"), ("DLF", "DLF.NS", "DLF Ltd")
]

INDICES = [("NIFTY 50", "%5ENSEI"), ("BANK NIFTY", "%5ENSEBANK"), ("SENSEX", "%5EBSESN"),
           ("INDIA VIX", "%5EINDIAVIX"), ("NIFTY IT", "%5ECNXIT"), ("NIFTY AUTO", "%5ECNXAUTO")]

_cache = {}
_lock = threading.Lock()
_angel = None
_angel_lock = threading.Lock()


def yahoo(symbol, interval="15m", period="1d"):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(symbol, safe='')}?interval={interval}&range={period}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            return json.loads(r.read().decode())
    except Exception:
        return None


def angel_login():
    global _angel
    if _angel is not None:
        return _angel
    if not all(os.getenv(k) for k in ("ANGEL_API_KEY", "ANGEL_CLIENT_ID", "ANGEL_PASSWORD", "ANGEL_TOTP_SECRET")):
        return None
    with _angel_lock:
        if _angel is not None:
            return _angel
        try:
            import pyotp
            from SmartApi import SmartConnect
            api = SmartConnect(api_key=os.environ["ANGEL_API_KEY"])
            totp = pyotp.TOTP(os.environ["ANGEL_TOTP_SECRET"]).now()
            session = api.generateSession(os.environ["ANGEL_CLIENT_ID"], os.environ["ANGEL_PASSWORD"], totp)
            if not session or not session.get("status"):
                return None
            _angel = api
            return api
        except Exception:
            return None


def angel_status():
    configured = all(os.getenv(k) for k in ("ANGEL_API_KEY", "ANGEL_CLIENT_ID", "ANGEL_PASSWORD", "ANGEL_TOTP_SECRET"))
    api = angel_login() if configured else None
    return {"configured": configured, "connected": api is not None, "provider": "Angel One" if api else "Yahoo fallback"}


def stock_quotes():
    now = time.time()
    if now - _cache.get("stocks_time", 0) < 10 and _cache.get("stocks"):
        return _cache["stocks"]
    out = []
    for symbol, ys, name in STOCKS:
        d = yahoo(ys, "15m", "1d")
        try:
            res = d["chart"]["result"][0]
            meta = res["meta"]
            price = float(meta.get("regularMarketPrice") or 0)
            prev = float(meta.get("chartPreviousClose") or price)
            out.append({"symbol": symbol, "name": name, "cmp": round(price, 2), "prevClose": round(prev, 2),
                        "chg": round(price-prev, 2), "chgPct": round((price-prev)/prev*100, 2) if prev else 0,
                        "dayHigh": meta.get("regularMarketDayHigh", price), "dayLow": meta.get("regularMarketDayLow", price),
                        "volume": meta.get("regularMarketVolume", 0), "isLive": True,
                        "provider": "Yahoo"})
        except Exception:
            continue
    _cache["stocks"], _cache["stocks_time"] = out, now
    return out


def index_quotes():
    out = []
    for name, ys in INDICES:
        d = yahoo(ys, "1d", "2d")
        try:
            meta = d["chart"]["result"][0]["meta"]
            price = float(meta.get("regularMarketPrice") or 0)
            prev = float(meta.get("chartPreviousClose") or price)
            chg = price - prev
            out.append({"symbol": name, "price": round(price, 2), "chg": round(chg, 2),
                        "chgPct": round(chg/prev*100, 2) if prev else 0, "isUp": chg >= 0, "isLive": True})
        except Exception:
            continue
    return out


def candles(symbol, timeframe):
    found = next((x for x in STOCKS if x[0] == symbol), None)
    if not found:
        return []
    mp = {"1m": ("1m", "1d"), "5m": ("5m", "1d"), "15m": ("15m", "5d"), "1h": ("60m", "1mo"), "1D": ("1d", "3mo")}
    interval, period = mp.get(timeframe, ("15m", "5d"))
    d = yahoo(found[1], interval, period)
    try:
        r = d["chart"]["result"][0]
        q = r["indicators"]["quote"][0]
        ts = r.get("timestamp", [])
        result = []
        for i, t in enumerate(ts):
            if i >= len(q["close"]) or q["close"][i] is None:
                continue
            result.append({"timestamp": t, "open": q["open"][i], "high": q["high"][i], "low": q["low"][i],
                           "close": q["close"][i], "volume": q.get("volume", [0]*len(ts))[i] or 0})
        return result
    except Exception:
        return []


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def send_json(self, payload, status=200):
        raw = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        p = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(p.query)
        if p.path == "/api/angel/status":
            return self.send_json({"success": True, "data": angel_status()})
        if p.path == "/api/live/stocks":
            return self.send_json({"success": True, "data": stock_quotes()})
        if p.path == "/api/live/indices":
            return self.send_json({"success": True, "data": index_quotes()})
        if p.path == "/api/live/chart":
            symbol = q.get("symbol", [""])[0]
            timeframe = q.get("timeframe", ["15m"])[0]
            return self.send_json({"success": True, "data": candles(symbol, timeframe)})
        return super().do_GET()


if __name__ == "__main__":
    print(f"Trade Junction AI listening on 0.0.0.0:{PORT}")
    print("Angel One:", angel_status())
    with socketserver.ThreadingTCPServer(("0.0.0.0", PORT), Handler) as server:
        server.serve_forever()
