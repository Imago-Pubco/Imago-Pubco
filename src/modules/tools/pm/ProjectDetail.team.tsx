import { useMemo } from 'react';
import { useI18n } from '@/i18n';
import { counted, fmtHours, pct, sum } from './lib';
import type { PmTask, Project, TimeEntry } from './schemas';
import { Person, ProgressBar } from './ProjectDetail.ui';

/** Members of the project (manager first) with the hours each one booked and their share of the total. */
export function TeamTab({ project, entries, tasks, nameOf }: { project: Project; entries: TimeEntry[]; tasks: PmTask[]; nameOf: (id?: string) => string }) {
  const { t } = useI18n();

  // Manager first, then members, then anyone who booked time without being a member.
  const ids = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const id of [project.managerId, ...project.memberIds, ...entries.map((e) => e.userId)]) {
      if (id && !seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
    return out;
  }, [project.managerId, project.memberIds, entries]);

  const counts = entries.filter(counted);
  const total = sum(counts.map((e) => e.hours));

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>{t('Personne', 'Person')}</th>
            <th>{t('Rôle', 'Role')}</th>
            <th className="num">{t('Tâches assignées', 'Assigned tasks')}</th>
            <th className="num">{t('Heures', 'Hours')}</th>
            <th className="num">{t('Dont facturables', 'Billable')}</th>
            <th style={{ minWidth: 160 }}>{t('Part du temps', 'Share of time')}</th>
          </tr>
        </thead>
        <tbody>
          {ids.map((id) => {
            const mine = counts.filter((e) => e.userId === id);
            const hours = sum(mine.map((e) => e.hours));
            const billable = sum(mine.filter((e) => e.billable).map((e) => e.hours));
            const share = total > 0 ? (hours / total) * 100 : null;
            const role = id === project.managerId ? t('Responsable', 'Manager') : project.memberIds.includes(id) ? t('Membre', 'Member') : t('Hors équipe', 'Not a member');
            const assigned = tasks.filter((x) => x.assigneeIds.includes(id)).length;
            return (
              <tr key={id}>
                <td>
                  <Person name={nameOf(id)} />
                </td>
                <td className="small">{role}</td>
                <td className="num">{assigned}</td>
                <td className="num" style={{ whiteSpace: 'nowrap' }}>
                  {fmtHours(hours)}
                </td>
                <td className="num" style={{ whiteSpace: 'nowrap' }}>
                  {fmtHours(billable)}
                </td>
                <td>
                  {share === null ? (
                    <span className="faint small">—</span>
                  ) : (
                    <div className="stack" style={{ gap: 4 }}>
                      <ProgressBar value={share} color="var(--accent)" />
                      <span className="small muted">{pct(share)}</span>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 600 }}>
            <td colSpan={3}>{t('Total', 'Total')}</td>
            <td className="num">{fmtHours(total)}</td>
            <td className="num">{fmtHours(sum(counts.filter((e) => e.billable).map((e) => e.hours)))}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
