import numpy as np
import matplotlib.pyplot as plt
import mpl_axes_aligner

def plot_financial_data(
        stock_prices: list[dict[str, str]] = None, 
        stock_name: str =None, 
        **datasets: list[dict[str, str]]
    ):
    colors = plt.cm.tab20.colors
    _, ax1 = plt.subplots(figsize=(10, 6))

    for idx, (label, data) in enumerate(datasets.items()):
        values = [float(item['data']) for item in data]
        dates = [item['date'] for item in data]
        x = np.arange(len(dates))
        ax1.bar(x, values, color=colors[idx % len(colors)], alpha=0.9, label=label)

    stock_dates = [item['date'] for item in stock_prices]
    stock_values = [item['data'] for item in stock_prices]
    first_value = stock_values[0]
    stock_values = [stock_value - first_value for stock_value in stock_values]
    stock_x = np.linspace(0, len(dates)-1, len(stock_dates))

    # graph configs
    plt.title(f"{stock_name} Financials and Stock Price")
    ax1.set_xticks(x)
    ax1.set_xticklabels(dates, rotation=90)
    ax1.legend(loc='upper left')
    ax1.set_ylabel("Financials")
    ax1.grid(True, alpha=0.3)

    ax2 = ax1.twinx()
    ax2.plot(stock_x, stock_values, color='black', linewidth=2, marker='', alpha=0.8)
    ax2.legend(loc='upper right')
    plt.tight_layout()
    mpl_axes_aligner.align.yaxes(ax1, 0, ax2, 0)
    plt.savefig(f'graph_output/normal/{stock_name}.png', format='png', dpi=300)