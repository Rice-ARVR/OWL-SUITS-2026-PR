import { useState } from "react";
import type { Warning } from "~/types/warning";
import styles from "./warnings.module.css";

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
        <div className={styles.scroll}>
            {warnings.map((w, actualIndex) => {
                const { label, detail } = parseReason(w.reason);
                const isExpanded = expandedIndex === actualIndex;

                return (
                    <div key={actualIndex} className={styles.item}>
                        <div
                            className={styles.header}
                            onClick={() => setExpandedIndex(isExpanded ? null : actualIndex)}
                        >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={styles.icon}>
                                <circle cx="8" cy="8" r="6.5" stroke="#F59095" strokeWidth="1.5" />
                                <path d="M8 5v4" stroke="#F59095" strokeWidth="1.5" strokeLinecap="round" />
                                <circle cx="8" cy="11" r="0.75" fill="#F59095" />
                            </svg>
                            <span className={styles.label}>{label}</span>
                            <svg
                                width="10"
                                height="10"
                                viewBox="0 0 10 10"
                                fill="#F59095"
                                className={`${styles.chevron}${isExpanded ? ` ${styles.chevronExpanded}` : ""}`}
                            >
                                <polygon points="2,1 9,5 2,9" />
                            </svg>
                        </div>

                        <div className={styles.body} style={{ maxHeight: isExpanded ? 200 : 0 }}>
                            <div className={styles.bodyContent}>
                                <p className={styles.value}>
                                    <strong>{Number(w.value).toFixed(2)}</strong>
                                    {w.out_of_range &&
                                        w.min !== null &&
                                        w.max !== null &&
                                        ` (range: ${w.min} – ${w.max})`}
                                    {w.off_nominal &&
                                        w.nominal !== null &&
                                        ` (nominal: ${w.nominal})`}
                                </p>
                                <p className={styles.detail}>{detail}</p>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
