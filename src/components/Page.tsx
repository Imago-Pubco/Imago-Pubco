import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

/** Page container with a soft entrance used for in-module navigation. */
export function Page({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <motion.div
      className="page"
      style={wide ? { maxWidth: 'none' } : undefined}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
