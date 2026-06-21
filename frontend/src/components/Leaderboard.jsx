import React from 'react';

function short(a) { return a ? `${a.slice(0, 5)}…${a.slice(-4)}` : ''; }
function fmt(n) { return Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }); }

export default function Leaderboard({ entries }) {
  return (
    <table className="lb-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Wallet</th>
          <th className="right">Balance</th>
          <th className="right">Tickets</th>
          <th className="right">Win odds</th>
        </tr>
      </thead>
      <tbody>
        {entries.slice(0, 15).map((e, i) => (
          <tr key={e.owner}>
            <td className="lb-rank dim">{i + 1}</td>
            <td>{short(e.owner)}</td>
            <td className="dim right">{fmt(e.balance)}</td>
            <td className="dim right">{e.tickets.toFixed(1)}</td>
            <td className="odds right">{(e.odds * 100).toFixed(1)}%</td>
          </tr>
        ))}
        {entries.length === 0 && (
          <tr>
            <td colSpan={5} style={{ color: 'var(--fg-3)', padding: '32px 0' }}>
              Waiting for eligible holders…
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
