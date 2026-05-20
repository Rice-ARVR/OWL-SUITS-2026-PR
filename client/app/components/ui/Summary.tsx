import { useEffect, useState } from "react";

import type { Warning } from "~/types/warning";
import Warnings from "~/components/ui/Warnings";

function useCSTClock() {
    const [time, setTime] = useState("");
    useEffect(() => {
        const tick = () =>
            setTime(
                new Date().toLocaleTimeString("en-US", {
                    timeZone: "America/Chicago",
                    hour12: false,
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                }) + " CST",
            );
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);
    return time;
}

interface SummaryProps {
    image?: string;
    label?: string;
    warnings?: Warning[];
    showReflection?: boolean;
}

export default function Summary({
    image = "/rover.png",
    label = "Pressurized Rover",
    warnings = [],
}: SummaryProps) {
    const time = useCSTClock();
    const hasWarnings = warnings.length > 0;
    const statusText = hasWarnings ? `${warnings.length} warnings` : "Everything normal";
    const statusColor = hasWarnings ? "#F59095" : "#c5c9d2";

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
            }}
        >
            <p
                style={{
                    fontFamily: '"Be Vietnam Pro", sans-serif',
                    fontSize: 16,
                    fontWeight: 400,
                    color: "#c5c9d2",
                    letterSpacing: "0.64px",
                    margin: 0,
                    paddingTop: 20,
                    paddingLeft: 10,
                    marginBottom: 10,
                }}
            >
                {time}
            </p>

            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    justifyContent: "space-between",
                }}
            >
                {hasWarnings ? (
                    <Warnings warnings={warnings} />
                ) : (
                    <div
                        style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <img
                            src={image}
                            alt="Rover"
                            style={{
                                width: 227,
                                height: 188,
                                objectFit: "contain",
                                pointerEvents: "none",
                            }}
                        />
                    </div>
                )}

                <div
                    style={{
                        display: "flex",
                        flexDirection: "row",
                        width: "100%",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                        }}
                    >
                        <p
                            style={{
                                fontFamily: '"Be Vietnam Pro", sans-serif',
                                fontSize: 18,
                                fontWeight: 400,
                                color: "#f1f2f5",
                                letterSpacing: "0.18px",
                                margin: 0,
                                paddingLeft: 10,
                            }}
                        >
                            {label}
                        </p>
                        <p
                            style={{
                                fontFamily: '"Be Vietnam Pro", sans-serif',
                                fontSize: 16,
                                fontWeight: 400,
                                color: statusColor,
                                letterSpacing: "0.64px",
                                margin: 0,
                                paddingLeft: 10,
                            }}
                        >
                            {statusText}
                        </p>
                    </div>
                    {hasWarnings && (
                        <img
                            src={image}
                            alt="Rover"
                            style={{
                                width: 110,
                                height: 92,
                                objectFit: "contain",
                                pointerEvents: "none",
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
