import { version } from '../../package.json';
import BackButton from './BackButton.jsx';

const GITHUB_URL     = 'https://github.com/Elijuszek';
const BUSINESS_EMAIL = 'ezpixelinteractive@gmail.com';
const PRIVACY_URL    = 'https://ezpixel.github.io/Blunday/privacy.html';

function ExternalLink({ href, children }) {
    return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

// Classic end-of-movie roll: the credits scroll up from the bottom and come to
// rest on screen, so the links can be tapped once they've settled.
export default function CreditsView({ onBack }) {
    return (
        <div className="overlay list-overlay credits-overlay">
            <div className="credits-roll">
                <h1 className="fancy-heading credits-heading">Blunday</h1>
                <p className="credits-tagline">Get Rich or Fall Trying</p>

                <section className="credits-block">
                    <h2>A game by</h2>
                    <p className="credits-name">EzPixel</p>
                    <p>Design, code, art direction and every last bounce — a one-person indie studio.</p>
                </section>

                <section className="credits-block">
                    <h2>Find me</h2>
                    <p><ExternalLink href={GITHUB_URL}>github.com/Elijuszek</ExternalLink></p>
                    <p className="credits-small">Business inquiries</p>
                    <p><a href={`mailto:${BUSINESS_EMAIL}`}>{BUSINESS_EMAIL}</a></p>
                </section>

                <section className="credits-block">
                    <h2>Special thanks</h2>
                    <p>The Datura group, for fearless playtesting</p>
                    <p>My girlfriend, my favorite tester 💙</p>
                </section>

                <p className="credits-thanks">Thanks for playing!</p>
                <p className="credits-small">
                    v{version} · <ExternalLink href={PRIVACY_URL}>Privacy Policy</ExternalLink>
                </p>
            </div>
            <BackButton onClick={onBack} />
        </div>
    );
}
