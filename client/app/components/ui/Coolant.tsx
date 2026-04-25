import typo from "~/components/ui/typography.module.css";

interface CoolantProps {
    storage: number | null;
    pressure: number | null;
    pressureUnit?: string;
    storageWarning?: boolean;
    pressureWarning?: boolean;
}

export default function Coolant({
    storage,
    pressure,
    pressureUnit = "psi",
    storageWarning,
    pressureWarning,
}: CoolantProps) {
    const pressureStatus = pressureWarning ? "Unsafe" : "Safe";
    const pressureStatusColor = pressureWarning ? "#F59095" : "#9DE4CE";
    const storagePct = Math.min(100, Math.max(0, storage ?? 0));
    const isLow = storageWarning === true;
    const fillColor = isLow ? "#A27077" : "#97A09C";

    return (
        <div
            style={{
                background: "#2E2E32",
                borderRadius: 12,
                padding: "16px 12px",
                width: "100%",
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 24,
                alignSelf: "flex-start",
            }}
        >
            {/* Left: storage */}
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    minWidth: 140,
                }}
            >
                <span className={typo.p} style={{ color: "#C5C9D2" }}>
                    Coolant Storage
                </span>
                <span className={typo.h5} style={{ color: "#F4F4F4", lineHeight: 1 }}>
                    {storage !== null ? `${storagePct.toFixed(0)}%` : "--"}
                    <span className={typo.h5} style={{ color: "#F4F4F4", marginLeft: 4 }}>
                        full
                    </span>
                </span>
                {/* Percentage bar */}
                <div
                    style={{
                        width: "100%",
                        height: 6,
                        background: "#3a3a41",
                        borderRadius: 99,
                        overflow: "hidden",
                    }}
                >
                    <div
                        style={{
                            width: `${storagePct}%`,
                            height: "100%",
                            background: fillColor,
                            borderRadius: 99,
                            transition: "width 0.4s ease",
                        }}
                    />
                </div>
            </div>

            {/* Right: pressure */}
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                }}
            >
                <span className={typo.p} style={{ color: pressureStatusColor }}>
                    {pressureStatus}
                </span>
                <span className={typo.p} style={{ color: "#C5C9D2" }}>
                    Coolant Pressure
                </span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span className={typo.p} style={{ color: "#A1A4AF", lineHeight: 1 }}>
                        {pressure !== null ? pressure.toFixed(0) : "--"}
                    </span>
                    <span className={typo.p} style={{ color: "#A1A4AF" }}>
                        {pressureUnit}
                    </span>
                </div>
            </div>
        </div>
    );
}
