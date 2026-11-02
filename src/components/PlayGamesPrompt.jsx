import { useState } from 'react';
import { signInAndSync } from '../game/cloudSave.js';
import { markPlayGamesPromptAnswered } from '../game/playGamesPrompt.js';
import PlayGamesLogo from './PlayGamesLogo.jsx';

// One-time offer on the title screen to connect Google Play Games (Android
// only, see playGamesPrompt.js). Either answer is final for this device; the
// Settings button stays available for anyone who changes their mind.
export default function PlayGamesPrompt({ onDone }) {
    const [state, setState] = useState('ask'); // 'ask' | 'connecting' | 'failed'

    async function handleConnect() {
        markPlayGamesPromptAnswered();
        setState('connecting');
        // Reloads the game by itself if the cloud had progress to bring in
        if (await signInAndSync()) onDone();
        else setState('failed');
    }

    function handleNotNow() {
        markPlayGamesPromptAnswered();
        onDone();
    }

    // Three rows like the title screen: text above, the Connect button alone in
    // the middle row (so it sits at the screen's vertical center), Not Now below
    return (
        <div className="overlay play-games-prompt">
            <div className="overlay-header">
                <h1 className="fancy-heading">Save your progress?</h1>
                <p>Back up your progress with Google Play Games.</p>
                {state === 'failed' && (
                    <p className="settings-warning">
                        Couldn't connect right now. You can try again any time in Settings.
                    </p>
                )}
            </div>
            <button className="emblem-button play-games-connect" onClick={handleConnect} disabled={state === 'connecting'}>
                <PlayGamesLogo size={34} />
                {state === 'connecting' ? 'Connecting...' : state === 'failed' ? 'Try Again' : 'Connect Play Games'}
            </button>
            <div className="play-games-prompt-footer">
                <button className="grey-button" onClick={handleNotNow} disabled={state === 'connecting'}>
                    {state === 'failed' ? 'Continue' : 'Not Now'}
                </button>
            </div>
        </div>
    );
}
