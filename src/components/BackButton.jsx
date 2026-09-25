export default function BackButton({ onClick }) {
    return (
        <button className="back-button" onClick={onClick} aria-label="Back" title="Back">
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                <path
                    d="M12.5 4 L6.5 10 L12.5 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </button>
    );
}
