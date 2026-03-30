import "./styles.css";

const baseUrl = (import.meta.env.VITE_FRONTEND_APP_URL || "").trim().replace(/\/+$/, "");
const loginUrl = `${baseUrl || "#"}${baseUrl ? "/login" : ""}`;
const registerUrl = `${baseUrl || "#"}${baseUrl ? "/register" : ""}`;

const app = document.querySelector("#app");

app.innerHTML = `
  <div class="site">
    <header class="header">
      <a class="brand" href="#top" aria-label="Luna BMS Home">
        <span class="brand-mark">Luna</span>
        <span class="brand-text">BMS</span>
      </a>
      <nav class="nav">
        <a href="#why">Why</a>
        <a href="#features">Features</a>
      </nav>
      <div class="auth-links">
        <a class="link" href="${loginUrl}">Sign in</a>
        <a class="btn btn-sm" href="${registerUrl}">Register</a>
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
            <a class="btn" href="${registerUrl}">Create account</a>
            <a class="btn btn-ghost" href="${loginUrl}">Sign in</a>
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
          <a class="btn" href="${registerUrl}">Register now</a>
          <a class="btn btn-ghost" href="${loginUrl}">Sign in</a>
        </div>
      </section>
    </main>

    <footer class="footer">
      <div class="footer-brand">
        <strong>Luna BMS</strong>
        <p>Luna Business Management System</p>
      </div>
      <div class="footer-links">
        <a href="/terms.html">Terms</a>
        <a href="/privacy.html">Privacy</a>
        <a href="/cookies.html">Cookies</a>
      </div>
    </footer>
  </div>
`;
