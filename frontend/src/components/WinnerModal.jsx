import React, { useEffect } from 'react';

function short(a) {
  return a ? `${a.slice(0, 6)}…${a.slice(-6)}` : '';
}

export default function WinnerModal({ round, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 9000);
    return () => clearTimeout(t);
  }, [round, onClose]);

  if (!round) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-spark">&#10022; &#10022; &#10022;</div>
        <p className="modal-kicker">Round settled</p>
        <p className="modal-addr mono">{short(round.winner)}</p>
        <p className="modal-prize">{Number(round.prizeSol || 0).toFixed(3)} SOL</p>
        <div className="modal-meta">
          <span>odds {(round.winnerOdds * 100).toFixed(1)}%</span>
          <span>·</span>
          <span>{Number(round.buybackSol || 0).toFixed(3)} SOL bought &amp; burned</span>
        </div>
        <p className="modal-proof mono">ticket #{round.winningTicket} / {round.totalTickets}</p>
        <button className="modal-close" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}