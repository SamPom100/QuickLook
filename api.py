import sys
import os
import json
import time
import requests
import yfinance as yf
import pandas as pd
import numpy as np
from flask import Flask, jsonify
from flask_cors import CORS
from data.data_service import FinancialDataService
from data.cache_manager import CacheManager

# Ensure immediate unbuffered terminal output
sys.stdout.reconfigure(line_buffering=True)

app = Flask(__name__)
CORS(app)

service = FinancialDataService()
cm = CacheManager()


def get_shares_outstanding(ticker: str, latest_price: float = 0.0) -> float:
    try:
        # Check company_info cache first (populated during valuation history / overview fetch)
        c_info = cm.get_company_info(ticker)
        if c_info and c_info.get("shares_outstanding"):
            shares = float(c_info["shares_outstanding"])
            mc = float(c_info.get("market_cap") or 0.0)
            if mc > 0 and latest_price > 0:
                implied_shares = mc / latest_price
                if implied_shares > shares * 1.2:
                    return implied_shares
            if shares > 0:
                return shares

        url = f'https://www.alphavantage.co/query?function=OVERVIEW&symbol={ticker.upper()}&apikey=YOUR_ALPHA_KEY_0'
        cached = cm.get_url_cache(url)
        if cached and isinstance(cached, dict) and "MarketCapitalization" in cached:
            print(f"  ⚡ [CACHE HIT] Alpha Vantage: Shares Outstanding / Overview ({ticker.upper()})")
            overview = cached
        else:
            print(f"  🌐 [LIVE API CALL] Alpha Vantage: Shares Outstanding / Overview ({ticker.upper()})")
            resp = requests.get(url, timeout=10)
            overview = resp.json()
            if isinstance(overview, dict) and "Information" not in overview and "Note" not in overview:
                cm.save_url_cache(url, overview)
                print(f"  💾 [CACHE SAVED] Alpha Vantage: Shares Outstanding / Overview ({ticker.upper()})")
        
        mc = float(overview.get('MarketCapitalization', 0)) if isinstance(overview, dict) else 0.0
        shares = float(overview.get('SharesOutstanding', 0)) if isinstance(overview, dict) else 0.0

        if mc > 0 and latest_price > 0:
            implied_shares = mc / latest_price
            if implied_shares > shares * 1.2:  # Multi-class share structure detected!
                return implied_shares
            return shares if shares > 0 else implied_shares
        
        if shares > 0:
            return shares
            
        overview_obj = service.get_company_summary(ticker)
        yf_mc = overview_obj.market_cap if overview_obj else None
        yf_shares = float(overview_obj.shares_outstanding or 0) if overview_obj else 0.0
        if yf_mc and latest_price > 0:
            return float(yf_mc / latest_price)
        return yf_shares if yf_shares > 0 else 1e9
    except Exception:
        return 1e9


from concurrent.futures import ThreadPoolExecutor

@app.route("/api/data/<ticker>")
def get_data(ticker):
    ticker = ticker.upper()
    print(f"\n📥 [API REQUEST] GET /api/data/{ticker}")

    analysis = None
    val_df = None
    
    # Run financial statement analysis and price valuation history concurrently in parallel
    for attempt in range(2):
        try:
            with ThreadPoolExecutor(max_workers=2) as executor:
                f_analysis = executor.submit(service.get_financial_analysis, ticker, "quarterly")
                f_val = executor.submit(service.get_valuation_history, ticker, "10y")
                analysis = f_analysis.result()
                val_df = f_val.result()
            if analysis and len(analysis) > 0:
                break
        except Exception as e:
            if attempt == 1:
                return jsonify({"error": str(e)}), 500
        time.sleep(0.5)

    if not analysis or len(analysis) == 0:
        print(f"  ⏳ [THROTTLED] API returned 429 rate limit error for {ticker}")
        return jsonify({
            "error": f"Alpha Vantage free-tier rate limit reached (5 requests/minute). Please wait 15 seconds and click Retry.",
            "isThrottled": True,
            "retryAfter": 15
        }), 429

    df = pd.DataFrame(analysis)
    df["dt"] = pd.to_datetime(df["period_end_date"]).dt.tz_localize(None)
    df = df.sort_values("dt").reset_index(drop=True)

    # Extract raw numeric values
    rev_raw = pd.to_numeric(df["revenue"], errors="coerce").fillna(0).values
    gp_raw = pd.to_numeric(df["gross_profit"], errors="coerce").fillna(0).values
    op_raw = pd.to_numeric(df["operating_income"], errors="coerce").fillna(0).values
    ni_raw = pd.to_numeric(df["net_income"], errors="coerce").fillna(0).values
    fcf_raw = pd.to_numeric(df.get("free_cash_flow", 0), errors="coerce").fillna(0).values

    # Determine scale unit based on max value ($B, $M, or $)
    max_val = max(
        np.max(np.abs(rev_raw)) if len(rev_raw) > 0 else 0,
        np.max(np.abs(fcf_raw)) if len(fcf_raw) > 0 else 0,
        np.max(np.abs(ni_raw)) if len(ni_raw) > 0 else 0
    )

    if max_val >= 1e9:
        unit_label = "$B"
        unit_suffix = "B"
        divisor = 1e9
    elif max_val >= 1e6:
        unit_label = "$M"
        unit_suffix = "M"
        divisor = 1e6
    else:
        unit_label = "$"
        unit_suffix = ""
        divisor = 1.0

    quarters = []
    for i, row in df.iterrows():
        rev = float(rev_raw[i])
        gp = float(gp_raw[i])
        op = float(op_raw[i])
        ni = float(ni_raw[i])
        fcf = float(fcf_raw[i])

        gm_pct = round((gp / rev * 100), 2) if rev > 0 else 0.0
        om_pct = round((op / rev * 100), 2) if rev > 0 else 0.0
        nm_pct = round((ni / rev * 100), 2) if rev > 0 else 0.0

        yoy_rev = None
        if i >= 4 and rev_raw[i - 4] > 0:
            yoy_rev = round(((rev - float(rev_raw[i - 4])) / float(rev_raw[i - 4])) * 100, 1)

        quarters.append({
            "date": row["dt"].strftime("%Y-%m-%d"),
            "revenue": round(rev / divisor, 2),
            "grossProfit": round(gp / divisor, 2),
            "operatingIncome": round(op / divisor, 2),
            "netIncome": round(ni / divisor, 2),
            "freeCashFlow": round(fcf / divisor, 2),
            "grossMarginPct": gm_pct,
            "operatingMarginPct": om_pct,
            "netMarginPct": nm_pct,
            "yoyRevenueGrowth": yoy_rev,
        })

    stock_prices = []
    latest_price = 0.0
    p_dates = pd.DatetimeIndex([])
    prices = np.array([])

    if val_df is not None and not val_df.empty:
        val_df = val_df.sort_index()
        val_df.index = pd.to_datetime(val_df.index).tz_localize(None)
        p_dates = val_df.index
        prices = val_df["Close"].values
        start_date = df["dt"].min()
        today_date = p_dates.max()
        total_span_days = (today_date - start_date).days
        num_q = len(df)
        mask = p_dates >= start_date

        for d, p in zip(p_dates[mask], prices[mask]):
            day_offset = (d - start_date).days
            x = (day_offset / total_span_days) * num_q if total_span_days > 0 else 0
            if x >= 0:
                stock_prices.append({
                    "x": round(float(x), 4),
                    "y": round(float(p), 2),
                })
        if len(prices) > 0:
            latest_price = float(prices[-1])
    # Calculate TTM summary KPIs
    ttm_rev = float(rev_raw[-4:].sum()) if len(rev_raw) >= 4 else float(rev_raw.sum())
    ttm_ni = float(ni_raw[-4:].sum()) if len(ni_raw) >= 4 else float(ni_raw.sum())
    ttm_fcf = float(fcf_raw[-4:].sum()) if len(fcf_raw) >= 4 else float(fcf_raw.sum())
    ttm_net_margin = round((ttm_ni / ttm_rev * 100), 2) if ttm_rev > 0 else 0.0

    shares = get_shares_outstanding(ticker, latest_price)

    eps_ttm = (ttm_ni / shares) if shares > 0 else 0.0
    ttm_pe = round(latest_price / eps_ttm, 2) if eps_ttm > 0 else 0.0

    # Historical Valuation Ratios per quarter (P/E, P/S, FCF Yield)
    q_dates = df["dt"].values
    for i, q in enumerate(quarters):
        t4q_ni = ni_raw[max(0, i-3):i+1].sum()
        t4q_rev = rev_raw[max(0, i-3):i+1].sum()
        t4q_fcf = fcf_raw[max(0, i-3):i+1].sum()

        if i < 3:
            t4q_ni = t4q_ni * (4 / (i + 1))
            t4q_rev = t4q_rev * (4 / (i + 1))
            t4q_fcf = t4q_fcf * (4 / (i + 1))

        eps_q = (t4q_ni / shares) if shares > 0 else 0.0
        sps_q = (t4q_rev / shares) if shares > 0 else 0.0

        q_dt = q_dates[i]
        mask_p = (p_dates >= q_dt) if len(p_dates) > 0 else np.array([])
        q_price = float(prices[mask_p][0]) if mask_p.any() else latest_price
        q_mcap = q_price * shares

        q_pe = round(float(q_price / eps_q), 2) if eps_q > 0 else None
        q_ps = round(float(q_price / sps_q), 2) if sps_q > 0 else None
        q_fcf_yield = round(float((t4q_fcf / q_mcap) * 100), 2) if q_mcap > 0 else None

        q["peRatio"] = q_pe if (q_pe and 0 < q_pe < 250) else None
        q["psRatio"] = q_ps if (q_ps and 0 < q_ps < 100) else None
        q["fcfYield"] = q_fcf_yield if (q_fcf_yield and -50 < q_fcf_yield < 50) else None

    kpis = {
        "latestPrice": round(latest_price, 2),
        "ttmRevenue": round(ttm_rev / divisor, 2),
        "ttmFreeCashFlow": round(ttm_fcf / divisor, 2),
        "ttmNetMargin": ttm_net_margin,
        "ttmPE": ttm_pe,
        "unitSuffix": unit_suffix,
    }

    peers_data = get_peer_comparison(ticker)

    was_throttled = getattr(service.provider, "was_throttled", False)
    if hasattr(service.provider, "was_throttled"):
        service.provider.was_throttled = False

    return jsonify({
        "ticker": ticker,
        "unitLabel": unit_label,
        "unitSuffix": unit_suffix,
        "quarters": quarters,
        "stockPrices": stock_prices,
        "kpis": kpis,
        "peers": peers_data,
        "isThrottled": was_throttled,
        "notice": "Alpha Vantage free-tier rate limit (5 calls/min) was active; fallback data sources were used." if was_throttled else None,
    })


from data.peer_service import FinnhubPeerService


def fetch_single_peer(p_sym: str) -> dict:
    try:
        p_sym_upper = p_sym.upper()
        p_price = 0.0
        val_df = service.provider.get_price_history(p_sym_upper, period="1mo")
        if val_df is not None and not val_df.empty:
            p_price = float(val_df["Close"].iloc[-1])
        
        p_pe = "N/A"
        url = f'https://www.alphavantage.co/query?function=OVERVIEW&symbol={p_sym_upper}&apikey=YOUR_ALPHA_KEY_0'
        cached = cm.get_url_cache(url)
        
        if cached and isinstance(cached, dict) and ("PERatio" in cached or "peRatio" in cached):
            print(f"  ⚡ [CACHE HIT] Alpha Vantage: Peer Overview ({p_sym_upper})")
            pe_val = cached.get('PERatio') or cached.get('peRatio')
            if pe_val and pe_val != 'None' and pe_val != 'N/A':
                p_pe = round(float(pe_val), 2)
        else:
            # 1. Try Alpha Vantage live call first
            got_pe = False
            try:
                print(f"  🌐 [LIVE API CALL] Alpha Vantage: Peer Overview ({p_sym_upper})")
                resp = requests.get(url, timeout=4)
                overview = resp.json()
                if isinstance(overview, dict) and "PERatio" in overview:
                    pe_val = overview.get('PERatio')
                    if pe_val and pe_val != 'None' and pe_val != 'N/A':
                        p_pe = round(float(pe_val), 2)
                        got_pe = True
                    cm.save_url_cache(url, overview)
                    print(f"  💾 [CACHE SAVED] Alpha Vantage: Peer Overview ({p_sym_upper})")
            except Exception:
                pass

            # 2. Fallback to Yahoo Finance if Alpha Vantage was rate-limited / unavailable
            if not got_pe:
                try:
                    print(f"  🌐 [LIVE API CALL] Yahoo Finance: Peer Info ({p_sym_upper})")
                    yf_t = yf.Ticker(p_sym_upper)
                    yf_info = yf_t.info or {}
                    trailing_pe = yf_info.get("trailingPE") or yf_info.get("forwardPE")
                    if trailing_pe:
                        p_pe = round(float(trailing_pe), 2)
                    # Cache the found PE to SQLite so it never fetches again
                    cm.save_url_cache(url, {"PERatio": str(p_pe), "Symbol": p_sym_upper})
                    print(f"  💾 [CACHE SAVED] Peer Overview ({p_sym_upper})")
                except Exception:
                    # Still cache the N/A to prevent repeated rate limit spam
                    cm.save_url_cache(url, {"PERatio": "N/A", "Symbol": p_sym_upper})

        return {
            "ticker": p_sym_upper,
            "price": round(p_price, 2) if p_price > 0 else "—",
            "peRatio": p_pe
        }
    except Exception:
        return {
            "ticker": p_sym,
            "price": "—",
            "peRatio": "N/A"
        }

def get_peer_comparison(ticker: str) -> list:
    # Dynamically discover direct competitor peers via Finnhub API
    peer_symbols = FinnhubPeerService.get_dynamic_peers(ticker, cm)
    with ThreadPoolExecutor(max_workers=len(peer_symbols)) as executor:
        results = list(executor.map(fetch_single_peer, peer_symbols))
    return results


if __name__ == "__main__":
    app.run(port=5001, debug=False)
