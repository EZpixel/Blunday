import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { migrateLegacySaveData } from './game/storage.js';
import { initCloudSave } from './game/cloudSave.js';

// Cloud progress is merged into localStorage first, so the game modules
// (imported through App) read the merged save when they load
async function start() {
    migrateLegacySaveData();
    await initCloudSave();
    const { default: App } = await import('./components/App.jsx');
    createRoot(document.getElementById('root')).render(
        <StrictMode>
            <App />
        </StrictMode>
    );
}

start();
