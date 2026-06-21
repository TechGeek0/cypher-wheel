import React, { useEffect, useRef, useState } from 'react';
import { getLiveFeed } from '../api.js';

function short(a) {
  return a ? `${a.slice(0, 4)}\u2009\u2026\u2009${a.slice(-4)}` : '';
}
function ago(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

export default function LiveFeed() {
  const [rows, setRows] = useState(() => getLiveFeed());
  const topId = useRef(rows[0]?.id);

  useEffect(() => {
    const i = setInterval(() => setRows(getLiveFeed()), 2000);
    return () => clearInterval(i);
  }, []);

  const newestId = rows[0]?.id;
  const isNew = newestId !== topId.current;
  if (isNew) topId.current = newestId;

  return (
    <div className="ledger">
      <div className="ledger-head">
        <span className="live"><span className="live-dot" />Live ledger</span>
        <span className="ledger-sub">every payout, on record</span>
      </div>
      <div className="ledger-rows">
        {rows.slice(0, 7).map((r, i) => (
          <div className={`ledger-row ${i === 0 && isNew ? 'is-fresh' : ''}`} key={r.id}>
            <span className="lr-round">#{r.round}</span>
            <span className="lr-addr mono">{short(r.winner)}</span>
            <span className="lr-prize">+{r.prizeSol.toFixed(3)} <em>SOL</em></span>
            <span className="lr-time">{ago(r.id)} ago</span>
            <span className="lr-check" title="provably fair">&#10003;</span>
          </div>
        ))}
      </div>
    </div>
  );
}