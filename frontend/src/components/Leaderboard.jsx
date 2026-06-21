import React from 'react';

function short(a) {
  return a ? `${a.slice(0, 5)}…${a.slice(-4)}` : '';
}
function fmt(n) {
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

const DOTS = [
  '#C9A86A', '#A88B5A', '#B89766', '#8B7A5A', '#C9A86A', '#9C8455',
  '#B89766', '#A88B5A', '#C9A86A', '#8B7A5A', '#B89766', '#9C8455',
];

export default function Leaderboard({ entries }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Holders &amp; tickets</h2>
        <span className="muted">sqrt-weighted · live</span>
      </div>
      <div className="lb">
        <div className="lb-row lb-head">
          <span>#</span>
          <span>Wallet</span>
          <span className="num">Balance</span>
          <span className="num">Tickets</span>
          <span className="num">Win odds</span>
        </div>
        {entries.slice(0, 12).map((e, i) => (
          <div className="lb-row" key={e.owner}>
            <span className="dot" style={{ '--dot': DOTS[i % DOTS.length] }}>{i + 1}</span>
            <span className="mono">{short(e.owner)}</span>
            <span className="num mono">{fmt(e.balance)}</span>
            <span className="num mono">{e.tickets.toFixed(1)}</span>
            <span className="num odds">{(e.odds * 100).toFixed(1)}%</span>
          </div>
        ))}
        {entries.length === 0 && <div className="empty">Waiting for eligible holders…</div>}
      </div>
    </section>
  );
}