// Printer Pad — launchpad front-end: live marquee, board, tech gate + meme gate
// (original-PFP + unique-ticker), EVM wallet, and LP staking pools.
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const host = (u) => { try { return new URL(u).host.replace(/^www\./, ''); } catch (e) { return u; } };
  const ago = (t) => { const s = (Date.now() - t) / 1000; if (s < 60) return 'just now'; if (s < 3600) return (s / 60 | 0) + 'm ago'; if (s < 86400) return (s / 3600 | 0) + 'h ago'; return (s / 86400 | 0) + 'd ago'; };
  const scoreColor = (s) => s >= 80 ? '#0abf6b' : s >= 60 ? '#7ac74f' : s >= 40 ? '#e0a52a' : '#ff4d68';
  const isEvm = (s) => /^0x[a-fA-F0-9]{40}$/.test(String(s || ''));
  const short = (a) => a.slice(0, 6) + '…' + a.slice(-4);

  let toastT; function toast(msg) {
    let t = $('_toast');
    if (!t) { t = document.createElement('div'); t.id = '_toast';
      t.style.cssText = 'position:fixed;bottom:52px;left:50%;transform:translateX(-50%);background:#000;color:#eefaf6;padding:12px 22px;border:1px solid #00d6a4;border-radius:999px;z-index:80;font:500 13px "JetBrains Mono",monospace;box-shadow:0 10px 40px rgba(0,0,0,.6)';
      document.body.appendChild(t); }
    t.textContent = msg; t.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(() => t.style.display = 'none', 2600);
  }

  // ---- EVM wallet (Stable (STBL chain)) ----
  let wallet = localStorage.getItem('printerpad_w') || '';
  function renderWallet() {
    const b = $('connectBtn'); if (!b) return;
    if (wallet) { b.textContent = short(wallet); b.classList.add('on'); b.title = 'Disconnect'; }
    else { b.textContent = 'Connect Wallet'; b.classList.remove('on'); b.title = ''; }
  }
  $('connectBtn').onclick = async () => {
    if (wallet) { wallet = ''; localStorage.removeItem('printerpad_w'); renderWallet(); loadPools(); toast('Wallet disconnected'); return; }
    const eth = window.ethereum;
    if (!eth) return toast('No Stable-chain (EVM) wallet found — install MetaMask or Rabby');
    try {
      const a = await eth.request({ method: 'eth_requestAccounts' });
      // pin the wallet to Stable mainnet (chainId 988 / 0x3dc); add the network if missing
      try {
        await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x3dc' }] });
      } catch (sw) {
        if (sw && (sw.code === 4902 || (sw.data && sw.data.originalError && sw.data.originalError.code === 4902))) {
          try {
            await eth.request({ method: 'wallet_addEthereumChain', params: [{
              chainId: '0x3dc', chainName: 'Stable',
              nativeCurrency: { name: 'USDT0', symbol: 'USDT0', decimals: 18 },
              rpcUrls: ['https://rpc.stable.xyz'], blockExplorerUrls: ['https://stablescan.xyz'] }] });
          } catch (ad) {}
        }
      }
      if (a && a[0] && isEvm(a[0])) { wallet = a[0]; localStorage.setItem('printerpad_w', wallet); renderWallet();
        if ($('f_payout') && !$('f_payout').value) $('f_payout').value = wallet;
        if ($('m_payout') && !$('m_payout').value) $('m_payout').value = wallet;
        loadPools(); toast('Connected ' + short(wallet)); }
    } catch (e) { toast('Connection rejected'); }
  };
  if (window.ethereum && window.ethereum.on) window.ethereum.on('accountsChanged', (a) => { wallet = (a && a[0] && isEvm(a[0])) ? a[0] : ''; if (wallet) localStorage.setItem('printerpad_w', wallet); else localStorage.removeItem('printerpad_w'); renderWallet(); loadPools(); });
  renderWallet();

  // ---- live launches marquee ----
  function renderMarquee(projects) {
    const mq = $('mq'); if (!mq) return;
    if (!projects || !projects.length) { mq.classList.remove('on'); return; }
    const items = projects.slice(0, 24).map((p) => p.kind === 'meme'
      ? '<span class="mq-i meme"><span class="kd">MEME</span><span class="tk">$' + esc(p.ticker) + '</span>' + esc(p.name) + '</span>'
      : '<span class="mq-i"><span class="kd">TECH</span><span class="tk">$' + esc(p.ticker) + '</span>' + esc(p.name) + '<span class="sc">' + p.score + '/100</span></span>').join('');
    const half = '<span class="mq-live"><span class="dot"></span>LIVE ON PRINTER PAD</span>' + items;
    $('mqIn').innerHTML = half + half;   // doubled for the seamless -50% loop
    mq.classList.add('on');
  }

  // ---- board ----
  async function loadBoard() {
    try {
      const d = await (await fetch('/api/projects')).json();
      if (d.ai) $('modes').style.display = 'flex';
      renderRewards(d.rewards);
      if (d.staking) { $('stApr').textContent = d.staking.apr + '%'; $('stPools').textContent = d.staking.pools || 0; $('stTvl').textContent = d.staking.tvl || 0; }
      if (d.cashback) { const pct = Math.round(d.cashback.rate * 100) + '%'; $('stCashback').textContent = pct; if ($('cbPill')) $('cbPill').textContent = pct; }
      if (d.printMint) { const bar = $('cabar'); bar.style.display = 'flex'; $('caV').textContent = short(d.printMint); bar.href = 'https://stablescan.xyz/token/' + d.printMint;
        $('caCopy').onclick = (e) => { e.preventDefault(); e.stopPropagation(); navigator.clipboard && navigator.clipboard.writeText(d.printMint); $('caCopy').textContent = 'Copied'; setTimeout(() => $('caCopy').textContent = 'Copy', 1200); }; }
      renderMarquee(d.projects);
      $('boardCount').textContent = d.count + (d.count === 1 ? ' coin' : ' coins');
      $('stCount').textContent = d.count;
      const g = $('grid');
      if (!d.count) { g.innerHTML = '<div class="empty">No coins yet — launch the first tech coin or the first meme. Either way, no duplicates, ever.</div>'; return; }
      g.innerHTML = d.projects.map(card).join('');
      g.querySelectorAll('[data-vote]').forEach((b) => b.addEventListener('click', () => vote(b.dataset.vote, b)));
    } catch (e) { $('boardCount').textContent = 'failed to load'; }
  }
  function card(p) {
    if (p.kind === 'meme') {
      const chips = ['<span class="chip meme">🎭 MEME</span>', '<span class="chip ok">PFP ✓ original</span>'];
      if (p.ca) chips.push('<span class="chip ok">CA ✓</span>');
      chips.push('<span class="chip">' + ago(p.spawnedAt) + '</span>');
      return '<div class="card meme">' +
        '<div class="ctop"><div class="cid"><img class="cpfp" src="' + esc(p.pfp) + '" alt="">' +
          '<div><div class="cname">' + esc(p.name) + '</div><div class="ctk">$' + esc(p.ticker) + '</div></div></div>' +
          '<div class="badge meme"><div class="s">🎭</div><div class="l">MEME</div></div></div>' +
        '<div class="cdesc">' + (esc(p.desc) || '<span style="color:#b5cab8">gm</span>') + '</div>' +
        '<div class="chips">' + chips.join('') + '</div>' +
        '<div class="clinks"><button class="vote" data-vote="' + p.id + '" style="flex:1">▲ ' + (p.votes || 0) + '</button></div></div>';
    }
    const col = scoreColor(p.score);
    const chips = [];
    if (p.lang) chips.push('<span class="chip ok">' + esc(p.lang) + '</span>');
    chips.push('<span class="chip">★ ' + (p.stars || 0) + '</span>');
    if (p.ca) chips.push('<span class="chip ok">CA ✓</span>');
    if (p.doxxed) chips.push('<span class="chip dox"><a href="' + esc(p.doxLink) + '" target="_blank" rel="noopener">🛡 Doxxed</a></span>');
    if (p.locked) chips.push('<span class="chip lock"><a href="' + esc(p.lockLink) + '" target="_blank" rel="noopener">🔒 Locked</a></span>');
    if (p.audited) chips.push('<span class="chip audit"><a href="' + esc(p.auditLink) + '" target="_blank" rel="noopener">🔍 Audited</a></span>');
    if (p.multisig) chips.push('<span class="chip multi"><a href="' + esc(p.multiLink) + '" target="_blank" rel="noopener">🔐 Multisig</a></span>');
    if (p.mult > 1) chips.push('<span class="chip mult">' + p.mult + '× rewards</span>');
    chips.push('<span class="chip">' + ago(p.spawnedAt) + '</span>');
    return '<div class="card">' +
      '<div class="ctop"><div><div class="cname">' + esc(p.name) + '</div><div class="ctk">$' + esc(p.ticker) + '</div></div>' +
        '<div class="badge" style="border-color:' + col + '55"><div class="s" style="color:' + col + '">' + p.score + '</div><div class="l">TECH</div></div></div>' +
      '<div class="cdesc">' + (esc(p.desc) || '<span style="color:#b5cab8">no description</span>') + '</div>' +
      '<div class="chips">' + chips.join('') + '</div>' +
      '<div class="clinks">' +
        '<a class="clink" href="' + esc(p.website) + '" target="_blank" rel="noopener">site ↗ ' + esc(host(p.website)) + '</a>' +
        '<a class="clink" href="' + esc(p.github) + '" target="_blank" rel="noopener">github ↗</a>' +
        '<button class="vote" data-vote="' + p.id + '">▲ ' + (p.votes || 0) + '</button>' +
      '</div></div>';
  }

  // ---- LP staking pools ----
  async function loadPools() {
    try {
      const q = isEvm(wallet) ? ('?wallet=' + wallet) : '';
      const d = await (await fetch('/api/pools' + q)).json();
      $('stTvl').textContent = d.tvl || 0; $('stPools').textContent = d.count || 0;
      const box = $('pools');
      if (!d.count) { box.innerHTML = '<div class="pool-empty">No pools yet — launch the first coin and its staking pool goes live instantly.</div>'; return; }
      box.innerHTML = d.pools.map(poolCard).join('');
      box.querySelectorAll('[data-stake]').forEach((b) => b.onclick = () => doStake(b.dataset.stake));
      box.querySelectorAll('[data-unstake]').forEach((b) => b.onclick = () => doUnstake(b.dataset.unstake));
      box.querySelectorAll('[data-claim]').forEach((b) => b.onclick = () => doClaim(b.dataset.claim));
    } catch (e) {}
  }
  function poolCard(p) {
    const you = p.you ? ('<div class="pyou"><span>You: <b class="mono">' + p.you.staked + '</b> staked · <b class="mono">' + p.you.pending + '</b> pending</span>' +
      (p.you.pending > 0 ? '<button class="claim" data-claim="' + p.id + '">Claim</button>' : '') + '</div>') : '';
    return '<div class="pool">' +
      '<div class="ph"><div><div class="pn">' + esc(p.name) + '</div><div class="ptk">$' + esc(p.ticker) + ' · LP pool</div></div>' +
        '<div class="papr"><div class="v">' + p.apr + '%</div><div class="l">APR</div></div></div>' +
      '<div class="prow"><span>Total staked</span><b>' + p.totalStaked + '</b></div>' +
      '<div class="prow"><span>Stakers</span><b>' + p.stakers + '</b></div>' +
      you +
      '<div class="pact"><input id="stk_' + p.id + '" type="text" inputmode="decimal" placeholder="amount $' + esc(p.ticker) + ' LP">' +
        '<button data-stake="' + p.id + '">Stake</button>' +
        (p.you && p.you.staked > 0 ? '<button class="sec" data-unstake="' + p.id + '">Unstake</button>' : '') +
      '</div></div>';
  }
  async function poolPost(url, payload) { try { return await (await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })).json(); } catch (e) { return { error: 'request failed' }; } }
  async function doStake(poolId) {
    if (!isEvm(wallet)) return toast('Connect your Stable-chain wallet first');
    const amt = parseFloat(($('stk_' + poolId) || {}).value); if (!(amt > 0)) return toast('Enter an amount to stake');
    const r = await poolPost('/api/stake', { wallet, poolId, amount: amt });
    if (r.error) return toast(r.error);
    toast('Staked ' + amt + (r.cashback ? ' · +' + r.cashback + ' USDT0 cashback' : '')); loadPools();
  }
  async function doUnstake(poolId) {
    if (!isEvm(wallet)) return toast('Connect your wallet first');
    const amt = parseFloat(($('stk_' + poolId) || {}).value); if (!(amt > 0)) return toast('Enter an amount to unstake');
    const r = await poolPost('/api/unstake', { wallet, poolId, amount: amt });
    if (r.error) return toast(r.error); toast('Unstaked ' + r.returned); loadPools();
  }
  async function doClaim(poolId) {
    if (!isEvm(wallet)) return toast('Connect your wallet first');
    const r = await poolPost('/api/stake/claim', { wallet, poolId });
    if (r.error) return toast(r.error); toast('Claimed ' + r.claimed + ' · +' + r.cashback + ' USDT0 cashback'); loadPools();
  }

  // ---- creator rewards ----
  let BOOST = { dox: 0.5, lock: 0.5, audit: 1.0, multi: 0.5 };
  function renderRewards(r) {
    if (!r || !r.on) return;
    BOOST = { dox: r.boostDox != null ? r.boostDox : 0.5, lock: r.boostLock != null ? r.boostLock : 0.5,
      audit: r.boostAudit != null ? r.boostAudit : 1.0, multi: r.boostMulti != null ? r.boostMulti : 0.5 };
    $('rewards').style.display = 'block'; $('faq').style.display = 'block';
    $('rwTotal').textContent = (r.totalEarned || 0);
    $('rwLaunch').textContent = 'Earn up to ' + r.perLaunch + ' USDT0 per verified launch (×Tech Score). 95/100 ≈ ' + (Math.round(r.perLaunch * 0.95 * 1e4) / 1e4) + ' ETH.';
    $('rwDrip').textContent = 'Keep your site up + repo active → +' + r.perDrip + ' USDT0 each re-check. Abandon it and the drip stops.';
    const maxMult = Math.round((1 + BOOST.dox + BOOST.lock + BOOST.audit + BOOST.multi) * 10) / 10;
    $('bDoxMult').textContent = '+' + BOOST.dox + '×'; $('bLockMult').textContent = '+' + BOOST.lock + '×';
    $('bAuditMult').textContent = '+' + BOOST.audit + '×'; $('bMultiMult').textContent = '+' + BOOST.multi + '×';
    $('tmDox').textContent = '+' + BOOST.dox + '×'; $('tmLock').textContent = '+' + BOOST.lock + '×';
    $('tmAudit').textContent = '+' + BOOST.audit + '×'; $('tmMulti').textContent = '+' + BOOST.multi + '×';
    $('tmMax').textContent = maxMult + '×';
    const hint = $('rewardHint');
    if (hint) { hint.style.display = 'block'; hint.innerHTML = 'Add a wallet to earn <b style="color:var(--vio)">~' + (Math.round(r.perLaunch * 0.95 * 1e4) / 1e4) + ' ETH</b> for a 95-score launch — up to ' + maxMult + '× with trust boosts below.'; }
    updateMult();
  }
  function updateMult() {
    const on = { dox: $('f_dox').checked, lock: $('f_lock').checked, audit: $('f_audit').checked, multi: $('f_multi').checked };
    $('f_doxLink').style.display = on.dox ? 'block' : 'none';
    $('f_lockLink').style.display = on.lock ? 'block' : 'none';
    $('f_auditLink').style.display = on.audit ? 'block' : 'none';
    $('f_multiLink').style.display = on.multi ? 'block' : 'none';
    const m = 1 + (on.dox ? BOOST.dox : 0) + (on.lock ? BOOST.lock : 0) + (on.audit ? BOOST.audit : 0) + (on.multi ? BOOST.multi : 0);
    $('multOut').textContent = (Math.round(m * 10) / 10).toFixed(1) + '×';
  }
  ['f_dox', 'f_lock', 'f_audit', 'f_multi'].forEach((id) => { const el = $(id); if (el) el.addEventListener('change', updateMult); });

  async function vote(id, btn) { try { const d = await (await fetch('/api/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })).json(); if (d.ok) btn.textContent = '▲ ' + d.votes; } catch (e) {} }

  // ---- live ticker availability (tech + meme fields) ----
  function wireTicker(inputId, hintId) {
    let t; const el = $(inputId); if (!el) return;
    el.addEventListener('input', () => {
      clearTimeout(t); const v = el.value.replace(/^\$/, '').toUpperCase(); const h = $(hintId);
      if (!v) { h.textContent = ''; h.className = 'tkhint'; return; }
      t = setTimeout(async () => {
        try { const d = await (await fetch('/api/ticker-check?t=' + encodeURIComponent(v))).json();
          if (d.taken) { h.textContent = '✕ $' + d.ticker + ' is already live — duplicate tickers are banned.'; h.className = 'tkhint bad'; }
          else { h.textContent = '✓ $' + d.ticker + ' is available.'; h.className = 'tkhint ok'; }
        } catch (e) {}
      }, 320);
    });
  }
  wireTicker('f_ticker', 'tkHint'); wireTicker('m_ticker', 'mtkHint');

  // ---- meme PFP: pick → normalize to 512px PNG data URL (deterministic fingerprint input) ----
  let pfpData = '';
  $('pfpDrop').onclick = () => $('m_pfp').click();
  $('pfpDrop').addEventListener('dragover', (e) => e.preventDefault());
  $('pfpDrop').addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) readPfp(f); });
  $('m_pfp').addEventListener('change', () => { const f = $('m_pfp').files && $('m_pfp').files[0]; if (f) readPfp(f); });
  function readPfp(file) {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return toast('PFP must be PNG, JPG, WEBP or GIF');
    const img = new Image();
    img.onload = () => {
      const S = Math.min(512, Math.max(img.width, img.height) || 512);
      const c = document.createElement('canvas'); c.width = S; c.height = S;
      const x = c.getContext('2d');
      // cover-crop to square: the pad's PFPs are square, and re-encoding normalizes
      // the bytes so the same source image always fingerprints identically
      const s = Math.min(img.width, img.height);
      x.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, S, S);
      pfpData = c.toDataURL('image/png');
      if (pfpData.length > 1.4e6) { pfpData = c.toDataURL('image/jpeg', 0.85); }
      $('pfpPrev').src = pfpData; $('pfpPrev').style.display = 'block';
      $('pfpDrop').innerHTML = '<b>✓ PFP loaded</b><br>click to swap it';
    };
    img.onerror = () => toast('Could not read that image');
    img.src = URL.createObjectURL(file);
  }

  // ---- modal + kind switch ----
  const ov = $('ov');
  let kind = 'tech';
  function setKind(k) {
    kind = k;
    $('kindTech').classList.toggle('sel', k === 'tech');
    $('kindMeme').classList.toggle('sel', k === 'meme');
    $('techPanel').style.display = k === 'tech' ? 'block' : 'none';
    $('memePanel').style.display = k === 'meme' ? 'block' : 'none';
    $('verify').style.display = k === 'tech' ? 'block' : 'none';
    const sp = $('spawn');
    sp.className = 'btn ' + (k === 'meme' ? 'meme' : 'tech');
    sp.textContent = k === 'meme' ? '🎭 Launch Meme' : '🛠 Launch Tech';
    sp.style.flex = '1.4';
    $('mTitle').textContent = k === 'meme' ? 'Launch a meme' : 'Launch tech';
    $('mSub').innerHTML = k === 'meme'
      ? 'Instant listing. Two rules: an <b>original PFP</b> (fingerprinted — duplicates rejected) and a <b>unique ticker</b>.'
      : 'Bring a real product. We verify your <b>website</b> + <b>GitHub repo</b>, and your <b>ticker must be unique</b>, before it lists.';
    $('result').className = 'result'; $('checks').style.display = 'none';
  }
  $('kindTech').onclick = () => setKind('tech');
  $('kindMeme').onclick = () => setKind('meme');
  function open(k) { ov.classList.add('show'); setKind(k || 'tech'); }
  function close() { ov.classList.remove('show'); }
  $('openSpawn').onclick = () => open('tech');
  $('heroTech').onclick = () => open('tech');
  $('heroMeme').onclick = () => open('meme');
  document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => open(b.dataset.open)));
  $('close').onclick = close;
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });

  // ---- why modal ----
  const whyOv = $('whyOv');
  $('openWhy').onclick = () => whyOv.classList.add('show');
  $('whyClose').onclick = () => whyOv.classList.remove('show');
  whyOv.addEventListener('click', (e) => { if (e.target === whyOv) whyOv.classList.remove('show'); });
  $('whySpawn').onclick = () => { whyOv.classList.remove('show'); open('tech'); };

  function fields() { return { name: $('f_name').value, ticker: $('f_ticker').value, desc: $('f_desc').value, website: $('f_web').value, github: $('f_gh').value, ca: $('f_ca').value, payoutWallet: $('f_payout').value, doxxed: $('f_dox').checked, doxLink: $('f_doxLink').value, locked: $('f_lock').checked, lockLink: $('f_lockLink').value, audited: $('f_audit').checked, auditLink: $('f_auditLink').value, multisig: $('f_multi').checked, multiLink: $('f_multiLink').value }; }
  function renderChecks(checks) {
    const box = $('checks'); box.style.display = 'block';
    box.innerHTML = checks.map((c) => '<div class="chk"><span class="ic ' + (c.pass ? 'y' : 'n') + '">' + (c.pass ? '✓' : '✕') + '</span>' + esc(c.k) + '<span class="pts">+' + c.pts + '</span></div>').join('');
  }
  function showResult(cls, html) { const r = $('result'); r.className = 'result show ' + cls; r.innerHTML = html; }

  async function verify() {
    const f = fields();
    if (!f.website || !f.github) return showResult('fail', 'Add a website URL and a GitHub repo to verify.');
    $('verify').textContent = 'Verifying…'; $('verify').disabled = true;
    try {
      const d = await (await fetch('/api/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })).json();
      renderChecks(d.checks);
      const col = scoreColor(d.score);
      if (d.tickerTaken) showResult('fail', '✕ $' + esc(d.ticker) + ' is already live — duplicate tickers are banned. Pick another ticker.');
      else if (d.pass) showResult('pass', '✓ Verified — Tech Score <b style="color:' + col + '">' + d.score + '/100</b>, ticker available. Ready to launch.');
      else showResult('fail', '✕ Not yet: ' + (!d.site.ok ? 'website unreachable. ' : '') + (!d.repo.ok ? 'GitHub repo not public (' + esc(d.repo.why || '') + ').' : ''));
    } catch (e) { showResult('fail', 'Verification failed — try again.'); }
    $('verify').textContent = 'Verify'; $('verify').disabled = false;
  }

  async function spawnTech() {
    const f = fields();
    if (!f.name || !f.ticker) return showResult('fail', 'Name and ticker are required.');
    if (!f.website || !f.github) return showResult('fail', 'A live website and a GitHub repo are required to launch tech. (Got a meme instead? Switch to 🎭 Meme above.)');
    $('spawn').textContent = 'Verifying…'; $('spawn').disabled = true;
    try {
      const d = await (await fetch('/api/spawn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })).json();
      if (d.checks) renderChecks(d.checks);
      if (d.ok) {
        const mult = (d.mult > 1) ? ' at <b>' + d.mult + '×</b> trust boost' : '';
        const reward = (d.rewardsOn && d.reward > 0) ? ' <b style="color:var(--vio)">+' + d.reward + ' ETH</b> creator reward' + (d.cashback ? ' + ' + d.cashback + ' cashback' : '') + mult : '';
        showResult('pass', '🚀 <b>' + esc(d.project.name) + '</b> launched with Tech Score <b>' + d.project.score + '/100</b>! Its LP staking pool is live.' + reward);
        loadBoard(); loadPools(); setTimeout(close, reward ? 2800 : 1600);
        ['f_name', 'f_ticker', 'f_desc', 'f_web', 'f_gh', 'f_ca', 'f_payout', 'f_doxLink', 'f_lockLink', 'f_auditLink', 'f_multiLink'].forEach((i) => ($(i).value = ''));
        ['f_dox', 'f_lock', 'f_audit', 'f_multi'].forEach((i) => ($(i).checked = false)); updateMult(); $('tkHint').textContent = '';
      } else showResult('fail', '✕ ' + esc(d.error || 'could not launch'));
    } catch (e) { showResult('fail', 'Launch failed — try again.'); }
    $('spawn').textContent = '🛠 Launch Tech'; $('spawn').disabled = false;
  }

  async function spawnMeme() {
    const name = $('m_name').value, ticker = $('m_ticker').value;
    if (!name || !ticker) return showResult('fail', 'Name and ticker are required.');
    if (!pfpData) return showResult('fail', 'Upload a PFP — it\'s the one thing a meme needs.');
    $('spawn').textContent = 'Launching…'; $('spawn').disabled = true;
    try {
      const d = await (await fetch('/api/spawn', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'meme', name, ticker, desc: $('m_desc').value, ca: $('m_ca').value, payoutWallet: $('m_payout').value, pfp: pfpData }) })).json();
      if (d.ok) {
        showResult('pass', '🎭 <b>$' + esc(d.project.ticker) + '</b> is live! PFP fingerprinted, ticker locked, LP staking pool open.');
        loadBoard(); loadPools(); setTimeout(close, 1800);
        ['m_name', 'm_ticker', 'm_desc', 'm_ca', 'm_payout'].forEach((i) => ($(i).value = ''));
        pfpData = ''; $('pfpPrev').style.display = 'none';
        $('pfpDrop').innerHTML = '<b>Upload your PFP</b><br>PNG · JPG · WEBP · GIF, up to ~1MB<br>click or drop it here';
        $('mtkHint').textContent = '';
      } else showResult('fail', '✕ ' + esc(d.error || 'could not launch'));
    } catch (e) { showResult('fail', 'Launch failed — try again.'); }
    $('spawn').textContent = '🎭 Launch Meme'; $('spawn').disabled = false;
  }
  $('verify').onclick = verify;
  $('spawn').onclick = () => (kind === 'meme' ? spawnMeme() : spawnTech());

  // ---- AI co-builder ----
  document.querySelectorAll('.mode').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.mode').forEach((x) => x.classList.toggle('sel', x === b));
    const ai = b.dataset.mode === 'ai';
    $('aiPanel').style.display = ai ? 'block' : 'none';
    $('havePanel').style.display = ai ? 'none' : 'block';
  }));
  $('aiBuild').onclick = async () => {
    const idea = $('f_idea').value.trim();
    if (!idea) return showResult('fail', 'Describe your idea in one line.');
    $('aiBuild').textContent = 'Building… (~20s)'; $('aiBuild').disabled = true;
    try {
      const d = await (await fetch('/api/ai/build', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idea }) })).json();
      if (!d.ok) showResult('fail', '✕ ' + esc(d.error || 'build failed'));
      else renderKit(d);
    } catch (e) { showResult('fail', 'Build failed — try again.'); }
    $('aiBuild').textContent = '✨ Build it with AI'; $('aiBuild').disabled = false;
  };
  function renderKit(d) {
    const k = d.kit;
    $('f_name').value = k.name || ''; $('f_ticker').value = k.ticker || ''; $('f_desc').value = k.description || '';
    $('f_web').value = d.previewUrl || ''; $('f_gh').value = d.repo || '';
    const tags = (k.taglines || []).slice(0, 3).map((t) => '<span class="ktag">' + esc(t) + '</span>').join('');
    const links = '<a class="klink" href="' + esc(d.previewUrl) + '" target="_blank" rel="noopener">live preview ↗</a>' +
      (d.repo ? '<a class="klink" href="' + esc(d.repo) + '" target="_blank" rel="noopener">github ↗</a>' : '<span class="klink" style="color:var(--amb)">↓ add a GitHub repo below to launch</span>');
    $('aiOut').innerHTML = '<div class="kit"><div class="kn">' + esc(k.name) + ' <span class="kt">$' + esc(k.ticker) + '</span></div>' +
      '<div class="kp">' + esc(k.pitch || k.description) + '</div><div>' + tags + '</div><div class="klinks">' + links + '</div></div>';
    showResult('pass', '✓ Kit generated — ' + (d.repoCreated ? 'site hosted + repo created.' : 'site hosted.') + ' Review &amp; Launch below.');
  }

  loadBoard(); loadPools();
  setInterval(loadBoard, 15000); setInterval(loadPools, 15000);
})();
