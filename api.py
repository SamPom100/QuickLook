from flask import Flask, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
import json
import time
import requests
from data.data_service import FinancialDataService
from data.cache_manager import CacheManager

app = Flask(__name__)
CORS(app)

service = FinancialDataService()
cm = CacheManager()


def get_shares_outstanding(ticker: str, latest_price: float = 0.0) -> float:
    try:
        url = f'https://www.alphavantage.co/query?function=OVERVIEW&symbol={ticker.upper()}&apikey=YOUR_ALPHA_KEY_0'
        cached = cm.get_url_cache(url)
        if cached:
            overview = json.loads(cached) if isinstance(cached, str) else cached
        else:
            resp = requests.get(url, timeout=10)
            overview = resp.json()
            if isinstance(overview, dict) and "Information" not in overview and "Note" not in overview:
                cm.save_url_cache(url, json.dumps(overview))
        
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


@app.route("/api/data/<ticker>")
def get_data(ticker):
    ticker = ticker.upper()

    analysis = None
    val_df = None
    
    # Retry up to 2 times for rate-limited API calls
    for attempt in range(2):
        try:
            analysis = service.get_financial_analysis(ticker, period="quarterly")
            val_df = service.get_valuation_history(ticker, period="10y")
            if analysis and len(analysis) > 0:
                break
        except Exception as e:
            if attempt == 1:
                return jsonify({"error": str(e)}), 500
        time.sleep(1.5)

    if not analysis or len(analysis) == 0:
        return jsonify({"error": f"Alpha Vantage rate limit reached or no financial data for {ticker}. Please retry in 15 seconds."}), 429

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

    return jsonify({
        "ticker": ticker,
        "unitLabel": unit_label,
        "unitSuffix": unit_suffix,
        "quarters": quarters,
        "stockPrices": stock_prices,
        "kpis": kpis,
    })


if __name__ == "__main__":
    app.run(port=5001, debug=False)
