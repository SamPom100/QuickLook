import { useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';

export default function DCFHistoryCharts({ data }) {
  const { ticker, quarters = [], stockPrices = [], kpis = {} } = data || {};
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);

  const [dimensions, setDimensions] = useState({ width: 1200, height: 780 });
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Responsive resize
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth || (window.innerWidth - 60);
        setDimensions({ width: Math.max(w, 650), height: 800 });
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const currentPrice = kpis.latestPrice || 0;
  const ttmEps = kpis.epsTTM || 0;
  const ttmPe = kpis.ttmPE || 0;
  const medianPe5Y = kpis.medianPE5Y;
  const medianPe3Y = kpis.medianPE3Y;
  const avgPe5Y = kpis.avgPE5Y;
  const growth5Y = kpis.epsGrowth5Y;
  const growth3Y = kpis.epsGrowth3Y;
  const growth1Y = kpis.epsGrowth1Y;

  // D3 Rendering of 3 Synchronized Panels
  useEffect(() => {
    if (!svgRef.current || quarters.length === 0) return;

    const numQ = quarters.length;
    const { width, height } = dimensions;
    const margin = { top: 40, right: 60, bottom: 45, left: 75 };
    const innerW = width - margin.left - margin.right;
    const totalInnerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);

    // Defs for gradients
    const defs = svg.append('defs');

    // EPS Gradient (Blue)
    const epsGrad = defs.append('linearGradient')
      .attr('id', 'eps-gradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    epsGrad.append('stop').attr('offset', '0%').attr('stop-color', '#0284c7').attr('stop-opacity', 0.4);
    epsGrad.append('stop').attr('offset', '100%').attr('stop-color', '#0284c7').attr('stop-opacity', 0.02);

    // Growth Gradient (Amber)
    const growthGrad = defs.append('linearGradient')
      .attr('id', 'growth-gradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    growthGrad.append('stop').attr('offset', '0%').attr('stop-color', '#f59e0b').attr('stop-opacity', 0.35);
    growthGrad.append('stop').attr('offset', '100%').attr('stop-color', '#f59e0b').attr('stop-opacity', 0.02);

    // PE Gradient (Purple)
    const peGrad = defs.append('linearGradient')
      .attr('id', 'pe-gradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    peGrad.append('stop').attr('offset', '0%').attr('stop-color', '#8b5cf6').attr('stop-opacity', 0.35);
    peGrad.append('stop').attr('offset', '100%').attr('stop-color', '#8b5cf6').attr('stop-opacity', 0.02);

    // Layout configuration: 3 panels with equal height and small gaps
    const gap = 26;
    const panelH = (totalInnerH - (gap * 2)) / 3;

    const gMain = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const labels = quarters.map((q) => q.date);

    // Common X Band scale
    const xBand = d3.scaleBand()
      .domain(d3.range(numQ))
      .range([0, innerW])
      .padding(0);

    const xLin = d3.scaleLinear()
      .domain([0, numQ - 1])
      .range([xBand.bandwidth() / 2, innerW - xBand.bandwidth() / 2]);

    // ==========================================
    // PANEL 1: EPS ($ TTM) History
    // ==========================================
    const gP1 = gMain.append('g').attr('transform', `translate(0, 0)`);
    const epsVals = quarters.map((q) => q.epsTTM).filter((v) => v !== null && v !== undefined);
    const epsMax = epsVals.length ? d3.max(epsVals) * 1.15 : 10;
    const epsMin = epsVals.length ? Math.min(0, d3.min(epsVals) * 0.9) : 0;
    const yEps = d3.scaleLinear().domain([epsMin, epsMax]).range([panelH, 0]).nice();

    // Background panel border
    gP1.append('rect')
      .attr('width', innerW)
      .attr('height', panelH)
      .attr('fill', '#ffffff')
      .attr('stroke', '#e2e8f0')
      .attr('rx', 6);

    // Gridlines
    gP1.append('g')
      .call(d3.axisLeft(yEps).ticks(4).tickSize(-innerW).tickFormat(''))
      .selectAll('.tick line').attr('stroke', '#f1f5f9');
    gP1.selectAll('.domain').remove();

    // EPS Area & Line
    const epsLineData = quarters
      .map((q, i) => ({ x: i, y: q.epsTTM, date: q.date }))
      .filter((d) => d.y !== null && d.y !== undefined);

    if (epsLineData.length > 0) {
      const areaGen = d3.area()
        .x((d) => xBand(d.x) + xBand.bandwidth() / 2)
        .y0(yEps(0))
        .y1((d) => yEps(d.y))
        .curve(d3.curveMonotoneX);

      const lineGen = d3.line()
        .x((d) => xBand(d.x) + xBand.bandwidth() / 2)
        .y((d) => yEps(d.y))
        .curve(d3.curveMonotoneX);

      gP1.append('path')
        .datum(epsLineData)
        .attr('d', areaGen)
        .attr('fill', 'url(#eps-gradient)');

      gP1.append('path')
        .datum(epsLineData)
        .attr('d', lineGen)
        .attr('fill', 'none')
        .attr('stroke', '#0284c7')
        .attr('stroke-width', 2.5);

      gP1.selectAll('.dot-eps')
        .data(epsLineData)
        .enter().append('circle')
        .attr('cx', (d) => xBand(d.x) + xBand.bandwidth() / 2)
        .attr('cy', (d) => yEps(d.y))
        .attr('r', 3)
        .attr('fill', '#0284c7');
    }

    // Panel 1 Axis & Labels
    const yAxisP1 = gP1.append('g').call(d3.axisLeft(yEps).ticks(4).tickFormat((v) => `$${v.toFixed(2)}`));
    yAxisP1.select('.domain').attr('stroke', '#cbd5e1');
    yAxisP1.selectAll('.tick text').style('font-size', '11px').style('fill', '#475569');

    gP1.append('text')
      .attr('x', 12)
      .attr('y', 18)
      .style('font-size', '12px')
      .style('font-weight', '800')
      .style('fill', '#0369a1')
      .text('1. 💵 EPS ($ TTM) HISTORY');

    if (ttmEps > 0) {
      gP1.append('text')
        .attr('x', innerW - 12)
        .attr('y', 18)
        .attr('text-anchor', 'end')
        .style('font-size', '12px')
        .style('font-weight', '700')
        .style('fill', '#0f172a')
        .text(`Latest TTM EPS: $${ttmEps.toFixed(2)}`);
    }

    // ==========================================
    // PANEL 2: EPS YoY Growth Rate (%) History
    // ==========================================
    const p2YOffset = panelH + gap;
    const gP2 = gMain.append('g').attr('transform', `translate(0, ${p2YOffset})`);

    const growthVals = quarters
      .map((q) => q.epsGrowthYoY)
      .filter((v) => v !== null && v !== undefined && !isNaN(v));

    const gMax = growthVals.length ? Math.max(30, d3.max(growthVals) * 1.15) : 50;
    const gMin = growthVals.length ? Math.min(-15, d3.min(growthVals) * 1.15) : -20;
    const yGrowth = d3.scaleLinear().domain([gMin, gMax]).range([panelH, 0]).nice();

    gP2.append('rect')
      .attr('width', innerW)
      .attr('height', panelH)
      .attr('fill', '#ffffff')
      .attr('stroke', '#e2e8f0')
      .attr('rx', 6);

    // Gridlines
    gP2.append('g')
      .call(d3.axisLeft(yGrowth).ticks(4).tickSize(-innerW).tickFormat(''))
      .selectAll('.tick line').attr('stroke', '#f1f5f9');
    gP2.selectAll('.domain').remove();

    // 0% Reference Line
    if (yGrowth(0) >= 0 && yGrowth(0) <= panelH) {
      gP2.append('line')
        .attr('x1', 0)
        .attr('y1', yGrowth(0))
        .attr('x2', innerW)
        .attr('y2', yGrowth(0))
        .attr('stroke', '#94a3b8')
        .attr('stroke-dasharray', '4,3')
        .attr('stroke-width', 1.5);
    }

    // 5-Year CAGR Benchmark Line if available
    if (growth5Y !== null && growth5Y !== undefined && yGrowth(growth5Y) >= 0 && yGrowth(growth5Y) <= panelH) {
      gP2.append('line')
        .attr('x1', 0)
        .attr('y1', yGrowth(growth5Y))
        .attr('x2', innerW)
        .attr('y2', yGrowth(growth5Y))
        .attr('stroke', '#16a34a')
        .attr('stroke-dasharray', '3,3')
        .attr('stroke-width', 1.5);

      gP2.append('text')
        .attr('x', innerW - 12)
        .attr('y', yGrowth(growth5Y) - 4)
        .attr('text-anchor', 'end')
        .style('font-size', '10px')
        .style('font-weight', '700')
        .style('fill', '#15803d')
        .text(`5Y CAGR: +${growth5Y}%`);
    }

    const growthLineData = quarters
      .map((q, i) => ({ x: i, y: q.epsGrowthYoY, date: q.date }))
      .filter((d) => d.y !== null && d.y !== undefined);

    if (growthLineData.length > 0) {
      const growthLineGen = d3.line()
        .x((d) => xBand(d.x) + xBand.bandwidth() / 2)
        .y((d) => yGrowth(d.y))
        .curve(d3.curveMonotoneX);

      const growthAreaGen = d3.area()
        .x((d) => xBand(d.x) + xBand.bandwidth() / 2)
        .y0(yGrowth(0))
        .y1((d) => yGrowth(d.y))
        .curve(d3.curveMonotoneX);

      gP2.append('path')
        .datum(growthLineData)
        .attr('d', growthAreaGen)
        .attr('fill', 'url(#growth-gradient)');

      gP2.append('path')
        .datum(growthLineData)
        .attr('d', growthLineGen)
        .attr('fill', 'none')
        .attr('stroke', '#f59e0b')
        .attr('stroke-width', 2.5);

      gP2.selectAll('.dot-growth')
        .data(growthLineData)
        .enter().append('circle')
        .attr('cx', (d) => xBand(d.x) + xBand.bandwidth() / 2)
        .attr('cy', (d) => yGrowth(d.y))
        .attr('r', 3.5)
        .attr('fill', (d) => d.y >= 0 ? '#16a34a' : '#dc2626');
    }

    const yAxisP2 = gP2.append('g').call(d3.axisLeft(yGrowth).ticks(4).tickFormat((v) => `${v > 0 ? '+' : ''}${v}%`));
    yAxisP2.select('.domain').attr('stroke', '#cbd5e1');
    yAxisP2.selectAll('.tick text').style('font-size', '11px').style('fill', '#475569');

    gP2.append('text')
      .attr('x', 12)
      .attr('y', 18)
      .style('font-size', '12px')
      .style('font-weight', '800')
      .style('fill', '#b45309')
      .text('2. 🚀 EPS YoY GROWTH RATE (%) HISTORY');

    // ==========================================
    // PANEL 3: Historical P/E Multiple (x)
    // ==========================================
    const p3YOffset = (panelH + gap) * 2;
    const gP3 = gMain.append('g').attr('transform', `translate(0, ${p3YOffset})`);

    const peVals = quarters
      .map((q) => q.peRatio)
      .filter((v) => v !== null && v !== undefined && v > 0);

    const peMax = peVals.length ? Math.min(120, d3.max(peVals) * 1.15) : 50;
    const peMin = peVals.length ? Math.max(0, d3.min(peVals) * 0.85) : 0;
    const yPe = d3.scaleLinear().domain([peMin, peMax]).range([panelH, 0]).nice();

    gP3.append('rect')
      .attr('width', innerW)
      .attr('height', panelH)
      .attr('fill', '#ffffff')
      .attr('stroke', '#e2e8f0')
      .attr('rx', 6);

    // Gridlines
    gP3.append('g')
      .call(d3.axisLeft(yPe).ticks(4).tickSize(-innerW).tickFormat(''))
      .selectAll('.tick line').attr('stroke', '#f1f5f9');
    gP3.selectAll('.domain').remove();

    // 5Y Median P/E Reference Line
    if (medianPe5Y && yPe(medianPe5Y) >= 0 && yPe(medianPe5Y) <= panelH) {
      gP3.append('line')
        .attr('x1', 0)
        .attr('y1', yPe(medianPe5Y))
        .attr('x2', innerW)
        .attr('y2', yPe(medianPe5Y))
        .attr('stroke', '#16a34a')
        .attr('stroke-dasharray', '4,3')
        .attr('stroke-width', 1.5);

      gP3.append('text')
        .attr('x', innerW - 12)
        .attr('y', yPe(medianPe5Y) - 4)
        .attr('text-anchor', 'end')
        .style('font-size', '10px')
        .style('font-weight', '700')
        .style('fill', '#15803d')
        .text(`5Y Median P/E: ${medianPe5Y}x`);
    }

    const peLineData = quarters
      .map((q, i) => ({ x: i, y: q.peRatio, date: q.date }))
      .filter((d) => d.y !== null && d.y !== undefined);

    if (peLineData.length > 0) {
      const peAreaGen = d3.area()
        .x((d) => xBand(d.x) + xBand.bandwidth() / 2)
        .y0(yPe(peMin))
        .y1((d) => yPe(d.y))
        .curve(d3.curveMonotoneX);

      const peLineGen = d3.line()
        .x((d) => xBand(d.x) + xBand.bandwidth() / 2)
        .y((d) => yPe(d.y))
        .curve(d3.curveMonotoneX);

      gP3.append('path')
        .datum(peLineData)
        .attr('d', peAreaGen)
        .attr('fill', 'url(#pe-gradient)');

      gP3.append('path')
        .datum(peLineData)
        .attr('d', peLineGen)
        .attr('fill', 'none')
        .attr('stroke', '#8b5cf6')
        .attr('stroke-width', 2.5);

      gP3.selectAll('.dot-pe')
        .data(peLineData)
        .enter().append('circle')
        .attr('cx', (d) => xBand(d.x) + xBand.bandwidth() / 2)
        .attr('cy', (d) => yPe(d.y))
        .attr('r', 3)
        .attr('fill', '#8b5cf6');
    }

    const yAxisP3 = gP3.append('g').call(d3.axisLeft(yPe).ticks(4).tickFormat((v) => `${v.toFixed(1)}x`));
    yAxisP3.select('.domain').attr('stroke', '#cbd5e1');
    yAxisP3.selectAll('.tick text').style('font-size', '11px').style('fill', '#475569');

    gP3.append('text')
      .attr('x', 12)
      .attr('y', 18)
      .style('font-size', '12px')
      .style('font-weight', '800')
      .style('fill', '#6d28d9')
      .text('3. 🏛️ HISTORICAL P/E RATIO (x)');

    if (ttmPe > 0) {
      gP3.append('text')
        .attr('x', innerW - 12)
        .attr('y', 18)
        .attr('text-anchor', 'end')
        .style('font-size', '12px')
        .style('font-weight', '700')
        .style('fill', '#0f172a')
        .text(`Current TTM P/E: ${ttmPe.toFixed(1)}x`);
    }

    // Shared X-Axis at bottom of Panel 3
    const xAxis = gP3.append('g')
      .attr('transform', `translate(0, ${panelH})`)
      .call(d3.axisBottom(xBand).tickFormat((i) => labels[i] || ''));

    xAxis.selectAll('text')
      .attr('transform', 'rotate(-90)')
      .attr('text-anchor', 'end')
      .attr('dx', '-0.6em')
      .attr('dy', '-0.4em')
      .style('font-size', '11px')
      .style('font-weight', '700')
      .style('fill', '#334155');

    xAxis.select('.domain').attr('stroke', '#cbd5e1');
    xAxis.selectAll('.tick line').attr('stroke', '#cbd5e1');

    // ==========================================
    // SYNCHRONIZED CROSSHAIR & TOOLTIP INTERACTION
    // ==========================================
    const crosshair = gMain.append('line')
      .attr('y1', 0)
      .attr('y2', totalInnerH)
      .attr('stroke', '#0284c7')
      .attr('stroke-dasharray', '3,3')
      .attr('stroke-width', 1.5)
      .style('opacity', 0)
      .style('pointer-events', 'none');

    const tooltip = d3.select(tooltipRef.current);

    gMain.append('rect')
      .attr('width', innerW)
      .attr('height', totalInnerH)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event);
        const xVal = xLin.invert(mx);
        const qi = Math.round(xVal);

        if (qi < 0 || qi >= numQ) {
          crosshair.style('opacity', 0);
          tooltip.style('opacity', 0);
          setHoveredIndex(null);
          return;
        }

        const q = quarters[qi];
        const cx = xBand(qi) + xBand.bandwidth() / 2;

        crosshair
          .attr('x1', cx)
          .attr('x2', cx)
          .style('opacity', 0.85);

        setHoveredIndex(qi);

        const epsText = q.epsTTM !== undefined && q.epsTTM !== null ? `$${Number(q.epsTTM).toFixed(2)}` : '—';
        const growthText = q.epsGrowthYoY !== undefined && q.epsGrowthYoY !== null
          ? `${q.epsGrowthYoY > 0 ? '+' : ''}${q.epsGrowthYoY}% YoY`
          : '—';
        const peText = q.peRatio ? `${Number(q.peRatio).toFixed(1)}x` : 'N/A';

        let rows = `
          <div style="font-weight:800;font-size:13px;margin-bottom:6px;border-bottom:1px solid #334155;padding-bottom:4px;color:#f8fafc">
            📅 ${q.date}
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;font-size:12px">
            <div style="color:#38bdf8;font-weight:600">💵 TTM EPS: <strong>${epsText}</strong></div>
            <div style="color:${q.epsGrowthYoY >= 0 ? '#4ade80' : '#f87171'};font-weight:600">🚀 YoY Growth: <strong>${growthText}</strong></div>
            <div style="color:#c084fc;font-weight:600">🏛️ P/E Multiple: <strong>${peText}</strong></div>
          </div>
        `;

        tooltip
          .style('opacity', 1)
          .style('left', `${event.pageX + 16}px`)
          .style('top', `${event.pageY - 20}px`)
          .html(rows);
      })
      .on('mouseleave', () => {
        crosshair.style('opacity', 0);
        tooltip.style('opacity', 0);
        setHoveredIndex(null);
      });

  }, [data, dimensions]);

  return (
    <div ref={containerRef} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI Top Strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 12,
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        padding: '14px 18px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        {/* Card 1: Starting EPS */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            💵 Current Earning Power (TTM EPS)
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
            ${ttmEps.toFixed(2)}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            5Y CAGR: {growth5Y != null ? `+${growth5Y}%/yr` : '—'} {growth3Y != null && `(3Y: +${growth3Y}%)`}
          </div>
        </div>

        {/* Card 2: Latest YoY EPS Growth */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            🚀 Latest EPS YoY Growth
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: growth1Y >= 0 ? '#16a34a' : '#dc2626', marginTop: 2 }}>
            {growth1Y != null ? `${growth1Y > 0 ? '+' : ''}${growth1Y}%` : '—'}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            Trailing 12-month net income expansion
          </div>
        </div>

        {/* Card 3: P/E Valuation History Anchor */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            🏛️ P/E Valuation Anchors
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
            {ttmPe ? `${ttmPe.toFixed(1)}x` : 'N/A'} <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b' }}>Current</span>
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            5Y Median: <strong>{medianPe5Y ? `${medianPe5Y}x` : '—'}</strong> | 5Y Avg: <strong>{avgPe5Y ? `${avgPe5Y}x` : '—'}</strong>
          </div>
        </div>
      </div>

      {/* Main SVG Container */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '16px 12px 12px 12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        position: 'relative',
      }}>
        <svg ref={svgRef} style={{ width: '100%', height: dimensions.height, display: 'block' }} />
      </div>

      {/* Floating Rich Tooltip */}
      <div
        ref={tooltipRef}
        style={{
          position: 'absolute',
          pointerEvents: 'none',
          opacity: 0,
          background: 'rgba(15, 23, 42, 0.95)',
          color: '#ffffff',
          padding: '10px 14px',
          borderRadius: 8,
          fontSize: 12,
          boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
          zIndex: 9999,
          transition: 'opacity 0.1s ease',
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      />
    </div>
  );
}
