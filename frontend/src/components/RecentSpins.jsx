import React from 'react';

function short(a) { return a ? `${a.slice(0, 5)}…${a.slice(-4)}` : ''; }
function ago(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function RecentSpins({ rounds }) {
  return (
    <div className="ticker">
      <span className="ticker-label">Recent wins</span>
      {rounds.length === 0
        ? <span className="ticker-empty">First pot is building…</span>
        : (
          <div className="ticker-track">
            {rounds.slice(0, 10).map((r, i) => (
              <React.Fragment key={r.id}>
                {i > 0 && <span className="tick-sep" />}
                <div className="tick-item">
                  <span className="tick-time">{ago(r.id)}</span>
                  <span className="tick-addr">{short(r.winner)}</span>
                  <span className="tick-prize">+{Number(r.prizeSol || 0).toFixed(3)} SOL</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        )}
    </div>
  );
}
