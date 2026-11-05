import '../../css/app.css';
import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import App from './app';

// Bootstrap only (no components here) so Fast Refresh never re-runs createRoot.
const el = document.getElementById('learner-root')! as HTMLElement & { _root?: Root };
el._root ??= createRoot(el);
el._root.render(<StrictMode><App /></StrictMode>);
