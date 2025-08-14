from data.datasource import DataSource
from chart.chart import plot_financial_data


s = DataSource()
net_income = s.get_net_income("MSFT")
revenue = s.get_revenue("MSFT")
ebita = s.get_ebita("MSFT")

plot_financial_data(net_income, ebita, revenue)