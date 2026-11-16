import { errorText } from './RockShared';
import { ListTodo } from 'lucide-react';
import { useUserName } from '@/data/hooks';
import { useI18n } from '@/i18n';
import { Empty, Modal, useToast } from '@/components/ui';
import { alignPriorities } from '../stores';
import type { AlignPriority, Rock } from '../schemas';
import { StatusBadge } from './RockShared';

interface Props {
  priorities: AlignPriority[];
  rocks: Rock[];
  canLink: boolean;
  onOpen: (id: string) => void;
  onClose: () => void;
}

/** The quarter's priorities that belong to no Rock; managers can attach one to a Rock from here. */
export function RockUnlinkedModal({ priorities, rocks, canLink, onOpen, onClose }: Props) {
  const { t, fmtDate } = useI18n();
  const toast = useToast();
  const userName = useUserName();

  const link = async (p: AlignPriority, rockId: string) => {
    if (!rockId) return;
    try {
      await alignPriorities.update(p.id, { rockId });
      toast(t('Priorité rattachée', 'Priority linked'));
    } catch (e) {
      toast(errorText(e), 'err');
    }
  };

  return (
    <Modal open onClose={onClose} title={t('Priorités non rattachées', 'Unlinked priorities')} large>
      {!priorities.length ? (
        <Empty icon={<ListTodo size={36} />} title={t('Toutes les priorités du trimestre sont rattachées', 'All priorities of the quarter are linked')} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('Priorité', 'Priority')}</th>
                <th>{t('Responsable', 'Owner')}</th>
                <th>{t('Échéance', 'Due date')}</th>
                <th>{t('Statut', 'Status')}</th>
                {canLink && <th>{t('Rattacher à un Rock', 'Link to a Rock')}</th>}
              </tr>
            </thead>
            <tbody>
              {priorities.map((p) => (
                <tr key={p.id}>
                  <td>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpen(p.id)}>
                      {p.title}
                    </button>
                  </td>
                  <td>{userName(p.ownerId ?? undefined)}</td>
                  <td>{p.dueDate ? fmtDate(p.dueDate) : '—'}</td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  {canLink && (
                    <td>
                      <select className="select" aria-label={t('Rock', 'Rock')} value="" onChange={(e) => link(p, e.target.value)}>
                        <option value="">{t('— Choisir —', '— Choose —')}</option>
                        {rocks.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.title}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
