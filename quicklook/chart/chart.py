import numpy as np
import matplotlib.pyplot as plt

def plot_financial_data(net_income_data, ebida_data, revenue_data):
    net_income_data = net_income_data[::-1]
    revenue_data = revenue_data[::-1]
    ebida_data = ebida_data[::-1]
    
    net_income = [int(item['data']) for item in net_income_data]
    ebida = [int(item['data']) for item in ebida_data]
    revenue = [int(item['data']) for item in revenue_data]
    dates = [item['date'] for item in net_income_data]
    
    x = np.arange(len(revenue))
    plt.bar(x, revenue, color="#1f77b4", alpha=0.9, label='Revenue')
    plt.bar(x, ebida, color="#ff7f0e", alpha=0.7, label='EBITDA')
    plt.bar(x, net_income, color="#2ca02c", alpha=0.5, label='Net Income')
    plt.xticks(x, dates, rotation=90)
    plt.legend()
    plt.tight_layout()
    plt.show()