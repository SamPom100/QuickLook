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
      .filter((d) => d.value != null && d.value > 0 && d.value <= 120);
  }, [quarters]);

  const psSeries = useMemo(() => {
    return quarters
      .map((q) => ({ date: q.date, value: q.psRatio }))
      .filter((d) => d.value != null && d.value > 0 && d.value <= 60);
  }, [quarters]);

  // Section 2: Income Engine & Costs Series
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

  // Section 3: Margins & Efficiency Series
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

  // Section 4: Cash Flow & Growth Series
  const fcfSeries = useMemo(() => {
    return quarters.map((q) => ({ date: q.date, value: q.freeCashFlow }));
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
      {/* SECTION 1: VALUATION                                          */}
      {/* ============================================================ */}
      <div style={{ marginBottom: 32 }}>
        <SectionHeader
          num="01"
          title={`VALUATION${kpis.industryName ? ` // ${kpis.industryName.toUpperCase()}` : ''}`}
          color={MONOKAI.purple}
        />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}>
          <SparkCard
            title="Stock Price"
            currentValue={`$${currentPrice.toFixed(2)}`}
            badgeText={`${stockReturnPct >= 0 ? '+' : ''}${stockReturnPct.toFixed(1)}% (${timeframe})`}
            badgePositive={stockReturnPct >= 0}
            dataPoints={stockSeries}
            color={stockReturnPct >= 0 ? MONOKAI.green : MONOKAI.pink}
            formatValue={(v) => `$${v.toFixed(2)}`}
            height={95}
            sublabel={stockSeries[stockSeries.length - 1]?.date || 'Today'}
            footerSlot={minPrice > 0 && maxPrice > 0 ? (
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
                  {timeframe} Range:
                </span>
                <span style={{
                  fontFamily: MONOKAI.monoFont,
                  fontSize: 10,
                  fontWeight: 600,
                  color: MONOKAI.textDim,
                }}>
                  ${minPrice.toFixed(2)} – ${maxPrice.toFixed(2)}
                </span>
              </div>
            ) : null}
          />

          <SparkCard
            title="P/E Multiple"
            currentValue={latestQ.peRatio ? `${latestQ.peRatio.toFixed(1)}x` : (kpis.ttmPE ? `${kpis.ttmPE.toFixed(1)}x` : '—')}
            badges={peBadges}
            dataPoints={peSeries}
            color={MONOKAI.purple}
            formatValue={(v) => `${v.toFixed(1)}x`}
            height={95}
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

          <SparkCard
            title="P/S Multiple"
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
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION 2: INCOME & EXPENSES                                  */}
      {/* ============================================================ */}
      <div style={{ marginBottom: 32 }}>
        <SectionHeader
          num="02"
          title="INCOME & EXPENSES"
          color={MONOKAI.cyan}
        />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
        }}>
          <SparkCard
            title="Quarterly Revenue"
            currentValue={`$${(latestQ.revenue || 0).toFixed(2)}${unitSuffix}`}
            badgeText={latestQ.yoyRevenueGrowth ? `+${latestQ.yoyRevenueGrowth.toFixed(1)}% YoY` : null}
            badgePositive={true}
            dataPoints={revSeries}
            color={MONOKAI.cyan}
            formatValue={(v) => `$${v.toFixed(2)}${unitSuffix}`}
            height={95}
            sublabel={latestQ.date}
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
          />
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION 3: MARGINS                                            */}
      {/* ============================================================ */}
      <div style={{ marginBottom: 32 }}>
        <SectionHeader
          num="03"
          title="MARGINS & EFFICIENCY"
          color={MONOKAI.yellow}
        />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
        }}>
          <SparkCard
            title="Gross Margin"
            currentValue={latestQ.grossMarginPct ? `${latestQ.grossMarginPct.toFixed(1)}%` : '—'}
            dataPoints={grossMarginSeries}
            color={MONOKAI.yellow}
            formatValue={(v) => `${v.toFixed(1)}%`}
            height={95}
            sublabel={latestQ.date}
          />

          <SparkCard
            title="Operating Margin"
            currentValue={latestQ.operatingMarginPct ? `${latestQ.operatingMarginPct.toFixed(1)}%` : '—'}
            dataPoints={opMarginSeries}
            color={MONOKAI.cyan}
            formatValue={(v) => `${v.toFixed(1)}%`}
            height={95}
            sublabel={latestQ.date}
          />

          <SparkCard
            title="Net Margin"
            currentValue={latestQ.netMarginPct ? `${latestQ.netMarginPct.toFixed(1)}%` : '—'}
            badgePositive={(latestQ.netMarginPct || 0) >= 0}
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
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION 4: CASH FLOW                                          */}
      {/* ============================================================ */}
      <div style={{ marginBottom: 24 }}>
        <SectionHeader
          num="04"
          title="CASH FLOW & GROWTH"
          color={MONOKAI.green}
        />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}>
          <SparkCard
            title="Free Cash Flow"
            currentValue={`$${(latestQ.freeCashFlow || 0).toFixed(2)}${unitSuffix}`}
            badgeText={kpis.fcfYield ? `${kpis.fcfYield.toFixed(1)}% Yield` : null}
            badgePositive={(latestQ.freeCashFlow || 0) >= 0}
            dataPoints={fcfSeries}
            color={MONOKAI.yellow}
            formatValue={(v) => `$${v.toFixed(2)}${unitSuffix}`}
            height={95}
            sublabel={latestQ.date}
          />

          <SparkCard
            title="FCF Conversion %"
            currentValue={latestQ.fcfConversionPct ? `${latestQ.fcfConversionPct.toFixed(1)}%` : (kpis.ttmFcfConversion ? `${kpis.ttmFcfConversion.toFixed(1)}%` : '—')}
            badgeText="FCF / NI"
            badgePositive={true}
            dataPoints={fcfConversionSeries}
            color={MONOKAI.green}
            formatValue={(v) => `${v.toFixed(1)}%`}
            height={95}
            sublabel={latestQ.date}
          />

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
    </div>
  );
}
