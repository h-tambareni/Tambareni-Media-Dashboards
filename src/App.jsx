import { useState, useEffect } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useYouTubeContext } from "./context/YouTubeContext";
import { YouTubeLoginButton } from "./components/YouTubeLoginButton";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500;600&display=swap');`;

const css = `
* { box-sizing: border-box; margin: 0; padding: 0; }
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
.main { flex:1; overflow-x:hidden; min-width:0; }
.topbar { height:52px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; padding:0 28px; background:var(--surface); position:sticky; top:0; z-index:10; }
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
.page { padding:24px 28px; }
.krow { display:grid; gap:1px; background:var(--border); border:1px solid var(--border); border-radius:5px; overflow:hidden; margin-bottom:20px; }
.kcard { background:var(--surface); padding:18px 20px; }
.klbl { font-family:var(--mono); font-size:10px; color:var(--text2); letter-spacing:2px; text-transform:uppercase; margin-bottom:8px; }
.kval { font-family:var(--display); font-size:34px; letter-spacing:1px; line-height:1; color:var(--text); }
.ksub { font-family:var(--mono); font-size:10px; color:var(--text2); margin-top:5px; }
.kchg { font-family:var(--mono); font-size:9px; margin-top:3px; }
.up { color:var(--green); } .dn { color:var(--red); }
.g2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px; }
.g3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; margin-bottom:14px; }
.panel { background:var(--surface); border:1px solid var(--border); border-radius:5px; padding:18px 20px; }
.ph { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
.ptitle { font-family:var(--display); font-size:16px; letter-spacing:2px; color:var(--text); cursor:default; user-select:none; }
.pact { font-family:var(--mono); font-size:9px; color:var(--text3); cursor:pointer; }
.alert { background:var(--red-dim); border:1px solid var(--red); border-radius:5px; padding:12px 16px; margin-bottom:18px; display:flex; align-items:center; gap:12px; }
.alert-txt { font-size:12px; flex:1; }
.alert-txt strong { color:var(--red); }
.bgrid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:20px; }
.bcard { background:var(--surface); border:1px solid var(--border); border-radius:5px; padding:16px 18px; cursor:pointer; transition:all .18s; position:relative; overflow:hidden; }
.bcard:hover { border-color:var(--border2); transform:translateY(-1px); }
.bcard.dead { opacity:.4; cursor:default; }
.bcard-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.bcard-name { font-family:var(--display); font-size:18px; letter-spacing:1px; }
.bstatus { font-family:var(--mono); font-size:8px; padding:2px 6px; border-radius:2px; text-transform:uppercase; letter-spacing:1px; }
.s-active { background:var(--green-dim); color:var(--green); }
.s-dead { background:var(--red-dim); color:var(--red); }
.bstats { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.mstat-val { font-family:var(--display); font-size:20px; }
.mstat-lbl { font-family:var(--mono); font-size:8px; color:var(--text3); letter-spacing:1px; text-transform:uppercase; margin-top:1px; }
.ptabs { display:flex; border-bottom:1px solid var(--border); margin-bottom:18px; }
.ptab { font-family:var(--mono); font-size:11px; letter-spacing:1px; padding:9px 18px; cursor:pointer; color:var(--text2); border-bottom:2px solid transparent; margin-bottom:-1px; transition:all .12s; display:flex; align-items:center; gap:7px; }
.ptab:hover { color:var(--text); }
.ptab.act { color:var(--text); border-bottom-color:var(--red); }
.pgrid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
.pcard { background:var(--surface2); border:1px solid var(--border); border-radius:4px; overflow:hidden; cursor:pointer; transition:all .12s; }
.pcard:hover { border-color:var(--border2); }
.pcard.ba { border-color:rgba(214,48,49,.35); }
.pthumb { height:100px; background:#161616; display:flex; align-items:center; justify-content:center; font-size:26px; position:relative; }
.bab { position:absolute; top:5px; right:5px; background:var(--red); font-family:var(--mono); font-size:7px; padding:2px 4px; border-radius:2px; color:white; }
.pbody { padding:9px 10px; }
.pcap { font-size:10px; color:var(--text2); margin-bottom:6px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.pvbig { font-family:var(--display); font-size:17px; color:var(--text); }
.psr { display:flex; gap:8px; margin-top:5px; }
.pst { font-family:var(--mono); font-size:9px; color:var(--text3); display:flex; align-items:center; gap:2px; }
.pst span { color:var(--text2); }
.srbar { height:3px; background:#222; border-radius:2px; margin-top:5px; overflow:hidden; }
.srfill { height:100%; background:var(--red); border-radius:2px; }
.arow { display:flex; align-items:center; gap:10px; padding:12px 14px; background:var(--surface); border:1px solid var(--border); border-radius:4px; margin-bottom:5px; }
.arow.dead-row { opacity:.45; }
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
.modal { background:var(--surface); border:1px solid var(--border2); border-radius:7px; padding:26px; width:400px; }
.mtitle { font-family:var(--display); font-size:21px; letter-spacing:1px; margin-bottom:4px; }
.msub { font-size:11px; color:var(--text3); margin-bottom:18px; }
.fg { margin-bottom:12px; }
.flbl { font-family:var(--mono); font-size:9px; color:var(--text3); letter-spacing:2px; text-transform:uppercase; margin-bottom:5px; display:block; }
.finput, .fselect { width:100%; background:var(--surface2); border:1px solid var(--border2); border-radius:3px; padding:9px 11px; color:var(--text); font-family:var(--sans); font-size:12px; outline:none; }
.finput:focus, .fselect:focus { border-color:var(--text3); }
.macts { display:flex; gap:7px; justify-content:flex-end; margin-top:18px; }
.ttwarn { background:rgba(253,203,110,.07); border:1px solid rgba(253,203,110,.2); border-radius:3px; padding:9px 11px; font-size:10px; color:#fdcb6e; margin-bottom:12px; }
.divider { height:1px; background:var(--border); margin:18px 0; }
.chip { font-family:var(--mono); font-size:8px; padding:2px 5px; border-radius:2px; }
.cig { background:rgba(131,58,180,.2); color:#c77dff; }
.cyt { background:rgba(255,0,0,.15); color:#ff6b6b; }
.ctt { background:rgba(255,255,255,.07); color:#888; }
.hdot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
.hg { background:var(--green); box-shadow:0 0 5px var(--green); }
.hr { background:var(--red); box-shadow:0 0 5px var(--red); }
.hd { background:#333; }
.avgline { display:flex; align-items:center; gap:7px; font-family:var(--mono); font-size:9px; color:var(--text3); margin-bottom:10px; }
.albar { flex:1; height:1px; background:rgba(214,48,49,.3); }
.ctt { content:''; }
.stitle { font-family:var(--display); font-size:20px; letter-spacing:1px; margin-bottom:3px; color:var(--text); cursor:default; user-select:none; }
.sdesc { font-size:12px; color:var(--text2); margin-bottom:12px; cursor:default; }
.sh { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.sht { font-family:var(--display); font-size:18px; letter-spacing:1px; color:var(--text); cursor:default; user-select:none; }
.ct { font-family:var(--mono); font-size:8px; }
`;

const fmt = n => {
  if (typeof n === "string") return n;
  if (n >= 1000000) return (n/1000000).toFixed(1)+"M";
  if (n >= 1000) return (n/1000).toFixed(1)+"K";
  return String(n);
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

const platEmoji = {instagram:"📸",youtube:"▶️",tiktok:"🎵"};
const platColors = {instagram:"#c77dff",youtube:"#ff6b6b",tiktok:"#888"};
const platMap = {ig:"instagram",yt:"youtube",tt:"tiktok"};

function Overview({ onBrand }) {
  const [time, setTime] = useState("ALL TIME");
  const { connectedHandles, channelData } = useYouTubeContext();
  const brands = connectedHandles.map((h)=>channelData[h]).filter(Boolean);

  const viewsData = (()=>{
    const byDate = {};
    brands.forEach((b)=>{
      (b.dailyViews||[]).forEach((row)=>{
        const key=row.raw||row.d;
        if(!byDate[key]) byDate[key]={d:row.d,raw:key,ig:0,yt:0,tt:0};
        byDate[key].yt+=(row.yt||0);
      });
    });
    return Object.values(byDate).sort((a,b)=>(a.raw||"").localeCompare(b.raw||""));
  })();

  const totalViews = brands.reduce((s,b)=>s+(b.totalViews||0),0);
  const totalFollowers = brands.reduce((s,b)=>s+(b.platform?.followers||0),0);
  const allPosts = brands.flatMap(b=>(b.posts||[]).map(p=>({...p,_brand:b.platform?.handle})));
  const avgViews = allPosts.length?Math.round(allPosts.reduce((s,p)=>s+p.views,0)/allPosts.length):0;
  const totalEngagement = allPosts.reduce((s,p)=>s+(p.likes||0)+(p.cmts||0)+(p.shares||0),0);

  return (
    <div>
      <div className="topbar">
        <span className="topbar-title">COMPANY OVERVIEW</span>
        <div className="tr">
          <div className="tpill">{["7D","30D","90D","ALL TIME"].map(t=><button key={t} className={`tbtn${time===t?" act":""}`} onClick={()=>setTime(t)}>{t}</button>)}</div>
          <button className="ibtn">⟳ SYNC ALL</button>
        </div>
      </div>
      <div className="page">
        <div className="krow" style={{gridTemplateColumns:"repeat(5,1fr)"}}>
          {[
            {l:"Total Views",v:fmt(totalViews),s:"All platforms"},
            {l:"Followers",v:fmt(totalFollowers),s:"Connected channels"},
            {l:"Avg Views/Post",v:avgViews?fmt(avgViews):"—",s:"All videos"},
            {l:"Total Reach",v:fmt(totalViews),s:"Unique views"},
            {l:"Engagement",v:fmt(totalEngagement),s:"Likes+cmts+shares"},
          ].map(k=>(
            <div key={k.l} className="kcard">
              <div className="klbl">{k.l}</div>
              <div className="kval">{k.v}</div>
              <div className="ksub">{k.s}</div>
            </div>
          ))}
        </div>

        <div className="g2">
          <div className="panel">
            <div className="ph"><span className="ptitle">VIEWS OVER TIME</span></div>
            {viewsData.length>0 ? (
            <ResponsiveContainer width="100%" height={170}>
              <AreaChart data={viewsData} margin={{top:0,right:0,bottom:0,left:-22}}>
                <defs>
                  {[["yt","#ff6b6b"]].map(([k,c])=>(
                    <linearGradient key={k} id={`g${k}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={c} stopOpacity={0.25}/>
                      <stop offset="95%" stopColor={c} stopOpacity={0}/>
                    </linearGradient>
                  ))}
                </defs>
                <XAxis dataKey="d" tick={{fontFamily:"DM Mono",fontSize:8,fill:"#444"}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontFamily:"DM Mono",fontSize:8,fill:"#444"}} axisLine={false} tickLine={false} tickFormatter={fmt}/>
                <Tooltip content={<TTip/>} cursor={{stroke:"#444",strokeWidth:1}}/>
                <Area type="monotone" dataKey="yt" stroke="#ff6b6b" strokeWidth={2} fill="url(#gyt)" name="YouTube" dot={{r:4,fill:"#ff6b6b",strokeWidth:0}} activeDot={{r:5,stroke:"#fff",strokeWidth:2}} isAnimationActive={false}/>
              </AreaChart>
            </ResponsiveContainer>
            ) : (
              <div style={{height:170,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text3)",fontSize:12}}>Connect YouTube + OAuth, then sync a channel for daily view data.</div>
            )}
            <div style={{display:"flex",gap:14,marginTop:7}}>
              <div style={{display:"flex",alignItems:"center",gap:5,fontFamily:"DM Mono",fontSize:9,color:"#555"}}>
                <div style={{width:10,height:2,background:"#ff6b6b",borderRadius:1}}/>YouTube
              </div>
            </div>
          </div>
          <div className="panel" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,alignItems:"stretch",minHeight:170}}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",minHeight:0,width:"100%"}}>
              <div className="ptitle" style={{fontSize:12,marginBottom:4,alignSelf:"stretch"}}>PLATFORM SPLIT</div>
              <div style={{width:"100%",display:"flex",justifyContent:"center"}}>
              <ResponsiveContainer width={180} height={150}>
                <PieChart>
                  <Pie
                    data={totalViews>0?[{name:"YT",value:100,color:"#ff6b6b"}]:[{name:"—",value:1,color:"#333"}]}
                    dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={70} strokeWidth={0}
                    label={({name,percent,cx,cy,midAngle,innerRadius,outerRadius})=>{
                      const R=Math.PI/180; const r=(innerRadius+outerRadius)/2+12;
                      const x=cx+r*Math.cos(-midAngle*R), y=cy+r*Math.sin(-midAngle*R);
                      return <text x={x} y={y} fill="#f5f2ed" textAnchor="middle" dominantBaseline="central" style={{fontSize:14,fontFamily:"DM Mono",fontWeight:500}}>{name} {(percent*100).toFixed(0)}%</text>;
                    }}
                    labelLine={false}
                  >
                    {totalViews>0?<Cell fill="#ff6b6b"/>:<Cell fill="#333"/>}
                  </Pie>
</PieChart>
                </ResponsiveContainer>
              </div>
              </div>
            <div style={{display:"flex",flexDirection:"column",gap:8,minHeight:0}}>
              <div className="ptitle" style={{fontSize:12,marginBottom:4}}>TOP POSTS</div>
              {(()=>{
                const top2 = [...allPosts].sort((a,b)=>b.views-a.views).slice(0,2);
                if(!top2.length) return <div style={{fontSize:10,color:"var(--text3)",padding:"8px 0"}}>Sync a channel to see top posts</div>;
                return top2.map((p)=>(
                  <div key={p.id} style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:4,padding:8,borderLeft:"3px solid var(--red)",flex:1,minHeight:0,display:"flex",flexDirection:"column",justifyContent:"center"}}>
                    <div style={{fontSize:9,color:"var(--text3)",marginBottom:2}}>{p._brand||"YouTube"} · ▶️</div>
                    <div style={{fontSize:10,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.cap}</div>
                    <div style={{fontFamily:"var(--display)",fontSize:15,color:"var(--text)",marginTop:2}}>{fmt(p.views)} views</div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>

        <div className="sh" style={{marginBottom:12}}>
          <span className="sht">CHANNELS</span>
          <span style={{fontFamily:"DM Mono",fontSize:9,color:"var(--text3)"}}>{brands.length} CONNECTED</span>
        </div>

        <div className="bgrid">
          {brands.length===0 ? (
            <div style={{gridColumn:"1/-1",textAlign:"center",padding:40,color:"var(--text3)",border:"1px dashed var(--border2)",borderRadius:5}}>
              <div style={{fontSize:14,marginBottom:8}}>No channels yet</div>
              <div style={{fontSize:11}}>Go to <strong>Accounts</strong> → sync a YouTube channel to get started</div>
            </div>
          ) : brands.map(b=>{
            const pf=b.platform; const short=(pf?.handle||"??").split(" ").slice(-1)[0].slice(0,2).toUpperCase();
            return (
            <div key={b.channel?.id} className="bcard" onClick={()=>onBrand(pf?.handle)}>
              <div className="bcard-top">
                <div style={{display:"flex",alignItems:"center",gap:9}}>
                  <div className="b-avatar" style={{background:"#ff6b6b18",color:"#ff6b6b",border:"1px solid #ff6b6b28",fontSize:10}}>YT</div>
                  <span className="bcard-name">{short}</span>
                </div>
                <span className="bstatus s-active">active</span>
              </div>
              <div className="bstats">
                <div><div className="mstat-val">{fmt(pf?.followers||0)}</div><div className="mstat-lbl">Followers</div></div>
                <div><div className="mstat-val">{fmt(b.totalViews||0)}</div><div className="mstat-lbl">Views</div></div>
              </div>
              <div style={{display:"flex",gap:8,marginTop:10}}>
                <div style={{display:"flex",alignItems:"center",gap:3,fontFamily:"DM Mono",fontSize:8}}>
                  <div className="hdot hg"/>
                  <span style={{color:"#444"}}>YT</span>
                </div>
              </div>
            </div>
          );})}
        </div>
      </div>
    </div>
  );
}

function BrandView({ brandId, onBack }) {
  const { getChannelData, channelData } = useYouTubeContext();
  const brand = brandId ? (channelData[brandId] || Object.values(channelData).find(b=>b.platform?.handle===brandId||b.channel?.title===brandId)) : null;
  const [ap, setAp] = useState("youtube");
  const [time, setTime] = useState("ALL TIME");
  if (!brand) return null;

  const plat = brand.platform;
  const posts = brand.posts || [];
  const avgV = posts.length ? Math.round(posts.reduce((s,p)=>s+p.views,0)/posts.length) : 0;
  const dailyViews = brand.dailyViews || [];
  const wklyData = (()=>{
    const byWeek = {};
    dailyViews.forEach(row=>{
      const d=new Date(row.raw); const w=getWeekKey(d);
      if(!byWeek[w]) byWeek[w]={n:w,v:0};
      byWeek[w].v+=(row.yt||0);
    });
    return Object.values(byWeek).sort((a,b)=>a.n.localeCompare(b.n));
  })();
  function getWeekKey(d){ const start=new Date(d); start.setDate(1); const w=Math.ceil(d.getDate()/7); return `${start.toLocaleString("en",{month:"short"})} W${w}`; }

  return (
    <div>
      <div className="topbar">
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button className="ibtn" onClick={onBack}>← BACK</button>
          <span className="topbar-title">{plat?.handle||brand.channel?.title}</span>
          <span className="bstatus s-active">active</span>
        </div>
        <div className="tr">
          <div className="tpill">{["7D","30D","90D","ALL TIME"].map(t=><button key={t} className={`tbtn${time===t?" act":""}`} onClick={()=>setTime(t)}>{t}</button>)}</div>
        </div>
      </div>
      <div className="page">
        <div className="krow" style={{gridTemplateColumns:"repeat(4,1fr)"}}>
          {[
            {l:"Followers",v:fmt(plat?.followers||0)},{l:"Total Views",v:fmt(brand.totalViews||0)},
            {l:"Avg Views/Post",v:plat?.avgViews||fmt(avgV)},{l:"Videos",v:(posts.length||0)+""},
          ].map(k=>(
            <div key={k.l} className="kcard"><div className="klbl">{k.l}</div><div className="kval">{k.v}</div></div>
          ))}
        </div>

        <div className="ptabs">
          <div className={`ptab${ap==="youtube"?" act":""}`} onClick={()=>setAp("youtube")}>
            ▶️ YOUTUBE
          </div>
        </div>

        {(
          <div>
            <div className="g2">
              <div className="panel">
                <div className="ph"><span className="ptitle">WEEKLY VIEWS</span></div>
                {wklyData.length>0 ? (
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={wklyData} margin={{top:0,right:0,bottom:0,left:-22}}>
                    <XAxis dataKey="n" tick={{fontFamily:"DM Mono",fontSize:8,fill:"#444"}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontFamily:"DM Mono",fontSize:8,fill:"#444"}} axisLine={false} tickLine={false} tickFormatter={fmt}/>
                    <Tooltip content={<TTip/>}/>
                    <Bar dataKey="v" fill="#ff6b6b" radius={[2,2,0,0]} opacity={0.8} name="Views" dot={{r:3,fill:"#ff6b6b"}}/>
                  </BarChart>
                </ResponsiveContainer>
                ) : (
                  <div style={{height:150,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text3)",fontSize:11}}>Connect OAuth for weekly view data</div>
                )}
              </div>
              <div className="panel">
                <div className="ph"><span className="ptitle">ACCOUNT STATS</span></div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                  {[["Handle",plat?.handle],["Followers",fmt(plat?.followers)],["Avg Views",plat?.avgViews||fmt(avgV)],["Last Post",plat?.last]].map(([l,v])=>(
                    <div key={l}>
                      <div style={{fontFamily:"DM Mono",fontSize:8,color:"#444",letterSpacing:2,textTransform:"uppercase",marginBottom:3}}>{l}</div>
                      <div style={{fontFamily:"Bebas Neue",fontSize:19,letterSpacing:1}}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="ph">
                <span className="ptitle">POST FEED — {ap.toUpperCase()}</span>
                <span className="pact">AVG {fmt(avgV)} VIEWS/POST</span>
              </div>
              {posts.length===0 ? (
                <div style={{textAlign:"center",padding:"30px",color:"var(--text3)",fontSize:12}}>No posts synced yet.</div>
              ) : (
                <>
                  <div className="avgline">
                    <span style={{color:"var(--red)",fontFamily:"DM Mono",fontSize:9,whiteSpace:"nowrap"}}>▶ AVG {fmt(avgV)}</span>
                    <div className="albar"/>
                    <span style={{color:"#333",fontSize:8}}>THRESHOLD</span>
                  </div>
                  <div className="pgrid">
                    {posts.map(p=>(
                      <div key={p.id} className={`pcard${(p.views||0)<avgV?" ba":""}`}>
                        <div className="pthumb">
                          <span>{p.emoji||"▶️"}</span>
                          {(p.views||0)<avgV&&<span className="bab">BELOW AVG</span>}
                        </div>
                        <div className="pbody">
                          <div className="pcap">{p.cap}</div>
                          <div className="pvbig">{fmt(p.views)} views</div>
                          <div className="psr">
                            <div className="pst">❤️ <span>{fmt(p.likes)}</span></div>
                            <div className="pst">💬 <span>{p.cmts}</span></div>
                            <div className="pst">↗️ <span>{p.shares}</span></div>
                          </div>
                          {p.sr!==null&&(
                            <div style={{marginTop:7}}>
                              <div style={{display:"flex",justifyContent:"space-between",fontFamily:"DM Mono",fontSize:8,color:"#444",marginBottom:2}}>
                                <span>SKIP RATE</span>
                                <span style={{color:p.sr>0.5?"var(--red)":"#666"}}>{Math.round(p.sr*100)}%</span>
                              </div>
                              <div className="srbar"><div className="srfill" style={{width:`${p.sr*100}%`}}/></div>
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
        )}
      </div>
    </div>
  );
}

function Settings({ brands, addBrand, removeBrand, addHandleToBrand, removeHandleFromBrand, saveBrands }) {
  const [modal, setModal] = useState(null);
  const [ytHandle, setYtHandle] = useState("");
  const [ytLoading, setYtLoading] = useState(false);
  const [ytError, setYtError] = useState(null);
  const [syncBrandId, setSyncBrandId] = useState(null);
  const [newBrandName, setNewBrandName] = useState("");
  const { apiKey, accessToken, fetchChannel, removeChannel, channelData } = useYouTubeContext();

  const ic = p => p==="instagram"?"pig":p==="youtube"?"pyt":"ptt";
  const ie = p => p==="instagram"?"📸":p==="youtube"?"▶️":"🎵";

  const handleSync = async (targetBrandId) => {
    if (!apiKey || !ytHandle.trim()) return;
    setYtLoading(true); setYtError(null);
    try {
      const entry = await fetchChannel(ytHandle.trim());
      const handle = entry?.platform?.handle || entry?.channel?.title;
      if (handle) {
        if (targetBrandId) addHandleToBrand(targetBrandId, handle);
        else { const id = crypto.randomUUID(); saveBrands([...brands, { id, name: handle, color: "#d63031", handles: [handle] }]); }
        setYtHandle(""); setSyncBrandId(null);
      }
    } catch (e) { setYtError(e.message); }
    setYtLoading(false);
  };

  return (
    <div>
      <div className="topbar">
        <span className="topbar-title">ACCOUNT MANAGER</span>
        <div className="tr">
          <button className="ibtn primary" onClick={()=>setModal("brand")}>+ ADD BRAND</button>
        </div>
      </div>
      <div className="page">
        <div style={{marginBottom:24}}>
          <div className="stitle">CONNECTED ACCOUNTS</div>
          <div className="sdesc">Add brands to group accounts. Add accounts under each brand via YouTube sync below.</div>
          <button className="addbtn" onClick={()=>setModal("brand")} style={{marginBottom:12}}>+ Add brand</button>
          {brands.length===0 ? (
            <div style={{padding:20,textAlign:"center",color:"var(--text3)",fontSize:12,border:"1px dashed var(--border2)",borderRadius:4}}>No brands yet. Add a brand above, then sync a YouTube channel below to add accounts.</div>
          ) : brands.map(b=>(
            <div key={b.id} style={{marginBottom:16,border:"1px solid var(--border)",borderRadius:5,overflow:"hidden",background:"var(--surface)"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"var(--surface2)",borderBottom:"1px solid var(--border)"}}>
                <span style={{fontFamily:"var(--display)",fontSize:14,letterSpacing:1,color:"var(--text)"}}>{b.name}</span>
                <button className="ibtn danger" style={{padding:"3px 8px",fontSize:9}} onClick={()=>removeBrand(b.id)}>✕ Remove</button>
              </div>
              <div style={{padding:12}}>
                {b.handles.map(h=>{
                  const d = channelData[h];
                  if (!d) return null;
                  const a = { handle: h, ...(d?.platform||{}), plat: "youtube" };
                  return (
                    <div key={a.handle} className="arow">
                      <div className={`picon ${ic(a.plat)}`}>{ie(a.plat)}</div>
                      <div className="ainfo">
                        <div className="ahandle">{a.handle}</div>
                        <div className="atag">{a.plat}</div>
                      </div>
                      <div className="ameta">
                        <span>{a.followers ? fmt(a.followers)+" subs" : "—"}</span><br/>
                        <span className="chip cig">ACTIVE</span>
                      </div>
                      <div className="aacts">
                        <button className="ibtn" title="Re-sync" onClick={async()=>{setYtHandle(a.handle); setYtLoading(true); try{await fetchChannel(a.handle);}catch(e){setYtError(e.message);} setYtLoading(false);}}>⟳</button>
                        <button className="ibtn danger" onClick={()=>{removeChannel(a.handle); removeHandleFromBrand(b.id, a.handle);}}>✕ Remove</button>
                      </div>
                    </div>
                  );
                })}
                <div style={{marginTop:8}}>
                  <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                    <input className="finput" placeholder="e.g. @RawTruth.Podcast" value={syncBrandId===b.id?ytHandle:""} onChange={e=>{setYtHandle(e.target.value);setYtError(null);}} style={{width:200}} onFocus={()=>setSyncBrandId(b.id)}/>
                    <button className="ibtn primary" disabled={!apiKey||ytLoading} onClick={()=>handleSync(b.id)}>{ytLoading&&syncBrandId===b.id?"Syncing…":"+ Add YouTube channel"}</button>
                  </div>
                  {syncBrandId===b.id&&ytError&&<div style={{marginTop:6,fontSize:11,color:"var(--red)"}}>{ytError}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="divider"/>

        <div style={{marginBottom:20}}>
          <div className="stitle">YOUTUBE API</div>
          <div className="sdesc">Sync a YouTube channel by handle or name. OAuth enables daily views &amp; analytics. Choose a brand above or create new.</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"center",marginBottom:12}}>
            <span className={`chip ${apiKey?"cig":"ctt"}`}>{apiKey?"API KEY OK":"NO API KEY"}</span>
            {import.meta.env.VITE_GOOGLE_CLIENT_ID&&(
              <span className={`chip ${accessToken?"cig":"ctt"}`}>{accessToken?"OAUTH CONNECTED":"OAUTH NOT CONNECTED"}</span>
            )}
          </div>
          {import.meta.env.VITE_GOOGLE_CLIENT_ID&&!accessToken&&(
            <YouTubeLoginButton onSuccess={()=>{}} style={{marginBottom:12}}/>
          )}
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            <input className="finput" placeholder="e.g. @RawTruth.Podcast" value={ytHandle} onChange={e=>{setYtHandle(e.target.value);setYtError(null);}} style={{width:260}}/>
            <span style={{fontSize:10,color:"var(--text3)"}}>Add to brand:</span>
            <select className="fselect" value={syncBrandId||""} onChange={e=>setSyncBrandId(e.target.value||null)} style={{width:160}}>
              <option value="">+ New brand</option>
              {brands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <button className="ibtn primary" disabled={!apiKey||ytLoading} onClick={()=>handleSync(syncBrandId)}>{ytLoading?"Syncing…":"SYNC CHANNEL"}</button>
          </div>
          {ytError&&<div style={{marginTop:8,fontSize:11,color:"var(--red)"}}>{ytError}</div>}
        </div>

      </div>

      {modal==="brand"&&(
        <div className="ovrl" onClick={()=>{setModal(null);setNewBrandName("");}}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="mtitle">ADD BRAND</div>
            <div className="msub">Create a new brand to group accounts under.</div>
            <div className="fg"><label className="flbl">Brand Name</label><input className="finput" placeholder="e.g. Raw Truth Podcast" value={newBrandName} onChange={e=>setNewBrandName(e.target.value)}/></div>
            <div className="fg"><label className="flbl">Brand Color</label>
              <input className="finput" type="color" defaultValue="#d63031" style={{height:40,padding:3,cursor:"pointer"}}/></div>
            <div className="macts">
              <button className="ibtn" onClick={()=>{setModal(null);setNewBrandName("");}}>Cancel</button>
              <button className="ibtn primary" onClick={()=>{addBrand(newBrandName||"New Brand"); setModal(null); setNewBrandName("");}}>CREATE BRAND</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const STORAGE_KEY = "tambareni-nav";
const BRANDS_KEY = "tambareni-brands";

function loadNav() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v) { const j = JSON.parse(v); return { page: j.page || "overview", brandId: j.brandId || null }; }
  } catch {}
  return { page: "overview", brandId: null };
}

function saveNav(page, brandId) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ page, brandId })); } catch {}
}

function loadBrands() {
  try {
    const v = localStorage.getItem(BRANDS_KEY);
    if (v) return JSON.parse(v);
  } catch {}
  return [];
}

export default function App() {
  const [nav, setNav] = useState(loadNav);
  const [brands, setBrands] = useState(loadBrands);
  const { connectedHandles, channelData, removeChannel } = useYouTubeContext();

  const page = nav.page;
  const brandId = nav.brandId;
  const go = (p, id=null) => {
    const next = { page: p, brandId: id ?? (p==="brand"?brandId:null) };
    setNav(next);
    saveNav(next.page, next.brandId);
  };

  const allHandles = [...new Set(brands.flatMap(b=>b.handles))];
  const channelBrands = brands.flatMap(b=>b.handles.map(h=>({handle:h,brand:b})));
  const brandsWithData = allHandles.map(h=>channelData[h]).filter(Boolean);

  const saveBrands = (next) => {
    setBrands(next);
    try { localStorage.setItem(BRANDS_KEY, JSON.stringify(next)); } catch {}
  };

  const addBrand = (name) => {
    const id = crypto.randomUUID();
    saveBrands([...brands, { id, name, color: "#d63031", handles: [] }]);
  };

  const removeBrand = (id, removeChannelFn) => {
    const b = brands.find(x=>x.id===id);
    if (b?.handles) b.handles.forEach(h=>removeChannelFn?.(h));
    saveBrands(brands.filter(b=>b.id!==id));
  };

  const addHandleToBrand = (brandId, handle) => {
    saveBrands(brands.map(b=>b.id===brandId?{...b,handles:[...new Set([...b.handles,handle])]}:b));
  };

  const removeHandleFromBrand = (brandId, handle) => {
    saveBrands(brands.map(b=>b.id===brandId?{...b,handles:b.handles.filter(h=>h!==handle)}:b));
  };

  useEffect(() => {
    if (brands.length===0 && connectedHandles.length>0) {
      const mig = [{ id: crypto.randomUUID(), name: "Channels", color: "#d63031", handles: [...connectedHandles] }];
      setBrands(mig);
      try { localStorage.setItem(BRANDS_KEY, JSON.stringify(mig)); } catch {}
    }
  }, []);

  return (
    <>
      <style>{FONTS}{css}</style>
      <div className="app">
        <div className="sidebar">
          <div className="logo-area">
            <div className="logo-text">TAMBARENI<br/>MEDIA<br/>ANALYTICS</div>
          </div>
          <div className="nav-sec">
            <div className="nav-lbl">Navigation</div>
            <div className={`nav-item${page==="overview"?" act":""}`} onClick={()=>go("overview")}>
              <div className="nav-dot" style={{background:"#d63031"}}/>Overview
            </div>
            <div className={`nav-item${page==="settings"?" act":""}`} onClick={()=>go("settings")}>
              <div className="nav-dot" style={{background:"#444"}}/>Accounts
            </div>
          </div>
          <div className="nav-sec">
            <div className="nav-lbl">Channels</div>
            {brandsWithData.map(b=>{
              const h=b.platform?.handle; const short=(h||"?").split(" ").slice(-1)[0].slice(0,2).toUpperCase();
              return (
              <div key={b.channel?.id} className={`brand-item${page==="brand"&&brandId===h?" act":""}`} onClick={()=>go("brand",h)}>
                <div className="b-avatar" style={{background:"#ff6b6b18",color:"#ff6b6b",border:"1px solid #ff6b6b25",fontSize:10}}>YT</div>
                <span style={{flex:1,fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{short}</span>
              </div>
            );})}
          </div>
          <div style={{marginTop:"auto",padding:"14px 18px",borderTop:"1px solid var(--border)"}}>
            <div style={{fontFamily:"DM Mono",fontSize:8,color:"#333",letterSpacing:2}}>LAST SYNC<br/><span style={{color:"#555",fontSize:9}}>2h ago — All OK</span></div>
          </div>
        </div>
        <div className="main" onMouseDown={e=>{
          const el=document.activeElement, t=e.target;
          if ((el?.tagName==="INPUT"||el?.tagName==="TEXTAREA")&&!t.closest("input,textarea,select,button")) el.blur();
        }}>
          {page==="overview"&&<Overview onBrand={id=>go("brand",id)}/>}
          {page==="brand"&&<BrandView brandId={brandId} onBack={()=>go("overview")}/>}
          {page==="settings"&&<Settings brands={brands} addBrand={addBrand} removeBrand={id=>removeBrand(id,removeChannel)} addHandleToBrand={addHandleToBrand} removeHandleFromBrand={removeHandleFromBrand} saveBrands={saveBrands} removeChannel={removeChannel}/>}
        </div>
      </div>
    </>
  );
}
