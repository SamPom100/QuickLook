from datasource import DataSource

data_source = DataSource()

aapl_revenue = data_source.get_revenue("AAPL")
for row in aapl_revenue:
    print(row)