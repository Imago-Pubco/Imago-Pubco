import { useEffect, useState } from 'react';
import { API_MODE, api } from '@/data/db';
import { useI18n } from '@/i18n';

interface Limit {
  maxTokens?: number;
  maxCalls?: number;
}
/** GET /ai/me */
interface AiMe {
  month: string;
  calls: number;
  tokens: number;
  limit: Limit;
  org: { calls: number; tokens: number; limit: Limit };
}

/** The signed-in user's AI usage this month, e.g. "IA : 12 400 / 50 000 jetons ce mois". Hidden without a server or without limits. */
export function AiUsageChip() {
  const { t, fmtNum } = useI18n();
  const [me, setMe] = useState<AiMe | null>(null);

  useEffect(() => {
    if (!API_MODE) return;
    let alive = true;
    api<AiMe>('/ai/me').then(
      (r) => alive && setMe(r),
      () => alive && setMe(null),
    );
    return () => {
      alive = false;
    };
  }, []);

  if (!me) return null;
  const { limit, org } = me;
  const hasLimit = !!(limit.maxTokens || limit.maxCalls || org.limit.maxTokens || org.limit.maxCalls);
  if (!hasLimit) return null;

  const tokens = fmtNum(me.tokens);
  const text = limit.maxTokens
    ? t(`IA : ${tokens} / ${fmtNum(limit.maxTokens)} jetons ce mois`, `AI: ${tokens} / ${fmtNum(limit.maxTokens)} tokens this month`)
    : t(`IA : ${tokens} jetons ce mois`, `AI: ${tokens} tokens this month`);
  const tip = [
    `${t('Demandes', 'Requests')} : ${fmtNum(me.calls)}${limit.maxCalls ? ` / ${fmtNum(limit.maxCalls)}` : ''}`,
    org.limit.maxTokens
      ? `${t('Organisation', 'Organisation')} : ${fmtNum(org.tokens)} / ${fmtNum(org.limit.maxTokens)} ${t('jetons', 'tokens')}`
      : `${t('Organisation', 'Organisation')} : ${fmtNum(org.tokens)} ${t('jetons', 'tokens')}`,
    t('Quota mensuel des appels IA de ventes et de comptabilité', 'Monthly quota for AI calls in sales and accounting'),
  ].join('\n');

  return (
    <span className="badge badge-accent" title={tip} aria-label={`${text}. ${tip}`}>
      {text}
    </span>
  );
}
