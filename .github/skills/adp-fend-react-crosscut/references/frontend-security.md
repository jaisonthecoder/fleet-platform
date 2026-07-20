# Frontend Security (React)

## Focus

Use this reference when the task involves route protection, authentication UX, HTTP access patterns, rendering untrusted HTML, external scripts, CSP, storage decisions, or security review of a React frontend.

## Baseline Rules

- Treat every browser-side control as user experience, not final enforcement.
- Enforce authentication, authorization, and data access on the server even when React route guards or hidden UI states exist.
- Treat JSX as trusted executable code. Do not construct JSX or HTML dynamically from untrusted input.
- Prefer safe defaults over escape hatches.

## React Security Rules

- React escapes string children by default. Do not undo this. Avoid `dangerouslySetInnerHTML` unless you control the source and have sanitized it (DOMPurify or equivalent) at the boundary.
- When `dangerouslySetInnerHTML` is unavoidable (rendering user-generated HTML, embedding a trusted rich-text field), sanitize with a vetted library — never with regex.
- Treat `href` / `src` values built from user input as dangerous. Reject `javascript:`, `data:`, and unknown schemes. Use a small allowlist helper in `src/shared/lib/url.ts`.
- Prefer Content Security Policy and (where available) Trusted Types. Configure CSP nonce handling in the HTML shell and align with server headers.
- Never use `eval`, `Function(...)`, or `setTimeout(stringArg, ...)`. Lint for these.
- Third-party React components that accept `children` as HTML, or that bypass sanitization, are a trust boundary — review before adopting.

## Auth and Routing

- Use route guards to improve navigation UX, not as the sole access-control boundary.
- Keep token refresh, expiry, and logout behavior explicit and centralized in `src/shared/api/` interceptors.
- Prefer `HttpOnly` secure cookies for session-style auth when the backend supports them.
- If bearer tokens are required, keep them in memory (module scope or a Zustand store), not `localStorage` or `sessionStorage`. `localStorage` is accessible to any script that runs in the page — a single XSS leaks every token.
- 401 → redirect to login + preserve return URL in a search param. Do not show a silent "session expired" banner without a way back in.
- Do not scatter auth decisions across unrelated interceptors, components, and route guards.

## HTTP and Data Handling

- Centralize HTTP concerns (base URL, credentials mode, CSRF strategy, auth headers, error normalization) in `src/shared/api/`.
- **Credentials mode** — set `credentials: 'include'` only when the backend uses cookie sessions and CORS is configured for the origin. Default to `'same-origin'` or `'omit'`.
- **CSRF** — when the backend uses cookie-based sessions, include a CSRF token on state-changing requests (double-submit cookie or header token per backend spec). Bearer-token APIs over HTTPS do not need CSRF protection, but mixing both auth models in one app is error-prone — prefer one per surface.
- Validate untrusted data at the boundary with zod before it enters state or UI.
- Never trust client-provided role flags, prices, permissions, or workflow states.
- Redact secrets and sensitive identifiers from logs, client errors, and analytics telemetry.

## Third-Party Scripts and Rendering

- Scrutinize analytics, chat widgets, editors, maps, and ad scripts for DOM mutation and data leakage.
- Load third-party scripts via `<script defer>` or after hydration; never in blocking head scripts for a React app.
- Review iframe, script, and HTML embed points as explicit trust boundaries.
- Sanitize Unicode bidirectional control characters (U+202A–U+202E, U+2066–U+2069) in user-generated content before rendering to prevent Trojan-Source-style visual spoofing. Applies especially to comments, filenames, profile fields, and any mixed-script UI.

### Subresource Integrity (SRI)

Pin third-party script and stylesheet hashes when loading from a CDN you do not control:

```html
<script
  src="https://cdn.example.com/widget.v3.js"
  integrity="sha384-<hash>"
  crossorigin="anonymous"
></script>
```

- Generate hashes from the exact bytes you reviewed; do not trust the CDN to be honest tomorrow.
- If the third party doesn't publish stable URLs (or rotates content silently), self-host instead.
- Skip SRI only when the resource is on your own origin under your build pipeline.

## Content Security Policy (baseline)

Set CSP via response headers from the server (preferred) or `<meta http-equiv="Content-Security-Policy">` (fallback). A reasonable starting point for an SPA:

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-<random>' 'strict-dynamic';
  style-src 'self' 'nonce-<random>';
  img-src 'self' data: https:;
  connect-src 'self' https://api.adports.example;
  font-src 'self' data:;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
```

Rules:

- **Generate a fresh nonce per request** server-side; pass it through to the HTML shell and the bundler so inline scripts/styles produced by Vite are tagged. Tools like `vite-plugin-csp` automate this.
- `'unsafe-inline'` and `'unsafe-eval'` are banned. If a dependency requires them, replace the dependency.
- `frame-ancestors 'none'` (or a strict allowlist) prevents clickjacking.
- `connect-src` lists only the APIs the app actually calls — narrow it.
- For Trusted Types, add `require-trusted-types-for 'script'` and `trusted-types default;` once the app is audited and ready.
- Report-only mode (`Content-Security-Policy-Report-Only`) for rollouts; collect violations before flipping to enforce.

## URL allowlist helper

User-controlled `href` / `src` is dangerous (`javascript:`, `data:` text/html, weird custom schemes). Centralize a small helper:

```ts
// src/shared/lib/url.ts
const ALLOWED_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);

// Returns true only if the input parses as a URL whose scheme is on the allowlist — blocks `javascript:`, `data:text/html`, and other XSS vectors.
export function isSafeUrl(input: string): boolean {
  try {
    const url = new URL(input, window.location.origin);
    return ALLOWED_SCHEMES.has(url.protocol);
  } catch {
    return false;
  }
}

// Wraps every user-controlled href/src; returns undefined for unsafe input so the attribute is omitted entirely instead of rendering a dangerous URL.
export function safeHref(input: string | undefined): string | undefined {
  return input && isSafeUrl(input) ? input : undefined;
}
```

Rules:

- **Every** user-controlled `href` / `src` flows through `safeHref`. No exceptions.
- Lint rule (custom or via `eslint-plugin-security`) catches `href={user.something}` patterns that bypass the helper.
- For redirects from query strings (`?returnTo=...`), additionally validate the URL is **same-origin** before navigating — `safeHref` allows `https:` to anywhere; redirecting to an attacker domain is a known phishing vector.

## Dependency and Supply-Chain Hygiene

- Prefer well-maintained dependencies with clear ownership.
- Avoid adding packages for trivial helpers (use a 20-line util instead of adding `lodash.isequal`).
- Review transitive dependency cost, bundle size, and security posture before introducing new UI dependencies.
- Run `pnpm audit` / Snyk / equivalent in CI; track high-severity findings as issues, not silent warnings.

## Telemetry and Error Reporting

- Never send PII (names, emails, tokens, addresses) to analytics or error reporting.
- Use `beforeSend` (Sentry) or equivalent to strip URL query strings, request bodies, and user-identifying cookies from reports.
- Capture release and anonymized user id for correlation — not the user's email or name.

## Security Review Checklist

> Catalog of forbidden patterns (rejection-citable) is `references/anti-patterns.md` §Security. The checklist below is what a **reviewer actively checks** — overlapping but more procedural.

- Check for `dangerouslySetInnerHTML` — sanitized at the boundary? from a trusted source?
- Check for user-controlled `href` / `src` without URL-scheme validation.
- Check for secrets, tokens, or API keys in `localStorage`, `sessionStorage`, logs, query strings, or global variables.
- Check for guards being mistaken for authorization.
- Check for missing CSRF, clickjacking, CSP, or Trusted Types alignment.
- Check that `credentials` and CSRF configuration are centralized and match the backend's auth model.
- Check for unsanitized Unicode bidi control characters in user-generated content rendered into the DOM.
- Check `eval`, `Function(...)`, `new Function(...)`, `setTimeout(string, ...)` — none should exist.
- Check that third-party scripts loaded into the page are reviewed, **subresource-integrity-pinned** where possible, and not running before hydration.
- Check that **CSP** is set, includes a `script-src` nonce strategy, and bans `'unsafe-inline'` / `'unsafe-eval'`.
- Check that user-controlled `href` / `src` flows through `safeHref` (or equivalent allowlist).
- Check that `?returnTo=...` style redirects validate same-origin before navigating.
- Check whether error messages or telemetry leak sensitive backend detail or user PII.
