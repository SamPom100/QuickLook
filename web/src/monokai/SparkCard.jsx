import React, { useState, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { MONOKAI } from './theme';

export default function SparkCard({
  title,
  currentValue,
  badgeText,
  badgePositive = true,
  dataPoints = [],
  color = MONOKAI.cyan,
  formatValue = (v) => v,
  height = 90,
  sublabel = '',
}) {
  const containerRef = useRef(null);
  const [hoverIndex, setHoverIndex] = useState(null);

  // Compute SVG path & coordinates
  const { pathData, areaData, points, minVal, maxVal, hasNegative, zeroY } = useMemo(() => {
    const validData = (dataPoints || []).filter(
      (d) => d && d.value != null && !isNaN(Number(d.value)) && isFinite(Number(d.value))
    );

    if (validData.length < 2) {
      return { pathData: '', areaData: '', points: [], minVal: 0, maxVal: 0, hasNegative: false, zeroY: null };
    }

    const vals = validData.map((d) => Number(d.value));
    const minVal = d3.min(vals) || 0;
    const maxVal = d3.max(vals) || 1;
    const hasNegative = minVal < 0;

    // When there are negative values, ensure the Y domain includes 0
    const domainMin = hasNegative ? Math.min(minVal, 0) : minVal;
    const domainMax = hasNegative ? Math.max(maxVal, 0) : maxVal;
    const padding = (domainMax - domainMin) * 0.1 || 1;

    const w = 300; // normalized width for viewBox
    const h = height;

    const xScale = d3.scaleLinear().domain([0, validData.length - 1]).range([4, w - 4]);
    const yScale = d3.scaleLinear().domain([domainMin - padding, domainMax + padding]).range([h - 6, 6]);

    const zeroY = hasNegative ? yScale(0) : null;

    const pts = validData.map((d, i) => ({
      x: xScale(i),
      y: yScale(Number(d.value)),
      date: d.date,
      value: Number(d.value),
    }));

    const lineGen = d3.line()
      .x((d) => d.x)
      .y((d) => d.y)
      .curve(d3.curveMonotoneX);

    const areaGen = d3.area()
      .x((d) => d.x)
      .y0(h)
      .y1((d) => d.y)
      .curve(d3.curveMonotoneX);

    return {
      pathData: lineGen(pts) || '',
      areaData: areaGen(pts) || '',
      points: pts,
      minVal,
      maxVal,
      hasNegative,
      zeroY,
    };
  }, [dataPoints, height]);

  const handleMouseMove = (e) => {
    if (!containerRef.current || points.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const frac = mouseX / rect.width;
    const idx = Math.round(frac * (points.length - 1));
    const clampedIdx = Math.max(0, Math.min(points.length - 1, idx));
    setHoverIndex(clampedIdx);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const activePoint = hoverIndex !== null ? points[hoverIndex] : null;
  const displayVal = activePoint ? formatValue(activePoint.value) : currentValue;
  const displayDate = activePoint ? activePoint.date : sublabel;

  // Unique gradient id based on color
  const gradId = `grad-${color.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        handleMouseLeave();
        e.currentTarget.style.borderColor = MONOKAI.border;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
      style={{
        background: MONOKAI.bgDark,
        border: `1px solid ${MONOKAI.border}`,
        borderRadius: 8,
        padding: '16px 18px 12px 18px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        cursor: 'crosshair',
        transition: 'border-color 0.2s, transform 0.15s',
        minHeight: height + 85,
      }}
    >
      {/* Card Header: Title + Badge */}
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}>
          <span style={{
            fontFamily: MONOKAI.monoFont,
            fontSize: 11,
            fontWeight: 700,
            color: MONOKAI.muted,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            {title}
          </span>
          {badgeText && (
            <span style={{
              fontFamily: MONOKAI.monoFont,
              fontSize: 11,
              fontWeight: 700,
              color: badgePositive ? MONOKAI.green : MONOKAI.pink,
              background: badgePositive ? 'rgba(166, 226, 46, 0.12)' : 'rgba(249, 38, 114, 0.12)',
              border: `1px solid ${badgePositive ? 'rgba(166, 226, 46, 0.3)' : 'rgba(249, 38, 114, 0.3)'}`,
              borderRadius: 4,
              padding: '1px 6px',
            }}>
              {badgeText}
            </span>
          )}
        </div>

        {/* Big Bold Current / Scrubbed Value */}
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}>
          <span style={{
            fontFamily: MONOKAI.monoFont,
            fontSize: 22,
            fontWeight: 800,
            color: MONOKAI.text,
            letterSpacing: '0.02em',
          }}>
            {displayVal}
          </span>
          {displayDate && (
            <span style={{
              fontFamily: MONOKAI.monoFont,
              fontSize: 10,
              color: hoverIndex !== null ? color : MONOKAI.muted,
              fontWeight: 600,
            }}>
              {displayDate}
            </span>
          )}
        </div>
      </div>

      {/* Sparkline Graphic */}
      <div style={{ width: '100%', height, position: 'relative' }}>
        <svg
          viewBox={`0 0 300 ${height}`}
          preserveAspectRatio="none"
          style={{ width: '100%', height: '100%', overflow: 'visible' }}
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0.0} />
            </linearGradient>
          </defs>

          {/* Dotted Zero Line for negative graphs */}
          {hasNegative && zeroY !== null && (
            <line
              x1={0}
              x2={300}
              y1={zeroY}
              y2={zeroY}
              stroke={MONOKAI.muted}
              strokeWidth={1}
              strokeDasharray="3,3"
              opacity={0.65}
            />
          )}

          {/* Area Fill */}
          {areaData && (
            <path d={areaData} fill={`url(#${gradId})`} />
          )}

          {/* Minimalist Line */}
          {pathData && (
            <path
              d={pathData}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Active Scrub Marker & Vertical Line */}
          {activePoint && (
            <>
              <line
                x1={activePoint.x}
                x2={activePoint.x}
                y1={0}
                y2={height}
                stroke={color}
                strokeWidth={1}
                strokeDasharray="2,2"
                opacity={0.7}
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r={4}
                fill={color}
                stroke={MONOKAI.bgDark}
                strokeWidth={2}
              />
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
