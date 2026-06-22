import dotenv from 'dotenv';
import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

dotenv.config();

function req(name) {
  const v = process.env[name];
  if (!v || v.startsWith('YOUR_')) {
    console.warn(`[config] WARNING: ${name} not set — some features will be disabled until you fill in .env`);
    return null;
  }
  return v;
}

let poolWallet = null;
function loadPoolWallet() {
  if (poolWallet) return poolWallet;
  const secret = req('POOL_WALLET_SECRET');
  if (!secret) throw new Error('POOL_WALLET_SECRET not configured — fill in backend/.env');
  poolWallet = Keypair.fromSecretKey(bs58.decode(secret));
  return poolWallet;
}

const excluded = (process.env.EXCLUDED_ADDRESSES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const tokenMintStr = req('TOKEN_MINT');

export const config = {
  rpcUrl:               req('RPC_URL'),
  tokenMint:            tokenMintStr ? new PublicKey(tokenMintStr) : null,
  excludedAddresses:    excluded,
  roundIntervalSeconds: Number(process.env.ROUND_INTERVAL_SECONDS || 300),
  minBalance:           Number(process.env.MIN_BALANCE || 1000),
  weighting:            process.env.WEIGHTING || 'sqrt',
  buybackPercent:       Number(process.env.BUYBACK_PERCENT || 50),
  buybackMode:          process.env.BUYBACK_MODE || 'burn',
  dryRun:               String(process.env.DRY_RUN ?? 'true') === 'true',
  port:                 Number(process.env.PORT || 8787),
  loadPoolWallet,
};
