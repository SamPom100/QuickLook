import React, { useState, useMemo } from 'react';
import SparkCard from './SparkCard';
import { MONOKAI } from './theme';

export default function MonokaiDashboard({ data }) {
  const [timeframe, setTimeframe] = useState('5Y'); // '1Y', '3Y', '5Y', 'ALL'

  const rawQuarters = data?.quarters || [];
  const rawStockPrices = data?.stockPrices || [];
  const kpis = data?.kpis || {};

  // Slice data by timeframe
  const { quarters, stockPrices } = useMemo(() => {
    let qSlice = [...rawQuarters];
    const map = { '1Y': 4, '3Y': 12, '5Y': 20, 'ALL': null };
    const maxQ = map[timeframe];
    if (maxQ && qSlice.length > maxQ) {
      qSlice = qSlice.slice(-maxQ);
    }
    const earliestDate = qSlice.length > 0 ? qSlice[0].date : '2000-01-01';
    const startIndex = rawQuarters.length - qSlice.length;

    // Filter stock prices: support sp.date OR sp.x
    let sSlice = rawStockPrices.filter((sp) => {
      if (sp.date) return sp.date >= earliestDate;
      if (sp.x !== undefined && sp.x !== null) return sp.x >= startIndex;
      return true;
    });

    // Fallback if filtering resulted in 0 items
    if (sSlice.length === 0 && rawStockPrices.length > 0) {
      const frac = rawQuarters.length > 0 ? qSlice.length / rawQuarters.length : 1;
      const count = Math.max(2, Math.round(rawStockPrices.length * frac));
      sSlice = rawStockPrices.slice(-count);
    }

    return { quarters: qSlice, stockPrices: sSlice };
  }, [rawQuarters, rawStockPrices, timeframe]);

  // Series data sets
  const stockSeries = useMemo(() => {
    if (!stockPrices || stockPrices.length === 0) return [];
    const totalQ = rawQuarters.length || 1;
    const startQDate = rawQuarters[0] ? new Date(rawQuarters[0].date).getTime() : Date.now();
    const endQDate = rawQuarters[rawQuarters.length - 1] ? new Date(rawQuarters[rawQuarters.length - 1].date).getTime() : Date.now();
    const totalSpanMs = Math.max(1, endQDate - startQDate);

    // Downsample to ~120 points for smooth scrubbing
    const step = Math.max(1, Math.floor(stockPrices.length / 120));
    const sampled = [];
    for (let i = 0; i < stockPrices.length; i += step) {
      const sp = stockPrices[i];
      let spDate = sp.date;
      if (!spDate && sp.x !== undefined) {
        const frac = Math.min(1, Math.max(0, sp.x / totalQ));
        const estMs = startQDate + frac * totalSpanMs;
        spDate = new Date(estMs).toISOString().slice(0, 10);
      }
      sampled.push({
        date: spDate || `P${i}`,
        value: Number(sp.y != null ? sp.y : sp.value),
      });
    }

    const lastSp = stockPrices[stockPrices.length - 1];
    if (lastSp) {
      sampled.push({
        date: lastSp.date || 'Today',
        value: Number(lastSp.y != null ? lastSp.y : lastSp.value),
      });
    }

    return sampled;
  }, [stockPrices, rawQuarters]);

  const revSeries = useMemo(() => {
    return quarters.map((q) => ({ date: q.date, value: q.revenue }));
  }, [quarters]);

  const niSeries = useMemo(() => {
    return quarters.map((q) => ({ date: q.date, value: q.netIncome }));
  }, [quarters]);

  const fcfSeries = useMemo(() => {
    return quarters.map((q) => ({ date: q.date, value: q.freeCashFlow }));
  }, [quarters]);

  const epsSeries = useMemo(() => {
    return quarters.map((q) => ({ date: q.date, value: q.epsTTM != null ? q.epsTTM : q.netIncome }));
  }, [quarters]);

  const peSeries = useMemo(() => {
    return quarters.map((q) => ({ date: q.date, value: q.peRatio })).filter((d) => d.value != null && d.value > 0 && d.value <= 120);
  }, [quarters]);

  const opMarginSeries = useMemo(() => {
    return quarters.map((q) => ({
      date: q.date,
      value: q.operatingMarginPct != null
        ? q.operatingMarginPct
        : (q.revenue ? Math.round((q.operatingIncome / q.revenue) * 1000) / 10 : 0)
    }));
  }, [quarters]);

  const yoyRevGrowthSeries = useMemo(() => {
    return quarters.map((q) => ({
      date: q.date,
      value: q.yoyRevenueGrowth != null ? q.yoyRevenueGrowth : 0
    }));
  }, [quarters]);

  // Latest values & returns
  const latestQ = quarters[quarters.length - 1] || {};
  const currentPrice = kpis.latestPrice || (stockPrices[stockPrices.length - 1]?.y) || 0;
  const prevPrice = stockPrices.length >= 2 ? (stockPrices[0].y != null ? stockPrices[0].y : stockPrices[0].value) : currentPrice;
  const stockReturnPct = prevPrice > 0 ? ((currentPrice - prevPrice) / prevPrice) * 100 : 0;

  return (
    <div style={{ width: '100%' }}>
      {/* Timeframe Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        background: MONOKAI.bgDark,
        border: `1px solid ${MONOKAI.border}`,
        borderRadius: 8,
        padding: '10px 18px',
        marginBottom: 18,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontFamily: MONOKAI.monoFont,
            fontSize: 11,
            fontWeight: 700,
            color: MONOKAI.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginRight: 4,
          }}>
            Time Horizon:
          </span>
          {['1Y', '3Y', '5Y', 'ALL'].map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              style={{
                fontFamily: MONOKAI.monoFont,
                fontSize: 11,
                fontWeight: timeframe === tf ? 700 : 500,
                padding: '4px 10px',
                borderRadius: 4,
                border: 'none',
                background: timeframe === tf ? MONOKAI.yellow : 'transparent',
                color: timeframe === tf ? MONOKAI.bgDark : MONOKAI.textDim,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {tf}
            </button>
          ))}
        </div>

        <span style={{
          fontFamily: MONOKAI.monoFont,
          fontSize: 11,
          color: MONOKAI.muted,
        }}>
          💡 Hover across cards to scrub through historical points
        </span>
      </div>

      {/* 8-Card Robinhood Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16,
      }}>
        {/* 1. Stock Price */}
        <SparkCard
          title="Stock Price"
          currentValue={`$${currentPrice.toFixed(2)}`}
          badgeText={`${stockReturnPct >= 0 ? '+' : ''}${stockReturnPct.toFixed(1)}% (${timeframe})`}
          badgePositive={stockReturnPct >= 0}
          dataPoints={stockSeries}
          color={stockReturnPct >= 0 ? MONOKAI.green : MONOKAI.pink}
          formatValue={(v) => `$${v.toFixed(2)}`}
          height={95}
          sublabel="Latest Close"
        />

        {/* 2. Quarterly Revenue */}
        <SparkCard
          title="Quarterly Revenue"
          currentValue={`$${(latestQ.revenue || 0).toFixed(2)}B`}
          badgeText={latestQ.yoyRevenueGrowth ? `+${latestQ.yoyRevenueGrowth.toFixed(1)}% YoY` : null}
          badgePositive={true}
          dataPoints={revSeries}
          color={MONOKAI.cyan}
          formatValue={(v) => `$${v.toFixed(2)}B`}
          height={95}
          sublabel={latestQ.date}
        />

        {/* 3. Net Income */}
        <SparkCard
          title="Net Income"
          currentValue={`$${(latestQ.netIncome || 0).toFixed(2)}B`}
          badgeText={latestQ.netMarginPct ? `${latestQ.netMarginPct.toFixed(1)}% Margin` : null}
          badgePositive={(latestQ.netIncome || 0) >= 0}
          dataPoints={niSeries}
          color={MONOKAI.green}
          formatValue={(v) => `$${v.toFixed(2)}B`}
          height={95}
          sublabel={latestQ.date}
        />

        {/* 4. Free Cash Flow */}
        <SparkCard
          title="Free Cash Flow"
          currentValue={`$${(latestQ.freeCashFlow || 0).toFixed(2)}B`}
          badgeText={kpis.fcfYield ? `${kpis.fcfYield.toFixed(1)}% Yield` : 'Operating Cash'}
          badgePositive={(latestQ.freeCashFlow || 0) >= 0}
          dataPoints={fcfSeries}
          color={MONOKAI.yellow}
          formatValue={(v) => `$${v.toFixed(2)}B`}
          height={95}
          sublabel={latestQ.date}
        />

        {/* 5. EPS (TTM) */}
        <SparkCard
          title="EPS (TTM)"
          currentValue={`$${(latestQ.epsTTM || kpis.epsTTM || 0).toFixed(2)}`}
          badgeText={kpis.epsGrowth5Y ? `${kpis.epsGrowth5Y.toFixed(1)}% 5Y CAGR` : null}
          badgePositive={(kpis.epsGrowth5Y || 0) >= 0}
          dataPoints={epsSeries}
          color={MONOKAI.orange}
          formatValue={(v) => `$${v.toFixed(2)}`}
          height={95}
          sublabel={latestQ.date}
        />

        {/* 6. P/E Multiple (TTM) */}
        <SparkCard
          title="P/E Multiple (TTM)"
          currentValue={latestQ.peRatio ? `${latestQ.peRatio.toFixed(1)}x` : (kpis.ttmPE ? `${kpis.ttmPE.toFixed(1)}x` : '—')}
          badgeText={kpis.medianPE5YClean ? `5Y Med ${kpis.medianPE5YClean.toFixed(1)}x` : null}
          badgePositive={true}
          dataPoints={peSeries}
          color={MONOKAI.purple}
          formatValue={(v) => `${v.toFixed(1)}x`}
          height={95}
          sublabel={latestQ.date}
        />

        {/* 7. Operating Margin */}
        <SparkCard
          title="Operating Margin"
          currentValue={latestQ.operatingMarginPct ? `${latestQ.operatingMarginPct.toFixed(1)}%` : '—'}
          badgeText="Op Efficiency"
          badgePositive={true}
          dataPoints={opMarginSeries}
          color={MONOKAI.cyan}
          formatValue={(v) => `${v.toFixed(1)}%`}
          height={95}
          sublabel={latestQ.date}
        />

        {/* 8. YoY Revenue Growth */}
        <SparkCard
          title="YoY Revenue Growth"
          currentValue={latestQ.yoyRevenueGrowth ? `${latestQ.yoyRevenueGrowth.toFixed(1)}%` : '—'}
          badgeText={kpis.avgRevGrowth5Y ? `5Y Avg ${kpis.avgRevGrowth5Y.toFixed(1)}%` : null}
          badgePositive={(latestQ.yoyRevenueGrowth || 0) >= 0}
          dataPoints={yoyRevGrowthSeries}
          color={MONOKAI.orange}
          formatValue={(v) => `${v.toFixed(1)}%`}
          height={95}
          sublabel={latestQ.date}
        />
      </div>
    </div>
  );
}
