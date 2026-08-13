import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const CASH_METRICS = [
  { key: 'revenue',      label: 'Revenue',        color: 'rgb(31, 119, 180)',  widthFrac: 1.0,  type: 'bar' },
  { key: 'netIncome',    label: 'Net Income',     color: 'rgb(152, 223, 138)', widthFrac: 0.82, type: 'bar' },
  { key: 'freeCashFlow', label: 'Free Cash Flow', color: 'rgb(44, 160, 44)',   widthFrac: 0.64, type: 'bar' },
];

const VALUATION_METRICS = [
  { key: 'peRatio',   label: 'P/E Ratio (TTM)',     color: 'rgb(148, 103, 189)', type: 'line' },
  { key: 'psRatio',   label: 'P/S Ratio (TTM)',     color: 'rgb(31, 119, 180)',  type: 'line' },
  { key: 'fcfYield',  label: 'FCF Yield % (TTM)',   color: 'rgb(44, 160, 44)',   type: 'line' },
];

const INDEX_METRICS = [
  { key: 'revenueIdx',      label: 'Revenue Growth Index',        color: 'rgb(31, 119, 180)',  type: 'line' },
  { key: 'netIncomeIdx',    label: 'Net Income Growth Index',     color: 'rgb(152, 223, 138)', type: 'line' },
  { key: 'freeCashFlowIdx', label: 'Free Cash Flow Growth Index', color: 'rgb(44, 160, 44)',   type: 'line' },
];

export default function FinancialChart({ data }) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);

  const [activeTab, setActiveTab] = useState('cash'); // 'cash', 'margins', or 'growth'
  const [dimensions, setDimensions] = useState({ width: 1400, height: 750 });
  const [hidden, setHidden] = useState(new Set());

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
    if (!data || !svgRef.current) return;

    const { quarters, stockPrices, ticker, kpis } = data;
    const numQ = quarters.length;
    const { width, height } = dimensions;

    const margin = { top: 56, right: 75, bottom: 140, left: 60 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const labels = quarters.map((q) => q.date);
    labels.push('Today');

    // Compute Base 100 Indexed series for Tab 3 ('growth')
    const firstQ = quarters[0] || {};
    const baseRev = firstQ.revenue || 1;
    const baseNI = firstQ.netIncome || 1;
    const baseFCF = firstQ.freeCashFlow || 1;

    const indexedQuarters = quarters.map((q) => ({
      ...q,
      revenueIdx: ((q.revenue / baseRev) * 100),
      netIncomeIdx: ((q.netIncome / baseNI) * 100),
      freeCashFlowIdx: ((q.freeCashFlow / baseFCF) * 100),
    }));

    const baseStockPrice = (stockPrices && stockPrices.length > 0) ? stockPrices[0].y : 1;
    const indexedStockPrices = stockPrices.map((sp) => ({
      ...sp,
      yIdx: ((sp.y / baseStockPrice) * 100),
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
    else leftAxisTitle = 'Growth Index (Base 100)';

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
      // TAB 3: Relative Growth (Single shared Base 100 scale!)
      const allIdxVals = [
        ...indexedQuarters.flatMap((q) => visibleMetrics.map((m) => q[m.key])),
        ...(showStock ? indexedStockPrices.map((sp) => sp.yIdx) : [100])
      ].filter((v) => v !== null && v !== undefined && !isNaN(v));

      const yMaxIdx = d3.max(allIdxVals) ? d3.max(allIdxVals) * 1.1 : 200;
      const yMinIdx = d3.min(allIdxVals) ? Math.min(0, d3.min(allIdxVals) * 0.9) : 0;
      yLeft = d3.scaleLinear().domain([yMinIdx, yMaxIdx]).range([innerH, 0]).nice();
      yRight = null; // No secondary Y-axis needed! Single shared scale!
    }

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(yLeft).tickSize(-innerW).tickFormat(''))
      .selectAll('line')
      .attr('stroke', '#e5e5e5')
      .attr('stroke-dasharray', '2,2');
    g.selectAll('.grid .domain').remove();

    // Base 100 Reference Line on Tab 3
    if (activeTab === 'growth') {
      g.append('line')
        .attr('x1', 0)
        .attr('y1', yLeft(100))
        .attr('x2', innerW)
        .attr('y2', yLeft(100))
        .attr('stroke', '#888')
        .attr('stroke-dasharray', '4,4')
        .attr('stroke-width', 1.5);

      g.append('text')
        .attr('x', 6)
        .attr('y', yLeft(100) - 6)
        .style('font-size', '11px')
        .style('fill', '#666')
        .style('font-weight', '600')
        .text('Base 100 Baseline');
    }    // RENDER TAB 1: 2 STACKED SUB-PANES (Top: Financial Bars + YoY Growth %; Bottom: Stock Price $ + Return %)
    if (activeTab === 'cash') {
      const gap = 48;
      const topH = innerH * 0.54;
      const bottomH = innerH - topH - gap;

      const gTop = g.append('g');
      const gBottom = g.append('g').attr('transform', `translate(0, ${topH + gap})`);

      // Compute YoY Revenue Growth % for Top Pane
      const yoyData = quarters.map((q, i) => ({
        x: i,
        yoy: (q.yoyRevenueGrowth !== undefined && q.yoyRevenueGrowth !== null) ? q.yoyRevenueGrowth : null
      }));

      // Top Pane Left Y-Scale (Financial Bars $B)
      const allVals = quarters.flatMap((q) => currentMetrics.map((m) => q[m.key]));
      const yMaxF = allVals.length ? d3.max(allVals) * 1.08 : 1;
      const yMinF = allVals.length ? Math.min(0, d3.min(allVals) * 1.1) : 0;
      const yLeftTop = d3.scaleLinear().domain([yMinF, yMaxF]).range([topH, 0]).nice();

      // Top Pane Right Y-Scale (YoY Revenue Growth %)
      const yoyVals = yoyData.map((d) => d.yoy).filter((v) => v !== null && !isNaN(v));
      const yoyMax = yoyVals.length ? d3.max(yoyVals) * 1.15 : 50;
      const yoyMin = yoyVals.length ? Math.min(0, d3.min(yoyVals) * 1.1) : 0;
      const yRightTop = d3.scaleLinear().domain([yoyMin, yoyMax]).range([topH, 0]).nice();

      // Bottom Pane Left Y-Scale (Stock Price $ — starts at initial stock price!)
      const priceExtent = d3.extent(stockPrices, (d) => d.y);
      const baseP = (stockPrices.length > 0 && stockPrices[0].y > 0) ? stockPrices[0].y : 1;
      const minP = Math.min(baseP, (priceExtent[0] || baseP)) * 0.95;
      const maxP = (priceExtent[1] || 1) * 1.05;
      const yLeftBottom = d3.scaleLinear().domain([minP, maxP]).range([bottomH, 0]).nice();

      // Bottom Pane Right Y-Scale (% Return from Start — aligned to minP!)
      const domainLeftBottom = yLeftBottom.domain();
      const retMin = ((domainLeftBottom[0] / baseP) - 1) * 100;
      const retMax = ((domainLeftBottom[1] / baseP) - 1) * 100;
      const yRightBottom = d3.scaleLinear().domain([retMin, retMax]).range([bottomH, 0]);

      // Grid lines Top
      gTop.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(yLeftTop).tickSize(-innerW).tickFormat(''))
        .selectAll('line').attr('stroke', '#e5e5e5').attr('stroke-dasharray', '2,2');
      gTop.selectAll('.grid .domain').remove();

      // Grid lines Bottom
      gBottom.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(yLeftBottom).tickSize(-innerW).tickFormat(''))
        .selectAll('line').attr('stroke', '#e5e5e5').attr('stroke-dasharray', '2,2');
      gBottom.selectAll('.grid .domain').remove();

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

      // TOP PANE: Render YoY Revenue Growth % Line
      if (!hidden.has('yoyGrowth')) {
        const validYoY = yoyData.filter((d) => d.yoy !== null && !isNaN(d.yoy));
        if (validYoY.length > 0) {
          const yoyLine = d3.line()
            .x((d) => xBand(d.x) + xBand.bandwidth() / 2)
            .y((d) => yRightTop(d.yoy))
            .curve(d3.curveMonotoneX);

          gTop.append('path')
            .datum(validYoY)
            .attr('d', yoyLine)
            .attr('fill', 'none')
            .attr('stroke', '#d97706')
            .attr('stroke-width', 2.2)
            .attr('stroke-dasharray', '4,3');

          gTop.selectAll('.dot-yoy')
            .data(validYoY)
            .enter().append('circle')
            .attr('cx', (d) => xBand(d.x) + xBand.bandwidth() / 2)
            .attr('cy', (d) => yRightTop(d.yoy))
            .attr('r', 3)
            .attr('fill', '#d97706');
        }
      }

      // TOP PANE Axes
      const yAxisLeftTop = gTop.append('g').call(d3.axisLeft(yLeftTop).ticks(5));
      yAxisLeftTop.select('.domain').attr('stroke', '#bbb');
      yAxisLeftTop.selectAll('.tick text').style('font-size', '11px').style('fill', '#444');

      gTop.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -topH / 2)
        .attr('y', -40)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px').style('font-weight', '600').style('fill', '#333')
        .text(`Financials (${data.unitLabel || '$B'})`);

      const yAxisRightTop = gTop.append('g').attr('transform', `translate(${innerW},0)`).call(d3.axisRight(yRightTop).ticks(5).tickFormat((v) => `${v}%`));
      yAxisRightTop.select('.domain').attr('stroke', '#bbb');
      yAxisRightTop.selectAll('.tick text').style('font-size', '11px').style('fill', '#d97706');

      gTop.append('text')
        .attr('transform', 'rotate(90)')
        .attr('x', topH / 2)
        .attr('y', -innerW - 52)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px').style('font-weight', '600').style('fill', '#d97706')
        .text('YoY Revenue Growth (%)');

      // Top Pane Title Header
      gTop.append('text')
        .attr('x', 4)
        .attr('y', 14)
        .style('font-size', '12px')
        .style('font-weight', '700')
        .style('fill', '#475569')
        .text('PANEL 1: FINANCIAL PERFORMANCE & YOY GROWTH');

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

      // BOTTOM PANE Axes
      const yAxisLeftBottom = gBottom.append('g').call(d3.axisLeft(yLeftBottom).ticks(4).tickFormat((v) => `$${v}`));
      yAxisLeftBottom.select('.domain').attr('stroke', '#bbb');
      yAxisLeftBottom.selectAll('.tick text').style('font-size', '11px').style('fill', '#444');

      gBottom.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -bottomH / 2)
        .attr('y', -40)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px').style('font-weight', '600').style('fill', '#333')
        .text('Stock Price ($)');

      const yAxisRightBottom = gBottom.append('g').attr('transform', `translate(${innerW},0)`).call(d3.axisRight(yRightBottom).ticks(4).tickFormat((v) => `${v >= 0 ? '+' : ''}${Math.round(v)}%`));
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
          const yoyItem = yoyData[qi];
          const si = bisect(stockPrices, xVal);
          const sp = stockPrices[Math.min(si, stockPrices.length - 1)];

          const fmt = (v) => (v !== null && v !== undefined && !isNaN(v)) ? Number(v).toFixed(1) : '0.0';

          let rows = `<div style="font-weight:700;margin-bottom:6px;border-bottom:1px solid #444;padding-bottom:4px">${q.date}</div>`;
          
          if (!hidden.has('revenue'))      rows += `<div style="color:rgb(31,119,180)">Revenue: $${fmt(q.revenue)}${unitSuffix}</div>`;
          if (!hidden.has('netIncome'))    rows += `<div style="color:rgb(152,223,138)">Net Income: $${fmt(q.netIncome)}${unitSuffix}</div>`;
          if (!hidden.has('freeCashFlow')) rows += `<div style="color:rgb(44,160,44)">Free Cash Flow: $${fmt(q.freeCashFlow)}${unitSuffix}</div>`;
          if (!hidden.has('yoyGrowth') && yoyItem && yoyItem.yoy !== null) {
            rows += `<div style="color:#d97706;font-weight:600">YoY Rev Growth: +${fmt(yoyItem.yoy)}%</div>`;
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
      const yAxisLeft = g.append('g').call(d3.axisLeft(yLeft).ticks(8).tickFormat((v) => activeTab === 'growth' ? `${Math.round(v)}` : `${v}`));
      yAxisLeft.select('.domain').attr('stroke', '#bbb');
      yAxisLeft.selectAll('.tick text').style('font-size', '11px').style('fill', '#444');
      yAxisLeft.selectAll('.tick line').attr('stroke', '#bbb');

      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerH / 2)
        .attr('y', -38)
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

      // Title
      let titleText = `${ticker} — `;
      if (activeTab === 'cash') titleText += 'Financial Performance & Stock Price';
      else if (activeTab === 'valuation') titleText += 'Valuation History (P/E, P/S, FCF Yield & Stock Price)';
      else titleText += 'Relative Growth Index (Fundamentals vs Stock Price, Base = 100)';

      svg.append('text')
        .attr('x', width / 2)
        .attr('y', 28)
        .attr('text-anchor', 'middle')
        .style('font-size', '20px')
        .style('font-weight', 'bold')
        .style('fill', '#111')
        .text(titleText);

      // Legend
      const allItems = activeTab === 'cash'
        ? [...currentMetrics, { key: 'yoyGrowth', label: 'YoY Rev Growth (%)', color: '#d97706', type: 'line' }, { key: 'stock', label: 'Stock Price', color: '#000' }]
        : [...currentMetrics, { key: 'stock', label: activeTab === 'growth' ? 'Stock Price Index' : 'Stock Price', color: '#000' }];
      const legendG = svg.append('g').attr('transform', `translate(${margin.left + 10}, ${margin.top - 14})`);
      let lx = 0;

      for (const item of allItems) {
        const isHidden = hidden.has(item.key);
        const itemG = legendG.append('g')
          .attr('transform', `translate(${lx}, 0)`)
          .style('cursor', 'pointer')
          .style('opacity', isHidden ? 0.3 : 1)
          .on('click', () => {
            setHidden((prev) => {
              const next = new Set(prev);
              if (next.has(item.key)) next.delete(item.key);
              else next.add(item.key);
              return next;
            });
          });

        if (item.key === 'stock' || item.type === 'line') {
          itemG.append('line')
            .attr('x1', 0).attr('y1', 6).attr('x2', 18).attr('y2', 6)
            .attr('stroke', item.color)
            .attr('stroke-width', 2.5);
        } else {
          itemG.append('rect')
            .attr('width', 16).attr('height', 12)
            .attr('fill', item.color)
            .attr('opacity', 0.9)
            .attr('rx', 2);
        }

        const textEl = itemG.append('text')
          .attr('x', 22)
          .attr('y', 11)
          .style('font-size', '13px')
          .style('font-weight', '600')
          .style('fill', '#333')
          .text(item.label);

        lx += textEl.node().getComputedTextLength() + 36;
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
            if (!hidden.has('revenueIdx'))      rows += `<div style="color:rgb(31,119,180)">Revenue Index: ${fmt(qIdx.revenueIdx)} <span style="font-size:11px;opacity:0.8">(${fmt(qIdx.revenueIdx - 100)}% growth)</span></div>`;
            if (!hidden.has('netIncomeIdx'))    rows += `<div style="color:rgb(152,223,138)">Net Income Index: ${fmt(qIdx.netIncomeIdx)} <span style="font-size:11px;opacity:0.8">(${fmt(qIdx.netIncomeIdx - 100)}% growth)</span></div>`;
            if (!hidden.has('freeCashFlowIdx')) rows += `<div style="color:rgb(44,160,44)">FCF Index: ${fmt(qIdx.freeCashFlowIdx)} <span style="font-size:11px;opacity:0.8">(${fmt(qIdx.freeCashFlowIdx - 100)}% growth)</span></div>`;
          }

          if (!hidden.has('stock')) {
            if (activeTab === 'growth') {
              const pct = spIdx ? (spIdx.yIdx - 100).toFixed(1) : '0';
              rows += `<div style="margin-top:4px;border-top:1px solid #444;padding-top:4px">Stock Index: ${spIdx ? spIdx.yIdx.toFixed(1) : '—'} <span style="font-size:11px;opacity:0.8">(${pct}% growth, $${sp ? sp.y.toFixed(2) : '—'})</span></div>`;
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
      {/* KPI Cards Header */}
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
              <div key={p.ticker} style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#334155' }}>
                <strong>{p.ticker}</strong>: ${p.price} <span style={{ color: '#64748b', fontWeight: '600' }}>(P/E: {p.peRatio ? `${p.peRatio}x` : 'N/A'})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View Mode Switcher Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
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
          🚀 Relative Growth (Base 100 Index)
        </button>
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

