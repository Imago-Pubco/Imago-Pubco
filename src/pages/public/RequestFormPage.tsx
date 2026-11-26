/**
 * Public request form (/request). Anyone can describe a project; the answers become a sales request.
 * The questions come from GET /request-form, so they can change without a code change.
 */
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, Paperclip, X } from 'lucide-react';
import { Butterfly } from '@/components/Butterfly';
import { useI18n } from '@/i18n';
import type { FormField } from '@/modules/sales/types';
import { PublicApiError, PublicShell, publicApi } from './publicShared';

interface FormDef {
  fields: FormField[];
  company?: string;
}

interface UploadItem {
  key: string;
  name: string;
  size: number;
  /** 0-30 while the file is read, 30-100 while it is sent. */
  progress: number;
  status: 'uploading' | 'done' | 'error';
  fileId?: string;
  error?: string;
}

const MAX_FILES = 5;
const MAX_FILE_BYTES = 4 * 1024 * 1024;

function isAllowedFile(f: File): boolean {
  return f.type.startsWith('image/') || f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
}

export function RequestFormPage() {
  const { t } = useI18n();
  const [form, setForm] = useState<FormDef | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [uploads, setUploads] = useState<Record<string, UploadItem[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [reference, setReference] = useState<string | null>(null);
  const busyRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const xhrs = useRef(new Map<string, XMLHttpRequest>());
  const cancelled = useRef(new Set<string>());
  const counter = useRef(0);
  // Read by addFiles so it sees the latest list even when several picks happen in a row.
  const uploadsRef = useRef(uploads);
  uploadsRef.current = uploads;

  useEffect(() => {
    let alive = true;
    setLoadError(false);
    publicApi<FormDef>('/request-form').then(
      (f) => {
        if (alive) setForm(f);
      },
      () => {
        if (alive) setLoadError(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [attempt]);

  useEffect(() => {
    if (reference) doneRef.current?.focus();
  }, [reference]);

  // Stop any upload still running when the visitor leaves the page.
  useEffect(() => {
    const pending = xhrs.current;
    return () => pending.forEach((x) => x.abort());
  }, []);

  const clearErr = (id: string) =>
    setErrors((p) => (id in p ? Object.fromEntries(Object.entries(p).filter(([k]) => k !== id)) : p));

  const setValue = (id: string, v: string | string[]) => {
    setValues((p) => ({ ...p, [id]: v }));
    clearErr(id);
  };

  const toggleOption = (field: FormField, opt: string, on: boolean) => {
    const cur = Array.isArray(values[field.id]) ? (values[field.id] as string[]) : [];
    const next = (field.options ?? []).map((o) => o.value).filter((v) => (v === opt ? on : cur.includes(v)));
    setValue(field.id, next);
  };

  const patchUpload = (fieldId: string, key: string, patch: Partial<UploadItem>) =>
    setUploads((prev) => ({
      ...prev,
      [fieldId]: (prev[fieldId] ?? []).map((it) => (it.key === key ? { ...it, ...patch } : it)),
    }));

  const startUpload = (fieldId: string, key: string, file: File) => {
    const failed = t('Téléversement impossible.', 'Upload failed.');
    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable) patchUpload(fieldId, key, { progress: Math.round((e.loaded / e.total) * 30) });
    };
    reader.onerror = () => patchUpload(fieldId, key, { status: 'error', error: failed });
    reader.onload = () => {
      if (cancelled.current.has(key)) return;
      const url = String(reader.result ?? '');
      const dataBase64 = url.slice(url.indexOf(',') + 1);
      const xhr = new XMLHttpRequest();
      xhrs.current.set(key, xhr);
      xhr.open('POST', '/api/public/upload');
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('X-Imago', '1');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) patchUpload(fieldId, key, { progress: 30 + Math.round((e.loaded / e.total) * 70) });
      };
      xhr.onload = () => {
        xhrs.current.delete(key);
        let fileId = '';
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            fileId = (JSON.parse(xhr.responseText) as { fileId?: string }).fileId ?? '';
          } catch {
            fileId = '';
          }
        }
        if (fileId) patchUpload(fieldId, key, { status: 'done', progress: 100, fileId });
        else patchUpload(fieldId, key, { status: 'error', error: failed });
      };
      xhr.onerror = () => {
        xhrs.current.delete(key);
        patchUpload(fieldId, key, { status: 'error', error: failed });
      };
      xhr.onabort = () => xhrs.current.delete(key);
      xhr.send(JSON.stringify({ name: file.name, contentType: file.type || 'application/octet-stream', dataBase64 }));
    };
    reader.readAsDataURL(file);
  };

  const addFiles = (field: FormField, picked: File[]) => {
    const current = uploadsRef.current[field.id] ?? [];
    const room = Math.max(MAX_FILES - current.length, 0);
    const problems: string[] = [];
    const ok: File[] = [];
    for (const f of picked) {
      if (!isAllowedFile(f)) problems.push(t(`« ${f.name} » : type non accepté (images ou PDF).`, `“${f.name}”: file type not accepted (images or PDF).`));
      else if (f.size > MAX_FILE_BYTES) problems.push(t(`« ${f.name} » dépasse 4 Mo.`, `“${f.name}” is larger than 4 MB.`));
      else ok.push(f);
    }
    if (ok.length > room) problems.push(t(`Maximum ${MAX_FILES} fichiers.`, `Maximum ${MAX_FILES} files.`));
    if (problems.length) setErrors((p) => ({ ...p, [field.id]: problems.join(' ') }));
    else clearErr(field.id);

    const toSend = ok.slice(0, room);
    if (!toSend.length) return;
    const items: UploadItem[] = toSend.map((f) => {
      counter.current += 1;
      return { key: `u${counter.current}`, name: f.name, size: f.size, progress: 0, status: 'uploading' };
    });
    setUploads((prev) => ({ ...prev, [field.id]: [...(prev[field.id] ?? []), ...items] }));
    toSend.forEach((f, i) => startUpload(field.id, items[i].key, f));
  };

  const removeUpload = (fieldId: string, key: string) => {
    cancelled.current.add(key);
    xhrs.current.get(key)?.abort();
    xhrs.current.delete(key);
    setUploads((prev) => ({ ...prev, [fieldId]: (prev[fieldId] ?? []).filter((it) => it.key !== key) }));
    clearErr(fieldId);
  };

  const validate = (fields: FormField[]): Record<string, string> => {
    const e: Record<string, string> = {};
    const required = t('Champ obligatoire.', 'Required field.');
    for (const f of fields) {
      if (f.type === 'file') {
        const list = uploads[f.id] ?? [];
        if (list.some((i) => i.status === 'uploading')) e[f.id] = t('Attendez la fin du téléversement.', 'Wait for the upload to finish.');
        else if (list.some((i) => i.status === 'error')) e[f.id] = t('Retirez les fichiers en erreur.', 'Remove the files that failed.');
        else if (f.required && list.length === 0) e[f.id] = required;
        continue;
      }
      const v = values[f.id];
      if (f.type === 'multiselect') {
        if (f.required && !(Array.isArray(v) && v.length > 0)) e[f.id] = required;
        continue;
      }
      const s = typeof v === 'string' ? v.trim() : '';
      if (f.required && !s) e[f.id] = required;
      else if (f.type === 'number' && s && !Number.isFinite(Number(s))) e[f.id] = t('Entrez un nombre.', 'Enter a number.');
    }
    return e;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form || busyRef.current) return;
    setSubmitError('');
    const errs = validate(form.fields);
    setErrors(errs);
    if (Object.keys(errs).length) {
      // Move focus to the first field with a problem, once the error messages are rendered.
      setTimeout(() => {
        formRef.current?.querySelector<HTMLElement>('[data-invalid="true"]')?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
      }, 0);
      return;
    }

    const answers: Record<string, string> = {};
    for (const f of form.fields) {
      if (f.type === 'file') continue;
      const v = values[f.id];
      answers[f.id] = Array.isArray(v) ? v.join(', ') : (v ?? '').trim();
    }
    const fileIds: string[] = [];
    for (const list of Object.values(uploads)) {
      for (const it of list) if (it.status === 'done' && it.fileId) fileIds.push(it.fileId);
    }

    busyRef.current = true;
    setBusy(true);
    try {
      const r = await publicApi<{ ok: boolean; reference: string }>('/request', {
        method: 'POST',
        body: { answers, fileIds, website: honeypot },
      });
      setReference(r.reference);
    } catch (err) {
      setSubmitError(
        err instanceof PublicApiError && err.status === 429
          ? t('Trop de demandes. Réessayez dans quelques minutes.', 'Too many requests. Please try again in a few minutes.')
          : t('Envoi impossible. Vérifiez votre connexion et réessayez.', 'Could not send. Check your connection and try again.'),
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  if (reference) {
    return (
      <PublicShell company={form?.company}>
        <section className="pub-card pub-thanks" role="status">
          <CheckCircle2 size={48} color="var(--ok)" aria-hidden="true" />
          <h1 ref={doneRef} tabIndex={-1}>
            {t('Merci !', 'Thank you!')}
          </h1>
          <p>{t('Votre demande a bien été reçue.', 'We have received your request.')}</p>
          <p>
            {t('Numéro de référence', 'Reference number')} : <strong className="pub-ref">{reference}</strong>
          </p>
          <p className="pub-muted">{t('Nous vous répondrons sous peu.', 'We will get back to you shortly.')}</p>
        </section>
      </PublicShell>
    );
  }

  if (!form) {
    return (
      <PublicShell>
        {loadError ? (
          <section className="pub-card pub-state" role="alert">
            <AlertCircle size={40} color="var(--err)" aria-hidden="true" />
            <h1>{t('Formulaire indisponible', 'Form unavailable')}</h1>
            <p>{t('Serveur injoignable. Réessayez.', 'Server unreachable. Please try again.')}</p>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={() => {
                setForm(null);
                setAttempt((a) => a + 1);
              }}
            >
              {t('Réessayer', 'Try again')}
            </button>
          </section>
        ) : (
          <section className="pub-card pub-state" role="status">
            <Butterfly size={56} flutter />
            <p>{t('Chargement…', 'Loading…')}</p>
          </section>
        )}
      </PublicShell>
    );
  }

  return (
    <PublicShell company={form.company}>
      <section className="pub-card">
        <h1>{t('Demande de soumission', 'Request a quote')}</h1>
        <p className="pub-muted" style={{ margin: '8px 0 0' }}>
          {t('Décrivez votre projet. Nous préparerons une soumission et vous la transmettrons par courriel.', 'Describe your project. We will prepare a quote and send it to you by e-mail.')}
        </p>

        <form ref={formRef} className="pub-form" style={{ marginTop: 24 }} onSubmit={submit} noValidate>
          {form.fields.map((f) => (
            <FieldView
              key={f.id}
              field={f}
              value={values[f.id]}
              error={errors[f.id]}
              items={uploads[f.id]}
              onText={(v) => setValue(f.id, v)}
              onToggle={(opt, on) => toggleOption(f, opt, on)}
              onFiles={(list) => addFiles(f, list)}
              onRemove={(key) => removeUpload(f.id, key)}
            />
          ))}

          {/* Honeypot: hidden from people and skipped by keyboard. Bots that fill it are rejected by the server. */}
          <div className="pub-hp" aria-hidden="true">
            <label>
              {t('Site web', 'Website')}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
            </label>
          </div>

          {submitError && (
            <div className="alert alert-err" role="alert">
              <AlertCircle size={16} aria-hidden="true" /> {submitError}
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-lg pub-submit" disabled={busy}>
            {busy && <Butterfly size={20} color="currentColor" flutter />}
            {t('Envoyer la demande', 'Send request')}
          </button>
        </form>
      </section>
    </PublicShell>
  );
}

interface FieldProps {
  field: FormField;
  value: string | string[] | undefined;
  error?: string;
  items?: UploadItem[];
  onText: (v: string) => void;
  onToggle: (opt: string, on: boolean) => void;
  onFiles: (files: File[]) => void;
  onRemove: (key: string) => void;
}

function FieldView({ field, value, error, items, onText, onToggle, onFiles, onRemove }: FieldProps) {
  const { t } = useI18n();
  const id = `rf-${field.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const helpId = `${id}-help`;
  const errId = `${id}-err`;
  const describedBy = [field.help ? helpId : '', error ? errId : ''].filter(Boolean).join(' ') || undefined;
  const invalid = error ? 'true' : undefined;
  const label = t(field.label);
  const req = field.required ? (
    <span className="pub-req" aria-hidden="true">
      {' '}*
    </span>
  ) : null;
  const help = field.help ? (
    <small id={helpId} className="pub-help">
      {t(field.help)}
    </small>
  ) : null;
  const err = error ? (
    <div id={errId} className="pub-err" role="alert">
      <AlertCircle size={14} aria-hidden="true" /> {error}
    </div>
  ) : null;
  const str = typeof value === 'string' ? value : '';

  if (field.type === 'multiselect') {
    const chosen = Array.isArray(value) ? value : [];
    return (
      <fieldset className="pub-field pub-fieldset" data-invalid={invalid} aria-describedby={describedBy}>
        <legend className="pub-label">
          {label}
          {req}
        </legend>
        {help}
        <div className="pub-checks">
          {(field.options ?? []).map((o) => (
            <label key={o.value} className="pub-check">
              <input type="checkbox" value={o.value} checked={chosen.includes(o.value)} onChange={(e) => onToggle(o.value, e.target.checked)} />
              <span>{t(o.label)}</span>
            </label>
          ))}
        </div>
        {err}
      </fieldset>
    );
  }

  if (field.type === 'file') {
    const onPick = (e: ChangeEvent<HTMLInputElement>) => {
      const list = Array.from(e.target.files ?? []);
      e.target.value = ''; // allow picking the same file again
      if (list.length) onFiles(list);
    };
    return (
      <div className="pub-field" data-invalid={invalid}>
        <label className="pub-label" htmlFor={id}>
          {label}
          {req}
        </label>
        {help}
        <input id={id} className="pub-file" type="file" accept="image/*,.pdf" multiple onChange={onPick} aria-invalid={invalid} aria-describedby={describedBy} />
        <small className="pub-help">{t('Images ou PDF, 5 fichiers au maximum, 4 Mo chacun.', 'Images or PDF, up to 5 files, 4 MB each.')}</small>
        {items && items.length > 0 && (
          <ul className="pub-files">
            {items.map((it) => (
              <li key={it.key} className="pub-file-item">
                <Paperclip size={14} aria-hidden="true" />
                <span className="pub-file-name">{it.name}</span>
                {it.status === 'uploading' && <progress value={it.progress} max={100} aria-label={`${it.name}: ${it.progress}%`} />}
                {it.status === 'done' && (
                  <span className="pub-ok">
                    <CheckCircle2 size={14} aria-hidden="true" /> {t('Téléversé', 'Uploaded')}
                  </span>
                )}
                {it.status === 'error' && <span className="pub-err-inline">{it.error}</span>}
                <button type="button" className="pub-icon-btn" onClick={() => onRemove(it.key)} aria-label={t(`Retirer ${it.name}`, `Remove ${it.name}`)}>
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {err}
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div className="pub-field" data-invalid={invalid}>
        <label className="pub-label" htmlFor={id}>
          {label}
          {req}
        </label>
        {help}
        <select id={id} className="pub-input" value={str} onChange={(e) => onText(e.target.value)} required={field.required} aria-required={field.required || undefined} aria-invalid={invalid} aria-describedby={describedBy}>
          <option value="">{t('Choisir…', 'Choose…')}</option>
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {t(o.label)}
            </option>
          ))}
        </select>
        {err}
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div className="pub-field" data-invalid={invalid}>
        <label className="pub-label" htmlFor={id}>
          {label}
          {req}
        </label>
        {help}
        <textarea id={id} className="pub-input" rows={4} value={str} onChange={(e) => onText(e.target.value)} aria-required={field.required || undefined} aria-invalid={invalid} aria-describedby={describedBy} />
        {err}
      </div>
    );
  }

  const isNumber = field.type === 'number';
  return (
    <div className="pub-field" data-invalid={invalid}>
      <label className="pub-label" htmlFor={id}>
        {label}
        {req}
      </label>
      {help}
      <input
        id={id}
        className="pub-input"
        type={isNumber ? 'number' : 'text'}
        inputMode={isNumber ? 'decimal' : undefined}
        step={isNumber ? 'any' : undefined}
        value={str}
        onChange={(e) => onText(e.target.value)}
        autoComplete={field.maps === 'email' ? 'email' : field.maps === 'phone' ? 'tel' : field.maps === 'contact' ? 'name' : undefined}
        aria-required={field.required || undefined}
        aria-invalid={invalid}
        aria-describedby={describedBy}
      />
      {err}
    </div>
  );
}
