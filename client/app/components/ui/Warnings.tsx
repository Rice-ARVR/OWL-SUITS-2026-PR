export interface Warning {
    message: string;
}

interface WarningsProps {
    warnings: Warning[];
}

export default function Warnings({ warnings }: WarningsProps) {
    if (warnings.length === 0) return null;
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
            {warnings.map((w, i) => (
                <div
                    key={i}
                    style={{
                        background: "#2e2b2b",
                        borderRadius: 8,
                        padding: "8px 12px",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                    }}
                >
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="none"
                        style={{ flexShrink: 0 }}
                    >
                        <circle cx="8" cy="8" r="6.5" stroke="#F59095" strokeWidth="1.5" />
                        <path d="M8 5v4" stroke="#F59095" strokeWidth="1.5" strokeLinecap="round" />
                        <circle cx="8" cy="11" r="0.75" fill="#F59095" />
                    </svg>
                    <span
                        style={{
                            fontFamily: '"Be Vietnam Pro", sans-serif',
                            fontSize: 13,
                            color: "#F59095",
                            fontWeight: 400,
                        }}
                    >
                        {w.message}
                    </span>
                </div>
            ))}
        </div>
    );
}
