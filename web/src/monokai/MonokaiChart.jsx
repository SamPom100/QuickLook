import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { MONOKAI } from './theme';

export const MONOKAI_CASH_LEGEND = [
  { key: 'revenue',      label: 'Revenue',         color: MONOKAI.cyan,   type: 'bar' },
  { key: 'netIncome',    label: 'Net Income',      color: MONOKAI.green,  type: 'bar' },
  { key: 'freeCashFlow', label: 'Free Cash Flow',  color: MONOKAI.yellow, type: 'bar' },
  { key: 'yoyGrowth',    label: 'Cum. Rev Growth', color: MONOKAI.orange, type: 'dotted' },
  { key: 'stock',        label: 'Stock Price ($)', color: MONOKAI.text,   type: 'line' },
];

export const MONOKAI_VALUATION_LEGEND = [
  { key: 'peRatio',  label: 'P/E (TTM)',       color: MONOKAI.purple, type: 'line' },
  { key: 'psRatio',  label: 'P/S (TTM)',       color: MONOKAI.cyan,   type: 'line' },
  { key: 'fcfYield', label: 'FCF Yield %',     color: MONOKAI.green,  type: 'line' },
  { key: 'stock',    label: 'Stock Price ($)', color: MONOKAI.text,   type: 'line' },
];

export const MONOKAI_GROWTH_LEGEND = [
  { key: 'revenueIdx',      label: 'Revenue Growth (%)',   color: MONOKAI.cyan,   type: 'line' },
  { key: 'netIncomeIdx',    label: 'Net Income (%)',       color: MONOKAI.green,  type: 'line' },
  { key: 'freeCashFlowIdx', label: 'Free Cash Flow (%)',   color: MONOKAI.yellow, type: 'line' },
  { key: 'epsIdx',          label: 'EPS Growth (%)',       color: MONOKAI.orange, type: 'line' },
  { key: 'stock',           label: 'Stock Return (%)',     color: MONOKAI.text,   type: 'line' },
];

export default function MonokaiChart({
  data,
  activeTab = 'cash',
  timeframe = '5Y',
  hiddenSeries = new Set(),
}) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 600 });

  // Responsive window resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth || (window.innerWidth - 64);
        const h = Math.max(window.innerHeight - 240, 480);
        setDimensions({ width: Math.max(w, 640), height: h });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Main D3 Rendering Effect
  useEffect(() => {
    if (!data || !svgRef.current) return;

    const rawQuarters = data.quarters || [];
    const rawStockPrices = data.stockPrices || [];
    if (rawQuarters.length === 0) return;

    // 1. Slice quarters by timeframe
    let quartersSlice = [...rawQuarters];
    const tfQuartersMap = { '1Y': 4, '3Y': 12, '5Y': 20, '10Y': 40 };
    const maxQ = tfQuartersMap[timeframe];
    if (maxQ && quartersSlice.length > maxQ) {
      quartersSlice = quartersSlice.slice(-maxQ);
    }

    const numQ = quartersSlice.length;
    const earliestDate = quartersSlice[0].date;

    // Filter stock prices from earliest date to latest
    const stockSlice = rawStockPrices.filter((sp) => sp.date >= earliestDate);
    const baseStockPrice = stockSlice.length > 0 ? stockSlice[0].y : 1;

    // 2. Computed Metrics for Relative Growth % (Base = 0% at start of timeframe)
    const firstQ = quartersSlice[0];
    const baseRev = firstQ.revenue || 1;
    const baseNI = firstQ.netIncome || 1;
    const baseFCF = firstQ.freeCashFlow || 1;
    const baseEPS = (firstQ.epsTTM != null && firstQ.epsTTM !== 0) ? firstQ.epsTTM : (firstQ.netIncome || 1);

    const quarters = quartersSlice.map((q) => ({
      ...q,
      revenueIdx: (((q.revenue - baseRev) / Math.abs(baseRev)) * 100),
      netIncomeIdx: (((q.netIncome - baseNI) / Math.abs(baseNI)) * 100),
      freeCashFlowIdx: (((q.freeCashFlow - baseFCF) / Math.abs(baseFCF)) * 100),
      epsIdx: ((( (q.epsTTM != null ? q.epsTTM : q.netIncome) - baseEPS) / Math.abs(baseEPS)) * 100),
    }));

    const stockPrices = stockSlice.map((sp) => ({
      ...sp,
      yIdx: (((sp.y - baseStockPrice) / baseStockPrice) * 100),
    }));

    // Setup Dimensions
    const { width, height } = dimensions;
    const margin = { top: 36, right: 80, bottom: 65, left: 85 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);

    // Canvas Container
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // X Scale Band (one slot per quarter + 1 slot for "Today")
    const xBand = d3.scaleBand()
      .domain(d3.range(numQ + 1))
      .range([0, innerW])
      .padding(0.18);

    const xLin = d3.scaleLinear()
      .domain([0, numQ])
      .range([xBand(0) + xBand.bandwidth() / 2, xBand(numQ) + xBand.bandwidth() / 2]);

    // X Dates map
    const qDates = quarters.map((q) => q.date);
    const getStockX = (dateStr) => {
      let idx = -1;
      for (let i = 0; i < qDates.length; i++) {
        if (dateStr <= qDates[i]) {
          if (i === 0) idx = 0;
          else {
            const prevD = new Date(qDates[i - 1]).getTime();
            const curD = new Date(qDates[i]).getTime();
            const targetD = new Date(dateStr).getTime();
            const frac = curD > prevD ? (targetD - prevD) / (curD - prevD) : 0;
            idx = (i - 1) + Math.max(0, Math.min(1, frac));
          }
          break;
        }
      }
      if (idx === -1) {
        // Between last quarter and today
        const lastQDate = new Date(qDates[qDates.length - 1]).getTime();
        const nowD = new Date().getTime();
        const targetD = new Date(dateStr).getTime();
        const frac = nowD > lastQDate ? (targetD - lastQDate) / (nowD - lastQDate) : 1;
        idx = (numQ - 1) + Math.max(0, Math.min(1, frac));
      }
      return xLin(idx);
    };

    // Calculate Y Domains
    let y1Min = 0;
    let y1Max = 10;
    let y2Min = 0;
    let y2Max = 10;

    if (activeTab === 'cash') {
      const showRev = !hiddenSeries.has('revenue');
      const showNI = !hiddenSeries.has('netIncome');
      const showFCF = !hiddenSeries.has('freeCashFlow');
      let vals = [];
      quarters.forEach((q) => {
        if (showRev && q.revenue != null) vals.push(q.revenue);
        if (showNI && q.netIncome != null) vals.push(q.netIncome);
        if (showFCF && q.freeCashFlow != null) vals.push(q.freeCashFlow);
      });
      if (vals.length === 0) vals = [0, 10];
      const maxVal = d3.max(vals) || 10;
      const minVal = d3.min(vals) || 0;
      y1Min = minVal < 0 ? minVal * 1.15 : 0;
      y1Max = maxVal * 1.12;

      // Y2: Stock Price
      const prices = stockPrices.map((sp) => sp.y);
      const minP = d3.min(prices) || 0;
      const maxP = d3.max(prices) || 100;
      y2Min = Math.max(0, minP * 0.85);
      y2Max = maxP * 1.08;
    } else if (activeTab === 'valuation') {
      const showPE = !hiddenSeries.has('peRatio');
      const showPS = !hiddenSeries.has('psRatio');
      const showYield = !hiddenSeries.has('fcfYield');
      let vals = [];
      quarters.forEach((q) => {
        if (showPE && q.peRatio != null && q.peRatio > 0 && q.peRatio <= 120) vals.push(q.peRatio);
        if (showPS && q.psRatio != null && q.psRatio > 0 && q.psRatio <= 80) vals.push(q.psRatio);
        if (showYield && q.fcfYield != null && q.fcfYield >= -20 && q.fcfYield <= 40) vals.push(q.fcfYield);
      });
      if (vals.length === 0) vals = [0, 50];
      const minVal = d3.min(vals) || 0;
      const maxVal = d3.max(vals) || 50;
      y1Min = minVal < 0 ? minVal * 1.2 : 0;
      y1Max = maxVal * 1.15;

      const prices = stockPrices.map((sp) => sp.y);
      y2Min = Math.max(0, (d3.min(prices) || 0) * 0.85);
      y2Max = (d3.max(prices) || 100) * 1.08;
    } else if (activeTab === 'growth') {
      // Relative growth %
      let vals = [];
      quarters.forEach((q) => {
        if (!hiddenSeries.has('revenueIdx')) vals.push(q.revenueIdx);
        if (!hiddenSeries.has('netIncomeIdx')) vals.push(q.netIncomeIdx);
        if (!hiddenSeries.has('freeCashFlowIdx')) vals.push(q.freeCashFlowIdx);
        if (!hiddenSeries.has('epsIdx')) vals.push(q.epsIdx);
      });
      if (!hiddenSeries.has('stock')) {
        stockPrices.forEach((sp) => vals.push(sp.yIdx));
      }
      if (vals.length === 0) vals = [-10, 100];
      const minVal = d3.min(vals) || -10;
      const maxVal = d3.max(vals) || 100;
      y1Min = Math.min(-10, minVal * 1.15);
      y1Max = Math.max(20, maxVal * 1.15);
      y2Min = y1Min;
      y2Max = y1Max;
    }

    // Zero Alignment Helper for Dual-Axis (Tab 1 & 2)
    if (activeTab === 'cash' && y1Min < 0) {
      // Align 0 on y1 with proportional level on y2
      const r1 = Math.abs(y1Min) / (y1Max - y1Min);
      y2Min = -r1 * y2Max / (1 - r1);
    }

    const y1Scale = d3.scaleLinear().domain([y1Min, y1Max]).range([innerH, 0]).nice();
    const y2Scale = d3.scaleLinear().domain([y2Min, y2Max]).range([innerH, 0]).nice();

    // 3. Grid Lines (Monokai subtle dashed)
    const yTicks = y1Scale.ticks(6);
    g.append('g')
      .attr('class', 'grid')
      .selectAll('line')
      .data(yTicks)
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', (d) => y1Scale(d))
      .attr('y2', (d) => y1Scale(d))
      .attr('stroke', MONOKAI.borderSubtle)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3');

    // Prominent 0 Baseline if 0 is in domain
    if (y1Min <= 0 && y1Max >= 0) {
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', y1Scale(0))
        .attr('y2', y1Scale(0))
        .attr('stroke', MONOKAI.muted)
        .attr('stroke-width', 1.2)
        .attr('stroke-dasharray', '4,2');
    }

    // 4. Render Bars for Cash & Earnings Tab
    if (activeTab === 'cash') {
      const showRev = !hiddenSeries.has('revenue');
      const showNI = !hiddenSeries.has('netIncome');
      const showFCF = !hiddenSeries.has('freeCashFlow');

      const slotW = xBand.bandwidth();
      // Nested layered bar widths
      const wRev = slotW * 0.95;
      const wNI  = slotW * 0.72;
      const wFCF = slotW * 0.48;

      quarters.forEach((q, i) => {
        const cx = xBand(i) + slotW / 2;
        const zeroY = y1Scale(0);

        // Revenue Bar
        if (showRev && q.revenue != null) {
          const valY = y1Scale(q.revenue);
          g.append('rect')
            .attr('x', cx - wRev / 2)
            .attr('y', Math.min(zeroY, valY))
            .attr('width', wRev)
            .attr('height', Math.abs(valY - zeroY))
            .attr('fill', MONOKAI.cyan)
            .attr('opacity', 0.85)
            .attr('rx', 2);
        }

        // Net Income Bar
        if (showNI && q.netIncome != null) {
          const valY = y1Scale(q.netIncome);
          const isNeg = q.netIncome < 0;
          g.append('rect')
            .attr('x', cx - wNI / 2)
            .attr('y', Math.min(zeroY, valY))
            .attr('width', wNI)
            .attr('height', Math.abs(valY - zeroY))
            .attr('fill', isNeg ? MONOKAI.pink : MONOKAI.green)
            .attr('opacity', 0.92)
            .attr('rx', 2);
        }

        // Free Cash Flow Bar
        if (showFCF && q.freeCashFlow != null) {
          const valY = y1Scale(q.freeCashFlow);
          const isNeg = q.freeCashFlow < 0;
          g.append('rect')
            .attr('x', cx - wFCF / 2)
            .attr('y', Math.min(zeroY, valY))
            .attr('width', wFCF)
            .attr('height', Math.abs(valY - zeroY))
            .attr('fill', isNeg ? MONOKAI.pink : MONOKAI.yellow)
            .attr('opacity', 0.95)
            .attr('rx', 2);
        }
      });

      // Cumulative YoY Growth Dotted Line
      if (!hiddenSeries.has('yoyGrowth')) {
        const validGrowth = quarters
          .map((q, i) => ({ x: xBand(i) + slotW / 2, y: q.revenueGrowthYoY }))
          .filter((pt) => pt.y != null);

        if (validGrowth.length > 1) {
          // Map to secondary percentage or y1 scale
          const growthLine = d3.line()
            .x((d) => d.x)
            .y((d) => y1Scale(d.y))
            .curve(d3.curveMonotoneX);

          g.append('path')
            .datum(validGrowth)
            .attr('d', growthLine)
            .attr('fill', 'none')
            .attr('stroke', MONOKAI.orange)
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '4,4');

          // Dots
          g.selectAll('.growth-dot')
            .data(validGrowth)
            .enter()
            .append('circle')
            .attr('cx', (d) => d.x)
            .attr('cy', (d) => y1Scale(d.y))
            .attr('r', 3)
            .attr('fill', MONOKAI.orange);
        }
      }
    }

    // 5. Render Lines for Valuation Tab
    if (activeTab === 'valuation') {
      const slotW = xBand.bandwidth();
      const renderValuationLine = (key, color) => {
        if (hiddenSeries.has(key)) return;
        const pts = quarters
          .map((q, i) => ({ x: xBand(i) + slotW / 2, y: q[key] }))
          .filter((pt) => pt.y != null && !isNaN(pt.y) && pt.y > 0 && pt.y <= 150);

        if (pts.length > 1) {
          const lineGen = d3.line()
            .x((d) => d.x)
            .y((d) => y1Scale(d.y))
            .curve(d3.curveMonotoneX);

          g.append('path')
            .datum(pts)
            .attr('d', lineGen)
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-width', 2.2);

          g.selectAll(`.dot-${key}`)
            .data(pts)
            .enter()
            .append('circle')
            .attr('cx', (d) => d.x)
            .attr('cy', (d) => y1Scale(d.y))
            .attr('r', 3.5)
            .attr('fill', color)
            .attr('stroke', MONOKAI.bgDark)
            .attr('stroke-width', 1.5);
        }
      };

      renderValuationLine('peRatio', MONOKAI.purple);
      renderValuationLine('psRatio', MONOKAI.cyan);
      renderValuationLine('fcfYield', MONOKAI.green);
    }

    // 6. Render Lines for Relative Growth Tab
    if (activeTab === 'growth') {
      const slotW = xBand.bandwidth();
      const renderGrowthLine = (key, color) => {
        if (hiddenSeries.has(key)) return;
        const pts = quarters
          .map((q, i) => ({ x: xBand(i) + slotW / 2, y: q[key] }))
          .filter((pt) => pt.y != null && !isNaN(pt.y));

        if (pts.length > 1) {
          const lineGen = d3.line()
            .x((d) => d.x)
            .y((d) => y1Scale(d.y))
            .curve(d3.curveMonotoneX);

          g.append('path')
            .datum(pts)
            .attr('d', lineGen)
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-width', 2);

          g.selectAll(`.gdot-${key}`)
            .data(pts)
            .enter()
            .append('circle')
            .attr('cx', (d) => d.x)
            .attr('cy', (d) => y1Scale(d.y))
            .attr('r', 3)
            .attr('fill', color);
        }
      };

      renderGrowthLine('revenueIdx', MONOKAI.cyan);
      renderGrowthLine('netIncomeIdx', MONOKAI.green);
      renderGrowthLine('freeCashFlowIdx', MONOKAI.yellow);
      renderGrowthLine('epsIdx', MONOKAI.orange);

      // Stock return line in growth mode
      if (!hiddenSeries.has('stock') && stockPrices.length > 1) {
        const stockLineGen = d3.line()
          .x((sp) => getStockX(sp.date))
          .y((sp) => y1Scale(sp.yIdx))
          .curve(d3.curveLinear);

        g.append('path')
          .datum(stockPrices)
          .attr('d', stockLineGen)
          .attr('fill', 'none')
          .attr('stroke', MONOKAI.text)
          .attr('stroke-width', 2.2);
      }
    }

    // 7. Render Stock Price Line (on Y2 scale for Cash & Valuation tabs)
    if ((activeTab === 'cash' || activeTab === 'valuation') && !hiddenSeries.has('stock') && stockPrices.length > 1) {
      const stockLineGen = d3.line()
        .x((sp) => getStockX(sp.date))
        .y((sp) => y2Scale(sp.y))
        .curve(d3.curveLinear);

      g.append('path')
        .datum(stockPrices)
        .attr('d', stockLineGen)
        .attr('fill', 'none')
        .attr('stroke', MONOKAI.text)
        .attr('stroke-width', 2.2)
        .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))');

      // Latest Price Pulse Circle
      const lastPt = stockPrices[stockPrices.length - 1];
      if (lastPt) {
        const lx = getStockX(lastPt.date);
        const ly = y2Scale(lastPt.y);
        g.append('circle')
          .attr('cx', lx)
          .attr('cy', ly)
          .attr('r', 4.5)
          .attr('fill', MONOKAI.yellow)
          .attr('stroke', MONOKAI.bgDark)
          .attr('stroke-width', 2);
      }
    }

    // 8. Axes Formatting
    // X Axis
    const xAxis = d3.axisBottom(xBand)
      .tickFormat((i) => {
        if (i === numQ) return 'Today';
        return quarters[i]?.date || '';
      });

    const gX = g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis);

    gX.select('.domain').attr('stroke', MONOKAI.border);
    gX.selectAll('.tick line').attr('stroke', MONOKAI.borderSubtle);
    gX.selectAll('.tick text')
      .attr('fill', MONOKAI.muted)
      .attr('font-family', MONOKAI.monoFont)
      .attr('font-size', 10)
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end')
      .attr('dx', '-0.5em')
      .attr('dy', '0.2em');

    // Left Y Axis
    const formatY1 = (val) => {
      if (activeTab === 'growth') return `${val >= 0 ? '+' : ''}${val.toFixed(0)}%`;
      if (activeTab === 'valuation') return `${val.toFixed(0)}x`;
      if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
      if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
      return `$${val.toFixed(1)}B`;
    };

    const y1Axis = d3.axisLeft(y1Scale).ticks(6).tickFormat(formatY1);
    const gY1 = g.append('g').call(y1Axis);
    gY1.select('.domain').attr('stroke', MONOKAI.border);
    gY1.selectAll('.tick line').attr('stroke', MONOKAI.borderSubtle);
    gY1.selectAll('.tick text')
      .attr('fill', MONOKAI.textDim)
      .attr('font-family', MONOKAI.monoFont)
      .attr('font-size', 11);

    // Left Y Label
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -65)
      .attr('x', -innerH / 2)
      .attr('fill', MONOKAI.muted)
      .attr('font-family', MONOKAI.monoFont)
      .attr('font-size', 11)
      .attr('text-anchor', 'middle')
      .text(activeTab === 'growth' ? 'GROWTH RETURN (%)' : activeTab === 'valuation' ? 'VALUATION MULTIPLES' : 'FINANCIALS ($B)');

    // Right Y Axis (Stock Price)
    if (activeTab !== 'growth') {
      const y2Axis = d3.axisRight(y2Scale).ticks(6).tickFormat((d) => `$${d.toFixed(0)}`);
      const gY2 = g.append('g').attr('transform', `translate(${innerW},0)`).call(y2Axis);
      gY2.select('.domain').attr('stroke', MONOKAI.border);
      gY2.selectAll('.tick line').attr('stroke', MONOKAI.borderSubtle);
      gY2.selectAll('.tick text')
        .attr('fill', MONOKAI.yellow)
        .attr('font-family', MONOKAI.monoFont)
        .attr('font-size', 11);

      g.append('text')
        .attr('transform', 'rotate(90)')
        .attr('y', -innerW - 65)
        .attr('x', innerH / 2)
        .attr('fill', MONOKAI.yellow)
        .attr('font-family', MONOKAI.monoFont)
        .attr('font-size', 11)
        .attr('text-anchor', 'middle')
        .text('SHARE PRICE ($)');
    }

    // 9. Interactive Hover Crosshair & Monospace Tooltip
    const crosshair = g.append('line')
      .attr('y1', 0)
      .attr('y2', innerH)
      .attr('stroke', MONOKAI.cyan)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3')
      .style('opacity', 0)
      .style('pointer-events', 'none');

    const overlay = g.append('rect')
      .attr('width', innerW)
      .attr('height', innerH)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair');

    overlay.on('mousemove', (event) => {
      const [mx, my] = d3.pointer(event);
      const slotW = xBand.step();
      let qIdx = Math.floor(mx / slotW);
      qIdx = Math.max(0, Math.min(numQ, qIdx));

      const cx = xBand(qIdx) + xBand.bandwidth() / 2;
      crosshair.attr('x1', cx).attr('x2', cx).style('opacity', 0.8);

      const q = quarters[qIdx];
      const isToday = qIdx === numQ;
      const tooltip = d3.select(tooltipRef.current);

      let tooltipHtml = '';
      if (isToday) {
        const lastSp = stockPrices[stockPrices.length - 1];
        tooltipHtml = `
          <div style="color:${MONOKAI.yellow};font-weight:700;margin-bottom:4px;">TODAY</div>
          <div>Stock: <strong style="color:#fff">$${lastSp ? lastSp.y.toFixed(2) : '—'}</strong></div>
        `;
      } else if (q) {
        if (activeTab === 'cash') {
          tooltipHtml = `
            <div style="color:${MONOKAI.cyan};font-weight:700;border-bottom:1px solid ${MONOKAI.borderSubtle};padding-bottom:4px;margin-bottom:6px;">
              ${q.date}
            </div>
            <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:12px;">
              <span style="color:${MONOKAI.cyan}">Revenue:</span>
              <strong style="text-align:right;color:#fff">$${q.revenue != null ? q.revenue.toFixed(2) : '—'}B</strong>
              <span style="color:${MONOKAI.green}">Net Income:</span>
              <strong style="text-align:right;color:${(q.netIncome || 0) >= 0 ? MONOKAI.green : MONOKAI.pink}">$${q.netIncome != null ? q.netIncome.toFixed(2) : '—'}B</strong>
              <span style="color:${MONOKAI.yellow}">FCF:</span>
              <strong style="text-align:right;color:#fff">$${q.freeCashFlow != null ? q.freeCashFlow.toFixed(2) : '—'}B</strong>
              ${q.epsTTM != null ? `
                <span style="color:${MONOKAI.orange}">EPS (TTM):</span>
                <strong style="text-align:right;color:#fff">$${q.epsTTM.toFixed(2)}</strong>
              ` : ''}
            </div>
          `;
        } else if (activeTab === 'valuation') {
          tooltipHtml = `
            <div style="color:${MONOKAI.purple};font-weight:700;border-bottom:1px solid ${MONOKAI.borderSubtle};padding-bottom:4px;margin-bottom:6px;">
              ${q.date}
            </div>
            <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:12px;">
              <span style="color:${MONOKAI.purple}">P/E (TTM):</span>
              <strong style="text-align:right;color:#fff">${q.peRatio != null ? q.peRatio.toFixed(1) : '—'}x</strong>
              <span style="color:${MONOKAI.cyan}">P/S (TTM):</span>
              <strong style="text-align:right;color:#fff">${q.psRatio != null ? q.psRatio.toFixed(1) : '—'}x</strong>
              <span style="color:${MONOKAI.green}">FCF Yield:</span>
              <strong style="text-align:right;color:#fff">${q.fcfYield != null ? q.fcfYield.toFixed(2) : '—'}%</strong>
            </div>
          `;
        } else if (activeTab === 'growth') {
          tooltipHtml = `
            <div style="color:${MONOKAI.yellow};font-weight:700;border-bottom:1px solid ${MONOKAI.borderSubtle};padding-bottom:4px;margin-bottom:6px;">
              ${q.date} (vs ${quarters[0].date})
            </div>
            <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:12px;">
              <span style="color:${MONOKAI.cyan}">Rev Return:</span>
              <strong style="text-align:right;color:#fff">${q.revenueIdx >= 0 ? '+' : ''}${q.revenueIdx.toFixed(1)}%</strong>
              <span style="color:${MONOKAI.green}">NI Return:</span>
              <strong style="text-align:right;color:#fff">${q.netIncomeIdx >= 0 ? '+' : ''}${q.netIncomeIdx.toFixed(1)}%</strong>
              <span style="color:${MONOKAI.yellow}">FCF Return:</span>
              <strong style="text-align:right;color:#fff">${q.freeCashFlowIdx >= 0 ? '+' : ''}${q.freeCashFlowIdx.toFixed(1)}%</strong>
            </div>
          `;
        }
      }

      tooltip
        .style('opacity', 1)
        .html(tooltipHtml)
        .style('left', `${event.clientX + 16}px`)
        .style('top', `${event.clientY - 30}px`);
    });

    overlay.on('mouseleave', () => {
      crosshair.style('opacity', 0);
      d3.select(tooltipRef.current).style('opacity', 0);
    });

  }, [data, activeTab, timeframe, dimensions, hiddenSeries]);

  return (
    <div ref={containerRef} style={{
      position: 'relative',
      background: MONOKAI.bgDark,
      border: `1px solid ${MONOKAI.border}`,
      borderRadius: 8,
      padding: '12px 16px',
      overflow: 'hidden',
    }}>
      <svg ref={svgRef} style={{ display: 'block', width: '100%' }} />
      <div
        ref={tooltipRef}
        style={{
          position: 'fixed',
          opacity: 0,
          background: MONOKAI.bgDark,
          color: MONOKAI.text,
          border: `1px solid ${MONOKAI.border}`,
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          padding: '10px 14px',
          borderRadius: 6,
          fontFamily: MONOKAI.monoFont,
          fontSize: 12,
          pointerEvents: 'none',
          zIndex: 1000,
          transition: 'opacity 0.1s ease',
        }}
      />
    </div>
  );
}
