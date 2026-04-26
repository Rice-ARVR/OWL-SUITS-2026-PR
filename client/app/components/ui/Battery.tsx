import typo from "~/components/ui/typography.module.css";

interface BatteryProps {
    level: number; // 0–100
    label?: string;
    showIcon?: boolean;
    remaining?: string;
}

const BatteryIcon = () => (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
        <rect x="2" y="7" width="18" height="13" rx="2" ry="2" />
        <line x1="22" y1="11" x2="22" y2="17" />
    </svg>
);

export default function Battery({
    level,
    label = "PR Battery",
    showIcon = true,
    remaining = "8:00:00 Remaining",
}: BatteryProps) {
    const clamped = Math.min(100, Math.max(0, level));
    const fillHeight = Math.max(0, clamped * 2.3);
    const isLow = clamped < 50;
    const fillColor = isLow ? "162, 112, 119" : "195, 210, 206";
    // Cap subtracts text height (~32px) + gap (4px) so the text top never exceeds the 80% fill mark
    const textBottom = Math.max(0, Math.min(fillHeight, 80 * 2.3 - 36));

    return (
        <div
            style={{
                background: "#3a3a41",
                borderRadius: "12px",
                padding: "4px 0 16px",
                width: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "16px",
            }}
        >
            {/* Battery visualization */}
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                    alignItems: "center",
                    width: "100%",
                }}
            >
                <div
                    style={{
                        width: "110px",
                        height: "210px",
                        background: "#2e2e32",
                        borderRadius: "20px",
                        padding: "50px 0 0 0",
                        position: "relative",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        overflow: "hidden",
                    }}
                >
                    {/* Battery percentage display — floats above the fill line */}
                    <div
                        style={{
                            position: "absolute",
                            bottom: textBottom,
                            left: 0,
                            right: 0,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            transform: "translateY(-4px)",
                            zIndex: 10,
                        }}
                    >
                        <span
                            className={typo.h3}
                            style={{
                                color: isLow ? "#F59095" : "rgba(232, 235, 242, 0.78)",
                                textShadow: "0 4px 4px rgba(0, 0, 0, 0.25)",
                            }}
                        >
                            {clamped.toFixed(0)}%
                        </span>
                    </div>

                    {/* 20% interval lines */}
                    {[20, 40, 60, 80].map((pct) => (
                        <div
                            key={pct}
                            style={{
                                position: "absolute",
                                bottom: pct * 2.3,
                                left: 0,
                                right: "55%",
                                height: 3,
                                borderRadius: 2,
                                background: "rgba(255,255,255,0.25)",
                                zIndex: 5,
                            }}
                        />
                    ))}

                    {/* Battery fill gradient */}
                    <div
                        style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: fillHeight,
                            background: `linear-gradient(to bottom, rgba(${fillColor}, 0.58), rgba(${fillColor}, 0.35))`,
                            borderRadius: "0 0 20px 20px",
                            transition: "height 0.4s ease",
                        }}
                    />
                </div>

                {/* Battery label and status */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        alignItems: "center",
                        width: "100%",
                    }}
                >
                    {/* Label with icon */}
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        {showIcon && <BatteryIcon />}
                        <span className={typo.h5} style={{ color: "#F4F4F4" }}>
                            {label}
                        </span>
                        {isLow && (
                            <span className={typo.h5} style={{ color: "#F59095" }}>
                                Critical
                            </span>
                        )}
                    </div>
                </div>

                {remaining && (
                    <div
                        style={{
                            background: isLow ? "#4c424a" : "#333734",
                            borderRadius: 8,
                            padding: "5px 10px",
                        }}
                    >
                        <span
                            style={{
                                fontFamily: '"Be Vietnam Pro", sans-serif',
                                fontSize: 18,
                                color: isLow ? "#F59095" : "#9de4ce",
                                letterSpacing: "0.18px",
                            }}
                        >
                            {remaining}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
