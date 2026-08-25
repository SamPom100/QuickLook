import { useState, useId, useEffect } from 'react';
import * as d3 from 'd3';

export default function DCFCalculator({ data }) {
  const { ticker, kpis } = data || {};
  const currentPrice = kpis?.latestPrice || 0;
  const ttmEps = kpis?.epsTTM || (kpis?.latestPrice && kpis?.ttmPE ? +(kpis.latestPrice / kpis.ttmPE).toFixed(2) : 5.0);
  const ttmPe = kpis?.ttmPE || 20.0;
  
  // Historical CAGRs, Averages, and Median Multiples
  const growth1Y = kpis?.epsGrowth1Y;
  const growth3Y = kpis?.epsGrowth3Y;
  const growth5Y = kpis?.epsGrowth5Y;
  const avgPe5Y = kpis?.avgPE5Y;
  const avgPe3Y = kpis?.avgPE3Y;
  const medianPe5Y = kpis?.medianPE5Y;
  const medianPe3Y = kpis?.medianPE3Y;
  const avgRevGrowth5Y = kpis?.avgRevGrowth5Y;

  // Default suggested growth rate & multiple (use 5Y median if available)
  const defaultGrowth = (growth5Y && growth5Y > -10 && growth5Y < 60)
    ? growth5Y
    : ((growth3Y && growth3Y > -10 && growth3Y < 60) ? growth3Y : 12.0);

  const defaultMultiple = (medianPe5Y && medianPe5Y > 5 && medianPe5Y < 70)
    ? medianPe5Y
    : (ttmPe > 0 ? ttmPe : 22.0);

  const compressedPe = medianPe5Y ? Math.round(medianPe5Y * 0.85 * 10) / 10 : null;

  // User Assumptions State (startingEps is a string to allow fluid typing, backspacing & clearing)
  const [startingEps, setStartingEps] = useState(String(ttmEps));
  const [epsGrowthRate, setEpsGrowthRate] = useState(defaultGrowth);
  const [exitMultiple, setExitMultiple] = useState(defaultMultiple);
  const [desiredReturn, setDesiredReturn] = useState(15.0);
  const [years, setYears] = useState(5);
  const [chartMode, setChartMode] = useState('price'); // 'price' or 'eps'
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Sync state when ticker or baseline changes
  useEffect(() => {
    setStartingEps(String(ttmEps));
    setEpsGrowthRate(defaultGrowth);
    setExitMultiple(defaultMultiple);
  }, [ticker, ttmEps, defaultGrowth, defaultMultiple]);

  const startingEpsId = useId();
  const epsGrowthRateId = useId();
  const exitMultipleId = useId();
  const desiredReturnId = useId();

  // Handle Preset Scenarios
  const applyPreset = (type) => {
    if (type === 'bear') {
      setEpsGrowthRate(Math.max(-5, Math.round(defaultGrowth * 0.6 * 10) / 10));
      setExitMultiple(Math.max(10, Math.round((medianPe5Y || ttmPe) * 0.75 * 10) / 10));
    } else if (type === 'base') {
      setEpsGrowthRate(defaultGrowth);
      setExitMultiple(defaultMultiple);
    } else if (type === 'bull') {
      const bullGrowth = growth3Y && growth3Y > defaultGrowth ? growth3Y : defaultGrowth * 1.3;
      setEpsGrowthRate(Math.round(bullGrowth * 10) / 10);
      setExitMultiple(Math.round(Math.max(ttmPe, medianPe5Y || 25) * 1.15 * 10) / 10);
    } else if (type === 'reset') {
      setStartingEps(String(ttmEps));
      setEpsGrowthRate(defaultGrowth);
      setExitMultiple(defaultMultiple);
      setDesiredReturn(15.0);
      setYears(5);
    }
  };

  // 1. Future Projections (Compounding)
  const numStartingEps = parseFloat(startingEps) || 0;
  const gDecimal = epsGrowthRate / 100;
  const rDecimal = desiredReturn / 100;
  
  const futureEps = numStartingEps * Math.pow(1 + gDecimal, years);
  const futureStockPrice = futureEps * exitMultiple;
  
  // 2. Target Entry Price for Desired Return
  const entryPrice = futureStockPrice / Math.pow(1 + rDecimal, years);
  const priceDeltaPct = currentPrice > 0 ? ((entryPrice - currentPrice) / currentPrice) * 100 : 0;
  const discountNeededPct = currentPrice > 0 ? ((currentPrice - entryPrice) / currentPrice) * 100 : 0;

  // 3. Expected Annual Return from Current Market Price
  const impliedCagr = currentPrice > 0 && futureStockPrice > 0
    ? (Math.pow(futureStockPrice / currentPrice, 1 / years) - 1) * 100
    : 0;
  const totalReturnPct = currentPrice > 0 ? ((futureStockPrice - currentPrice) / currentPrice) * 100 : 0;

  // Yearly Breakdown for Visual Progression Chart
  const yearlyProgression = [];
  for (let y = 0; y <= years; y++) {
    const yEps = numStartingEps * Math.pow(1 + gDecimal, y);
    const yMarketPrice = (y === 0)
      ? currentPrice
      : (currentPrice * Math.pow(futureStockPrice / currentPrice, y / years));
    const yHurdlePrice = entryPrice * Math.pow(1 + rDecimal, y);
    const yMultiplePrice = yEps * exitMultiple;

    yearlyProgression.push({
      yearNum: y,
      label: y === 0 ? 'Today' : `Yr ${y}`,
      eps: yEps,
      marketPrice: y === 0 ? currentPrice : (y === years ? futureStockPrice : yMarketPrice),
      targetMultiplePrice: yMultiplePrice,
      hurdlePrice: yHurdlePrice,
      cagrFromToday: y === 0 ? 0 : (Math.pow((y === years ? futureStockPrice : yMarketPrice) / currentPrice, 1 / y) - 1) * 100,
      totalReturnFromToday: y === 0 ? 0 : (((y === years ? futureStockPrice : yMarketPrice) - currentPrice) / currentPrice) * 100,
      isTerminal: y === years,
    });
  }

  // Benchmark Return Hurdles
  const benchmarkHurdles = [8.0, 10.0, 12.0, 15.0, 20.0];
  if (!benchmarkHurdles.includes(desiredReturn)) {
    benchmarkHurdles.push(desiredReturn);
    benchmarkHurdles.sort((a, b) => a - b);
  }

  // Sensitivity Matrix Grid
  const growthSteps = [
    Math.round((epsGrowthRate - 6) * 10) / 10,
    Math.round((epsGrowthRate - 3) * 10) / 10,
    Math.round(epsGrowthRate * 10) / 10,
    Math.round((epsGrowthRate + 3) * 10) / 10,
    Math.round((epsGrowthRate + 6) * 10) / 10,
  ];
  const multipleSteps = [
    Math.max(5, Math.round(exitMultiple * 0.75 * 10) / 10),
    Math.max(8, Math.round(exitMultiple * 0.88 * 10) / 10),
    Math.round(exitMultiple * 10) / 10,
    Math.round(exitMultiple * 1.12 * 10) / 10,
    Math.round(exitMultiple * 1.25 * 10) / 10,
  ];

  // SVG Chart Dimensions & Scales
  const svgWidth = 560;
  const svgHeight = 270;
  const margin = { top: 28, right: 36, bottom: 42, left: 60 };
  const innerW = svgWidth - margin.left - margin.right;
  const innerH = svgHeight - margin.top - margin.bottom;

  const xScale = d3.scaleLinear()
    .domain([0, years])
    .range([margin.left, margin.left + innerW]);

  let yDomain;
  if (chartMode === 'price') {
    const allPrices = [
      currentPrice,
      futureStockPrice,
      entryPrice,
      ...yearlyProgression.map(d => d.marketPrice),
      ...yearlyProgression.map(d => d.hurdlePrice)
    ].filter(v => v > 0);
    const minP = Math.min(...allPrices);
    const maxP = Math.max(...allPrices);
    const pad = (maxP - minP) * 0.15 || 20;
    yDomain = [Math.max(0, minP - pad), maxP + pad];
  } else {
    const allEps = yearlyProgression.map(d => d.eps);
    const minE = Math.min(...allEps);
    const maxE = Math.max(...allEps);
    const pad = (maxE - minE) * 0.2 || 1;
    yDomain = [Math.max(0, minE - pad), maxE + pad];
  }

  const yScale = d3.scaleLinear()
    .domain(yDomain)
    .range([margin.top + innerH, margin.top]);

  // Generators for Stock Price Line & Area
  const priceLineGen = d3.line()
    .x(d => xScale(d.yearNum))
    .y(d => yScale(d.marketPrice))
    .curve(d3.curveMonotoneX);

  const priceAreaGen = d3.area()
    .x(d => xScale(d.yearNum))
    .y0(margin.top + innerH)
    .y1(d => yScale(d.marketPrice))
    .curve(d3.curveMonotoneX);

  // Generators for Target Hurdle Path Line
  const hurdleLineGen = d3.line()
    .x(d => xScale(d.yearNum))
    .y(d => yScale(d.hurdlePrice))
    .curve(d3.curveMonotoneX);

  // Generators for EPS Line & Area
  const epsLineGen = d3.line()
    .x(d => xScale(d.yearNum))
    .y(d => yScale(d.eps))
    .curve(d3.curveMonotoneX);

  const epsAreaGen = d3.area()
    .x(d => xScale(d.yearNum))
    .y0(margin.top + innerH)
    .y1(d => yScale(d.eps))
    .curve(d3.curveMonotoneX);

  const yTicks = yScale.ticks(5);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#0f172a',
    }}>
      {/* 1. Header: Today's Actuals vs 5-Year Historical Averages */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '18px 22px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}>
        {/* Top Row: Stock Name & Presets */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: '#0f172a' }}>{ticker}</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#0284c7' }}>${currentPrice.toFixed(2)}</span>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>(Market Price Today)</span>
          </div>

          {/* Preset Buttons */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Scenarios:</span>
            <button onClick={() => applyPreset('bear')} style={presetBtnStyle} title="Conservative: 60% of 5Y CAGR, lower multiple">🐻 Bear</button>
            <button onClick={() => applyPreset('base')} style={presetBtnStyle} title="Base: 5-Year historical CAGR and 5-Year average P/E">⚖️ Base (5Y Avg)</button>
            <button onClick={() => applyPreset('bull')} style={presetBtnStyle} title="Optimistic: Higher growth & multiple expansion">🐂 Bull</button>
            <button onClick={() => applyPreset('reset')} style={{ ...presetBtnStyle, background: '#f1f5f9', color: '#475569' }}>🔄 Reset</button>
          </div>
        </div>

        {/* Bottom Row: TTM Actuals vs 5-Year Historical Averages */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 14,
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          padding: '12px 16px',
        }}>
          {/* Card 1: Today's TTM Actuals */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                📅 Today's Actuals (TTM)
              </span>
              <span
                style={{ fontSize: 11, background: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: 4, cursor: 'help' }}
                title="TTM = Trailing Twelve Months. The sum of actual earnings and revenue over the last 4 reported quarters up to today."
              >
                ℹ️ Past 12 Mos
              </span>
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11, color: '#64748b' }}>TTM EPS</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>${ttmEps.toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#64748b' }}>TTM P/E Ratio</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{ttmPe ? `${ttmPe.toFixed(1)}x` : 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#64748b' }}>1Y EPS Growth</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: growth1Y >= 0 ? '#16a34a' : '#dc2626' }}>
                  {growth1Y !== null && growth1Y !== undefined ? `${growth1Y > 0 ? `+${growth1Y}%` : `${growth1Y}%`}` : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: 5-Year Historical Medians & CAGRs */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                🏛️ 5-Year Historical Baseline (Medians & CAGRs)
              </span>
              <span
                style={{ fontSize: 11, background: '#dcfce7', color: '#166534', padding: '1px 6px', borderRadius: 4, cursor: 'help' }}
                title="Historical 5-year medians calculated over the past 20 quarters. Median prevents outlier quarters from skewing the multiple."
              >
                ℹ️ 20-Qtr Median
              </span>
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11, color: '#64748b' }}>5Y Median P/E</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                  {medianPe5Y ? `${medianPe5Y}x` : (ttmPe ? `${ttmPe.toFixed(1)}x` : 'N/A')}
                  {medianPe3Y && <span style={{ fontSize: 11, fontWeight: 500, color: '#64748b', marginLeft: 4 }}>(3Y: {medianPe3Y}x)</span>}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#64748b' }}>5Y EPS Growth CAGR</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: growth5Y >= 0 ? '#16a34a' : '#dc2626' }}>
                  {growth5Y !== null && growth5Y !== undefined ? `+${growth5Y}% / yr` : '—'}
                  {growth3Y && <span style={{ fontSize: 11, fontWeight: 500, color: '#64748b', marginLeft: 4 }}>(3Y: +{growth3Y}%)</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Two-Column Layout: Assumptions & Key Results */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: 20,
      }}>
        {/* Left Column: Interactive Inputs & Sliders */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>
              🛠️ Valuation Assumptions
            </h3>
            {/* 5-Year / 10-Year Horizon Switcher */}
            <div style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: 8, padding: 3 }}>
              <button
                onClick={() => setYears(5)}
                style={horizonBtnStyle(years === 5)}
              >
                5 Years
              </button>
              <button
                onClick={() => setYears(10)}
                style={horizonBtnStyle(years === 10)}
              >
                10 Years
              </button>
            </div>
          </div>

          {/* Starting EPS */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label htmlFor={startingEpsId} style={inputLabelStyle}>Starting EPS ($)</label>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0284c7' }}>${numStartingEps.toFixed(2)}</span>
            </div>
            <input
              id={startingEpsId}
              type="text"
              inputMode="decimal"
              value={startingEps}
              onChange={(e) => {
                const val = e.target.value;
                // Allow empty string, numbers, and valid decimal typing
                if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                  setStartingEps(val);
                }
              }}
              onBlur={() => {
                // If left empty or invalid, cleanly format to numeric
                if (startingEps === '' || isNaN(parseFloat(startingEps))) {
                  setStartingEps(String(ttmEps));
                }
              }}
              style={textInputStyle}
              placeholder="e.g. 12.00"
            />
            {/* Quick Fill Helper for Starting EPS */}
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Quick Fill:</span>
              <button
                type="button"
                onClick={() => setStartingEps(String(ttmEps))}
                style={quickFillBtnStyle(startingEps === String(ttmEps) || numStartingEps === ttmEps)}
                title="Reset to current Trailing Twelve Months EPS"
              >
                ⚡ TTM EPS: ${ttmEps.toFixed(2)}
              </button>
            </div>
          </div>

          {/* Expected Annual EPS Growth Rate */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label htmlFor={epsGrowthRateId} style={inputLabelStyle}>Expected Annual EPS Growth Rate</label>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0284c7' }}>{epsGrowthRate > 0 ? `+${epsGrowthRate}%` : `${epsGrowthRate}%`}</span>
            </div>
            <input
              id={epsGrowthRateId}
              type="range"
              min="-10"
              max="50"
              step="0.5"
              value={epsGrowthRate}
              onChange={(e) => setEpsGrowthRate(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#0284c7', cursor: 'pointer' }}
            />
            {/* Quick Fill Helper Chips */}
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Quick Fill:</span>
              {growth5Y !== null && growth5Y !== undefined && (
                <button
                  type="button"
                  onClick={() => setEpsGrowthRate(growth5Y)}
                  style={quickFillBtnStyle(epsGrowthRate === growth5Y)}
                >
                  ⚡ 5Y CAGR: +{growth5Y}%
                </button>
              )}
              {growth3Y !== null && growth3Y !== undefined && (
                <button
                  type="button"
                  onClick={() => setEpsGrowthRate(growth3Y)}
                  style={quickFillBtnStyle(epsGrowthRate === growth3Y)}
                >
                  ⚡ 3Y CAGR: +{growth3Y}%
                </button>
              )}
              <button
                type="button"
                onClick={() => setEpsGrowthRate(10.0)}
                style={quickFillBtnStyle(epsGrowthRate === 10.0)}
              >
                10% (Market)
              </button>
            </div>
          </div>

          {/* Terminal Exit P/E Multiple */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label htmlFor={exitMultipleId} style={inputLabelStyle}>Terminal Exit P/E Multiple</label>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0284c7' }}>{Number(exitMultiple).toFixed(1)}x</span>
            </div>
            <input
              id={exitMultipleId}
              type="range"
              min="5"
              max="60"
              step="0.5"
              value={exitMultiple}
              onChange={(e) => setExitMultiple(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#0284c7', cursor: 'pointer' }}
            />
            {/* Quick Fill Helper Chips */}
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Quick Fill:</span>
              {avgPe5Y && (
                <button
                  type="button"
                  onClick={() => setExitMultiple(avgPe5Y)}
                  style={quickFillBtnStyle(exitMultiple === avgPe5Y)}
                  title="5-Year Historical Average (Mean) P/E"
                >
                  ⚡ 5Y Avg: {avgPe5Y}x
                </button>
              )}
              {medianPe5Y && (
                <button
                  type="button"
                  onClick={() => setExitMultiple(medianPe5Y)}
                  style={quickFillBtnStyle(exitMultiple === medianPe5Y)}
                  title="5-Year Historical Median P/E"
                >
                  ⚡ 5Y Median: {medianPe5Y}x
                </button>
              )}
              <button
                type="button"
                onClick={() => setExitMultiple(ttmPe)}
                style={quickFillBtnStyle(exitMultiple === ttmPe)}
                title="Current TTM P/E Multiple"
              >
                ⚡ Current: {ttmPe.toFixed(1)}x
              </button>
              {compressedPe && (
                <button
                  type="button"
                  onClick={() => setExitMultiple(compressedPe)}
                  style={quickFillBtnStyle(exitMultiple === compressedPe)}
                  title="Conservative: Models a 15% multiple compression as growth matures"
                >
                  📉 5Y Median -15%: {compressedPe}x
                </button>
              )}
            </div>
          </div>

          {/* Desired Return Target (%) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label htmlFor={desiredReturnId} style={inputLabelStyle}>Desired Annual Return (%)</label>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#059669' }}>{desiredReturn.toFixed(1)}% / yr</span>
            </div>
            <input
              id={desiredReturnId}
              type="range"
              min="5"
              max="30"
              step="0.5"
              value={desiredReturn}
              onChange={(e) => setDesiredReturn(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#059669', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Hurdle Presets:</span>
              {[10.0, 12.0, 15.0, 20.0].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setDesiredReturn(h)}
                  style={quickFillBtnStyle(desiredReturn === h)}
                >
                  {h === 15 ? '⭐ 15% Target' : `${h}%`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Hero Valuation Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Hero Card 1: Expected Return from Today's Price */}
          <div style={{
            background: impliedCagr >= desiredReturn ? '#f0fdf4' : '#fffbeb',
            border: `1.5px solid ${impliedCagr >= desiredReturn ? '#86efac' : '#fde68a'}`,
            borderRadius: 12,
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: impliedCagr >= desiredReturn ? '#166534' : '#92400e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              📈 Expected Return from Today's Price (${currentPrice.toFixed(2)})
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 6 }}>
              <span style={{
                fontSize: 34,
                fontWeight: 800,
                color: impliedCagr >= desiredReturn ? '#15803d' : (impliedCagr > 0 ? '#b45309' : '#b91c1c'),
              }}>
                {impliedCagr > 0 ? `+${impliedCagr.toFixed(2)}%` : `${impliedCagr.toFixed(2)}%`}
                <span style={{ fontSize: 16, fontWeight: 600, color: '#64748b', marginLeft: 4 }}>/ year</span>
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{
                background: impliedCagr >= desiredReturn ? '#dcfce7' : '#fef3c7',
                color: impliedCagr >= desiredReturn ? '#14532d' : '#78350f',
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
              }}>
                {impliedCagr >= desiredReturn
                  ? `✓ Exceeds ${desiredReturn}% target by ${(impliedCagr - desiredReturn).toFixed(1)}%`
                  : `⚠️ Lags ${desiredReturn}% target by ${(desiredReturn - impliedCagr).toFixed(1)}%`}
              </span>
              <span style={{ fontSize: 13, color: '#64748b' }}>
                Total {years}-Year Gain: <strong>{totalReturnPct > 0 ? `+${totalReturnPct.toFixed(1)}%` : `${totalReturnPct.toFixed(1)}%`}</strong>
              </span>
            </div>
          </div>

          {/* Hero Card 2: Max Entry Buy Price */}
          <div style={{
            background: '#ffffff',
            border: '1.5px solid #e2e8f0',
            borderRadius: 12,
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              🎯 Target Entry Price (for {desiredReturn.toFixed(1)}% Annual Return)
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 6 }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: '#0f172a' }}>
                ${entryPrice.toFixed(2)}
              </span>
              <span style={{
                fontSize: 14,
                fontWeight: 700,
                color: priceDeltaPct >= 0 ? '#15803d' : '#dc2626',
              }}>
                {priceDeltaPct >= 0
                  ? `(Trading below target by ${priceDeltaPct.toFixed(1)}% - BUY ZONE)`
                  : `(${discountNeededPct.toFixed(1)}% pullback needed)`}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
              If you buy at <strong>${entryPrice.toFixed(2)}</strong> and it hits <strong>${futureStockPrice.toFixed(2)}</strong> in Year {years}, your return will be exactly <strong>{desiredReturn.toFixed(1)}% CAGR</strong>.
            </div>
          </div>

          {/* Projected Terminal Values Card */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '16px 20px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Year {years} Projected EPS
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                ${futureEps.toFixed(2)}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                Growing at {epsGrowthRate}% / yr
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Year {years} Target Stock Price
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                ${futureStockPrice.toFixed(2)}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                At {exitMultiple.toFixed(1)}x Exit P/E
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Hurdle Rates & Entry Target Matrix */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>
            📊 Target Entry Price Matrix (Hurdle Rates)
          </h3>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            What you should pay today to achieve various annual return benchmarks over the next {years} years:
          </p>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Desired Annual Return</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Max Entry Buy Price</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>vs Today's Price (${currentPrice.toFixed(2)})</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>{years}-Yr Total Gain</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Valuation Verdict</th>
              </tr>
            </thead>
            <tbody>
              {benchmarkHurdles.map((targetR) => {
                const targetEntry = futureStockPrice / Math.pow(1 + targetR / 100, years);
                const diffPct = currentPrice > 0 ? ((targetEntry - currentPrice) / currentPrice) * 100 : 0;
                const totalGain = (Math.pow(1 + targetR / 100, years) - 1) * 100;
                const isUserSelection = targetR === desiredReturn;
                const isBuyZone = currentPrice <= targetEntry;

                return (
                  <tr
                    key={targetR}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: isUserSelection ? '#f0f9ff' : (isBuyZone ? '#fbfdfb' : '#fff'),
                      fontWeight: isUserSelection ? 700 : 500,
                    }}
                  >
                    <td style={{ padding: '12px 14px', color: '#0f172a' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {isUserSelection && <span style={{ color: '#0284c7' }}>⭐</span>}
                        {targetR.toFixed(1)}% / yr
                        {targetR === 15 && <span style={{ fontSize: 10, background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: 4 }}>Standard Target</span>}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                      ${targetEntry.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 14px', color: diffPct >= 0 ? '#16a34a' : '#dc2626' }}>
                      {diffPct >= 0 ? `+${diffPct.toFixed(1)}% (In Buy Zone)` : `${diffPct.toFixed(1)}% (Overvalued)`}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#475569' }}>
                      +{totalGain.toFixed(1)}%
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        background: isBuyZone ? '#dcfce7' : (Math.abs(diffPct) < 8 ? '#fef3c7' : '#fee2e2'),
                        color: isBuyZone ? '#15803d' : (Math.abs(diffPct) < 8 ? '#92400e' : '#b91c1c'),
                      }}>
                        {isBuyZone ? '🟢 Underpriced (Buy)' : (Math.abs(diffPct) < 8 ? '🟡 Fairly Valued' : '🔴 Overpriced')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Visual Progression Chart & Sensitivity Heatmap */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: 20,
      }}>
        {/* Interactive Visual Graph: Compounding Trajectory */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                📈 {years}-Year Compounding Visual Trajectory
              </h3>
              {/* Toggle Mode: Stock Price vs EPS */}
              <div style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: 8, padding: 2 }}>
                <button
                  onClick={() => setChartMode('price')}
                  style={{
                    border: 'none',
                    background: chartMode === 'price' ? '#ffffff' : 'transparent',
                    color: chartMode === 'price' ? '#0284c7' : '#64748b',
                    fontWeight: chartMode === 'price' ? 700 : 500,
                    fontSize: 11,
                    padding: '3px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    boxShadow: chartMode === 'price' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  }}
                >
                  Stock Price ($)
                </button>
                <button
                  onClick={() => setChartMode('eps')}
                  style={{
                    border: 'none',
                    background: chartMode === 'eps' ? '#ffffff' : 'transparent',
                    color: chartMode === 'eps' ? '#0284c7' : '#64748b',
                    fontWeight: chartMode === 'eps' ? 700 : 500,
                    fontSize: 11,
                    padding: '3px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    boxShadow: chartMode === 'eps' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  }}
                >
                  EPS Growth ($)
                </button>
              </div>
            </div>

            {/* Chart Legend & Summary Values */}
            <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#64748b', flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
              {chartMode === 'price' ? (
                <>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#0284c7', display: 'inline-block' }} />
                    <strong style={{ color: '#0f172a' }}>Projected Market Price</strong> (${futureStockPrice.toFixed(0)})
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 10, height: 2, background: '#16a34a', display: 'inline-block' }} />
                    <span style={{ color: '#16a34a', fontWeight: 600 }}>{desiredReturn}% Hurdle Path</span>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 1, background: '#94a3b8', borderTop: '1px dashed #94a3b8', display: 'inline-block' }} />
                    <span>Today's Baseline (${currentPrice.toFixed(0)})</span>
                  </span>
                </>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                  <strong style={{ color: '#0f172a' }}>EPS Trajectory</strong> (Yr {years}: ${futureEps.toFixed(2)})
                </span>
              )}
            </div>
          </div>

          {/* SVG Visual Graph */}
          <div style={{ position: 'relative', width: '100%', height: svgHeight }}>
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              style={{ width: '100%', height: '100%', overflow: 'visible' }}
            >
              <defs>
                {/* Blue Gradient for Price Area */}
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0284c7" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0.01" />
                </linearGradient>
                {/* Green Gradient for EPS Area */}
                <linearGradient id="epsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid Lines & Y-Axis Labels */}
              {yTicks.map((tickVal) => {
                const yPos = yScale(tickVal);
                return (
                  <g key={tickVal}>
                    <line
                      x1={margin.left}
                      y1={yPos}
                      x2={margin.left + innerW}
                      y2={yPos}
                      stroke="#f1f5f9"
                      strokeWidth="1"
                    />
                    <text
                      x={margin.left - 8}
                      y={yPos + 4}
                      textAnchor="end"
                      fontSize="11"
                      fill="#94a3b8"
                      fontWeight="500"
                    >
                      ${tickVal.toFixed(chartMode === 'price' ? 0 : 1)}
                    </text>
                  </g>
                );
              })}

              {/* Today's Price Baseline (Horizontal Dashed Line) */}
              {chartMode === 'price' && currentPrice > 0 && (
                <g>
                  <line
                    x1={margin.left}
                    y1={yScale(currentPrice)}
                    x2={margin.left + innerW}
                    y2={yScale(currentPrice)}
                    stroke="#94a3b8"
                    strokeWidth="1"
                    strokeDasharray="4 3"
                  />
                  <text
                    x={margin.left + innerW - 4}
                    y={yScale(currentPrice) - 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="#64748b"
                    fontWeight="600"
                  >
                    Today: ${currentPrice.toFixed(0)}
                  </text>
                </g>
              )}

              {/* Price Mode Chart Elements */}
              {chartMode === 'price' && (
                <>
                  {/* Hurdle Rate Trajectory Line (Green) */}
                  <path
                    d={hurdleLineGen(yearlyProgression)}
                    fill="none"
                    stroke="#16a34a"
                    strokeWidth="2"
                    strokeDasharray="5 4"
                  />

                  {/* Market Price Projected Area */}
                  <path
                    d={priceAreaGen(yearlyProgression)}
                    fill="url(#priceGradient)"
                  />

                  {/* Market Price Projected Line */}
                  <path
                    d={priceLineGen(yearlyProgression)}
                    fill="none"
                    stroke="#0284c7"
                    strokeWidth="3"
                  />
                </>
              )}

              {/* EPS Mode Chart Elements */}
              {chartMode === 'eps' && (
                <>
                  {/* EPS Area */}
                  <path
                    d={epsAreaGen(yearlyProgression)}
                    fill="url(#epsGradient)"
                  />

                  {/* EPS Line */}
                  <path
                    d={epsLineGen(yearlyProgression)}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="3"
                  />
                </>
              )}

              {/* Hover Crosshair Vertical Line */}
              {hoveredIndex !== null && (
                <line
                  x1={xScale(yearlyProgression[hoveredIndex].yearNum)}
                  y1={margin.top}
                  x2={xScale(yearlyProgression[hoveredIndex].yearNum)}
                  y2={margin.top + innerH}
                  stroke="#cbd5e1"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
              )}

              {/* Data Points & Interactive Hit Targets */}
              {yearlyProgression.map((item, idx) => {
                const cx = xScale(item.yearNum);
                const cy = yScale(chartMode === 'price' ? item.marketPrice : item.eps);
                const isHovered = hoveredIndex === idx;
                const ptColor = chartMode === 'price'
                  ? (item.isTerminal ? '#10b981' : (idx === 0 ? '#64748b' : '#0284c7'))
                  : '#10b981';

                return (
                  <g
                    key={idx}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Hover Glow Ring */}
                    {isHovered && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r="11"
                        fill={ptColor}
                        opacity="0.25"
                      />
                    )}
                    {/* Inner Dot */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isHovered ? 6 : (item.isTerminal ? 5 : 4)}
                      fill="#ffffff"
                      stroke={ptColor}
                      strokeWidth="2.5"
                    />

                    {/* X-Axis Tick Label */}
                    <text
                      x={cx}
                      y={margin.top + innerH + 18}
                      textAnchor="middle"
                      fontSize="11"
                      fill={isHovered ? '#0f172a' : '#64748b'}
                      fontWeight={isHovered ? '800' : '600'}
                    >
                      {item.label}
                    </text>

                    {/* Point Label for Terminal Year */}
                    {item.isTerminal && !isHovered && (
                      <text
                        x={cx}
                        y={cy - 10}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="800"
                        fill="#10b981"
                      >
                        ${(chartMode === 'price' ? item.marketPrice : item.eps).toFixed(chartMode === 'price' ? 0 : 2)}
                      </text>
                    )}

                    {/* Transparent Hit Area for Easy Hovering */}
                    <rect
                      x={cx - (innerW / years / 2)}
                      y={margin.top}
                      width={innerW / years}
                      height={innerH}
                      fill="transparent"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Dynamic Floating Tooltip */}
            {hoveredIndex !== null && (
              <div style={{
                position: 'absolute',
                top: 8,
                left: Math.min(Math.max(xScale(yearlyProgression[hoveredIndex].yearNum) - 90, 10), innerW - 100),
                background: '#0f172a',
                color: '#f8fafc',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 12,
                pointerEvents: 'none',
                boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}>
                <div style={{ fontWeight: 800, color: '#38bdf8' }}>
                  {yearlyProgression[hoveredIndex].label} {hoveredIndex === 0 ? '(Current)' : `(in ${hoveredIndex} yrs)`}
                </div>
                <div>Stock Price: <strong>${yearlyProgression[hoveredIndex].marketPrice.toFixed(2)}</strong></div>
                <div>EPS: <strong>${yearlyProgression[hoveredIndex].eps.toFixed(2)}</strong></div>
                {hoveredIndex > 0 && (
                  <div style={{ color: '#4ade80', fontWeight: 700, marginTop: 2 }}>
                    Return: +{yearlyProgression[hoveredIndex].totalReturnFromToday.toFixed(1)}% ({yearlyProgression[hoveredIndex].cagrFromToday.toFixed(1)}% / yr)
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sensitivity Matrix (Growth vs Exit Multiple Heatmap) */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>
            🎛️ Sensitivity Heatmap (Expected CAGR %)
          </h3>
          <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 10px 0' }}>
            Rows = Growth Rates | Columns = Exit P/E Multiples
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, textAlign: 'center' }}>
              <thead>
                <tr>
                  <th style={{ padding: '6px', color: '#64748b', fontWeight: 600 }}>g \ PE</th>
                  {multipleSteps.map((m) => (
                    <th key={m} style={{ padding: '6px', color: '#334155', fontWeight: 700 }}>{m}x</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {growthSteps.map((g) => (
                  <tr key={g}>
                    <td style={{ padding: '6px', fontWeight: 700, color: '#334155' }}>{g}%</td>
                    {multipleSteps.map((m) => {
                      const fEps = numStartingEps * Math.pow(1 + g / 100, years);
                      const fPrice = fEps * m;
                      const cagr = currentPrice > 0 && fPrice > 0
                        ? (Math.pow(fPrice / currentPrice, 1 / years) - 1) * 100
                        : 0;
                      const isSelected = g === Math.round(epsGrowthRate * 10) / 10 && m === Math.round(exitMultiple * 10) / 10;
                      return (
                        <td
                          key={m}
                          style={{
                            padding: '6px 4px',
                            background: getHeatmapColor(cagr),
                            color: '#0f172a',
                            fontWeight: isSelected ? 800 : 600,
                            border: isSelected ? '2px solid #0284c7' : '1px solid #e2e8f0',
                            borderRadius: 4,
                          }}
                        >
                          {cagr > 0 ? `+${cagr.toFixed(1)}%` : `${cagr.toFixed(1)}%`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// Styling Helpers
const inputLabelStyle = {
  fontSize: 13,
  fontWeight: 600,
  color: '#334155',
};

const textInputStyle = {
  width: '100%',
  padding: '8px 12px',
  border: '1.5px solid #cbd5e1',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  color: '#0f172a',
  outline: 'none',
  fontFamily: 'inherit',
};

const horizonBtnStyle = (active) => ({
  border: 'none',
  background: active ? '#ffffff' : 'transparent',
  color: active ? '#0284c7' : '#64748b',
  fontWeight: active ? 700 : 500,
  fontSize: 12,
  padding: '4px 12px',
  borderRadius: 6,
  cursor: 'pointer',
  boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
  transition: 'all 0.15s ease',
});

const presetBtnStyle = {
  background: '#ffffff',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  padding: '4px 10px',
  fontSize: 12,
  fontWeight: 600,
  color: '#1e293b',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};

const quickFillBtnStyle = (active) => ({
  background: active ? '#e0f2fe' : '#ffffff',
  border: `1px solid ${active ? '#0284c7' : '#cbd5e1'}`,
  color: active ? '#0369a1' : '#334155',
  fontWeight: active ? 700 : 600,
  fontSize: 11,
  padding: '2px 8px',
  borderRadius: 4,
  cursor: 'pointer',
  transition: 'all 0.1s ease',
});

function getHeatmapColor(cagr) {
  if (cagr >= 20) return '#bbf7d0';
  if (cagr >= 15) return '#dcfce7';
  if (cagr >= 10) return '#f0fdf4';
  if (cagr >= 5) return '#fef9c3';
  if (cagr >= 0) return '#ffedd5';
  return '#fee2e2';
}
