/**
 * Server configuration, read once from environment variables (`.env` in Docker Compose).
 * See `.env.example` for every variable and its meaning.
 */

function str(name: string, fallback = ''): string {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v.trim();
}
function int(name: string, fallback: number): number {
  const v = Number(str(name));
  return Number.isFinite(v) && v > 0 ? v : fallback;
}
function bool(name: string, fallback: boolean): boolean {
  const v = str(name).toLowerCase();
  if (!v) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v);
}

const anthropicKey = str('ANTHROPIC_API_KEY');
const geminiKey = str('GEMINI_API_KEY');
/** AI_PROVIDER wins; otherwise whichever key is present (Anthropic first). */
const aiProvider = (str('AI_PROVIDER').toLowerCase() || (anthropicKey ? 'anthropic' : geminiKey ? 'gemini' : '')) as 'anthropic' | 'gemini' | '';

const msTenant = str('MS_TENANT_ID');
const msClientId = str('MS_CLIENT_ID');
const msClientSecret = str('MS_CLIENT_SECRET');

export const config = {
  port: int('PORT', 8080),
  /** Express `trust proxy` setting, so client IPs are read from X-Forwarded-For behind a reverse proxy. */
  trustProxy: str('TRUST_PROXY', 'loopback, linklocal, uniquelocal'),
  /** Set to false only when the site is served over plain HTTP (not recommended). */
  cookieSecure: bool('COOKIE_SECURE', true),
  sessionHours: int('SESSION_HOURS', 12),

  /** First administrator, created only when the database has no users yet. */
  admin: {
    username: str('ADMIN_USERNAME', 'admin').toLowerCase(),
    password: str('ADMIN_PASSWORD'),
    email: str('ADMIN_EMAIL'),
    displayName: str('ADMIN_DISPLAY_NAME', 'Administrateur'),
  },

  /** Microsoft Entra ID app registration (client credentials) used for Business Central and Graph. */
  ms: { tenantId: msTenant, clientId: msClientId, clientSecret: msClientSecret },

  bc: {
    enabled: !!(msTenant && msClientId && msClientSecret && str('BC_COMPANY_ID')),
    environment: str('BC_ENVIRONMENT', 'Production'),
    companyId: str('BC_COMPANY_ID'),
    /** `draft` creates the purchase invoice in BC for review; `post` also posts it. */
    postMode: str('BC_POST_MODE', 'draft') === 'post' ? ('post' as const) : ('draft' as const),
    /** Currency code BC uses for local-currency documents (BC returns an empty code for LCY). */
    localCurrency: str('BC_LOCAL_CURRENCY', 'CAD'),
    /** Automatic refresh of the local copy of BC data, in minutes (0 = only when someone clicks Sync). */
    syncMinutes: Number(str('BC_SYNC_MINUTES', '0')) || 0,
  },

  graph: {
    enabled: !!(msTenant && msClientId && msClientSecret && str('GRAPH_MAILBOX')),
    mailbox: str('GRAPH_MAILBOX'),
    folder: str('GRAPH_FOLDER', 'inbox'),
    /** Mark imported messages as read in Outlook (needs Mail.ReadWrite instead of Mail.Read). */
    markRead: bool('GRAPH_MARK_READ', false),
    /** How far back the first sync looks, in days. */
    lookbackDays: int('GRAPH_LOOKBACK_DAYS', 30),
    /** Automatic sync interval in minutes (0 = only when someone clicks "Sync"). */
    syncMinutes: Number(str('GRAPH_SYNC_MINUTES', '0')) || 0,
  },

  /**
   * Microsoft 365 management (module "Gestion O365"): a multi-tenant app registration
   * consented in each managed tenant. Falls back to the MS_* app when not set.
   */
  o365: {
    clientId: str('O365_CLIENT_ID', msClientId),
    clientSecret: str('O365_CLIENT_SECRET', str('O365_CLIENT_ID') ? '' : msClientSecret),
    get enabled() {
      return !!(this.clientId && this.clientSecret);
    },
  },

  ai: {
    provider: aiProvider,
    enabled: aiProvider === 'anthropic' ? !!anthropicKey : aiProvider === 'gemini' ? !!geminiKey : false,
    model: aiProvider === 'gemini' ? str('GEMINI_MODEL', 'gemini-flash-latest') : str('ANTHROPIC_MODEL', 'claude-opus-5-5'),
    geminiKey,
  },
};

export type Config = typeof config;
