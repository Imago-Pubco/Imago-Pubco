import { useMemo } from 'react';
import { cleanRich, isRichHtml } from './sanitize';
import './richtext.css';

/** Shows stored rich text (cleaned again here); older plain text is shown as is, line breaks kept. */
export function RichText({ html, className = '' }: { html: string; className?: string }) {
  const rich = isRichHtml(html);
  const clean = useMemo(() => (rich ? cleanRich(html) : ''), [html, rich]);
  if (!rich) return <div className={`rt-view ${className}`} style={{ whiteSpace: 'pre-line' }}>{html}</div>;
  return <div className={`rt-view rt-content ${className}`} dangerouslySetInnerHTML={{ __html: clean }} />;
}
