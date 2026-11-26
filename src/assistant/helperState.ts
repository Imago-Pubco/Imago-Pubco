/** Whether the floating helper is hidden for this browser ('Masquer l'assistant'). Kept in sync across components. */
import { useEffect, useState } from 'react';

const KEY = 'imago:helper:hidden';
const EVENT = 'imago:helper:hidden-change';

function readHidden(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function useHelperHidden(): [boolean, (hidden: boolean) => void] {
  const [hidden, setHiddenState] = useState(readHidden);
  useEffect(() => {
    const on = () => setHiddenState(readHidden());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  const setHidden = (value: boolean) => {
    try {
      localStorage.setItem(KEY, value ? '1' : '0');
    } catch {
      /* storage unavailable: this session only */
    }
    setHiddenState(value);
    window.dispatchEvent(new Event(EVENT));
  };
  return [hidden, setHidden];
}
