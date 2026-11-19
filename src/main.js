import { mount } from 'svelte';
// The faces ship with the app: no request to a font service, and they are there offline.
import '@fontsource-variable/instrument-sans/wdth.css';
import '@fontsource-variable/doto/wght.css';
import '@fontsource/space-mono/latin-700.css';
import './styles/theme.css';
import './styles/shell.css';
import './styles/stage.css';
import './styles/band.css';
import App from './App.svelte';

export default mount(App, { target: document.getElementById('root') });

// Installable and usable offline once deployed (the worker is only written by the build).
if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
