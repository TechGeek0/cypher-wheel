// Talks to the backend at /api/*. If the backend isn't running yet,
// it falls back to live-feeling demo data so the page is alive immediately.

const API_BASE = import.meta.env.VITE_API_URL || '';

const SOL_NAMES = ['So111', '7xKXt', 'EPjFW', 'mSoLz', 'orcaE', 'JUPyi', 'bonkA', 'WENse'];

function randAddr() {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let s = '';
  for (let i = 0; i < 44; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

let demoHolders = null;
function buildDemoHolders(n = 18) {
  if (demoHolders) return demoHolders;
  demoHolders = Array.from({ length: n }, (_, i) => {
    const balance = Math.floor(1000 + Math.random() ** 2 * 4_000_000);
    return { owner: randAddr(), balance, _tag: SOL_NAMES[i % SOL_NAMES.length] };
  }).sort((a, b) => b.balance - a.balance);
  return demoHolders;
}

function sqrtTickets(holders) {
  let cursor = 0;
  const entries = holders.map((h) => {
    const tickets = Math.sqrt(h.balance);
    const e = { ...h, tickets, start: cursor, end: cursor + tickets };
    cursor += tickets;
    return e;
  });
  const total = cursor;
  entries.forEach((e) => (e.odds = e.tickets / total));
  return { entries, total };
}

// Live winners ledger (seeded so the hero feels alive)
let liveFeed = null;
function seedFeed() {
  if (liveFeed) return liveFeed;
  liveFeed = [];
  let t = Date.now() - 30000;
  const round = 142;
  for (let i = 0; i < 9; i++) {
    liveFeed.push({
      id: t, round: round - i, winner: randAddr(),
      prizeSol: +(0.8 + Math.random() * 9).toFixed(3),
      buybackSol: +(0.2 + Math.random() * 2).toFixed(3),
      blockhash: randAddr(), odds: Math.random() * 0.18 + 0.01,
    });
    t -= 60000 + Math.random() * 240000;
  }
  return liveFeed;
}

let lastSynthetic = Date.now();
export function getLiveFeed() {
  const feed = seedFeed();
  if (Date.now() - lastSynthetic > 9000 + Math.random() * 6000) {
    lastSynthetic = Date.now();
    feed.unshift({
      id: Date.now(), round: feed[0].round + 1, winner: randAddr(),
      prizeSol: +(0.8 + Math.random() * 9).toFixed(3),
      buybackSol: +(0.2 + Math.random() * 2).toFixed(3),
      blockhash: randAddr(), odds: Math.random() * 0.18 + 0.01,
    });
    feed.length = Math.min(feed.length, 24);
  }
  return feed.slice();
}

function pushReal(round) {
  const feed = seedFeed();
  feed.unshift({
    id: round.id, round: (feed[0] ? feed[0].round : 142) + 1,
    winner: round.winner, prizeSol: round.prizeSol, buybackSol: round.buybackSol,
    blockhash: round.blockhash, odds: round.winnerOdds,
  });
  feed.length = Math.min(feed.length, 24);
}

let offlineState = { poolSol: 6.8 + Math.random() * 4, nextSpinAt: Date.now() + 300_000, rounds: [] };

function offlineStatePayload() {
  const holders = buildDemoHolders();
  const { entries, total } = sqrtTickets(holders);
  offlineState.poolSol += Math.random() * 0.05;
  return {
    token: null,
    poolSol: offlineState.poolSol, buybackPercent: 50, buybackMode: 'burn',
    weighting: 'sqrt', dryRun: true, intervalSeconds: 300,
    nextSpinAt: offlineState.nextSpinAt, running: false,
    lastRound: offlineState.rounds[0] || null,
    preview: {
      eligibleHolders: holders.length, totalHolders: holders.length + 6, totalTickets: total,
      entries: entries.map((e) => ({ owner: e.owner, balance: e.balance, tickets: e.tickets, odds: e.odds })),
    },
  };
}

async function tryFetch(path, opts) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2500);
  try {
    const r = await fetch(API_BASE + path, { ...opts, signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } catch (e) { clearTimeout(t); throw e; }
}

export async function getState() {
  try { return await tryFetch('/api/state'); }
  catch { return offlineStatePayload(); }
}

export function runSpin() {
  const holders = buildDemoHolders();
  const { entries, total } = sqrtTickets(holders);
  const ticket = Math.random() * total;
  const winner = entries.find((e) => ticket >= e.start && ticket < e.end) || entries[0];
  const winnerIndex = entries.indexOf(winner);
  const distributable = Math.max(0, offlineState.poolSol - 0.01);
  const buybackSol = +(distributable * 0.5).toFixed(4);
  const prizeSol   = +(distributable - buybackSol).toFixed(4);
  const round = {
    id: Date.now(), status: 'complete', dryRun: true,
    winner: winner.owner, winnerBalance: winner.balance, winnerOdds: winner.odds,
    prizeSol, buybackSol, poolSol: offlineState.poolSol,
    blockhash: randAddr(), commitment: randAddr(),
    winningTicket: Math.floor(ticket), totalTickets: Math.floor(total),
  };
  offlineState.rounds.unshift(round);
  pushReal(round);
  offlineState.poolSol = 0.4 + Math.random() * 0.6;
  offlineState.nextSpinAt = Date.now() + 300_000;
  return { round, entries, winnerIndex };
}

export async function getRounds() {
  try { const d = await tryFetch('/api/rounds'); return d.rounds || []; }
  catch { return offlineState.rounds; }
}