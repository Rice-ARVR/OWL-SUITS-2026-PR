import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

import { GamepadProvider } from "~/contexts/GamepadContext";
import { MapProvider } from "~/contexts/MapContext";
import "./app.css";

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
    return (
        <GamepadProvider>
            <MapProvider>
                <Outlet />
            </MapProvider>
        </GamepadProvider>
    );
}
