import { useTrend, TrendArrow } from "~/components/ui/trend";

interface FanStatus {
    label: string;
    rpm: number;
}

interface FansProps {
    caption?: string;
    fans?: FanStatus[];
    fanWarnings?: boolean[];
}

function FanItem({ fan, index }: { fan: FanStatus; index: number }) {
    const direction = useTrend(fan.rpm);
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
                style={{
                    width: 46,
                    height: 46,
                    borderRadius: 5,
                    background: "#3b3a41",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <img
                    src={`/fan${index + 1}.svg`}
                    alt={`${fan.label} icon`}
                    style={{ width: 34, height: 34, display: "block" }}
                />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <p
                style={{
                    margin: 0,
                    fontFamily: '"Be Vietnam Pro", sans-serif',
                    fontSize: 18,
                    fontWeight: 400,
                    lineHeight: "100%",
                    color: "#a1a4af",
                    letterSpacing: "0.18px",
                    whiteSpace: "nowrap",
                }}
            >
                {fan.label}
            </p>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    height: 32,
                    marginTop: 3,
                }}
            >
                <p
                    style={{
                        margin: 0,
                        fontFamily: '"Be Vietnam Pro", sans-serif',
                        fontSize: 18,
                        fontWeight: 400,
                        lineHeight: "100%",
                        color: "#c5c9d2",
                        letterSpacing: "0.18px",
                        whiteSpace: "nowrap",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                    }}
                >
                    <span
                        style={{
                            display: "inline-block",
                            minWidth: 56,
                            textAlign: "left",
                            fontVariantNumeric: "tabular-nums",
                        }}
                    >
                        {fan.rpm}
                    </span>
                    <span style={{ fontSize: 16, letterSpacing: "0.64px" }}>rpm</span>
                </p>
                <TrendArrow direction={direction === "stable" ? "up" : direction} />
            </div>
            </div>
        </div>
    );
}

export default function Fans({
    caption = "fan operation",
    fans = [
        { label: "Fan 1", rpm: 3000 },
        { label: "Fan 2", rpm: 3000 },
    ],
    fanWarnings,
}: FansProps) {
    const allSafe = fanWarnings ? fanWarnings.every((w) => !w) : true;
    const mode = allSafe ? "Normal" : "Failure";
    const modeColor = allSafe ? "#9DE4CE" : "#F59095";

    return (
        <div
            style={{
                background: "#2e2e32",
                borderRadius: 12,
                display: "flex",
                flexDirection: "column",
                gap: 9,
                alignItems: "flex-start",
                width: "100%",
                padding: "12px 20px",
            }}
        >
                <p
                    style={{
                        fontFamily: '"Be Vietnam Pro", sans-serif',
                        fontSize: 16,
                        fontWeight: 400,
                        lineHeight: "100%",
                        color: "#c5c9d2",
                        letterSpacing: "0.64px",
                        margin: 0,
                    }}
                >
                    <span style={{ color: modeColor }}>{mode}</span>
                    <span>{` ${caption}`}</span>
                </p>

                <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
                    {fans.map((fan, index) => (
                        <FanItem key={fan.label} fan={fan} index={index} />
                    ))}
                </div>
        </div>
    );
}
