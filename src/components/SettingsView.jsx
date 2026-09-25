import { useState } from 'react';
import { clearSaveData } from '../game/storage.js';

export default function SettingsView({ onBack }) {
    const [confirming, setConfirming] = useState(false);

    return (
        <div className="overlay list-overlay">
            <h1>Settings</h1>
            {confirming ? (
                <>
                    <p className="settings-warning">This will permanently delete your progress. Are you sure?</p>
                    <button onClick={clearSaveData}>Confirm Reset</button>
                    <button onClick={() => setConfirming(false)}>Cancel</button>
                </>
            ) : (
                <button onClick={() => setConfirming(true)}>Reset Progress</button>
            )}
            <button onClick={onBack}>Back</button>
        </div>
    );
}
