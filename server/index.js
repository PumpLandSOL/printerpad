// Printer Pad — the launchpad on Stable (STBL chain). Every coin ships a real product
// (live website + public GitHub repo), verified before it can launch. Plus the
// first LP staking pools on any Stable-chain launchpad, the highest creator
// rewards on the chain, and cashback on every launch.
//
// Rewards / cashback / staking are an OFF-CHAIN LEDGER — a simulation, no custody.
// Nothing here holds funds; payouts (if ever made) are scripted airdrops.
// Dependency-free: Node http + global fetch (Node 18+). No frameworks.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8162;
const ROOT = path.join(__dirname, '..');
const DATA_PATH = process.env.DATA_PATH || path.join(ROOT, 'projects.json');
const GH_TOKEN = process.env.GH_TOKEN || '';            // optional: lifts GitHub rate limit (read/verify)
const GH_WRITE_TOKEN = process.env.GH_WRITE_TOKEN || ''; // optional: auto-create the scaffolded repo
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || ''; // the AI co-builder
const PRINT_MINT = process.env.PRINT_MINT || '';          // $PRINT token (for later holder perks)

// ---- Creator Rewards (ETH-denominated; accrues to a ledger, paid via scripted airdrop) ----
// Marketed as the highest creator rewards on Stable (STBL chain).
const REWARD_LAUNCH = +(process.env.REWARD_LAUNCH_USDT || 50);  // base USDT0 per verified launch, ×(TechScore/100)
const REWARD_DRIP = +(process.env.REWARD_DRIP_USDT || 5);     // USDT0 per "still-alive" re-verify pass
const DRIP_INTERVAL_H = +(process.env.DRIP_INTERVAL_H || 12);    // hours between still-alive checks
const REWARDS_ON = (process.env.REWARDS_ON || '1') === '1';      // master switch (turn off until treasury funded)
const BOOST_DOX = +(process.env.BOOST_DOX || 0.5);     // +mult when the dev is doxxed (proof required)
const BOOST_LOCK = +(process.env.BOOST_LOCK || 0.5);   // +mult when dev/team tokens are locked (proof required)
const BOOST_AUDIT = +(process.env.BOOST_AUDIT || 1.0); // +mult when the contract is audited (proof required)
const BOOST_MULTI = +(process.env.BOOST_MULTI || 0.5); // +mult when the treasury is a multisig (proof required)

// ---- Cashback: a % of protocol activity paid back to participants (simulated ledger) ----
const CASHBACK_RATE = +(process.env.CASHBACK_RATE || 0.10);     // 10% cashback on creator rewards + staking activity
const CASHBACK_STAKE = +(process.env.CASHBACK_STAKE_USDT || 0.25); // flat cashback credited per stake action

// ---- LP staking pools (first on any Stable-chain launchpad; simulated APR accrual) ----
const POOL_APR = +(process.env.POOL_APR || 42);         // headline APR %, simulated
const YEAR_MS = 31557600000;

// ---------- registry ----------
let db = { projects: [], sites: {}, rewards: {}, cashback: {}, pools: {}, pfps: {} };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'))); } catch (e) {}
db.sites = db.sites || {};       // id -> { html, name } for AI-generated sites Printer Pad hosts
db.pfps = db.pfps || {};         // projectId -> data URL (meme PFPs, served at /pfp/<id>)
db.rewards = db.rewards || {};   // wallet -> { earned, paid, launches, drips, name } — USDT0 accrual ledger
db.cashback = db.cashback || {}; // wallet -> { earned, paid, actions } — USDT0 cashback ledger
db.pools = db.pools || {};       // projectId -> { id, ticker, name, apr, stakers:{ wallet:{amount,reward,since} } }
let saveT = null; function save() { if (saveT) return; saveT = setTimeout(() => { saveT = null; try { fs.writeFileSync(DATA_PATH, JSON.stringify(db)); } catch (e) {} }, 800); }

// ---------- helpers ----------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function serveStatic(req, res) {
  let url = decodeURIComponent(req.url.split('?')[0]); if (url === '/') url = '/client/index.html';
  if (url === '/browse' || url === '/browse/') url = '/client/browse.html';
  const file = path.normalize(path.join(ROOT, url));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('no'); }
  fs.readFile(file, (e, buf) => { if (e) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(buf); });
}
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }
function body(req) { return new Promise((resolve) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 2e6) req.destroy(); }); req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch (e) { resolve({}); } }); }); }
const clean = (s, n) => String(s == null ? '' : s).trim().slice(0, n);
const round4 = (n) => Math.round(n * 1e4) / 1e4;
const ipOf = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '0';

// rate limiter (ported from tekland hardening): per-ip, per-bucket token window
const _rl = new Map();
function rateLimit(ip, bucket, max, windowMs) {
  const key = ip + ':' + bucket; const now = Date.now();
  let e = _rl.get(key); if (!e || now > e.reset) { e = { n: 0, reset: now + windowMs }; _rl.set(key, e); }
  e.n++; return e.n <= max;
}
// SSRF guard (ported from tekland): reject internal/link-local/metadata hosts before fetching
function isPrivateHost(host) {
  host = String(host || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (host === '::1' || host === '0.0.0.0') return true;
  if (host === '169.254.169.254') return true; // cloud metadata
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = +m[1], b = +m[2];
    if (a === 10 || a === 127) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
    if (a === 0) return true;
  }
  return false;
}

// ---------- verification (the gate) ----------
async function checkSite(url) {
  if (!/^https?:\/\/[^\s.]+\.[^\s]+/i.test(url)) return { ok: false, status: 0, why: 'not a valid URL' };
  let host = '';
  try { host = new URL(url).hostname; } catch (e) { return { ok: false, status: 0, why: 'bad URL' }; }
  if (isPrivateHost(host)) return { ok: false, status: 0, why: 'internal host not allowed' };
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 8000);
    const r = await fetch(url, { signal: c.signal, redirect: 'follow', headers: { 'user-agent': 'Printer PadBot/1.0 (+printerpad)' } });
    clearTimeout(t);
    return { ok: r.status >= 200 && r.status < 400, status: r.status };
  } catch (e) { return { ok: false, status: 0, why: 'site unreachable' }; }
}
function parseRepo(url) {
  const m = String(url).match(/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/i);
  if (!m) return null; return { owner: m[1], repo: m[2].replace(/\.git$/i, '') };
}
async function checkRepo(url) {
  const p = parseRepo(url); if (!p) return { ok: false, why: 'not a GitHub repo URL' };
  try {
    const h = { 'user-agent': 'Printer PadBot/1.0', 'accept': 'application/vnd.github+json' };
    if (GH_TOKEN) h.authorization = 'Bearer ' + GH_TOKEN;
    const r = await fetch('https://api.github.com/repos/' + p.owner + '/' + p.repo, { headers: h });
    if (r.status === 404) return { ok: false, why: 'repo not found / not public' };
    if (r.status === 403) return { ok: false, why: 'GitHub rate-limited, try again shortly' };
    if (r.status !== 200) return { ok: false, why: 'github error ' + r.status };
    const d = await r.json();
    return { ok: true, owner: p.owner, repo: p.repo, pushedAt: d.pushed_at, createdAt: d.created_at,
      lang: d.language, desc: d.description, homepage: d.homepage, stars: d.stargazers_count, fork: !!d.fork, archived: !!d.archived };
  } catch (e) { return { ok: false, why: 'github check failed' }; }
}
function scoreOf(site, repo) {
  let score = 0; const checks = [];
  checks.push({ k: 'Live website (200 OK)', pass: site.ok, pts: 35 }); if (site.ok) score += 35;
  checks.push({ k: 'Public GitHub repo', pass: repo.ok, pts: 35 }); if (repo.ok) score += 35;
  const recent = repo.ok && repo.pushedAt && (Date.now() - Date.parse(repo.pushedAt) < 90 * 864e5);
  checks.push({ k: 'Commits in last 90 days', pass: !!recent, pts: 15 }); if (recent) score += 15;
  const documented = repo.ok && (repo.desc || repo.lang);
  checks.push({ k: 'Has description / language', pass: !!documented, pts: 10 }); if (documented) score += 10;
  const linked = repo.ok && repo.homepage;
  checks.push({ k: 'Repo links its site', pass: !!linked, pts: 5 }); if (linked) score += 5;
  return { score, checks };
}
// Stable (STBL chain) is EVM — a wallet / CA is a 0x-prefixed 40-hex address.
function isWallet(s) { return /^0x[a-fA-F0-9]{40}$/.test(String(s || '')); }
const normTicker = (t) => clean(t, 12).replace(/^\$/, '').toUpperCase();

// ---------- Creator Rewards: USDT0 accrues to a wallet ledger; payout is a scripted airdrop ----------
function creditReward(wallet, eth, name, kind) {
  if (!REWARDS_ON || !isWallet(wallet) || !(eth > 0)) return 0;
  const r = db.rewards[wallet] || (db.rewards[wallet] = { earned: 0, paid: 0, launches: 0, drips: 0, name: '' });
  r.earned = round4(r.earned + eth);
  if (kind === 'launch') r.launches++; else if (kind === 'drip') r.drips++;
  if (name) r.name = name;
  save(); return eth;
}
// Cashback: a % of activity paid back to the participant's wallet (simulated).
function creditCashback(wallet, eth) {
  if (!isWallet(wallet) || !(eth > 0)) return 0;
  const c = db.cashback[wallet] || (db.cashback[wallet] = { earned: 0, paid: 0, actions: 0 });
  c.earned = round4(c.earned + eth); c.actions++;
  save(); return eth;
}
// periodically re-verify listed projects; pay a "still-alive" drip to ones that stay up + maintained
async function dripPass() {
  if (!REWARDS_ON || !(REWARD_DRIP > 0)) return;
  for (const p of db.projects) {
    if (p.kind === 'meme') continue;             // memes have no site/repo to re-verify
    if (!isWallet(p.payoutWallet)) continue;
    const [site, repo] = await Promise.all([checkSite(p.website), checkRepo(p.github)]);
    const recent = repo.ok && repo.pushedAt && (Date.now() - Date.parse(repo.pushedAt) < 90 * 864e5);
    p.alive = site.ok && repo.ok; p.lastCheck = Date.now();
    if (site.ok && repo.ok && recent) creditReward(p.payoutWallet, round4(REWARD_DRIP * (p.mult || 1)), p.name, 'drip');
  }
  save();
}
if (REWARDS_ON && REWARD_DRIP > 0) setInterval(() => { dripPass().catch(() => {}); }, Math.max(1, DRIP_INTERVAL_H) * 36e5);

// ---------- LP staking pools ----------
function poolPublic(pool, wallet) {
  let totalStaked = 0; let stakers = 0;
  for (const w in pool.stakers) { const s = pool.stakers[w]; if (s.amount > 0) { totalStaked += s.amount; stakers++; } }
  const out = { id: pool.id, ticker: pool.ticker, name: pool.name, apr: pool.apr, totalStaked: round4(totalStaked), stakers };
  if (wallet && pool.stakers[wallet]) {
    const s = pool.stakers[wallet]; const pending = accrue(s, pool.apr);
    out.you = { staked: round4(s.amount), pending: round4(pending) };
  }
  return out;
}
// lazy APR accrual: settle pending reward up to now, reset the clock
function accrue(s, apr) {
  const now = Date.now(); const since = s.since || now;
  s.reward = round4((s.reward || 0) + s.amount * (apr / 100) * (now - since) / YEAR_MS);
  s.since = now; return s.reward;
}
function stake(wallet, poolId, amount) {
  if (!isWallet(wallet)) return { ok: false, error: 'connect a valid Stable-chain (EVM) wallet' };
  const pool = db.pools[poolId]; if (!pool) return { ok: false, error: 'pool not found' };
  amount = Math.max(0, +amount || 0); if (!(amount > 0)) return { ok: false, error: 'enter an amount' };
  const s = pool.stakers[wallet] || (pool.stakers[wallet] = { amount: 0, reward: 0, since: Date.now() });
  accrue(s, pool.apr); s.amount = round4(s.amount + amount); s.since = Date.now();
  const cb = creditCashback(wallet, CASHBACK_STAKE); save();
  return { ok: true, pool: poolPublic(pool, wallet), cashback: cb };
}
function unstake(wallet, poolId, amount) {
  if (!isWallet(wallet)) return { ok: false, error: 'bad wallet' };
  const pool = db.pools[poolId]; const s = pool && pool.stakers[wallet];
  if (!s || !(s.amount > 0)) return { ok: false, error: 'nothing staked' };
  accrue(s, pool.apr); amount = Math.min(Math.max(0, +amount || 0), s.amount);
  if (!(amount > 0)) return { ok: false, error: 'enter an amount' };
  s.amount = round4(s.amount - amount); s.since = Date.now(); save();
  return { ok: true, pool: poolPublic(pool, wallet), returned: round4(amount) };
}
function claimStake(wallet, poolId) {
  if (!isWallet(wallet)) return { ok: false, error: 'bad wallet' };
  const pool = db.pools[poolId]; const s = pool && pool.stakers[wallet];
  if (!s) return { ok: false, error: 'nothing to claim' };
  const pending = accrue(s, pool.apr); if (!(pending > 0)) return { ok: false, error: 'no rewards yet' };
  s.reward = 0; s.since = Date.now();
  const cb = creditCashback(wallet, round4(pending * CASHBACK_RATE)); save();
  return { ok: true, claimed: round4(pending), cashback: cb, pool: poolPublic(pool, wallet) };
}

// ---- meme PFPs: exact-image dedupe. One PFP, one coin — same rule as tickers. ----
const PFP_RE = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=]+)$/;
function pfpHashOf(dataUrl) {
  const m = PFP_RE.exec(String(dataUrl || ''));
  if (!m) return { error: 'PFP must be a PNG, JPG, WEBP or GIF image' };
  if (dataUrl.length > 1.4e6) return { error: 'PFP too large — keep it under ~1MB' };
  return { hash: crypto.createHash('sha256').update(m[2]).digest('hex') };
}

async function spawnProject(d) {
  const kind = d.kind === 'meme' ? 'meme' : 'tech';
  const name = clean(d.name, 40), ticker = normTicker(d.ticker);
  const desc = clean(d.desc, 240), website = clean(d.website, 200), github = clean(d.github, 200), ca = clean(d.ca, 50);
  const payoutWallet = clean(d.payoutWallet, 50);
  if (kind === 'meme') {
    if (!name || !ticker) return { ok: false, error: 'name and ticker are required' };
    if (db.projects.some((p) => p.ticker === ticker))
      return { ok: false, error: '$' + ticker + ' is already live on Printer Pad. Duplicate tickers are banned — pick another.' };
    const ph = pfpHashOf(d.pfp);
    if (ph.error) return { ok: false, error: ph.error };
    // DUPLICATE-PFP BAN — the image itself must be unique across every coin on the pad.
    if (db.projects.some((p) => p.pfpHash === ph.hash))
      return { ok: false, error: 'that PFP is already used by another coin on Printer Pad. Duplicate PFPs are banned — bring an original.' };
    const id = 'moon_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    db.pfps[id] = d.pfp;
    const proj = { id, kind: 'meme', name, ticker, desc, ca: isWallet(ca) ? ca : '',
      pfp: '/pfp/' + id, pfpHash: ph.hash, spawnedAt: Date.now(), votes: 0,
      payoutWallet: isWallet(payoutWallet) ? payoutWallet : '', alive: true, lastCheck: Date.now(), mult: 1 };
    db.projects.unshift(proj);
    db.pools[id] = { id, ticker, name, apr: POOL_APR, stakers: {} }; // memes get an LP pool too
    save();
    return { ok: true, project: proj, meme: true };
  }
  const http_ = (u) => /^https?:\/\//i.test(u);
  const doxLink = clean(d.doxLink, 200), lockLink = clean(d.lockLink, 200), auditLink = clean(d.auditLink, 200), multiLink = clean(d.multiLink, 200);
  const doxxed = !!d.doxxed && http_(doxLink), locked = !!d.locked && http_(lockLink);
  const audited = !!d.audited && http_(auditLink), multisig = !!d.multisig && http_(multiLink);
  const mult = round4(1 + (doxxed ? BOOST_DOX : 0) + (locked ? BOOST_LOCK : 0) + (audited ? BOOST_AUDIT : 0) + (multisig ? BOOST_MULTI : 0));
  if (!name || !ticker) return { ok: false, error: 'name and ticker are required' };
  // DUPLICATE-TICKER BAN — one ticker, one project. Kills PvP / copycat launches.
  if (db.projects.some((p) => p.ticker === ticker))
    return { ok: false, error: '$' + ticker + ' is already live on Printer Pad. Duplicate tickers are banned — pick another.' };
  if (db.projects.some((p) => parseRepo(p.github) && parseRepo(github) && p.github.toLowerCase() === github.toLowerCase()))
    return { ok: false, error: 'that GitHub repo is already launched' };
  const [site, repo] = await Promise.all([checkSite(website), checkRepo(github)]);
  const { score, checks } = scoreOf(site, repo);
  if (!site.ok || !repo.ok) {
    return { ok: false, gated: true, checks, site, repo,
      error: (!site.ok ? 'Website must be live (got ' + (site.why || site.status) + '). ' : '') + (!repo.ok ? 'GitHub repo must be public (' + (repo.why || '') + ').' : '') };
  }
  const id = 'moon_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const proj = { id, kind: 'tech', name, ticker, desc, website, github, ca: isWallet(ca) ? ca : '', score, lang: repo.lang || '', stars: repo.stars || 0,
    spawnedAt: Date.now(), votes: 0, payoutWallet: isWallet(payoutWallet) ? payoutWallet : '', alive: true, lastCheck: Date.now(),
    doxxed, doxLink: doxxed ? doxLink : '', locked, lockLink: locked ? lockLink : '',
    audited, auditLink: audited ? auditLink : '', multisig, multiLink: multisig ? multiLink : '', mult };
  db.projects.unshift(proj);
  // First LP staking pool on any Stable-chain launchpad: every launch gets one, live at spawn.
  db.pools[id] = { id, ticker, name, apr: POOL_APR, stakers: {} };
  // Creator Reward: USDT0 for shipping real tech, weighted by Tech Score × trust multiplier.
  const reward = creditReward(proj.payoutWallet, round4(REWARD_LAUNCH * score / 100 * mult), name, 'launch');
  // Cashback on the launch itself.
  const cashback = creditCashback(proj.payoutWallet, round4(reward * CASHBACK_RATE));
  save();
  return { ok: true, project: proj, checks, reward, cashback, mult, rewardsOn: REWARDS_ON };
}

// ---------- AI co-builder (Claude via raw HTTPS — project is dependency-free, no SDK) ----------
const KIT_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    name: { type: 'string' }, ticker: { type: 'string' }, description: { type: 'string' },
    taglines: { type: 'array', items: { type: 'string' } },
    pitch: { type: 'string' }, stack: { type: 'string' }, repoName: { type: 'string' },
    readme: { type: 'string' }, indexHtml: { type: 'string' },
  },
  required: ['name', 'ticker', 'description', 'taglines', 'pitch', 'stack', 'repoName', 'readme', 'indexHtml'],
};
const SYS = "You are Printer Pad's AI co-builder. Printer Pad is the launchpad on Stable (STBL chain) where every coin must ship a REAL product (live website + public GitHub repo) before it can launch. " +
  "Given a one-line idea, generate a complete, legitimate, buildable tech-project launch kit. Make it a genuine product concept (a tool, protocol, app, or infra), NOT a meme coin. " +
  "indexHtml must be a complete, self-contained single-file landing page: inline <style> only, no external scripts or fonts, a modern dark aesthetic, with the product name, what it does, and a clear CTA. " +
  "readme is GitHub-flavored markdown describing the project, features, and how to run it. ticker is 3-5 uppercase letters, no $. repoName is a lowercase-kebab slug. Keep indexHtml under ~6KB.";

async function aiBuild(idea) {
  if (!CLAUDE_API_KEY) return { ok: false, error: 'AI builder not configured — set CLAUDE_API_KEY on the server.' };
  idea = clean(idea, 400);
  if (!idea) return { ok: false, error: 'describe your idea in one line' };
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': CLAUDE_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-opus-4-8', max_tokens: 16000,
        thinking: { type: 'adaptive' },
        output_config: { format: { type: 'json_schema', schema: KIT_SCHEMA } },
        system: SYS,
        messages: [{ role: 'user', content: 'Idea: ' + idea }],
      }),
    });
    const d = await r.json();
    if (r.status !== 200) return { ok: false, error: (d.error && d.error.message) || ('Claude API error ' + r.status) };
    const textBlock = (d.content || []).filter((b) => b.type === 'text').pop();
    if (!textBlock) return { ok: false, error: 'no output from the model' };
    let kit; try { kit = JSON.parse(textBlock.text); } catch (e) { return { ok: false, error: 'could not parse the generated kit' }; }
    kit.ticker = String(kit.ticker || '').replace(/^\$/, '').toUpperCase().slice(0, 8);
    return { ok: true, kit, usage: d.usage };
  } catch (e) { return { ok: false, error: 'AI request failed' }; }
}

// optionally create + populate the GitHub repo (needs a write-scoped token)
async function ghCreateRepo(kit) {
  if (!GH_WRITE_TOKEN) return null;
  const h = { 'user-agent': 'Printer PadBot/1.0', 'accept': 'application/vnd.github+json', authorization: 'Bearer ' + GH_WRITE_TOKEN };
  const repo = clean(kit.repoName, 80).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '') || 'printerpad-project';
  try {
    const cr = await fetch('https://api.github.com/user/repos', { method: 'POST', headers: h,
      body: JSON.stringify({ name: repo, description: clean(kit.description, 200), auto_init: false, private: false }) });
    if (cr.status !== 201) return null;
    const created = await cr.json(); const owner = created.owner.login;
    const put = (path, content) => fetch('https://api.github.com/repos/' + owner + '/' + repo + '/contents/' + path,
      { method: 'PUT', headers: h, body: JSON.stringify({ message: 'init: ' + path, content: Buffer.from(content, 'utf8').toString('base64') }) });
    await put('README.md', kit.readme || ('# ' + kit.name));
    await put('index.html', kit.indexHtml || '<!doctype html><title>' + kit.name + '</title>');
    return { url: created.html_url, owner, repo };
  } catch (e) { return null; }
}

// ---------- http ----------
http.createServer(async (req, res) => {
  const ip = ipOf(req);
  if (req.method === 'POST' && req.url === '/api/spawn') {
    if (!rateLimit(ip, 'spawn', 8, 60000)) return json(res, 429, { ok: false, error: 'slow down — too many launches' });
    const d = await body(req); return json(res, 200, await spawnProject(d));
  }
  if (req.method === 'POST' && req.url === '/api/preview') {            // dry-run: verify without listing
    if (!rateLimit(ip, 'preview', 30, 60000)) return json(res, 429, { pass: false, error: 'slow down' });
    const d = await body(req); const [site, repo] = await Promise.all([checkSite(clean(d.website, 200)), checkRepo(clean(d.github, 200))]);
    const ticker = normTicker(d.ticker);
    const tickerTaken = !!ticker && db.projects.some((p) => p.ticker === ticker);
    return json(res, 200, { ...scoreOf(site, repo), site, repo, pass: site.ok && repo.ok && !tickerTaken, tickerTaken, ticker });
  }
  if (req.method === 'GET' && req.url.startsWith('/api/ticker-check')) { // live availability for the launch modal
    const u = new URL(req.url, 'http://x'); const ticker = normTicker(u.searchParams.get('t') || '');
    if (!ticker) return json(res, 200, { ok: false, taken: false, ticker: '' });
    return json(res, 200, { ok: true, ticker, taken: db.projects.some((p) => p.ticker === ticker) });
  }
  if (req.method === 'POST' && req.url === '/api/vote') {
    if (!rateLimit(ip, 'vote', 40, 60000)) return json(res, 429, { ok: false });
    const d = await body(req); const p = db.projects.find((x) => x.id === d.id); if (p) { p.votes++; save(); } return json(res, 200, { ok: !!p, votes: p ? p.votes : 0 });
  }
  // ---- LP staking ----
  if (req.method === 'POST' && req.url === '/api/stake') {
    if (!rateLimit(ip, 'stake', 30, 60000)) return json(res, 429, { ok: false, error: 'slow down' });
    const d = await body(req); return json(res, 200, stake(clean(d.wallet, 50), clean(d.poolId, 60), d.amount));
  }
  if (req.method === 'POST' && req.url === '/api/unstake') {
    const d = await body(req); return json(res, 200, unstake(clean(d.wallet, 50), clean(d.poolId, 60), d.amount));
  }
  if (req.method === 'POST' && req.url === '/api/stake/claim') {
    const d = await body(req); return json(res, 200, claimStake(clean(d.wallet, 50), clean(d.poolId, 60)));
  }
  if (req.method === 'GET' && req.url.startsWith('/api/pools')) {
    const u = new URL(req.url, 'http://x'); const w = clean(u.searchParams.get('wallet') || '', 50);
    const pools = Object.values(db.pools).map((p) => poolPublic(p, isWallet(w) ? w : '')).sort((a, b) => b.totalStaked - a.totalStaked);
    const tvl = round4(pools.reduce((a, p) => a + p.totalStaked, 0));
    return json(res, 200, { ok: true, pools, tvl, apr: POOL_APR, count: pools.length });
  }
  // ---- cashback ----
  if (req.method === 'GET' && req.url.startsWith('/api/cashback')) {
    const u = new URL(req.url, 'http://x'); const w = clean(u.searchParams.get('wallet') || '', 50);
    const totalPaid = round4(Object.values(db.cashback).reduce((a, c) => a + (c.earned || 0), 0));
    if (isWallet(w)) { const c = db.cashback[w] || { earned: 0, paid: 0, actions: 0 }; return json(res, 200, { ok: true, wallet: w, rate: CASHBACK_RATE, ...c }); }
    return json(res, 200, { ok: true, rate: CASHBACK_RATE, totalPaid });
  }
  if (req.method === 'POST' && req.url === '/api/ai/build') {
    if (!rateLimit(ip, 'ai', 6, 60000)) return json(res, 429, { ok: false, error: 'slow down — AI builder is rate-limited' });
    const d = await body(req); const out = await aiBuild(d.idea);
    if (!out.ok) return json(res, 200, out);
    const id = 'gen_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    db.sites[id] = { html: out.kit.indexHtml || '', name: out.kit.name }; save();
    const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0];
    const previewUrl = proto + '://' + req.headers.host + '/site/' + id;
    const repo = await ghCreateRepo(out.kit);
    return json(res, 200, { ok: true, kit: out.kit, previewUrl, repo: repo ? repo.url : '', repoCreated: !!repo });
  }
  if (req.url.startsWith('/pfp/')) {                                     // meme PFP images
    const id = req.url.split('?')[0].slice(5);
    const p = db.pfps[id]; const m = p && PFP_RE.exec(p);
    if (!m) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': 'image/' + (m[1] === 'jpg' ? 'jpeg' : m[1]), 'Cache-Control': 'public, max-age=86400' });
    return res.end(Buffer.from(m[2], 'base64'));
  }
  if (req.url.startsWith('/site/')) {
    const id = req.url.split('?')[0].slice(6);
    const s = db.sites[id]; if (!s) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(s.html);
  }
  if (req.url.startsWith('/api/rewards')) {                              // creator rewards: one wallet, or the leaderboard
    const u = new URL(req.url, 'http://x'); const w = u.searchParams.get('wallet');
    const totalEarned = round4(Object.values(db.rewards).reduce((a, r) => a + (r.earned || 0), 0));
    if (w) { const r = db.rewards[w] || { earned: 0, paid: 0, launches: 0, drips: 0 }; const c = db.cashback[w] || { earned: 0 };
      return json(res, 200, { ok: true, wallet: w, ...r, cashback: c.earned || 0 }); }
    const top = Object.entries(db.rewards).map(([wallet, r]) => ({ wallet, ...r })).sort((a, b) => b.earned - a.earned).slice(0, 25);
    return json(res, 200, { ok: true, rewardsOn: REWARDS_ON, perLaunch: REWARD_LAUNCH, perDrip: REWARD_DRIP, totalEarned, top });
  }
  if (req.url.startsWith('/api/projects')) {
    const top = db.projects.slice().sort((a, b) => b.score - a.score || b.votes - a.votes || b.spawnedAt - a.spawnedAt);
    const totalEarned = round4(Object.values(db.rewards).reduce((a, r) => a + (r.earned || 0), 0));
    const tvl = round4(Object.values(db.pools).reduce((t, p) => t + Object.values(p.stakers).reduce((a, s) => a + (s.amount > 0 ? s.amount : 0), 0), 0));
    const cashbackPaid = round4(Object.values(db.cashback).reduce((a, c) => a + (c.earned || 0), 0));
    return json(res, 200, { projects: top, count: db.projects.length, gate: { active: !!PRINT_MINT }, printMint: PRINT_MINT, ai: !!CLAUDE_API_KEY, autoRepo: !!GH_WRITE_TOKEN,
      rewards: { on: REWARDS_ON, perLaunch: REWARD_LAUNCH, perDrip: REWARD_DRIP, totalEarned,
        boostDox: BOOST_DOX, boostLock: BOOST_LOCK, boostAudit: BOOST_AUDIT, boostMulti: BOOST_MULTI },
      staking: { apr: POOL_APR, tvl, pools: Object.keys(db.pools).length },
      cashback: { rate: CASHBACK_RATE, paid: cashbackPaid } });
  }
  serveStatic(req, res);
}).listen(PORT, () => console.log('Printer Pad on :' + PORT + ' — Stable (STBL chain) launchpad · LP staking · ' + (REWARD_LAUNCH) + ' USDT0/launch · ' + (CASHBACK_RATE * 100) + '% cashback'));
