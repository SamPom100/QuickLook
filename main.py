from datasource import DataSource

data_source = DataSource()

aapl_revenue = data_source.get_revenue("AAPL")
print(aapl_revenue)