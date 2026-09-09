# QuickLook // Financial Terminal v4

A high-performance, single-page financial terminal designed for investors and fundamental analysts. Built with **React**, **D3.js**, and **Python (Flask)** in a minimalist Monokai terminal aesthetic.

![QuickLook Terminal](docs/dashboard.png)

---

## ⚡ Overview

QuickLook replaces cluttered multi-tab financial portals with a single, high-density fundamental analysis cockpit. Every card features interactive D3 sparklines with cursor scrubbing, reference baselines, and peer benchmarks.

### 🏛️ The 4 Fundamental Pillars

1. **01 Valuation & Industry Benchmarks**
   - **Stock Price**: Historical trajectory, timeframe return percentage, and 52-week/5-year price range.
   - **P/E Multiple**: Historical valuation multiple expansion/compression with **5-Year Median** and **Industry Median** baseline reference lines. Includes interactive peer competitor footers (e.g. `ORCL`, `PANW`, `CRWD`, `NOW`).
   - **P/S Multiple**: Price-to-Sales valuation history with dynamic industry median anchors.

2. **02 Income & Expenses**
   - **Quarterly Revenue**: Top-line revenue progression with YoY growth rate callout.
   - **Gross Profit**: Core profitability with gross margin badge.
   - **Operating Expenses**: Operating cost discipline with OpEx % of Revenue tracking.
   - **Net Income**: Bottom-line profit trajectory with net margin badge.

3. **03 Margins & Efficiency**
   - **Gross Margin (%)**, **Operating Margin (%)**, and **Net Margin (%)**: Multi-year margin expansion or compression trends.
   - **EPS (TTM)**: Trailing twelve-month earnings power progression with 5-Year CAGR.

4. **04 Cash Flow & Growth**
   - **Free Cash Flow**: Real cash generated with FCF Yield benchmark.
   - **FCF Conversion %**: Earnings quality ratio tracking cash conversion efficiency (FCF / Net Income).
   - **YoY Revenue Growth**: Normalized quarter-over-quarter expansion rates with 5-Year historical average.

---

## 🌟 Core Highlights

* **🎯 1:1 SVG Pixel Scrubbing**: Real-time cursor tracking on all charts with true circle markers, crisp 1px guidelines, and dynamic metric inspection on hover.
* **🏢 Dynamic Industry Medians**: Queries industry constituent leaders on the fly via `yfinance.Industry` — zero hardcoding.
* **🏷️ Competitor Discovery**: Automatic peer group discovery and sorting by market capitalization relevance via Finnhub.
* **⚡ Fail-Fast & Fault Tolerance**:
  - Validates ticker symbols in <100ms before querying data providers.
  - Card-level error boundaries (`MonokaiErrorBoundary`) ensure that if any individual metric is missing or fails to calculate, a clean error card is displayed instead of a blank chart.
* **🔒 Zero Secrets in Git**: Automated environment credential restoration from your private GitHub Gist upon cloning, keeping personal API keys completely out of public commits.
* **💾 Resilient SQLite Caching**: Standardized local database caching (`cache/financial_cache.db`) ensures instant sub-second reloads without burning API quotas.

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js & npm
- (Optional) GitHub CLI (`gh`) for automated `.env` Gist synchronization

### Running Locally

Launch both the backend API server (`http://127.0.0.1:5001`) and frontend app (`http://localhost:5173`) with one command:

```bash
./start.sh
```

> **Note:** Pressing `Ctrl+C` cleanly terminates both backend and frontend processes simultaneously.

---

## 🛠 Tech Stack

* **Frontend:** React, D3.js, Vite, Monokai Design System
* **Backend:** Python 3, Flask, Flask-CORS, Pandas, NumPy, Requests
* **Data Providers:** Alpha Vantage API, Yahoo Finance (`yfinance`), Finnhub API
* **Caching & Storage:** SQLite Disk Cache (`cache/financial_cache.db`)
