import { useState, useEffect, useCallback, useRef } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useYouTubeContext } from "./context/YouTubeContext";
import { isSupabaseConfigured } from "./lib/supabase";
import {
  fetchBrandsWithChannels,
  createBrand as dbCreateBrand,
  deleteBrand as dbDeleteBrand,
  addChannelToBrand as dbAddChannelToBrand,
  removeChannelFromBrand as dbRemoveChannelFromBrand,
  toggleChannelActive as dbToggleChannelActive,
  fetchLastSyncTime,
  ck, pk,
} from "./lib/supabaseDb";
import { hasInstagramTokens, getInstagramHandles } from "./lib/instagramApi";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500;600&display=swap');`;

const css = `
* { box-sizing: border-box; margin: 0; padding: 0; }
.app, .app * { cursor: default; user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; }
.app input, .app textarea, .app select { cursor: text; user-select: text; -webkit-user-select: text; -moz-user-select: text; -ms-user-select: text; }
.app button, .app .nav-item, .app .brand-item, .app .ibtn, .app .tbtn, .app .bcard, .app .pcard, .app .ptab, .app .addbtn, .app .pact, .app a.ibtn { cursor: pointer; }
:root {
  --bg: #080808; --surface: #111111; --surface2: #181818;
  --border: #1e1e1e; --border2: #2e2e2e;
  --text: #f5f2ed; --text2: #d8d4ce; --text3: #b0ada8;
  --red: #d63031; --red-dim: rgba(214,48,49,0.1); 
  --green: #00b894; --green-dim: rgba(0,184,148,0.1);
  --mono: 'DM Mono', monospace; --sans: 'DM Sans', sans-serif; --display: 'Bebas Neue', sans-serif;
}
.app { font-family: var(--sans); background: var(--bg); min-height: 100vh; color: var(--text); display: flex; font-size: 14px; }
.sidebar { width: 216px; min-height: 100vh; background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; flex-shrink: 0; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
.logo-area { padding: 22px 18px 18px; border-bottom: 1px solid var(--border); }
.logo-text { font-family: var(--display); font-size: 28px; letter-spacing: 3px; line-height: 1.2; color: var(--text); cursor: default; user-select: none; }
.nav-sec { padding: 12px 0; border-bottom: 1px solid var(--border); }
.nav-lbl { font-family: var(--display); font-size: 20px; color: var(--text); letter-spacing: 2px; padding: 0 18px 8px; text-transform: uppercase; cursor: default; user-select: none; }
.nav-item { display: flex; align-items: center; gap: 9px; padding: 8px 18px; cursor: pointer; font-size: 14px; color: var(--text2); transition: all .12s; position: relative; }
.nav-item:hover { color: var(--text); background: var(--surface2); }
.nav-item.act { color: var(--text); background: var(--surface2); }
.nav-item.act::before { content:''; position:absolute; left:0; top:0; bottom:0; width:2px; background:var(--red); }
.nav-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.brand-item { display:flex; align-items:center; gap:9px; padding:7px 18px; cursor:pointer; font-size:13px; color:var(--text2); transition:all .12s; }
.brand-item:hover { color:var(--text); background:var(--surface2); }
.brand-item.act { color:var(--text); }
.b-avatar { width:22px; height:22px; border-radius:3px; display:flex; align-items:center; justify-content:center; font-family:var(--display); font-size:11px; flex-shrink:0; }
.rbadge { background:var(--red); color:white; font-family:var(--mono); font-size:8px; padding:1px 4px; border-radius:2px; margin-left:auto; }
.dbadge { background:#1a1a1a; color:var(--text3); font-family:var(--mono); font-size:8px; padding:1px 4px; border-radius:2px; margin-left:auto; }
.main { flex:1; overflow-x:hidden; overflow-y:auto; min-width:0; height:100vh; }
.topbar { height:48px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; padding:0 24px; background:var(--surface); position:sticky; top:0; z-index:10; }
.topbar-title { font-family:var(--display); font-size:20px; letter-spacing:2px; color:var(--text); cursor:default; user-select:none; }
.tr { display:flex; align-items:center; gap:10px; }
.tpill { display:flex; background:var(--surface2); border:1px solid var(--border2); border-radius:3px; overflow:hidden; }
.tbtn { font-family:var(--mono); font-size:11px; padding:6px 12px; cursor:pointer; color:var(--text2); border:none; background:transparent; transition:all .12s; }
.tbtn.act { background:var(--red); color:white; }
.ibtn { font-family:var(--mono); font-size:10px; padding:5px 12px; background:transparent; border:1px solid var(--border2); color:var(--text2); border-radius:3px; cursor:pointer; transition:all .12s; }
.ibtn:hover { color:var(--text); border-color:var(--text3); }
.ibtn.primary { background:var(--red); border-color:var(--red); color:white; }
.ibtn.danger { color:#e17055; border-color:rgba(225,112,85,.25); }
.ibtn.danger:hover { background:rgba(225,112,85,.1); }
.page { padding:16px 24px; }
.page-fit { display:flex; flex-direction:column; height:calc(100vh - 48px); overflow:hidden; }
.page-fit > * { flex-shrink:0; }
.page-fit .bgrid { flex:1; min-height:0; overflow-y:auto; align-content:start; }
.krow { display:grid; gap:1px; background:var(--border); border:1px solid var(--border); border-radius:5px; overflow:hidden; margin-bottom:12px; }
.kcard { background:var(--surface); padding:16px 20px; }
.klbl { font-family:var(--mono); font-size:11px; color:var(--text2); letter-spacing:2px; text-transform:uppercase; margin-bottom:6px; }
.kval { font-family:var(--display); font-size:64px; letter-spacing:1px; line-height:1; color:var(--text); }
.ksub { font-family:var(--mono); font-size:10px; color:var(--text2); margin-top:3px; }
.kchg { font-family:var(--mono); font-size:9px; margin-top:3px; }
.up { color:var(--green); } .dn { color:var(--red); }
.g3 { display:grid; grid-template-columns:2fr 1fr 1fr; gap:12px; margin-bottom:12px; height:340px; flex-shrink:0; }
.panel { background:var(--surface); border:1px solid var(--border); border-radius:5px; padding:14px 16px; overflow:hidden; min-height:0; }
.ph { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
.ptitle { font-family:var(--display); font-size:14px; letter-spacing:2px; color:var(--text); cursor:default; user-select:none; }
.pact { font-family:var(--mono); font-size:9px; color:var(--text3); cursor:pointer; }
.alert { background:var(--red-dim); border:1px solid var(--red); border-radius:5px; padding:12px 16px; margin-bottom:18px; display:flex; align-items:center; gap:12px; }
.alert-txt { font-size:12px; flex:1; }
.alert-txt strong { color:var(--red); }
.bgrid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:10px; }
.bcard { background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:10px 12px; cursor:pointer; transition:all .18s; position:relative; overflow:hidden; }
.bcard:hover { border-color:var(--border2); transform:translateY(-1px); }
.bcard.dead { opacity:.4; cursor:default; }
.bcard-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
.bcard-name { font-family:var(--display); font-size:16px; letter-spacing:1px; }
.bstatus { font-family:var(--mono); font-size:7px; padding:2px 5px; border-radius:2px; text-transform:uppercase; letter-spacing:1px; }
.s-active { background:var(--green-dim); color:var(--green); }
.s-dead { background:var(--red-dim); color:var(--red); }
.bstats { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
.mstat-val { font-family:var(--display); font-size:17px; }
.mstat-lbl { font-family:var(--mono); font-size:7px; color:var(--text3); letter-spacing:1px; text-transform:uppercase; margin-top:1px; }
.ptabs { display:flex; border-bottom:1px solid var(--border); margin-bottom:18px; }
.ptab { font-family:var(--mono); font-size:11px; letter-spacing:1px; padding:9px 18px; cursor:pointer; color:var(--text2); border-bottom:2px solid transparent; margin-bottom:-1px; transition:all .12s; display:flex; align-items:center; gap:7px; }
.ptab:hover { color:var(--text); }
.ptab.act { color:var(--text); border-bottom-color:var(--red); }
.pgrid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
.pcard { background:var(--surface2); border:1px solid var(--border); border-radius:4px; overflow:hidden; cursor:pointer; transition:all .12s; }
.pcard:hover { border-color:var(--border2); }
.pcard.ba { border-color:rgba(214,48,49,.35); }
.pthumb { height:100px; background:#161616; display:flex; align-items:center; justify-content:center; font-size:26px; position:relative; overflow:hidden; }
.bab { position:absolute; top:5px; right:5px; background:var(--red); font-family:var(--mono); font-size:7px; padding:2px 4px; border-radius:2px; color:white; }
.pbody { padding:9px 10px; }
.pcap { font-size:10px; color:var(--text2); margin-bottom:6px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.pvbig { font-family:var(--display); font-size:17px; color:var(--text); }
.psr { display:flex; gap:8px; margin-top:5px; }
.pst { font-family:var(--mono); font-size:9px; color:var(--text3); display:flex; align-items:center; gap:2px; }
.pst span { color:var(--text2); }
.arow { display:flex; align-items:center; gap:10px; padding:12px 14px; background:var(--surface); border:1px solid var(--border); border-radius:4px; margin-bottom:5px; }
.picon { width:28px; height:28px; border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:13px; flex-shrink:0; }
.pig { background:linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045); }
.pyt { background:#ff0000; }
.ptt { background:#010101; border:1px solid #2a2a2a; }
.ainfo { flex:1; }
.ahandle { font-size:12px; font-weight:500; }
.atag { font-family:var(--mono); font-size:9px; color:var(--text3); margin-top:1px; }
.ameta { font-family:var(--mono); font-size:9px; color:var(--text3); text-align:right; line-height:1.6; }
.aacts { display:flex; gap:5px; }
.addbtn { display:flex; align-items:center; gap:7px; padding:10px 14px; border:1px dashed var(--border2); border-radius:4px; cursor:pointer; font-family:var(--mono); font-size:10px; color:var(--text3); transition:all .12s; margin-bottom:5px; }
.addbtn:hover { border-color:var(--text3); color:var(--text2); }
.ovrl { position:fixed; inset:0; background:rgba(0,0,0,.85); z-index:100; display:flex; align-items:center; justify-content:center; }
.modal { background:var(--surface); border:1px solid var(--border2); border-radius:7px; padding:26px; width:440px; }
.mtitle { font-family:var(--display); font-size:21px; letter-spacing:1px; margin-bottom:4px; }
.msub { font-size:11px; color:var(--text3); margin-bottom:18px; }
.fg { margin-bottom:12px; }
.flbl { font-family:var(--mono); font-size:9px; color:var(--text3); letter-spacing:2px; text-transform:uppercase; margin-bottom:5px; display:block; }
.finput, .fselect { width:100%; background:var(--surface2); border:1px solid var(--border2); border-radius:3px; padding:9px 11px; color:var(--text); font-family:var(--sans); font-size:12px; outline:none; }
.finput:focus, .fselect:focus { border-color:var(--text3); }
.macts { display:flex; gap:7px; justify-content:flex-end; margin-top:18px; }
.divider { height:1px; background:var(--border); margin:18px 0; }
.chip { font-family:var(--mono); font-size:8px; padding:2px 5px; border-radius:2px; }
.cig { background:rgba(131,58,180,.2); color:#c77dff; }
.cyt { background:rgba(255,0,0,.15); color:#ff6b6b; }
.ctt { background:rgba(255,255,255,.07); color:#888; }
.cg { background:var(--green-dim); color:var(--green); }
.cr { background:var(--red-dim); color:var(--red); }
.cig-insta { background:rgba(225,48,108,.2); color:#E1306C; }
.hdot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
.hg { background:var(--green); box-shadow:0 0 5px var(--green); }
.hr { background:var(--red); box-shadow:0 0 5px var(--red); }
.hd { background:#333; }
.avgline { display:flex; align-items:center; gap:7px; font-family:var(--mono); font-size:9px; color:var(--text3); margin-bottom:10px; }
.albar { flex:1; height:1px; background:rgba(214,48,49,.3); }
.stitle { font-family:var(--display); font-size:20px; letter-spacing:1px; margin-bottom:3px; color:var(--text); cursor:default; user-select:none; }
.sdesc { font-size:12px; color:var(--text2); margin-bottom:12px; cursor:default; }
.sh { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.sht { font-family:var(--display); font-size:18px; letter-spacing:1px; color:var(--text); cursor:default; user-select:none; }
.ct { font-family:var(--mono); font-size:8px; }

@media (max-height: 800px) {
  .kval { font-size: 42px; }
  .kcard { padding: 10px 14px; }
  .klbl { font-size: 9px; margin-bottom: 3px; }
  .ksub { font-size: 8px; }
  .g3 { height: 280px; gap: 8px; margin-bottom: 8px; }
  .krow { margin-bottom: 8px; }
  .page { padding: 10px 16px; }
  .topbar { height: 40px; }
}

@media (max-height: 660px) {
  .kval { font-size: 32px; }
  .kcard { padding: 8px 10px; }
  .g3 { height: 220px; }
}

@media (max-width: 1200px) {
  .kval { font-size: 48px; }
  .bgrid { grid-template-columns: repeat(2, 1fr); }
  .pgrid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 900px) {
  .kval { font-size: 36px; }
  .g3 { grid-template-columns: 1fr; height: auto; min-height: auto; }
  .bgrid { grid-template-columns: 1fr; }
  .pgrid { grid-template-columns: repeat(2, 1fr); }
}
`;

const fmt = n => {
  if (typeof n === "string") return n;
  if (n >= 1000000) return (n/1000000).toFixed(1)+"M";
  if (n >= 1000) return (n/1000).toFixed(1)+"K";
  return String(n);
};
const fmtNum = n => {
  if (typeof n === "string") return n;
  const v = Math.round(Number(n) || 0);
  return v.toLocaleString();
};

const TTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{background:"#1a1a1a",border:"1px solid #2e2e2e",borderRadius:3,padding:"7px 10px",fontFamily:"DM Mono",fontSize:10,color:"#f0ede8"}}>
      <div style={{color:"#555",marginBottom:3,fontSize:9}}>{label}</div>
      {payload.map(p => <div key={p.name} style={{color:p.color,marginBottom:1}}>{p.name}: {fmt(p.value)}</div>)}
    </div>
  );
};

const platEmoji = {youtube:"▶️",tiktok:"🎵"};
const getFollowers = (c) => (c?.platform?.followers ?? c?.channel?.subscribers ?? 0) || 0;
const platColors = {youtube:"#ff6b6b",tiktok:"#69c9d0"};

const fbGradients = [
  "linear-gradient(135deg,#d63031,#e17055)","linear-gradient(135deg,#6c5ce7,#a29bfe)",
  "linear-gradient(135deg,#00b894,#55efc4)","linear-gradient(135deg,#0984e3,#74b9ff)",
  "linear-gradient(135deg,#fdcb6e,#e17055)","linear-gradient(135deg,#e84393,#fd79a8)",
];
const hashStr = (s) => { let h = 0; for (let i = 0; i < (s||"").length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return Math.abs(h); };

function Pfp({ src, srcs, size = 28, fallback, name }) {
  const allSrcs = srcs || (src ? [src] : []);
  const [failed, setFailed] = useState(new Set());
  const activeSrc = allSrcs.find((s, i) => s && !failed.has(i));
  const fb = fallback || (name ? name[0].toUpperCase() : "?");
  const grad = fbGradients[hashStr(name || fb) % fbGradients.length];
  const s = { width: size, height: size, borderRadius: 4, objectFit: "cover", flexShrink: 0 };
  return (
    <div style={{ width: size, height: size, flexShrink: 0 }}>
      {activeSrc ? (
        <img src={activeSrc} alt="" style={s} referrerPolicy="no-referrer" onError={() => setFailed(prev => new Set(prev).add(allSrcs.indexOf(activeSrc)))}/>
      ) : (
        <div style={{ display: "flex", width: size, height: size, borderRadius: 4, alignItems: "center", justifyContent: "center", fontFamily: "var(--display)", fontSize: Math.max(9, size * 0.45), letterSpacing: 1, color: "#fff", background: grad }}>{fb}</div>
      )}
    </div>
  );
}

const digitSpinKeyframes = `@keyframes digitRoll{0%{transform:translateY(0)}100%{transform:translateY(-10em)}}`;
function DigitSlot({ digit, spinning, delay }) {
  const d = Math.min(9, Math.max(0, digit));
  return (
    <span style={{ display: "inline-block", overflow: "hidden", height: "1em", lineHeight: 1, verticalAlign: "bottom" }}>
      <span
        style={{
          display: "flex",
          flexDirection: "column",
          transform: spinning ? undefined : `translateY(-${d}em)`,
          animation: spinning ? `digitRoll 0.08s linear infinite` : "none",
          animationDelay: delay ? `${delay}ms` : undefined,
        }}
      >
        {[0,1,2,3,4,5,6,7,8,9].map(n => <span key={n} style={{ height: "1em", display: "block", textAlign: "center" }}>{n}</span>)}
      </span>
    </span>
  );
}
function RollingNumber({ value, spinning, format = "full", magnitude }) {
  const num = Math.round(Number(value) || 0);
  const targetStr = format === "short" ? fmt(num) : fmtNum(num);
  const [displayNum, setDisplayNum] = useState(0);
  const rafRef = useRef();
  useEffect(() => {
    if (spinning) {
      const mag = magnitude ?? Math.pow(10, Math.max(0, Math.floor(Math.log10(num + 1))));
      const id = setInterval(() => setDisplayNum(Math.floor(Math.random() * mag)), 80);
      return () => clearInterval(id);
    }
  }, [spinning, magnitude, num]);
  useEffect(() => {
    if (spinning) return;
    const start = 0;
    const end = num;
    const duration = 600;
    const startTime = performance.now();
    const tick = (t) => {
      const elapsed = t - startTime;
      const p = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - p, 2);
      setDisplayNum(Math.round(start + (end - start) * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [spinning, num]);
  const displayStr = format === "short" ? fmt(displayNum) : fmtNum(displayNum);
  if (spinning) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", fontVariantNumeric: "tabular-nums" }}>
        <style>{digitSpinKeyframes}</style>
        {displayStr.split("").map((c, i) => {
          const d = parseInt(c, 10);
          if (c === "," || c === "." || isNaN(d)) return <span key={i}>{c}</span>;
          return <DigitSlot key={i} digit={d} spinning delay={i * 15} />;
        })}
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", fontVariantNumeric: "tabular-nums" }}>
      <style>{digitSpinKeyframes}</style>
      {displayStr.split("").map((c, i) => {
        const d = parseInt(c, 10);
        if (c === "," || c === "." || isNaN(d)) return <span key={i}>{c}</span>;
        return <DigitSlot key={i} digit={d} spinning={false} />;
      })}
    </span>
  );
}

function getChannelThumbs(d) {
  const urls = [];
  const seen = new Set();
  [d?.platform?.thumbnail, d?.channel?.thumbnail].forEach(t => { if (t && !seen.has(t)) { urls.push(t); seen.add(t); } });
  (d?.posts || []).slice(0, 2).forEach(p => { if (p?.thumbnail && !seen.has(p.thumbnail)) { urls.push(p.thumbnail); seen.add(p.thumbnail); } });
  return urls;
}
function getAllBrandThumbs(brand, channelData) {
  const urls = [];
  const tried = new Set();
  for (const key of (brand.handles || [])) {
    getChannelThumbs(channelData[key] || {}).forEach(u => { if (u && !tried.has(u)) { urls.push(u); tried.add(u); } });
  }
  return urls;
}

function Overview({ onBrand, brandsFromDb, brandsLoading, syncAll, syncing, lastSync, syncErrors, onAccounts }) {
  const { channelData } = useYouTubeContext();

  const uniqueKeys = [...new Set((brandsFromDb || []).flatMap(b => b.handles))];
  const allChannelsLoaded = uniqueKeys.length === 0 || uniqueKeys.every(k => channelData[k]);
  const dataReady = !brandsLoading && allChannelsLoaded;
  const keyToBrand = {};
  (brandsFromDb || []).forEach(b => {
    b.handles.forEach(h => {
      if (!keyToBrand[h]) keyToBrand[h] = b.name;
    });
  });
  const allChannels = uniqueKeys.map(h => channelData[h]).filter(Boolean);
  const viewsData = (() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const byDate = {};
    allChannels.forEach(ch => {
      (ch.dailyViews || []).forEach(row => {
        const key = row.raw || row.d;
        if (key === todayStr) return;
        if (!byDate[key]) byDate[key] = { d: row.d, raw: key, cumViews: 0 };
        byDate[key].cumViews += (row.views || 0);
      });
    });
    let sorted = Object.values(byDate).sort((a, b) => (a.raw || "").localeCompare(b.raw || ""));
    if (sorted.length === 1) {
      const d = sorted[0].raw || "";
      const prev = new Date(d ? d + "T12:00:00Z" : Date.now());
      prev.setDate(prev.getDate() - 1);
      const prevStr = prev.toISOString().slice(0, 10);
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const prevD = `${months[prev.getMonth()]} ${prev.getDate()}`;
      sorted = [{ d: prevD, raw: prevStr, cumViews: 0 }, ...sorted];
    }
    return sorted.map((row, i) => ({
      ...row,
      views: i === 0 ? 0 : Math.max(0, row.cumViews - (sorted[i - 1].cumViews || 0)),
    }));
  })();

  const totalViews = allChannels.reduce((s, ch) => s + (ch.totalViews || 0), 0);
  const totalFollowers = allChannels.reduce((s, ch) => s + getFollowers(ch), 0);
  const allPostsRaw = uniqueKeys.flatMap(h => {
    const ch = channelData[h];
    return (ch?.posts || []).map(p => ({ ...p, _brand: keyToBrand[h] || "—" }));
  });
  const allPosts = (() => {
    const byId = new Map();
    allPostsRaw.forEach(p => {
      const existing = byId.get(p.id);
      if (!existing || (p.views || 0) > (existing.views || 0)) byId.set(p.id, p);
    });
    return Array.from(byId.values());
  })();
  const avgViews = allPosts.length ? Math.round(allPosts.reduce((s, p) => s + p.views, 0) / allPosts.length) : 0;
  const totalLikes = allPosts.reduce((s, p) => s + (p.likes || 0), 0);
  const totalComments = allPosts.reduce((s, p) => s + (p.cmts || 0), 0);
  const totalShares = allPosts.reduce((s, p) => s + (p.shares || 0), 0);
  const engagementRate = totalViews > 0 ? ((totalLikes + totalComments + totalShares) / totalViews * 100).toFixed(2) : "0";

  let ytViews = 0, ttViews = 0, igViews = 0;
  allChannels.forEach(ch => {
    const pt = ch.platform?.platformType || ch.channel?.platform || "youtube";
    const v = ch.totalViews || 0;
    if (pt === "tiktok") ttViews += v;
    else if (pt === "instagram") igViews += v;
    else ytViews += v;
  });
  const pieData = [];
  if (ytViews > 0) pieData.push({ name: "YT", value: ytViews, color: "#ff6b6b" });
  if (ttViews > 0) pieData.push({ name: "TT", value: ttViews, color: "#69c9d0" });
  if (igViews > 0) pieData.push({ name: "IG", value: igViews, color: "#E1306C" });
  if (!pieData.length) pieData.push({ name: "—", value: 1, color: "#333" });

  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column"}}>
      <div className="topbar">
        <span className="topbar-title">SOCIAL MEDIA ANALYTICS</span>
        <div className="tr">
          <button className="ibtn primary" disabled={syncing} onClick={syncAll}>{syncing ? "SYNCING…" : "⟳ SYNC ALL"}</button>
          <button className="ibtn" onClick={onAccounts}>Accounts</button>
        </div>
      </div>
      <div className="page" style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
        <div className="krow" style={{gridTemplateColumns:"repeat(4,1fr)"}}>
          {[
            {l:"Total Views",v:totalViews,s:"All platforms",mag:1e7},
            {l:"Followers",v:totalFollowers,s:"All accounts",mag:1e4},
            {l:"Avg Views/Post",v:avgViews,s:`${allPosts.length} posts`,mag:1e6},
            {l:"Engagement Rate",v:parseFloat(engagementRate)||0,s:"(Likes+cmts+shares)/views",suffix:"%",decimal:true},
          ].map(k=>(
            <div key={k.l} className="kcard">
              <div className="klbl">{k.l}</div>
              <div className="kval">{k.decimal ? (dataReady ? <>{k.v.toFixed(2)}%</> : <><RollingNumber value={Math.floor(k.v)} spinning magnitude={10} format="short" />%</>) : <><RollingNumber value={k.v} spinning={!dataReady} magnitude={k.mag} format={k.suffix?"short":"full"} />{k.suffix||""}</>}</div>
              <div className="ksub">{k.s}</div>
            </div>
          ))}
        </div>
        {syncErrors?.length > 0 && (
          <div className="alert" style={{marginTop:8}}>
            <span className="alert-txt"><strong>Sync failed for {syncErrors.length} account{syncErrors.length!==1?"s":""}:</strong> {syncErrors.map(e=>e.key).join(", ")} — {syncErrors[0]?.msg}</span>
          </div>
        )}
        <div className="krow" style={{gridTemplateColumns:"repeat(3,1fr)",marginTop:-4}}>
          {[
            {l:"Total Likes",v:totalLikes,s:"❤️ All content"},
            {l:"Comments",v:totalComments,s:"💬 All content"},
            {l:"Shares",v:totalShares,s:"↗️ All content"},
          ].map(k=>(
            <div key={k.l} className="kcard"><div className="klbl">{k.l}</div><div className="kval"><RollingNumber value={k.v} spinning={!dataReady} magnitude={1e6} /></div><div className="ksub">{k.s}</div></div>
          ))}
        </div>

        <div className="g3" style={{visibility: dataReady ? "visible" : "hidden", opacity: dataReady ? 1 : 0, transition: "opacity 0.4s"}}>
          <div className="panel" style={{display:"flex",flexDirection:"column"}}>
            <div className="ph" style={{flexShrink:0}}><span className="ptitle">DAILY GROWTH</span></div>
            {viewsData.length > 0 ? (
              <div style={{flex:1,minHeight:0}}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={viewsData} margin={{top:0,right:0,bottom:0,left:-22}}>
                  <defs>
                    <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff6b6b" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#ff6b6b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="d" tick={{fontFamily:"DM Mono",fontSize:8,fill:"#444"}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontFamily:"DM Mono",fontSize:8,fill:"#444"}} axisLine={false} tickLine={false} tickFormatter={fmt}/>
                  <Tooltip content={<TTip/>} cursor={{stroke:"#444",strokeWidth:1}}/>
                  <Area type="monotone" dataKey="views" stroke="#ff6b6b" strokeWidth={2} fill="url(#gv)" name="Daily growth" dot={{r:3,fill:"#ff6b6b",strokeWidth:0}} activeDot={{r:4,stroke:"#fff",strokeWidth:2}} isAnimationActive={false}/>
                </AreaChart>
              </ResponsiveContainer>
              </div>
            ) : (
              <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text3)",fontSize:12}}>Daily growth builds as you sync. Need 2+ days of data.</div>
            )}
          </div>
          <div className="panel" style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
            <div className="ptitle" style={{alignSelf:"stretch",marginBottom:4,flexShrink:0}}>PLATFORM SPLIT</div>
            <div style={{flex:1,minHeight:0,width:"100%"}}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius="58%" outerRadius="80%" strokeWidth={0}
                  label={({name,percent,cx,cy,midAngle,innerRadius,outerRadius})=>{
                    const R=Math.PI/180; const r=(innerRadius+outerRadius)/2+12;
                    const x=cx+r*Math.cos(-midAngle*R), y=cy+r*Math.sin(-midAngle*R);
                    return <text x={x} y={y} fill="#f5f2ed" textAnchor="middle" dominantBaseline="central" style={{fontSize:11,fontFamily:"DM Mono",fontWeight:500}}>{name} {(percent*100).toFixed(0)}%</text>;
                  }} labelLine={false}
                >
                  {pieData.map((d,i) => <Cell key={i} fill={d.color}/>)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            </div>
          </div>
          <div className="panel" style={{display:"flex",flexDirection:"column"}}>
            <div className="ptitle" style={{marginBottom:6,flexShrink:0}}>TOP POSTS</div>
            <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:4,minHeight:0}}>
              {(() => {
                const ranked = [...allPosts].sort((a,b) => b.views - a.views);
                if (!ranked.length) return <div style={{fontSize:10,color:"var(--text3)",padding:"8px 0"}}>Sync an account to see top posts</div>;
                return ranked.map((p,i) => (
                  <div key={p.id} style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:3,padding:"6px 8px",borderLeft:`3px solid ${p.plat==="tt"?"#69c9d0":p.plat==="ig"?"#E1306C":"var(--red)"}`,flexShrink:0}}>
                    <div style={{display:"flex",alignItems:"baseline",gap:5}}>
                      <span style={{fontFamily:"var(--display)",fontSize:13,color:"var(--text3)",minWidth:14}}>#{i+1}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:9,color:"var(--text3)"}}>{p._brand} · {p.plat==="tt"?"🎵":p.plat==="ig"?"📷":"▶️"}</div>
                        <div style={{fontSize:10,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.cap}</div>
                      </div>
                      <span style={{fontFamily:"var(--display)",fontSize:14,color:"var(--text)",flexShrink:0}}>{fmt(p.views)}</span>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>

        <div className="sh" style={{marginBottom:6,flexShrink:0,visibility: dataReady ? "visible" : "hidden", opacity: dataReady ? 1 : 0, transition: "opacity 0.4s"}}>
          <span className="sht">BRANDS</span>
          <span style={{fontFamily:"DM Mono",fontSize:9,color:"var(--text3)"}}>{(brandsFromDb||[]).length} brands</span>
        </div>

        <div className="bgrid" style={{flex:1,minHeight:0,overflowY:"auto",alignContent:"start",visibility: dataReady ? "visible" : "hidden", opacity: dataReady ? 1 : 0, transition: "opacity 0.4s"}}>
          {!(brandsFromDb||[]).length ? (
            <div style={{gridColumn:"1/-1",textAlign:"center",padding:40,color:"var(--text3)",border:"1px dashed var(--border2)",borderRadius:5}}>
              <div style={{fontSize:14,marginBottom:8}}>No brands yet</div>
              <div style={{fontSize:11}}>Go to <strong>Accounts</strong> → create a brand and sync accounts</div>
            </div>
          ) : (brandsFromDb||[]).map(b => {
            const allHandles = b.handles;
            const chData = allHandles.map(h => channelData[h]).filter(Boolean);
            const brandFollowers = chData.reduce((s, c) => s + getFollowers(c), 0);
            const brandViews = chData.reduce((s, c) => s + (c.totalViews || 0), 0);
            const thumbs = getAllBrandThumbs(b, channelData);
            const hasData = chData.length > 0;
            const allInactive = allHandles.length > 0 && allHandles.every(h => b.handleStatus?.[h] === false);
            const hasTT = allHandles.some(h => (h.includes("::") ? h.split("::")[1] : "youtube") === "tiktok");
            const hasYT = allHandles.some(h => (h.includes("::") ? h.split("::")[1] : "youtube") === "youtube");
            const hasIG = allHandles.some(h => (h.includes("::") ? h.split("::")[1] : "youtube") === "instagram");
            const cols = [];
            if (hasTT) cols.push({ pt: "tiktok", name: "TikTok" });
            if (hasYT) cols.push({ pt: "youtube", name: "YouTube" });
            if (hasIG) cols.push({ pt: "instagram", name: "Instagram" });
            const boxStyle = { flex: "0 0 calc((100% - 16px) / 3)", minWidth: 0 };
            return (
              <div key={b.id} className={`bcard${!hasData?" dead":""}`} onClick={() => onBrand(b.id)}>
                <div className="bcard-top">
                  <div style={{display:"flex",alignItems:"center",gap:9}}>
                    <Pfp srcs={thumbs} size={32} name={b.name}/>
                    <span className="bcard-name">{b.name}</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    {hasData && (
                      <div style={{display:"flex",alignItems:"baseline",gap:12}}>
                        <div style={{textAlign:"center"}}>
                          <div style={{fontFamily:"var(--display)",fontSize:17,color:"var(--text)",lineHeight:1.2}}><RollingNumber value={brandFollowers} spinning={!dataReady} magnitude={1e4} /></div>
                          <div style={{fontFamily:"var(--mono)",fontSize:7,color:"var(--text3)"}}>flw</div>
                        </div>
                        <div style={{textAlign:"center"}}>
                          <div style={{fontFamily:"var(--display)",fontSize:17,color:"var(--text)",lineHeight:1.2}}><RollingNumber value={brandViews} spinning={!dataReady} magnitude={1e6} /></div>
                          <div style={{fontFamily:"var(--mono)",fontSize:7,color:"var(--text3)"}}>views</div>
                        </div>
                      </div>
                    )}
                    <span className={`bstatus ${allInactive?"s-dead":hasData?"s-active":"s-dead"}`}>{allInactive?"inactive":hasData?"active":"sync needed"}</span>
                  </div>
                </div>
                {cols.length > 0 && (
                <div style={{display:"flex",justifyContent:"center",flexWrap:"wrap",gap:8,marginTop:8}}>
                  {cols.map(({ pt, name }) => {
                    const ptHandles = allHandles.filter(h => (h.includes("::") ? h.split("::")[1] : "youtube") === pt);
                    const ptChData = ptHandles.map(h => channelData[h]).filter(Boolean);
                    const followers = ptChData.reduce((s, c) => s + getFollowers(c), 0);
                    const views = ptChData.reduce((s, c) => s + (c.totalViews || 0), 0);
                    const ptBadges = ptHandles.map(key => ({ key, isActive: b.handleStatus?.[key] !== false }));
                    return (
                      <div key={pt} style={{...boxStyle,display:"flex",flexDirection:"column",alignItems:"center",padding:"8px 6px",background:"var(--surface2)",borderRadius:4,border:"1px solid var(--border)"}}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:4,marginBottom:6}}>
                          <span style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--text3)"}}>{name}</span>
                          <div style={{display:"flex",gap:3,flexShrink:0}}>
                            {ptBadges.map(({ key, isActive }) => (
                              <span key={key} style={{fontSize:7,padding:"1px 4px",borderRadius:2,background:isActive?"var(--green-dim)":"var(--red-dim)",color:isActive?"var(--green)":"var(--red)"}}>{isActive?"active":"inactive"}</span>
                            ))}
                          </div>
                        </div>
                        <div style={{display:"flex",width:"100%",alignItems:"baseline"}}>
                          <div style={{flex:1,textAlign:"center",paddingRight:8,borderRight:"1px solid var(--border2)"}}>
                            <div style={{fontFamily:"var(--display)",fontSize:17,color:"var(--text)",lineHeight:1.2}}>{ptChData.length ? <RollingNumber value={followers} spinning={!dataReady} magnitude={1e4} /> : "—"}</div>
                            <div style={{fontFamily:"var(--mono)",fontSize:7,color:"var(--text3)"}}>flw</div>
                          </div>
                          <div style={{flex:1,textAlign:"center",paddingLeft:8}}>
                            <div style={{fontFamily:"var(--display)",fontSize:17,color:"var(--text)",lineHeight:1.2}}>{ptChData.length ? <RollingNumber value={views} spinning={!dataReady} magnitude={1e6} /> : "—"}</div>
                            <div style={{fontFamily:"var(--mono)",fontSize:7,color:"var(--text3)"}}>views</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BrandView({ brandId, onBack, brands, onAccounts }) {
  const { channelData } = useYouTubeContext();
  const dbBrand = brands?.find(b => b.id === brandId);
  if (!dbBrand) return null;

  const allHandles = dbBrand.handles;
  const chData = allHandles.map(key => channelData[key]).filter(Boolean);
  const hasChannelData = chData.length > 0;
  const totalFollowers = chData.reduce((s, c) => s + getFollowers(c), 0);
  const totalViews = chData.reduce((s, c) => s + (c.totalViews || 0), 0);
  const postsRaw = chData.flatMap(c => c.posts || []);
  const posts = (() => {
    const byId = new Map();
    postsRaw.forEach(p => {
      const existing = byId.get(p.id);
      if (!existing || (p.views || 0) > (existing.views || 0)) byId.set(p.id, p);
    });
    return Array.from(byId.values());
  })();
  posts.sort((a, b) => (b.views || 0) - (a.views || 0));
  const avgV = posts.length ? Math.round(posts.reduce((s, p) => s + p.views, 0) / posts.length) : 0;
  const totalLikes = posts.reduce((s, p) => s + (p.likes || 0), 0);
  const totalComments = posts.reduce((s, p) => s + (p.cmts || 0), 0);
  const thumbs = getAllBrandThumbs(dbBrand, channelData);
  const platforms = [...new Set(chData.map(c => c.platform?.platformType || c.channel?.platform || "youtube"))];

  const todayStr = new Date().toISOString().slice(0, 10);
  const dailyViews = chData.flatMap(c => c.dailyViews || []).filter(row => row.raw !== todayStr);
  const wklyData = (() => {
    const byWeek = {};
    dailyViews.forEach(row => {
      const d = new Date(row.raw); const w = getWeekKey(d);
      if (!byWeek[w]) byWeek[w] = { n: w, v: 0 };
      byWeek[w].v += (row.views || 0);
    });
    return Object.values(byWeek).sort((a, b) => a.n.localeCompare(b.n));
  })();
  function getWeekKey(d) { const start = new Date(d); start.setDate(1); const w = Math.ceil(d.getDate() / 7); return `${start.toLocaleString("en", { month: "short" })} W${w}`; }

  return (
    <div>
      <div className="topbar">
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button className="ibtn" onClick={onBack}>← BACK</button>
          <Pfp srcs={thumbs} size={24} name={dbBrand.name}/>
          <span className="topbar-title">{dbBrand.name}</span>
          {platforms.map(pt => <span key={pt} className={`chip ${pt==="tiktok"?"ctt":pt==="instagram"?"cig-insta":"cyt"}`}>{pt.toUpperCase()}</span>)}
          {hasChannelData && <span className="bstatus s-active">active</span>}
        </div>
        <button className="ibtn" onClick={onAccounts}>Accounts</button>
      </div>
      <div className="page">
        {!hasChannelData && (
          <div className="alert" style={{marginBottom:18}}>
            <span className="alert-txt"><strong>No synced data.</strong> Go to <strong>Accounts</strong> → re-sync channels for this brand.</span>
          </div>
        )}
        <div className="krow" style={{gridTemplateColumns:"repeat(5,1fr)"}}>
          {[
            {l:"Followers",v:fmt(totalFollowers)},{l:"Total Views",v:fmt(totalViews)},
            {l:"Avg Views/Post",v:fmt(avgV)},{l:"Total Likes",v:fmt(totalLikes)},{l:"Comments",v:fmt(totalComments)},
          ].map(k => (
            <div key={k.l} className="kcard"><div className="klbl">{k.l}</div><div className="kval">{k.v}</div></div>
          ))}
        </div>

        {chData.length > 1 && (
          <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
            {chData.map(c => (
              <div key={c.channel?.id || c.platform?.handle} style={{display:"flex",alignItems:"center",gap:6,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:4,padding:"6px 10px"}}>
                <Pfp srcs={getChannelThumbs(c)} size={18} name={c.platform?.displayName || c.platform?.handle}/>
                <span style={{fontFamily:"DM Mono",fontSize:9,color:"var(--text2)"}}>{c.platform?.displayName || c.platform?.handle}</span>
                <span style={{fontFamily:"DM Mono",fontSize:8,color:"#444"}}>{fmt(getFollowers(c))} followers</span>
              </div>
            ))}
          </div>
        )}

        <div className="g2">
          <div className="panel">
            <div className="ph"><span className="ptitle">WEEKLY VIEWS</span></div>
            {wklyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={wklyData} margin={{top:0,right:0,bottom:0,left:-22}}>
                  <XAxis dataKey="n" tick={{fontFamily:"DM Mono",fontSize:8,fill:"#444"}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontFamily:"DM Mono",fontSize:8,fill:"#444"}} axisLine={false} tickLine={false} tickFormatter={fmt}/>
                  <Tooltip content={<TTip/>}/>
                  <Bar dataKey="v" fill="#ff6b6b" radius={[2,2,0,0]} opacity={0.8} name="Views"/>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{height:150,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text3)",fontSize:11}}>Views chart builds over time with daily syncs</div>
            )}
          </div>
          <div className="panel">
            <div className="ph"><span className="ptitle">ACCOUNTS</span></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {dbBrand.handles.map(key => {
                const c = channelData[key];
                const { handle: rawH, platform: rawP } = pk(key);
                const showName = c?.platform?.displayName || c?.platform?.handle || rawH;
                const isActive = dbBrand.handleStatus?.[key] !== false;
                return (
                  <div key={key} style={{display:"flex",alignItems:"center",gap:8,padding:6,background:"var(--surface2)",borderRadius:3,border:"1px solid var(--border)",opacity:isActive?1:.6}}>
                    <Pfp srcs={getChannelThumbs(c)} size={22} name={showName}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                        <span style={{fontSize:10,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{showName}</span>
                        <span style={{fontSize:7,padding:"1px 4px",borderRadius:2,flexShrink:0,background:isActive?"var(--green-dim)":"var(--red-dim)",color:isActive?"var(--green)":"var(--red)"}}>{isActive?"active":"inactive"}</span>
                      </div>
                      <div style={{fontFamily:"DM Mono",fontSize:8,color:"#555"}}>{c ? fmt(getFollowers(c)) + " followers" : "not synced"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="ph">
            <span className="ptitle">POST FEED — {dbBrand.name.toUpperCase()}</span>
            <span className="pact">AVG {fmt(avgV)} VIEWS/POST · {posts.length} POSTS</span>
          </div>
          {posts.length === 0 ? (
            <div style={{textAlign:"center",padding:"30px",color:"var(--text3)",fontSize:12}}>No posts synced yet.</div>
          ) : (
            <>
              <div className="avgline">
                <span style={{color:"var(--red)",fontFamily:"DM Mono",fontSize:9,whiteSpace:"nowrap"}}>AVG {fmt(avgV)}</span>
                <div className="albar"/>
                <span style={{color:"#333",fontSize:8}}>THRESHOLD</span>
              </div>
              <div className="pgrid">
                {posts.map(p => (
                  <div key={p.id} className={`pcard${(p.views||0)<avgV?" ba":""}`}>
                    <div className="pthumb">
                      {p.thumbnail ? (
                        <img src={p.thumbnail} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                      ) : (
                        <span>{p.emoji || "▶️"}</span>
                      )}
                      {(p.views||0)<avgV && <span className="bab">BELOW AVG</span>}
                    </div>
                    <div className="pbody">
                      <div className="pcap">{p.cap}</div>
                      <div className="pvbig">{fmt(p.views)} views</div>
                      <div className="psr">
                        <div className="pst">❤️ <span>{fmt(p.likes)}</span></div>
                        <div className="pst">💬 <span>{p.cmts}</span></div>
                        {p.shares > 0 && <div className="pst">↗️ <span>{fmt(p.shares)}</span></div>}
                      </div>
                      {(p.views||0)>0 && (
                        <div style={{marginTop:4,fontFamily:"DM Mono",fontSize:8,color:"var(--text3)"}}>
                          L/V: {((p.likes||0)/(p.views||1)*100).toFixed(2)}%
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Settings({ brands, brandsLoading, addBrand, removeBrand, addHandleToBrand, removeHandleFromBrand, removeChannel, toggleActive, onBack }) {
  const [modal, setModal] = useState(null);
  const [syncHandle, setSyncHandle] = useState("");
  const [syncPlatform, setSyncPlatform] = useState("youtube");
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [syncBrandId, setSyncBrandId] = useState(null);
  const [newBrandName, setNewBrandName] = useState("");
  const [resyncKey, setResyncKey] = useState(null);
  const { apiKey, instagramConfigured, fetchChannel, channelData } = useYouTubeContext();

  const handleSync = async (targetBrandId) => {
    if (!syncHandle.trim() || !targetBrandId) return;
    if (syncPlatform !== "instagram" && !apiKey) return;
    setSyncLoading(true); setSyncError(null);
    try {
      const entry = await fetchChannel(syncHandle.trim(), syncPlatform, true);
      const rawHandle = entry?.channel?.handle || entry?.platform?.handle || entry?.channel?.title;
      if (rawHandle) {
        await addHandleToBrand(targetBrandId, rawHandle, syncPlatform);
        setSyncHandle("");
        setSyncBrandId(null);
        setSyncError(null);
        setModal(null);
      }
    } catch (e) { setSyncError(e.message); }
    setSyncLoading(false);
  };


  return (
    <div>
      <div className="topbar">
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button className="ibtn" onClick={onBack}>← BACK</button>
          <span className="topbar-title">ACCOUNT MANAGER</span>
        </div>
        <div className="tr" style={{gap:8}}>
          <button className="ibtn primary" onClick={() => setModal("brand")}>+ ADD BRAND</button>
          <button className="ibtn primary" onClick={() => setModal("account")}>+ ADD ACCOUNT</button>
        </div>
      </div>
      <div className="page">
        <div style={{marginBottom:24}}>
          <div className="stitle">CONNECTED ACCOUNTS</div>
          <div className="sdesc">Add brands first, then add YouTube or TikTok accounts via + ADD ACCOUNT.</div>
          {syncError && (
            <div className="alert" style={{marginBottom:12}}>
              <span className="alert-txt">{syncError}</span>
              <button className="ibtn" onClick={() => setSyncError(null)}>✕</button>
            </div>
          )}
          {brandsLoading ? (
            <div style={{padding:20,textAlign:"center",color:"var(--text3)",fontSize:12,border:"1px dashed var(--border2)",borderRadius:4}}>Loading brands…</div>
          ) : brands.length === 0 ? (
            <div style={{padding:20,textAlign:"center",color:"var(--text3)",fontSize:12,border:"1px dashed var(--border2)",borderRadius:4}}>Add a brand first, then add accounts via + ADD ACCOUNT.</div>
          ) : brands.map(b => (
            <div key={b.id} style={{marginBottom:16,border:"1px solid var(--border)",borderRadius:5,overflow:"hidden",background:"var(--surface)"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"var(--surface2)",borderBottom:"1px solid var(--border)"}}>
                <span style={{fontFamily:"var(--display)",fontSize:14,letterSpacing:1,color:"var(--text)"}}>{b.name}</span>
                <button className="ibtn danger" style={{padding:"3px 8px",fontSize:9}} onClick={async () => await removeBrand(b.id)}>✕ Remove</button>
              </div>
              <div style={{padding:12}}>
                {b.handles.map(key => {
                  const d = channelData[key];
                  const { handle: rawHandle, platform: rawPlat } = pk(key);
                  const pt = d?.platform?.platformType || rawPlat;
                  const apiHandle = d?.channel?.handle || d?.platform?.handle || rawHandle;
                  const showName = d?.platform?.displayName || d?.channel?.title || rawHandle;
                  const isActive = b.handleStatus?.[key] !== false;
                  return (
                    <div key={key} className="arow" style={!isActive ? {opacity:.45} : undefined}>
                      <Pfp srcs={getChannelThumbs(d)} size={28} name={showName}/>
                      <div className="ainfo">
                        <div className="ahandle">{showName}</div>
                        <div className="atag">{!isActive ? `${pt} · deactivated` : d ? pt : "not synced"}</div>
                      </div>
                      <div className="ameta">
                        <span>{d ? (getFollowers(d) ? fmt(getFollowers(d)) + " followers" : "—") : "—"}</span><br/>
                        <span className={`chip ${isActive ? (d ? "cg" : "ctt") : "cr"}`}>{isActive ? (d ? "ACTIVE" : "SYNC NEEDED") : "INACTIVE"}</span>
                      </div>
                      <div className="aacts">
                        <button className="ibtn" title={isActive ? "Deactivate" : "Activate"} onClick={() => toggleActive(b.id, key, !isActive)} style={!isActive ? {color:"var(--green)",borderColor:"rgba(0,184,148,.3)"} : {}}>{isActive ? "⏸" : "▶"}</button>
                        {isActive && (
                          <button className="ibtn" title="Re-sync" disabled={resyncKey === key}
                            onClick={async () => {
                              setResyncKey(key); setSyncError(null);
                              try {
                                await fetchChannel(rawHandle, rawPlat, true);
                              } catch (e) {
                                setSyncError(e.message || String(e));
                              } finally {
                                setResyncKey(null);
                              }
                            }}>
                            {resyncKey === key ? "…" : "⟳"}
                          </button>
                        )}
                        <button className="ibtn danger" onClick={async () => { removeChannel(key); await removeHandleFromBrand(b.id, rawHandle, rawPlat); }}>✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {modal === "brand" && (
        <div className="ovrl" onClick={() => { setModal(null); setNewBrandName(""); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mtitle">ADD BRAND</div>
            <div className="msub">Create a new brand to group accounts under.</div>
            <div className="fg"><label className="flbl">Brand Name</label><input className="finput" placeholder="e.g. Raw Truth Podcast" value={newBrandName} onChange={e => setNewBrandName(e.target.value)}/></div>
            <div className="fg"><label className="flbl">Brand Color</label>
              <input className="finput" type="color" defaultValue="#d63031" style={{height:40,padding:3,cursor:"pointer"}}/></div>
            <div className="macts">
              <button className="ibtn" onClick={() => { setModal(null); setNewBrandName(""); }}>Cancel</button>
              <button className="ibtn primary" onClick={() => { addBrand(newBrandName || "New Brand"); setModal(null); setNewBrandName(""); }}>CREATE BRAND</button>
            </div>
          </div>
        </div>
      )}

      {modal === "account" && (
        <div className="ovrl" onClick={() => { setModal(null); setSyncHandle(""); setSyncBrandId(null); setSyncError(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mtitle">ADD ACCOUNT</div>
            <div className="msub">Add a YouTube or TikTok account. Select a brand to assign it to.</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"center",marginBottom:12}}>
              <span className={`chip ${apiKey?"cig":"ctt"}`}>{apiKey ? "API KEY OK" : "NO API KEY"}</span>
            </div>
            <div className="fg">
              <label className="flbl">Platform</label>
              <select className="fselect" value={syncPlatform} onChange={e => { setSyncPlatform(e.target.value); setSyncError(null); }} style={{width:"100%"}}>
                <option value="youtube">YouTube</option>
                <option value="tiktok">TikTok</option>
              </select>
            </div>
            <div className="fg">
              <label className="flbl">Handle</label>
              <input className="finput" placeholder={syncPlatform === "tiktok" ? "e.g. charlidamelio" : "e.g. @RawTruth.Podcast"} value={syncHandle} onChange={e => { setSyncHandle(e.target.value); setSyncError(null); }} style={{width:"100%"}}/>
            </div>
            <div className="fg">
              <label className="flbl">Brand</label>
              <select className="fselect" value={syncBrandId || ""} onChange={e => { setSyncBrandId(e.target.value || null); setSyncError(null); }} style={{width:"100%"}}>
                <option value="">Select brand…</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            {syncError && <div style={{marginBottom:12,fontSize:11,color:"var(--red)"}}>{syncError}</div>}
            <div className="macts">
              <button className="ibtn" onClick={() => { setModal(null); setSyncHandle(""); setSyncBrandId(null); setSyncError(null); }}>Cancel</button>
              <button className="ibtn primary" disabled={!apiKey || syncLoading || !syncBrandId} onClick={() => handleSync(syncBrandId)}>{syncLoading ? "Syncing…" : "ADD ACCOUNT"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const STORAGE_KEY = "tambareni-nav";
const BRANDS_KEY = "tambareni-brands";
function loadNav() { try { const v = localStorage.getItem(STORAGE_KEY); if (v) { const j = JSON.parse(v); return { page: j.page || "overview", brandId: j.brandId || null }; } } catch {} return { page: "overview", brandId: null }; }
function saveNav(page, brandId) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ page, brandId })); } catch {} }
function loadBrandsLocal() { try { const v = localStorage.getItem(BRANDS_KEY); if (v) return JSON.parse(v); } catch {} return []; }

export default function App() {
  const [nav, setNav] = useState(loadNav);
  const [brands, setBrands] = useState(loadBrandsLocal);
  const [brandsLoading, setBrandsLoading] = useState(isSupabaseConfigured());
  const [channelMeta, setChannelMeta] = useState({});
  const { connectedHandles, channelData, removeChannel, fetchChannel } = useYouTubeContext();

  const page = nav.page;
  const brandId = nav.brandId;
  const go = (p, id = null) => { const next = { page: p, brandId: id ?? (p === "brand" ? brandId : null) }; setNav(next); saveNav(next.page, next.brandId); };

  const getBrandNameForChannel = (ch) => {
    const name = ch?.platform?.displayName || ch?.channel?.title || ch?.platform?.handle;
    return name;
  };

  useEffect(() => {
    const loadAndRefetch = (brandsData, meta = {}) => {
      setBrands(brandsData);
      setChannelMeta(meta);
      const keys = [...new Set(brandsData.flatMap(b => b.handles))];
      return Promise.all(keys.map(key => {
        const { handle, platform } = pk(key);
        return fetchChannel(handle, platform).catch(() => null);
      }));
    };
    if (isSupabaseConfigured()) {
      fetchBrandsWithChannels()
        .then(res => loadAndRefetch(res.brands ?? [], res.channelMeta ?? {}))
        .catch(err => { console.error("Supabase brands load failed:", err); return loadAndRefetch(loadBrandsLocal()); })
        .finally(() => setBrandsLoading(false));
    } else {
      loadAndRefetch(loadBrandsLocal()).finally(() => setBrandsLoading(false));
    }
  }, [fetchChannel]);

  const addHandleToBrand = useCallback(async (brandId, handle, platform = "youtube") => {
    if (isSupabaseConfigured()) await dbAddChannelToBrand(brandId, handle, platform);
    const key = ck(handle, platform);
    setBrands(prev => { const next = prev.map(b => b.id === brandId ? { ...b, handles: [...new Set([...b.handles, key])], handleStatus: { ...b.handleStatus, [key]: true } } : b); if (!isSupabaseConfigured()) try { localStorage.setItem(BRANDS_KEY, JSON.stringify(next)); } catch {} return next; });
  }, []);

  // When Supabase is configured, DB is source of truth for which brands have which channels.
  // Only fetch Instagram data for handles already in brands – don't auto-add from .env.
  const igAutoAdded = useRef(false);
  useEffect(() => {
    if (brandsLoading || igAutoAdded.current || !brands.length) return;
    if (isSupabaseConfigured()) {
      igAutoAdded.current = true;
      const igKeys = brands.flatMap(b => b.handles).filter(k => (pk(k).platform || "youtube") === "instagram");
      igKeys.forEach(key => { const { handle, platform } = pk(key); fetchChannel(handle, platform).catch(() => {}); });
      return;
    }
    const igHandles = getInstagramHandles();
    if (!igHandles.length) return;
    igAutoAdded.current = true;
    igHandles.forEach(async (handle) => {
      const key = ck(handle, "instagram");
      const alreadyAdded = brands.some(b => b.handles.includes(key));
      if (alreadyAdded) {
        fetchChannel(handle, "instagram").catch(() => {});
        return;
      }
      const matchBrand = brands.find(b =>
        b.name.toLowerCase().replace(/[^a-z0-9]/g, "").includes(handle.toLowerCase().replace(/[^a-z0-9]/g, ""))
        || handle.toLowerCase().replace(/[^a-z0-9]/g, "").includes(b.name.toLowerCase().replace(/[^a-z0-9]/g, ""))
      ) || brands[0];
      if (matchBrand) {
        await addHandleToBrand(matchBrand.id, handle, "instagram").catch(() => {});
        fetchChannel(handle, "instagram").catch(() => {});
      }
    });
  }, [brands, brandsLoading, fetchChannel, addHandleToBrand]);

  const handledInstagramReturn = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ig = params.get("instagram");
    if (ig && isSupabaseConfigured() && !handledInstagramReturn.current) {
      handledInstagramReturn.current = true;
      const isPopup = !!window.opener;
      if (isPopup && window.opener) {
        window.opener.location.href = `${window.location.origin}${window.location.pathname}?instagram=${ig}${params.get("brandId") ? `&brandId=${params.get("brandId")}` : ""}`;
        window.close();
        return;
      }
      window.history.replaceState({}, "", window.location.pathname);
      fetchBrandsWithChannels()
        .then(res => {
          setBrands(res.brands ?? []);
          const keys = [...new Set((res.brands ?? []).flatMap(b => b.handles))];
          return Promise.all(keys.map(key => {
            const { handle, platform } = pk(key);
            return fetchChannel(handle, platform).catch(() => null);
          }));
        })
        .then(() => { if (ig === "success") go("settings"); })
        .catch(() => {});
    }
  }, [fetchChannel]);

  const addBrand = useCallback(async (name) => {
    const b = { id: crypto.randomUUID(), name: name || "New Brand", color: "#d63031", handles: [] };
    if (isSupabaseConfigured()) { const row = await dbCreateBrand({ name: b.name, color: b.color }); b.id = row.id; }
    setBrands(prev => { const next = [...prev, b]; if (!isSupabaseConfigured()) try { localStorage.setItem(BRANDS_KEY, JSON.stringify(next)); } catch {} return next; });
    return b;
  }, []);

  const removeBrand = useCallback(async (id, removeChannelFn) => {
    const b = brands.find(x => x.id === id);
    if (b?.handles) b.handles.forEach(key => removeChannelFn?.(key));
    if (isSupabaseConfigured()) await dbDeleteBrand(id);
    setBrands(prev => { const next = prev.filter(x => x.id !== id); if (!isSupabaseConfigured()) try { localStorage.setItem(BRANDS_KEY, JSON.stringify(next)); } catch {} return next; });
  }, [brands]);

  const removeHandleFromBrand = useCallback(async (brandId, handle, platform) => {
    if (isSupabaseConfigured()) await dbRemoveChannelFromBrand(brandId, handle, platform);
    const key = ck(handle, platform);
    setBrands(prev => { const next = prev.map(b => b.id === brandId ? { ...b, handles: b.handles.filter(h => h !== key) } : b); if (!isSupabaseConfigured()) try { localStorage.setItem(BRANDS_KEY, JSON.stringify(next)); } catch {} return next; });
  }, []);

  const toggleActive = useCallback(async (brandId, key, active) => {
    const { handle, platform } = pk(key);
    if (isSupabaseConfigured()) await dbToggleChannelActive(brandId, handle, platform, active);
    setBrands(prev => prev.map(b => b.id === brandId ? { ...b, handleStatus: { ...b.handleStatus, [key]: active } } : b));
  }, []);

  const LAST_REFRESH_KEY = "tambareni-last-refresh";
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(() => {
    try {
      const s = localStorage.getItem(LAST_REFRESH_KEY);
      if (s) return new Date(s);
      return null;
    } catch { return null; }
  });
  const [syncErrors, setSyncErrors] = useState([]);

  const refreshLastSync = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    const dbTime = await fetchLastSyncTime().catch(() => null);
    if (dbTime) setLastSync(prev => (!prev || dbTime > prev ? dbTime : prev));
  }, []);

  useEffect(() => {
    refreshLastSync();
    const id = setInterval(refreshLastSync, 120000);
    return () => clearInterval(id);
  }, [refreshLastSync]);

  const syncAll = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncErrors([]);
    try {
      const keys = [...new Set(brands.flatMap(b => b.handles.filter(key => b.handleStatus?.[key] !== false)))];
      const errs = [];
      for (const key of keys) {
        const { handle, platform } = pk(key);
        try {
          await fetchChannel(handle, platform, true, true);
        } catch (e) {
          errs.push({ key, msg: e?.message || String(e) });
        }
        await new Promise(r => setTimeout(r, 1500));
      }
      setSyncErrors(errs);
      const now = new Date();
      setLastSync(now);
      try { localStorage.setItem(LAST_REFRESH_KEY, now.toISOString()); } catch {}
      if (isSupabaseConfigured()) refreshLastSync();
    } finally {
      setSyncing(false);
    }
  }, [brands, fetchChannel, syncing, refreshLastSync]);

  const SYNC_KEY = "tambareni-last-auto-sync";
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const last = localStorage.getItem(SYNC_KEY);
      const lastDate = last ? new Date(last).toDateString() : null;
      if (lastDate === now.toDateString()) return;
      const h = now.getHours(), m = now.getMinutes();
      const inWindow = (h === 23 && m >= 58) || (h === 0 && m <= 2);
      if (inWindow) {
        localStorage.setItem(SYNC_KEY, now.toISOString());
        syncAll();
      }
    };
    check();
    const id = setInterval(check, 15000);
    return () => clearInterval(id);
  }, [syncAll]);

  return (
    <>
      <style>{FONTS}{css}</style>
      <div className="app">
        <div className="sidebar">
          <div className="logo-area">
            <img src="/tm-logo-icon.jpg" alt="Tambareni Media" style={{width:62,height:62,borderRadius:6,objectFit:"cover",marginBottom:10}}/>
            <div className="logo-text">TAMBARENI<br/>MEDIA<br/>ANALYTICS</div>
          </div>
          <div className="nav-sec">
            <div className={`nav-item${page==="overview"?" act":""}`} onClick={() => go("overview")}>
              <div className="nav-dot" style={{background:"#d63031"}}/>Social Media
            </div>
            <div className={`nav-item${page==="matchmax"?" act":""}`} onClick={() => go("matchmax")}>
              <div className="nav-dot" style={{background:"#d63031"}}/>MatchMax App
            </div>
          </div>
          <div className="nav-sec">
            <div className="nav-lbl">Brands</div>
            {brands.map(b => {
              const thumbs = getAllBrandThumbs(b, channelData);
              const channelCount = b.handles.length;
              return (
                <div key={b.id} className={`brand-item${page==="brand"&&brandId===b.id?" act":""}`} onClick={() => go("brand", b.id)}>
                  <Pfp srcs={thumbs} size={22} name={b.name}/>
                  <span style={{flex:1,fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={b.name}>{b.name}</span>
                  {channelCount > 1 && <span className="dbadge">{channelCount}</span>}
                </div>
              );
            })}
          </div>
          <div style={{marginTop:"auto",padding:"14px 18px",borderTop:"1px solid var(--border)"}}>
            <div style={{fontFamily:"DM Mono",fontSize:8,color:"#333",letterSpacing:2}}>
              <>LAST REFRESH<br/><span style={{color:"#555",fontSize:9}}>{lastSync ? lastSync.toLocaleString() : "Never"}</span><br/><span style={{color:"#333",fontSize:8}}>Daily sync: 11:59 PM</span></>
            </div>
          </div>
        </div>
        <div className="main" onMouseDown={e => { const el = document.activeElement, t = e.target; if ((el?.tagName === "INPUT" || el?.tagName === "TEXTAREA") && !t.closest("input,textarea,select,button")) el.blur(); }}>
          {page === "overview" && <Overview onBrand={id => go("brand", id)} brandsFromDb={brands} brandsLoading={brandsLoading} syncAll={syncAll} syncing={syncing} lastSync={lastSync} syncErrors={syncErrors} onAccounts={() => go("settings")}/>}
          {page === "matchmax" && (
            <div style={{minHeight:"100vh",display:"flex",flexDirection:"column"}}>
              <div className="topbar">
                <span className="topbar-title">MATCHMAX APP ANALYTICS</span>
                <button className="ibtn" onClick={() => go("settings")}>Accounts</button>
              </div>
              <div className="page" style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text3)",fontSize:16}}>Coming soon</div>
            </div>
          )}
          {page === "brand" && <BrandView brandId={brandId} onBack={() => go("overview")} brands={brands} onAccounts={() => go("settings")}/>}
          {page === "settings" && <Settings brands={brands} brandsLoading={brandsLoading} addBrand={addBrand} removeBrand={id => removeBrand(id, removeChannel)} addHandleToBrand={addHandleToBrand} removeHandleFromBrand={removeHandleFromBrand} removeChannel={removeChannel} toggleActive={toggleActive} onBack={() => go("overview")}/>}
        </div>
      </div>
    </>
  );
}
