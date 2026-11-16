/** The organisation's logo (Administration → Image de marque), or the Pubco butterfly when none is set. */
import { Butterfly } from '@/components/Butterfly';
import { useBranding } from './BrandingContext';
import { LOGO_FILTER } from './brandingSchema';

export function BrandLogo({ size = 32, flutter }: { size?: number; flutter?: boolean }) {
  const { branding } = useBranding();
  if (branding.logo) {
    return <img src={branding.logo} alt={branding.appName} className="brand-logo" style={{ height: size, maxWidth: size * 3.2, objectFit: 'contain', filter: LOGO_FILTER[branding.logoStyle ?? 'normal'] }} />;
  }
  return <Butterfly size={size} flutter={flutter} />;
}

/** Logo + name + tagline (the sidebar's top). */
export function BrandWordmark({ compact }: { compact?: boolean }) {
  const { branding } = useBranding();
  return (
    <div className="wordmark">
      <BrandLogo size={compact ? 32 : 38} flutter />
      {!compact && (
        <div className="wordmark-text">
          <strong>{branding.appName}</strong>
          {branding.tagline && <span>{branding.tagline}</span>}
        </div>
      )}
    </div>
  );
}
