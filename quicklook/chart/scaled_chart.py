import numpy as np
import matplotlib.pyplot as plt
import mpl_axes_aligner

def plot_financial_data_scaled(
        stock_prices: list[dict[str, str]] = None, 
        stock_name: str = None, 
        **datasets: list[dict[str, str]]
    ):
    colors = plt.cm.tab20.colors
    _, ax1 = plt.subplots(figsize=(10, 6))

    # Get the reference date range from one of the datasets
    first_dataset = next(iter(datasets.values()))
    dates = [item['date'] for item in first_dataset]
    x = np.arange(len(dates))

    # Get revenue as the common baseline
    revenue_data = datasets.get('Revenue', first_dataset)
    revenue_values = [float(item['data']) for item in revenue_data]
    baseline_value = revenue_values[0] if revenue_values[0] != 0 else 1

    # Plot scaled financial data as bars using common baseline
    for idx, (label, data) in enumerate(datasets.items()):
        values = [float(item['data']) for item in data]
        scaled_values = [(v / baseline_value) * 100 for v in values]
        ax1.bar(x, scaled_values, color=colors[idx % len(colors)], alpha=0.9, label=label)

    # Scale stock price data starting from 0
    stock_dates = [item['date'][-2:] for item in stock_prices]
    stock_values = [float(item['data']) for item in stock_prices]
    
    # Interpolate stock prices to match financial data dates
    stock_x = np.linspace(0, len(dates)-1, len(stock_dates))
    
    # Scale stock prices to start from 0 (subtract initial value)
    initial_stock_price = stock_values[0]
    scaled_stock_values = [v - initial_stock_price for v in stock_values]
    
    ax1.set_xticks(x)
    ax1.set_xticklabels(dates, rotation=90)
    ax1.legend(loc='upper left')
    ax1.set_ylabel("Scaled Financials (% of Initial Revenue)")
    ax1.grid(True, alpha=0.3)

    ax2 = ax1.twinx()
    ax2.plot(stock_x, scaled_stock_values, color='black', linewidth=2, alpha=0.9)
    ax2.legend(loc='upper right')

    plt.title(f"{stock_name} Financials and Stock Price - Scaled")

    plt.tight_layout()
    mpl_axes_aligner.align.yaxes(ax1, 0, ax2, 0)
    plt.savefig(f'graph_output/scaled/{stock_name}_scaled.png', format='png', dpi=300)