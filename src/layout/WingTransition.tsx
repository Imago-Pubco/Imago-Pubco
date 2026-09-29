import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Butterfly } from '@/components/Butterfly';

/**
 * "Metamorphosis" transition played when the user switches module:
 * two wings in the destination module's colour close over the workspace,
 * the butterfly pulses in the centre, then the wings open onto the new module.
 */
export function WingTransition({ moduleKey, color }: { moduleKey: string; color: string }) {
  const reduce = useReducedMotion();
  const [run, setRun] = useState<{ key: number; color: string } | null>(null);
  const prev = useRef(moduleKey);

  useEffect(() => {
    if (prev.current === moduleKey) return;
    prev.current = moduleKey;
    if (reduce) return;
    setRun({ key: Date.now(), color });
    const tm = setTimeout(() => setRun(null), 1000);
    return () => clearTimeout(tm);
  }, [moduleKey, color, reduce]);

  const ease = [0.7, 0, 0.2, 1] as const;
  const times = [0, 0.36, 0.56, 1];

  return (
    <AnimatePresence>
      {run && (
        <motion.div key={run.key} className="wing-overlay" style={{ ['--wing' as string]: run.color }} exit={{ opacity: 0 }}>
          <motion.div
            className="wing-panel wing-left"
            initial={{ x: '-101%', rotate: -6 }}
            animate={{ x: ['-101%', '0%', '0%', '-101%'], rotate: [-6, 0, 0, -6] }}
            transition={{ duration: 0.95, times, ease }}
          />
          <motion.div
            className="wing-panel wing-right"
            initial={{ x: '101%', rotate: 6 }}
            animate={{ x: ['101%', '0%', '0%', '101%'], rotate: [6, 0, 0, 6] }}
            transition={{ duration: 0.95, times, ease }}
          />
          <motion.div
            className="wing-center"
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: [0.3, 1, 1.12, 0.6], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 0.95, times: [0, 0.4, 0.55, 0.8] }}
          >
            <Butterfly size={72} color="#fff" flutter />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
