import { hasPermission } from '@/auth/permissions';
import { useI18n } from '@/i18n';
import { modules } from '@/modules/registry';

/**
 * The per-module permission checkboxes, shared by the groups editor and the per-user rights editor.
 * `inherited` = what the person already gets from elsewhere (their groups): shown ticked and locked.
 */
export function PermissionMatrix({
  perms,
  onChange,
  disabled = false,
  inherited,
}: {
  perms: Set<string>;
  onChange: (next: Set<string>) => void;
  /** Everything ticked and locked (super administrator). */
  disabled?: boolean;
  inherited?: Set<string>;
}) {
  const { t } = useI18n();

  const toggle = (key: string) => {
    const n = new Set(perms);
    if (n.has(key)) n.delete(key);
    else n.add(key);
    onChange(n);
  };
  const toggleModule = (modId: string, keys: string[]) => {
    const n = new Set(perms);
    const wild = `${modId}.*`;
    if (n.has(wild)) n.delete(wild);
    else {
      keys.forEach((k) => n.delete(k));
      n.add(wild);
    }
    onChange(n);
  };
  const via = (key: string) => !!inherited && hasPermission(inherited, key);

  return (
    <div className={`perm-matrix ${disabled ? 'disabled' : ''}`}>
      {modules.map((m) => {
        const wild = perms.has(`${m.id}.*`);
        const wildInherited = via(`${m.id}.*`);
        const Icon = m.icon;
        return (
          <div key={m.id} className="perm-module" style={{ ['--accent' as string]: m.accent }}>
            <div className="perm-module-head">
              <span className="perm-module-icon">
                <Icon size={16} />
              </span>
              <strong>{t(m.name)}</strong>
              <span className="spacer" />
              <label className="check small">
                <input
                  type="checkbox"
                  checked={disabled || wild || wildInherited}
                  disabled={disabled || wildInherited}
                  onChange={() => toggleModule(m.id, m.permissions.map((p) => p.key))}
                />
                {wildInherited ? t('Tout le module (via un groupe)', 'Entire module (via a group)') : t('Tout le module', 'Entire module')}
              </label>
            </div>
            <div className="perm-list">
              {m.permissions.map((p) => {
                const fromGroup = via(p.key);
                return (
                  <label key={p.key} className="check perm-item">
                    <input type="checkbox" checked={disabled || wild || fromGroup || perms.has(p.key)} disabled={disabled || wild || fromGroup} onChange={() => toggle(p.key)} />
                    <div>
                      <div>
                        {t(p.label)}
                        {fromGroup && <span className="faint small"> · {t('via un groupe', 'via a group')}</span>}
                      </div>
                      <div className="mono faint" style={{ fontSize: 11 }}>
                        {p.key}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
