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
from concurrent.futures import ThreadPoolExecutor
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


@app.route("/api/data/<ticker>")
def get_data(ticker):
    ticker = ticker.upper()
    print(f"\n📥 [API REQUEST] GET /api/data/{ticker}")

    analysis = None
    val_df = None
    peers_data = []
    
    # Run financial statement analysis, price valuation history, and peer comparison all concurrently in parallel
    for attempt in range(2):
        try:
            with ThreadPoolExecutor(max_workers=3) as executor:
                f_analysis = executor.submit(service.get_financial_analysis, ticker, "quarterly")
                f_val = executor.submit(service.get_valuation_history, ticker, "10y")
                f_peers = executor.submit(get_peer_comparison, ticker)
                analysis = f_analysis.result()
                val_df = f_val.result()
                peers_data = f_peers.result()
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

    # Historical EPS / Net Income CAGRs (1Y, 3Y, 5Y)
    eps_growth_1y = None
    eps_growth_3y = None
    eps_growth_5y = None

    if len(ni_raw) >= 8:
        ni_prev1 = float(ni_raw[-8:-4].sum())
        if ni_prev1 > 0 and ttm_ni > 0:
            eps_growth_1y = round(((ttm_ni / ni_prev1) - 1.0) * 100.0, 1)

    if len(ni_raw) >= 16:
        ni_prev3 = float(ni_raw[-16:-12].sum())
        if ni_prev3 > 0 and ttm_ni > 0:
            eps_growth_3y = round(((ttm_ni / ni_prev3) ** (1.0 / 3.0) - 1.0) * 100.0, 1)

    if len(ni_raw) >= 24:
        ni_prev5 = float(ni_raw[-24:-20].sum())
        if ni_prev5 > 0 and ttm_ni > 0:
            eps_growth_5y = round(((ttm_ni / ni_prev5) ** (1.0 / 5.0) - 1.0) * 100.0, 1)

    # 5-Year and 3-Year Valuation Multiples (Average Mean & Robust Median)
    # Exclude extreme outliers >50x (near-zero earnings era artifacts) before computing stats
    pe_history_5y = [q["peRatio"] for q in quarters[-20:] if q.get("peRatio") is not None]
    pe_history_5y_clean = [p for p in pe_history_5y if p <= 60]  # strip loss-era / earnings-trough spikes
    avg_pe_5y = round(float(np.mean(pe_history_5y)), 1) if pe_history_5y else None
    median_pe_5y = round(float(np.median(pe_history_5y)), 1) if pe_history_5y else None
    median_pe_5y_clean = round(float(np.median(pe_history_5y_clean)), 1) if pe_history_5y_clean else median_pe_5y

    pe_history_3y = [q["peRatio"] for q in quarters[-12:] if q.get("peRatio") is not None]
    avg_pe_3y = round(float(np.mean(pe_history_3y)), 1) if pe_history_3y else None
    median_pe_3y = round(float(np.median(pe_history_3y)), 1) if pe_history_3y else None

    # 5-Year Average Revenue YoY Growth %
    rev_growth_5y = [q["yoyRevenueGrowth"] for q in quarters[-20:] if q.get("yoyRevenueGrowth") is not None]
    avg_rev_growth_5y = round(float(np.mean(rev_growth_5y)), 1) if rev_growth_5y else None

    # Analyst EPS Estimates from Yahoo Finance (forward-looking consensus)
    analyst_eps_fy0 = None       # Current fiscal year EPS estimate
    analyst_eps_fy1 = None       # Next fiscal year EPS estimate
    analyst_growth_fy0 = None    # YoY growth implied by FY0 estimate
    analyst_growth_fy1 = None    # YoY growth implied by FY1 estimate
    analyst_count = None         # Number of analysts covering
    try:
        yf_t = yf.Ticker(ticker)
        ee = yf_t.earnings_estimate
        if ee is not None and not ee.empty:
            if '0y' in ee.index:
                raw_0y = ee.loc['0y', 'avg']
                raw_g0 = ee.loc['0y', 'growth']
                raw_n0 = ee.loc['0y', 'numberOfAnalysts']
                if raw_0y and not pd.isna(raw_0y):
                    analyst_eps_fy0 = round(float(raw_0y), 2)
                if raw_g0 and not pd.isna(raw_g0):
                    analyst_growth_fy0 = round(float(raw_g0) * 100, 1)
                if raw_n0 and not pd.isna(raw_n0):
                    analyst_count = int(raw_n0)
            if '+1y' in ee.index:
                raw_1y = ee.loc['+1y', 'avg']
                raw_g1 = ee.loc['+1y', 'growth']
                if raw_1y and not pd.isna(raw_1y):
                    analyst_eps_fy1 = round(float(raw_1y), 2)
                if raw_g1 and not pd.isna(raw_g1):
                    analyst_growth_fy1 = round(float(raw_g1) * 100, 1)
        print(f"  ✅ [ANALYST] FY0 EPS: ${analyst_eps_fy0}, FY1 EPS: ${analyst_eps_fy1}, Analysts: {analyst_count}")
    except Exception as e:
        print(f"  ⚠️ [ANALYST] Could not fetch analyst estimates: {e}")

    kpis = {
        "latestPrice": round(latest_price, 2),
        "ttmRevenue": round(ttm_rev / divisor, 2),
        "ttmFreeCashFlow": round(ttm_fcf / divisor, 2),
        "ttmNetMargin": ttm_net_margin,
        "ttmPE": ttm_pe,
        "epsTTM": round(eps_ttm, 2),
        "epsGrowth1Y": eps_growth_1y,
        "epsGrowth3Y": eps_growth_3y,
        "epsGrowth5Y": eps_growth_5y,
        "avgPE5Y": avg_pe_5y,
        "medianPE5Y": median_pe_5y,
        "medianPE5YClean": median_pe_5y_clean,  # Outlier-stripped (<=60x) median, used as safer default
        "avgPE3Y": avg_pe_3y,
        "medianPE3Y": median_pe_3y,
        "avgRevGrowth5Y": avg_rev_growth_5y,
        "analystEpsFY0": analyst_eps_fy0,
        "analystEpsFY1": analyst_eps_fy1,
        "analystGrowthFY0": analyst_growth_fy0,
        "analystGrowthFY1": analyst_growth_fy1,
        "analystCount": analyst_count,
        "unitSuffix": unit_suffix,
    }

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


if __name__ == "__main__":
    app.run(port=5001, debug=False)

