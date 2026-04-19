import { useState, useEffect } from "react";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500;600;700&display=swap');`;

export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0);
  const [visible, setVisible] = useState({});
  const [showContact, setShowContact] = useState(false);
  const [contactForm, setContactForm] = useState({ email: "", reason: "" });
  const [contactSent, setContactSent] = useState(false);
  const [mouse, setMouse] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      setMouse({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
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

  const handleContactSubmit = (e) => {
    e.preventDefault();
    // Open mailto with prefilled subject/body
    const subject = encodeURIComponent("Inquiry from " + contactForm.email);
    const body = encodeURIComponent("From: " + contactForm.email + "\n\n" + contactForm.reason);
    window.open(`mailto:contact@cameleostudio.com?subject=${subject}&body=${body}`, "_self");
    setContactSent(true);
    setTimeout(() => {
      setShowContact(false);
      setContactSent(false);
      setContactForm({ email: "", reason: "" });
    }, 2000);
  };

  return (
    <>
      <style>{FONTS}{landingCSS}</style>
      <div className="landing">
        {/* ── NAV ── */}
        <nav className={`lnav${scrollY > 60 ? " scrolled" : ""}`}>
          <div className="lnav-inner">
            <div className="lnav-brand">
              <img src="/logo/cameleo-logo.png" alt="Cameleo Studio" className="lnav-logo" />
              <span className="lnav-name">CAMELEO STUDIO</span>
            </div>
            <div className="lnav-links">
              <a href="#about" className="lnav-link">About</a>
              <a href="#arms" className="lnav-link">What We Do</a>
              <button className="lnav-cta" onClick={() => setShowContact(true)}>Get In Touch</button>
            </div>
          </div>
        </nav>

        {/* ── HERO ── */}
        <section className="hero">
          {/* Chameleon-mouse reactive blob */}
          <div
            className="hero-blob"
            style={{
              background: `radial-gradient(circle at ${mouse.x}% ${mouse.y}%, rgba(214,48,49,0.35) 0%, rgba(108,92,231,0.22) 30%, rgba(0,184,148,0.15) 55%, transparent 75%)`,
              transform: parallax(-0.15),
            }}
          />
          {/* Grid + scanlines */}
          <div className="hero-grid" style={{ transform: parallax(-0.05) }} />
          <div className="hero-scanlines" />
          {/* SVG grain */}
          <svg className="hero-grain" xmlns="http://www.w3.org/2000/svg">
            <filter id="grain-noise">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
              <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.45 0"/>
            </filter>
            <rect width="100%" height="100%" filter="url(#grain-noise)" />
          </svg>

          {/* Editorial index markers */}
          <div className="hero-idx idx-tl">
            <span className="idx-num">01</span>
            <span className="idx-line" />
            <span className="idx-label">EST. 2026 / NYC</span>
          </div>
          <div className="hero-idx idx-tr">
            <span className="idx-label">MEDIA × TECH</span>
            <span className="idx-line" />
            <span className="idx-num">02</span>
          </div>
          <div className="hero-idx idx-bl">
            <span className="asterisk rotating">✻</span>
            <span className="idx-label">ADAPTIVE BY DESIGN</span>
          </div>
          <div className="hero-idx idx-br">
            <span className="idx-label">INDEX NO. 001</span>
            <span className="asterisk rotating rev">✻</span>
          </div>

          <div className="hero-content">
            <div className="hero-badge"><span className="dot" /> MEDIA &amp; TECHNOLOGY STUDIO</div>
            <h1 className="hero-title">
              <span className="ht-line ht-line-1">
                <span className="ht-word">We</span>
                <span className="ht-word">build</span>
                <span className="ht-bracket">[</span>
                <span className="ht-word ht-outline">brands</span>
                <span className="ht-bracket">]</span>
              </span>
              <span className="ht-line ht-line-2">
                <span className="ht-word ht-italic">that</span>
                <span className="ht-shift">ADAPT</span>
                <span className="ht-period">.</span>
              </span>
            </h1>
            <p className="hero-sub">
              A dual-arm creative &amp; technology studio. We craft media that grows audiences,
              and build products that monetize attention.
            </p>
            <div className="hero-actions">
              <a href="#arms" className="btn-primary hero-cta">
                <span>See What We Do</span>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </a>
            </div>
          </div>

          {/* Marquee strip of pillars */}
          <div className="hero-marquee">
            <div className="marquee-track">
              {Array.from({ length: 6 }).map((_, i) => (
                <span key={i} className="marquee-group">
                  <span className="marquee-word">Leverage</span>
                  <span className="marquee-sep">✻</span>
                  <span className="marquee-word">Experimentation</span>
                  <span className="marquee-sep">✻</span>
                  <span className="marquee-word">Adaptability</span>
                  <span className="marquee-sep">✻</span>
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── ABOUT ── */}
        <section className="section" id="about">
          <div className="section-inner" data-anim="about">
            <div className={`fade-up${visible.about ? " show" : ""}`}>
              <div className="section-label">Who We Are</div>
              <div className="pillars-grid">
                <div className="pillar">
                  <h3 className="pillar-title">Leverage.</h3>
                  <p className="pillar-desc">Build systems that multiply output. One tool powers ten brands. One pipeline runs while you sleep.</p>
                </div>
                <div className="pillar">
                  <h3 className="pillar-title">Experimentation.</h3>
                  <p className="pillar-desc">Test everything. Ship fast, measure what works, kill what doesn't.</p>
                </div>
                <div className="pillar">
                  <h3 className="pillar-title">Adaptability.</h3>
                  <p className="pillar-desc">When the landscape shifts, shift with it. No attachment to what worked yesterday.</p>
                </div>
              </div>
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
                  <li>Mobile &amp; web app development</li>
                  <li>Custom analytics platforms</li>
                  <li>Automated data pipelines</li>
                  <li>Internal tooling &amp; infrastructure</li>
                  <li>Rapid prototyping &amp; product design</li>
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
              <button className="btn-primary large" onClick={() => setShowContact(true)}>Get In Touch</button>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="lfooter">
          <div className="lfooter-inner">
            <div className="lfooter-brand">
              <img src="/logo/cameleo-logo.png" alt="" className="lfooter-logo" />
              <span>CAMELEO STUDIO</span>
            </div>
            <div className="lfooter-right">
              <a href="mailto:contact@cameleostudio.com" className="lfooter-email">contact@cameleostudio.com</a>
              <div className="lfooter-copy">&copy; {new Date().getFullYear()} Cameleo Studio. All rights reserved.</div>
            </div>
          </div>
        </footer>

        {/* ── CONTACT MODAL ── */}
        {showContact && (
          <div className="contact-overlay" onClick={() => !contactSent && setShowContact(false)}>
            <div className="contact-modal" onClick={(e) => e.stopPropagation()}>
              {contactSent ? (
                <div className="contact-success">
                  <div className="contact-check">&#10003;</div>
                  <h3>Opening your email client...</h3>
                </div>
              ) : (
                <>
                  <button className="contact-close" onClick={() => setShowContact(false)}>&times;</button>
                  <h3 className="contact-title">Get In Touch</h3>
                  <p className="contact-sub">Drop us your email and what you're looking for.</p>
                  <form onSubmit={handleContactSubmit}>
                    <div className="contact-field">
                      <label className="contact-label">Your Email</label>
                      <input
                        type="email"
                        className="contact-input"
                        placeholder="you@company.com"
                        value={contactForm.email}
                        onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                        required
                        autoFocus
                      />
                    </div>
                    <div className="contact-field">
                      <label className="contact-label">What can we help with?</label>
                      <textarea
                        className="contact-input contact-textarea"
                        placeholder="Tell us about your project or idea..."
                        value={contactForm.reason}
                        onChange={(e) => setContactForm({ ...contactForm, reason: e.target.value })}
                        required
                        rows={4}
                      />
                    </div>
                    <button type="submit" className="btn-primary contact-submit">Send Message</button>
                  </form>
                </>
              )}
            </div>
          </div>
        )}
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

/* ── GLOBAL: no underlines ── */
.landing a, .landing button { text-decoration: none; }

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
  letter-spacing: 0.5px; transition: all 0.2s; text-decoration: none;
}
.lnav-cta:hover { background: #e84142; transform: translateY(-1px); }

/* ── HERO (editorial / art-direction) ── */
.hero {
  position: relative; min-height: 100vh; display: flex; align-items: center; justify-content: center;
  overflow: hidden; padding: 140px 40px 120px;
  background: #050505;
}
/* Mouse-tracking color blob (chameleon color shift) */
.hero-blob {
  position: absolute; inset: -20%; z-index: 0; pointer-events: none;
  filter: blur(60px); transition: background 0.25s ease-out;
  will-change: background, transform;
}
/* Fine grid */
.hero-grid {
  position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background-image:
    linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
  background-size: 72px 72px;
  mask-image: radial-gradient(ellipse at center, #000 30%, transparent 80%);
  -webkit-mask-image: radial-gradient(ellipse at center, #000 30%, transparent 80%);
}
/* Scanline overlay */
.hero-scanlines {
  position: absolute; inset: 0; z-index: 1; pointer-events: none;
  background-image: repeating-linear-gradient(
    0deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 3px
  );
  mix-blend-mode: overlay;
}
/* SVG grain */
.hero-grain {
  position: absolute; inset: 0; z-index: 2; width: 100%; height: 100%;
  pointer-events: none; opacity: 0.35; mix-blend-mode: overlay;
}

/* Editorial index markers in corners */
.hero-idx {
  position: absolute; z-index: 3;
  font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 2px;
  text-transform: uppercase; color: rgba(245,242,237,0.45);
  display: flex; align-items: center; gap: 10px;
  pointer-events: none;
}
.idx-tl { top: 96px; left: 40px; }
.idx-tr { top: 96px; right: 40px; }
.idx-bl { bottom: 96px; left: 40px; }
.idx-br { bottom: 96px; right: 40px; }
.idx-num {
  font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 2px;
  color: #d63031;
}
.idx-line { display: inline-block; width: 36px; height: 1px; background: rgba(245,242,237,0.3); }
.idx-label { white-space: nowrap; }
.asterisk { font-size: 16px; color: #d63031; display: inline-block; }
.asterisk.rotating { animation: rotate 12s linear infinite; }
.asterisk.rotating.rev { animation-direction: reverse; }
@keyframes rotate { to { transform: rotate(360deg); } }

/* Hero content */
.hero-content {
  position: relative; z-index: 4; max-width: 980px; text-align: center;
}
.hero-badge {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: 'DM Mono', monospace; font-size: 11px;
  letter-spacing: 2.5px; text-transform: uppercase; color: #d63031;
  border: 1px solid rgba(214,48,49,0.4); padding: 8px 18px; border-radius: 999px;
  margin-bottom: 36px; background: rgba(214,48,49,0.05);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
}
.hero-badge .dot {
  width: 6px; height: 6px; border-radius: 50%; background: #d63031;
  box-shadow: 0 0 0 4px rgba(214,48,49,0.2); animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 4px rgba(214,48,49,0.2); }
  50% { box-shadow: 0 0 0 8px rgba(214,48,49,0); }
}

/* Massive editorial type */
.hero-title {
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(56px, 11vw, 168px);
  line-height: 0.88; letter-spacing: 1px;
  margin-bottom: 32px;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.ht-line { display: inline-flex; align-items: baseline; gap: 0.18em; flex-wrap: wrap; justify-content: center; }
.ht-word { color: #f5f2ed; }
.ht-bracket {
  color: #d63031; font-weight: 400; opacity: 0.8;
  transform: translateY(-0.03em);
}
.ht-outline {
  color: transparent;
  -webkit-text-stroke: 2px #f5f2ed;
  text-stroke: 2px #f5f2ed;
}
.ht-italic {
  font-family: 'DM Sans', sans-serif; font-style: italic; font-weight: 300;
  font-size: 0.55em; letter-spacing: 0; text-transform: lowercase;
  color: rgba(245,242,237,0.7); transform: translateY(-0.15em);
}
.ht-shift {
  background: linear-gradient(90deg, #d63031 0%, #e8a935 25%, #00b894 50%, #6c5ce7 75%, #d63031 100%);
  background-size: 300% 100%;
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; color: transparent;
  animation: colorShift 6s ease-in-out infinite;
}
@keyframes colorShift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
.ht-period { color: #d63031; font-size: 1.2em; line-height: 0.5; margin-left: -0.1em; }

.hero-sub {
  font-size: 18px; line-height: 1.65; color: rgba(245,242,237,0.7);
  max-width: 560px; margin: 0 auto 44px;
  font-weight: 300;
}
.hero-actions { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
.hero-cta {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 16px 36px; font-size: 15px;
}
.hero-cta svg { transition: transform 0.2s; }
.hero-cta:hover svg { transform: translateX(4px); }

/* Marquee strip at bottom of hero */
.hero-marquee {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 3;
  padding: 20px 0;
  border-top: 1px solid rgba(245,242,237,0.08);
  border-bottom: 1px solid rgba(245,242,237,0.08);
  background: rgba(5,5,5,0.6);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  overflow: hidden;
  mask-image: linear-gradient(90deg, transparent 0%, #000 5%, #000 95%, transparent 100%);
  -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 5%, #000 95%, transparent 100%);
}
.marquee-track {
  display: inline-flex; white-space: nowrap;
  animation: marquee 45s linear infinite;
}
@keyframes marquee {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
.marquee-group { display: inline-flex; align-items: center; gap: 32px; padding-right: 32px; }
.marquee-word {
  font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 3px;
  color: #f5f2ed;
}
.marquee-sep { color: #d63031; font-size: 14px; }
.btn-primary {
  font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 14px;
  padding: 14px 32px; border-radius: 8px;
  background: #d63031; color: white; border: none; cursor: pointer;
  transition: all 0.2s; letter-spacing: 0.3px; text-decoration: none;
  display: inline-flex; align-items: center; justify-content: center;
}
.btn-primary:hover { background: #e84142; transform: translateY(-2px); box-shadow: 0 8px 30px rgba(214,48,49,0.3); }
.btn-primary.large { font-size: 16px; padding: 18px 40px; }

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

/* ── PILLARS ── */
.pillars-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; }
.pillar-title {
  font-family: 'Bebas Neue', sans-serif; font-size: 36px; letter-spacing: 1px;
  color: #f5f2ed; margin-bottom: 12px;
}
.pillar-desc { font-size: 14px; line-height: 1.7; color: #b0ada8; }

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

/* ── CONTACT MODAL ── */
.contact-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,0.75);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
  animation: fadeIn 0.2s ease;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.contact-modal {
  background: #111; border: 1px solid #2e2e2e; border-radius: 16px;
  padding: 40px; width: 100%; max-width: 480px;
  position: relative;
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
.contact-close {
  position: absolute; top: 16px; right: 20px;
  background: none; border: none; color: #666; font-size: 28px;
  cursor: pointer; transition: color 0.2s; line-height: 1;
}
.contact-close:hover { color: #f5f2ed; }
.contact-title {
  font-family: 'Bebas Neue', sans-serif; font-size: 32px; letter-spacing: 1px;
  margin-bottom: 8px;
}
.contact-sub { font-size: 14px; color: #888; margin-bottom: 28px; }
.contact-field { margin-bottom: 20px; }
.contact-label {
  font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 1px;
  color: #b0ada8; text-transform: uppercase; display: block; margin-bottom: 8px;
}
.contact-input {
  width: 100%; padding: 12px 16px; border-radius: 8px;
  background: #1a1a1a; border: 1px solid #2e2e2e; color: #f5f2ed;
  font-family: 'DM Sans', sans-serif; font-size: 14px;
  outline: none; transition: border-color 0.2s;
}
.contact-input:focus { border-color: #d63031; }
.contact-input::placeholder { color: #555; }
.contact-textarea { resize: vertical; min-height: 100px; }
.contact-submit { width: 100%; margin-top: 8px; }
.contact-success {
  text-align: center; padding: 40px 0;
}
.contact-check {
  width: 56px; height: 56px; border-radius: 50%;
  background: rgba(0,184,148,0.15); color: #00b894;
  font-size: 28px; display: flex; align-items: center; justify-content: center;
  margin: 0 auto 16px;
}
.contact-success h3 {
  font-family: 'DM Sans', sans-serif; font-weight: 500; font-size: 16px; color: #b0ada8;
}

/* ── ANIMATIONS ── */
.fade-up { opacity: 0; transform: translateY(30px); transition: all 0.7s cubic-bezier(0.16, 1, 0.3, 1); }
.fade-up.show { opacity: 1; transform: translateY(0); }

/* ── RESPONSIVE ── */
@media (max-width: 900px) {
  .arms-grid { grid-template-columns: 1fr; }
  .pillars-grid { grid-template-columns: 1fr; }
}
@media (max-width: 900px) {
  .hero-idx { display: none; }
}
@media (max-width: 640px) {
  .lnav { padding: 12px 16px; }
  .lnav.scrolled { padding: 8px 16px; }
  .lnav-links { gap: 12px; }
  .lnav-link { display: none; }
  .hero { padding: 110px 20px 100px; }
  .hero-title { gap: 0; }
  .ht-italic { font-size: 0.5em; }
  .section { padding: 64px 20px; }
  .lfooter-inner { flex-direction: column; gap: 12px; text-align: center; }
  .lfooter-right { align-items: center; }
  .arm-card { padding: 28px 24px; }
  .contact-modal { padding: 28px; }
  .marquee-word { font-size: 18px; }
}

/* smooth scroll */
html { scroll-behavior: smooth; }
`;
