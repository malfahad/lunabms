(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))i(e);new MutationObserver(e=>{for(const s of e)if(s.type==="childList")for(const r of s.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&i(r)}).observe(document,{childList:!0,subtree:!0});function c(e){const s={};return e.integrity&&(s.integrity=e.integrity),e.referrerPolicy&&(s.referrerPolicy=e.referrerPolicy),e.crossOrigin==="use-credentials"?s.credentials="include":e.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function i(e){if(e.ep)return;e.ep=!0;const s=c(e);fetch(e.href,s)}})();const a="".trim().replace(/\/+$/,""),n=`${a||"#"}${a?"/login":""}`,o=`${a||"#"}${a?"/register":""}`,l=document.querySelector("#app");l.innerHTML=`
  <div class="site">
    <header class="header">
      <a class="brand" href="#top" aria-label="Luna BMS Home">
        <span class="brand-mark">Luna</span>
        <span class="brand-text">BMS</span>
      </a>
      <nav class="nav">
        <a href="#why">Why</a>
        <a href="#features">Features</a>
        <a href="#legal">Legal</a>
      </nav>
      <div class="auth-links">
        <a class="link" href="${n}">Sign in</a>
        <a class="btn btn-sm" href="${o}">Register</a>
      </div>
    </header>

    <main id="top">
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow">Luna Business Management System</p>
          <h1>Same store. <span>Smarter control.</span></h1>
          <p>
            Run operations from one dashboard: pipeline, projects, field updates, suppliers, invoices, and payments.
            Keep your team synced on mobile and web.
          </p>
          <div class="hero-ctas">
            <a class="btn" href="${o}">Create account</a>
            <a class="btn btn-ghost" href="${n}">Sign in</a>
          </div>
        </div>
        <div class="hero-cards">
          <article class="card stat">
            <h3>Pipeline Value</h3>
            <strong>UGX 128M</strong>
            <p>Across active opportunities</p>
          </article>
          <article class="card stat">
            <h3>Sync Status</h3>
            <strong>Healthy</strong>
            <p>Latest update 2m ago</p>
          </article>
        </div>
      </section>

      <section id="why" class="section split">
        <div>
          <p class="eyebrow">Why Luna</p>
          <h2>Why teams stay stuck</h2>
          <p>
            Most teams juggle spreadsheets, chat threads, and scattered tools. Work slips, handoffs break, and finance
            visibility arrives too late.
          </p>
        </div>
        <ul class="stack">
          <li><strong>Scattered data</strong><span>Leads, tasks, and invoices are disconnected.</span></li>
          <li><strong>Slow decisions</strong><span>No live view of pipeline and project health.</span></li>
          <li><strong>Missed follow-ups</strong><span>Customer and supplier actions get delayed.</span></li>
        </ul>
      </section>

      <section id="features" class="section">
        <p class="eyebrow">Platform</p>
        <h2>Three systems. One dashboard.</h2>
        <div class="grid">
          <article class="card">
            <h3>CRM + Pipeline</h3>
            <p>Track opportunities, stages, and expected value with clear next actions.</p>
          </article>
          <article class="card">
            <h3>Operations</h3>
            <p>Manage projects, field updates, team assignments, and suppliers in one flow.</p>
          </article>
          <article class="card">
            <h3>Finance</h3>
            <p>Create invoices, record payments, and monitor cash movement with confidence.</p>
          </article>
        </div>
      </section>

      <section class="cta">
        <p class="eyebrow">Get Started</p>
        <h2>Build a smoother business rhythm with Luna BMS.</h2>
        <div class="hero-ctas">
          <a class="btn" href="${o}">Register now</a>
          <a class="btn btn-ghost" href="${n}">Sign in</a>
        </div>
      </section>
    </main>

    <footer id="legal" class="footer">
      <div class="footer-brand">
        <strong>Luna BMS</strong>
        <p>Luna Business Management System</p>
      </div>
      <div class="footer-links">
        <a href="#terms">Terms</a>
        <a href="#privacy">Privacy</a>
        <a href="#cookies">Cookies</a>
      </div>
    </footer>

    <section id="terms" class="legal">
      <h3>Terms of Use</h3>
      <p>
        By using Luna BMS, you agree to use the service lawfully and protect your account credentials. You are
        responsible for activity under your account and data entered by your organization.
      </p>
    </section>
    <section id="privacy" class="legal">
      <h3>Privacy Notice</h3>
      <p>
        Luna BMS processes business and account data to provide core product functionality, sync, and support. We
        apply reasonable security controls and only use data as needed to operate and improve the service.
      </p>
    </section>
    <section id="cookies" class="legal">
      <h3>Cookie Policy</h3>
      <p>
        We use essential cookies for authentication and session continuity. Analytics or preference cookies may be
        added with clear notice and controls where required.
      </p>
    </section>
  </div>
`;
