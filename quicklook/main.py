import logging
from datetime import datetime
from data.datasource import DataSource
from chart.basic_chart import plot_financial_data

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO, 
    format='%(levelname)s: %(name)s: %(message)s'
)

STOCK = 'AMZN'  

datasource = DataSource()

try:
    revenue: list[dict[str, str]] = datasource.get_revenue(STOCK)
    gross_profit: list[dict[str, str]] = datasource.get_gross_profit(STOCK)
    operating_income: list[dict[str, str]] = datasource.get_operating_income(STOCK)
    net_income: list[dict[str, str]] = datasource.get_net_income(STOCK)

    today = datetime.now().strftime('%Y-%m-%d')
    dates: list[str] = [item['date'] for item in revenue]
    val = {'date': today, 'data': '0'}

    revenue.append(val)
    gross_profit.append(val)
    operating_income.append(val)
    net_income.append(val)

    stock_price_history: list[dict[str, str]] = datasource.get_stock_price_history(STOCK, dates[0], today)
except Exception as e:
    if "429" in str(e):
        logger.error(f"Rate limit exceeded when fetching data for {STOCK}. Slow down.")
        raise
    else:
        logger.error(f"Error fetching data for {STOCK}: {e}")
        datasource.delete_all(STOCK)
        raise e

plot_financial_data(
    Revenue=revenue,
    Gross_Profit=gross_profit,
    Operating_Income=operating_income,
    Net_Income=net_income,
    stock_prices=stock_price_history,
    stock_name=STOCK
)