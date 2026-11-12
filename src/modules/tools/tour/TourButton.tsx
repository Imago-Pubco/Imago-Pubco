import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Compass, FileText } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useI18n } from '@/i18n';
import { KpiTour } from './KpiTour';
import { KPI_GUIDE_URL } from './steps';

const KPI_PATH = /^\/tools\/kpi(\/|$)/;

/** Top-bar button that starts the KPI guided tour. Shown only on the KPI pages, to users with tools.kpi.access. */
export function TourButton() {
  const { t } = useI18n();
  const { can } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const visible = can('tools.kpi.access') && KPI_PATH.test(pathname);

  // Leaving the KPI pages ends the tour.
  useEffect(() => {
    if (!visible) setOpen(false);
  }, [visible]);

  if (!visible) return null;
  return (
    <>
      <button type="button" className="btn btn-sm tour-btn" onClick={() => setOpen(true)} title={t('Visite guidée de l’outil KPI', 'KPI tool guided tour')}>
        <Compass size={15} />
        <span className="tour-btn-label">{t('Visite guidée', 'Guided tour')}</span>
      </button>
      <a className="btn btn-sm btn-ghost btn-icon" href={KPI_GUIDE_URL} target="_blank" rel="noreferrer" title={t('Guide de l’outil KPI (PDF)', 'KPI tool guide (PDF)')}>
        <FileText size={15} />
      </a>
      {open && <KpiTour onClose={() => setOpen(false)} />}
    </>
  );
}
