import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { takeSnapshot } from './services/snapshot.js';
import { buildTickets } from './services/tickets.js';
import { getPoolBalanceSol } from './services/buyback.js';
import { runRound, isRunning } from './services/raffle.js';
import { verify } from './services/rng.js';
import { getRounds, lastRound } from './store.js';

const app = express();
app.use(cors());
app.use(express.json());

const ADMIN_KEY = process.env.ADMIN_KEY || 'changeme';

// â”€â”€ Scheduler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let nextSpinAt = Date.now() + config.roundIntervalSeconds * 1000;

async function tick() {
  try {
    console.log('[scheduler] running roundâ€¦');
    const r = await runRound();
    console.log(`[scheduler] round ${r.id} -> ${r.status}`, r.winner || '');
  } catch (e) {
    console.error('[scheduler] round error:', e.message);
  } finally {
    nextSpinAt = Date.now() + config.roundIntervalSeconds * 1000;
  }
}
setInterval(tick, config.roundIntervalSeconds * 1000);

// â”€â”€ Live preview cache (snapshot is heavy) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let previewCache = { at: 0, data: null };
async function getPreview() {
  if (Date.now() - previewCache.at < 60_000 && previewCache.data) {
    return previewCache.data;
  }
  const snap = await takeSnapshot();
  const { totalTickets, entries } = buildTickets(snap.holders);
  const data = {
    eligibleHolders: snap.eligibleHolders,
    totalHolders: snap.totalHolders,
    totalTickets,
    entries: entries
      .slice()
      .sort((a, b) => b.tickets - a.tickets)
      .slice(0, 50)
      .map((e) => ({ owner: e.owner, balance: e.balance, tickets: e.tickets, odds: e.odds })),
  };
  previewCache = { at: Date.now(), data };
  return data;
}

// â”€â”€ Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/state', async (_req, res) => {
  try {
    const [poolSol, preview] = await Promise.all([
      getPoolBalanceSol().catch(() => 0),
      getPreview().catch(() => ({ entries: [], totalTickets: 0, eligibleHolders: 0 })),
    ]);
    res.json({
      token: config.tokenMint.toBase58(),
      poolSol,
      buybackPercent: config.buybackPercent,
      buybackMode: config.buybackMode,
      weighting: config.weighting,
      dryRun: config.dryRun,
      intervalSeconds: config.roundIntervalSeconds,
      nextSpinAt,
      running: isRunning(),
      lastRound: lastRound(),
      preview,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/leaderboard', async (_req, res) => {
  try {
    res.json(await getPreview());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/rounds', (req, res) => {
  res.json({ rounds: getRounds(Number(req.query.limit) || 25) });
});

app.get('/api/verify/:id', (req, res) => {
  const round = getRounds(200).find((r) => String(r.id) === req.params.id);
  if (!round) return res.status(404).json({ error: 'round not found' });
  const ok = verify({
    serverSeed: round.serverSeed,
    commitment: round.commitment,
    blockhash: round.blockhash,
    totalTickets: round.totalTickets,
    winningTicket: round.winningTicket,
  });
  res.json({ id: round.id, valid: ok, round });
});

// Manual spin (admin only). Header: x-admin-key
app.post('/api/spin', async (req, res) => {
  if (req.headers['x-admin-key'] !== ADMIN_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (isRunning()) return res.status(409).json({ error: 'round in progress' });
  const r = await runRound();
  nextSpinAt = Date.now() + config.roundIntervalSeconds * 1000;
  res.json(r);
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(config.port, () => {
  console.log(`raffle backend on :${config.port}  (DRY_RUN=${config.dryRun})`);
  console.log(`token: ${config.tokenMint ? config.tokenMint.toBase58() : 'NOT CONFIGURED'}`);
});
