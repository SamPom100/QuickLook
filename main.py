import sys
from data.data_service import FinancialDataService


def format_currency(val):
    if val is None:
        return "N/A"
    abs_val = abs(val)
    sign = "-" if val < 0 else ""
    if abs_val >= 1e12:
        return f"{sign}${abs_val / 1e12:.2f}T"
    elif abs_val >= 1e9:
        return f"{sign}${abs_val / 1e9:.2f}B"
    elif abs_val >= 1e6:
        return f"{sign}${abs_val / 1e6:.2f}M"
    else:
        return f"{sign}${val:,.2f}"


def format_pct(val):
    if val is None:
        return "N/A"
    return f"{val:+.1f}%"


def inspect_ticker(ticker: str):
    service = FinancialDataService()
    print(f"\n=======================================================")
    print(f" FETCHING FINANCIAL DATA FOR: {ticker.upper()}")
    print(f"=======================================================")

    summary = service.get_company_summary(ticker)
    print(f"Company Name: {summary.name}")
    print(f"Sector:       {summary.sector}")
    print(f"Industry:     {summary.industry}")
    print(f"Market Cap:   {format_currency(summary.market_cap)}")
    print(f"Shares Out:   {summary.shares_outstanding:,}" if summary.shares_outstanding else "Shares Out: N/A")

    print("\n--- HISTORICAL FINANCIAL STATEMENTS (Annual) ---")
    analysis = service.get_financial_analysis(ticker, period="annual")

    if not analysis:
        print("No financial statement data found.")
        return

    # Print clean formatted table
    dates = [stmt["period_end_date"] for stmt in analysis]
    header = f"{'Metric':<25} | " + " | ".join(f"{d:^12}" for d in dates)
    print("-" * len(header))
    print(header)
    print("-" * len(header))

    def print_row(label, key, is_pct=False):
        row_str = f"{label:<25} | "
        formatted_vals = []
        for stmt in analysis:
            val = stmt.get(key)
            if is_pct:
                formatted_vals.append(f"{format_pct(val):^12}")
            else:
                formatted_vals.append(f"{format_currency(val):^12}")
        row_str += " | ".join(formatted_vals)
        print(row_str)

    print_row("Total Revenue", "revenue")
    print_row("Revenue YoY Growth", "yoy_revenue_growth_pct", is_pct=True)
    print_row("Gross Profit", "gross_profit")
    print_row("Gross Margin", "gross_margin_pct", is_pct=True)
    print_row("Net Income (Profit)", "net_income")
    print_row("Net Income YoY Growth", "yoy_net_income_growth_pct", is_pct=True)
    print_row("Net Profit Margin", "net_margin_pct", is_pct=True)
    print_row("Operating Cash Flow", "operating_cash_flow")
    print_row("Capital Expenditure", "capital_expenditure")
    print_row("Free Cash Flow", "free_cash_flow")
    print_row("FCF YoY Growth", "yoy_fcf_growth_pct", is_pct=True)
    print_row("FCF Margin", "fcf_margin_pct", is_pct=True)
    print_row("Diluted EPS", "diluted_eps")
    print("-" * len(header))

    print("\n--- VALUATION & P/E RATIO SAMPLE ---")
    val_df = service.get_valuation_history(ticker, period="1y")
    if not val_df.empty and "P/E" in val_df.columns:
        valid_pe = val_df.dropna(subset=["P/E"])
        if not valid_pe.empty:
            latest_pe = valid_pe.iloc[-1]
            print(f"Latest Close Price: ${latest_pe['Close']:.2f}")
            print(f"Latest Implied P/E: {latest_pe['P/E']:.2f}x")
        else:
            print("Latest Close Price:", f"${val_df.iloc[-1]['Close']:.2f}")


if __name__ == "__main__":
    ticker_input = sys.argv[1] if len(sys.argv) > 1 else "AAPL"
    inspect_ticker(ticker_input)
