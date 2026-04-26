import { useEffect, useState } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

import "./app.css";
import type { Warning } from "~/types/warning";

export function Layout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <Meta />
                <Links />
            </head>
            <body>
                {children}
                <ScrollRestoration />
                <Scripts />
            </body>
        </html>
    );
}

export default function App() {
    const [warnings, setWarnings] = useState<Warning[]>([]);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        const ws = new WebSocket("ws://localhost:8000/ws/warnings");

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log("warnings:", data);
            setWarnings(data);
            // setDismissed(false);
        };

        return () => ws.close();
    }, []);

    return (
        <>
            <Outlet />
            {warnings.length > 0 && !dismissed && (
                <div
                    style={{
                        position: "fixed",
                        bottom: 16,
                        right: 16,
                        background: "#1a1a1a",
                        border: "1px solid #f00",
                        borderRadius: 8,
                        padding: 16,
                        maxWidth: 360,
                        maxHeight: 400,
                        overflowY: "auto",
                        zIndex: 9999,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <strong style={{ color: "#f00" }}>⚠ Warnings ({warnings.length})</strong>
                        <button
                            onClick={() => setDismissed(true)}
                            style={{
                                background: "none",
                                border: "none",
                                color: "#aaa",
                                cursor: "pointer",
                                fontSize: 16,
                                lineHeight: 1,
                            }}
                        >
                            ×
                        </button>
                    </div>
                    <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none" }}>
                        {warnings.map((w, i) => (
                            <li
                                key={i}
                                style={{
                                    color: w.out_of_range ? "#f66" : "#fa0",
                                    fontSize: 13,
                                    marginTop: 6,
                                }}
                            >
                                [{w.source}] {w.field}: {w.value}
                                {w.out_of_range && ` (range: ${w.min} – ${w.max})`}
                                {w.off_nominal && ` (nominal: ${w.nominal})`}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </>
    );
}
