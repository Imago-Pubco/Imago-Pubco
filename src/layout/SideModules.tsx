import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { NavLink } from 'react-router-dom';
import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion';
import { ChevronDown, GripVertical } from 'lucide-react';
import { useI18n } from '@/i18n';
import type { ModuleDef } from '@/modules/types';

interface Props {
  modules: ModuleDef[];
  currentId?: string;
  collapsed: boolean;
  isOpen: (id: string) => boolean;
  setOpen: (id: string, open: boolean) => void;
  onModuleClick: (e: MouseEvent, m: ModuleDef) => void;
  can: (p: string) => boolean;
  /** Called once a drag ends with the new module order. */
  onReorder: (ids: string[]) => void;
}

const subPath = (m: ModuleDef, path: string) => `${m.path}${path ? '/' + path : ''}`;

/** Sidebar module list — each user can drag modules (by the grip) into their preferred order. */
export function SideModules({ modules, currentId, collapsed, isOpen, setOpen, onModuleClick, can, onReorder }: Props) {
  const incoming = modules.map((m) => m.id).join();
  const [order, setOrder] = useState(() => modules.map((m) => m.id));
  useEffect(() => setOrder(modules.map((m) => m.id)), [incoming]); // eslint-disable-line react-hooks/exhaustive-deps

  // Latest order for the drag-end callback (state updates during the drag).
  const orderRef = useRef(order);
  orderRef.current = order;

  const byId = new Map(modules.map((m) => [m.id, m]));
  return (
    <Reorder.Group axis="y" values={order} onReorder={setOrder} className="side-modules" as="div">
      {order.map((id) => {
        const m = byId.get(id);
        return m ? (
          <SideModule
            key={id}
            m={m}
            active={currentId === id}
            open={isOpen(id) && !collapsed}
            collapsed={collapsed}
            onToggle={() => setOpen(id, !isOpen(id))}
            onModuleClick={onModuleClick}
            can={can}
            onDragEnd={() => onReorder(orderRef.current)}
          />
        ) : null;
      })}
    </Reorder.Group>
  );
}

function SideModule({
  m, active, open, collapsed, onToggle, onModuleClick, can, onDragEnd,
}: {
  m: ModuleDef;
  active: boolean;
  open: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onModuleClick: (e: MouseEvent, m: ModuleDef) => void;
  can: (p: string) => boolean;
  onDragEnd: () => void;
}) {
  const { t } = useI18n();
  const controls = useDragControls();
  const Icon = m.icon;
  return (
    <Reorder.Item
      value={m.id}
      as="div"
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      className={`side-module ${open ? 'open' : ''}`}
      style={{ ['--m' as string]: m.accent }}
      whileDrag={{ scale: 1.03, zIndex: 5, boxShadow: '0 10px 30px rgba(0,0,0,.45)' }}
    >
      <div className="side-row">
        {!collapsed && (
          <span
            className="side-grip"
            onPointerDown={(e) => {
              e.preventDefault();
              controls.start(e);
            }}
            title={t('Glisser pour réordonner', 'Drag to reorder')}
            aria-hidden="true"
          >
            <GripVertical size={14} />
          </span>
        )}
        <NavLink to={m.path} className={`side-link ${active ? 'active' : ''}`} title={t(m.name)} onClick={(e) => onModuleClick(e, m)} draggable={false}>
          <span className="side-icon">
            <Icon size={18} />
          </span>
          <span className="side-text">{t(m.name)}</span>
        </NavLink>
        {!collapsed && (
          <button className="side-toggle" onClick={onToggle} aria-expanded={open} aria-label={open ? t('Fermer le menu', 'Close menu') : t('Ouvrir le menu', 'Open menu')}>
            <ChevronDown size={15} />
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="side-sub"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
          >
            {m.nav
              .filter((n) => !n.permission || can(n.permission))
              .map((n) => {
                const SubIcon = n.icon;
                return (
                  <NavLink key={n.path} to={subPath(m, n.path)} end={!n.path || n.path === 'new'} className="side-sublink" draggable={false}>
                    <SubIcon size={15} />
                    {t(n.label)}
                  </NavLink>
                );
              })}
          </motion.div>
        )}
      </AnimatePresence>
    </Reorder.Item>
  );
}
