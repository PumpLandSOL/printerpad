'use strict';
// MoonPad brand-kit generator (v4 aesthetic: c0mpute-style black void + Robinhood green,
// pixel moon-as-O wordmark, halftone dither clouds, mono type). Writes one self-contained
// HTML per asset into _studio/out/, then render.js rasterizes each to the Desktop.
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">`;

const BASE = `
:root{--bg:#040604;--deep:#000;--ink:#eefaf0;--sub:#9fb8a6;--mut:#5d7263;--line:rgba(238,250,240,.1);--line2:rgba(238,250,240,.22);
  --card:#0a0e0a;--card2:#101610;--grn:#00e05a;--amb:#baff3f;--red:#ff5566}
*{margin:0;padding:0;box-sizing:border-box}
html,body{font-family:'JetBrains Mono',ui-monospace,monospace;color:var(--ink);background:var(--bg);overflow:hidden;-webkit-font-smoothing:antialiased}
.stage{position:relative;overflow:hidden;background:var(--bg)}
.px{font-family:'Press Start 2P',monospace;font-weight:400}
.dither{position:absolute;pointer-events:none;background-image:radial-gradient(circle,rgba(0,224,90,.55) 1px,transparent 1.4px);background-size:8px 8px;opacity:.32}
.dither.w{background-image:radial-gradient(circle,rgba(238,250,240,.5) 1px,transparent 1.4px);background-size:9px 9px;opacity:.2}
`;

// the pixel crescent moon (site logo)
function moon(size, fill) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" shape-rendering="crispEdges" style="image-rendering:pixelated;filter:drop-shadow(0 0 ${Math.round(size * .12)}px rgba(0,224,90,.5))" xmlns="http://www.w3.org/2000/svg"><g fill="${fill || '#00e05a'}"><rect x="8" y="1" width="9" height="2"/><rect x="5" y="3" width="6" height="2"/><rect x="4" y="5" width="4" height="2"/><rect x="3" y="7" width="4" height="2"/><rect x="2" y="9" width="4" height="6"/><rect x="3" y="15" width="4" height="2"/><rect x="4" y="17" width="4" height="2"/><rect x="5" y="19" width="6" height="2"/><rect x="8" y="21" width="9" height="2"/><rect x="15" y="3" width="3" height="2"/><rect x="17" y="5" width="2" height="2"/><rect x="18" y="7" width="2" height="2"/><rect x="15" y="19" width="3" height="2"/><rect x="17" y="17" width="2" height="2"/><rect x="18" y="15" width="2" height="2"/></g></svg>`;
}
// wordmark lockup: M[moon]ONPAD
function wordmark(fontPx) {
  return `<div style="display:flex;align-items:center;justify-content:center;gap:${Math.round(fontPx * .12)}px" class="px">
    <span style="font-size:${fontPx}px">M</span>${moon(Math.round(fontPx * 1.16))}<span style="font-size:${fontPx}px">ONPAD</span></div>`;
}
const chip = (t, c) => `<span style="display:inline-flex;align-items:center;font-family:'JetBrains Mono',monospace;font-size:26px;font-weight:700;color:${c || 'var(--grn)'};background:var(--card);border:1px solid var(--line2);border-radius:999px;padding:13px 28px;letter-spacing:.04em">${t}</span>`;
const dithers = `
  <div class="dither" style="top:-4%;right:-6%;width:52%;height:46%;-webkit-mask-image:radial-gradient(60% 60% at 70% 30%,#000,transparent 72%);mask-image:radial-gradient(60% 60% at 70% 30%,#000,transparent 72%)"></div>
  <div class="dither w" style="top:34%;left:-8%;width:40%;height:52%;-webkit-mask-image:radial-gradient(55% 55% at 30% 50%,#000,transparent 70%);mask-image:radial-gradient(55% 55% at 30% 50%,#000,transparent 70%)"></div>
  <div class="dither" style="bottom:-8%;right:6%;width:56%;height:50%;background-size:7px 7px;opacity:.24;-webkit-mask-image:radial-gradient(60% 55% at 60% 70%,#000,transparent 72%);mask-image:radial-gradient(60% 55% at 60% 70%,#000,transparent 72%)"></div>`;

function page(w, h, css, inner) {
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE}
  .stage{width:${w}px;height:${h}px}${css}</style></head>
  <body><div class="stage">${dithers}${inner}</div></body></html>`;
}

const assets = {};

// 1) PFP 2000² — the moon in the void
assets['moonpad-pfp'] = page(2000, 2000, `
  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:70px}
  .tick{font-size:64px;font-weight:700;color:var(--grn);letter-spacing:.06em}
  .tag{font-size:42px;color:var(--sub)}`,
  `<div class="wrap">
     ${moon(760)}
     ${wordmark(120)}
     <div style="text-align:center">
       <div class="tick">$MOON</div>
       <div class="tag" style="margin-top:26px">the launchpad on Robinhood Chain</div>
     </div>
   </div>`);

// 2) BANNER 3000×1000 — centered lockup (X avatar sits bottom-left)
assets['moonpad-banner'] = page(3000, 1000, `
  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:44px}
  .tag{font-size:38px;color:var(--sub)}
  .tag b{color:var(--ink);font-weight:700}
  .row{display:flex;gap:16px}
  .dom{font-size:30px;font-weight:700;color:var(--grn);letter-spacing:.08em}`,
  `<div class="wrap">
     ${wordmark(110)}
     <div class="tag">Launch <b style="color:var(--grn)">tech</b>. Launch <b style="color:var(--amb)">memes</b>. Get paid either way.</div>
     <div class="row">${chip('LP STAKING · EVERY COIN')}${chip('CASHBACK ON EVERYTHING', 'var(--amb)')}${chip('0 DUPLICATES ALLOWED')}</div>
     <div class="dom">moonpadrh.com · $MOON · @MoonPadRH</div>
   </div>`);

// 3) KEYART 2400×1350 — the landing IS the keyart
assets['moonpad-keyart'] = page(2400, 1350, `
  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px}
  .tag{font-size:34px;color:var(--sub)}
  .tag b{font-weight:700}
  .claim{display:flex;gap:16px;width:1050px}
  .cin{flex:1;display:flex;align-items:center;background:rgba(10,14,10,.85);border:2px solid var(--line2);border-radius:22px;padding:0 32px;gap:14px}
  .cin .dol{color:var(--mut);font-size:36px;font-weight:700}
  .cin .ph{font-size:34px;color:var(--mut);padding:30px 0}
  .cin .cur{display:inline-block;width:4px;height:44px;background:var(--grn);margin-left:4px;vertical-align:middle}
  .go{background:var(--grn);color:#02120a;border-radius:22px;padding:0 44px;font-size:34px;font-weight:700;display:flex;align-items:center}
  .hint{font-size:26px;color:var(--grn)}
  .sub{font-size:25px;color:var(--mut);max-width:1000px;text-align:center;line-height:1.8}
  .sub b{color:var(--sub)}
  .scroll{position:absolute;bottom:44px;left:50%;transform:translateX(-50%);font-size:20px;letter-spacing:.34em;color:var(--mut);font-weight:700;text-align:center}`,
  `<div class="wrap">
     ${wordmark(96)}
     <div class="tag">Launch <b style="color:var(--grn)">tech</b>. Launch <b style="color:var(--amb)">memes</b>. Get paid either way.</div>
     <div class="claim"><div class="cin"><span class="dol">$</span><span class="ph">claim your ticker</span><span class="cur"></span></div><div class="go">Launch ▶</div></div>
     <div class="hint">✓ one ticker, one coin — duplicates are banned</div>
     <div class="sub">A launchpad on <b>Robinhood Chain</b> where verified tech earns the highest creator rewards,
       memes need an original PFP, and every coin gets an LP staking pool + cashback. <b style="color:var(--grn)">$MOON</b> powers the pad.</div>
     <div class="scroll">MOONPADRH.COM<br><span style="letter-spacing:0">↓</span></div>
   </div>`);

// 4) FEATURES 2400×1350 — six power-ups
const feat = (icon, t, d, lime, badge) => `<div style="background:var(--card);border:1px solid ${lime ? 'rgba(186,255,63,.3)' : 'rgba(0,224,90,.3)'};border-radius:20px;padding:34px 32px;position:relative">
  ${badge ? `<span class="px" style="position:absolute;top:20px;right:20px;font-size:9px;color:#02120a;background:${lime ? 'var(--amb)' : 'var(--grn)'};border-radius:999px;padding:8px 12px">${badge}</span>` : ''}
  <div style="width:66px;height:66px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:32px;background:${lime ? 'rgba(186,255,63,.08)' : 'rgba(0,224,90,.08)'};border:1px solid ${lime ? 'rgba(186,255,63,.25)' : 'rgba(0,224,90,.25)'}">${icon}</div>
  <div style="font:700 27px 'Inter',sans-serif;margin:20px 0 12px">${t}</div>
  <div style="font-size:19.5px;color:var(--sub);line-height:1.65">${d}</div></div>`;
assets['moonpad-features'] = page(2400, 1350, `
  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 100px;gap:40px}
  .head{text-align:center}
  .eyebrow{font-family:'Press Start 2P',monospace;font-size:15px;color:var(--grn);letter-spacing:.2em;margin-bottom:22px}
  .h{font:700 62px 'Inter',sans-serif;letter-spacing:-1px}
  .grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:22px}
  .foot{font-size:22px;color:var(--mut);text-align:center;letter-spacing:.04em}`,
  `<div class="wrap">
     <div class="head"><div class="eyebrow">▚ POWER-UPS ▞</div><div class="h">The launchpad that pays.</div></div>
     <div class="grid">
       ${feat('🌊', 'LP staking pools', 'Every coin — tech or meme — launches with its own staking pool.', false, 'FIRST ON ROBINHOOD')}
       ${feat('💰', 'Highest creator rewards', 'Verified tech earns <b style="color:var(--grn)">ETH</b> at the gate, ×Tech Score, up to 3.5× with trust boosts.')}
       ${feat('🔁', 'Cashback on everything', 'Launches and staking pay <b style="color:var(--amb)">10% back</b> to your wallet.', true)}
       ${feat('🎭', 'Original PFPs only', 'Every meme image is fingerprinted — copycat art is rejected on the spot.', true, 'MEMES WELCOME')}
       ${feat('🚫', 'Duplicate tickers banned', 'One symbol, one coin, across the whole pad. No PvP, no impersonation.')}
       ${feat('🤖', 'AI co-builder', 'One-line idea → hosted site + real GitHub repo in minutes. Instantly gate-ready.')}
     </div>
     <div class="foot">moonpadrh.com · $MOON · the launchpad on Robinhood Chain</div>
   </div>`);

// 5) VS 2400×1350 — every launchpad on Robinhood, one pays you back
const vrow = (k, sub, mp, a, b, c) => `<tr>
  <td class="k"><b>${k}</b><span>${sub}</span></td>
  <td class="mp">✓ ${mp}</td><td class="o">${a}</td><td class="o">${b}</td><td class="o">${c}</td></tr>`;
assets['moonpad-vs'] = page(2400, 1350, `
  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 90px;gap:30px}
  .head{text-align:center}
  .eyebrow{font-family:'Press Start 2P',monospace;font-size:13px;color:var(--grn);letter-spacing:.18em;margin-bottom:20px}
  .h{font:700 56px 'Inter',sans-serif;letter-spacing:-1px}
  .h b{color:var(--grn)}
  table{width:100%;border-collapse:separate;border-spacing:0 10px}
  th{font-size:20px;font-weight:700;text-align:left;padding:4px 20px;color:var(--mut)}
  th.mp{color:var(--grn)}
  td{padding:17px 20px;font-size:19px;line-height:1.45;vertical-align:middle;background:var(--card)}
  td.k{width:26%;border:1px solid var(--line);border-right:none;border-radius:14px 0 0 14px}
  td.k b{display:block;font:700 20px 'Inter',sans-serif;color:var(--ink)}
  td.k span{font-size:15px;color:var(--mut)}
  td.mp{width:28%;color:var(--ink);background:rgba(0,224,90,.07);border:1px solid rgba(0,224,90,.35);border-left:none;border-right:none;font-weight:500}
  td.o{width:15.3%;color:#5b6b60;border:1px solid var(--line);border-left:none;border-right:none;font-size:16.5px}
  td.o:last-child{border-right:1px solid var(--line);border-radius:0 14px 14px 0}
  .foot{font-size:19px;color:var(--mut);text-align:center}`,
  `<div class="wrap">
     <div class="head"><div class="eyebrow">▚ THE FIELD ▞</div>
       <div class="h">Every launchpad on Robinhood. <b>One pays you back.</b></div></div>
     <table>
       <tr><th></th><th class="mp">MOONPAD</th><th>fun.noxa.fi</th><th>pons.family</th><th>flap.sh</th></tr>
       ${vrow('Verified tech', 'site + repo, scored 0–100', 'hard gate, Tech Score', '✕ none', '✕ none', '✕ none')}
       ${vrow('Duplicate tickers', 'one symbol, one coin', 'banned at launch', '✕ allowed', '✕ dupes live on the board', '✕ allowed')}
       ${vrow('Duplicate PFPs', 'image fingerprinted', 'blocked, not just flagged', '✕ allowed', '✕ allowed', '~ flags only')}
       ${vrow('LP staking', 'a pool for every coin', 'first on Robinhood Chain', '✕ none', '✕ none', '✕ none')}
       ${vrow('Creator rewards', 'paid for shipping', 'ETH ×Tech Score · 3.5× boosts + drip', '~ trade fees only', '~ trade fees only', '~ trade fees only')}
       ${vrow('Cashback', 'on launches + staking', '10% back to your wallet', '✕ never', '✕ never', '✕ never')}
     </table>
     <div class="foot">as observed Jul 20, 2026 · rewards &amp; staking are a simulated ledger, no custody · moonpadrh.com · $MOON</div>
   </div>`);

for (const [name, html] of Object.entries(assets)) {
  fs.writeFileSync(path.join(OUT, name + '.html'), html);
  console.log('wrote', name + '.html');
}
