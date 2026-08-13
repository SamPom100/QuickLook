import sys
import json
import pandas as pd
import numpy as np
from data.data_service import FinancialDataService


def export_data(ticker: str, output_path: str):
    service = FinancialDataService()

    analysis = service.get_financial_analysis(ticker, period="quarterly")
    val_df = service.get_valuation_history(ticker, period="10y")

    if not analysis:
        print(f"No financial data available for {ticker}")
        return

    df = pd.DataFrame(analysis)
    df["dt"] = pd.to_datetime(df["period_end_date"])
    df = df.sort_values("dt").reset_index(drop=True)

    quarters = []
    for _, row in df.iterrows():
        quarters.append({
            "date": row["dt"].strftime("%Y-%m-%d"),
            "revenue": round(float(pd.to_numeric(row["revenue"], errors="coerce") or 0) / 1e9, 2),
            "grossProfit": round(float(pd.to_numeric(row["gross_profit"], errors="coerce") or 0) / 1e9, 2),
            "operatingIncome": round(float(pd.to_numeric(row["operating_income"], errors="coerce") or 0) / 1e9, 2),
            "netIncome": round(float(pd.to_numeric(row["net_income"], errors="coerce") or 0) / 1e9, 2),
        })

    # Daily stock prices filtered to the date range + extended to today
    stock_prices = []
    if not val_df.empty:
        val_df = val_df.sort_index()
        p_dates = pd.to_datetime(val_df.index)
        prices = val_df["Close"].values
        start_date = df["dt"].min()
        last_q_date = df["dt"].max()
        total_days = (last_q_date - start_date).days
        num_q = len(df)
        mask = p_dates >= start_date

        for d, p in zip(p_dates[mask], prices[mask]):
            day_offset = (d - start_date).days
            # Map to fractional quarter index (0 to num_q)
            x = (day_offset / total_days) * (num_q - 1) if total_days > 0 else 0
            # Extend proportionally past last quarter to "Today"
            stock_prices.append({
                "x": round(float(x), 4),
                "y": round(float(p), 2),
                "date": d.strftime("%Y-%m-%d"),
            })

    data = {
        "ticker": ticker.upper(),
        "quarters": quarters,
        "stockPrices": stock_prices,
    }

    with open(output_path, "w") as f:
        json.dump(data, f)

    print(f"✅ Exported {len(quarters)} quarters + {len(stock_prices)} stock prices to {output_path}")


if __name__ == "__main__":
    ticker = sys.argv[1] if len(sys.argv) > 1 else "MSFT"
    export_data(ticker, f"web/public/{ticker.lower()}.json")
