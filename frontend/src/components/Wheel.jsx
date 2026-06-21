import React, { useEffect, useMemo, useRef, useState } from 'react';

// Restrained, luxe roulette tones — rich, not rainbow.
const SEG_COLORS = [
  '#C9A86A', '#241F1A', '#8B3A3A', '#3E4A52', '#A88B5A', '#2A2622',
  '#6E5A48', '#1F3A33', '#B89766', '#322A22', '#7A4A4A', '#45433E',
];

const SIZE = 460;
const R = SIZE / 2 - 8;
const CX = SIZE / 2;
const CY = SIZE / 2;

function pt(deg, radius = R) {
  const rad = (deg * Math.PI) / 180;
  return [CX + radius * Math.sin(rad), CY - radius * Math.cos(rad)];
}

function arcPath(startDeg, endDeg) {
  const [x1, y1] = pt(startDeg);
  const [x2, y2] = pt(endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`;
}

export default function Wheel({ entries, onSpinEnd }) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const pendingWinner = useRef(null);
  const rootRef = useRef(null);

  const segments = useMemo(() => {
    const total = entries.reduce((s, e) => s + e.tickets, 0) || 1;
    let cursor = 0;
    return entries.map((e, i) => {
      const sweep = (e.tickets / total) * 360;
      const seg = {
        ...e,
        index: i,
        start: cursor,
        end: cursor + sweep,
        mid: cursor + sweep / 2,
        color: SEG_COLORS[i % SEG_COLORS.length],
      };
      cursor += sweep;
      return seg;
    });
  }, [entries]);

  function spinTo(winnerIndex) {
    if (spinning || !segments[winnerIndex]) return;
    setSpinning(true);
    pendingWinner.current = winnerIndex;
    const mid = segments[winnerIndex].mid;
    const spins = 6 + Math.floor(Math.random() * 3);
    const base = rotation - (rotation % 360);
    const target = base + spins * 360 + (360 - mid);
    setRotation(target);
  }

  useEffect(() => {
    const el = rootRef.current;
    if (el) el._spinTo = spinTo;
  });

  function handleTransitionEnd() {
    if (!spinning) return;
    setSpinning(false);
    const idx = pendingWinner.current;
    pendingWinner.current = null;
    if (idx != null && onSpinEnd) onSpinEnd(segments[idx], idx);
  }

  return (
    <div className="wheel" ref={rootRef}>
      <div className={`wheel-pointer ${spinning ? 'is-spinning' : ''}`} aria-hidden />
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="wheel-svg" role="img"
           aria-label="Holder raffle wheel">
        <defs>
          <radialGradient id="hub" cx="50%" cy="42%" r="60%">
            <stop offset="0%" stopColor="#1c1813" />
            <stop offset="100%" stopColor="#0b0a09" />
          </radialGradient>
          <radialGradient id="sheen" cx="50%" cy="30%" r="75%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.06)" />
            <stop offset="55%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="14" floodColor="#000" floodOpacity="0.55" />
          </filter>
        </defs>

        {/* outer rings */}
        <circle cx={CX} cy={CY} r={R + 6} fill="none" stroke="#2a2620" strokeWidth="1.5" />
        <circle cx={CX} cy={CY} r={R + 3} fill="none" stroke="#C9A86A" strokeWidth="1"
                opacity="0.5" />

        <g
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: `${CX}px ${CY}px`,
            transition: spinning ? 'transform 6.4s cubic-bezier(0.1, 0.7, 0.05, 1)' : 'none',
          }}
          onTransitionEnd={handleTransitionEnd}
          filter="url(#soft)"
        >
          {segments.map((s) => (
            <path key={s.owner} d={arcPath(s.start, s.end)} fill={s.color}
                  stroke="#0b0a09" strokeWidth="1" />
          ))}
          {/* thin champagne tick dividers */}
          {segments.map((s) => {
            const [x, y] = pt(s.start);
            return <line key={`t${s.owner}`} x1={CX} y1={CY} x2={x} y2={y}
                         stroke="#C9A86A" strokeWidth="0.5" opacity="0.35" />;
          })}
        </g>

        {/* sheen + hub */}
        <circle cx={CX} cy={CY} r={R} fill="url(#sheen)" pointerEvents="none" />
        <circle cx={CX} cy={CY} r="54" fill="url(#hub)" stroke="#C9A86A" strokeWidth="1" />
        <circle cx={CX} cy={CY} r="54" fill="none" stroke="#C9A86A" strokeWidth="3" opacity="0.12" />
        <text x={CX} y={CY - 3} fill="#C9A86A" fontSize="15" textAnchor="middle"
              fontFamily="'Fraunces', serif" fontWeight="600" letterSpacing="3">CYPHER</text>
        <text x={CX} y={CY + 14} fill="#8C8578" fontSize="8.5" textAnchor="middle"
              fontFamily="'JetBrains Mono', monospace" letterSpacing="4">THE WHEEL</text>
      </svg>
    </div>
  );
}