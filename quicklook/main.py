from data.datasource import DataSource
from chart.chart import plot_financial_data

STOCK = 'AMZN'

s = DataSource()

# s.delete_all(STOCK)

revenue = s.get_revenue(STOCK)
gross_profit = s.get_gross_profit(STOCK)
operating_income = s.get_operating_income(STOCK)
ebitda = s.get_ebitda(STOCK)
net_income = s.get_net_income(STOCK)

dates = [item['date'] for item in revenue]

stock_price_history = s.get_stock_price_history(STOCK, dates[-1], dates[0])

plot_financial_data(
    Revenue=revenue,
    Gross_Profit=gross_profit,
    Operating_Income=operating_income,
    Net_Income=net_income,
    stock_prices=stock_price_history,
    stock_name=STOCK
)