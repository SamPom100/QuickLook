import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { MONOKAI } from './theme';

export default function MonokaiDCFCalculator({ data }) {
  const { ticker, kpis = {} } = data || {};
  const currentPrice = kpis.latestPrice || 0;
  const ttmEps = kpis.epsTTM || (currentPrice && kpis.ttmPE ? +(currentPrice / kpis.ttmPE).toFixed(2) : 5.0);
  const ttmPe = kpis.ttmPE || 20.0;
  const growth5Y = kpis.epsGrowth5Y;
  const growth3Y = kpis.epsGrowth3Y;
  const medianPe5Y = kpis.medianPE5YClean || kpis.medianPE5Y || 22.0;

  // Safe Defaults
  const defaultGrowth = (() => {
    if (growth5Y != null && growth5Y > -10 && growth5Y <= 30) return growth5Y;
    if (growth5Y != null && growth5Y > 30) return Math.min(30, Math.round(growth5Y * 0.6 * 10) / 10);
    if (growth3Y != null && growth3Y > -10 && growth3Y <= 30) return growth3Y;
    return 12.0;
  })();

  const defaultMultiple = medianPe5Y > 5 && medianPe5Y <= 50 ? medianPe5Y : (ttmPe > 5 && ttmPe <= 50 ? ttmPe : 22.0);

  // States
  const [startingEps, setStartingEps] = useState(String(ttmEps));
  const [epsGrowthRate, setEpsGrowthRate] = useState(defaultGrowth);
  const [exitMultiple, setExitMultiple] = useState(defaultMultiple);
  const [desiredReturn, setDesiredReturn] = useState(15.0);
  const [years, setYears] = useState(5);

  useEffect(() => {
    setStartingEps(String(ttmEps));
    setEpsGrowthRate(defaultGrowth);
    setExitMultiple(defaultMultiple);
  }, [ticker, ttmEps, defaultGrowth, defaultMultiple]);

  // Presets
  const applyPreset = (type) => {
    if (type === 'bear') {
      setEpsGrowthRate(Math.max(-5, Math.round(defaultGrowth * 0.6 * 10) / 10));
      setExitMultiple(Math.max(10, Math.round(defaultMultiple * 0.75 * 10) / 10));
    } else if (type === 'base') {
      setEpsGrowthRate(defaultGrowth);
      setExitMultiple(defaultMultiple);
    } else if (type === 'bull') {
      setEpsGrowthRate(Math.min(35, Math.round(defaultGrowth * 1.35 * 10) / 10));
      setExitMultiple(Math.round(defaultMultiple * 1.2 * 10) / 10);
    } else if (type === 'reset') {
      setStartingEps(String(ttmEps));
      setEpsGrowthRate(defaultGrowth);
      setExitMultiple(defaultMultiple);
      setDesiredReturn(15.0);
      setYears(5);
    }
  };

  // Calculations
  const numEps = parseFloat(startingEps) || 0;
  const g = epsGrowthRate / 100;
  const r = desiredReturn / 100;

  const futureEps = numEps * Math.pow(1 + g, years);
  const futureStockPrice = futureEps * exitMultiple;
  const targetEntryPrice = futureStockPrice / Math.pow(1 + r, years);

  const priceDeltaPct = currentPrice > 0 ? ((targetEntryPrice - currentPrice) / currentPrice) * 100 : 0;
  const impliedCagr = currentPrice > 0 && futureStockPrice > 0
    ? (Math.pow(futureStockPrice / currentPrice, 1 / years) - 1) * 100
    : 0;

  const isBuy = currentPrice > 0 && targetEntryPrice >= currentPrice;
  const isCagrGood = impliedCagr >= desiredReturn;

  // D3 Compounding Graph
  const graphSvgRef = useRef(null);
  useEffect(() => {
    if (!graphSvgRef.current) return;
    const svg = d3.select(graphSvgRef.current);
    svg.selectAll('*').remove();

    const w = 480;
    const h = 200;
    const margin = { top: 20, right: 30, bottom: 30, left: 55 };
    const innerW = w - margin.left - margin.right;
    const innerH = h - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${w} ${h}`).attr('width', '100%').attr('height', '100%');

    const gGraph = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Yearly points
    const points = [];
    for (let y = 0; y <= years; y++) {
      const pPrice = (y === 0) ? currentPrice : (numEps * Math.pow(1 + g, y) * exitMultiple);
      points.push({ year: y, price: pPrice });
    }

    const xScale = d3.scaleLinear().domain([0, years]).range([0, innerW]);
    const maxP = Math.max(currentPrice * 1.2, futureStockPrice * 1.15);
    const yScale = d3.scaleLinear().domain([0, maxP]).range([innerH, 0]).nice();

    // Grid
    gGraph.selectAll('line.grid')
      .data(yScale.ticks(4))
      .enter().append('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', (d) => yScale(d)).attr('y2', (d) => yScale(d))
      .attr('stroke', MONOKAI.borderSubtle).attr('stroke-dasharray', '3,3');

    // Line
    const lineGen = d3.line()
      .x((d) => xScale(d.year))
      .y((d) => yScale(d.price))
      .curve(d3.curveMonotoneX);

    gGraph.append('path')
      .datum(points)
      .attr('d', lineGen)
      .attr('fill', 'none')
      .attr('stroke', MONOKAI.cyan)
      .attr('stroke-width', 2.5);

    gGraph.selectAll('circle')
      .data(points)
      .enter().append('circle')
      .attr('cx', (d) => xScale(d.year))
      .attr('cy', (d) => yScale(d.price))
      .attr('r', 4)
      .attr('fill', (d, i) => i === 0 ? MONOKAI.yellow : (i === years ? MONOKAI.green : MONOKAI.cyan))
      .attr('stroke', MONOKAI.bgDark)
      .attr('stroke-width', 2);

    // Current Price line
    if (currentPrice > 0) {
      gGraph.append('line')
        .attr('x1', 0).attr('x2', innerW)
        .attr('y1', yScale(currentPrice)).attr('y2', yScale(currentPrice))
        .attr('stroke', MONOKAI.muted).attr('stroke-dasharray', '3,3');
    }

    // Axes
    gGraph.append('g').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(years).tickFormat((d) => `Yr ${d}`))
      .call((g) => {
        g.select('.domain').attr('stroke', MONOKAI.border);
        g.selectAll('.tick line').attr('stroke', MONOKAI.borderSubtle);
        g.selectAll('.tick text').attr('fill', MONOKAI.muted).attr('font-family', MONOKAI.monoFont).attr('font-size', 10);
      });

    gGraph.append('g')
      .call(d3.axisLeft(yScale).ticks(4).tickFormat((d) => `$${d.toFixed(0)}`))
      .call((g) => {
        g.select('.domain').attr('stroke', MONOKAI.border);
        g.selectAll('.tick line').attr('stroke', MONOKAI.borderSubtle);
        g.selectAll('.tick text').attr('fill', MONOKAI.textDim).attr('font-family', MONOKAI.monoFont).attr('font-size', 10);
      });

  }, [currentPrice, futureStockPrice, numEps, g, exitMultiple, years]);

  // Sensitivity Matrix Setup
  const growthSteps = [-4, -2, 0, 2, 4].map((delta) => Math.round((epsGrowthRate + delta) * 10) / 10);
  const peSteps = [-4, -2, 0, 2, 4].map((delta) => Math.max(8, Math.round((exitMultiple + delta) * 10) / 10));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Presets & Horizon Selector */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        background: MONOKAI.bgDark,
        border: `1px solid ${MONOKAI.border}`,
        borderRadius: 8,
        padding: '10px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: MONOKAI.monoFont, fontSize: 11, color: MONOKAI.muted, textTransform: 'uppercase' }}>
            Scenarios:
          </span>
          <button onClick={() => applyPreset('bear')} style={presetBtnStyle(MONOKAI.pink)}>
            🐻 Bear
          </button>
          <button onClick={() => applyPreset('base')} style={presetBtnStyle(MONOKAI.yellow)}>
            ⚖️ Base
          </button>
          <button onClick={() => applyPreset('bull')} style={presetBtnStyle(MONOKAI.green)}>
            🚀 Bull
          </button>
          <button onClick={() => applyPreset('reset')} style={presetBtnStyle(MONOKAI.muted)}>
            ↺ Reset
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: MONOKAI.monoFont, fontSize: 11, color: MONOKAI.muted, textTransform: 'uppercase' }}>
            Horizon:
          </span>
          {[5, 10].map((y) => (
            <button
              key={y}
              onClick={() => setYears(y)}
              style={{
                fontFamily: MONOKAI.monoFont,
                fontSize: 11,
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 4,
                border: `1px solid ${years === y ? MONOKAI.cyan : MONOKAI.border}`,
                background: years === y ? MONOKAI.cyan : 'transparent',
                color: years === y ? MONOKAI.bgDark : MONOKAI.muted,
                cursor: 'pointer',
              }}
            >
              {y} Years
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Inputs vs Results */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: 20,
      }}>
        {/* Left Column: Interactive Inputs */}
        <div style={{
          background: MONOKAI.bgDark,
          border: `1px solid ${MONOKAI.border}`,
          borderRadius: 8,
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}>
          <div style={{ fontFamily: MONOKAI.monoFont, fontSize: 13, fontWeight: 700, color: MONOKAI.cyan, borderBottom: `1px solid ${MONOKAI.borderSubtle}`, paddingBottom: 8 }}>
            // MODEL ASSUMPTIONS
          </div>

          {/* Starting EPS */}
          <div style={inputRowStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={labelStyle}>Starting TTM EPS ($)</label>
              <input
                type="number"
                step="0.1"
                value={startingEps}
                onChange={(e) => setStartingEps(e.target.value)}
                style={numberInputStyle}
              />
            </div>
            <span style={hintStyle}>Baseline: Trailing 12-month net profit per diluted share</span>
          </div>

          {/* Growth Rate */}
          <div style={inputRowStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={labelStyle}>EPS Growth Rate (Next {years}Y)</label>
              <span style={{ fontFamily: MONOKAI.monoFont, fontSize: 14, fontWeight: 700, color: MONOKAI.green }}>
                {epsGrowthRate >= 0 ? '+' : ''}{epsGrowthRate.toFixed(1)}% / yr
              </span>
            </div>
            <input
              type="range"
              min="-10"
              max="40"
              step="0.5"
              value={epsGrowthRate}
              onChange={(e) => setEpsGrowthRate(parseFloat(e.target.value))}
              style={sliderStyle}
            />
            <span style={hintStyle}>Historical: 5Y CAGR is {growth5Y != null ? `${growth5Y.toFixed(1)}%` : '—'}</span>
          </div>

          {/* Exit Multiple */}
          <div style={inputRowStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={labelStyle}>Exit P/E Multiple ({years}Y)</label>
              <span style={{ fontFamily: MONOKAI.monoFont, fontSize: 14, fontWeight: 700, color: MONOKAI.purple }}>
                {exitMultiple.toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="60"
              step="0.5"
              value={exitMultiple}
              onChange={(e) => setExitMultiple(parseFloat(e.target.value))}
              style={sliderStyle}
            />
            <span style={hintStyle}>Historical: 5Y Median P/E is {medianPe5Y ? `${medianPe5Y.toFixed(1)}x` : '—'}</span>
          </div>

          {/* Desired Hurdle Return */}
          <div style={inputRowStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={labelStyle}>Desired Annual Return (Hurdle)</label>
              <span style={{ fontFamily: MONOKAI.monoFont, fontSize: 14, fontWeight: 700, color: MONOKAI.yellow }}>
                {desiredReturn.toFixed(1)}% / yr
              </span>
            </div>
            <input
              type="range"
              min="6"
              max="25"
              step="0.5"
              value={desiredReturn}
              onChange={(e) => setDesiredReturn(parseFloat(e.target.value))}
              style={sliderStyle}
            />
            <span style={hintStyle}>Standard hurdles: S&amp;P 500 (~10%), Tech (~12%), High Alpha (15%)</span>
          </div>
        </div>

        {/* Right Column: Output Telemetry & Valuation Verdict */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          {/* Target Price Card */}
          <div style={{
            background: MONOKAI.bgDark,
            border: `1px solid ${isBuy ? MONOKAI.green : MONOKAI.pink}`,
            borderRadius: 8,
            padding: '18px 22px',
            boxShadow: isBuy ? '0 0 16px rgba(166, 226, 46, 0.15)' : 'none',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontFamily: MONOKAI.monoFont, fontSize: 11, fontWeight: 700, color: MONOKAI.muted, textTransform: 'uppercase' }}>
                TARGET BUY ENTRY PRICE ({desiredReturn}% Hurdle)
              </span>
              <span style={{
                fontFamily: MONOKAI.monoFont,
                fontSize: 11,
                fontWeight: 700,
                color: isBuy ? MONOKAI.green : MONOKAI.pink,
                background: isBuy ? 'rgba(166,226,46,0.15)' : 'rgba(249,38,114,0.15)',
                padding: '2px 8px',
                borderRadius: 4,
              }}>
                {isBuy ? 'UNDERVALUED' : 'EXPENSIVE'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, margin: '8px 0' }}>
              <span style={{ fontFamily: MONOKAI.monoFont, fontSize: 34, fontWeight: 800, color: MONOKAI.text }}>
                ${targetEntryPrice.toFixed(2)}
              </span>
              <span style={{ fontFamily: MONOKAI.monoFont, fontSize: 14, color: MONOKAI.muted }}>
                vs Current ${currentPrice.toFixed(2)}
              </span>
            </div>

            <div style={{ fontFamily: MONOKAI.monoFont, fontSize: 12, color: isBuy ? MONOKAI.green : MONOKAI.pink }}>
              {isBuy
                ? `✓ Trade entry offers a ${Math.abs(priceDeltaPct).toFixed(1)}% margin of safety at today's price.`
                : `⚠ Needs a ${Math.abs(priceDeltaPct).toFixed(1)}% market discount to hit target ${desiredReturn}% return.`}
            </div>
          </div>

          {/* Compounding Visual & CAGR Summary */}
          <div style={{
            background: MONOKAI.bgDark,
            border: `1px solid ${MONOKAI.border}`,
            borderRadius: 8,
            padding: '16px 20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 12,
          }}>
            <div>
              <span style={statLabelStyle}>IMPLIED CAGR</span>
              <div style={{
                fontFamily: MONOKAI.monoFont,
                fontSize: 20,
                fontWeight: 700,
                color: isCagrGood ? MONOKAI.green : MONOKAI.pink,
                marginTop: 4,
              }}>
                {impliedCagr.toFixed(1)}% / yr
              </div>
            </div>
            <div>
              <span style={statLabelStyle}>FUTURE SHARE PRICE</span>
              <div style={{ fontFamily: MONOKAI.monoFont, fontSize: 20, fontWeight: 700, color: MONOKAI.yellow, marginTop: 4 }}>
                ${futureStockPrice.toFixed(2)}
              </div>
            </div>
            <div>
              <span style={statLabelStyle}>FUTURE EPS ({years}Y)</span>
              <div style={{ fontFamily: MONOKAI.monoFont, fontSize: 20, fontWeight: 700, color: MONOKAI.cyan, marginTop: 4 }}>
                ${futureEps.toFixed(2)}
              </div>
            </div>
          </div>

          {/* D3 Trajectory Graph Card */}
          <div style={{
            background: MONOKAI.bgDark,
            border: `1px solid ${MONOKAI.border}`,
            borderRadius: 8,
            padding: '14px',
            height: 210,
          }}>
            <svg ref={graphSvgRef} />
          </div>
        </div>
      </div>

      {/* Hurdle Rate Sensitivity Table */}
      <div style={{
        background: MONOKAI.bgDark,
        border: `1px solid ${MONOKAI.border}`,
        borderRadius: 8,
        padding: '18px 22px',
      }}>
        <div style={{ fontFamily: MONOKAI.monoFont, fontSize: 12, fontWeight: 700, color: MONOKAI.muted, marginBottom: 12, textTransform: 'uppercase' }}>
          // TARGET BUY PRICES ACROSS HURDLE RATES
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 10,
        }}>
          {[8, 10, 12, 15, 20].map((hr) => {
            const hrPrice = futureStockPrice / Math.pow(1 + hr / 100, years);
            const isHrBuy = currentPrice > 0 && hrPrice >= currentPrice;
            return (
              <div
                key={hr}
                style={{
                  background: MONOKAI.bgSurface,
                  border: `1px solid ${hr === desiredReturn ? MONOKAI.cyan : MONOKAI.borderSubtle}`,
                  borderRadius: 6,
                  padding: '10px 14px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontFamily: MONOKAI.monoFont, fontSize: 11, color: MONOKAI.muted }}>{hr}% Hurdle</div>
                <div style={{ fontFamily: MONOKAI.monoFont, fontSize: 18, fontWeight: 700, color: MONOKAI.text, margin: '4px 0' }}>
                  ${hrPrice.toFixed(2)}
                </div>
                <div style={{
                  fontFamily: MONOKAI.monoFont,
                  fontSize: 10,
                  fontWeight: 700,
                  color: isHrBuy ? MONOKAI.green : MONOKAI.pink,
                }}>
                  {isHrBuy ? 'BUY TARGET' : 'DISCOUNT REQ'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sensitivity Heatmap Matrix: Growth Rate vs Exit P/E */}
      <div style={{
        background: MONOKAI.bgDark,
        border: `1px solid ${MONOKAI.border}`,
        borderRadius: 8,
        padding: '18px 22px',
        overflowX: 'auto',
      }}>
        <div style={{ fontFamily: MONOKAI.monoFont, fontSize: 12, fontWeight: 700, color: MONOKAI.muted, marginBottom: 12, textTransform: 'uppercase' }}>
          // SENSITIVITY MATRIX: IMPLIED CAGR (%) (Growth % vs Exit Multiple)
        </div>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: MONOKAI.monoFont,
          fontSize: 12,
          textAlign: 'center',
        }}>
          <thead>
            <tr>
              <th style={{ padding: '8px', color: MONOKAI.muted, borderBottom: `1px solid ${MONOKAI.border}` }}>
                Exit P/E ↓ \ Growth →
              </th>
              {growthSteps.map((gVal) => (
                <th key={gVal} style={{ padding: '8px', color: gVal === epsGrowthRate ? MONOKAI.cyan : MONOKAI.textDim, borderBottom: `1px solid ${MONOKAI.border}` }}>
                  {gVal.toFixed(1)}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {peSteps.map((peVal) => (
              <tr key={peVal}>
                <td style={{ padding: '8px', color: peVal === exitMultiple ? MONOKAI.purple : MONOKAI.textDim, fontWeight: 700, borderBottom: `1px solid ${MONOKAI.borderSubtle}` }}>
                  {peVal.toFixed(1)}x
                </td>
                {growthSteps.map((gVal) => {
                  const cellFutureEps = numEps * Math.pow(1 + gVal / 100, years);
                  const cellFuturePrice = cellFutureEps * peVal;
                  const cellCagr = currentPrice > 0 && cellFuturePrice > 0
                    ? (Math.pow(cellFuturePrice / currentPrice, 1 / years) - 1) * 100
                    : 0;

                  const isMatch = peVal === exitMultiple && gVal === epsGrowthRate;
                  const isGreat = cellCagr >= desiredReturn;
                  const isPoor = cellCagr < 5;

                  return (
                    <td
                      key={gVal}
                      style={{
                        padding: '8px',
                        borderBottom: `1px solid ${MONOKAI.borderSubtle}`,
                        fontWeight: isMatch ? 800 : 600,
                        color: isGreat ? MONOKAI.green : (isPoor ? MONOKAI.pink : MONOKAI.yellow),
                        background: isMatch ? 'rgba(102, 217, 239, 0.18)' : (isGreat ? 'rgba(166, 226, 46, 0.08)' : 'transparent'),
                        border: isMatch ? `1.5px solid ${MONOKAI.cyan}` : 'none',
                      }}
                    >
                      {cellCagr.toFixed(1)}%
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const presetBtnStyle = (color) => ({
  fontFamily: MONOKAI.monoFont,
  fontSize: 11,
  fontWeight: 600,
  color: color,
  background: 'transparent',
  border: `1px solid ${MONOKAI.borderSubtle}`,
  borderRadius: 4,
  padding: '3px 8px',
  cursor: 'pointer',
  transition: 'all 0.15s',
});

const inputRowStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const labelStyle = {
  fontFamily: MONOKAI.monoFont,
  fontSize: 12,
  fontWeight: 600,
  color: MONOKAI.textDim,
};

const hintStyle = {
  fontFamily: MONOKAI.monoFont,
  fontSize: 10,
  color: MONOKAI.muted,
};

const numberInputStyle = {
  fontFamily: MONOKAI.monoFont,
  fontSize: 13,
  fontWeight: 700,
  color: MONOKAI.text,
  background: MONOKAI.bgSurface,
  border: `1px solid ${MONOKAI.border}`,
  borderRadius: 4,
  padding: '3px 8px',
  width: 90,
  textAlign: 'right',
  outline: 'none',
};

const sliderStyle = {
  width: '100%',
  accentColor: MONOKAI.cyan,
  cursor: 'pointer',
};

const statLabelStyle = {
  fontFamily: MONOKAI.monoFont,
  fontSize: 10,
  color: MONOKAI.muted,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};
