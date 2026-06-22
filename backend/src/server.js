import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { takeSnapshot } from './services/snapshot.js';
import { buildTickets } from './services/tickets.js';
import { getPoolBalanceSol } from './services/buyback.js';
import { runRound, isRunning } from './services/raffle.js';
import { verify } from './services/rng.js';
import { getRounds, lastRound } from './store.js';

// ── ADMIN_KEY ────────────────────────────────────────────
const ADMIN_KEY = process.env.ADMIN_KEY;
if (!ADMIN_KEY || ADMIN_KEY === 'changeme') {
  console.warn('[security] WARNING: ADMIN_KEY not set or is "changeme" — /api/spin endpoint is disabled until you set a strong key in .env');
}

// ── CORS — only allow the deployed frontend ──────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Always allow localhost in dev
if (process.env.NODE_ENV !== 'production') {
  ALLOWED_ORIGINS.push('http://localhost:5173', 'http://localhost:3000');
}

const app = express();
app.use(cors({
  origin: (origin, cb) => {
    // allow server-to-server (no origin header) and listed origins
    if (!origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
      return cb(null, true);
    }
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
}));
app.use(express.json());

// ── Scheduler ────────────────────────────────────────────
let nextSpinAt = Date.now() + config.roundIntervalSeconds * 1000;

async function tick() {
  try {
    console.log('[scheduler] running round…');
    const r = await runRound();
    console.log(`[scheduler] round ${r.id} -> ${r.status}`, r.winner || '');
  } catch (e) {
    console.error('[scheduler] round error:', e.message);
  } finally {
    nextSpinAt = Date.now() + config.roundIntervalSeconds * 1000;
  }
}
setInterval(tick, config.roundIntervalSeconds * 1000);

// ── Live preview cache ───────────────────────────────────
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

// ── Routes ───────────────────────────────────────────────
app.get('/api/state', async (_req, res) => {
  try {
    const [poolSol, preview] = await Promise.all([
      getPoolBalanceSol().catch(() => 0),
      getPreview().catch(() => ({ entries: [], totalTickets: 0, eligibleHolders: 0 })),
    ]);
    res.json({
      token: config.tokenMint ? config.tokenMint.toBase58() : null,
      poolSol,
      buybackPercent: config.buybackPercent,
      buybackMode:    config.buybackMode,
      weighting:      config.weighting,
      dryRun:         config.dryRun,
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
    serverSeed:    round.serverSeed,
    commitment:    round.commitment,
    blockhash:     round.blockhash,
    totalTickets:  round.totalTickets,
    winningTicket: round.winningTicket,
  });
  res.json({ id: round.id, valid: ok, round });
});

// Manual spin — requires a strong ADMIN_KEY header
app.post('/api/spin', async (req, res) => {
  if (!ADMIN_KEY || ADMIN_KEY === 'changeme') {
    return res.status(503).json({ error: 'ADMIN_KEY not configured on this server' });
  }
  if (req.headers['x-admin-key'] !== ADMIN_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (isRunning()) return res.status(409).json({ error: 'round in progress' });
  const r = await runRound();
  nextSpinAt = Date.now() + config.roundIntervalSeconds * 1000;
  res.json(r);
});

app.get('/health', (_req, res) => res.json({ ok: true, dryRun: config.dryRun }));

app.listen(config.port, () => {
  console.log(`[server] raffle backend :${config.port}  DRY_RUN=${config.dryRun}`);
  console.log(`[server] token: ${config.tokenMint ? config.tokenMint.toBase58() : 'NOT CONFIGURED'}`);
  console.log(`[server] interval: ${config.roundIntervalSeconds}s  buyback: ${config.buybackPercent}%`);
});
