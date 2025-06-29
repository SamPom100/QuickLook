from fastapi import FastAPI
from datasource import DataSource
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
data_source = DataSource()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # or ["*"] for all origins (not recommended for production)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Server:
    def __init__(self) -> None:
        self.app = FastAPI()

@app.get("/revenue/{ticker}")
def revenue(ticker: str):
    return data_source.get_revenue(ticker)

@app.get("/gross-profit/{ticker}")
def gross_profit(ticker: str):
    return data_source.get_gross_profit(ticker)

@app.get("/operating-income/{ticker}")
def operating_income(ticker: str):
    return data_source.get_operating_income(ticker)

@app.get("/ebitda/{ticker}")
def ebitda(ticker: str):
    return data_source.get_ebita(ticker)

@app.get("/net-income/{ticker}")
def net_income(ticker: str):
    return data_source.get_net_income(ticker)

@app.get("/eps/{ticker}")
def eps(ticker: str):
    return data_source.get_eps(ticker)

@app.get("/shares-outstanding/{ticker}")
def shares_outstanding(ticker: str):
    return data_source.get_shares_outstanding(ticker)

@app.get("/cash-flow/{ticker}")
def cash_flow(ticker: str):
    return data_source.get_cash_flow(ticker)

@app.get("/pe-ratio/{ticker}")
def pe_ratio(ticker: str):
    return data_source.get_pe_ratio(ticker)

@app.get("/seen-before/{ticker}")
def seen_before(ticker: str):
    return data_source.seen_before(ticker)

@app.get("/ev/{ticker}")
def ev(ticker: str):
    return data_source.get_ev(ticker)

@app.get("/stock-price/{ticker}")
def stock_price(ticker: str):
    return data_source.get_stock_price(ticker)

@app.get("/market-cap/{ticker}")
def market_cap(ticker: str):
    return data_source.get_market_cap(ticker)

@app.get("/cash/{ticker}")
def cash(ticker: str):
    return data_source.get_cash(ticker)

@app.get("/debt/{ticker}")
def debt(ticker: str):
    return data_source.get_debt(ticker)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
    # To run the server, use the command: uvicorn main:app --reload