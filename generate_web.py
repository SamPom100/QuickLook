import sys
import os
import json
import pandas as pd
import numpy as np
from data.data_service import FinancialDataService
from data.cache_manager import CacheManager
import requests


def generate_web(ticker: str, output_path: str = None):
    service = FinancialDataService()

    analysis = service.get_financial_analysis(ticker, period="quarterly")
    val_df = service.get_valuation_history(ticker, period="10y")

    if not analysis:
        print(f"No financial data available for {ticker}")
        return

    df_stmt = pd.DataFrame(analysis)
    df_stmt["dt"] = pd.to_datetime(df_stmt["period_end_date"])
    df_stmt = df_stmt.sort_values("dt").reset_index(drop=True)

    labels = [d.strftime('%Y-%m-%d') for d in df_stmt["dt"]]
    labels.append("Today")

    rev = (pd.to_numeric(df_stmt["revenue"], errors="coerce") / 1e9).fillna(0).round(2).tolist()
    gross_prof = (pd.to_numeric(df_stmt["gross_profit"], errors="coerce") / 1e9).fillna(0).round(2).tolist()
    op_inc = (pd.to_numeric(df_stmt["operating_income"], errors="coerce") / 1e9).fillna(0).round(2).tolist()
    net_inc = (pd.to_numeric(df_stmt["net_income"], errors="coerce") / 1e9).fillna(0).round(2).tolist()

    # No bar for the "Today" slot
    rev.append(None)
    gross_prof.append(None)
    op_inc.append(None)
    net_inc.append(None)

    # Downsample stock price to one value per quarter end + today
    stock_prices = []
    if not val_df.empty:
        val_df = val_df.sort_index()
        p_dates = pd.to_datetime(val_df.index)
        prices = val_df["Close"].values

        for _, row in df_stmt.iterrows():
            qd = row["dt"]
            diffs = abs(p_dates - qd)
            idx = diffs.argmin()
            stock_prices.append(round(float(prices[idx]), 2))

        # Today
        stock_prices.append(round(float(prices[-1]), 2))

    stock_name = ticker.upper()
    if output_path is None:
        output_path = f"/Users/sampomerantz/Desktop/{ticker.lower()}_dashboard.html"

    chart_data = json.dumps({
        "labels": labels,
        "revenue": rev,
        "grossProfit": gross_prof,
        "operatingIncome": op_inc,
        "netIncome": net_inc,
        "stockPrices": stock_prices,
        "ticker": stock_name,
    })

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{stock_name} Financial Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            background: #fff;
            font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            padding: 32px;
        }}
        .chart-container {{
            width: 100%;
            max-width: 1200px;
            position: relative;
        }}
    </style>
</head>
<body>
    <div class="chart-container">
        <canvas id="dashboard"></canvas>
    </div>
    <script>
    const D = {chart_data};

    // Custom plugin to draw concentric bars (overlapping bars with different widths)
    // Chart.js doesn't natively support per-dataset bar widths well,
    // so we draw them manually on a linear x-axis.
    const concentricBarPlugin = {{
        id: 'concentricBars',
        afterDatasetsDraw(chart) {{
            // We handle drawing in the datasets themselves
        }}
    }};

    const ctx = document.getElementById('dashboard');

    // We use a linear x-axis so we can control bar widths precisely
    const numPoints = D.labels.length;
    const indices = Array.from({{length: numPoints}}, (_, i) => i);

    const chart = new Chart(ctx, {{
        data: {{
            labels: indices,
            datasets: [
                // Revenue - widest bar, drawn first (behind)
                {{
                    type: 'bar',
                    label: 'Revenue',
                    data: D.revenue.map((v, i) => ({{ x: i, y: v }})),
                    backgroundColor: 'rgba(31, 119, 180, 0.9)',
                    barPercentage: 0.9,
                    categoryPercentage: 0.95,
                    order: 4,
                    yAxisID: 'y',
                }},
                // Gross Profit
                {{
                    type: 'bar',
                    label: 'Gross Profit',
                    data: D.grossProfit.map((v, i) => ({{ x: i, y: v }})),
                    backgroundColor: 'rgba(174, 199, 232, 0.9)',
                    barPercentage: 0.7,
                    categoryPercentage: 0.95,
                    order: 3,
                    yAxisID: 'y',
                }},
                // Operating Income
                {{
                    type: 'bar',
                    label: 'Operating Income',
                    data: D.operatingIncome.map((v, i) => ({{ x: i, y: v }})),
                    backgroundColor: 'rgba(255, 187, 120, 0.9)',
                    barPercentage: 0.5,
                    categoryPercentage: 0.95,
                    order: 2,
                    yAxisID: 'y',
                }},
                // Net Income - narrowest bar, drawn last (in front)
                {{
                    type: 'bar',
                    label: 'Net Income',
                    data: D.netIncome.map((v, i) => ({{ x: i, y: v }})),
                    backgroundColor: 'rgba(152, 223, 138, 0.9)',
                    barPercentage: 0.32,
                    categoryPercentage: 0.95,
                    order: 1,
                    yAxisID: 'y',
                }},
                // Stock price line
                {{
                    type: 'line',
                    label: 'Stock Price',
                    data: D.stockPrices.map((v, i) => ({{ x: i, y: v }})),
                    borderColor: 'rgba(0, 0, 0, 0.8)',
                    borderWidth: 2.5,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: '#000',
                    fill: false,
                    tension: 0.15,
                    order: 0,
                    yAxisID: 'y1',
                }},
            ],
        }},
        options: {{
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 10 / 6,
            interaction: {{
                mode: 'index',
                intersect: false,
            }},
            plugins: {{
                title: {{
                    display: true,
                    text: D.ticker + ' Financials and Stock Price',
                    font: {{ size: 18, weight: 'bold', family: '-apple-system, BlinkMacSystemFont, Helvetica Neue, sans-serif' }},
                    color: '#111',
                    padding: {{ top: 8, bottom: 20 }},
                }},
                legend: {{
                    position: 'top',
                    align: 'start',
                    labels: {{
                        usePointStyle: true,
                        pointStyle: 'rectRounded',
                        boxWidth: 14,
                        boxHeight: 14,
                        font: {{ size: 12 }},
                        padding: 16,
                        color: '#333',
                    }},
                }},
                tooltip: {{
                    backgroundColor: 'rgba(15, 15, 15, 0.92)',
                    titleFont: {{ size: 13, weight: 'bold' }},
                    bodyFont: {{ size: 12 }},
                    cornerRadius: 6,
                    padding: 12,
                    displayColors: true,
                    boxPadding: 4,
                    callbacks: {{
                        title: function(items) {{
                            const idx = items[0].dataIndex;
                            return D.labels[idx];
                        }},
                        label: function(ctx) {{
                            const val = ctx.parsed.y;
                            if (val === null || val === undefined) return null;
                            if (ctx.dataset.yAxisID === 'y1') {{
                                return ' ' + ctx.dataset.label + ': $' + val.toFixed(2);
                            }}
                            return ' ' + ctx.dataset.label + ': $' + val.toFixed(1) + 'B';
                        }}
                    }}
                }},
            }},
            scales: {{
                x: {{
                    type: 'category',
                    labels: D.labels,
                    stacked: false,
                    grouped: false,
                    grid: {{
                        display: false,
                    }},
                    ticks: {{
                        maxRotation: 90,
                        minRotation: 90,
                        font: {{ size: 9 }},
                        color: '#555',
                        autoSkip: false,
                    }},
                    border: {{
                        color: '#ccc',
                    }},
                }},
                y: {{
                    position: 'left',
                    beginAtZero: true,
                    title: {{
                        display: true,
                        text: '$B',
                        font: {{ size: 13, weight: '600' }},
                        color: '#333',
                    }},
                    grid: {{
                        color: 'rgba(0, 0, 0, 0.07)',
                    }},
                    ticks: {{
                        font: {{ size: 10 }},
                        color: '#555',
                    }},
                    border: {{
                        color: '#ccc',
                    }},
                }},
                y1: {{
                    position: 'right',
                    beginAtZero: true,
                    title: {{
                        display: true,
                        text: 'Stock Price ($)',
                        font: {{ size: 13, weight: '600' }},
                        color: '#333',
                    }},
                    grid: {{
                        drawOnChartArea: false,
                    }},
                    ticks: {{
                        font: {{ size: 10 }},
                        color: '#555',
                        callback: function(v) {{ return '$' + v; }}
                    }},
                    border: {{
                        color: '#ccc',
                    }},
                }},
            }},
        }},
    }});
    </script>
</body>
</html>"""

    with open(output_path, 'w') as f:
        f.write(html)
    
    print(f"✅ Web dashboard saved to: {output_path}")
    return output_path


if __name__ == "__main__":
    ticker_input = sys.argv[1] if len(sys.argv) > 1 else "MSFT"
    path = generate_web(ticker_input)
