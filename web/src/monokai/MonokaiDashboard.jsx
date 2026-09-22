import React, { useState, useMemo } from 'react';
import SparkCard from './SparkCard';
import { MONOKAI } from './theme';

function SectionHeader({ num, title, color }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14,
      paddingBottom: 8,
      borderBottom: `1px solid ${MONOKAI.borderSubtle}`,
    }}>
      <span style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 8px ${color}88`,
      }} />
      <span style={{
        fontFamily: MONOKAI.monoFont,
        fontSize: 12,
        fontWeight: 700,
        color: MONOKAI.text,
        letterSpacing: '0.06em',
      }}>
        {num} &nbsp;{title}
      </span>
    </div>
  );
}

export default function MonokaiDashboard({ data, onSelectTicker }) {
  const [timeframe, setTimeframe] = useState('5Y'); // '1Y', '3Y', '5Y', 'ALL'

  const rawQuarters = data?.quarters || [];
  const rawStockPrices = data?.stockPrices || [];
  const kpis = data?.kpis || {};
  const peers = data?.peers || [];
  const unitSuffix = data?.unitSuffix || kpis.unitSuffix || 'B';

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

  // Downsampled stock prices series (~120 points for smooth scrubbing)
  const stockSeries = useMemo(() => {
    if (!stockPrices || stockPrices.length === 0) return [];
    const totalQ = rawQuarters.length || 1;
    const startQDate = rawQuarters[0] ? new Date(rawQuarters[0].date).getTime() : Date.now();
    const endQDate = rawQuarters[rawQuarters.length - 1] ? new Date(rawQuarters[rawQuarters.length - 1].date).getTime() : Date.now();
    const totalSpanMs = Math.max(1, endQDate - startQDate);

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

  // Section 1: Valuation Series
  const peSeries = useMemo(() => {
    return quarters
      .map((q) => ({ date: q.date, value: q.peRatio }))
      .filter((d) => d.value != null && d.value > 0 && d.value <= 250);
  }, [quarters]);

  const psSeries = useMemo(() => {
    return quarters
      .map((q) => ({ date: q.date, value: q.psRatio }))
      .filter((d) => d.value != null && d.value > 0 && d.value <= 60);
  }, [quarters]);

  const evEbitdaSeries = useMemo(() => {
    return quarters
      .map((q) => ({ date: q.date, value: q.evEbitda }))
      .filter((d) => d.value != null && d.value > 0 && d.value <= 150);
  }, [quarters]);

  const netDebtSeries = useMemo(() => {
    return quarters.map((q) => ({
      date: q.date,
      value: q.netDebt != null ? q.netDebt : (kpis.netDebt || 0),
    }));
  }, [quarters, kpis.netDebt]);

  const cashSeries = useMemo(() => {
    return quarters.map((q) => ({
      date: q.date,
      value: q.cash != null ? q.cash : (kpis.totalCash || 0),
    }));
  }, [quarters, kpis.totalCash]);

  const debtSeries = useMemo(() => {
    return quarters.map((q) => ({
      date: q.date,
      value: q.debt != null ? q.debt : (kpis.totalDebt || 0),
    }));
  }, [quarters, kpis.totalDebt]);

  const pbSeries = useMemo(() => {
    return quarters
      .map((q) => ({
        date: q.date,
        value: q.priceToBook != null ? q.priceToBook : (kpis.priceToBook || 0),
      }))
      .filter((d) => d.value != null && d.value > 0 && d.value <= 100);
  }, [quarters, kpis.priceToBook]);

  // Section 2: Capital Efficiency Series
  const roicSeries = useMemo(() => {
    return quarters
      .map((q) => ({ date: q.date, value: q.roic }))
      .filter((d) => d.value != null && d.value >= -20 && d.value <= 200);
  }, [quarters]);

  const shareCountYoYSeries = useMemo(() => {
    return quarters
      .map((q) => ({ date: q.date, value: q.shareCountYoY }))
      .filter((d) => d.value != null && d.value >= -25 && d.value <= 25);
  }, [quarters]);

  // Section 3: Income Engine & Costs Series
  const revSeries = useMemo(() => {
    return quarters.map((q) => ({ date: q.date, value: q.revenue }));
  }, [quarters]);

  const gpSeries = useMemo(() => {
    return quarters.map((q) => ({ date: q.date, value: q.grossProfit }));
  }, [quarters]);

  const opexSeries = useMemo(() => {
    return quarters.map((q) => {
      const opexVal = q.operatingExpenses != null
        ? q.operatingExpenses
        : Math.max(0, (q.grossProfit || 0) - (q.operatingIncome || 0));
      return { date: q.date, value: Math.round(opexVal * 100) / 100 };
    });
  }, [quarters]);

  const niSeries = useMemo(() => {
    return quarters.map((q) => ({ date: q.date, value: q.netIncome }));
  }, [quarters]);

  const ebitdaSeries = useMemo(() => {
    return quarters.map((q) => ({
      date: q.date,
      value: q.ebitda != null
        ? q.ebitda
        : (q.operatingIncome != null ? Math.round(q.operatingIncome * 1.22 * 100) / 100 : 0),
    }));
  }, [quarters]);

  // Section 4: Margins & Profitability Series
  const grossMarginSeries = useMemo(() => {
    return quarters.map((q) => ({
      date: q.date,
      value: q.grossMarginPct != null
        ? q.grossMarginPct
        : (q.revenue ? Math.round((q.grossProfit / q.revenue) * 1000) / 10 : 0),
    }));
  }, [quarters]);

  const opMarginSeries = useMemo(() => {
    return quarters.map((q) => ({
      date: q.date,
      value: q.operatingMarginPct != null
        ? q.operatingMarginPct
        : (q.revenue ? Math.round((q.operatingIncome / q.revenue) * 1000) / 10 : 0),
    }));
  }, [quarters]);

  const netMarginSeries = useMemo(() => {
    return quarters.map((q) => ({
      date: q.date,
      value: q.netMarginPct != null
        ? q.netMarginPct
        : (q.revenue ? Math.round((q.netIncome / q.revenue) * 1000) / 10 : 0),
    }));
  }, [quarters]);

  const epsSeries = useMemo(() => {
    return quarters.map((q) => ({
      date: q.date,
      value: q.epsTTM != null ? q.epsTTM : q.netIncome,
    }));
  }, [quarters]);

  // Section 5: Cash Flow & Dilution Series
  const fcfSeries = useMemo(() => {
    return quarters.map((q) => ({ date: q.date, value: q.freeCashFlow }));
  }, [quarters]);

  const realFcfSeries = useMemo(() => {
    return quarters.map((q) => ({
      date: q.date,
      value: q.realFreeCashFlow != null ? q.realFreeCashFlow : q.freeCashFlow,
    }));
  }, [quarters]);

  const fcfConversionSeries = useMemo(() => {
    return quarters
      .map((q) => {
        let val = q.fcfConversionPct;
        if (val == null && q.netIncome && q.netIncome > 0 && q.freeCashFlow != null) {
          val = Math.round((q.freeCashFlow / q.netIncome) * 1000) / 10;
        }
        return { date: q.date, value: val };
      })
      .filter((d) => d.value != null && d.value >= -200 && d.value <= 300);
  }, [quarters]);

  const yoyRevGrowthSeries = useMemo(() => {
    return quarters.map((q) => ({
      date: q.date,
      value: q.yoyRevenueGrowth != null ? q.yoyRevenueGrowth : 0,
    }));
  }, [quarters]);

  // Latest values & returns
  const latestQ = quarters[quarters.length - 1] || {};
  const currentPrice = kpis.latestPrice || (stockPrices[stockPrices.length - 1]?.y) || 0;
  const prevPrice = stockPrices.length >= 2 ? (stockPrices[0].y != null ? stockPrices[0].y : stockPrices[0].value) : currentPrice;
  const stockReturnPct = prevPrice > 0 ? ((currentPrice - prevPrice) / prevPrice) * 100 : 0;

  const latestOpEx = latestQ.operatingExpenses != null
    ? latestQ.operatingExpenses
    : Math.max(0, (latestQ.grossProfit || 0) - (latestQ.operatingIncome || 0));
  const opexPctOfRev = latestQ.revenue && latestQ.revenue > 0
    ? ((latestOpEx / latestQ.revenue) * 100).toFixed(1)
    : null;

  const minPrice = useMemo(() => {
    if (!stockPrices || stockPrices.length === 0) return currentPrice;
    const vals = stockPrices.map((p) => Number(p.y != null ? p.y : p.value)).filter((v) => !isNaN(v) && v > 0);
    return vals.length > 0 ? Math.min(...vals) : currentPrice;
  }, [stockPrices, currentPrice]);

  const maxPrice = useMemo(() => {
    if (!stockPrices || stockPrices.length === 0) return currentPrice;
    const vals = stockPrices.map((p) => Number(p.y != null ? p.y : p.value)).filter((v) => !isNaN(v) && v > 0);
    return vals.length > 0 ? Math.max(...vals) : currentPrice;
  }, [stockPrices, currentPrice]);

  // Valuation Benchmarks & Reference Lines
  const peBadges = useMemo(() => {
    const list = [];
    if (kpis.medianPE5YClean || kpis.medianPE5Y) {
      list.push({ text: `5Y Med ${(kpis.medianPE5YClean || kpis.medianPE5Y).toFixed(1)}x`, color: MONOKAI.orange });
    }
    if (kpis.industryPE) {
      list.push({ text: `Ind Med ${kpis.industryPE.toFixed(1)}x`, color: MONOKAI.yellow });
    }
    return list;
  }, [kpis.medianPE5YClean, kpis.medianPE5Y, kpis.industryPE]);

  const peRefLines = useMemo(() => {
    const lines = [];
    if (kpis.medianPE5YClean || kpis.medianPE5Y) {
      lines.push({
        value: kpis.medianPE5YClean || kpis.medianPE5Y,
        color: MONOKAI.orange,
        dash: '4,4',
      });
    }
    if (kpis.industryPE) {
      lines.push({
        value: kpis.industryPE,
        color: MONOKAI.yellow,
        dash: '3,3',
      });
    }
    return lines;
  }, [kpis.medianPE5YClean, kpis.medianPE5Y, kpis.industryPE]);

  const psBadges = useMemo(() => {
    const list = [];
    if (kpis.industryPS) {
      list.push({ text: `Ind Med ${kpis.industryPS.toFixed(1)}x`, color: MONOKAI.yellow });
    }
    return list;
  }, [kpis.industryPS]);

  const psRefLines = useMemo(() => {
    const lines = [];
    if (kpis.industryPS) {
      lines.push({
        value: kpis.industryPS,
        color: MONOKAI.yellow,
        dash: '4,4',
      });
    }
    return lines;
  }, [kpis.industryPS]);

  const pbBadges = useMemo(() => {
    const list = [];
    if (kpis.priceToBook) {
      list.push({ text: `${kpis.priceToBook.toFixed(2)}x Now`, color: MONOKAI.yellow });
    }
    if (kpis.industryPB) {
      list.push({ text: `Ind Med ${kpis.industryPB.toFixed(2)}x`, color: MONOKAI.orange });
    }
    return list;
  }, [kpis.priceToBook, kpis.industryPB]);

  const pbRefLines = useMemo(() => {
    const lines = [];
    if (kpis.industryPB) {
      lines.push({
        value: kpis.industryPB,
        color: MONOKAI.orange,
        dash: '4,4',
      });
    }
    return lines;
  }, [kpis.industryPB]);

  return (
    <div style={{ width: '100%' }}>
      {/* Timeframe Control Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: MONOKAI.bgDark,
        border: `1px solid ${MONOKAI.border}`,
        borderRadius: 8,
        padding: '10px 18px',
        marginBottom: 24,
      }}>
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

      {/* ============================================================ */}
      {/* SECTION 01: OVERVIEW & KEY DRIVERS                            */}
      {/* ============================================================ */}
      <div style={{ marginBottom: 32 }}>
        <SectionHeader
          num="01"
          title={`OVERVIEW // ${kpis.industryName ? kpis.industryName.toUpperCase() : 'MARKET & KEY DRIVERS'}`}
          color={MONOKAI.purple}
        />
        <div className="grid-4-col">
          {/* 1. Stock Price (3x wide Hero Chart) */}
          <SparkCard
            className="hero-stock-card"
            title="Stock Price"
            currentValue={`$${currentPrice.toFixed(2)}`}
            badgeText={`${timeframe} Return: ${stockReturnPct >= 0 ? '+' : ''}${stockReturnPct.toFixed(1)}%`}
            badgePositive={stockReturnPct >= 0}
            dataPoints={stockSeries}
            color={stockReturnPct >= 0 ? MONOKAI.green : MONOKAI.pink}
            formatValue={(v) => `$${v.toFixed(2)}`}
            height={115}
            sublabel={stockSeries[stockSeries.length - 1]?.date || 'Today'}
            footerSlot={
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}>
                {minPrice > 0 && maxPrice > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontFamily: MONOKAI.monoFont,
                      fontSize: 10,
                      fontWeight: 700,
                      color: MONOKAI.muted,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}>
                      {timeframe} Range:
                    </span>
                    <span style={{
                      fontFamily: MONOKAI.monoFont,
                      fontSize: 11,
                      fontWeight: 600,
                      color: MONOKAI.textDim,
                    }}>
                      ${minPrice.toFixed(2)} – ${maxPrice.toFixed(2)}
                    </span>
                  </div>
                )}

                {/* 5-Year Share Count Box */}
                {kpis.shareChange5Y != null && (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${kpis.shareChange5Y <= 0 ? 'rgba(166, 226, 46, 0.3)' : 'rgba(249, 38, 114, 0.3)'}`,
                    borderRadius: 5,
                    padding: '3px 10px',
                  }}>
                    <span style={{
                      fontFamily: MONOKAI.monoFont,
                      fontSize: 10,
                      fontWeight: 700,
                      color: MONOKAI.muted,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}>
                      5Y Share Count:
                    </span>
                    <span style={{
                      fontFamily: MONOKAI.monoFont,
                      fontSize: 11,
                      fontWeight: 700,
                      color: kpis.shareChange5Y <= 0 ? MONOKAI.green : MONOKAI.pink,
                    }}>
                      {kpis.shareChange5Y > 0 ? '+' : ''}{kpis.shareChange5Y.toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>
            }
          />

          {/* 2. P/E Multiple (1x) */}
          <SparkCard
            title="P/E Multiple"
            currentValue={latestQ.peRatio ? `${latestQ.peRatio.toFixed(1)}x` : (kpis.ttmPE ? `${kpis.ttmPE.toFixed(1)}x` : '—')}
            badges={peBadges}
            dataPoints={peSeries}
            color={MONOKAI.purple}
            formatValue={(v) => `${v.toFixed(1)}x`}
            height={115}
            sublabel={latestQ.date}
            referenceLines={peRefLines}
            footerSlot={peers && peers.length > 0 ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                flexWrap: 'wrap',
              }}>
                <span style={{
                  fontFamily: MONOKAI.monoFont,
                  fontSize: 10,
                  fontWeight: 700,
                  color: MONOKAI.muted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginRight: 2,
                }}>
                  Peers:
                </span>
                {peers.slice(0, 5).map((p) => {
                  const sym = typeof p === 'string' ? p : p.ticker;
                  const peVal = typeof p === 'object' && p.peRatio ? parseFloat(p.peRatio) : null;
                  const pe = peVal != null && !isNaN(peVal) ? `${peVal.toFixed(1)}x` : '—';
                  return (
                    <button
                      key={sym}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectTicker) onSelectTicker(sym);
                      }}
                      title={`Switch to ${sym}`}
                      style={{
                        fontFamily: MONOKAI.monoFont,
                        fontSize: 10,
                        fontWeight: 600,
                        color: MONOKAI.textDim,
                        background: MONOKAI.bgSurface,
                        border: `1px solid ${MONOKAI.borderSubtle}`,
                        borderRadius: 4,
                        padding: '2px 5px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = MONOKAI.purple;
                        e.currentTarget.style.color = MONOKAI.purple;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = MONOKAI.borderSubtle;
                        e.currentTarget.style.color = MONOKAI.textDim;
                      }}
                    >
                      <span style={{ color: MONOKAI.text, fontWeight: 700 }}>{sym}</span>
                      <span style={{ color: MONOKAI.purple }}>{pe}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          />
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION 02: INCOME STATEMENT                                  */}
      {/* ============================================================ */}
      <div style={{ marginBottom: 32 }}>
        <SectionHeader
          num="02"
          title="INCOME STATEMENT"
          color={MONOKAI.green}
        />
        <div className="grid-4-col">
          <SparkCard
            title="Quarterly Revenue"
            currentValue={`$${(latestQ.revenue || 0).toFixed(2)}${unitSuffix}`}
            badges={[
              ...(latestQ.yoyRevenueGrowth != null ? [{
                text: `${latestQ.yoyRevenueGrowth >= 0 ? '+' : ''}${latestQ.yoyRevenueGrowth.toFixed(1)}% YoY`,
                color: latestQ.yoyRevenueGrowth >= 0 ? MONOKAI.green : MONOKAI.pink,
              }] : []),
              ...(kpis.industryRevGrowth != null ? [{
                text: `Ind Med ${kpis.industryRevGrowth >= 0 ? '+' : ''}${kpis.industryRevGrowth.toFixed(1)}%`,
                color: MONOKAI.cyan,
              }] : []),
            ]}
            dataPoints={revSeries}
            color={MONOKAI.cyan}
            formatValue={(v) => `$${v.toFixed(2)}${unitSuffix}`}
            height={95}
            sublabel={latestQ.date}
            footerSlot={
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {kpis.avgRevGrowth5Y != null && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <span style={{
                      fontFamily: MONOKAI.monoFont,
                      fontSize: 10,
                      fontWeight: 700,
                      color: MONOKAI.muted,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}>
                      5Y Avg Growth:
                    </span>
                    <span style={{
                      fontFamily: MONOKAI.monoFont,
                      fontSize: 10,
                      fontWeight: 600,
                      color: (kpis.avgRevGrowth5Y || 0) >= 0 ? MONOKAI.green : MONOKAI.pink,
                    }}>
                      {kpis.avgRevGrowth5Y >= 0 ? '+' : ''}{kpis.avgRevGrowth5Y.toFixed(1)}%
                    </span>
                  </div>
                )}
                {peers && peers.length > 0 && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    flexWrap: 'wrap',
                  }}>
                    <span style={{
                      fontFamily: MONOKAI.monoFont,
                      fontSize: 10,
                      fontWeight: 700,
                      color: MONOKAI.muted,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginRight: 2,
                    }}>
                      Peers 5Y Avg:
                    </span>
                    {peers.slice(0, 5).map((p) => {
                      const sym = typeof p === 'string' ? p : p.ticker;
                      const rgVal = typeof p === 'object' && p.revGrowth5Y != null && p.revGrowth5Y !== 'N/A'
                        ? parseFloat(p.revGrowth5Y)
                        : (typeof p === 'object' && p.revenueGrowth != null && p.revenueGrowth !== 'N/A' ? parseFloat(p.revenueGrowth) : null);
                      const rg = rgVal != null && !isNaN(rgVal) ? `${rgVal >= 0 ? '+' : ''}${rgVal.toFixed(1)}%` : '—';
                      return (
                        <button
                          key={sym}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectTicker) onSelectTicker(sym);
                          }}
                          title={`Switch to ${sym} (5-Year Avg Revenue Growth: ${rg})`}
                          style={{
                            fontFamily: MONOKAI.monoFont,
                            fontSize: 10,
                            fontWeight: 600,
                            color: MONOKAI.textDim,
                            background: MONOKAI.bgSurface,
                            border: `1px solid ${MONOKAI.borderSubtle}`,
                            borderRadius: 4,
                            padding: '2px 5px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = MONOKAI.cyan;
                            e.currentTarget.style.color = MONOKAI.cyan;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = MONOKAI.borderSubtle;
                            e.currentTarget.style.color = MONOKAI.textDim;
                          }}
                        >
                          <span style={{ color: MONOKAI.text, fontWeight: 700 }}>{sym}</span>
                          <span style={{ color: rgVal != null ? (rgVal >= 0 ? MONOKAI.green : MONOKAI.pink) : MONOKAI.muted }}>
                            {rg}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            }
          />

          <SparkCard
            title="Gross Profit"
            currentValue={`$${(latestQ.grossProfit || 0).toFixed(2)}${unitSuffix}`}
            badgeText={latestQ.grossMarginPct ? `${latestQ.grossMarginPct.toFixed(1)}% Margin` : null}
            badgePositive={true}
            dataPoints={gpSeries}
            color={MONOKAI.green}
            formatValue={(v) => `$${v.toFixed(2)}${unitSuffix}`}
            height={95}
            sublabel={latestQ.date}
            footerSlot={kpis.ttmGrossMargin != null ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{
                  fontFamily: MONOKAI.monoFont,
                  fontSize: 10,
                  fontWeight: 700,
                  color: MONOKAI.muted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}>
                  TTM Margin:
                </span>
                <span style={{
                  fontFamily: MONOKAI.monoFont,
                  fontSize: 10,
                  fontWeight: 600,
                  color: MONOKAI.green,
                }}>
                  {kpis.ttmGrossMargin.toFixed(1)}%
                </span>
              </div>
            ) : null}
          />

          <SparkCard
            title="Operating Expenses"
            currentValue={`$${latestOpEx.toFixed(2)}${unitSuffix}`}
            badgeText={opexPctOfRev ? `${opexPctOfRev}% of Rev` : null}
            badgePositive={false}
            dataPoints={opexSeries}
            color={MONOKAI.pink}
            formatValue={(v) => `$${v.toFixed(2)}${unitSuffix}`}
            height={95}
            sublabel={latestQ.date}
            footerSlot={
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{
                  fontFamily: MONOKAI.monoFont,
                  fontSize: 10,
                  fontWeight: 700,
                  color: MONOKAI.muted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}>
                  OpEx % of Rev:
                </span>
                <span style={{
                  fontFamily: MONOKAI.monoFont,
                  fontSize: 10,
                  fontWeight: 600,
                  color: MONOKAI.pink,
                }}>
                  {opexPctOfRev ? `${opexPctOfRev}%` : '—'}
                </span>
              </div>
            }
          />

          <SparkCard
            title="Net Income"
            currentValue={`$${(latestQ.netIncome || 0).toFixed(2)}${unitSuffix}`}
            badgeText={latestQ.netMarginPct ? `${latestQ.netMarginPct.toFixed(1)}% Margin` : null}
            badgePositive={(latestQ.netIncome || 0) >= 0}
            dataPoints={niSeries}
            color={MONOKAI.green}
            formatValue={(v) => `$${v.toFixed(2)}${unitSuffix}`}
            height={95}
            sublabel={latestQ.date}
            footerSlot={kpis.ttmNetMargin != null ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{
                  fontFamily: MONOKAI.monoFont,
                  fontSize: 10,
                  fontWeight: 700,
                  color: MONOKAI.muted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}>
                  TTM Margin:
                </span>
                <span style={{
                  fontFamily: MONOKAI.monoFont,
                  fontSize: 10,
                  fontWeight: 600,
                  color: MONOKAI.green,
                }}>
                  {kpis.ttmNetMargin.toFixed(1)}%
                </span>
              </div>
            ) : null}
          />
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION 03: CASH FLOW & PROFITABILITY                         */}
      {/* ============================================================ */}
      <div style={{ marginBottom: 32 }}>
        <SectionHeader
          num="03"
          title="CASH FLOW & PROFITABILITY"
          color={MONOKAI.orange}
        />
        <div className="grid-4-col">
          {/* 1. Quarterly EBITDA */}
          <SparkCard
            title="Quarterly EBITDA"
            currentValue={`$${(latestQ.ebitda != null ? latestQ.ebitda : (latestQ.operatingIncome != null ? latestQ.operatingIncome * 1.22 : 0)).toFixed(2)}${unitSuffix}`}
            badgeText={latestQ.ebitdaMarginPct ? `${latestQ.ebitdaMarginPct.toFixed(1)}% Margin` : (kpis.ttmEbitdaMargin ? `${kpis.ttmEbitdaMargin.toFixed(1)}% Margin` : null)}
            badgePositive={true}
            dataPoints={ebitdaSeries}
            color={MONOKAI.yellow}
            formatValue={(v) => `$${v.toFixed(2)}${unitSuffix}`}
            height={95}
            sublabel={latestQ.date}
            footerSlot={kpis.ttmEbitda != null ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{
                  fontFamily: MONOKAI.monoFont,
                  fontSize: 10,
                  fontWeight: 700,
                  color: MONOKAI.muted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}>
                  TTM EBITDA:
                </span>
                <span style={{
                  fontFamily: MONOKAI.monoFont,
                  fontSize: 10,
                  fontWeight: 600,
                  color: MONOKAI.yellow,
                }}>
                  ${kpis.ttmEbitda.toFixed(1)}{unitSuffix}
                </span>
              </div>
            ) : null}
          />

          {/* 2. Adjusted Free Cash Flow (Net of Stock Comp) */}
          <SparkCard
            title="Adjusted Free Cash Flow"
            currentValue={`$${(latestQ.realFreeCashFlow != null ? latestQ.realFreeCashFlow : (latestQ.freeCashFlow || 0)).toFixed(2)}${unitSuffix}`}
            badgeText="Net of Stock Comp"
            badgePositive={(latestQ.realFreeCashFlow || latestQ.freeCashFlow || 0) >= 0}
            dataPoints={realFcfSeries}
            color={MONOKAI.green}
            formatValue={(v) => `$${v.toFixed(2)}${unitSuffix}`}
            height={95}
            sublabel={latestQ.date}
            footerSlot={
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{
                  fontFamily: MONOKAI.monoFont,
                  fontSize: 10,
                  fontWeight: 700,
                  color: MONOKAI.muted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}>
                  TTM Stock Comp:
                </span>
                <span style={{
                  fontFamily: MONOKAI.monoFont,
                  fontSize: 10,
                  fontWeight: 600,
                  color: MONOKAI.orange,
                }}>
                  ${kpis.ttmSBC != null ? kpis.ttmSBC.toFixed(1) : '—'}{unitSuffix} ({kpis.sbcPctOfRev || 0}% of Rev)
                </span>
              </div>
            }
          />

          {/* 3. Cash vs. Debt (Dual Line Graph) */}
          <SparkCard
            title="Cash vs. Debt"
            currentValue={`$${(kpis.totalCash || 0).toFixed(1)}${unitSuffix} Cash · $${(kpis.totalDebt || 0).toFixed(1)}${unitSuffix} Debt`}
            badges={kpis.isNetCash
              ? [{ text: `+$${Math.abs(kpis.netDebt || 0).toFixed(1)}${unitSuffix} Net Cash`, color: MONOKAI.green }]
              : [{ text: `$${(kpis.netDebt || 0).toFixed(1)}${unitSuffix} Net Debt`, color: MONOKAI.pink }]}
            multiSeries={[
              { name: 'Cash', data: cashSeries, color: MONOKAI.green, formatValue: (v) => `$${v.toFixed(1)}${unitSuffix}` },
              { name: 'Debt', data: debtSeries, color: MONOKAI.pink, formatValue: (v) => `$${v.toFixed(1)}${unitSuffix}` },
            ]}
            color={kpis.isNetCash ? MONOKAI.green : MONOKAI.yellow}
            height={95}
            sublabel={latestQ.date || 'Latest'}
            footerSlot={
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{
                  fontFamily: MONOKAI.monoFont,
                  fontSize: 10,
                  fontWeight: 600,
                  color: MONOKAI.green,
                }}>
                  Cash: ${kpis.totalCash != null ? kpis.totalCash.toFixed(1) : '—'}{unitSuffix}
                </span>
                <span style={{
                  fontFamily: MONOKAI.monoFont,
                  fontSize: 10,
                  fontWeight: 700,
                  color: kpis.isNetCash ? MONOKAI.green : MONOKAI.pink,
                }}>
                  {kpis.netDebtLabel || (kpis.isNetCash ? 'Net Cash' : 'Leveraged')}
                </span>
                <span style={{
                  fontFamily: MONOKAI.monoFont,
                  fontSize: 10,
                  fontWeight: 600,
                  color: MONOKAI.pink,
                }}>
                  Debt: ${kpis.totalDebt != null ? kpis.totalDebt.toFixed(1) : '—'}{unitSuffix}
                </span>
              </div>
            }
          />

          {/* 4. FCF Conversion % */}
          <SparkCard
            title="FCF Conversion %"
            currentValue={latestQ.fcfConversionPct != null ? `${latestQ.fcfConversionPct.toFixed(1)}%` : (kpis.ttmFcfConversion != null ? `${kpis.ttmFcfConversion.toFixed(1)}%` : '—')}
            badgeText="FCF / NI"
            badgePositive={true}
            dataPoints={fcfConversionSeries}
            color={MONOKAI.cyan}
            formatValue={(v) => `${v.toFixed(1)}%`}
            height={95}
            sublabel={latestQ.date}
          />
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION 04: PROFITABILITY & CAPITAL EFFICIENCY                */}
      {/* ============================================================ */}
      <div style={{ marginBottom: 32 }}>
        <SectionHeader
          num="04"
          title="PROFITABILITY & CAPITAL EFFICIENCY"
          color={MONOKAI.yellow}
        />
        <div className="grid-4-col">
          <SparkCard
            title="Operating Margin"
            currentValue={latestQ.operatingMarginPct ? `${latestQ.operatingMarginPct.toFixed(1)}%` : '—'}
            badgeText={kpis.ttmOperatingMargin != null ? `TTM ${kpis.ttmOperatingMargin.toFixed(1)}%` : null}
            badgePositive={Boolean((latestQ.operatingMarginPct || kpis.ttmOperatingMargin || 0) >= 0)}
            dataPoints={opMarginSeries}
            color={MONOKAI.cyan}
            formatValue={(v) => `${v.toFixed(1)}%`}
            height={95}
            sublabel={latestQ.date}
          />

          <SparkCard
            title="Profit Margin"
            currentValue={latestQ.netMarginPct ? `${latestQ.netMarginPct.toFixed(1)}%` : '—'}
            badgeText={kpis.ttmNetMargin != null ? `TTM ${kpis.ttmNetMargin.toFixed(1)}%` : null}
            badgePositive={Boolean((latestQ.netMarginPct || kpis.ttmNetMargin || 0) >= 0)}
            dataPoints={netMarginSeries}
            color={MONOKAI.green}
            formatValue={(v) => `${v.toFixed(1)}%`}
            height={95}
            sublabel={latestQ.date}
          />

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

          <SparkCard
            title="Return on Capital"
            currentValue={latestQ.roic != null ? `${latestQ.roic.toFixed(1)}%` : (kpis.latestROIC != null ? `${kpis.latestROIC.toFixed(1)}%` : '—')}
            badgeText={(latestQ.roic || kpis.latestROIC || 0) >= 20 ? 'Elite (20%+)' : (latestQ.roic || kpis.latestROIC || 0) >= 12 ? 'Strong (12%+)' : 'Moderate'}
            badgePositive={(latestQ.roic || kpis.latestROIC || 0) >= 12}
            dataPoints={roicSeries}
            color={MONOKAI.cyan}
            formatValue={(v) => `${v.toFixed(1)}%`}
            height={95}
            sublabel={latestQ.date}
            referenceLines={[{ value: 15, color: MONOKAI.green, dash: '4,4' }]}
            footerSlot={
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{
                  fontFamily: MONOKAI.monoFont,
                  fontSize: 10,
                  fontWeight: 700,
                  color: MONOKAI.muted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}>
                  5Y Average:
                </span>
                <span style={{
                  fontFamily: MONOKAI.monoFont,
                  fontSize: 10,
                  fontWeight: 600,
                  color: MONOKAI.cyan,
                }}>
                  {kpis.avgROIC5Y ? `${kpis.avgROIC5Y.toFixed(1)}%` : '—'}
                </span>
              </div>
            }
          />
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION 05: VALUATION MULTIPLES                               */}
      {/* ============================================================ */}
      <div style={{ marginBottom: 24 }}>
        <SectionHeader
          num="05"
          title="VALUATION MULTIPLES"
          color={MONOKAI.purple}
        />
        <div className="grid-3-col">
          <SparkCard
            title="Enterprise Value / EBITDA"
            currentValue={latestQ.evEbitda ? `${latestQ.evEbitda.toFixed(1)}x` : (kpis.evEbitda ? `${kpis.evEbitda.toFixed(1)}x` : '—')}
            badges={[{ text: 'Debt-Adjusted', color: MONOKAI.orange }]}
            dataPoints={evEbitdaSeries}
            color={MONOKAI.orange}
            formatValue={(v) => `${v.toFixed(1)}x`}
            height={95}
            sublabel={latestQ.date}
            footerSlot={peers && peers.length > 0 ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                flexWrap: 'wrap',
              }}>
                <span style={{
                  fontFamily: MONOKAI.monoFont,
                  fontSize: 10,
                  fontWeight: 700,
                  color: MONOKAI.muted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginRight: 2,
                }}>
                  Peers:
                </span>
                {peers.slice(0, 5).map((p) => {
                  const sym = typeof p === 'string' ? p : p.ticker;
                  const evVal = typeof p === 'object' && p.evEbitda ? parseFloat(p.evEbitda) : null;
                  const ev = evVal != null && !isNaN(evVal) && evVal > 0 ? `${evVal.toFixed(1)}x` : '—';
                  return (
                    <button
                      key={sym}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectTicker) onSelectTicker(sym);
                      }}
                      title={`Switch to ${sym}`}
                      style={{
                        fontFamily: MONOKAI.monoFont,
                        fontSize: 10,
                        fontWeight: 600,
                        color: MONOKAI.textDim,
                        background: MONOKAI.bgSurface,
                        border: `1px solid ${MONOKAI.borderSubtle}`,
                        borderRadius: 4,
                        padding: '2px 5px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = MONOKAI.orange;
                        e.currentTarget.style.color = MONOKAI.orange;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = MONOKAI.borderSubtle;
                        e.currentTarget.style.color = MONOKAI.textDim;
                      }}
                    >
                      <span style={{ color: MONOKAI.text, fontWeight: 700 }}>{sym}</span>
                      <span style={{ color: MONOKAI.orange }}>{ev}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          />

          <SparkCard
            title="Share Price / Revenue per Share (P/S)"
            currentValue={latestQ.psRatio ? `${latestQ.psRatio.toFixed(1)}x` : (kpis.ttmPS ? `${kpis.ttmPS.toFixed(1)}x` : '—')}
            badges={psBadges}
            dataPoints={psSeries}
            color={MONOKAI.cyan}
            formatValue={(v) => `${v.toFixed(1)}x`}
            height={95}
            sublabel={latestQ.date}
            referenceLines={psRefLines}
            footerSlot={peers && peers.length > 0 ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                flexWrap: 'wrap',
              }}>
                <span style={{
                  fontFamily: MONOKAI.monoFont,
                  fontSize: 10,
                  fontWeight: 700,
                  color: MONOKAI.muted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginRight: 2,
                }}>
                  Peers:
                </span>
                {peers.slice(0, 5).map((p) => {
                  const sym = typeof p === 'string' ? p : p.ticker;
                  const psVal = typeof p === 'object' && p.psRatio ? parseFloat(p.psRatio) : null;
                  const ps = psVal != null && !isNaN(psVal) ? `${psVal.toFixed(1)}x` : '—';
                  return (
                    <button
                      key={sym}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectTicker) onSelectTicker(sym);
                      }}
                      title={`Switch to ${sym}`}
                      style={{
                        fontFamily: MONOKAI.monoFont,
                        fontSize: 10,
                        fontWeight: 600,
                        color: MONOKAI.textDim,
                        background: MONOKAI.bgSurface,
                        border: `1px solid ${MONOKAI.borderSubtle}`,
                        borderRadius: 4,
                        padding: '2px 5px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = MONOKAI.cyan;
                        e.currentTarget.style.color = MONOKAI.cyan;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = MONOKAI.borderSubtle;
                        e.currentTarget.style.color = MONOKAI.textDim;
                      }}
                    >
                      <span style={{ color: MONOKAI.text, fontWeight: 700 }}>{sym}</span>
                      <span style={{ color: MONOKAI.cyan }}>{ps}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          />

          <SparkCard
            title="Price to Book"
            currentValue={latestQ.priceToBook ? `${latestQ.priceToBook.toFixed(2)}x` : (kpis.priceToBook ? `${kpis.priceToBook.toFixed(2)}x` : '—')}
            badges={pbBadges}
            dataPoints={pbSeries}
            color={MONOKAI.yellow}
            formatValue={(v) => `${v.toFixed(2)}x`}
            height={95}
            sublabel={latestQ.date}
            referenceLines={pbRefLines}
            footerSlot={peers && peers.length > 0 ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                flexWrap: 'wrap',
              }}>
                <span style={{
                  fontFamily: MONOKAI.monoFont,
                  fontSize: 10,
                  fontWeight: 700,
                  color: MONOKAI.muted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginRight: 2,
                }}>
                  Peers:
                </span>
                {peers.slice(0, 5).map((p) => {
                  const sym = typeof p === 'string' ? p : p.ticker;
                  const pbVal = typeof p === 'object' && p.pbRatio ? parseFloat(p.pbRatio) : null;
                  const pb = pbVal != null && !isNaN(pbVal) ? `${pbVal.toFixed(1)}x` : '—';
                  return (
                    <button
                      key={sym}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectTicker) onSelectTicker(sym);
                      }}
                      title={`Switch to ${sym} (P/B: ${pb})`}
                      style={{
                        fontFamily: MONOKAI.monoFont,
                        fontSize: 10,
                        fontWeight: 600,
                        color: MONOKAI.textDim,
                        background: MONOKAI.bgSurface,
                        border: `1px solid ${MONOKAI.borderSubtle}`,
                        borderRadius: 4,
                        padding: '2px 5px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = MONOKAI.yellow;
                        e.currentTarget.style.color = MONOKAI.yellow;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = MONOKAI.borderSubtle;
                        e.currentTarget.style.color = MONOKAI.textDim;
                      }}
                    >
                      <span style={{ color: MONOKAI.text, fontWeight: 700 }}>{sym}</span>
                      <span style={{ color: MONOKAI.yellow }}>{pb}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          />
        </div>
      </div>
    </div>
  );
}
