import { useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Loader2, Mail, Paperclip, Send, Camera, X } from 'lucide-react';
import { useI18n, type L } from '@/i18n';
import { Page } from '@/components/Page';
import { PageHeader, useToast } from '@/components/ui';
import { DEFAULT_REQUEST_FORM, answersToRequestFields } from '../formFields';
import { createRequest, requiredMissing, uploadFile } from '../stores';

type Tab = 'form' | 'email' | 'photo';
const MAX_BYTES = 4 * 1024 * 1024;
const ACCEPT = 'image/*,application/pdf';

const TABS: { key: Tab; label: L; icon: typeof FileText }[] = [
  { key: 'form', label: { fr: 'Formulaire', en: 'Form' }, icon: FileText },
  { key: 'email', label: { fr: 'Courriel', en: 'E-mail' }, icon: Mail },
  { key: 'photo', label: { fr: 'Photo / dessin', en: 'Photo / drawing' }, icon: Camera },
];

/** Picks files under 4 MB; the others are reported. */
function useFilePicker() {
  const toast = useToast();
  const { t } = useI18n();
  const [files, setFiles] = useState<File[]>([]);
  const add = (list: FileList | null) => {
    if (!list) return;
    const ok: File[] = [];
    for (const f of Array.from(list)) {
      if (f.size > MAX_BYTES) toast(t(`« ${f.name} » dépasse 4 Mo.`, `“${f.name}” is over 4 MB.`), 'err');
      else ok.push(f);
    }
    setFiles((prev) => [...prev, ...ok]);
  };
  return { files, add, remove: (i: number) => setFiles((prev) => prev.filter((_, j) => j !== i)) };
}

function FilesField({ picker, label }: { picker: ReturnType<typeof useFilePicker>; label: string }) {
  const { t } = useI18n();
  return (
    <div className="field">
      <span>{label}</span>
      <label className="sl-dropzone-wrap sl-dropzone">
        <Paperclip size={22} aria-hidden="true" />
        <span>{t('Choisir des images ou des PDF (4 Mo max chacun)', 'Choose images or PDFs (4 MB max each)')}</span>
        <input type="file" multiple accept={ACCEPT} onChange={(e: ChangeEvent<HTMLInputElement>) => { picker.add(e.target.files); e.target.value = ''; }} aria-label={label} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
      </label>
      {picker.files.length > 0 && (
        <ul className="sl-files">
          {picker.files.map((f, i) => (
            <li key={`${f.name}-${i}`}>
              <span className="mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.name}
              </span>
              <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => picker.remove(i)} aria-label={t(`Retirer ${f.name}`, `Remove ${f.name}`)}>
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function NewRequest() {
  const { t } = useI18n();
  const toast = useToast();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('form');
  const [busy, setBusy] = useState<null | 'upload' | 'read'>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const formFiles = useFilePicker();
  const emailFiles = useFilePicker();
  const photoFiles = useFilePicker();
  const [email, setEmail] = useState({ from: '', subject: '', body: '' });
  const [photo, setPhoto] = useState('');

  const setAns = (id: string, v: string) => setAnswers((a) => ({ ...a, [id]: v }));

  const submit = async (kind: Tab) => {
    let text = '';
    let fields: Parameters<typeof createRequest>[0]['fields'] = {};
    let source: 'manual' | 'email' = 'manual';
    let files: File[] = [];

    if (kind === 'form') {
      const miss = requiredMissing(DEFAULT_REQUEST_FORM, answers);
      setMissing(miss);
      if (miss.length) {
        toast(t('Complétez les champs obligatoires.', 'Fill in the required fields.'), 'err');
        return;
      }
      const f = answersToRequestFields(answers);
      fields = { ...f, formAnswers: answers };
      text = DEFAULT_REQUEST_FORM.filter((q) => q.type !== 'file' && answers[q.id])
        .map((q) => `${t(q.label)} : ${answers[q.id]}`)
        .join('\n');
      files = formFiles.files;
    } else if (kind === 'email') {
      if (!email.body.trim()) {
        toast(t('Collez le texte du courriel.', 'Paste the e-mail text.'), 'err');
        return;
      }
      source = 'email';
      fields = { description: email.body.trim() };
      text = [email.from && `De : ${email.from}`, email.subject && `Objet : ${email.subject}`, '', email.body.trim()].filter(Boolean).join('\n');
      files = emailFiles.files;
    } else {
      if (!photo.trim() && !photoFiles.files.length) {
        toast(t('Ajoutez une photo ou une description.', 'Add a photo or a description.'), 'err');
        return;
      }
      fields = { description: photo.trim() };
      text = photo.trim();
      files = photoFiles.files;
    }

    try {
      let fileIds: string[] = [];
      if (files.length) {
        setBusy('upload');
        fileIds = [];
        for (const f of files) fileIds.push(await uploadFile(f));
      }
      setBusy('read');
      const created = await createRequest({ fields, text, fileIds, source });
      toast(t('Demande créée', 'Request created'));
      nav(`/sales?r=${encodeURIComponent(created.id)}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
      setBusy(null);
    }
  };

  const progress = busy && (
    <div className="sl-progress" role="status" aria-live="polite">
      <Loader2 size={20} className="sl-spin" aria-hidden="true" />
      <div>
        <strong>{busy === 'upload' ? t('Envoi des fichiers…', 'Uploading files…') : t('Lecture par l’IA…', 'AI reading…')}</strong>
        <div className="small muted">
          {busy === 'read'
            ? t('Le contenu est lu et une première estimation est préparée. Cela prend quelques secondes.', 'The content is read and a first estimate is prepared. This takes a few seconds.')
            : t('Vos fichiers sont envoyés au serveur.', 'Your files are being sent to the server.')}
        </div>
      </div>
    </div>
  );

  return (
    <Page>
      <PageHeader
        eyebrow={t('Ventes', 'Sales')}
        title={t('Nouvelle demande', 'New request')}
        subtitle={t('Saisissez la demande du client de l’une des trois façons. L’IA prépare le dossier.', 'Enter the customer request in one of three ways. The AI prepares the file.')}
      />

      <div className="tabs sl-tabs-wrap" role="tablist" aria-label={t('Mode de saisie', 'Entry mode')}>
        {TABS.map((x) => (
          <button key={x.key} type="button" role="tab" aria-selected={tab === x.key} className={`tab ${tab === x.key ? 'active' : ''}`} onClick={() => setTab(x.key)} disabled={!!busy}>
            <x.icon size={15} aria-hidden="true" style={{ marginRight: 6, verticalAlign: '-2px' }} />
            {t(x.label)}
          </button>
        ))}
      </div>

      <div className="card sl-section" style={{ display: 'grid', gap: 16 }}>
        {tab === 'form' && (
          <>
            <div className="sl-form-grid">
              {DEFAULT_REQUEST_FORM.filter((f) => f.type !== 'file').map((f) => {
                const bad = missing.includes(f.id);
                const val = answers[f.id] ?? '';
                const cls = f.type === 'textarea' || f.type === 'multiselect' ? 'span-2' : '';
                const label = `${t(f.label)}${f.required ? ' *' : ''}`;
                const control =
                  f.type === 'textarea' ? (
                    <textarea className="textarea" rows={3} value={val} onChange={(e) => setAns(f.id, e.target.value)} aria-invalid={bad} />
                  ) : f.type === 'select' ? (
                    <select className="select" value={val} onChange={(e) => setAns(f.id, e.target.value)} aria-invalid={bad}>
                      <option value="">{t('—', '—')}</option>
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {t(o.label)}
                        </option>
                      ))}
                    </select>
                  ) : f.type === 'multiselect' ? (
                    <div className="row row-wrap" style={{ gap: 6 }}>
                      {f.options?.map((o) => {
                        const set = val ? val.split(',').filter(Boolean) : [];
                        const on = set.includes(o.value);
                        return (
                          <button
                            key={o.value}
                            type="button"
                            className="sl-chip-filter"
                            aria-pressed={on}
                            onClick={() => setAns(f.id, (on ? set.filter((x) => x !== o.value) : [...set, o.value]).join(','))}
                          >
                            {t(o.label)}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <input className="input" type={f.type === 'number' ? 'number' : 'text'} value={val} onChange={(e) => setAns(f.id, e.target.value)} aria-invalid={bad} />
                  );
                return (
                  <label key={f.id} className={`field ${cls}`}>
                    <span>{label}</span>
                    {control}
                    {f.help && <span className="sl-help">{t(f.help)}</span>}
                  </label>
                );
              })}
            </div>
            <FilesField picker={formFiles} label={t('Fichiers (graphisme, croquis, photos)', 'Files (artwork, sketches, photos)')} />
          </>
        )}

        {tab === 'email' && (
          <>
            <p className="sl-help" style={{ fontSize: 14 }}>
              {t('Collez le courriel du client tel quel. Joignez les images utiles ; les pièces jointes du courriel peuvent être ajoutées ici.', 'Paste the customer e-mail as it is. Attach the useful images; the e-mail attachments can be added here.')}
            </p>
            <div className="sl-form-grid">
              <label className="field">
                <span>{t('De', 'From')}</span>
                <input className="input" value={email.from} onChange={(e) => setEmail({ ...email, from: e.target.value })} />
              </label>
              <label className="field">
                <span>{t('Objet', 'Subject')}</span>
                <input className="input" value={email.subject} onChange={(e) => setEmail({ ...email, subject: e.target.value })} />
              </label>
              <label className="field span-2">
                <span>{t('Texte du courriel', 'E-mail text')}</span>
                <textarea className="textarea" rows={8} value={email.body} onChange={(e) => setEmail({ ...email, body: e.target.value })} />
              </label>
            </div>
            <FilesField picker={emailFiles} label={t('Pièces jointes', 'Attachments')} />
          </>
        )}

        {tab === 'photo' && (
          <>
            <p className="sl-help" style={{ fontSize: 14 }}>
              {t('Une photo d’un emballage existant, un croquis ou un PDF de graphisme. Ajoutez une phrase pour dire ce qu’on veut.', 'A photo of an existing package, a sketch or an artwork PDF. Add a sentence on what is wanted.')}
            </p>
            <FilesField picker={photoFiles} label={t('Photo ou dessin', 'Photo or drawing')} />
            <label className="field">
              <span>{t('Description courte', 'Short description')}</span>
              <textarea className="textarea" rows={3} value={photo} onChange={(e) => setPhoto(e.target.value)} placeholder={t('Ex. Boîte comme celle-ci, en 1000 unités, avec logo en deux couleurs.', 'E.g. Box like this one, 1000 units, with a two-colour logo.')} />
            </label>
          </>
        )}

        {progress}

        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => submit(tab)}>
            <Send size={16} /> {t('Créer la demande', 'Create request')}
          </button>
        </div>
      </div>
    </Page>
  );
}
