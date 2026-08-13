import os
import sys
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np
import mpl_axes_aligner
from data.data_service import FinancialDataService


def generate_both(ticker: str = "MSFT"):
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
    
    rev = (pd.to_numeric(df_stmt["revenue"], errors="coerce")).fillna(0).tolist()
    gross_prof = (pd.to_numeric(df_stmt["gross_profit"], errors="coerce")).fillna(0).tolist()
    op_inc = (pd.to_numeric(df_stmt["operating_income"], errors="coerce")).fillna(0).tolist()
    net_inc = (pd.to_numeric(df_stmt["net_income"], errors="coerce")).fillna(0).tolist()

    datasets = {
        "Revenue": [{"date": d, "data": v} for d, v in zip(dates, rev)],
        "Gross Profit": [{"date": d, "data": v} for d, v in zip(dates, gross_prof)],
        "Operating Income": [{"date": d, "data": v} for d, v in zip(dates, op_inc)],
        "Net Income": [{"date": d, "data": v} for d, v in zip(dates, net_inc)],
    }

    stock_prices = []
    if not val_df.empty:
        val_df = val_df.sort_index()
        p_dates = pd.to_datetime(val_df.index)
        prices = val_df["Close"].values
        min_date = df_stmt["dt"].min()
        max_date = df_stmt["dt"].max()
        mask = (p_dates >= min_date) & (p_dates <= max_date)
        for d, p in zip(p_dates[mask], prices[mask]):
            stock_prices.append({"date": d.strftime('%Y-%m-%d'), "data": float(p)})

    stock_name = ticker.upper()
    colors = plt.cm.tab20.colors

    # -------------------------------------------------------------
    # 1. OLD VERSION: basic_chart.py
    # -------------------------------------------------------------
    fig, ax1 = plt.subplots(figsize=(10, 6))

    for idx, (label, data) in enumerate(datasets.items()):
        values = [float(item['data']) for item in data]
        dates_list = [item['date'] for item in data]
        x = np.arange(len(dates_list))
        ax1.bar(x, values, color=colors[idx % len(colors)], alpha=0.9, label=label)

    stock_dates = [item['date'] for item in stock_prices]
    stock_values = [float(item['data']) for item in stock_prices]
    first_value = stock_values[0] if stock_values else 1
    
    # basic_chart.py dollar difference
    stock_values_diff = [stock_value - first_value for stock_value in stock_values]
    stock_x = np.linspace(0, len(dates_list)-1, len(stock_dates))

    plt.title(f"{stock_name} Financials and Stock Price")
    ax1.set_xticks(x)
    ax1.set_xticklabels(dates_list, rotation=90)
    ax1.legend(loc='upper left')
    ax1.set_ylabel("Financials")
    ax1.grid(True, alpha=0.3)

    ax2 = ax1.twinx()
    ax2.plot(stock_x, stock_values_diff, color='black', linewidth=2, marker='', alpha=0.8)
    plt.tight_layout()
    try:
        mpl_axes_aligner.align.yaxes(ax1, 0, ax2, 0)
    except Exception:
        pass

    path_old = "/Users/sampomerantz/Desktop/msft_chart_old_basic.png"
    plt.savefig(path_old, format='png', dpi=300)
    plt.close()
    print(f"✅ Saved OLD (basic_chart.py) to: {path_old}")

    # -------------------------------------------------------------
    # 2. NEW VERSION: wip_chart.py
    # -------------------------------------------------------------
    fig, ax1 = plt.subplots(figsize=(10, 5))

    for idx, (label, data) in enumerate(datasets.items()):
        values = [float(item['data']) for item in data]
        dates_list = [item['date'] for item in data]
        x = np.arange(len(dates_list))
        ax1.bar(x, values, color=colors[idx % len(colors)], alpha=0.9, label=label)

    # wip_chart.py percentage return
    stock_values_pct = [(stock_value / first_value - 1) * 100 for stock_value in stock_values]
    stock_x = np.linspace(0, len(dates_list)-1, len(stock_dates))

    plt.title(f"{stock_name} Financials and Stock Price", fontsize=10)
    ax1.set_xticks(x)
    ax1.set_xticklabels(dates_list, rotation=90, fontsize=8)
    ax1.legend(loc='upper left', fontsize=8)
    ax1.set_ylabel("Financials", fontsize=9)
    ax1.grid(True, alpha=0.3)
    
    def format_financials(x, p):
        if abs(x) >= 1e9:
            return f'${x/1e9:.1f}B'
        elif abs(x) >= 1e6:
            return f'${x/1e6:.1f}M'
        elif abs(x) >= 1e3:
            return f'${x/1e3:.1f}K'
        else:
            return f'${x:.0f}'
    
    ax1.yaxis.set_major_formatter(plt.FuncFormatter(format_financials))
    ax1.tick_params(axis='y', labelsize=8)

    ax2 = ax1.twinx()
    ax2.plot(stock_x, stock_values_pct, color='black', linewidth=2, marker='', alpha=0.8)
    ax2.set_ylabel("Stock Price Change (%)", fontsize=9)
    ax2.tick_params(axis='y', labelsize=8)
    ax2.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'{x:.1f}%'))
    
    plt.tight_layout()
    try:
        mpl_axes_aligner.align.yaxes(ax1, 0, ax2, 0)
    except Exception:
        pass

    path_new = "/Users/sampomerantz/Desktop/msft_chart_new_wip.png"
    plt.savefig(path_new, format='png', dpi=300)
    plt.close()
    print(f"✅ Saved NEW (wip_chart.py) to: {path_new}")


if __name__ == "__main__":
    generate_both("MSFT")
