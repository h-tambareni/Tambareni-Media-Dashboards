import { useState, useEffect } from "react";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500;600;700&display=swap');`;

export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0);
  const [visible, setVisible] = useState({});

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible((prev) => ({ ...prev, [e.target.dataset.anim]: true }));
          }
        });
      },
      { threshold: 0.15 }
    );
    document.querySelectorAll("[data-anim]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const parallax = (factor) => `translateY(${scrollY * factor}px)`;

  return (
    <>
      <style>{FONTS}{landingCSS}</style>
      <div className="landing">
        {/* ── NAV ── */}
        <nav className={`lnav${scrollY > 60 ? " scrolled" : ""}`}>
          <div className="lnav-inner">
            <div className="lnav-brand">
              <img src="/logo/cameleo-logo.svg" alt="Cameleo Studio" className="lnav-logo" />
              <span className="lnav-name">CAMELEO STUDIO</span>
            </div>
            <div className="lnav-links">
              <a href="#about" className="lnav-link">About</a>
              <a href="#arms" className="lnav-link">What We Do</a>
              <a href="mailto:contact@cameleostudio.com" className="lnav-cta">Get In Touch</a>
            </div>
          </div>
        </nav>

        {/* ── HERO ── */}
        <section className="hero">
          <div className="hero-bg" style={{ transform: parallax(-0.3) }}>
            <div className="hero-glow glow1" />
            <div className="hero-glow glow2" />
            <div className="hero-grid" />
          </div>
          <div className="hero-content">
            <div className="hero-badge">Creative Studio & Technology Lab</div>
            <h1 className="hero-title">
              We build brands<br />
              <span className="hero-accent">that adapt.</span>
            </h1>
            <p className="hero-sub">
              Cameleo Studio is a dual-arm creative and technology company.
              We craft compelling media that grows audiences, and build software products that monetize attention.
            </p>
            <div className="hero-actions">
              <a href="#arms" className="btn-primary">See What We Do</a>
              <a href="mailto:contact@cameleostudio.com" className="btn-outline">Get In Touch</a>
            </div>
          </div>
          <div className="hero-scroll-hint">
            <div className="scroll-line" />
          </div>
        </section>

        {/* ── ABOUT ── */}
        <section className="section" id="about">
          <div className="section-inner" data-anim="about">
            <div className={`fade-up${visible.about ? " show" : ""}`}>
              <div className="section-label">Who We Are</div>
              <h2 className="section-title">A studio built on<br /><span className="accent">adaptability.</span></h2>
              <p className="section-text">
                Like our namesake, we adapt. Cameleo Studio operates at the intersection of creative media and technology.
                Two disciplines that move fast and reward those who can shift with the landscape. We don't just keep up.
                We build the tools to stay ahead.
              </p>
            </div>
          </div>
        </section>

        {/* ── TWO ARMS ── */}
        <section className="section dark" id="arms">
          <div className="section-inner">
            <div className="section-label" data-anim="arms-label">
              <span className={`fade-up${visible["arms-label"] ? " show" : ""}`}>One Studio, Two Arms</span>
            </div>
            <div className="arms-grid">
              <div className={`arm-card${visible["arm-media"] ? " show" : ""}`} data-anim="arm-media">
                <div className="arm-icon">
                  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="6" y="10" width="36" height="24" rx="3" />
                    <polygon points="20,16 32,22 20,28" fill="currentColor" stroke="none" />
                    <line x1="14" y1="38" x2="34" y2="38" />
                    <line x1="24" y1="34" x2="24" y2="38" />
                  </svg>
                </div>
                <div className="arm-label">ARM 01</div>
                <h3 className="arm-title">Media</h3>
                <p className="arm-desc">
                  We produce, manage, and grow multi-platform media brands across YouTube, TikTok, Instagram, and podcasting.
                  Our in-house analytics platform tracks every metric that matters, from daily subscriber growth
                  to skip rates and audience retention, so content decisions are always data-driven.
                </p>
                <ul className="arm-list">
                  <li>Automated AI content production</li>
                  <li>Multi-platform content strategy</li>
                  <li>Real-time analytics &amp; growth tracking</li>
                  <li>Newsletter &amp; web audience development</li>
                  <li>Podcast production &amp; distribution</li>
                </ul>
              </div>

              <div className={`arm-card${visible["arm-tech"] ? " show" : ""}`} data-anim="arm-tech">
                <div className="arm-icon">
                  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="4" y="6" width="40" height="30" rx="3" />
                    <polyline points="16,18 12,22 16,26" />
                    <polyline points="32,18 36,22 32,26" />
                    <line x1="22" y1="16" x2="26" y2="28" />
                    <line x1="14" y1="40" x2="34" y2="40" />
                    <line x1="20" y1="36" x2="28" y2="36" />
                    <line x1="24" y1="36" x2="24" y2="40" />
                  </svg>
                </div>
                <div className="arm-label">ARM 02</div>
                <h3 className="arm-title">Products</h3>
                <p className="arm-desc">
                  We design and engineer software products from zero to launch. Our tech arm builds mobile apps,
                  web platforms, and internal tooling, including the proprietary analytics dashboard
                  that powers our media operations.
                </p>
                <ul className="arm-list">
                  <li>Mobile app development (React Native / Expo)</li>
                  <li>Full-stack web applications</li>
                  <li>Custom analytics &amp; data pipelines</li>
                  <li>API integrations &amp; serverless infrastructure</li>
                  <li>Product design &amp; rapid prototyping</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="section cta-section">
          <div className="section-inner" data-anim="cta">
            <div className={`fade-up${visible.cta ? " show" : ""}`}>
              <h2 className="cta-title">Let's build something together.</h2>
              <p className="cta-sub">Whether you need a media strategy, a product built from scratch, or both. We're ready.</p>
              <a href="mailto:contact@cameleostudio.com" className="btn-primary large">contact@cameleostudio.com</a>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="lfooter">
          <div className="lfooter-inner">
            <div className="lfooter-brand">
              <img src="/logo/cameleo-logo.svg" alt="" className="lfooter-logo" />
              <span>CAMELEO STUDIO</span>
            </div>
            <div className="lfooter-right">
              <a href="mailto:contact@cameleostudio.com" className="lfooter-email">contact@cameleostudio.com</a>
              <div className="lfooter-copy">&copy; {new Date().getFullYear()} Cameleo Studio. All rights reserved.</div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

/* ── STYLES ── */
const landingCSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }

.landing {
  font-family: 'DM Sans', system-ui, sans-serif;
  background: #050505;
  color: #f5f2ed;
  min-height: 100vh;
  overflow-x: hidden;
}

/* ── NAV ── */
.lnav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  padding: 16px 32px;
  transition: all 0.3s;
}
.lnav.scrolled {
  background: rgba(5,5,5,0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  padding: 10px 32px;
}
.lnav-inner {
  max-width: 1200px; margin: 0 auto;
  display: flex; align-items: center; justify-content: space-between;
}
.lnav-brand { display: flex; align-items: center; gap: 10px; }
.lnav-logo { width: 36px; height: 36px; border-radius: 6px; }
.lnav-name { font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 3px; }
.lnav-links { display: flex; align-items: center; gap: 28px; }
.lnav-link {
  font-size: 13px; color: #b0ada8; text-decoration: none; letter-spacing: 0.5px;
  transition: color 0.2s;
}
.lnav-link:hover { color: #f5f2ed; }
.lnav-cta {
  font-family: 'DM Mono', monospace; font-size: 12px;
  padding: 8px 18px; border-radius: 6px;
  background: #d63031; color: white; border: none; cursor: pointer;
  letter-spacing: 0.5px; transition: all 0.2s;
}
.lnav-cta:hover { background: #e84142; transform: translateY(-1px); }

/* ── HERO ── */
.hero {
  position: relative; min-height: 100vh; display: flex; align-items: center; justify-content: center;
  overflow: hidden; padding: 120px 32px 80px;
}
.hero-bg {
  position: absolute; inset: 0; z-index: 0; pointer-events: none;
}
.hero-glow {
  position: absolute; border-radius: 50%; filter: blur(120px); opacity: 0.12;
}
.glow1 { width: 600px; height: 600px; background: #d63031; top: -100px; right: -100px; }
.glow2 { width: 500px; height: 500px; background: #6c5ce7; bottom: -100px; left: -100px; }
.hero-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
  background-size: 60px 60px;
}
.hero-content { position: relative; z-index: 1; max-width: 720px; text-align: center; }
.hero-badge {
  display: inline-block; font-family: 'DM Mono', monospace; font-size: 11px;
  letter-spacing: 2px; text-transform: uppercase; color: #d63031;
  border: 1px solid rgba(214,48,49,0.3); padding: 6px 16px; border-radius: 20px;
  margin-bottom: 28px;
}
.hero-title {
  font-family: 'Bebas Neue', sans-serif; font-size: clamp(48px, 8vw, 96px);
  line-height: 1.0; letter-spacing: 2px; margin-bottom: 24px;
}
.hero-accent { color: #d63031; }
.hero-sub {
  font-size: 17px; line-height: 1.7; color: #b0ada8; max-width: 560px; margin: 0 auto 40px;
}
.hero-actions { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
.btn-primary {
  font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 14px;
  padding: 14px 32px; border-radius: 8px;
  background: #d63031; color: white; border: none; cursor: pointer;
  transition: all 0.2s; letter-spacing: 0.3px;
}
.btn-primary:hover { background: #e84142; transform: translateY(-2px); box-shadow: 0 8px 30px rgba(214,48,49,0.3); }
.btn-primary.large { font-size: 16px; padding: 18px 40px; }
.btn-outline {
  font-family: 'DM Sans', sans-serif; font-weight: 500; font-size: 14px;
  padding: 14px 32px; border-radius: 8px;
  background: transparent; color: #f5f2ed; border: 1px solid rgba(255,255,255,0.15);
  cursor: pointer; transition: all 0.2s; text-decoration: none; display: inline-flex; align-items: center;
}
.btn-outline:hover { border-color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.03); }
.hero-scroll-hint {
  position: absolute; bottom: 32px; left: 50%; transform: translateX(-50%);
}
.scroll-line {
  width: 1px; height: 48px; background: linear-gradient(to bottom, rgba(255,255,255,0.3), transparent);
  animation: scrollPulse 2s ease-in-out infinite;
}
@keyframes scrollPulse {
  0%, 100% { opacity: 0.3; transform: scaleY(1); }
  50% { opacity: 0.8; transform: scaleY(1.2); }
}

/* ── SECTIONS ── */
.section { padding: 100px 32px; }
.section.dark { background: #0a0a0a; }
.section-inner { max-width: 1100px; margin: 0 auto; }
.section-label {
  font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 3px;
  text-transform: uppercase; color: #d63031; margin-bottom: 20px;
}
.section-title {
  font-family: 'Bebas Neue', sans-serif; font-size: clamp(36px, 5vw, 56px);
  line-height: 1.1; letter-spacing: 1px; margin-bottom: 24px;
}
.accent { color: #d63031; }
.section-text { font-size: 16px; line-height: 1.8; color: #b0ada8; max-width: 640px; }

/* ── ARMS ── */
.arms-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 48px; }
.arm-card {
  background: #111; border: 1px solid #1e1e1e; border-radius: 12px;
  padding: 40px 36px; transition: all 0.5s; opacity: 0; transform: translateY(40px);
}
.arm-card.show { opacity: 1; transform: translateY(0); }
.arm-card:hover { border-color: #2e2e2e; background: #141414; }
.arm-icon { width: 56px; height: 56px; color: #d63031; margin-bottom: 20px; }
.arm-icon svg { width: 100%; height: 100%; }
.arm-label {
  font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 3px;
  color: #d63031; margin-bottom: 12px;
}
.arm-title {
  font-family: 'Bebas Neue', sans-serif; font-size: 32px; letter-spacing: 1px;
  margin-bottom: 16px;
}
.arm-desc { font-size: 14px; line-height: 1.7; color: #b0ada8; margin-bottom: 24px; }
.arm-list { list-style: none; display: flex; flex-direction: column; gap: 10px; }
.arm-list li {
  font-family: 'DM Mono', monospace; font-size: 12px; color: #d8d4ce;
  padding-left: 18px; position: relative;
}
.arm-list li::before {
  content: ''; position: absolute; left: 0; top: 7px;
  width: 6px; height: 6px; border-radius: 50%; background: #d63031;
}

/* ── STATS ── */
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; margin-top: 48px; }
.stat-card {
  background: #0a0a0a; border: 1px solid #1e1e1e; border-radius: 12px;
  padding: 32px 24px; text-align: center;
  transition: all 0.3s;
}
.stat-card:hover { border-color: #2e2e2e; transform: translateY(-4px); }
.stat-num {
  font-family: 'Bebas Neue', sans-serif; font-size: 48px; color: #d63031;
  line-height: 1; margin-bottom: 8px;
}
.stat-label { font-weight: 600; font-size: 14px; margin-bottom: 6px; }
.stat-sub { font-size: 11px; color: #888; line-height: 1.4; }

/* ── STACK ── */
.stack-row { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px; }
.stack-tag {
  font-family: 'DM Mono', monospace; font-size: 12px;
  padding: 8px 18px; border-radius: 6px;
  background: #141414; border: 1px solid #222; color: #d8d4ce;
  transition: all 0.2s;
}
.stack-tag:hover { border-color: #d63031; color: #f5f2ed; }

/* ── CTA ── */
.cta-section { text-align: center; padding: 120px 32px; position: relative; overflow: hidden; }
.cta-title {
  font-family: 'Bebas Neue', sans-serif; font-size: clamp(36px, 5vw, 56px);
  letter-spacing: 1px; margin-bottom: 16px;
}
.cta-sub { font-size: 16px; color: #b0ada8; margin-bottom: 36px; }

/* ── FOOTER ── */
.lfooter {
  border-top: 1px solid #1e1e1e; padding: 32px;
}
.lfooter-inner {
  max-width: 1100px; margin: 0 auto;
  display: flex; align-items: center; justify-content: space-between;
}
.lfooter-brand { display: flex; align-items: center; gap: 10px; font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 2px; }
.lfooter-logo { width: 24px; height: 24px; border-radius: 4px; }
.lfooter-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.lfooter-email {
  font-family: 'DM Mono', monospace; font-size: 12px; color: #b0ada8;
  text-decoration: none; transition: color 0.2s;
}
.lfooter-email:hover { color: #d63031; }
.lfooter-copy { font-size: 12px; color: #666; }

/* ── ANIMATIONS ── */
.fade-up { opacity: 0; transform: translateY(30px); transition: all 0.7s cubic-bezier(0.16, 1, 0.3, 1); }
.fade-up.show { opacity: 1; transform: translateY(0); }

/* ── RESPONSIVE ── */
@media (max-width: 900px) {
  .arms-grid { grid-template-columns: 1fr; }
  .stats-grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 640px) {
  .lnav { padding: 12px 16px; }
  .lnav.scrolled { padding: 8px 16px; }
  .lnav-links { gap: 12px; }
  .lnav-link { display: none; }
  .hero { padding: 100px 20px 60px; }
  .section { padding: 64px 20px; }
  .stats-grid { grid-template-columns: 1fr; }
  .lfooter-inner { flex-direction: column; gap: 12px; text-align: center; }
  .arm-card { padding: 28px 24px; }
}

/* smooth scroll */
html { scroll-behavior: smooth; }
`;
