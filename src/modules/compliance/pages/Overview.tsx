import { Link } from 'react-router-dom';
import { Gauge, AlertOctagon, CalendarClock, Flame, Award, Plus, FileText, ClipboardCheck, ListChecks, BadgeAlert } from 'lucide-react';
import { useCollection } from '@/data/db';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Can, PageHeader } from '@/components/ui';
import { Kpi, KpiGrid } from '@/components/Kpi';
import { audits, frameworks, policyDocs, requirements } from '../stores';
import { CATEGORIES, ScoreRing, isOverdue, score } from '../ui';

export function useComplianceData() {
  const { rows: fws } = useCollection(frameworks);
  const { rows: reqs } = useCollection(requirements);
  const { rows: aus } = useCollection(audits);
  const { rows: docs } = useCollection(policyDocs);
  const active = fws.filter((f) => f.active);
  const activeReqs = reqs.filter((r) => active.some((f) => f.id === r.frameworkId));
  const openFindings = aus.flatMap((a) => a.findings.filter((f) => !f.closed).map((f) => ({ ...f, audit: a })));
  return { fws: active, reqs: activeReqs, aus, docs, openFindings };
}

type Deadline = { key: string; date: string; label: string; kind: 'req' | 'audit' | 'doc' | 'finding'; to: string };

export function useDeadlines(days = 45): Deadline[] {
  const { t } = useI18n();
  const { fws, reqs, aus, docs, openFindings } = useComplianceData();
  const limit = new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
  const code = (id: string) => fws.find((f) => f.id === id)?.code ?? '';
  const list: Deadline[] = [
    ...reqs
      .filter((r) => r.reviewDue && r.status !== 'na')
      .map((r) => ({ key: r.id, date: r.reviewDue!, label: `${code(r.frameworkId)} ${r.ref} — ${r.title}`, kind: 'req' as const, to: `/compliance/frameworks/${r.frameworkId}` })),
    ...aus
      .filter((a) => a.status === 'planned')
      .map((a) => ({ key: a.id, date: a.date, label: `${t('Audit', 'Audit')} : ${a.title}`, kind: 'audit' as const, to: '/compliance/audits' })),
    ...docs
      .filter((d) => d.reviewDue && d.status !== 'obsolete')
      .map((d) => ({ key: d.id, date: d.reviewDue!, label: `${t('Révision', 'Review')} : ${d.title}`, kind: 'doc' as const, to: '/compliance/documents' })),
    ...openFindings
      .filter((f) => f.dueDate)
      .map((f) => ({ key: f.id, date: f.dueDate!, label: `${t('NC', 'NC')} : ${f.title}`, kind: 'finding' as const, to: '/compliance/audits' })),
  ];
  return list.filter((d) => d.date <= limit).sort((a, b) => a.date.localeCompare(b.date));
}

const KIND_ICON = { req: ListChecks, audit: ClipboardCheck, doc: FileText, finding: BadgeAlert };

export function ComplianceKpis() {
  const { t } = useI18n();
  const { reqs, openFindings } = useComplianceData();
  const deadlines = useDeadlines(30);
  const highRisk = reqs.filter((r) => r.risk === 'high' && r.status !== 'verified' && r.status !== 'na').length;
  return (
    <KpiGrid>
      <Kpi to="/compliance/frameworks" label={t('Score global', 'Overall score')} value={`${score(reqs)} %`} icon={<Gauge size={17} />} tone="accent" hint={t(`${reqs.length} exigences suivies`, `${reqs.length} tracked requirements`)} />
      <Kpi to="/compliance/audits" label={t('Non-conformités ouvertes', 'Open non-conformities')} value={openFindings.length} icon={<AlertOctagon size={17} />} tone={openFindings.length ? 'err' : undefined} />
      <Kpi label={t('Risque élevé à traiter', 'High risk to address')} value={highRisk} icon={<Flame size={17} />} tone={highRisk ? 'warn' : undefined} />
      <Kpi label={t('Échéances (30 j)', 'Deadlines (30 d)')} value={deadlines.length} icon={<CalendarClock size={17} />} hint={deadlines.filter((d) => isOverdue(d.date)).length ? t(`${deadlines.filter((d) => isOverdue(d.date)).length} en retard`, `${deadlines.filter((d) => isOverdue(d.date)).length} overdue`) : undefined} />
    </KpiGrid>
  );
}

export function DeadlineList({ limit = 8 }: { limit?: number }) {
  const { t, fmtDate } = useI18n();
  const items = useDeadlines().slice(0, limit);
  if (!items.length) return <div className="widget-empty">{t('Aucune échéance prochaine.', 'No upcoming deadlines.')}</div>;
  return (
    <ul className="widget-list">
      {items.map((d) => {
        const Icon = KIND_ICON[d.kind];
        return (
          <li key={d.kind + d.key}>
            <Icon size={15} className="faint" />
            <Link to={d.to} className="widget-list-main">
              {d.label}
            </Link>
            <span className={`small ${isOverdue(d.date) ? 'badge badge-err' : 'faint'}`}>{fmtDate(d.date)}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function Overview() {
  const { t, fmtDate } = useI18n();
  const { fws, reqs, aus } = useComplianceData();

  return (
    <Page>
      <PageHeader
        eyebrow={t('Conformité', 'Compliance')}
        title={t('Conformité Pubco', 'Pubco compliance')}
        subtitle={t('Qualité, sécurité de l’information, vie privée, environnement et SST — au même endroit.', 'Quality, information security, privacy, environment and H&S — in one place.')}
        actions={
          <Can permission="compliance.frameworks">
            <Link to="/compliance/frameworks?new=1" className="btn btn-primary">
              <Plus size={16} /> {t('Référentiel', 'Framework')}
            </Link>
          </Can>
        }
      />
      <ComplianceKpis />

      <div className="fw-grid">
        {fws.map((f) => {
          const r = reqs.filter((x) => x.frameworkId === f.id);
          const nextAudit = aus.filter((a) => a.frameworkId === f.id && a.status === 'planned').sort((a, b) => a.date.localeCompare(b.date))[0];
          const counts = (['todo', 'progress', 'implemented', 'verified'] as const).map((s) => r.filter((x) => x.status === s).length);
          return (
            <Link key={f.id} to={`/compliance/frameworks/${f.id}`} className="fw-card card" style={{ ['--fw' as string]: f.color }}>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="fw-code">{f.code}</div>
                  <strong className="fw-name">{f.name}</strong>
                  <div className="faint small">{t(CATEGORIES[f.category])}</div>
                </div>
                <span className="spacer" />
                <ScoreRing value={score(r)} color={f.color} />
              </div>
              <div className="fw-bar" title={`${counts.join(' / ')}`}>
                {counts.map((c, i) => (
                  <span key={i} className={`seg seg-${i}`} style={{ flex: c }} />
                ))}
              </div>
              <div className="row small faint" style={{ justifyContent: 'space-between' }}>
                <span>
                  {r.length} {t('exigences', 'requirements')}
                </span>
                {f.certified ? (
                  <span className="row" style={{ gap: 4, color: 'var(--ok)' }}>
                    <Award size={13} /> {t('Certifié', 'Certified')}
                  </span>
                ) : nextAudit ? (
                  <span>
                    {t('Audit', 'Audit')} {fmtDate(nextAudit.date)}
                  </span>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-head">
          <h3>{t('Échéances à venir (45 jours)', 'Upcoming deadlines (45 days)')}</h3>
        </div>
        <div className="card-pad">
          <DeadlineList limit={12} />
        </div>
      </div>
    </Page>
  );
}
