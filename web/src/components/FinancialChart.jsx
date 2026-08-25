import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import DCFCalculator from './DCFCalculator';
import DCFHistoryCharts from './DCFHistoryCharts';

const CASH_METRICS = [
  { key: 'revenue',      label: 'Revenue',        color: 'rgb(31, 119, 180)',  widthFrac: 1.0,  type: 'bar' },
  { key: 'netIncome',    label: 'Net Income',     color: 'rgb(152, 223, 138)', widthFrac: 0.82, type: 'bar' },
  { key: 'freeCashFlow', label: 'Free Cash Flow', color: 'rgb(44, 160, 44)',   widthFrac: 0.64, type: 'bar' },
];

const CASH_LEGEND_ITEMS = [
  { key: 'revenue',      label: 'Revenue',                   color: 'rgb(31, 119, 180)',  type: 'bar' },
  { key: 'netIncome',    label: 'Net Income',                color: 'rgb(152, 223, 138)', type: 'bar' },
  { key: 'freeCashFlow', label: 'Free Cash Flow',            color: 'rgb(44, 160, 44)',   type: 'bar' },
  { key: 'yoyGrowth',    label: 'Cum. Rev Growth (Dotted)',  color: '#d97706',            type: 'dotted' },
  { key: 'stock',        label: 'Stock Price ($)',           color: '#000',               type: 'line' },
];

const VALUATION_METRICS = [
  { key: 'peRatio',   label: 'P/E Ratio (TTM)',     color: 'rgb(148, 103, 189)', type: 'line' },
  { key: 'psRatio',   label: 'P/S Ratio (TTM)',     color: 'rgb(31, 119, 180)',  type: 'line' },
  { key: 'fcfYield',  label: 'FCF Yield % (TTM)',   color: 'rgb(44, 160, 44)',   type: 'line' },
];

const VALUATION_LEGEND_ITEMS = [
  { key: 'peRatio',   label: 'P/E Ratio (TTM)',     color: 'rgb(148, 103, 189)', type: 'line' },
  { key: 'psRatio',   label: 'P/S Ratio (TTM)',     color: 'rgb(31, 119, 180)',  type: 'line' },
  { key: 'fcfYield',  label: 'FCF Yield % (TTM)',   color: 'rgb(44, 160, 44)',   type: 'line' },
  { key: 'stock',     label: 'Stock Price ($)',     color: '#000',               type: 'line' },
];

const INDEX_METRICS = [
  { key: 'revenueIdx',      label: 'Revenue Growth (%)',        color: 'rgb(31, 119, 180)',  type: 'line' },
  { key: 'epsIdx',          label: 'EPS Growth (%)',            color: 'rgb(245, 158, 11)',  type: 'line' },
  { key: 'netIncomeIdx',    label: 'Net Income Growth (%)',     color: 'rgb(152, 223, 138)', type: 'line' },
  { key: 'freeCashFlowIdx', label: 'Free Cash Flow Growth (%)', color: 'rgb(44, 160, 44)',   type: 'line' },
];

const INDEX_LEGEND_ITEMS = [
  { key: 'revenueIdx',      label: 'Revenue Growth (%)',        color: 'rgb(31, 119, 180)',  type: 'line' },
  { key: 'epsIdx',          label: 'EPS Growth (%)',            color: 'rgb(245, 158, 11)',  type: 'line' },
  { key: 'netIncomeIdx',    label: 'Net Income Growth (%)',     color: 'rgb(152, 223, 138)', type: 'line' },
  { key: 'freeCashFlowIdx', label: 'Free Cash Flow Growth (%)', color: 'rgb(44, 160, 44)',   type: 'line' },
  { key: 'stock',           label: 'Stock Return (%)',          color: '#000',               type: 'line' },
];

export default function FinancialChart({ data, onSelectTicker }) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);

  const [activeTab, setActiveTab] = useState('cash'); // 'cash', 'valuation', 'growth', 'dcf_drivers', or 'dcf'
  const [dimensions, setDimensions] = useState({ width: 1400, height: 750 });
  const [hidden, setHidden] = useState(new Set());

  const toggleSeries = (key) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  let currentLegendItems = [];
  if (activeTab === 'cash') currentLegendItems = CASH_LEGEND_ITEMS;
  else if (activeTab === 'valuation') currentLegendItems = VALUATION_LEGEND_ITEMS;
  else if (activeTab === 'growth') currentLegendItems = INDEX_LEGEND_ITEMS;

  // Responsive resize — fill viewport
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth - 40;
      const h = window.innerHeight - 200;
      setDimensions({ width: Math.max(w, 600), height: Math.max(h, 380) });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Reset hidden state on tab switch or data change
  useEffect(() => {
    setHidden(new Set());
  }, [data, activeTab]);

  // D3 rendering
  useEffect(() => {
    if (!data || !svgRef.current || activeTab === 'dcf' || activeTab === 'dcf_drivers') return;

    const { quarters, stockPrices, ticker, kpis } = data;
    const numQ = quarters.length;
    const { width, height } = dimensions;

    const margin = { top: 56, right: 75, bottom: 140, left: 88 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const labels = quarters.map((q) => q.date);
    labels.push('Today');

    // Compute Percentage Growth (%) series for Tab 3 ('growth') — Base = 0%!
    const firstQ = quarters[0] || {};
    const baseRev = firstQ.revenue || 1;
    const baseNI = firstQ.netIncome || 1;
    const baseFCF = firstQ.freeCashFlow || 1;
    const baseEPS = (firstQ.epsTTM !== undefined && firstQ.epsTTM !== null && firstQ.epsTTM !== 0)
      ? firstQ.epsTTM
      : (firstQ.netIncome || 1);

    const indexedQuarters = quarters.map((q) => {
      const qEps = (q.epsTTM !== undefined && q.epsTTM !== null) ? q.epsTTM : q.netIncome;
      return {
        ...q,
        revenueIdx: (((q.revenue - baseRev) / Math.abs(baseRev)) * 100),
        epsIdx: (((qEps - baseEPS) / Math.abs(baseEPS)) * 100),
        netIncomeIdx: (((q.netIncome - baseNI) / Math.abs(baseNI)) * 100),
        freeCashFlowIdx: (((q.freeCashFlow - baseFCF) / Math.abs(baseFCF)) * 100),
      };
    });

    const baseStockPrice = (stockPrices && stockPrices.length > 0) ? stockPrices[0].y : 1;
    const indexedStockPrices = stockPrices.map((sp) => ({
      ...sp,
      yIdx: (((sp.y - baseStockPrice) / baseStockPrice) * 100),
    }));

    let currentMetrics;
    if (activeTab === 'cash') currentMetrics = CASH_METRICS;
    else if (activeTab === 'valuation') currentMetrics = VALUATION_METRICS;
    else currentMetrics = INDEX_METRICS;

    const visibleMetrics = currentMetrics.filter((m) => !hidden.has(m.key));
    const showStock = !hidden.has('stock');

    // X scales
    const xBand = d3.scaleBand()
      .domain(d3.range(numQ + 1))
      .range([0, innerW])
      .padding(0);

    const xLin = d3.scaleLinear()
      .domain([0, numQ])
      .range([xBand.bandwidth() / 2, innerW - xBand.bandwidth() / 2]);

    // Y Left scale calculation
    let yLeft;
    let yRight;
    const unitSuffix = data.unitSuffix || 'B';
    let leftAxisTitle;
    if (activeTab === 'cash') leftAxisTitle = data.unitLabel || '$B';
    else if (activeTab === 'valuation') leftAxisTitle = 'Multiple (x) / Yield (%)';
    else leftAxisTitle = 'Cumulative Growth since Start (%)';

    if (activeTab === 'cash') {
      const allVals = quarters.flatMap((q) => currentMetrics.map((m) => q[m.key]));
      const yMaxF = allVals.length ? d3.max(allVals) * 1.08 : 1;
      const yMinF = allVals.length ? Math.min(0, d3.min(allVals) * 1.1) : 0;
      yLeft = d3.scaleLinear().domain([yMinF, yMaxF]).range([innerH, 0]).nice();

      const domainLeft = yLeft.domain();
      const zeroRatio = (0 - domainLeft[0]) / (domainLeft[1] - domainLeft[0]);
      const priceExtent = d3.extent(stockPrices, (d) => d.y);
      const pMax = (priceExtent[1] || 1) * 1.05;
      const pMin = zeroRatio > 0 ? -pMax * (zeroRatio / (1 - zeroRatio)) : 0;

      yRight = d3.scaleLinear().domain([pMin, pMax]).range([innerH, 0]);
    } else if (activeTab === 'valuation') {
      const allVals = quarters.flatMap((q) =>
        currentMetrics.map((m) => q[m.key]).filter((v) => v !== null && v !== undefined)
      );
      const yMaxF = allVals.length ? d3.max(allVals) * 1.15 : 50;
      const yMinF = allVals.length ? Math.min(0, d3.min(allVals) * 1.1) : 0;
      yLeft = d3.scaleLinear().domain([yMinF, yMaxF]).range([innerH, 0]).nice();

      const domainLeft = yLeft.domain();
      const zeroRatio = (0 - domainLeft[0]) / (domainLeft[1] - domainLeft[0]);
      const priceExtent = d3.extent(stockPrices, (d) => d.y);
      const pMax = (priceExtent[1] || 1) * 1.05;
      const pMin = zeroRatio > 0 ? -pMax * (zeroRatio / (1 - zeroRatio)) : 0;

      yRight = d3.scaleLinear().domain([pMin, pMax]).range([innerH, 0]);
    } else {
      // TAB 3: Relative Growth (Single shared Percentage Growth scale!)
      const allIdxVals = [
        ...indexedQuarters.flatMap((q) => visibleMetrics.map((m) => q[m.key])),
        ...(showStock ? indexedStockPrices.map((sp) => sp.yIdx) : [0])
      ].filter((v) => v !== null && v !== undefined && !isNaN(v));

      const yMaxIdx = allIdxVals.length ? d3.max(allIdxVals) * 1.1 : 100;
      const yMinIdx = allIdxVals.length ? Math.min(0, d3.min(allIdxVals) * 1.1) : 0;
      yLeft = d3.scaleLinear().domain([yMinIdx, yMaxIdx]).range([innerH, 0]).nice();
      yRight = null; // No secondary Y-axis needed! Single shared scale!
    }

    // 0% Reference Line on Tab 3
    if (activeTab === 'growth') {
      g.append('line')
        .attr('x1', 0)
        .attr('y1', yLeft(0))
        .attr('x2', innerW)
        .attr('y2', yLeft(0))
        .attr('stroke', '#64748b')
        .attr('stroke-dasharray', '4,4')
        .attr('stroke-width', 1.5);

      g.append('text')
        .attr('x', 6)
        .attr('y', yLeft(0) - 6)
        .style('font-size', '11px')
        .style('fill', '#475569')
        .style('font-weight', '600')
        .text('0% Baseline (Start)');
    }

    // RENDER TAB 1: 2 STACKED SUB-PANES (Top: Financial Bars + YoY Growth %; Bottom: Stock Price $ + Return %)
    if (activeTab === 'cash') {
      const gap = 48;
      const topH = innerH * 0.54;
      const bottomH = innerH - topH - gap;

      const gTop = g.append('g');
      const gBottom = g.append('g').attr('transform', `translate(0, ${topH + gap})`);

      // Compute Cumulative Revenue Growth % for Top Pane (Starts at 0% at t=0!)
      const baseRev = (quarters.length > 0 && quarters[0].revenue > 0) ? quarters[0].revenue : 1;
      const cumRevData = quarters.map((q, i) => {
        const growth = ((q.revenue - baseRev) / baseRev) * 100;
        return { x: i, cumRev: Math.round(growth * 10) / 10 };
      });

      // Top Pane Left Y-Scale (Financial Bars $B)
      const allVals = quarters.flatMap((q) => currentMetrics.map((m) => q[m.key]));
      const yMaxF = allVals.length ? d3.max(allVals) * 1.08 : 1;
      const yMinF = allVals.length ? Math.min(0, d3.min(allVals) * 1.1) : 0;
      const yLeftTop = d3.scaleLinear().domain([yMinF, yMaxF]).range([topH, 0]).nice();

      // Top Pane Right Y-Scale (Cumulative Revenue Growth % — synchronized with yLeftTop!)
      const domainLeftTop = yLeftTop.domain(); // [yMinF, yMaxF] e.g. [-10, 100]
      const zeroRatioTop = (0 - domainLeftTop[0]) / (domainLeftTop[1] - domainLeftTop[0]);
      const cumVals = cumRevData.map((d) => d.cumRev);
      const cumMax = cumVals.length ? d3.max(cumVals) * 1.12 : 100;
      const cumMin = zeroRatioTop > 0 ? -cumMax * (zeroRatioTop / (1 - zeroRatioTop)) : 0;
      const yRightTop = d3.scaleLinear().domain([cumMin, cumMax]).range([topH, 0]);

      // Bottom Pane Left Y-Scale (Stock Price $ — starts strictly at initial price baseP!)
      const priceExtent = d3.extent(stockPrices, (d) => d.y);
      const baseP = (stockPrices.length > 0 && stockPrices[0].y > 0) ? stockPrices[0].y : 1;
      const minP = Math.min(baseP, (priceExtent[0] || baseP));
      const maxP = (priceExtent[1] || 1) * 1.05;
      const yLeftBottom = d3.scaleLinear().domain([minP, maxP]).range([bottomH, 0]);

      // Bottom Pane Right Y-Scale (% Return — starts strictly at 0%!)
      const retMax = ((maxP / baseP) - 1) * 100;
      const yRightBottom = d3.scaleLinear().domain([0, retMax]).range([bottomH, 0]);

      // Explicit Ticks for Panel 1 including forced 0 tick mark
      let customLeftTopTicks;
      let customRightTopTicks;

      if (domainLeftTop[0] < 0) {
        const bottomVal = Math.round(domainLeftTop[0]); // e.g. -10
        const topVal = Math.round(domainLeftTop[1]); // e.g. 100
        customLeftTopTicks = [bottomVal, 0, Math.round(topVal * 0.25), Math.round(topVal * 0.5), Math.round(topVal * 0.75), topVal];
        customRightTopTicks = [Math.round(cumMin), 0, Math.round(cumMax * 0.25), Math.round(cumMax * 0.5), Math.round(cumMax * 0.75), Math.round(cumMax)];
      } else {
        const spanTopLeft = domainLeftTop[1] - domainLeftTop[0];
        const spanTopRight = cumMax - cumMin;
        customLeftTopTicks = [0, 0.25, 0.5, 0.75, 1.0].map((f) => domainLeftTop[0] + spanTopLeft * f);
        customRightTopTicks = [0, 0.25, 0.5, 0.75, 1.0].map((f) => cumMin + spanTopRight * f);
      }

      // Draw Grid Lines for Top Pane
      for (let tickVal of customLeftTopTicks) {
        const yPos = yLeftTop(tickVal);
        gTop.append('line')
          .attr('x1', 0).attr('y1', yPos).attr('x2', innerW).attr('y2', yPos)
          .attr('stroke', tickVal === 0 ? '#64748b' : '#e2e8f0')
          .attr('stroke-dasharray', tickVal === 0 ? '4,4' : '3,3')
          .attr('stroke-width', tickVal === 0 ? 1.5 : 1);
      }

      // 5 Harmonized Grid Lines for Panel 2 (Bottom Pane — shared by Left & Right axes!)
      const customRightBottomTicks = [0, 0.25, 0.5, 0.75, 1.0].map((f) => retMax * f);

      for (let f of [0, 0.25, 0.5, 0.75, 1.0]) {
        const yPos = bottomH * (1 - f);
        gBottom.append('line')
          .attr('x1', 0).attr('y1', yPos).attr('x2', innerW).attr('y2', yPos)
          .attr('stroke', '#e2e8f0').attr('stroke-dasharray', '3,3');
      }

      // TOP PANE: Render Financial Bars
      for (let qi = 0; qi < numQ; qi++) {
        const q = quarters[qi];
        const cx = xBand(qi) + xBand.bandwidth() / 2;
        const bw = xBand.bandwidth();

        const entries = visibleMetrics.map((m) => ({ ...m, value: q[m.key] }));
        entries.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

        for (const entry of entries) {
          const barW = bw * entry.widthFrac;
          const yVal = yLeftTop(entry.value);
          const yZero = yLeftTop(0);
          const barH = Math.abs(yVal - yZero);
          const barY = entry.value >= 0 ? yVal : yZero;

          gTop.append('rect')
            .attr('x', cx - barW / 2)
            .attr('y', barY)
            .attr('width', barW)
            .attr('height', barH)
            .attr('fill', entry.color)
            .attr('opacity', 0.88);
        }
      }

      // TOP PANE: Render Cumulative Revenue Growth % Line
      if (!hidden.has('yoyGrowth')) {
        const validCum = cumRevData.filter((d) => d.cumRev !== null && !isNaN(d.cumRev));
        if (validCum.length > 0) {
          const cumLine = d3.line()
            .x((d) => xBand(d.x) + xBand.bandwidth() / 2)
            .y((d) => yRightTop(d.cumRev))
            .curve(d3.curveMonotoneX);

          gTop.append('path')
            .datum(validCum)
            .attr('d', cumLine)
            .attr('fill', 'none')
            .attr('stroke', '#d97706')
            .attr('stroke-width', 2.2)
            .attr('stroke-dasharray', '4,3');

          gTop.selectAll('.dot-cumrev')
            .data(validCum)
            .enter().append('circle')
            .attr('cx', (d) => xBand(d.x) + xBand.bandwidth() / 2)
            .attr('cy', (d) => yRightTop(d.cumRev))
            .attr('r', 3)
            .attr('fill', '#d97706');
        }
      }

      // TOP PANE Axes (Harmonized ticks on grid lines!)
      const yAxisLeftTop = gTop.append('g').call(d3.axisLeft(yLeftTop).tickValues(customLeftTopTicks).tickFormat((v) => `${Math.round(v)}`));
      yAxisLeftTop.select('.domain').attr('stroke', '#bbb');
      yAxisLeftTop.selectAll('.tick text').style('font-size', '11px').style('fill', '#444');

      gTop.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -topH / 2)
        .attr('y', -52)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px').style('font-weight', '600').style('fill', '#333')
        .text(`Financials (${data.unitLabel || '$B'})`);

      const yAxisRightTop = gTop.append('g').attr('transform', `translate(${innerW},0)`).call(d3.axisRight(yRightTop).tickValues(customRightTopTicks).tickFormat((v) => `${v > 0 ? '+' : ''}${Math.round(v)}%`));
      yAxisRightTop.select('.domain').attr('stroke', '#bbb');
      yAxisRightTop.selectAll('.tick text').style('font-size', '11px').style('fill', '#d97706');

      gTop.append('text')
        .attr('transform', 'rotate(90)')
        .attr('x', topH / 2)
        .attr('y', -innerW - 52)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px').style('font-weight', '600').style('fill', '#d97706')
        .text('Cumulative Rev Growth (%)');

      // Top Pane Title Header
      gTop.append('text')
        .attr('x', 4)
        .attr('y', 14)
        .style('font-size', '12px')
        .style('font-weight', '700')
        .style('fill', '#475569')
        .text('PANEL 1: FINANCIAL PERFORMANCE & CUMULATIVE REVENUE GROWTH (%)');

      // BOTTOM PANE: Render Stock Price Line
      if (showStock && stockPrices.length > 0) {
        const stockLine = d3.line()
          .x((d) => xLin(d.x))
          .y((d) => yLeftBottom(d.y))
          .curve(d3.curveLinear);

        gBottom.append('path')
          .datum(stockPrices)
          .attr('d', stockLine)
          .attr('fill', 'none')
          .attr('stroke', '#000')
          .attr('stroke-width', 2)
          .attr('stroke-opacity', 0.85);
      }

      // BOTTOM PANE Axes (Harmonized ticks on grid lines!)
      const spanP = maxP - minP;
      const customPriceTicks = [0, 0.25, 0.5, 0.75, 1.0].map((f) => minP + spanP * f);

      const yAxisLeftBottom = gBottom.append('g')
        .call(d3.axisLeft(yLeftBottom).tickValues(customPriceTicks).tickFormat((v) => `$${Math.round(v)}`));
      yAxisLeftBottom.select('.domain').attr('stroke', '#bbb');
      yAxisLeftBottom.selectAll('.tick text').style('font-size', '11px').style('fill', '#444');

      gBottom.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -bottomH / 2)
        .attr('y', -52)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px').style('font-weight', '600').style('fill', '#333')
        .text('Stock Price ($)');

      const yAxisRightBottom = gBottom.append('g').attr('transform', `translate(${innerW},0)`).call(d3.axisRight(yRightBottom).tickValues(customRightBottomTicks).tickFormat((v) => `${v > 0 ? '+' : ''}${Math.round(v)}%`));
      yAxisRightBottom.select('.domain').attr('stroke', '#bbb');
      yAxisRightBottom.selectAll('.tick text').style('font-size', '11px').style('fill', '#059669');

      gBottom.append('text')
        .attr('transform', 'rotate(90)')
        .attr('x', bottomH / 2)
        .attr('y', -innerW - 52)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px').style('font-weight', '600').style('fill', '#059669')
        .text('Return since 2016 (%)');

      // Bottom Pane Title Header
      gBottom.append('text')
        .attr('x', 4)
        .attr('y', 14)
        .style('font-size', '12px')
        .style('font-weight', '700')
        .style('fill', '#475569')
        .text('PANEL 2: STOCK PRICE & % RETURN FROM START');

      // Shared X Axis (at bottom of lower pane)
      const xAxis = gBottom.append('g')
        .attr('transform', `translate(0,${bottomH})`)
        .call(d3.axisBottom(xBand).tickFormat((i) => labels[i] || ''));

      xAxis.selectAll('text')
        .attr('transform', 'rotate(-90)')
        .attr('text-anchor', 'end')
        .attr('dx', '-0.6em')
        .attr('dy', '-0.4em')
        .style('font-size', '11px')
        .style('font-weight', '700')
        .style('fill', '#333');

      xAxis.select('.domain').attr('stroke', '#bbb');
      xAxis.selectAll('.tick line').attr('stroke', '#bbb');

      // SYNCED CROSSHAIR TOOLTIP OVERLAY ACROSS BOTH PANES
      const tooltip = d3.select(tooltipRef.current);
      const bisect = d3.bisector((d) => d.x).left;

      g.append('rect')
        .attr('width', innerW)
        .attr('height', innerH)
        .attr('fill', 'transparent')
        .style('cursor', 'crosshair')
        .on('mousemove', (event) => {
          const [mx] = d3.pointer(event);
          const xVal = xLin.invert(mx);
          const qi = Math.round(xVal);

          if (qi < 0 || qi >= numQ) {
            tooltip.style('opacity', 0);
            return;
          }

          const q = quarters[qi];
          const cumItem = cumRevData[qi];
          const si = bisect(stockPrices, xVal);
          const sp = stockPrices[Math.min(si, stockPrices.length - 1)];

          const fmt = (v) => (v !== null && v !== undefined && !isNaN(v)) ? Number(v).toFixed(1) : '0.0';

          let rows = `<div style="font-weight:700;margin-bottom:6px;border-bottom:1px solid #444;padding-bottom:4px">${q.date}</div>`;
          
          if (!hidden.has('revenue'))      rows += `<div style="color:rgb(31,119,180)">Revenue: $${fmt(q.revenue)}${unitSuffix}</div>`;
          if (!hidden.has('netIncome'))    rows += `<div style="color:rgb(152,223,138)">Net Income: $${fmt(q.netIncome)}${unitSuffix}</div>`;
          if (!hidden.has('freeCashFlow')) rows += `<div style="color:rgb(44,160,44)">Free Cash Flow: $${fmt(q.freeCashFlow)}${unitSuffix}</div>`;
          if (!hidden.has('yoyGrowth') && cumItem && cumItem.cumRev !== null) {
            const sign = cumItem.cumRev >= 0 ? '+' : '';
            rows += `<div style="color:#d97706;font-weight:600">Cum Rev Growth: ${sign}${fmt(cumItem.cumRev)}%</div>`;
          }

          if (!hidden.has('stock') && sp) {
            const retPct = (((sp.y / baseP) - 1) * 100).toFixed(1);
            const sign = retPct >= 0 ? '+' : '';
            rows += `<div style="margin-top:6px;border-top:1px solid #444;padding-top:4px">Stock Price: $${sp.y.toFixed(2)} <span style="color:#10b981;font-weight:600">(${sign}${retPct}% return)</span></div>`;
          }

          tooltip
            .style('opacity', 1)
            .style('left', `${event.pageX + 14}px`)
            .style('top', `${event.pageY - 10}px`)
            .html(rows);
        })
        .on('mouseleave', () => {
          tooltip.style('opacity', 0);
        });

    } else {
      // RENDER TAB 2 & 3: SINGLE PANE (Valuation History OR Indexed Growth)
      const dataSet = activeTab === 'growth' ? indexedQuarters : quarters;
      for (const m of visibleMetrics) {
        const lineData = dataSet
          .map((q, i) => ({ x: i, y: q[m.key] }))
          .filter((d) => d.y !== null && d.y !== undefined);

        if (lineData.length > 0) {
          const metricLine = d3.line()
            .x((d) => xBand(d.x) + xBand.bandwidth() / 2)
            .y((d) => yLeft(d.y))
            .curve(d3.curveMonotoneX);

          g.append('path')
            .datum(lineData)
            .attr('d', metricLine)
            .attr('fill', 'none')
            .attr('stroke', m.color)
            .attr('stroke-width', 2.5);

          // Dot points
          g.selectAll(`.dot-${m.key}`)
            .data(lineData)
            .enter()
            .append('circle')
            .attr('cx', (d) => xBand(d.x) + xBand.bandwidth() / 2)
            .attr('cy', (d) => yLeft(d.y))
            .attr('r', 3.5)
            .attr('fill', m.color);
        }
      }

      // Stock price line
      if (showStock && stockPrices.length > 0) {
        const stockLine = d3.line()
          .x((d) => xLin(d.x))
          .y((d) => activeTab === 'growth' ? yLeft(d.yIdx) : yRight(d.y))
          .curve(d3.curveLinear);

        g.append('path')
          .datum(activeTab === 'growth' ? indexedStockPrices : stockPrices)
          .attr('d', stockLine)
          .attr('fill', 'none')
          .attr('stroke', '#000')
          .attr('stroke-width', 2)
          .attr('stroke-opacity', 0.8);
      }

      // X Axis — bold date ticks
      const xAxis = g.append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(d3.axisBottom(xBand).tickFormat((i) => labels[i] || ''));

      xAxis.selectAll('text')
        .attr('transform', 'rotate(-90)')
        .attr('text-anchor', 'end')
        .attr('dx', '-0.6em')
        .attr('dy', '-0.4em')
        .style('font-size', '11px')
        .style('font-weight', '700')
        .style('fill', '#333');

      xAxis.select('.domain').attr('stroke', '#bbb');
      xAxis.selectAll('.tick line').attr('stroke', '#bbb');

      // Y Left Axis
      const yAxisLeft = g.append('g').call(d3.axisLeft(yLeft).ticks(8).tickFormat((v) => activeTab === 'growth' ? `${v > 0 ? '+' : ''}${Math.round(v)}%` : `${v}`));
      yAxisLeft.select('.domain').attr('stroke', '#bbb');
      yAxisLeft.selectAll('.tick text').style('font-size', '11px').style('fill', '#444');
      yAxisLeft.selectAll('.tick line').attr('stroke', '#bbb');

      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerH / 2)
        .attr('y', -58)
        .attr('text-anchor', 'middle')
        .style('font-size', '13px')
        .style('font-weight', '600')
        .style('fill', '#333')
        .text(leftAxisTitle);

      // Y Right Axis (only for Tabs 1 & 2)
      if (yRight) {
        const yAxisRight = g.append('g')
          .attr('transform', `translate(${innerW},0)`)
          .call(d3.axisRight(yRight).ticks(8).tickFormat((v) => `$${v}`));

        yAxisRight.select('.domain').attr('stroke', '#bbb');
        yAxisRight.selectAll('.tick text').style('font-size', '11px').style('fill', '#444');
        yAxisRight.selectAll('.tick line').attr('stroke', '#bbb');

        g.append('text')
          .attr('transform', 'rotate(90)')
          .attr('x', innerH / 2)
          .attr('y', -innerW - 54)
          .attr('text-anchor', 'middle')
          .style('font-size', '13px')
          .style('font-weight', '600')
          .style('fill', '#333')
          .text('Stock Price ($)');
      }



      // Tooltip Overlay
      const tooltip = d3.select(tooltipRef.current);
      const bisect = d3.bisector((d) => d.x).left;

      g.append('rect')
        .attr('width', innerW)
        .attr('height', innerH)
        .attr('fill', 'transparent')
        .style('cursor', 'crosshair')
        .on('mousemove', (event) => {
          const [mx] = d3.pointer(event);
          const xVal = xLin.invert(mx);
          const qi = Math.round(xVal);

          if (qi < 0 || qi >= numQ) {
            tooltip.style('opacity', 0);
            return;
          }

          const q = quarters[qi];
          const qIdx = indexedQuarters[qi];
          const si = bisect(stockPrices, xVal);
          const sp = stockPrices[Math.min(si, stockPrices.length - 1)];
          const spIdx = indexedStockPrices[Math.min(si, indexedStockPrices.length - 1)];

          let rows = `<div style="font-weight:700;margin-bottom:6px;border-bottom:1px solid #444;padding-bottom:4px">${q.date}</div>`;
          
          const fmt = (v) => (v !== null && v !== undefined && !isNaN(v)) ? Number(v).toFixed(1) : '0.0';

          if (activeTab === 'valuation') {
            if (!hidden.has('peRatio'))  rows += `<div style="color:rgb(148,103,189)">P/E Ratio: ${q.peRatio ? fmt(q.peRatio) + 'x' : 'N/A'}</div>`;
            if (!hidden.has('psRatio'))  rows += `<div style="color:rgb(31,119,180)">P/S Ratio: ${q.psRatio ? fmt(q.psRatio) + 'x' : 'N/A'}</div>`;
            if (!hidden.has('fcfYield')) rows += `<div style="color:rgb(44,160,44)">FCF Yield: ${q.fcfYield ? fmt(q.fcfYield) + '%' : 'N/A'}</div>`;
          } else {
            // Tab 3 Tooltip
            if (!hidden.has('revenueIdx'))      rows += `<div style="color:rgb(31,119,180)">Revenue Growth: ${qIdx.revenueIdx >= 0 ? '+' : ''}${fmt(qIdx.revenueIdx)}% <span style="font-size:11px;opacity:0.8">($${fmt(q.revenue)}${unitSuffix})</span></div>`;
            if (!hidden.has('epsIdx'))          rows += `<div style="color:rgb(245,158,11)">EPS Growth: ${qIdx.epsIdx >= 0 ? '+' : ''}${fmt(qIdx.epsIdx)}% <span style="font-size:11px;opacity:0.8">($${q.epsTTM !== undefined && q.epsTTM !== null ? Number(q.epsTTM).toFixed(2) : fmt(q.netIncome)})</span></div>`;
            if (!hidden.has('netIncomeIdx'))    rows += `<div style="color:rgb(152,223,138)">Net Income Growth: ${qIdx.netIncomeIdx >= 0 ? '+' : ''}${fmt(qIdx.netIncomeIdx)}% <span style="font-size:11px;opacity:0.8">($${fmt(q.netIncome)}${unitSuffix})</span></div>`;
            if (!hidden.has('freeCashFlowIdx')) rows += `<div style="color:rgb(44,160,44)">FCF Growth: ${qIdx.freeCashFlowIdx >= 0 ? '+' : ''}${fmt(qIdx.freeCashFlowIdx)}% <span style="font-size:11px;opacity:0.8">($${fmt(q.freeCashFlow)}${unitSuffix})</span></div>`;
          }

          if (!hidden.has('stock')) {
            if (activeTab === 'growth') {
              const pct = spIdx ? spIdx.yIdx : 0;
              const sign = pct >= 0 ? '+' : '';
              rows += `<div style="margin-top:4px;border-top:1px solid #444;padding-top:4px">Stock Return: ${sign}${fmt(pct)}% <span style="font-size:11px;opacity:0.8">($${sp ? sp.y.toFixed(2) : '—'})</span></div>`;
            } else {
              rows += `<div style="margin-top:4px;border-top:1px solid #444;padding-top:4px">Stock: $${sp ? sp.y.toFixed(2) : '—'}</div>`;
            }
          }

          tooltip
            .style('opacity', 1)
            .style('left', `${event.pageX + 14}px`)
            .style('top', `${event.pageY - 10}px`)
            .html(rows);
        })
        .on('mouseleave', () => {
          tooltip.style('opacity', 0);
        });
    };

  }, [data, dimensions, hidden, activeTab]);

  const kpis = data?.kpis || {};

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      {/* KPI Cards Header — Commented Out
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 12,
        marginBottom: 16,
      }}>
        <div style={cardStyle}>
          <div style={cardLabelStyle}>Stock Price</div>
          <div style={cardValueStyle}>${kpis.latestPrice || '—'}</div>
        </div>
        <div style={cardStyle}>
          <div style={cardLabelStyle}>TTM Revenue</div>
          <div style={cardValueStyle}>${kpis.ttmRevenue || '—'}{kpis.unitSuffix}</div>
        </div>
        <div style={cardStyle}>
          <div style={cardLabelStyle}>TTM Free Cash Flow</div>
          <div style={cardValueStyle}>${kpis.ttmFreeCashFlow || '—'}{kpis.unitSuffix}</div>
        </div>
        <div style={cardStyle}>
          <div style={cardLabelStyle}>TTM Net Margin</div>
          <div style={cardValueStyle}>{kpis.ttmNetMargin ? `${kpis.ttmNetMargin}%` : '—'}</div>
        </div>
        <div style={cardStyle}>
          <div style={cardLabelStyle}>TTM P/E Ratio</div>
          <div style={cardValueStyle}>{kpis.ttmPE ? `${kpis.ttmPE}x` : '—'}</div>
        </div>
      </div>
      */}

      {/* Competitor Benchmarks Banner */}
      {data?.peers && data.peers.length > 0 && (
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 12, fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            🏷️ Competitor Benchmarks:
          </span>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Target Stock */}
            <div style={{ background: '#e0f2fe', border: '1px solid #7dd3fc', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#0369a1' }}>
              <strong>{data.ticker}</strong>: ${kpis.latestPrice || '—'} <span style={{ fontWeight: '700' }}>(P/E: {kpis.ttmPE ? `${kpis.ttmPE}x` : 'N/A'})</span>
            </div>
            {/* Peers */}
            {data.peers.map((p) => (
              <button
                key={p.ticker}
                onClick={() => onSelectTicker && onSelectTicker(p.ticker)}
                title={`Click to view ${p.ticker}`}
                style={{
                  background: '#fff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 12,
                  color: '#334155',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  outline: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#0284c7';
                  e.currentTarget.style.background = '#f0f9ff';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.background = '#fff';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <strong>{p.ticker}</strong>: ${p.price} <span style={{ color: '#64748b', fontWeight: '600' }}>(P/E: {p.peRatio ? `${p.peRatio}x` : 'N/A'})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* View Mode Switcher Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('cash')}
          style={{
            ...tabButtonStyle,
            background: activeTab === 'cash' ? '#1f77b4' : '#f0f0f0',
            color: activeTab === 'cash' ? '#fff' : '#444',
            fontWeight: activeTab === 'cash' ? '700' : '500',
          }}
        >
          📊 Cash & Earnings (Revenue, FCF, Net Income)
        </button>
        <button
          onClick={() => setActiveTab('valuation')}
          style={{
            ...tabButtonStyle,
            background: activeTab === 'valuation' ? '#1f77b4' : '#f0f0f0',
            color: activeTab === 'valuation' ? '#fff' : '#444',
            fontWeight: activeTab === 'valuation' ? '700' : '500',
          }}
        >
          📈 Valuation History (P/E, P/S, FCF Yield)
        </button>
        <button
          onClick={() => setActiveTab('growth')}
          style={{
            ...tabButtonStyle,
            background: activeTab === 'growth' ? '#1f77b4' : '#f0f0f0',
            color: activeTab === 'growth' ? '#fff' : '#444',
            fontWeight: activeTab === 'growth' ? '700' : '500',
          }}
        >
          🚀 Relative Growth (% Return)
        </button>
        <button
          onClick={() => setActiveTab('dcf_drivers')}
          style={{
            ...tabButtonStyle,
            background: activeTab === 'dcf_drivers' ? '#7c3aed' : '#f0f0f0',
            color: activeTab === 'dcf_drivers' ? '#fff' : '#444',
            fontWeight: activeTab === 'dcf_drivers' ? '700' : '500',
            border: activeTab === 'dcf_drivers' ? '1px solid #7c3aed' : '1px solid #ccc',
          }}
        >
          🔬 DCF Historical Drivers (EPS, Growth %, P/E)
        </button>
        <button
          onClick={() => setActiveTab('dcf')}
          style={{
            ...tabButtonStyle,
            background: activeTab === 'dcf' ? '#0284c7' : '#f0f0f0',
            color: activeTab === 'dcf' ? '#fff' : '#444',
            fontWeight: activeTab === 'dcf' ? '700' : '500',
            border: activeTab === 'dcf' ? '1px solid #0284c7' : '1px solid #ccc',
          }}
        >
          🎯 DCF Valuation Calculator
        </button>
      </div>

      {activeTab === 'dcf' ? (
        <DCFCalculator data={data} />
      ) : activeTab === 'dcf_drivers' ? (
        <DCFHistoryCharts data={data} />
      ) : (
        <>
          {/* Interactive Legend Toggle Toolbar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '8px 14px',
            marginBottom: 12,
          }}>
            <span style={{
              fontSize: 12,
              fontWeight: '700',
              color: '#475569',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginRight: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              👁️ Toggle Series:
            </span>
            {currentLegendItems.map((item) => {
              const isHidden = hidden.has(item.key);
              const borderColor = isHidden ? '#cbd5e1' : (item.color === '#000' ? '#334155' : item.color);
              return (
                <button
                  key={item.key}
                  onClick={() => toggleSeries(item.key)}
                  title={isHidden ? `Click to show ${item.label}` : `Click to hide ${item.label}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    background: isHidden ? '#f1f5f9' : '#fff',
                    border: `1.5px ${isHidden ? 'dashed' : 'solid'} ${borderColor}`,
                    borderRadius: 6,
                    padding: '4px 11px',
                    fontSize: 12,
                    fontWeight: isHidden ? '500' : '600',
                    color: isHidden ? '#94a3b8' : '#1e293b',
                    cursor: 'pointer',
                    opacity: isHidden ? 0.6 : 1,
                    textDecoration: isHidden ? 'line-through' : 'none',
                    transition: 'all 0.15s ease',
                    boxShadow: isHidden ? 'none' : '0 1px 2px rgba(0,0,0,0.05)',
                    outline: 'none',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = isHidden ? 'none' : '0 1px 2px rgba(0,0,0,0.05)';
                  }}
                >
                  {/* Swatch Icon */}
                  {item.type === 'bar' && (
                    <span style={{
                      width: 12,
                      height: 12,
                      borderRadius: 2,
                      background: isHidden ? '#94a3b8' : item.color,
                      display: 'inline-block',
                    }} />
                  )}
                  {item.type === 'dotted' && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 2,
                    }}>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: isHidden ? '#94a3b8' : item.color }} />
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: isHidden ? '#94a3b8' : item.color }} />
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: isHidden ? '#94a3b8' : item.color }} />
                    </span>
                  )}
                  {item.type === 'line' && (
                    <span style={{
                      width: 14,
                      height: 3,
                      borderRadius: 1,
                      background: isHidden ? '#94a3b8' : item.color,
                      display: 'inline-block',
                    }} />
                  )}
                  <span>{item.label}</span>
                  {isHidden && (
                    <span style={{
                      fontSize: 10,
                      color: '#ef4444',
                      fontWeight: '700',
                      textDecoration: 'none',
                      marginLeft: 2,
                    }}>
                      (hidden)
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <svg ref={svgRef} />
          <div
            ref={tooltipRef}
            style={{
              position: 'fixed',
              opacity: 0,
              background: 'rgba(10,10,10,0.92)',
              color: '#eee',
              padding: '10px 14px',
              borderRadius: 6,
              fontSize: 13,
              lineHeight: 1.6,
              pointerEvents: 'none',
              zIndex: 1000,
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            }}
          />
        </>
      )}
    </div>
  );
}

const cardStyle = {
  background: '#f8f9fa',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  padding: '10px 14px',
};

const cardLabelStyle = {
  fontSize: 11,
  fontWeight: '600',
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 4,
};

const cardValueStyle = {
  fontSize: 20,
  fontWeight: '700',
  color: '#0f172a',
};

const tabButtonStyle = {
  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
  fontSize: 13,
  padding: '8px 18px',
  borderRadius: 6,
  border: '1px solid #ccc',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};

