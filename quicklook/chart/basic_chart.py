import numpy as np
import matplotlib.pyplot as plt

def plot_financial_data(
        stock_prices: list[dict[str, str]] = None, 
        stock_name: str =None, 
        **datasets: list[dict[str, str]]
    ):
    colors = plt.cm.tab20.colors
    dates = None
    _, ax1 = plt.subplots(figsize=(10, 6))

    for idx, (label, data) in enumerate(datasets.items()):
        data = data[::-1]
        values = [float(item['data']) for item in data]
        if dates is None:
            dates = [item['date'] for item in data]
            x = np.arange(len(dates))
        ax1.bar(x, values, color=colors[idx % len(colors)], alpha=0.9, label=label)
    ax1.set_xticks(x)
    ax1.set_xticklabels(dates, rotation=90)
    ax1.legend(loc='upper left')
    ax1.set_ylabel("Financials")

    if stock_prices is not None:
        stock_dates = [item['date'] for item in stock_prices]
        stock_values = [item['data'] for item in stock_prices]
        stock_x = np.linspace(0, len(dates)-1, len(stock_dates))
        ax2 = ax1.twinx()
        ax2.plot(stock_x, stock_values, color='black', label='Stock Price', linewidth=2, marker='', alpha=0.8)
        ax2.set_ylabel("Stock Price")
        ax2.legend(loc='upper right')

    if stock_name is not None:
        plt.title(f"{stock_name} Financials and Stock Price")

    plt.tight_layout()
    plt.savefig(f'graph_output/{stock_name}.png', format='png', dpi=300)