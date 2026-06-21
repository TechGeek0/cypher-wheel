import React, { useEffect, useRef, useState } from 'react';
import { getLiveFeed } from '../api.js';

function short(a) { return a ? `${a.slice(0, 5)}…${a.slice(-4)}` : ''; }
function ago(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function LiveFeed() {
  const [rows, setRows] = useState(() => getLiveFeed());

  useEffect(() => {
    const i = setInterval(() => setRows(getLiveFeed()), 3000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="feed-strip">
      <span className="feed-label">
        <span className="live-dot" />
        Recent wins
      </span>
      {rows.length === 0
        ? <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--fg-3)' }}>First pot building…</span>
        : (
          <div className="feed-rows">
            {rows.slice(0, 8).map((r, i) => (
              <React.Fragment key={r.id}>
                {i > 0 && <span className="feed-sep" />}
                <div className="feed-item">
                  <span className="fi-round">#{r.round}</span>
                  <span className="fi-addr">{short(r.winner)}</span>
                  <span className="fi-prize">+{r.prizeSol.toFixed(3)} SOL</span>
                  <span className="fi-time">{ago(r.id)}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        )}
    </div>
  );
}
