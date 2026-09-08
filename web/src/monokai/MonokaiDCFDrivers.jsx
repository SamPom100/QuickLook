import React, { useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { MONOKAI } from './theme';

export default function MonokaiDCFDrivers({ data, timeframe = '5Y' }) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 750 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth || (window.innerWidth - 64);
        setDimensions({ width: Math.max(w, 640), height: 780 });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const { quarters: rawQuarters = [], kpis = {} } = data || {};

  useEffect(() => {
    if (!svgRef.current || rawQuarters.length === 0) return;

    // Slice by timeframe
    let quartersSlice = [...rawQuarters];
    const tfQuartersMap = { '1Y': 4, '3Y': 12, '5Y': 20, '10Y': 40 };
    const maxQ = tfQuartersMap[timeframe];
    if (maxQ && quartersSlice.length > maxQ) {
      quartersSlice = quartersSlice.slice(-maxQ);
    }

    const enrichedQuarters = quartersSlice.map((q, i) => {
      let growthYoY = q.epsGrowthYoY;
      if (growthYoY === undefined || growthYoY === null) {
        if (i >= 4) {
          const curEps = q.epsTTM;
          const prevEps = quartersSlice[i - 4]?.epsTTM;
          if (curEps != null && prevEps != null && prevEps > 0) {
            growthYoY = Math.round(((curEps - prevEps) / prevEps) * 1000) / 10;
          }
        }
      }
      return { ...q, epsGrowthYoY: growthYoY };
    });

    const numQ = enrichedQuarters.length;
    const { width, height } = dimensions;
    const margin = { top: 30, right: 60, bottom: 45, left: 75 };
    const innerW = width - margin.left - margin.right;
    const totalInnerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);

    const defs = svg.append('defs');

    // EPS Cyan Gradient
    const epsGrad = defs.append('linearGradient')
      .attr('id', 'monokai-eps-grad')
      .attr('x1', '0%').attr('y1', '0%').attr('x2', '0%').attr('y2', '100%');
    epsGrad.append('stop').attr('offset', '0%').attr('stop-color', MONOKAI.cyan).attr('stop-opacity', 0.4);
    epsGrad.append('stop').attr('offset', '100%').attr('stop-color', MONOKAI.cyan).attr('stop-opacity', 0.02);

    // PE Purple Gradient
    const peGrad = defs.append('linearGradient')
      .attr('id', 'monokai-pe-grad')
      .attr('x1', '0%').attr('y1', '0%').attr('x2', '0%').attr('y2', '100%');
    peGrad.append('stop').attr('offset', '0%').attr('stop-color', MONOKAI.purple).attr('stop-opacity', 0.35);
    peGrad.append('stop').attr('offset', '100%').attr('stop-color', MONOKAI.purple).attr('stop-opacity', 0.02);

    // 3 Panels layout
    const gap = 24;
    const panelH = (totalInnerH - (gap * 2)) / 3;
    const gMain = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xBand = d3.scaleBand()
      .domain(d3.range(numQ))
      .range([0, innerW])
      .padding(0.18);

    const xLin = d3.scaleLinear()
      .domain([0, numQ - 1])
      .range([xBand(0) + xBand.bandwidth() / 2, xBand(numQ - 1) + xBand.bandwidth() / 2]);

    // PANEL 1: EPS History ($ TTM)
    const y1Top = 0;
    const g1 = gMain.append('g').attr('transform', `translate(0,${y1Top})`);
    const epsVals = enrichedQuarters.map((q) => q.epsTTM).filter((v) => v != null);
    const maxEps = d3.max(epsVals) || 5;
    const minEps = Math.min(0, d3.min(epsVals) || 0);
    const y1Scale = d3.scaleLinear().domain([minEps, maxEps * 1.15]).range([panelH, 0]).nice();

    // Panel 1 background grid
    g1.selectAll('line.grid')
      .data(y1Scale.ticks(4))
      .enter().append('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', (d) => y1Scale(d)).attr('y2', (d) => y1Scale(d))
      .attr('stroke', MONOKAI.borderSubtle).attr('stroke-dasharray', '3,3');

    // Panel 1 Area & Line
    const validEps = enrichedQuarters.map((q, i) => ({ i, eps: q.epsTTM })).filter((d) => d.eps != null);
    if (validEps.length > 1) {
      const epsArea = d3.area()
        .x((d) => xLin(d.i))
        .y0(panelH)
        .y1((d) => y1Scale(d.eps))
        .curve(d3.curveMonotoneX);

      g1.append('path').datum(validEps).attr('d', epsArea).attr('fill', 'url(#monokai-eps-grad)');

      const epsLine = d3.line()
        .x((d) => xLin(d.i))
        .y((d) => y1Scale(d.eps))
        .curve(d3.curveMonotoneX);

      g1.append('path').datum(validEps).attr('d', epsLine).attr('fill', 'none').attr('stroke', MONOKAI.cyan).attr('stroke-width', 2.2);

      g1.selectAll('circle.eps-dot')
        .data(validEps).enter().append('circle')
        .attr('cx', (d) => xLin(d.i)).attr('cy', (d) => y1Scale(d.eps))
        .attr('r', 3.5).attr('fill', MONOKAI.cyan);
    }

    // Panel 1 Axis
    g1.append('g').call(d3.axisLeft(y1Scale).ticks(4).tickFormat((d) => `$${d.toFixed(2)}`))
      .call((g) => {
        g.select('.domain').attr('stroke', MONOKAI.border);
        g.selectAll('.tick line').attr('stroke', MONOKAI.borderSubtle);
        g.selectAll('.tick text').attr('fill', MONOKAI.textDim).attr('font-family', MONOKAI.monoFont).attr('font-size', 10);
      });

    g1.append('text').attr('x', 8).attr('y', 14)
      .attr('fill', MONOKAI.cyan).attr('font-family', MONOKAI.monoFont).attr('font-size', 11).attr('font-weight', 700)
      .text('01 // EPS HISTORY ($ TTM)');

    // PANEL 2: YoY EPS Growth Rate (%)
    const y2Top = panelH + gap;
    const g2 = gMain.append('g').attr('transform', `translate(0,${y2Top})`);
    const growthVals = enrichedQuarters.map((q) => q.epsGrowthYoY).filter((v) => v != null);
    const maxGrowth = Math.max(30, d3.max(growthVals) || 30);
    const minGrowth = Math.min(-20, d3.min(growthVals) || -20);
    const y2Scale = d3.scaleLinear().domain([minGrowth * 1.1, maxGrowth * 1.1]).range([panelH, 0]).nice();

    g2.selectAll('line.grid')
      .data(y2Scale.ticks(4))
      .enter().append('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', (d) => y2Scale(d)).attr('y2', (d) => y2Scale(d))
      .attr('stroke', MONOKAI.borderSubtle).attr('stroke-dasharray', '3,3');

    // 0% Baseline
    const zeroY2 = y2Scale(0);
    g2.append('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', zeroY2).attr('y2', zeroY2)
      .attr('stroke', MONOKAI.muted).attr('stroke-width', 1.2);

    // Bars
    enrichedQuarters.forEach((q, i) => {
      if (q.epsGrowthYoY != null) {
        const valY = y2Scale(q.epsGrowthYoY);
        const isPos = q.epsGrowthYoY >= 0;
        g2.append('rect')
          .attr('x', xBand(i))
          .attr('y', Math.min(zeroY2, valY))
          .attr('width', xBand.bandwidth())
          .attr('height', Math.max(2, Math.abs(valY - zeroY2)))
          .attr('fill', isPos ? MONOKAI.green : MONOKAI.pink)
          .attr('opacity', 0.85)
          .attr('rx', 2);
      }
    });

    // 5Y CAGR Benchmark Line
    if (kpis.epsGrowth5Y != null) {
      const cagrY = y2Scale(kpis.epsGrowth5Y);
      g2.append('line')
        .attr('x1', 0).attr('x2', innerW)
        .attr('y1', cagrY).attr('y2', cagrY)
        .attr('stroke', MONOKAI.orange).attr('stroke-width', 1.5).attr('stroke-dasharray', '4,3');

      g2.append('text')
        .attr('x', innerW - 6).attr('y', cagrY - 4)
        .attr('text-anchor', 'end').attr('fill', MONOKAI.orange)
        .attr('font-family', MONOKAI.monoFont).attr('font-size', 9).attr('font-weight', 700)
        .text(`5Y CAGR: ${kpis.epsGrowth5Y.toFixed(1)}%`);
    }

    g2.append('g').call(d3.axisLeft(y2Scale).ticks(4).tickFormat((d) => `${d.toFixed(0)}%`))
      .call((g) => {
        g.select('.domain').attr('stroke', MONOKAI.border);
        g.selectAll('.tick line').attr('stroke', MONOKAI.borderSubtle);
        g.selectAll('.tick text').attr('fill', MONOKAI.textDim).attr('font-family', MONOKAI.monoFont).attr('font-size', 10);
      });

    g2.append('text').attr('x', 8).attr('y', 14)
      .attr('fill', MONOKAI.green).attr('font-family', MONOKAI.monoFont).attr('font-size', 11).attr('font-weight', 700)
      .text('02 // YoY EPS GROWTH RATE (%)');

    // PANEL 3: Historical P/E Multiple (x)
    const y3Top = (panelH + gap) * 2;
    const g3 = gMain.append('g').attr('transform', `translate(0,${y3Top})`);
    const peVals = enrichedQuarters.map((q) => q.peRatio).filter((v) => v != null && v > 0 && v <= 100);
    const maxPe = Math.max(30, d3.max(peVals) || 30);
    const minPe = Math.max(0, (d3.min(peVals) || 10) * 0.85);
    const y3Scale = d3.scaleLinear().domain([minPe, maxPe * 1.15]).range([panelH, 0]).nice();

    g3.selectAll('line.grid')
      .data(y3Scale.ticks(4))
      .enter().append('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', (d) => y3Scale(d)).attr('y2', (d) => y3Scale(d))
      .attr('stroke', MONOKAI.borderSubtle).attr('stroke-dasharray', '3,3');

    const validPe = enrichedQuarters.map((q, i) => ({ i, pe: q.peRatio })).filter((d) => d.pe != null && d.pe > 0 && d.pe <= 100);
    if (validPe.length > 1) {
      const peArea = d3.area()
        .x((d) => xLin(d.i))
        .y0(panelH)
        .y1((d) => y3Scale(d.pe))
        .curve(d3.curveMonotoneX);

      g3.append('path').datum(validPe).attr('d', peArea).attr('fill', 'url(#monokai-pe-grad)');

      const peLine = d3.line()
        .x((d) => xLin(d.i))
        .y((d) => y3Scale(d.pe))
        .curve(d3.curveMonotoneX);

      g3.append('path').datum(validPe).attr('d', peLine).attr('fill', 'none').attr('stroke', MONOKAI.purple).attr('stroke-width', 2.2);

      g3.selectAll('circle.pe-dot')
        .data(validPe).enter().append('circle')
        .attr('cx', (d) => xLin(d.i)).attr('cy', (d) => y3Scale(d.pe))
        .attr('r', 3.5).attr('fill', MONOKAI.purple);
    }

    // 5Y Median PE Reference Line
    const medianPe = kpis.medianPE5YClean || kpis.medianPE5Y;
    if (medianPe != null) {
      const medY = y3Scale(medianPe);
      g3.append('line')
        .attr('x1', 0).attr('x2', innerW)
        .attr('y1', medY).attr('y2', medY)
        .attr('stroke', MONOKAI.orange).attr('stroke-width', 1.5).attr('stroke-dasharray', '4,3');

      g3.append('text')
        .attr('x', innerW - 6).attr('y', medY - 4)
        .attr('text-anchor', 'end').attr('fill', MONOKAI.orange)
        .attr('font-family', MONOKAI.monoFont).attr('font-size', 9).attr('font-weight', 700)
        .text(`5Y Median: ${medianPe.toFixed(1)}x`);
    }

    g3.append('g').call(d3.axisLeft(y3Scale).ticks(4).tickFormat((d) => `${d.toFixed(0)}x`))
      .call((g) => {
        g.select('.domain').attr('stroke', MONOKAI.border);
        g.selectAll('.tick line').attr('stroke', MONOKAI.borderSubtle);
        g.selectAll('.tick text').attr('fill', MONOKAI.textDim).attr('font-family', MONOKAI.monoFont).attr('font-size', 10);
      });

    g3.append('text').attr('x', 8).attr('y', 14)
      .attr('fill', MONOKAI.purple).attr('font-family', MONOKAI.monoFont).attr('font-size', 11).attr('font-weight', 700)
      .text('03 // HISTORICAL P/E MULTIPLE (x)');

    // Bottom X Axis (on panel 3)
    const xAxis = d3.axisBottom(xBand).tickFormat((i) => enrichedQuarters[i]?.date || '');
    const gX = g3.append('g').attr('transform', `translate(0,${panelH})`).call(xAxis);
    gX.select('.domain').attr('stroke', MONOKAI.border);
    gX.selectAll('.tick line').attr('stroke', MONOKAI.borderSubtle);
    gX.selectAll('.tick text')
      .attr('fill', MONOKAI.muted).attr('font-family', MONOKAI.monoFont).attr('font-size', 9)
      .attr('transform', 'rotate(-45)').style('text-anchor', 'end').attr('dx', '-0.4em').attr('dy', '0.2em');

    // Synchronized Crosshair Across All 3 Panels
    const crosshair = gMain.append('line')
      .attr('y1', 0).attr('y2', totalInnerH)
      .attr('stroke', MONOKAI.cyan).attr('stroke-width', 1).attr('stroke-dasharray', '3,3')
      .style('opacity', 0).style('pointer-events', 'none');

    const overlay = gMain.append('rect')
      .attr('width', innerW).attr('height', totalInnerH)
      .attr('fill', 'transparent').style('cursor', 'crosshair');

    overlay.on('mousemove', (event) => {
      const [mx] = d3.pointer(event);
      const slotW = xBand.step();
      let qIdx = Math.floor(mx / slotW);
      qIdx = Math.max(0, Math.min(numQ - 1, qIdx));

      const cx = xBand(qIdx) + xBand.bandwidth() / 2;
      crosshair.attr('x1', cx).attr('x2', cx).style('opacity', 0.8);

      const q = enrichedQuarters[qIdx];
      if (q) {
        const tooltip = d3.select(tooltipRef.current);
        tooltip
          .style('opacity', 1)
          .html(`
            <div style="color:${MONOKAI.cyan};font-weight:700;border-bottom:1px solid ${MONOKAI.borderSubtle};padding-bottom:4px;margin-bottom:6px;">
              ${q.date}
            </div>
            <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:12px;">
              <span style="color:${MONOKAI.cyan}">EPS (TTM):</span>
              <strong style="text-align:right;color:#fff">${q.epsTTM != null ? `$${q.epsTTM.toFixed(2)}` : '—'}</strong>
              <span style="color:${MONOKAI.green}">YoY Growth:</span>
              <strong style="text-align:right;color:${(q.epsGrowthYoY || 0) >= 0 ? MONOKAI.green : MONOKAI.pink}">
                ${q.epsGrowthYoY != null ? `${q.epsGrowthYoY >= 0 ? '+' : ''}${q.epsGrowthYoY.toFixed(1)}%` : '—'}
              </strong>
              <span style="color:${MONOKAI.purple}">P/E Multiple:</span>
              <strong style="text-align:right;color:#fff">${q.peRatio != null ? `${q.peRatio.toFixed(1)}x` : '—'}</strong>
            </div>
          `)
          .style('left', `${event.clientX + 16}px`)
          .style('top', `${event.clientY - 30}px`);
      }
    });

    overlay.on('mouseleave', () => {
      crosshair.style('opacity', 0);
      d3.select(tooltipRef.current).style('opacity', 0);
    });

  }, [data, timeframe, dimensions]);

  return (
    <div ref={containerRef} style={{
      position: 'relative',
      background: MONOKAI.bgDark,
      border: `1px solid ${MONOKAI.border}`,
      borderRadius: 8,
      padding: '16px',
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
