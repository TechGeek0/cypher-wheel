import { Connection, PublicKey } from '@solana/web3.js';
import { config } from '../config.js';

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

const connection = new Connection(config.rpcUrl, 'confirmed');

let cachedDecimals = null;
async function getDecimals() {
  if (cachedDecimals !== null) return cachedDecimals;
  const supply = await connection.getTokenSupply(config.tokenMint);
  cachedDecimals = supply.value.decimals;
  return cachedDecimals;
}

// Read a little-endian u64 from a buffer slice into a Number (token amounts fit fine).
function readAmount(buf, offset) {
  return Number(buf.readBigUInt64LE(offset));
}

async function fetchHoldersForProgram(programId, decimals) {
  const accounts = await connection.getProgramAccounts(programId, {
    commitment: 'confirmed',
    filters: [
      { dataSize: 165 },
      { memcmp: { offset: 0, bytes: config.tokenMint.toBase58() } },
    ],
  });

  const map = new Map(); // owner -> raw amount
  for (const { account } of accounts) {
    const data = account.data;
    const owner = new PublicKey(data.subarray(32, 64)).toBase58();
    const amount = readAmount(data, 64);
    if (amount <= 0) continue;
    map.set(owner, (map.get(owner) || 0) + amount);
  }

  const factor = 10 ** decimals;
  return [...map.entries()].map(([owner, raw]) => ({
    owner,
    balance: raw / factor,
  }));
}

/**
 * Returns { takenAt, decimals, holders: [{ owner, balance }] }
 * already filtered for exclusions and the MIN_BALANCE floor.
 */
export async function takeSnapshot() {
  const decimals = await getDecimals();

  // Most Pump.fun tokens are classic SPL; check both programs to be safe.
  let holders = await fetchHoldersForProgram(TOKEN_PROGRAM_ID, decimals);
  if (holders.length === 0) {
    holders = await fetchHoldersForProgram(TOKEN_2022_PROGRAM_ID, decimals);
  }

  const excludeSet = new Set([
    ...config.excludedAddresses,
    config.loadPoolWallet().publicKey.toBase58(),
  ]);

  const eligible = holders
    .filter((h) => !excludeSet.has(h.owner))
    .filter((h) => h.balance >= config.minBalance)
    .sort((a, b) => b.balance - a.balance);

  return {
    takenAt: Date.now(),
    decimals,
    totalHolders: holders.length,
    eligibleHolders: eligible.length,
    holders: eligible,
  };
}

export { connection };
