// "Closed for now" (maintenance) mode: the settings the owner edits in /admin/maintenance, and the page visitors see.
// Plain functions with no server-only imports: the Worker (cf-worker.js) renders this page in front of the whole site, and
// the admin editor renders the same HTML in its live preview.

export const MAINTENANCE_PATH = 'site/maintenance.json';

export type Logo = 'wordmark' | 'hero' | 'none';
export type Theme = 'dark' | 'light';
export interface MaintLink { label: string; url: string }

export interface Maintenance {
  enabled: boolean;
  // top
  logo: Logo;
  /** Set when saved: where the uploaded hero logo lives (used when logo = 'hero'). */
  heroLogoUrl: string;
  topText: string;
  // middle
  headline: string;
  message: string;
  /** When the site is expected back (ISO), or ''. */
  backAt: string;
  showCountdown: boolean;
  email: string;
  phone: string;
  links: MaintLink[];
  notify: boolean;
  // bottom
  footerText: string;
  showLogin: boolean;
  // look
  theme: Theme;
  accent: string;
  /** A photo from the site (a /media/... address) behind everything, or ''. */
  bgPhoto: string;
  // what stays open
  /** Path prefixes that keep working while the site is closed, e.g. "/fund". */
  keepOpen: string[];
  updatedAt?: string;
}

export const DEFAULT_MAINTENANCE: Maintenance = {
  enabled: false,
  logo: 'wordmark',
  heroLogoUrl: '',
  topText: '',
  headline: 'We’ll be back soon',
  message: 'The site is taking a short break while we make a few things better. Thanks for your patience!',
  backAt: '',
  showCountdown: true,
  email: '',
  phone: '',
  links: [],
  notify: true,
  footerText: '© Yaakov Eisenberger',
  showLogin: true,
  theme: 'dark',
  accent: '#c8a96a',
  bgPhoto: '',
  keepOpen: [],
};

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, max) : '');
const safeUrl = (u: string) => (/^https?:\/\/[^\s<>"']+$/i.test(u) || /^mailto:[^\s<>"']+$/i.test(u) || /^tel:[0-9+()\-. ]+$/i.test(u) || /^\/(?!\/)[A-Za-z0-9/_\-.]*$/.test(u) ? u : '');
const MEDIA = /^\/media\/[A-Za-z0-9/_\-.]+$/;

/** Anything in → a valid config out. */
export function cleanMaintenance(raw: unknown): Maintenance {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const D = DEFAULT_MAINTENANCE;
  const pick = <T extends string>(v: unknown, opts: readonly T[], d: T): T => (opts.includes(v as T) ? (v as T) : d);
  const backAt = str(r.backAt, 40);
  const email = str(r.email, 254);
  return {
    enabled: r.enabled === true,
    logo: pick(r.logo, ['wordmark', 'hero', 'none'] as const, D.logo),
    heroLogoUrl: MEDIA.test(str(r.heroLogoUrl, 300)) ? str(r.heroLogoUrl, 300) : '',
    topText: str(r.topText, 80),
    headline: str(r.headline, 120) || D.headline,
    message: str(r.message, 1500),
    backAt: backAt && !Number.isNaN(Date.parse(backAt)) ? new Date(backAt).toISOString() : '',
    showCountdown: r.showCountdown !== false,
    email: /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i.test(email) ? email : '',
    phone: str(r.phone, 25).replace(/[^\d+()\-. ]/g, ''),
    links: (Array.isArray(r.links) ? r.links : []).slice(0, 6).flatMap((l) => {
      const o = (l && typeof l === 'object' ? l : {}) as Record<string, unknown>;
      const label = str(o.label, 40), url = safeUrl(str(o.url, 500));
      return label && url ? [{ label, url }] : [];
    }),
    notify: r.notify !== false,
    footerText: str(r.footerText, 200),
    showLogin: r.showLogin !== false,
    theme: pick(r.theme, ['dark', 'light'] as const, D.theme),
    accent: /^#[0-9a-f]{6}$/i.test(str(r.accent, 7)) ? str(r.accent, 7) : D.accent,
    bgPhoto: MEDIA.test(str(r.bgPhoto, 300)) ? str(r.bgPhoto, 300) : '',
    keepOpen: (Array.isArray(r.keepOpen) ? r.keepOpen : []).map((p) => str(p, 60)).filter((p) => /^\/[a-z0-9-]+$/.test(p)).slice(0, 40),
    updatedAt: str(r.updatedAt, 40) || undefined,
  };
}

/** Paths that always work while closed: the owner's admin, sign-up for "tell me when it's back", photos and site files. */
// APIs stay reachable (they check permissions themselves, and pages kept open need them); pages don't.
const ALWAYS_OPEN = /^\/(admin|api|media|_next|images|fishboard|ort|cdn-cgi)(\/|$)|^\/(icon\.png|favicon\.ico|robots\.txt|apple-icon\.png)$/;
export const isOpenWhileClosed = (pathname: string, m: Maintenance) =>
  ALWAYS_OPEN.test(pathname) ||
  m.keepOpen.some((p) => pathname === p || pathname.startsWith(p + '/') || pathname === `/access/${p.split('/').pop()}`);

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const ICON = {
  mail: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>',
  phone: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
};

/** The full HTML page visitors see while the site is closed. `preview` = shown inside the admin editor (forms don't submit). */
export function renderMaintenance(m: Maintenance, { preview = false }: { preview?: boolean } = {}): string {
  const dark = m.theme === 'dark';
  const fg = dark ? '#f5f5f4' : '#171717';
  const muted = dark ? '#a3a3a3' : '#525252';
  const bg = dark ? '#0a0a0a' : '#faf8f5';
  const card = dark ? 'rgba(23,23,23,.72)' : 'rgba(255,255,255,.82)';
  const line = dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.1)';
  const a = m.accent;
  const logoSrc = m.logo === 'wordmark' ? '/images/home/wordmark-white.png' : m.logo === 'hero' && m.heroLogoUrl ? m.heroLogoUrl : '';
  const logo = logoSrc ? `<img class="logo${m.logo === 'wordmark' && !dark ? ' invert' : ''}" src="${esc(logoSrc)}" alt="">` : '';
  const back = m.backAt ? new Date(m.backAt) : null;
  const backText = back ? back.toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
  const buttons = [
    m.email && `<a class="btn" href="mailto:${esc(m.email)}">${ICON.mail}<span>${esc(m.email)}</span></a>`,
    m.phone && `<a class="btn" href="tel:${esc(m.phone.replace(/[^\d+]/g, ''))}">${ICON.phone}<span>${esc(m.phone)}</span></a>`,
  ].filter(Boolean).join('');
  const links = m.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('<span class="dot">·</span>');
  const message = m.message ? `<p class="msg">${esc(m.message).replace(/\n/g, '<br>')}</p>` : '';
  const submit = preview ? 'event.preventDefault();this.querySelector(\'.ok\').hidden=false' : 'return send(event)';

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(m.headline)}</title>
<style>
*{box-sizing:border-box}html,body{margin:0;min-height:100%}
body{min-height:100vh;display:flex;flex-direction:column;background:${bg};color:${fg};font:16px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
.bg{position:fixed;inset:0;z-index:-1;${m.bgPhoto ? `background:url("${esc(m.bgPhoto)}") center/cover no-repeat` : `background:radial-gradient(900px 520px at 50% -10%,${a}2e,transparent 70%)`}}
.bg:after{content:"";position:absolute;inset:0;${m.bgPhoto ? `background:${dark ? 'rgba(0,0,0,.62)' : 'rgba(250,248,245,.7)'};backdrop-filter:blur(2px)` : ''}}
header{padding:28px 20px 0;text-align:center}
.logo{height:26px;max-width:240px;object-fit:contain}.logo.invert{filter:invert(1)}
.top{margin:${logo ? '10px' : '0'} 0 0;font:600 11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.28em;text-transform:uppercase;color:${a}}
main{flex:1;display:flex;align-items:center;justify-content:center;padding:32px 16px}
.card{width:100%;max-width:560px;text-align:center;padding:40px 28px;border-radius:28px;background:${card};box-shadow:0 0 0 .5px ${line},0 30px 80px -30px rgba(0,0,0,.6);backdrop-filter:blur(10px)}
.mark{width:52px;height:3px;margin:0 auto 22px;border-radius:9px;background:linear-gradient(90deg,transparent,${a},transparent)}
h1{margin:0;font:600 clamp(30px,7vw,44px)/1.1 ui-serif,Georgia,"Times New Roman",serif;letter-spacing:-.01em}
.msg{margin:16px auto 0;max-width:440px;color:${muted}}
.when{margin:26px 0 0;font-size:14px;color:${muted}}.when b{color:${fg};font-weight:600}
.cd{display:flex;justify-content:center;gap:10px;margin-top:12px}
.cd div{min-width:66px;padding:10px 6px;border-radius:16px;background:${dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)'};box-shadow:0 0 0 .5px ${line}}
.cd b{display:block;font:600 24px/1.1 ui-serif,Georgia,serif;color:${fg}}.cd span{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${muted}}
.btns{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-top:26px}
.btn{display:inline-flex;align-items:center;gap:8px;max-width:100%;padding:10px 16px;border-radius:999px;color:${fg};text-decoration:none;font-size:14px;font-weight:600;box-shadow:0 0 0 1px ${line};transition:.15s}
.btn span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.btn:hover{box-shadow:0 0 0 1px ${a};color:${a}}
form{display:flex;gap:8px;max-width:400px;margin:26px auto 0}
form p{margin:0 0 8px;width:100%;font-size:14px;color:${muted};text-align:center}
.f{flex-wrap:wrap}.row{display:flex;gap:8px;width:100%}
input{flex:1;min-width:0;height:44px;padding:0 16px;border:0;border-radius:999px;background:${dark ? 'rgba(255,255,255,.06)' : '#fff'};color:${fg};font:inherit;font-size:15px;box-shadow:0 0 0 1px ${line};outline:none}
input:focus{box-shadow:0 0 0 2px ${a}}
button{height:44px;padding:0 18px;border:0;border-radius:999px;background:${a};color:#111;font-family:inherit;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap}
.ok{margin:10px 0 0;width:100%;font-size:14px;color:${a}}.hp{position:absolute;left:-9999px}
.links{margin-top:24px;font-size:14px}.links a{color:${fg};text-decoration:none;border-bottom:1px solid ${a}80}.links a:hover{color:${a}}.dot{margin:0 10px;color:${muted}}
footer{padding:0 20px 26px;text-align:center;font-size:13px;color:${muted}}footer p{margin:0}
.login{display:inline-flex;align-items:center;gap:5px;margin-top:8px;color:${muted};text-decoration:none;font-size:12px;opacity:.7}.login:hover{opacity:1;color:${a}}
@media(max-width:420px){.card{padding:32px 20px}.cd div{min-width:58px}}
</style></head><body><div class="bg"></div>
<header>${logo}${m.topText ? `<p class="top">${esc(m.topText)}</p>` : ''}</header>
<main><div class="card"><div class="mark"></div><h1>${esc(m.headline)}</h1>${message}
${back && back.getTime() > Date.now() ? `<p class="when">Back <b>${esc(backText)}</b></p>${m.showCountdown ? '<div class="cd" id="cd" hidden></div>' : ''}` : ''}
${buttons ? `<div class="btns">${buttons}</div>` : ''}
${m.notify ? `<form class="f" onsubmit="${submit}"><p>Want to know when we’re back?</p><div class="row"><input type="email" name="email" required placeholder="Your email" autocomplete="email" aria-label="Your email"><input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true"><button>Notify me</button></div><p class="ok" hidden>You’re on the list — we’ll email you when we’re back.</p></form>` : ''}
${links ? `<div class="links">${links}</div>` : ''}
</div></main>
<footer>${m.footerText ? `<p>${esc(m.footerText)}</p>` : ''}${m.showLogin ? `<a class="login" href="/admin/login">${ICON.lock}Owner login</a>` : ''}</footer>
<script>
${back && m.showCountdown ? `(function(){var t=${back.getTime()},el=document.getElementById('cd');if(!el)return;function u(){var s=Math.max(0,Math.floor((t-Date.now())/1000));if(!s){el.hidden=true;return}var d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),x=s%60;el.innerHTML=(d?'<div><b>'+d+'</b><span>days</span></div>':'')+'<div><b>'+h+'</b><span>hrs</span></div><div><b>'+m+'</b><span>min</span></div><div><b>'+x+'</b><span>sec</span></div>';el.hidden=false}u();setInterval(u,1000)})();` : ''}
function send(e){e.preventDefault();var f=e.target,b=f.querySelector('button'),ok=f.querySelector('.ok');b.disabled=true;fetch('/api/notify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:f.email.value,website:f.website.value})}).then(function(r){return r.json()}).then(function(j){ok.textContent=j.ok?'You’re on the list — we’ll email you when we’re back.':(j.error||'Something went wrong — please try again.');ok.hidden=false;if(j.ok)f.querySelector('.row').hidden=true}).catch(function(){ok.textContent='Something went wrong — please try again.';ok.hidden=false}).finally(function(){b.disabled=false});return false}
</script></body></html>`;
}
