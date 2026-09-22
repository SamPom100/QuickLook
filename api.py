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
from config import ALPHAVANTAGE_KEY

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


from data.peer_service import PeerService
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
        p_ev = "N/A"
        p_rev_growth = "N/A"
        p_rev_growth_5y = "N/A"
        p_pb = "N/A"
        p_gross_margin = "N/A"
        p_net_margin = "N/A"
        p_operating_margin = "N/A"
        p_roic_proxy = "N/A"
        peer_cache_key = f'https://peer-info-v10/{p_sym_upper}'
        cached = cm.get_url_cache(peer_cache_key)
        
        if cached and isinstance(cached, dict) and "revGrowth5Y" in cached and "pbRatio" in cached and "grossMarginPct" in cached and "operatingMarginPct" in cached:
            p_pe = cached.get("peRatio", "N/A")
            p_ps = cached.get("psRatio", "N/A")
            p_ev = cached.get("evEbitda", "N/A")
            p_rev_growth = cached.get("revenueGrowth", "N/A")
            p_rev_growth_5y = cached.get("revGrowth5Y", "N/A")
            p_pb = cached.get("pbRatio", "N/A")
            p_gross_margin = cached.get("grossMarginPct", "N/A")
            p_net_margin = cached.get("netMarginPct", "N/A")
            p_operating_margin = cached.get("operatingMarginPct", "N/A")
            p_roic_proxy = cached.get("roicProxyPct", "N/A")
        else:
            # Query Yahoo Finance directly with 0 rate limits
            try:
                yf_t = yf.Ticker(p_sym_upper)
                yf_info = yf_t.info or {}
                pe_val = yf_info.get("trailingPE") or yf_info.get("forwardPE")
                ps_val = yf_info.get("priceToSalesTrailing12Months")
                ev_val = yf_info.get("enterpriseToEbitda")
                rg_val = yf_info.get("revenueGrowth")
                pb_val = yf_info.get("priceToBook")
                gm_val = yf_info.get("grossMargins")
                nm_val = yf_info.get("profitMargins")
                om_val = yf_info.get("operatingMargins")
                roa_val = yf_info.get("returnOnAssets")
                if pe_val and pe_val != "None":
                    p_pe = round(float(pe_val), 2)
                if ps_val and ps_val != "None":
                    p_ps = round(float(ps_val), 2)
                if ev_val and ev_val != "None":
                    p_ev = round(float(ev_val), 1)
                if rg_val and rg_val != "None":
                    p_rev_growth = round(float(rg_val) * 100.0, 1)
                if pb_val and pb_val != "None":
                    p_pb = round(float(pb_val), 2)
                if gm_val and gm_val != "None":
                    p_gross_margin = round(float(gm_val) * 100.0, 1)
                if nm_val and nm_val != "None":
                    p_net_margin = round(float(nm_val) * 100.0, 1)
                if om_val and om_val != "None":
                    p_operating_margin = round(float(om_val) * 100.0, 1)
                if roa_val and roa_val != "None":
                    p_roic_proxy = round(float(roa_val) * 100.0, 1)

                # Compute 5-Year Revenue Growth for peer
                try:
                    inc = yf_t.financials
                    if inc is not None and not inc.empty and "Total Revenue" in inc.index:
                        revs = inc.loc["Total Revenue"].dropna()
                        if len(revs) >= 2:
                            rev_new = float(revs.iloc[0])
                            rev_old = float(revs.iloc[-1])
                            years = (revs.index[0] - revs.index[-1]).days / 365.25
                            if rev_old > 0 and years > 0:
                                p_rev_growth_5y = round(((rev_new / rev_old) ** (1.0 / years) - 1.0) * 100.0, 1)
                except Exception:
                    pass

                if p_rev_growth_5y == "N/A" and p_rev_growth != "N/A":
                    p_rev_growth_5y = p_rev_growth

                cm.save_url_cache(peer_cache_key, {
                    "peRatio": p_pe,
                    "psRatio": p_ps,
                    "evEbitda": p_ev,
                    "revenueGrowth": p_rev_growth,
                    "revGrowth5Y": p_rev_growth_5y,
                    "pbRatio": p_pb,
                    "grossMarginPct": p_gross_margin,
                    "netMarginPct": p_net_margin,
                    "operatingMarginPct": p_operating_margin,
                    "roicProxyPct": p_roic_proxy,
                })
            except Exception:
                cm.save_url_cache(peer_cache_key, {
                    "peRatio": "N/A",
                    "psRatio": "N/A",
                    "evEbitda": "N/A",
                    "revenueGrowth": "N/A",
                    "revGrowth5Y": "N/A",
                    "pbRatio": "N/A",
                    "grossMarginPct": "N/A",
                    "netMarginPct": "N/A",
                    "operatingMarginPct": "N/A",
                    "roicProxyPct": "N/A",
                })

        return {
            "ticker": p_sym_upper,
            "price": round(p_price, 2) if p_price > 0 else "—",
            "peRatio": p_pe,
            "psRatio": p_ps,
            "evEbitda": p_ev,
            "revenueGrowth": p_rev_growth,
            "revGrowth5Y": p_rev_growth_5y,
            "pbRatio": p_pb,
            "grossMarginPct": p_gross_margin,
            "netMarginPct": p_net_margin,
            "operatingMarginPct": p_operating_margin,
            "roicProxyPct": p_roic_proxy,
        }
    except Exception:
        return {
            "ticker": p_sym,
            "price": "—",
            "peRatio": "N/A",
            "psRatio": "N/A",
            "evEbitda": "N/A",
            "revenueGrowth": "N/A",
            "pbRatio": "N/A",
            "grossMarginPct": "N/A",
            "netMarginPct": "N/A",
            "operatingMarginPct": "N/A",
            "roicProxyPct": "N/A",
        }

def get_peer_comparison(ticker: str) -> list:
    # Dynamically discover direct competitor peers via Yahoo Finance
    peer_symbols = PeerService.get_dynamic_peers(ticker, cm)
    with ThreadPoolExecutor(max_workers=len(peer_symbols)) as executor:
        results = list(executor.map(fetch_single_peer, peer_symbols))
    return results


def get_industry_benchmarks(ticker: str, cache_manager=None) -> dict:
    """
    Dynamically compute Industry Median P/E and P/S across top industry constituent leaders.
    Zero hardcoding; dynamically queries yfinance.Industry and caches in SQLite.
    """
    ticker_upper = ticker.upper()
    cache_key = f"industry_benchmark_v4:{ticker_upper}"
    if cache_manager:
        cached = cache_manager.get_url_cache(cache_key)
        if cached and isinstance(cached, dict) and "pe" in cached and "pb" in cached:
            return cached

    try:
        yf_t = yf.Ticker(ticker_upper)
        info = yf_t.info or {}
        ind_key = info.get("industryKey")
        ind_name = info.get("industry") or (ind_key.replace("-", " ").title() if ind_key else None)
        if not ind_key:
            return {"pe": None, "ps": None, "revGrowth": None, "pb": None, "industry": None}

        ind_cache_key = f"industry_metrics_v3:{ind_key}"
        if cache_manager:
            ind_cached = cache_manager.get_url_cache(ind_cache_key)
            if ind_cached and isinstance(ind_cached, dict) and "pe" in ind_cached and "pb" in ind_cached:
                if cache_manager:
                    cache_manager.save_url_cache(cache_key, ind_cached)
                return ind_cached

        ind = Industry(ind_key)
        top_syms = []
        if hasattr(ind, "top_companies") and ind.top_companies is not None and not ind.top_companies.empty:
            top_syms = list(ind.top_companies.index[:15])

        if not top_syms:
            return {"pe": None, "ps": None, "revGrowth": None, "pb": None, "industry": ind_name}

        def fetch_mults(sym):
            try:
                sym_info = yf.Ticker(sym).info or {}
                p_e = sym_info.get("trailingPE")
                p_s = sym_info.get("priceToSalesTrailing12Months")
                p_rg = sym_info.get("revenueGrowth")
                p_pb = sym_info.get("priceToBook")
                return {
                    "pe": float(p_e) if p_e and 0 < float(p_e) < 250 else None,
                    "ps": float(p_s) if p_s and 0 < float(p_s) < 100 else None,
                    "revGrowth": round(float(p_rg) * 100.0, 1) if p_rg and p_rg != "None" and -100 < float(p_rg) * 100 < 500 else None,
                    "pb": round(float(p_pb), 2) if p_pb and p_pb != "None" and 0 < float(p_pb) < 150 else None,
                }
            except Exception:
                return {"pe": None, "ps": None, "revGrowth": None, "pb": None}

        with ThreadPoolExecutor(max_workers=min(len(top_syms), 12)) as ex:
            results = list(ex.map(fetch_mults, top_syms))

        pes = [r["pe"] for r in results if r["pe"] is not None]
        pss = [r["ps"] for r in results if r["ps"] is not None]
        rgs = [r["revGrowth"] for r in results if r["revGrowth"] is not None]
        pbs = [r["pb"] for r in results if r["pb"] is not None]

        med_pe = round(float(np.median(pes)), 1) if len(pes) >= 2 else None
        med_ps = round(float(np.median(pss)), 1) if len(pss) >= 2 else None
        med_rg = round(float(np.median(rgs)), 1) if len(rgs) >= 2 else None
        med_pb = round(float(np.median(pbs)), 2) if len(pbs) >= 2 else None

        res = {
            "pe": med_pe,
            "ps": med_ps,
            "revGrowth": med_rg,
            "pb": med_pb,
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

    def extract_num_array(source_df, col):
        if col in source_df.columns:
            s = pd.to_numeric(source_df[col], errors="coerce").fillna(0).to_numpy()
            return np.array(s, copy=True, dtype=float)
        return np.zeros(len(source_df), dtype=float)

    # Extract raw numeric values as mutable, owned numpy float arrays
    rev_raw = extract_num_array(df, "revenue")
    gp_raw = extract_num_array(df, "gross_profit")
    op_raw = extract_num_array(df, "operating_income")
    ni_raw = extract_num_array(df, "net_income")
    fcf_raw = extract_num_array(df, "free_cash_flow")
    sbc_raw = extract_num_array(df, "stock_based_compensation")
    real_fcf_raw = extract_num_array(df, "real_fcf")
    ebitda_raw = extract_num_array(df, "ebitda")

    # Fallback for ebitda if not explicitly populated
    for idx in range(len(ebitda_raw)):
        if ebitda_raw[idx] == 0:
            ebitda_raw[idx] = op_raw[idx] * 1.22 if op_raw[idx] > 0 else op_raw[idx]

    # Fallback to fcf - sbc if real_fcf was not saved
    for idx in range(len(fcf_raw)):
        if sbc_raw[idx] > 0 and (real_fcf_raw[idx] == 0 or real_fcf_raw[idx] == fcf_raw[idx]):
            real_fcf_raw[idx] = fcf_raw[idx] - sbc_raw[idx]
        elif sbc_raw[idx] == 0 and real_fcf_raw[idx] == 0:
            real_fcf_raw[idx] = fcf_raw[idx]

    # Determine scale unit based on max value ($B, $M, or $)
    max_val = max(
        np.max(np.abs(rev_raw)) if len(rev_raw) > 0 else 0,
        np.max(np.abs(fcf_raw)) if len(fcf_raw) > 0 else 0,
        np.max(np.abs(ni_raw)) if len(ni_raw) > 0 else 0,
        np.max(np.abs(ebitda_raw)) if len(ebitda_raw) > 0 else 0
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
        sbc = float(sbc_raw[i])
        real_fcf = float(real_fcf_raw[i])
        ebitda = float(ebitda_raw[i])

        opex = (gp - op) if (gp > 0 and op != 0) else (rev - op if (rev > 0 and op != 0) else 0.0)
        gm_pct = round((gp / rev * 100), 2) if rev > 0 else 0.0
        om_pct = round((op / rev * 100), 2) if rev > 0 else 0.0
        nm_pct = round((ni / rev * 100), 2) if rev > 0 else 0.0
        ebitda_margin = round((ebitda / rev * 100), 2) if rev > 0 else 0.0
        fcf_conversion = round((fcf / ni * 100), 1) if (ni > 0 and fcf is not None) else None
        fcf_margin = round((fcf / rev * 100), 1) if rev > 0 else 0.0
        sbc_pct = round((sbc / rev * 100), 1) if rev > 0 else 0.0

        yoy_rev = None
        if i >= 4 and rev_raw[i - 4] > 0:
            yoy_rev = round(((rev - float(rev_raw[i - 4])) / float(rev_raw[i - 4])) * 100, 1)

        quarters.append({
            "date": row["dt"].strftime("%Y-%m-%d"),
            "revenue": round(rev / divisor, 2),
            "grossProfit": round(gp / divisor, 2),
            "operatingExpenses": round(max(0.0, opex) / divisor, 2),
            "operatingIncome": round(op / divisor, 2),
            "ebitda": round(ebitda / divisor, 2),
            "ebitdaMarginPct": ebitda_margin,
            "netIncome": round(ni / divisor, 2),
            "freeCashFlow": round(fcf / divisor, 2),
            "stockBasedCompensation": round(sbc / divisor, 2),
            "realFreeCashFlow": round(real_fcf / divisor, 2),
            "sbcPctRevenue": sbc_pct,
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

    # Instantiate Ticker once for all advanced valuation & capital efficiency metrics
    yf_t = yf.Ticker(ticker)
    yf_info = yf_t.info or {}

    # Solvency & Capital Structure
    total_debt = float(yf_info.get("totalDebt") or 0.0)
    total_cash = float(yf_info.get("totalCash") or 0.0)
    ebitda_val = float(yf_info.get("ebitda") or 0.0)
    net_debt = total_debt - total_cash
    is_net_cash = net_debt < 0
    ev_ebitda_val = yf_info.get("enterpriseToEbitda")
    ev_ebitda_raw = round(float(ev_ebitda_val), 1) if (ev_ebitda_val and ev_ebitda_val != "None") else None
    # Guard against absurd ratios when EBITDA is near-zero or negative (e.g. unprofitable companies)
    ev_ebitda = ev_ebitda_raw if (ev_ebitda_raw is not None and 0 < ev_ebitda_raw < 150) else None

    if is_net_cash:
        net_cash_abs = abs(net_debt)
        if net_cash_abs >= 1e12:
            net_debt_label = f"+${net_cash_abs / 1e12:.2f}T Net Cash"
        elif net_cash_abs >= 1e9:
            net_debt_label = f"+${net_cash_abs / 1e9:.1f}B Net Cash"
        elif net_cash_abs >= 1e6:
            net_debt_label = f"+${net_cash_abs / 1e6:.0f}M Net Cash"
        else:
            net_debt_label = f"+${net_cash_abs:.0f} Net Cash"
        net_debt_sub = "Net Cash Position"
    else:
        lev = round(net_debt / ebitda_val, 1) if ebitda_val > 0 else None
        if net_debt >= 1e12:
            nd_str = f"${net_debt / 1e12:.2f}T Net Debt"
        elif net_debt >= 1e9:
            nd_str = f"${net_debt / 1e9:.1f}B Net Debt"
        else:
            nd_str = f"${net_debt / 1e6:.0f}M Net Debt"
        net_debt_label = f"{lev}x Net Debt" if lev is not None else nd_str
        net_debt_sub = f"{lev}x EBITDA" if lev is not None else "Leveraged"

    # Helper to extract clean time-series from list of balance sheet DataFrames
    def extract_bs_series(bs_list, row_keys):
        s = pd.Series(dtype=float)
        for bs in bs_list:
            if bs is not None and not bs.empty:
                for k in row_keys:
                    if k in bs.index:
                        s = pd.concat([s, bs.loc[k].dropna()])
                        break
        if not s.empty:
            s.index = pd.to_datetime(s.index).tz_localize(None)
            s = s[~s.index.duplicated(keep="first")].sort_index()
        return s

    def get_closest_val(s, dt, fallback=0.0):
        if s.empty:
            return fallback
        if dt <= s.index[0]:
            return float(s.iloc[0])
        if dt >= s.index[-1]:
            return float(s.iloc[-1])
        before = s[s.index <= dt]
        after = s[s.index >= dt]
        if not before.empty and not after.empty:
            t0, v0 = before.index[-1], float(before.iloc[-1])
            t1, v1 = after.index[0], float(after.iloc[0])
            if t0 == t1:
                return v0
            frac = (dt - t0).total_seconds() / (t1 - t0).total_seconds()
            return v0 + frac * (v1 - v0)
        return float(s.iloc[-1])

    # Fetch Invested Capital, Cash, Debt, Equity Series
    ic_series = pd.Series(dtype=float)
    cash_series = pd.Series(dtype=float)
    debt_series = pd.Series(dtype=float)
    eq_series = pd.Series(dtype=float)
    q_bs = None
    a_bs = None
    try:
        q_bs = yf_t.quarterly_balance_sheet
        a_bs = yf_t.balance_sheet
        ic_series = extract_bs_series([q_bs, a_bs], ["Invested Capital"])
        cash_series = extract_bs_series([q_bs, a_bs], ["Cash Cash Equivalents And Short Term Investments", "Cash And Cash Equivalents", "Cash Financial"])
        debt_series = extract_bs_series([q_bs, a_bs], ["Total Debt", "Long Term Debt And Capital Lease Obligation", "Long Term Debt"])
        eq_series = extract_bs_series([q_bs, a_bs], ["Stockholders Equity", "Common Stock Equity", "Total Equity Gross Minority Interest"])
    except Exception:
        pass

    # Fetch Historical Shares Series for Buyback / Dilution Tracking
    shares_series = pd.Series(dtype=float)
    try:
        shares_full = yf_t.get_shares_full(start="2018-01-01")
        if shares_full is not None and not shares_full.empty:
            shares_series = shares_full
            shares_series.index = pd.to_datetime(shares_series.index).tz_localize(None)
            shares_series = shares_series.sort_index()

            # Split-adjust historical share counts to current share basis
            splits = yf_t.splits
            if splits is not None and not splits.empty:
                splits_df = splits.copy()
                splits_df.index = pd.to_datetime(splits_df.index).tz_localize(None)
                for dt in shares_series.index:
                    post_splits = splits_df[splits_df.index > dt]
                    if not post_splits.empty:
                        shares_series.loc[dt] = shares_series.loc[dt] * float(post_splits.prod())
    except Exception:
        pass

    # Calculate TTM summary KPIs
    ttm_rev = float(rev_raw[-4:].sum()) if len(rev_raw) >= 4 else float(rev_raw.sum())
    ttm_gp = float(gp_raw[-4:].sum()) if len(gp_raw) >= 4 else float(gp_raw.sum())
    ttm_op = float(op_raw[-4:].sum()) if len(op_raw) >= 4 else float(op_raw.sum())
    ttm_ebitda = float(ebitda_raw[-4:].sum()) if len(ebitda_raw) >= 4 else float(ebitda_raw.sum())
    ttm_ni = float(ni_raw[-4:].sum()) if len(ni_raw) >= 4 else float(ni_raw.sum())
    ttm_fcf = float(fcf_raw[-4:].sum()) if len(fcf_raw) >= 4 else float(fcf_raw.sum())
    ttm_sbc = float(sbc_raw[-4:].sum()) if len(sbc_raw) >= 4 else float(sbc_raw.sum())
    ttm_real_fcf = float(real_fcf_raw[-4:].sum()) if len(real_fcf_raw) >= 4 else float(real_fcf_raw.sum())
    ttm_sbc_pct = round(ttm_sbc / ttm_rev * 100, 1) if ttm_rev > 0 else 0.0

    ttm_gross_margin = round((ttm_gp / ttm_rev * 100), 2) if ttm_rev > 0 else 0.0
    ttm_op_margin = round((ttm_op / ttm_rev * 100), 2) if ttm_rev > 0 else 0.0
    ttm_ebitda_margin = round((ttm_ebitda / ttm_rev * 100), 2) if ttm_rev > 0 else 0.0
    ttm_net_margin = round((ttm_ni / ttm_rev * 100), 2) if ttm_rev > 0 else 0.0
    ttm_fcf_conversion = round((ttm_fcf / ttm_ni * 100), 1) if ttm_ni > 0 else None

    shares = get_shares_outstanding(ticker, latest_price)

    eps_ttm = (ttm_ni / shares) if shares > 0 else 0.0
    ttm_pe = round(latest_price / eps_ttm, 2) if eps_ttm > 0 else 0.0
    ttm_ps = round((latest_price * shares) / ttm_rev, 2) if (shares > 0 and ttm_rev > 0) else 0.0

    # Historical Valuation Ratios & Capital Efficiency per quarter
    q_dates = df["dt"].values
    for i, q in enumerate(quarters):
        t4q_ni = ni_raw[max(0, i-3):i+1].sum()
        t4q_rev = rev_raw[max(0, i-3):i+1].sum()
        t4q_op = op_raw[max(0, i-3):i+1].sum()
        t4q_fcf = fcf_raw[max(0, i-3):i+1].sum()

        if i < 3:
            t4q_ni = t4q_ni * (4 / (i + 1))
            t4q_rev = t4q_rev * (4 / (i + 1))
            t4q_op = t4q_op * (4 / (i + 1))
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

        # ROIC % Calculation: NOPAT (after-tax operating profit) / Invested Capital
        nopat = t4q_op * 0.79
        roic_val = None
        if not ic_series.empty:
            diffs = (ic_series.index - q_dt).days
            valid_ic = ic_series[np.abs(diffs) <= 120]
            if not valid_ic.empty:
                ic_v = float(valid_ic.iloc[-1])
                if ic_v > 0:
                    roic_val = round((nopat / ic_v) * 100.0, 1)
        if roic_val is None and not ic_series.empty:
            earliest_ic = float(ic_series.iloc[0])
            if earliest_ic > 0 and t4q_rev > 0:
                ic_ratio = earliest_ic / (rev_raw[-1] * 4 if len(rev_raw) > 0 and rev_raw[-1] > 0 else 1.0)
                est_ic = max(1.0, t4q_rev * ic_ratio)
                roic_val = round((nopat / est_ic) * 100.0, 1)

        # Share Count YoY (Buyback vs Dilution)
        share_yoy = None
        if not shares_series.empty:
            cur_s = shares_series[shares_series.index <= q_dt]
            prev_s = shares_series[shares_series.index <= (q_dt - pd.DateOffset(days=365))]
            if not cur_s.empty and not prev_s.empty:
                s1 = float(cur_s.iloc[-1])
                s0 = float(prev_s.iloc[-1])
                if s0 > 0:
                    share_yoy = round(((s1 - s0) / s0) * 100.0, 2)

        # Continuous Cash & Debt per quarter
        q_cash_raw = get_closest_val(cash_series, q_dt, fallback=total_cash)
        q_debt_raw = get_closest_val(debt_series, q_dt, fallback=total_debt)
        q_eq_raw = get_closest_val(eq_series, q_dt, fallback=0.0)

        q_pb = None
        if q_eq_raw > 0 and q_mcap > 0:
            q_pb = round(float(q_mcap / q_eq_raw), 2)
        elif yf_info.get("priceToBook"):
            q_pb = round(float(yf_info.get("priceToBook")), 2)

        # Net Debt & EV / EBITDA per quarter
        q_nd = q_debt_raw - q_cash_raw
        q_ev = q_mcap + (q_nd or 0.0)
        t4q_ebitda = t4q_op * 1.22
        q_ev_ebitda = round(float(q_ev / t4q_ebitda), 1) if (t4q_ebitda > 0 and q_ev > 0) else ev_ebitda

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
        q["priceToBook"] = q_pb if (q_pb and 0 < q_pb < 150) else None
        q["evEbitda"] = q_ev_ebitda if (q_ev_ebitda and 0 < q_ev_ebitda < 150) else ev_ebitda
        q["fcfYield"] = q_fcf_yield if (q_fcf_yield is not None and -50 < q_fcf_yield < 50) else None
        q["epsTTM"] = round(float(eps_q), 2) if eps_q > 0 else None
        q["roic"] = roic_val if (roic_val is not None and -50 < roic_val < 250) else None
        q["shareCountYoY"] = share_yoy
        q["cash"] = round(float(q_cash_raw) / divisor, 2)
        q["debt"] = round(float(q_debt_raw) / divisor, 2)
        q["netDebt"] = round(float(q_nd) / divisor, 2)

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
    roics = [q["roic"] for q in quarters if q.get("roic") is not None]
    latest_roic = roics[-1] if roics else None
    avg_roic_5y = round(float(np.mean(roics[-20:])), 1) if roics else None

    share_yoys = [q["shareCountYoY"] for q in quarters if q.get("shareCountYoY") is not None]
    latest_share_yoy = share_yoys[-1] if share_yoys else None

    # 5-Year Net Change in Share Count (Split-Adjusted)
    share_change_5y = None
    if not shares_series.empty:
        cur_s = float(shares_series.iloc[-1])
        target_dt = shares_series.index[-1] - pd.DateOffset(years=5)
        past_s = shares_series[shares_series.index <= target_dt]
        if not past_s.empty:
            old_s = float(past_s.iloc[-1])
        else:
            old_s = float(shares_series.iloc[0])
        if old_s > 0:
            share_change_5y = round(((cur_s - old_s) / old_s) * 100.0, 2)

    try:
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
        "ttmRealFCF": round(ttm_real_fcf / divisor, 2),
        "ttmSBC": round(ttm_sbc / divisor, 2),
        "sbcPctOfRev": ttm_sbc_pct,
        "ttmGrossMargin": ttm_gross_margin,
        "ttmOperatingMargin": ttm_op_margin,
        "ttmEbitda": round(ttm_ebitda / divisor, 2),
        "ttmEbitdaMargin": ttm_ebitda_margin,
        "ttmNetMargin": ttm_net_margin,
        "ttmPE": ttm_pe,
        "ttmPS": ttm_ps,
        "evEbitda": ev_ebitda,
        "totalDebt": round(total_debt / divisor, 2),
        "totalCash": round(total_cash / divisor, 2),
        "netDebt": round(net_debt / divisor, 2),
        "isNetCash": is_net_cash,
        "netDebtLabel": net_debt_label,
        "netDebtSub": net_debt_sub,
        "latestROIC": latest_roic,
        "avgROIC5Y": avg_roic_5y,
        "latestShareCountYoY": latest_share_yoy,
        "shareChange5Y": share_change_5y,
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
        "priceToBook": round(float(yf_info.get("priceToBook")), 2) if yf_info.get("priceToBook") else None,
        "bookValue": round(float(yf_info.get("bookValue")), 2) if yf_info.get("bookValue") else None,
        "industryPE": industry_benchmarks.get("pe"),
        "industryPS": industry_benchmarks.get("ps"),
        "industryPB": industry_benchmarks.get("pb"),
        "industryRevGrowth": industry_benchmarks.get("revGrowth"),
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

