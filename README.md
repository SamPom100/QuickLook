# QuickLook

![QuickLook](docs/dashboard.png)

```bash
./start.sh
```

---

### 🔑 API Key (Free)

QuickLook includes pre-cached historical data for top tickers (e.g. `MSFT`, `AAPL`, `NVDA`, `META`). Competitor peers, industry medians, and price history are powered **100% by Yahoo Finance with zero API keys required**.

To fetch live financial statements for new tickers, you only need one free API key:

* **[Alpha Vantage API Key](https://www.alphavantage.co/support/#api-key)** — Standardized financial statements & quarterly filings.

#### How to Inject Key

Create a `.env` file in the root directory (or copy from `.env.example`):

```bash
cp .env.example .env
```

Add your key:
```env
ALPHAVANTAGE_KEY=your_alphavantage_key
```

*(Or export it directly in your shell: `export ALPHAVANTAGE_KEY=...`).*

#### What if you don't have a key?
- **Pre-cached tickers** (`MSFT`, `AAPL`, `NVDA`, `META`, `GOOGL`, etc.), all **Yahoo Finance price charts**, and **competitor peers & industry medians** work immediately with zero keys.
- Live statement queries for un-cached tickers will display an in-app notice until an Alpha Vantage key is provided.
