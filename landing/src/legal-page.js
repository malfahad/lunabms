import "./styles.css";

const baseUrl = (import.meta.env.VITE_FRONTEND_APP_URL || "").trim().replace(/\/+$/, "");
const loginUrl = `${baseUrl || "#"}${baseUrl ? "/login" : ""}`;
const registerUrl = `${baseUrl || "#"}${baseUrl ? "/register" : ""}`;

const page = (window.LEGAL_PAGE || "terms").toLowerCase();

const contentByPage = {
  terms: {
    title: "Terms of Service",
    updatedAt: "March 22, 2025",
    intro:
      'These Terms of Service ("Terms") govern your access to and use of Luna Retail Management System ("LunaRMS", "we", "us") offered at lunarms.com and related applications.',
    sections: [
      {
        heading: "1. Agreement",
        text: "By creating an account or using LunaRMS, you agree to these Terms. If you do not agree, do not use the service.",
      },
      {
        heading: "2. The service",
        text: "LunaRMS provides tools for point-of-sale, inventory, and expense management. Features may change over time. We strive for high availability but do not guarantee uninterrupted access.",
      },
      {
        heading: "3. Accounts",
        text: "You are responsible for safeguarding your credentials and for activity under your account. You must provide accurate registration information and keep it up to date.",
      },
      {
        heading: "4. Acceptable use",
        text: "You will not misuse LunaRMS, attempt unauthorized access, or use the service in violation of applicable law.",
      },
      {
        heading: "5. Data",
        text: "Our collection and use of personal data is described in the Privacy Policy. You retain rights in your business data; we process it to provide the service.",
      },
      {
        heading: "6. Disclaimer",
        text: 'LunaRMS is provided "as is" without warranties of any kind, to the fullest extent permitted by law.',
      },
      {
        heading: "7. Limitation of liability",
        text: "To the extent permitted by law, we are not liable for indirect, incidental, or consequential damages arising from your use of LunaRMS.",
      },
      {
        heading: "8. Changes",
        text: "We may update these Terms. We will post the revised Terms with an updated date. Continued use after changes constitutes acceptance.",
      },
      {
        heading: "9. Contact",
        text: "Questions about these Terms: legal@lunarms.com.",
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    updatedAt: "March 22, 2025",
    intro:
      'Luna Retail Management System ("LunaRMS", "we") respects your privacy. This policy describes how we handle information when you use lunarms.com and our applications.',
    sections: [
      {
        heading: "1. Information we collect",
        text: "Account data: such as name, email, and organization name when you register. Operational data: sales, inventory, and expense records you enter into the product. Technical data: such as device type, browser, and approximate location derived from IP for security and diagnostics.",
      },
      {
        heading: "2. How we use information",
        text: "We use information to provide, secure, and improve LunaRMS; communicate about your account; and comply with law.",
      },
      {
        heading: "3. Sync and offline use",
        text: "LunaRMS may store encrypted or local copies of your data on your devices for offline access and sync. You control your devices and should protect them with a strong password or biometric lock.",
      },
      {
        heading: "4. Sharing",
        text: "We do not sell your personal information. We may use subprocessors (e.g. hosting providers) under strict agreements to run the service.",
      },
      {
        heading: "5. Retention",
        text: "We retain data as long as your account is active and as needed for legitimate business or legal purposes.",
      },
      {
        heading: "6. Your rights",
        text: "Depending on where you live, you may have rights to access, correct, delete, or export your data. Contact us to make a request.",
      },
      {
        heading: "7. Security",
        text: "We implement technical and organizational measures to protect data. No method of transmission over the internet is 100% secure.",
      },
      {
        heading: "8. Children",
        text: "LunaRMS is not directed at children under 16.",
      },
      {
        heading: "9. Changes",
        text: "We may update this policy and will post the new version here with an updated date.",
      },
      {
        heading: "10. Contact",
        text: "Privacy questions: privacy@lunarms.com.",
      },
    ],
  },
  cookies: {
    title: "Cookie Policy",
    body: [
      "We use essential cookies for authentication, session continuity, and core website functionality.",
      "Analytics or preference cookies may be introduced with clear notice and controls where required by law.",
      "You can manage browser cookie settings, but disabling essential cookies can affect sign-in and app operation.",
    ],
  },
};

const content = contentByPage[page] || contentByPage.terms;
const app = document.querySelector("#app");
const sectionHtml = Array.isArray(content.sections)
  ? content.sections
      .map(
        (section) =>
          `<section class="legal-section"><h2>${section.heading}</h2><p>${section.text}</p></section>`
      )
      .join("")
  : "";
const paragraphHtml = Array.isArray(content.body)
  ? content.body.map((paragraph) => `<p>${paragraph}</p>`).join("")
  : "";

app.innerHTML = `
  <div class="site legal-page">
    <header class="header">
      <a class="brand" href="/" aria-label="Luna BMS Home">
        <span class="brand-mark">Luna</span>
        <span class="brand-text">BMS</span>
      </a>
      <nav class="nav">
        <a href="/">Home</a>
        <a href="/terms.html">Terms</a>
        <a href="/privacy.html">Privacy</a>
        <a href="/cookies.html">Cookies</a>
      </nav>
      <div class="auth-links">
        <a class="link" href="${loginUrl}">Sign in</a>
        <a class="btn btn-sm" href="${registerUrl}">Register</a>
      </div>
    </header>
    <main class="legal-shell">
      <p class="eyebrow">Luna BMS Legal</p>
      <h1>${content.title}</h1>
      ${content.updatedAt ? `<p class="legal-updated">Last updated: ${content.updatedAt}</p>` : ""}
      ${content.intro ? `<p>${content.intro}</p>` : ""}
      ${sectionHtml}
      ${paragraphHtml}
      <p><a class="legal-home-link" href="/">&#8592; Back to home</a></p>
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
