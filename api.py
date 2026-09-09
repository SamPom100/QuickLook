import sys
import os
import json
import time
import re
import requests
import yfinance as yf
import pandas as pd
import numpy as np
from flask import Flask, jsonify
from flask_cors import CORS
from concurrent.futures import ThreadPoolExecutor
from data.data_service import FinancialDataService
from data.cache_manager import CacheManager
from config import ALPHAVANTAGE_KEY, FINNHUB_TOKEN

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

        url = f'https://www.alphavantage.co/query?function=OVERVIEW&symbol={ticker.upper()}&apikey={ALPHAVANTAGE_KEY}'
        cache_key = f'https://www.alphavantage.co/query?function=OVERVIEW&symbol={ticker.upper()}'
        cached = cm.get_url_cache(cache_key) or cm.get_url_cache(url)
        if cached and isinstance(cached, dict) and "MarketCapitalization" in cached:
            print(f"  ⚡ [CACHE HIT] Alpha Vantage: Shares Outstanding / Overview ({ticker.upper()})")
            overview = cached
        else:
            print(f"  🌐 [LIVE API CALL] Alpha Vantage: Shares Outstanding / Overview ({ticker.upper()})")
            resp = requests.get(url, timeout=10)
            overview = resp.json()
            if isinstance(overview, dict) and "Information" not in overview and "Note" not in overview:
                cm.save_url_cache(cache_key, overview)
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
from yfinance import Industry


def fetch_single_peer(p_sym: str) -> dict:
    try:
        p_sym_upper = p_sym.upper()
        p_price = 0.0
        val_df = service.provider.get_price_history(p_sym_upper, period="1mo")
        if val_df is not None and not val_df.empty:
            p_price = float(val_df["Close"].iloc[-1])
        
        p_pe = "N/A"
        p_ps = "N/A"
        peer_cache_key = f'https://peer-info-v2/{p_sym_upper}'
        cached = cm.get_url_cache(peer_cache_key)
        
        if cached and isinstance(cached, dict) and "peRatio" in cached:
            p_pe = cached.get("peRatio", "N/A")
            p_ps = cached.get("psRatio", "N/A")
        else:
            # Query Yahoo Finance directly with 0 rate limits
            try:
                yf_t = yf.Ticker(p_sym_upper)
                yf_info = yf_t.info or {}
                pe_val = yf_info.get("trailingPE") or yf_info.get("forwardPE")
                ps_val = yf_info.get("priceToSalesTrailing12Months")
                if pe_val and pe_val != "None":
                    p_pe = round(float(pe_val), 2)
                if ps_val and ps_val != "None":
                    p_ps = round(float(ps_val), 2)
                cm.save_url_cache(peer_cache_key, {"peRatio": p_pe, "psRatio": p_ps})
            except Exception:
                cm.save_url_cache(peer_cache_key, {"peRatio": "N/A", "psRatio": "N/A"})

        return {
            "ticker": p_sym_upper,
            "price": round(p_price, 2) if p_price > 0 else "—",
            "peRatio": p_pe,
            "psRatio": p_ps,
        }
    except Exception:
        return {
            "ticker": p_sym,
            "price": "—",
            "peRatio": "N/A",
            "psRatio": "N/A",
        }

def get_peer_comparison(ticker: str) -> list:
    # Dynamically discover direct competitor peers via Finnhub API
    peer_symbols = FinnhubPeerService.get_dynamic_peers(ticker, cm)
    with ThreadPoolExecutor(max_workers=len(peer_symbols)) as executor:
        results = list(executor.map(fetch_single_peer, peer_symbols))
    return results


def get_industry_benchmarks(ticker: str, cache_manager=None) -> dict:
    """
    Dynamically compute Industry Median P/E and P/S across top industry constituent leaders.
    Zero hardcoding; dynamically queries yfinance.Industry and caches in SQLite.
    """
    ticker_upper = ticker.upper()
    cache_key = f"industry_benchmark_v2:{ticker_upper}"
    if cache_manager:
        cached = cache_manager.get_url_cache(cache_key)
        if cached and isinstance(cached, dict) and "pe" in cached:
            return cached

    try:
        yf_t = yf.Ticker(ticker_upper)
        info = yf_t.info or {}
        ind_key = info.get("industryKey")
        ind_name = info.get("industry") or (ind_key.replace("-", " ").title() if ind_key else None)
        if not ind_key:
            return {"pe": None, "ps": None, "industry": None}

        ind_cache_key = f"industry_metrics:{ind_key}"
        if cache_manager:
            ind_cached = cache_manager.get_url_cache(ind_cache_key)
            if ind_cached and isinstance(ind_cached, dict) and "pe" in ind_cached:
                if cache_manager:
                    cache_manager.save_url_cache(cache_key, ind_cached)
                return ind_cached

        ind = Industry(ind_key)
        top_syms = []
        if hasattr(ind, "top_companies") and ind.top_companies is not None and not ind.top_companies.empty:
            top_syms = list(ind.top_companies.index[:15])

        if not top_syms:
            return {"pe": None, "ps": None, "industry": ind_name}

        def fetch_mults(sym):
            try:
                sym_info = yf.Ticker(sym).info or {}
                p_e = sym_info.get("trailingPE")
                p_s = sym_info.get("priceToSalesTrailing12Months")
                return {
                    "pe": float(p_e) if p_e and 0 < float(p_e) < 250 else None,
                    "ps": float(p_s) if p_s and 0 < float(p_s) < 100 else None,
                }
            except Exception:
                return {"pe": None, "ps": None}

        with ThreadPoolExecutor(max_workers=min(len(top_syms), 12)) as ex:
            results = list(ex.map(fetch_mults, top_syms))

        pes = [r["pe"] for r in results if r["pe"] is not None]
        pss = [r["ps"] for r in results if r["ps"] is not None]

        med_pe = round(float(np.median(pes)), 1) if len(pes) >= 2 else None
        med_ps = round(float(np.median(pss)), 1) if len(pss) >= 2 else None

        res = {
            "pe": med_pe,
            "ps": med_ps,
            "industry": ind_name,
            "count": len(top_syms),
        }

        if cache_manager:
            cache_manager.save_url_cache(ind_cache_key, res)
            cache_manager.save_url_cache(cache_key, res)

        print(f"  🏢 [INDUSTRY] {ind_name}: Median PE {med_pe}x, Median PS {med_ps}x ({len(pes)}/{len(top_syms)} leaders)")
        return res
    except Exception as e:
        print(f"  ⚠️ [INDUSTRY BENCHMARK] Error computing industry metrics for {ticker}: {e}")
        return {"pe": None, "ps": None, "industry": None}


@app.route("/api/data/<ticker>")
def get_data(ticker):
    ticker = ticker.strip().upper()
    print(f"\n📥 [API REQUEST] GET /api/data/{ticker}")

    # 1. Format validation: reject obviously invalid inputs immediately (<1ms)
    if not ticker or len(ticker) > 10 or not re.match(r"^[A-Z0-9.\-]+$", ticker):
        print(f"  ❌ [INVALID FORMAT] '{ticker}' rejected")
        return jsonify({
            "error": f"Invalid ticker format: '{ticker}'. Symbol must only contain letters, numbers, dot, or hyphen.",
            "isInvalidTicker": True,
        }), 400

    # 2. Fast 60ms validation: Check if ticker actually exists before launching heavy parallel workers
    is_cached = bool(cm.get_financial_statements(ticker, "quarterly"))
    if not is_cached:
        try:
            val_url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=1d"
            v_resp = requests.get(val_url, headers={"User-Agent": "Mozilla/5.0"}, timeout=2.0)
            if v_resp.status_code == 404:
                print(f"  ❌ [FAST REJECT] Symbol '{ticker}' not found (404)")
                return jsonify({
                    "error": f"Symbol '{ticker}' not found. Please verify the ticker symbol.",
                    "isInvalidTicker": True,
                }), 404
            if v_resp.status_code == 200:
                v_json = v_resp.json()
                chart_obj = v_json.get("chart", {})
                if chart_obj.get("error") or chart_obj.get("result") is None:
                    print(f"  ❌ [FAST REJECT] Symbol '{ticker}' returned chart error or null result")
                    return jsonify({
                        "error": f"Symbol '{ticker}' not found or delisted.",
                        "isInvalidTicker": True,
                    }), 404
        except Exception:
            pass

    analysis = None
    val_df = None
    peers_data = []
    industry_benchmarks = {"pe": None, "ps": None, "industry": None}
    
    # Run financial statements, valuation, peers, and industry benchmarks concurrently in parallel
    for attempt in range(2):
        try:
            with ThreadPoolExecutor(max_workers=4) as executor:
                f_analysis = executor.submit(service.get_financial_analysis, ticker, "quarterly")
                f_val = executor.submit(service.get_valuation_history, ticker, "10y")
                f_peers = executor.submit(get_peer_comparison, ticker)
                f_ind = executor.submit(get_industry_benchmarks, ticker, cm)
                analysis = f_analysis.result()
                val_df = f_val.result()
                peers_data = f_peers.result()
                industry_benchmarks = f_ind.result()
            if analysis and len(analysis) > 0:
                break
            if not getattr(service.provider, "was_throttled", False):
                break
        except Exception as e:
            if attempt == 1:
                return jsonify({"error": str(e)}), 500
        time.sleep(0.5)

    if not analysis or len(analysis) == 0:
        was_throttled = getattr(service.provider, "was_throttled", False)
        if was_throttled:
            print(f"  ⏳ [THROTTLED] API returned 429 rate limit error for {ticker}")
            return jsonify({
                "error": f"Alpha Vantage free-tier rate limit reached (5 requests/minute). Please wait 15 seconds and click Retry.",
                "isThrottled": True,
                "retryAfter": 15
            }), 429
        else:
            print(f"  ❌ [NO DATA] No financial statements found for {ticker}")
            return jsonify({
                "error": f"No financial statements found for symbol '{ticker}'.",
                "isInvalidTicker": True,
            }), 404

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

        opex = (gp - op) if (gp > 0 and op != 0) else (rev - op if (rev > 0 and op != 0) else 0.0)
        gm_pct = round((gp / rev * 100), 2) if rev > 0 else 0.0
        om_pct = round((op / rev * 100), 2) if rev > 0 else 0.0
        nm_pct = round((ni / rev * 100), 2) if rev > 0 else 0.0
        fcf_conversion = round((fcf / ni * 100), 1) if (ni > 0 and fcf != 0) else None
        fcf_margin = round((fcf / rev * 100), 1) if rev > 0 else 0.0

        yoy_rev = None
        if i >= 4 and rev_raw[i - 4] > 0:
            yoy_rev = round(((rev - float(rev_raw[i - 4])) / float(rev_raw[i - 4])) * 100, 1)

        quarters.append({
            "date": row["dt"].strftime("%Y-%m-%d"),
            "revenue": round(rev / divisor, 2),
            "grossProfit": round(gp / divisor, 2),
            "operatingExpenses": round(max(0.0, opex) / divisor, 2),
            "operatingIncome": round(op / divisor, 2),
            "netIncome": round(ni / divisor, 2),
            "freeCashFlow": round(fcf / divisor, 2),
            "grossMarginPct": gm_pct,
            "operatingMarginPct": om_pct,
            "netMarginPct": nm_pct,
            "fcfConversionPct": fcf_conversion,
            "fcfMarginPct": fcf_margin,
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
                    "date": d.strftime("%Y-%m-%d"),
                })
        if len(prices) > 0:
            latest_price = float(prices[-1])
    # Calculate TTM summary KPIs
    ttm_rev = float(rev_raw[-4:].sum()) if len(rev_raw) >= 4 else float(rev_raw.sum())
    ttm_gp = float(gp_raw[-4:].sum()) if len(gp_raw) >= 4 else float(gp_raw.sum())
    ttm_op = float(op_raw[-4:].sum()) if len(op_raw) >= 4 else float(op_raw.sum())
    ttm_ni = float(ni_raw[-4:].sum()) if len(ni_raw) >= 4 else float(ni_raw.sum())
    ttm_fcf = float(fcf_raw[-4:].sum()) if len(fcf_raw) >= 4 else float(fcf_raw.sum())
    ttm_gross_margin = round((ttm_gp / ttm_rev * 100), 2) if ttm_rev > 0 else 0.0
    ttm_op_margin = round((ttm_op / ttm_rev * 100), 2) if ttm_rev > 0 else 0.0
    ttm_net_margin = round((ttm_ni / ttm_rev * 100), 2) if ttm_rev > 0 else 0.0
    ttm_fcf_conversion = round((ttm_fcf / ttm_ni * 100), 1) if ttm_ni > 0 else None

    shares = get_shares_outstanding(ticker, latest_price)

    eps_ttm = (ttm_ni / shares) if shares > 0 else 0.0
    ttm_pe = round(latest_price / eps_ttm, 2) if eps_ttm > 0 else 0.0
    ttm_ps = round((latest_price * shares) / ttm_rev, 2) if (shares > 0 and ttm_rev > 0) else 0.0

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

        # Compute YoY EPS Growth % (comparing TTM Net Income against TTM Net Income 4 quarters prior)
        prev_t4q_ni = None
        if i >= 4:
            prev_t4q_ni = ni_raw[max(0, i-7):i-3].sum()
            if i < 7:
                prev_t4q_ni = prev_t4q_ni * (4 / (i - 3))
        
        eps_growth_yoy = None
        if prev_t4q_ni and prev_t4q_ni > 0 and t4q_ni > 0:
            eps_growth_yoy = round(((t4q_ni - prev_t4q_ni) / abs(prev_t4q_ni)) * 100.0, 1)

        q["peRatio"] = q_pe if (q_pe and 0 < q_pe < 250) else None
        q["psRatio"] = q_ps if (q_ps and 0 < q_ps < 100) else None
        q["fcfYield"] = q_fcf_yield if (q_fcf_yield and -50 < q_fcf_yield < 50) else None
        q["epsTTM"] = round(float(eps_q), 2) if eps_q > 0 else None

    # Assign YoY EPS Growth % (comparing TTM EPS to TTM EPS 4 quarters prior)
    for i in range(len(quarters)):
        if i >= 4:
            cur_eps = quarters[i].get("epsTTM")
            prev_eps = quarters[i - 4].get("epsTTM")
            if cur_eps is not None and prev_eps is not None and prev_eps > 0:
                quarters[i]["epsGrowthYoY"] = round(((cur_eps - prev_eps) / prev_eps) * 100.0, 1)
            else:
                quarters[i]["epsGrowthYoY"] = None
        else:
            quarters[i]["epsGrowthYoY"] = None

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
        "ttmGrossMargin": ttm_gross_margin,
        "ttmOperatingMargin": ttm_op_margin,
        "ttmNetMargin": ttm_net_margin,
        "ttmPE": ttm_pe,
        "ttmPS": ttm_ps,
        "ttmFcfConversion": ttm_fcf_conversion,
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
        "industryPE": industry_benchmarks.get("pe"),
        "industryPS": industry_benchmarks.get("ps"),
        "industryName": industry_benchmarks.get("industry"),
        "unitSuffix": unit_suffix,
    }

    was_throttled = getattr(service.provider, "was_throttled", False)
    if hasattr(service.provider, "was_throttled"):
        service.provider.was_throttled = False

    # Only report notice if data failed to load; if we have full data from cache/fallbacks, do not alarm the user
    has_full_data = len(quarters) >= 4
    notice = "Alpha Vantage rate limit reached; partial data available." if (was_throttled and not has_full_data) else None

    return jsonify({
        "ticker": ticker,
        "unitLabel": unit_label,
        "unitSuffix": unit_suffix,
        "quarters": quarters,
        "stockPrices": stock_prices,
        "kpis": kpis,
        "peers": peers_data,
        "industryBenchmarks": industry_benchmarks,
        "isThrottled": was_throttled,
        "notice": notice,
    })


if __name__ == "__main__":
    app.run(port=5001, debug=False)

