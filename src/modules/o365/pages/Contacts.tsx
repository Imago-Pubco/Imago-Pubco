import { useMemo, useState } from 'react';
import { Contact, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { logAudit } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, Modal, PageHeader, useToast } from '@/components/ui';
import { o365 } from '../connector';
import type { O365Contact, O365ContactInput, O365Tenant } from '../types';
import { ErrorBox, ReloadButton, WithTenant, errMsg, matches, useTenantData } from '../ui';

export function Contacts() {
  return <WithTenant>{(tenant) => <ContactsFor tenant={tenant} />}</WithTenant>;
}

const EMPTY: O365ContactInput = { displayName: '', email: '', firstName: '', lastName: '', company: '' };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Exchange mail contacts: external addresses that appear in the organisation's address book. */
function ContactsFor({ tenant }: { tenant: O365Tenant }) {
  const { t } = useI18n();
  const { user: me, can } = useAuth();
  const toast = useToast();
  const manage = can('o365.contacts.manage');
  const contacts = useTenantData(tenant.id, o365.listContacts);
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState<O365ContactInput | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [del, setDel] = useState<O365Contact | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const rows = useMemo(
    () =>
      [...(contacts.data ?? [])]
        .filter((c) => matches(q, c.displayName, c.email, c.company))
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [contacts.data, q],
  );

  const save = async () => {
    if (!draft) return;
    const input = {
      ...draft,
      email: draft.email.trim(),
      displayName: draft.displayName.trim() || `${draft.firstName} ${draft.lastName}`.trim() || draft.email.trim(),
    };
    setBusy(true);
    setErr('');
    try {
      if (editId) {
        await o365.updateContact(tenant.id, editId, input);
        await logAudit(me!.id, 'o365.contact.update', `${tenant.name}: ${input.displayName} <${input.email}>`);
        toast(t('Contact modifié', 'Contact updated'));
      } else {
        await o365.createContact(tenant.id, input);
        await logAudit(me!.id, 'o365.contact.create', `${tenant.name}: ${input.displayName} <${input.email}>`);
        toast(t('Contact ajouté', 'Contact added'));
      }
      setDraft(null);
      contacts.reload();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!del) return;
    setBusy(true);
    try {
      await o365.deleteContact(tenant.id, del.id);
      await logAudit(me!.id, 'o365.contact.delete', `${tenant.name}: ${del.displayName} <${del.email}>`);
      toast(t('Contact supprimé', 'Contact deleted'));
      setDel(null);
      contacts.reload();
    } catch (e) {
      toast(errMsg(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  const set = <K extends keyof O365ContactInput>(k: K, v: string) => setDraft((d) => d && { ...d, [k]: v });

  const openNew = () => {
    setErr('');
    setEditId(null);
    setDraft({ ...EMPTY });
  };
  const openEdit = (c: O365Contact) => {
    setErr('');
    setEditId(c.id);
    setDraft({ displayName: c.displayName, email: c.email, firstName: c.firstName, lastName: c.lastName, company: c.company });
  };

  return (
    <Page>
      <PageHeader
        eyebrow={tenant.name}
        title={t('Contacts', 'Contacts')}
        subtitle={t('Contacts externes du carnet d’adresses de l’organisation.', 'External contacts in the organisation’s address book.')}
        actions={
          <>
            <ReloadButton onClick={contacts.reload} loading={contacts.loading} />
            {manage && (
              <button className="btn btn-primary" onClick={openNew}>
                <Plus size={16} /> {t('Contact', 'Contact')}
              </button>
            )}
          </>
        }
      />

      <div className="o365-search" style={{ marginBottom: 16 }}>
        <Search size={16} />
        <input className="input" placeholder={t('Rechercher…', 'Search…')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {contacts.error ? (
        <ErrorBox message={contacts.error} onRetry={contacts.reload} />
      ) : (
        <div className="card">
          {rows.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('Nom', 'Name')}</th>
                    <th>{t('Courriel', 'E-mail')}</th>
                    <th>{t('Entreprise', 'Company')}</th>
                    {manage && <th />}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} className={manage ? 'clickable' : ''} onClick={() => manage && openEdit(c)}>
                      <td>
                        <strong>{c.displayName}</strong>
                      </td>
                      <td className="mono small">{c.email}</td>
                      <td className="small">{c.company || <span className="faint">—</span>}</td>
                      {manage && (
                        <td className="num" onClick={(e) => e.stopPropagation()}>
                          <div className="row" style={{ gap: 2, justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost btn-icon btn-sm" title={t('Modifier', 'Edit')} onClick={() => openEdit(c)}>
                              <Pencil size={15} />
                            </button>
                            <button className="btn btn-ghost btn-icon btn-sm" title={t('Supprimer', 'Delete')} onClick={() => setDel(c)}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            !contacts.loading && <Empty icon={<Contact size={36} />} title={t('Aucun contact', 'No contacts')} />
          )}
        </div>
      )}

      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={editId ? t('Modifier le contact', 'Edit contact') : t('Nouveau contact', 'New contact')}
        footer={
          <>
            <button className="btn" onClick={() => setDraft(null)}>
              {t('Annuler', 'Cancel')}
            </button>
            <button className="btn btn-primary" onClick={save} disabled={busy || !draft || !EMAIL.test(draft.email.trim())}>
              {editId ? t('Enregistrer', 'Save') : t('Ajouter', 'Add')}
            </button>
          </>
        }
      >
        {draft && (
          <div className="stack">
            {err && <div className="badge badge-err" style={{ whiteSpace: 'normal' }}>{err}</div>}
            <div className="form-grid">
              <label className="field">
                <span>{t('Prénom', 'First name')}</span>
                <input className="input" value={draft.firstName} onChange={(e) => set('firstName', e.target.value)} autoFocus />
              </label>
              <label className="field">
                <span>{t('Nom', 'Last name')}</span>
                <input className="input" value={draft.lastName} onChange={(e) => set('lastName', e.target.value)} />
              </label>
              <label className="field">
                <span>{t('Nom affiché', 'Display name')}</span>
                <input className="input" value={draft.displayName} placeholder={`${draft.firstName} ${draft.lastName}`.trim()} onChange={(e) => set('displayName', e.target.value)} />
              </label>
              <label className="field">
                <span>{t('Courriel externe', 'External e-mail')}</span>
                <input className="input mono" type="email" value={draft.email} onChange={(e) => set('email', e.target.value)} />
              </label>
              <label className="field">
                <span>{t('Entreprise', 'Company')}</span>
                <input className="input" value={draft.company} onChange={(e) => set('company', e.target.value)} />
              </label>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!del}
        onClose={() => setDel(null)}
        title={t('Supprimer ce contact ?', 'Delete this contact?')}
        footer={
          <>
            <button className="btn" onClick={() => setDel(null)}>
              {t('Annuler', 'Cancel')}
            </button>
            <button className="btn btn-danger" onClick={remove} disabled={busy}>
              {t('Supprimer', 'Delete')}
            </button>
          </>
        }
      >
        <p style={{ margin: 0 }}>
          {del?.displayName} &lt;{del?.email}&gt; {t('sera retiré du carnet d’adresses et des groupes dont il est membre.', 'will be removed from the address book and from any groups it belongs to.')}
        </p>
      </Modal>
    </Page>
  );
}
