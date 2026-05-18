import { useState } from "react";
import type { Warning } from "~/types/warning";

interface WarningsProps {
    warnings: Warning[];
}

function parseReason(reason: string): { label: string; detail: string } {
    const idx = reason.indexOf(" — ");
    if (idx !== -1) {
        return { label: reason.slice(0, idx), detail: reason.slice(idx + 3) };
    }
    return { label: reason || "Unknown warning", detail: "No additional context available." };
}

export default function Warnings({ warnings }: WarningsProps) {
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

    if (warnings.length === 0) return null;

    return (
        <>
            <style>{`
                .warnings-scroll { overflow-y: scroll; }
                .warnings-scroll::-webkit-scrollbar { width: 4px; display: block; }
                .warnings-scroll::-webkit-scrollbar-track { background: #1e1c1c; border-radius: 2px; }
                .warnings-scroll::-webkit-scrollbar-thumb { background: #F59095; border-radius: 2px; }
            `}</style>
            <div
                className="warnings-scroll"
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    width: "100%",
                    maxHeight: 166,
                    overflowY: "scroll",
                    scrollbarWidth: "thin",
                    scrollbarColor: "#F59095 #1e1c1c",
                }}
            >
                {warnings.map((w, actualIndex) => {
                    const { label, detail } = parseReason(w.reason);
                    const isExpanded = expandedIndex === actualIndex;

                    return (
                        <div
                            key={actualIndex}
                            style={{ background: "#2e2b2b", borderRadius: 8, overflow: "hidden", flexShrink: 0 }}
                        >
                            <div
                                style={{
                                    padding: "8px 12px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    cursor: "pointer",
                                    userSelect: "none",
                                }}
                                onClick={() => setExpandedIndex(isExpanded ? null : actualIndex)}
                            >
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 16 16"
                                    fill="none"
                                    style={{ flexShrink: 0 }}
                                >
                                    <circle cx="8" cy="8" r="6.5" stroke="#F59095" strokeWidth="1.5" />
                                    <path
                                        d="M8 5v4"
                                        stroke="#F59095"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                    />
                                    <circle cx="8" cy="11" r="0.75" fill="#F59095" />
                                </svg>
                                <span
                                    style={{
                                        fontFamily: '"Be Vietnam Pro", sans-serif',
                                        fontSize: 13,
                                        color: "#F59095",
                                        fontWeight: 400,
                                        flex: 1,
                                    }}
                                >
                                    {label}
                                </span>
                                <svg
                                    width="10"
                                    height="10"
                                    viewBox="0 0 10 10"
                                    fill="#F59095"
                                    style={{
                                        flexShrink: 0,
                                        transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                                        transition: "transform 0.2s ease",
                                    }}
                                >
                                    <polygon points="2,1 9,5 2,9" />
                                </svg>
                            </div>

                            <div
                                style={{
                                    maxHeight: isExpanded ? 200 : 0,
                                    overflow: "hidden",
                                    transition: "max-height 0.25s ease",
                                }}
                            >
                                <div style={{ padding: "0 12px 10px 34px" }}>
                                    <p
                                        style={{
                                            margin: 0,
                                            fontFamily: '"Be Vietnam Pro", sans-serif',
                                            fontSize: 12,
                                            color: "#F59095",
                                        }}
                                    >
                                        <strong>{Number(w.value).toFixed(2)}</strong>
                                        {w.out_of_range &&
                                            w.min !== null &&
                                            w.max !== null &&
                                            ` (range: ${w.min} – ${w.max})`}
                                        {w.off_nominal &&
                                            w.nominal !== null &&
                                            ` (nominal: ${w.nominal})`}
                                    </p>
                                    <p
                                        style={{
                                            margin: "4px 0 0",
                                            fontFamily: '"Be Vietnam Pro", sans-serif',
                                            fontSize: 12,
                                            color: "#F59095",
                                            fontStyle: "italic",
                                        }}
                                    >
                                        {detail}
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </>
    );
}
