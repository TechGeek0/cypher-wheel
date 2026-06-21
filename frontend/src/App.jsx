import React, { useEffect, useRef, useState, useCallback } from 'react';
import Wheel from './components/Wheel.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import LiveFeed from './components/LiveFeed.jsx';
import WinnerModal from './components/WinnerModal.jsx';
import { getState, getRounds, runDemoRound } from './api.js';

function useCountdown(target) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const ms = Math.max(0, (target || 0) - now);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return { label: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`, done: ms === 0 };
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

  useEffect(() => {
    if (countdown.done && state?.demo && !spinning) triggerSpin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown.done]);

  function triggerSpin() {
    if (spinning) return;
    const { round, entries: demoEntries, winnerIndex } = runDemoRound();
    setEntries(demoEntries);
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

  const dryRun = state?.dryRun ?? true;
  const isDemo = state?.demo;
  const buyback = state?.buybackPercent ?? 20;
  const token = state?.token;

  return (
    <div className="page">
      {/* NAV */}
      <nav className="nav">
        <div className="wordmark">
          <span className="wm-mark">C</span>
          <span className="wm-name">CYPHER</span>
        </div>
        <div className="nav-right">
          {isDemo && <span className="tag tag-demo"><span className="live-dot" />preview</span>}
          {token && <span className="tag mono">{token.slice(0, 4)}&hellip;{token.slice(-4)}</span>}
          <a className="nav-cta" href="#wheel">Enter the room</a>
        </div>
      </nav>

      {/* HERO — live activity led */}
      <header className="hero">
        <div className="hero-left">
          <p className="eyebrow">Holder rewards &middot; Solana</p>
          <h1 className="hero-title">
            The wheel pays a holder<span className="serif-em"> every hour.</span>
          </h1>
          <p className="hero-sub">
            Hold the token, hold tickets. Each round draws one wallet from a sealed seed and
            an on-chain blockhash, buys the token back, burns it, and pays the winner.
          </p>
          <div className="hero-pool">
            <div>
              <p className="pool-k">Prize pool</p>
              <p className="pool-v">{Number(state?.poolSol || 0).toFixed(2)}<span> SOL</span></p>
            </div>
            <div className="pool-div" />
            <div>
              <p className="pool-k">Next draw</p>
              <p className="pool-count">{countdown.label}</p>
            </div>
            <div className="pool-div" />
            <div>
              <p className="pool-k">Winner takes</p>
              <p className="pool-pct">{100 - buyback}%</p>
            </div>
          </div>
          <a className="cta-primary" href="#wheel">Watch the next spin</a>
        </div>
        <div className="hero-right">
          <LiveFeed />
        </div>
      </header>

      {/* WHEEL */}
      <section className="section" id="wheel">
        <div className="section-head">
          <p className="sec-eyebrow">01 &mdash; The mechanism</p>
          <h2 className="sec-title">The Wheel</h2>
        </div>
        <div className="wheel-stage" ref={wheelHost}>
          <Wheel entries={entries} onSpinEnd={onSpinEnd} />
          <div className="wheel-side">
            <p className="ws-line">
              Segments are sized by tickets, not balance. Bigger bags weigh more, but
              square-root weighting keeps whales from owning the wheel.
            </p>
            <div className="ws-stats">
              <div><span>{state?.preview?.eligibleHolders ?? '\u2014'}</span><label>eligible holders</label></div>
              <div><span>{buyback}%</span><label>bought &amp; burned</label></div>
              <div><span>sqrt</span><label>weighting</label></div>
            </div>
            <button className="cta-primary wide" onClick={triggerSpin} disabled={spinning}>
              {spinning ? 'Spinning\u2026' : isDemo ? 'Spin the wheel (preview)' : 'Force spin'}
            </button>
            {dryRun && <p className="ws-note">Dry-run mode &middot; no funds move until you go live.</p>}
          </div>
        </div>
      </section>

      {/* STORY */}
      <section className="section story">
        <div className="section-head">
          <p className="sec-eyebrow">02 &mdash; How it works</p>
          <h2 className="sec-title">Three steps, on repeat</h2>
        </div>
        <div className="steps">
          <div className="step">
            <span className="step-n">I</span>
            <h3>Hold</h3>
            <p>Every token in your wallet earns sqrt-weighted tickets. No staking, no lockup, no claim.</p>
          </div>
          <div className="step">
            <span className="step-n">II</span>
            <h3>Get drawn</h3>
            <p>A sealed seed plus a Solana blockhash pick one wallet. Provably fair, verifiable by anyone.</p>
          </div>
          <div className="step">
            <span className="step-n">III</span>
            <h3>Get paid</h3>
            <p>A slice of the pot buys the token back and burns it. The rest lands in the winner's wallet.</p>
          </div>
        </div>
      </section>

      {/* HOLDERS */}
      <section className="section">
        <div className="section-head">
          <p className="sec-eyebrow">03 &mdash; The room</p>
          <h2 className="sec-title">The Holders</h2>
        </div>
        <Leaderboard entries={entries} />
      </section>

      {/* FAIR */}
      <section className="section fair">
        <div className="section-head">
          <p className="sec-eyebrow">04 &mdash; Trust</p>
          <h2 className="sec-title">Provably fair, by design</h2>
        </div>
        <div className="fair-body">
          <p className="fair-lead">
            No one can grind the result. The seed is committed before the entropy exists;
            the entropy is public and unpredictable when it does.
          </p>
          <div className="fair-formula mono">
            ticket = HMAC<span className="dim">_sha256</span>(serverSeed, blockhash) &nbsp;mod&nbsp; totalTickets
          </div>
          <ul className="fair-list">
            <li><span>sha256(serverSeed)</span> is published before each draw</li>
            <li><span>blockhash</span> is captured live, after the seal</li>
            <li><span>serverSeed</span> is revealed after &mdash; recompute and check</li>
          </ul>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="foot-mark">
          <span className="wm-mark">C</span>
          <span className="wm-name">CYPHER</span>
        </div>
        <div className="foot-meta">
          <span className="mono">{token ? `${token.slice(0, 8)}\u2026${token.slice(-6)}` : '\u2014'}</span>
          <span>Holder rewards. Not financial advice.</span>
        </div>
      </footer>

      <WinnerModal round={winner} onClose={() => setWinner(null)} />
    </div>
  );
}