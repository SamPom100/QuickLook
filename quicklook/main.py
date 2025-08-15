from data.datasource import DataSource
from chart.chart import plot_financial_data

STOCK = 'AMZN'

datasource = DataSource()

try:
    revenue = datasource.get_revenue(STOCK)
    gross_profit = datasource.get_gross_profit(STOCK)
    operating_income = datasource.get_operating_income(STOCK)
    net_income = datasource.get_net_income(STOCK)

    dates = [item['date'] for item in revenue]

    stock_price_history = datasource.get_stock_price_history(STOCK, dates[-1], dates[0])
except Exception as e:
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