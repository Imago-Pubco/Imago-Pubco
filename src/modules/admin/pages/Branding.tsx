/**
 * Administration → Image de marque: app name, tagline, browser title, logo, favicon and colours, with a live preview,
 * plus "import from a web site": the server reads the site and suggests a name, logos, icons and colours; the
 * administrator picks what to use, nothing is applied without a click.
 */
import { useEffect, useState, type ChangeEvent } from 'react';
import { Globe, ImagePlus, Palette, RotateCcw, Save, Search, Trash2, Undo2 } from 'lucide-react';
import { API_MODE, api } from '@/data/db';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { PageHeader, useToast } from '@/components/ui';
import { Butterfly } from '@/components/Butterfly';
import { resetBranding, saveBranding, useBranding } from '@/branding/BrandingContext';
import { LOGO_FILTER, type BrandColors, type Branding, type LogoStyle, type SiteBranding } from '@/branding/brandingSchema';
import '../branding.css';

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Any image (PNG, JPEG, WebP, GIF, SVG) → a PNG data URL no larger than `max` px on its longest side. */
async function toPng(src: string, max: number): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('Image illisible / Unreadable image'));
    im.src = src;
  });
  const w = img.naturalWidth || 256;
  const h = img.naturalHeight || 256;
  const scale = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  let out = canvas.toDataURL('image/png');
  if (out.length > 650_000) out = canvas.toDataURL('image/webp', 0.9);
  if (out.length > 650_000) throw new Error('Image trop lourde / Image too large');
  return out;
}

const readFile = (f: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(f);
  });

type ColorKey = keyof BrandColors;
const COLOR_FIELDS: { key: ColorKey; fr: string; en: string; fallback: string }[] = [
  { key: 'primary', fr: 'Couleur principale (boutons, liens, accent)', en: 'Main colour (buttons, links, accent)', fallback: '#da291c' },
  { key: 'sidebarBg', fr: 'Fond du menu latéral', en: 'Sidebar background', fallback: '#0a0a0a' },
  { key: 'sidebarText', fr: 'Texte du menu latéral', en: 'Sidebar text', fallback: '#f1f1f1' },
  { key: 'bgLight', fr: 'Fond des pages (thème clair)', en: 'Page background (light theme)', fallback: '#f4f4f3' },
  { key: 'bgDark', fr: 'Fond des pages (thème sombre)', en: 'Page background (dark theme)', fallback: '#0d0d0e' },
];

export function Branding() {
  const { t } = useI18n();
  const toast = useToast();
  const { branding, refresh, preview } = useBranding();
  const [draft, setDraft] = useState<Branding>(branding);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  // Follow the saved branding until something is changed here.
  useEffect(() => {
    if (!dirty) setDraft(branding);
  }, [branding, dirty]);
  // Live preview of the draft in the whole app; back to the saved branding when leaving the page.
  useEffect(() => {
    preview(dirty ? draft : null);
  }, [draft, dirty, preview]);
  useEffect(() => () => preview(null), [preview]);

  const set = (patch: Partial<Branding>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };
  const setColor = (key: ColorKey, value: string | null) => set({ colors: { ...draft.colors, [key]: value } });

  async function onLogo(e: ChangeEvent<HTMLInputElement>, field: 'logo' | 'favicon') {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      set({ [field]: await toPng(await readFile(f), field === 'logo' ? 512 : 64) } as Partial<Branding>);
    } catch (err) {
      toast(errorText(err), 'err');
    }
  }

  async function save() {
    setBusy(true);
    try {
      await saveBranding(draft);
      setDirty(false);
      await refresh();
      toast(t('Image de marque enregistrée', 'Branding saved'));
    } catch (err) {
      toast(errorText(err), 'err');
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!window.confirm(t('Revenir à l’image de marque Pubco par défaut (nom, logo, couleurs) ?', 'Go back to the default Pubco branding (name, logo, colours)?'))) return;
    setBusy(true);
    try {
      await resetBranding();
      setDirty(false);
      await refresh();
      toast(t('Image de marque par défaut rétablie', 'Default branding restored'));
    } catch (err) {
      toast(errorText(err), 'err');
    } finally {
      setBusy(false);
    }
  }

  const cancel = () => {
    setDirty(false);
    setDraft(branding);
  };

  return (
    <Page>
      <PageHeader
        eyebrow={t('Administration', 'Administration')}
        title={t('Image de marque', 'Branding')}
        subtitle={t('Nom de l’application, logo et couleurs. Les changements s’affichent en aperçu ; rien n’est appliqué pour tous avant « Enregistrer ».', 'App name, logo and colours. Changes show as a preview; nothing applies to everyone before "Save".')}
        actions={
          <>
            <button className="btn" disabled={busy} onClick={() => void reset()} title={t('Revenir au défaut', 'Back to default')}>
              <RotateCcw size={15} /> {t('Par défaut', 'Default')}
            </button>
            <button className="btn" disabled={!dirty || busy} onClick={cancel}>
              <Undo2 size={15} /> {t('Annuler', 'Cancel')}
            </button>
            <button className="btn btn-primary" disabled={!dirty || busy} onClick={() => void save()}>
              <Save size={15} /> {t('Enregistrer', 'Save')}
            </button>
          </>
        }
      />
      {dirty && <div className="alert alert-info" style={{ marginBottom: 16 }}>{t('Aperçu : vous voyez les changements, les autres non. Enregistrez pour les appliquer à tout le monde.', 'Preview: you see the changes, others do not. Save to apply them for everyone.')}</div>}

      <div className="brand-grid">
        <div className="stack" style={{ gap: 16 }}>
          {/* Name */}
          <section className="card card-pad stack">
            <h3>{t('Nom', 'Name')}</h3>
            <label className="field">
              <span>{t('Nom de l’application (menu latéral, connexion)', 'App name (sidebar, sign-in)')}</span>
              <input className="input" maxLength={40} value={draft.appName} onChange={(e) => set({ appName: e.target.value })} />
            </label>
            <label className="field">
              <span>{t('Ligne sous le nom', 'Line under the name')}</span>
              <input className="input" maxLength={60} value={draft.tagline} onChange={(e) => set({ tagline: e.target.value })} />
            </label>
            <label className="field">
              <span>{t('Titre de l’onglet du navigateur', 'Browser tab title')}</span>
              <input className="input" maxLength={80} value={draft.title} onChange={(e) => set({ title: e.target.value })} />
            </label>
          </section>

          {/* Logo */}
          <section className="card card-pad stack">
            <h3>{t('Logo et icône', 'Logo and icon')}</h3>
            <div className="brand-logo-row">
              <div className="brand-logo-box">{draft.logo ? <img src={draft.logo} alt="" style={{ filter: LOGO_FILTER[draft.logoStyle ?? 'normal'] }} /> : <Butterfly size={56} />}</div>
              <div className="stack" style={{ gap: 6 }}>
                <label className="btn btn-sm">
                  <ImagePlus size={14} /> {t('Changer le logo', 'Change the logo')}
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden onChange={(e) => void onLogo(e, 'logo')} />
                </label>
                {draft.logo && (
                  <button className="btn btn-ghost btn-sm" onClick={() => set({ logo: null })}>
                    <Trash2 size={14} /> {t('Revenir au papillon', 'Back to the butterfly')}
                  </button>
                )}
                <span className="small muted">{t('PNG, JPEG, WebP ou SVG. Fond transparent conseillé.', 'PNG, JPEG, WebP or SVG. A transparent background works best.')}</span>
              </div>
            </div>
            {draft.logo && (
              <div className="field">
                <span>{t('Couleur du logo (le menu latéral est foncé)', 'Logo colour (the sidebar is dark)')}</span>
                <div className="brand-logo-styles" role="group" aria-label={t('Couleur du logo', 'Logo colour')}>
                  {(
                    [
                      ['normal', 'Normale', 'Normal'],
                      ['invert', 'Inversée', 'Inverted'],
                      ['white', 'Tout en blanc', 'All white'],
                      ['black', 'Tout en noir', 'All black'],
                    ] as [LogoStyle, string, string][]
                  ).map(([key, fr, en]) => (
                    <button
                      key={key}
                      type="button"
                      className={`brand-logo-style${(draft.logoStyle ?? 'normal') === key ? ' on' : ''}`}
                      aria-pressed={(draft.logoStyle ?? 'normal') === key}
                      onClick={() => set({ logoStyle: key })}
                    >
                      <span className="brand-logo-style-box">
                        <img src={draft.logo!} alt="" style={{ filter: LOGO_FILTER[key] }} />
                      </span>
                      {t(fr, en)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="brand-logo-row">
              <div className="brand-logo-box brand-icon-box">{draft.favicon ? <img src={draft.favicon} alt="" /> : <Butterfly size={24} />}</div>
              <div className="stack" style={{ gap: 6 }}>
                <label className="btn btn-sm">
                  <ImagePlus size={14} /> {t('Icône de l’onglet', 'Tab icon')}
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon" hidden onChange={(e) => void onLogo(e, 'favicon')} />
                </label>
                {draft.logo && (
                  <button className="btn btn-ghost btn-sm" onClick={() => void toPng(draft.logo!, 64).then((favicon) => set({ favicon }))}>
                    {t('Utiliser le logo', 'Use the logo')}
                  </button>
                )}
                {draft.favicon && (
                  <button className="btn btn-ghost btn-sm" onClick={() => set({ favicon: null })}>
                    <Trash2 size={14} /> {t('Icône par défaut', 'Default icon')}
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Colours */}
          <section className="card card-pad stack">
            <h3>
              <Palette size={16} /> {t('Couleurs', 'Colours')}
            </h3>
            {COLOR_FIELDS.map((c) => {
              const v = draft.colors[c.key];
              return (
                <div key={c.key} className="brand-color-row">
                  <input type="color" value={v ?? c.fallback} onChange={(e) => setColor(c.key, e.target.value)} aria-label={t(c.fr, c.en)} />
                  <span className="brand-color-label">{t(c.fr, c.en)}</span>
                  <span className="mono small muted">{v ?? t('défaut', 'default')}</span>
                  {v && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setColor(c.key, null)} title={t('Couleur par défaut', 'Default colour')}>
                      <RotateCcw size={13} />
                    </button>
                  )}
                </div>
              );
            })}
            <span className="small muted">{t('Les couleurs propres à chaque module (Align, KPI, etc.) ne changent pas.', 'Each module’s own colour (Align, KPI, etc.) does not change.')}</span>
          </section>
        </div>

        <SiteImport set={set} setColor={setColor} />
      </div>
    </Page>
  );
}

/** "Import from a web site": read a site, then pick what to use. */
function SiteImport({ set, setColor }: { set: (p: Partial<Branding>) => void; setColor: (k: ColorKey, v: string | null) => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [site, setSite] = useState<SiteBranding | null>(null);
  const [target, setTarget] = useState<ColorKey>('primary');

  async function inspect() {
    if (!url.trim()) return;
    setBusy(true);
    setSite(null);
    try {
      setSite(await api<SiteBranding>('/branding/inspect', { method: 'POST', body: { url: url.trim() } }));
    } catch (err) {
      toast(errorText(err), 'err');
    } finally {
      setBusy(false);
    }
  }

  const useImage = async (src: string, field: 'logo' | 'favicon') => {
    try {
      set({ [field]: await toPng(src, field === 'logo' ? 512 : 64) } as Partial<Branding>);
      toast(field === 'logo' ? t('Logo choisi (aperçu)', 'Logo chosen (preview)') : t('Icône choisie (aperçu)', 'Icon chosen (preview)'));
    } catch (err) {
      toast(errorText(err), 'err');
    }
  };

  return (
    <section className="card card-pad stack brand-import">
      <h3>
        <Globe size={16} /> {t('Importer depuis un site web', 'Import from a web site')}
      </h3>
      <p className="small muted" style={{ margin: 0 }}>
        {t('Le serveur lit la page d’accueil du site et propose son nom, ses logos, ses icônes et ses couleurs. Choisissez ce que vous voulez utiliser : rien n’est appliqué sans votre clic, et rien n’est enregistré avant « Enregistrer ».', 'The server reads the site’s home page and suggests its name, logos, icons and colours. Pick what you want to use: nothing is applied without your click, and nothing is saved before "Save".')}
      </p>
      {!API_MODE ? (
        <div className="alert alert-warn">{t('Disponible avec le serveur Imago (pas dans la démo du navigateur).', 'Available with the Imago server (not in the browser demo).')}</div>
      ) : (
        <form
          className="row"
          style={{ gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            void inspect();
          }}
        >
          <input className="input" style={{ flex: 1 }} placeholder="https://www.pubco.com" value={url} maxLength={500} onChange={(e) => setUrl(e.target.value)} aria-label={t('Adresse du site', 'Site address')} />
          <button className="btn btn-primary" disabled={busy || !url.trim()}>
            <Search size={15} /> {busy ? t('Lecture…', 'Reading…') : t('Analyser', 'Analyse')}
          </button>
        </form>
      )}

      {site && (
        <div className="stack" style={{ gap: 14 }}>
          <div className="small muted">{site.url}</div>

          {site.name && (
            <div className="brand-suggest">
              <div>
                <div className="small muted">{t('Nom', 'Name')}</div>
                <strong>{site.name}</strong>
              </div>
              <div className="row row-wrap" style={{ gap: 6 }}>
                <button className="btn btn-sm" onClick={() => set({ appName: site.name!.slice(0, 40) })}>{t('Comme nom', 'As name')}</button>
                <button className="btn btn-sm" onClick={() => set({ title: site.name!.slice(0, 80) })}>{t('Comme titre d’onglet', 'As tab title')}</button>
              </div>
            </div>
          )}
          {site.description && (
            <div className="brand-suggest">
              <div>
                <div className="small muted">{t('Description', 'Description')}</div>
                <span className="small">{site.description}</span>
              </div>
              <button className="btn btn-sm" onClick={() => set({ tagline: site.description!.slice(0, 60) })}>{t('Comme ligne sous le nom', 'As the line under the name')}</button>
            </div>
          )}

          <div>
            <div className="small muted" style={{ marginBottom: 6 }}>{t('Logos et icônes trouvés', 'Logos and icons found')}</div>
            {site.images.length === 0 ? (
              <div className="small muted">{t('Aucune image trouvée.', 'No image found.')}</div>
            ) : (
              <div className="brand-images">
                {site.images.map((img, i) => (
                  <div key={i} className="brand-image">
                    <div className="brand-image-box">
                      <img src={img.src} alt="" />
                    </div>
                    <span className="small muted">{img.label}</span>
                    <div className="row" style={{ gap: 4 }}>
                      <button className="btn btn-sm" onClick={() => void useImage(img.src, 'logo')}>
                        {t('Logo', 'Logo')}
                      </button>
                      <button className="btn btn-sm" onClick={() => void useImage(img.src, 'favicon')}>{t('Icône', 'Icon')}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="row row-wrap" style={{ gap: 8, marginBottom: 6, alignItems: 'center' }}>
              <span className="small muted">{t('Couleurs du site — cliquer pour l’utiliser comme :', 'Site colours — click to use as:')}</span>
              <select className="select" style={{ width: 'auto' }} value={target} onChange={(e) => setTarget(e.target.value as ColorKey)}>
                {COLOR_FIELDS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {t(c.fr, c.en)}
                  </option>
                ))}
              </select>
            </div>
            {site.colors.length === 0 ? (
              <div className="small muted">{t('Aucune couleur trouvée.', 'No colour found.')}</div>
            ) : (
              <div className="brand-swatches">
                {site.colors.map((c) => (
                  <button key={c} className="brand-swatch" style={{ background: c }} title={c} onClick={() => setColor(target, c)}>
                    <span>{c}</span>
                    {c === site.themeColor && <em>{t('thème', 'theme')}</em>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {site.fonts.length > 0 && (
            <div className="small muted">
              {t('Polices du site (pour information)', 'Site fonts (for information)')} : {site.fonts.join(', ')}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

