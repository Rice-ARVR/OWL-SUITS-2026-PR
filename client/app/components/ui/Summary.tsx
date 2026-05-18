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
    showReflection?: boolean;
    warnings?: Warning[];
}

const imgVector = "https://www.figma.com/api/mcp/asset/ffb45169-31ac-4c37-9ce5-ef097f9a568b";

export default function Summary({
    image = "/rover.png",
    label = "Pressurized Rover",
    showReflection = true,
    warnings = [],
}: SummaryProps) {
    const time = useCSTClock();
    const hasWarnings = warnings.length > 0;
    const statusText = hasWarnings ? `${warnings.length} warnings` : "Everything normal";
    const statusColor = hasWarnings ? "#F59095" : "#c5c9d2";

    return (
        <div
            style={{
                background: hasWarnings
                    ? "linear-gradient(to bottom, #493E3E, #3a3a41)"
                    : "#3a3a41",
                borderRadius: 12,
                width: "100%",
                height: "100%",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
            }}
        >
            {/* Images positioned absolutely */}
            <div
                style={
                    hasWarnings
                        ? {
                              position: "absolute",
                              right: 6,
                              bottom: 6,
                              width: 110,
                              height: 92,
                              pointerEvents: "none",
                          }
                        : {
                              position: "absolute",
                              left: "50%",
                              top: 83,
                              width: 272,
                              height: 226,
                              transform: "translateX(-50%)",
                              pointerEvents: "none",
                          }
                }
            >
                <img
                    src={image}
                    alt="Rover"
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        alignContent: "center",
                    }}
                />
            </div>
            {showReflection && (
                <div
                    style={{
                        position: "absolute",
                        left: "50%",
                        top: 83 + 18.73,
                        width: 263,
                        height: 184,
                        transform: "translateX(-50%) scaleY(-1)",
                        pointerEvents: "none",
                    }}
                >
                    <img
                        src={imgVector}
                        alt=""
                        style={{
                            width: "100%",
                            height: "100%",
                        }}
                    />
                </div>
            )}

            {/* Warnings centered absolutely */}
            <div
                style={{
                    position: "absolute",
                    left: "50%",
                    top: 50,
                    transform: "translateX(-50%)",
                    width: 260,
                    zIndex: 1,
                }}
            >
                <Warnings warnings={warnings} />
            </div>

            {/* Text content */}
            <div
                style={{
                    position: "relative",
                    width: 274,
                    height: 364,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
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
                    }}
                >
                    {time}
                </p>
                <div
                    style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "flex-end",
                        width: "100%",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            flex: 1,
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
                </div>
            </div>
        </div>
    );
}
