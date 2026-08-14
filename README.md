# QuickLook Finance Dashboard

A fast, interactive stock & financial performance dashboard built with **React**, **D3.js**, **Python (Flask)**, and **Alpha Vantage**.

![MSFT Financial Dashboard](docs/msft_dashboard.png)

---

## 🌟 Key Features

* 📊 **Financial Performance & Stock Return (Tab 1):** Dual-pane interactive visualization comparing quarterly Revenue, Net Income, Free Cash Flow, and 10-year stock price history.
* 📈 **Valuation History (Tab 2):** Historical P/E Ratio, P/S Ratio, and Free Cash Flow Yield tracking over time.
* 🚀 **Relative Growth % Return (Tab 3):** Rebased percentage growth curves starting at `0% Baseline` to compare fundamental performance directly against share price returns.
* 🏷️ **Interactive Competitor Benchmarks:** Clickable peer ticker pills (e.g. `AAPL`, `GOOGL`, `AMZN`, `ORCL`, `WMT`) to compare valuations and load peer dashboards instantly.
* ⚡ **Optimized Parallel Data Engine:** Concurrent API fetching (`ThreadPoolExecutor`) and disk caching (`financial_cache.db`) for rapid loading.

---

## 🚀 Quick Start

Start both the backend API server (`http://127.0.0.1:5001`) and frontend app (`http://localhost:5173`) with a single command:

```bash
./start.sh
```

> **Note:** Pressing `Ctrl+C` cleanly shuts down both frontend and backend processes simultaneously.

---

## 🛠 Tech Stack

* **Frontend:** React, D3.js, Vite, Vanilla CSS
* **Backend:** Python 3, Flask, Pandas, NumPy, Requests
* **Data Sources:** Alpha Vantage API (Quarterly Reports & Valuation)
* **Storage & Caching:** SQLite Disk Cache (`cache/financial_cache.db`)
