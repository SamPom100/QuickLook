from sam_url_cache import URLCache
import os
import yfinance as yf
from .parse import parse_table_helper

class DataSource:
    def __init__(self):
        database_path = os.path.dirname(__file__) + "/cache.db"
        self._url_cache = URLCache(database_path)

    def get_revenue(self, ticker: str):
        url = f"https://www.macrotrends.net/stocks/charts/{ticker.upper()}/apple/revenue"
        url_result = self._url_cache.get_url(url)
        url_parsed = parse_table_helper(url_result, url)
        return url_parsed
    
    def get_gross_profit(self, ticker: str) -> str:
        url = f'https://www.macrotrends.net/stocks/charts/{ticker.upper()}/apple/gross-profit'
        url_result = self._url_cache.get_url(url)
        url_parsed = parse_table_helper(url_result, url)
        return url_parsed
    
    def get_operating_income(self, ticker: str) -> str:
        url = f'https://www.macrotrends.net/stocks/charts/{ticker.upper()}/apple/operating-income'
        url_result = self._url_cache.get_url(url)
        url_parsed = parse_table_helper(url_result, url)
        return url_parsed
    
    def get_ebitda(self, ticker: str) -> str:
        url = f'https://www.macrotrends.net/stocks/charts/{ticker.upper()}/apple/ebitda'
        url_result = self._url_cache.get_url(url)
        url_parsed = parse_table_helper(url_result, url)
        return url_parsed

    def get_net_income(self, ticker: str) -> str:
        url = f'https://www.macrotrends.net/stocks/charts/{ticker.upper()}/apple/net-income'
        url_result = self._url_cache.get_url(url)
        url_parsed = parse_table_helper(url_result, url)
        return url_parsed
    
    def get_eps(self, ticker: str) -> str:
        url = f'https://www.macrotrends.net/stocks/charts/{ticker.upper()}/apple/earnings-per-share-eps'
        url_result = self._url_cache.get_url(url)
        url_parsed = parse_table_helper(url_result, url)
        return url_parsed
    
    def get_shares_outstanding(self, ticker: str) -> str:
        url = f'https://www.macrotrends.net/stocks/charts/{ticker.upper()}/apple/shares-outstanding'
        url_result = self._url_cache.get_url(url)
        url_parsed = parse_table_helper(url_result, url)
        return url_parsed
    
    def get_cash_flow(self, ticker: str) -> str:
        url = f'https://www.macrotrends.net/stocks/charts/{ticker.upper()}/apple/free-cash-flow'
        url_result = self._url_cache.get_url(url)
        url_parsed = parse_table_helper(url_result, url)
        return url_parsed
    
    def get_stock_price(self, ticker: str, date_range: list[str]) -> list[dict]:
        date_range = date_range[::-1]
        begin_date = date_range[0]
        end_date = date_range[-1]
        ticker_obj = yf.Ticker(ticker)
        hist = ticker_obj.history(start=begin_date, end=end_date)
        hist.index = hist.index.strftime('%Y-%m-%d')
        hist = hist['Close']

        prices = []
        for date in date_range:
            if date in hist.index:
                price = hist.loc[date]
            else:
                prev_dates = hist.index[hist.index < date]
                if len(prev_dates) > 0:
                    price = hist.loc[prev_dates[-1]]
                else:
                    price = None
            if price is not None:
                price = round(float(price), 2)
            prices.append({'date': date, 'data': price})
        return prices
    
    def get_stock_price_history(self, ticker: str, start_date: str, end_date: str) -> list[dict]:
        import yfinance as yf

        ticker_obj = yf.Ticker(ticker)
        hist = ticker_obj.history(start=start_date, end=end_date)
        hist.index = hist.index.strftime('%Y-%m-%d')
        hist = hist['Close']

        prices = []
        for date, price in hist.items():
            prices.append({'date': date, 'data': round(float(price), 2)})
        return prices

    def delete_all(self, ticker: str) -> None:
        all_urls = [
            f"https://www.macrotrends.net/stocks/charts/{ticker.upper()}/apple/revenue",
            f"https://www.macrotrends.net/stocks/charts/{ticker.upper()}/apple/gross-profit",
            f"https://www.macrotrends.net/stocks/charts/{ticker.upper()}/apple/operating-income",
            f"https://www.macrotrends.net/stocks/charts/{ticker.upper()}/apple/ebitda",
            f"https://www.macrotrends.net/stocks/charts/{ticker.upper()}/apple/net-income",
            f"https://www.macrotrends.net/stocks/charts/{ticker.upper()}/apple/earnings-per-share-eps",
            f"https://www.macrotrends.net/stocks/charts/{ticker.upper()}/apple/shares-outstanding",
            f"https://www.macrotrends.net/stocks/charts/{ticker.upper()}/apple/free-cash-flow"
        ]
        for url in all_urls:
            self._url_cache.delete_url(url)