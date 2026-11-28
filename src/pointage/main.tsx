/** Entry of the standalone pages served by the punch server: the tablet kiosk, and the protected face setup page. */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { KioskApp } from '../modules/dev/punch/KioskApp';
import { EnrollApp } from '../modules/dev/punch/EnrollApp';

const isEnroll = window.location.pathname.startsWith('/visage');

createRoot(document.getElementById('root')!).render(<StrictMode>{isEnroll ? <EnrollApp /> : <KioskApp />}</StrictMode>);
