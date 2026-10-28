import { mount } from 'svelte';
// Public Sans ships with the app: no request to a font service, and it is there offline.
import '@fontsource/public-sans/latin-400.css';
import '@fontsource/public-sans/latin-500.css';
import '@fontsource/public-sans/latin-600.css';
import '@fontsource/public-sans/latin-700.css';
import './app.css';
import App from './App.svelte';

export default mount(App, { target: document.getElementById('root') });

// Installable and usable offline once deployed (the worker is only written by the build).
if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
