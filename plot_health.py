import sys
import os
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np
from data.data_service import FinancialDataService


def plot_dashboard(ticker: str, save_path: str = "dashboard.png"):
    service = FinancialDataService()
    summary = service.get_company_summary(ticker)
    
    analysis = service.get_financial_analysis(ticker, period="quarterly")
    val_df = service.get_valuation_history(ticker, period="10y")

    if not analysis:
        print(f"No financial data available for {ticker}")
        return

    df_stmt = pd.DataFrame(analysis)
    df_stmt["dt"] = pd.to_datetime(df_stmt["period_end_date"])
    df_stmt = df_stmt.sort_values("dt").reset_index(drop=True)

    dates = [d.strftime('%Y-%m-%d') for d in df_stmt["dt"]]
    
    rev = (pd.to_numeric(df_stmt["revenue"], errors="coerce") / 1e9).fillna(0).tolist()
    gross_prof = (pd.to_numeric(df_stmt["gross_profit"], errors="coerce") / 1e9).fillna(0).tolist()
    op_inc = (pd.to_numeric(df_stmt["operating_income"], errors="coerce") / 1e9).fillna(0).tolist()
    net_inc = (pd.to_numeric(df_stmt["net_income"], errors="coerce") / 1e9).fillna(0).tolist()

    stock_name = ticker.upper()
    colors = plt.cm.tab20.colors
    num_q = len(df_stmt)

    fig, ax1 = plt.subplots(figsize=(10, 6))
    x_bars = np.arange(num_q)

    # Concentric bars with decreasing widths
    bar_specs = [
        ("Revenue",          rev,        colors[0],  0.85),
        ("Gross Profit",     gross_prof, colors[1],  0.65),
        ("Operating Income", op_inc,     colors[3],  0.45),
        ("Net Income",       net_inc,    colors[5],  0.28),
    ]

    for qi in range(num_q):
        entries = [(label, vals[qi], color, width) for label, vals, color, width in bar_specs]
        entries.sort(key=lambda e: abs(e[1]), reverse=True)
        for label, val, color, width in entries:
            ax1.bar(qi, val, width=width, color=color, alpha=0.9,
                    label=label if qi == 0 else None)

    # Actual stock price on right axis
    ax2 = ax1.twinx()
    if not val_df.empty:
        val_df = val_df.sort_index()
        p_dates = pd.to_datetime(val_df.index)
        prices = val_df["Close"].values
        
        start_date = df_stmt["dt"].min()
        mask = p_dates >= start_date
        filt_prices = prices[mask]

        if len(filt_prices) > 0:
            stock_x = np.linspace(0, num_q, len(filt_prices))
            ax2.plot(stock_x, filt_prices, color='black', linewidth=2, 
                     marker='', alpha=0.8)

    # X-axis
    tick_positions = list(np.arange(num_q + 1))
    tick_labels = list(dates) + ["Today"]

    plt.title(f"{stock_name} Financials and Stock Price")
    ax1.set_xticks(tick_positions)
    ax1.set_xticklabels(tick_labels, rotation=90)
    ax1.legend(loc='upper left')
    ax1.grid(True, alpha=0.3)
    ax1.set_xlim(-0.6, num_q + 0.6)
    ax1.set_ylabel("$B", fontsize=10)
    ax1.tick_params(axis='y', labelsize=8)
    ax2.set_ylabel("Stock Price ($)", fontsize=10)
    ax2.set_ylim(bottom=0)
    ax2.tick_params(axis='y', labelsize=8)

    plt.tight_layout()
    plt.savefig(save_path, format='png', dpi=300)
    print(f"✅ Dashboard saved to: {os.path.abspath(save_path)}")
    plt.close()


if __name__ == "__main__":
    ticker_input = sys.argv[1] if len(sys.argv) > 1 else "MSFT"
    out_file = f"{ticker_input.lower()}_dashboard.png"
    plot_dashboard(ticker_input, save_path=out_file)
