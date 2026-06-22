import React, { useEffect, useRef, useState, useCallback } from 'react';
import Wheel from './components/Wheel.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import LiveFeed from './components/LiveFeed.jsx';
import WinnerModal from './components/WinnerModal.jsx';
import { getState, runSpin } from './api.js';

function useCountdown(target) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const ms = Math.max(0, (target || 0) - now);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function App() {
  const [state, setState] = useState(null);
  const [entries, setEntries] = useState([]);
  const [winner, setWinner] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const wheelHost = useRef(null);
  const pendingRound = useRef(null);

  const refresh = useCallback(async () => {
    const s = await getState();
    setState(s);
    if (s?.preview?.entries?.length) setEntries(s.preview.entries);
  }, []);

  useEffect(() => {
    refresh();
    const i = setInterval(refresh, 15000);
    return () => clearInterval(i);
  }, [refresh]);

  const countdown = useCountdown(state?.nextSpinAt);

  function triggerSpin() {
    if (spinning) return;
    const { round, entries: e, winnerIndex } = runSpin();
    setEntries(e);
    setSpinning(true);
    requestAnimationFrame(() => {
      const node = wheelHost.current?.querySelector('.wheel');
      if (node && node._spinTo) node._spinTo(winnerIndex);
      pendingRound.current = round;
    });
  }

  function onSpinEnd() {
    setSpinning(false);
    const r = pendingRound.current;
    pendingRound.current = null;
    if (r) { setWinner(r); refresh(); }
  }

  const dryRun  = state?.dryRun ?? true;
  const buyback = state?.buybackPercent ?? 50;
  const eligible = state?.preview?.eligibleHolders ?? 0;
  const sol     = Number(state?.poolSol || 0).toFixed(2);
  const token   = state?.token;

  return (
    <div className="site">

      {/* ── Nav ─────────────────────────── */}
      <nav className="nav">
        <div className="nav-logo">
          <span className="nav-logo-mark">V</span>
          VORTEX
        </div>

        <div className="nav-timer">
          <span className="nav-timer-label">next draw</span>
          <span className="nav-timer-count">{countdown}</span>
        </div>

        <div className="nav-status">
          {dryRun && <span className="pill pill-dry">dry run</span>}
        </div>
      </nav>

      <div className="divider" />

      {/* ── Prize pool ──────────────────── */}
      <div className="pool-hero">
        <span className="pool-label">Prize Pool</span>
        <div className="pool-amount">{sol}<span>SOL</span></div>
        <div className="pool-meta">
          <span>{eligible || '—'} eligible holders</span>
          <span>{100 - buyback}% to winner</span>
          <span>{buyback}% bought &amp; burned</span>
          <span>every 5 minutes</span>
          <span>sqrt-weighted tickets</span>
        </div>
      </div>

      <div className="divider" />

      {/* ── Wheel ───────────────────────── */}
      <div className="wheel-section" ref={wheelHost}>
        <Wheel entries={entries} onSpinEnd={onSpinEnd} />
        <button className="spin-btn" onClick={triggerSpin} disabled={spinning}>
          {spinning ? 'Spinning…' : 'Spin the wheel'}
        </button>
        {dryRun && <span className="wheel-note">Dry-run mode — no funds move until live</span>}
      </div>

      <div className="divider" />

      {/* ── Live feed ───────────────────── */}
      <LiveFeed />

      <div className="divider" />

      {/* ── Leaderboard ─────────────────── */}
      <section className="section">
        <span className="section-label">02 — The room</span>
        <h2 className="section-title">Holders &amp; Tickets</h2>
        <Leaderboard entries={entries} />
      </section>

      <div className="divider" />

      {/* ── Why different ───────────────── */}
      <section className="section">
        <span className="section-label">03 — The difference</span>
        <h2 className="section-title">No tax.<br />Not a compromise.</h2>

        <div className="why-intro">
          <p>
            Every lottery token before this ran on the same broken model: intercept trades,
            take a cut, fund the pot. It worked until it didn't — traders avoided buying,
            liquidity slowly drained, and the chart bled out. The tax was the product's own
            worst enemy.
          </p>
          <p>
            Vortex doesn't touch your tokens. The prize pool fills from Pump.fun creator
            fees — a platform-level mechanism that has nothing to do with your buy or sell.
            You trade freely. The draw keeps spinning. Every 5 minutes.
          </p>
        </div>

        <div className="compare">
          <div className="compare-col compare-bad">
            <span className="compare-label">Other lottery tokens</span>
            <ul className="compare-list">
              <li>5–15% tax cut on every buy and every sell</li>
              <li>Tax drains liquidity on every single trade</li>
              <li>Traders avoid buying just to skip the fee</li>
              <li>Chart bleeds as liquidity slowly empties out</li>
              <li>Prize pool funded by punishing your own holders</li>
              <li>Results unverifiable — trust the dev</li>
              <li>Sell pressure baked in from day one</li>
            </ul>
          </div>
          <div className="compare-col compare-good">
            <span className="compare-label">Vortex</span>
            <ul className="compare-list">
              <li>Zero transfer tax. Zero. On every trade, always.</li>
              <li>Pool funded by Pump.fun platform fees — not trades</li>
              <li>Buy and sell without losing a single token</li>
              <li>50% of every pot permanently burns the supply</li>
              <li>Hold 1,000+ tokens — you're automatically entered</li>
              <li>Every draw cryptographically verifiable on-chain</li>
              <li>Deflationary by design — every round makes it scarcer</li>
            </ul>
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* ── How it works ────────────────── */}
      <section className="section">
        <span className="section-label">04 — How it works</span>
        <h2 className="section-title">Three steps,<br />on repeat.</h2>
        <div className="steps">
          <div className="step">
            <span className="step-n">01</span>
            <h3>Hold</h3>
            <p>
              Every wallet holding at least 1,000 tokens is automatically entered.
              No registration, no gas, no claim. Tickets are proportional to the
              square root of your balance — bigger bags earn more, but whales don't
              crush the room.
            </p>
          </div>
          <div className="step">
            <span className="step-n">02</span>
            <h3>Get drawn</h3>
            <p>
              Every 5 minutes a snapshot closes. A server seed sealed with SHA-256
              combines with a live Solana blockhash. One wallet is picked. The math
              is public, the process is trustless, and every single draw is
              independently verifiable.
            </p>
          </div>
          <div className="step">
            <span className="step-n">03</span>
            <h3>Get paid</h3>
            <p>
              The pot splits in two. Exactly 50% goes directly to the winner's
              wallet in SOL. The other 50% is used to market-buy the token on
              Pump.fun and burn it permanently. The supply shrinks every 5 minutes,
              forever.
            </p>
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* ── Provably fair ───────────────── */}
      <section className="section">
        <span className="section-label">05 — Trust</span>
        <h2 className="section-title">Provably fair,<br />by design.</h2>
        <div className="fair-body">
          <p className="fair-lead">
            No one can grind the result. The seed is committed before the entropy
            exists. The entropy is public and unpredictable when it does.
          </p>
          <div className="fair-formula">
            ticket = HMAC<span className="dim">_sha256</span>(serverSeed, blockhash)&nbsp;&nbsp;mod&nbsp;&nbsp;totalTickets
          </div>
          <ul className="fair-list">
            <li><span>sha256(serverSeed)</span> is published before each draw as a public commitment</li>
            <li><span>blockhash</span> is captured live from Solana after the commitment is sealed</li>
            <li><span>serverSeed</span> is revealed post-draw — recompute the result yourself</li>
            <li>Verify any round at <span>/api/verify/:id</span></li>
          </ul>
        </div>
      </section>

      <div className="divider" />

      {/* ── Footer ──────────────────────── */}
      <footer className="footer">
        <div className="footer-logo">
          <span className="nav-logo-mark">V</span>
          <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.1em' }}>VORTEX</span>
        </div>
        <div className="foot-meta">
          {token && <span>{token.slice(0, 8)}…{token.slice(-6)}</span>}
          <span>Holder rewards · Not financial advice</span>
        </div>
      </footer>

      <WinnerModal round={winner} onClose={() => setWinner(null)} />
    </div>
  );
}
