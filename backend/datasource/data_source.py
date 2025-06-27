from cache import URLCache
from .parse_table import _mlq_parse_helper, _parse_table_helper, _parse_pe_helper

class DataSource:
    def __init__(self) -> None:
        self.url_cache = URLCache()

    ### MACRO TRENDS DATA SOURCE METHODS ###

    def get_revenue(self, ticker: str) -> str:
        ticker = ticker.upper()
        url = f'https://www.macrotrends.net/stocks/charts/{ticker}/{ticker}/revenue'
        blob = self.url_cache.getURL(url)
        parsed_result = _parse_table_helper(blob)
        return parsed_result

    def get_gross_profit(self, ticker: str) -> str:
        ticker = ticker.upper()
        url = f'https://www.macrotrends.net/stocks/charts/{ticker}/{ticker}/gross-profit'
        blob = self.url_cache.getURL(url)
        parsed_result = _parse_table_helper(blob)
        return parsed_result

    def get_operating_income(self, ticker: str) -> str:
        ticker = ticker.upper()
        url = f'https://www.macrotrends.net/stocks/charts/{ticker}/{ticker}/operating-income'
        blob = self.url_cache.getURL(url)
        parsed_result = _parse_table_helper(blob)
        return parsed_result
    
    def get_ebita(self, ticker: str) -> str:
        ticker = ticker.upper()
        url = f'https://www.macrotrends.net/stocks/charts/{ticker}/{ticker}/ebitda'
        blob = self.url_cache.getURL(url)
        parsed_result = _parse_table_helper(blob)
        return parsed_result

    def get_net_income(self, ticker: str) -> str:
        ticker = ticker.upper()
        url = f'https://www.macrotrends.net/stocks/charts/{ticker}/{ticker}/net-income'
        blob = self.url_cache.getURL(url)
        parsed_result = _parse_table_helper(blob)
        return parsed_result

    def get_eps(self, ticker: str) -> str:
        ticker = ticker.upper()
        url = f'https://www.macrotrends.net/stocks/charts/{ticker}/{ticker}/eps-earnings-per-share-diluted'
        blob = self.url_cache.getURL(url)
        parsed_result = _parse_table_helper(blob)
        return parsed_result

    def get_shares_outstanding(self, ticker: str) -> str:
        ticker = ticker.upper()
        url = f'https://www.macrotrends.net/stocks/charts/{ticker}/{ticker}/shares-outstanding'
        blob = self.url_cache.getURL(url)
        parsed_result = _parse_table_helper(blob)
        return parsed_result
    
    def get_cash_flow(self, ticker: str) -> str:
        ticker = ticker.upper()
        url = f'https://www.macrotrends.net/stocks/charts/{ticker}/{ticker}/free-cash-flow'
        blob = self.url_cache.getURL(url)
        parsed_result = _parse_table_helper(blob)
        return parsed_result
    
    def get_pe_ratio(self, ticker: str) -> str:
        ticker = ticker.upper()
        url = f'https://www.macrotrends.net/stocks/charts/{ticker}/{ticker}/pe-ratio'
        blob = self.url_cache.getURL(url)
        parsed_result = _parse_pe_helper(blob)
        return parsed_result
    
    def seen_before(self, ticker: str) -> bool:
        ticker = ticker.upper()
        url = f'https://www.macrotrends.net/stocks/charts/{ticker}/{ticker}/shares-outstanding'
        return self.url_cache.seen_before(url)
    
    ### MLQ AI DATA SOURCE METHODS ###

    def get_ev(self, ticker: str) -> str:
        ticker = ticker.upper()
        url = f'https://mlq.ai/stocks/{ticker}/enterprise-value/'
        blob = self.url_cache.getURL(url)
        result = _mlq_parse_helper(blob)
        data = []
        for item in result:
            data.append({"date": item["date"], "data": item["ev"]})
        return data
    
    def get_stock_price(self, ticker: str) -> str:
        ticker = ticker.upper()
        url = f'https://mlq.ai/stocks/{ticker}/enterprise-value/'
        blob = self.url_cache.getURL(url)
        result = _mlq_parse_helper(blob)
        data = []
        for item in result:
            data.append({"date": item["date"], "data": item["stock_price"]})
        return data
    
    def get_market_cap(self, ticker: str) -> str:
        ticker = ticker.upper()
        url = f'https://mlq.ai/stocks/{ticker}/enterprise-value/'
        blob = self.url_cache.getURL(url)
        result = _mlq_parse_helper(blob)
        data = []
        for item in result:
            data.append({"date": item["date"], "data": item["market_cap"]})
        return data
    
    def get_cash(self, ticker: str) -> str:
        ticker = ticker.upper()
        url = f'https://mlq.ai/stocks/{ticker}/enterprise-value/'
        blob = self.url_cache.getURL(url)
        result = _mlq_parse_helper(blob)
        data = []
        for item in result:
            data.append({"date": item["date"], "data": item["cash"]})
        return data
    
    def get_debt(self, ticker: str) -> str:
        ticker = ticker.upper()
        url = f'https://mlq.ai/stocks/{ticker}/enterprise-value/'
        blob = self.url_cache.getURL(url)
        result = _mlq_parse_helper(blob)
        data = []
        for item in result:
            data.append({"date": item["date"], "data": item["debt"]})
        return data

if __name__ == "__main__":
    raise RuntimeError("Do not run this directly.")