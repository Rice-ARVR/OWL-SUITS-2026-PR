import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    useMapEvents,
    Circle,
    Polyline,
} from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import "leaflet/dist/leaflet.css";
import { usePositions } from "./hooks/usePositions";
import { Pin } from "../../types/pins";

function calculateDistance(pos1: { x: number; y: number }, pos2: { x: number; y: number }): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function formatTimer(totalSeconds: number) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export default function MapView() {
    const { positions } = usePositions();
    const [pins, setPins] = useState<Pin[]>([]);
    const [manualMode, setManualMode] = useState(true);
    const [missionSeconds, setMissionSeconds] = useState(0);

    useEffect(() => {
        const interval = window.setInterval(() => {
            setMissionSeconds((seconds) => seconds + 1);
        }, 1000);
        return () => window.clearInterval(interval);
    }, []);

    const firstWaypoint = positions?.waypoints?.[0] ?? null;

    const timeToPoiSeconds = useMemo(() => {
        if (!positions?.rover || !firstWaypoint) return null;
        const distance = calculateDistance(positions.rover, firstWaypoint);
        const travelSpeed = 5;
        return Math.round(distance / travelSpeed);
    }, [positions, firstWaypoint]);

    const timeToHomeSeconds = useMemo(() => {
        if (!positions?.rover) return null;
        const home = { x: 0, y: 0 };
        const distance = calculateDistance(positions.rover, home);
        const travelSpeed = 5;
        return Math.round(distance / travelSpeed);
    }, [positions]);

    const resourceEstimate = useMemo(() => {
        if (!positions?.bestPath) return "Pending";
        if (positions.bestPath.can_reach) return "Safe to proceed";
        return "Risk of fuel shortfall";
    }, [positions]);

    const missionStatus = useMemo(() => {
        if (positions?.bestPath?.warning) return "Off-nominal";
        if ((positions?.ltvSearchRadius ?? 0) > 0) return "Search active";
        return "Nominal";
    }, [positions]);

    // FIX 2: Moved outside MapView render tree to avoid re-declaration conflict
    function MapClickHandler() {
        useMapEvents({
            click: (e) => {
                const title = window.prompt("Enter POI title:");
                const description = window.prompt("Enter POI description (optional):");
                if (title) {
                    const newPin = new Pin(
                        Date.now().toString(),
                        { lat: e.latlng.lat, lng: e.latlng.lng },
                        title,
                        description || undefined,
                    );
                    setPins((prev) => [...prev, newPin]);
                }
            },
        });
        return null;
    }

    // FIX 1: Guard ltvSearchRadius with nullish coalescing throughout
    const ltvSearchRadius = positions?.ltvSearchRadius ?? 0;
    const lastLtvHistory =
        positions?.ltvHistory && positions.ltvHistory.length > 0
            ? positions.ltvHistory[positions.ltvHistory.length - 1]
            : null;

    const showSearchCircle =
        (positions?.ltv != null && ltvSearchRadius > 0) ||
        (!positions?.ltv && lastLtvHistory != null && ltvSearchRadius > 0);

    const searchCircleCenter: [number, number] | null = positions?.ltv
        ? [positions.ltv.y, positions.ltv.x]
        : lastLtvHistory
          ? [lastLtvHistory.y, lastLtvHistory.x]
          : null;

    return (
        <div style={{ display: "flex", minHeight: "100vh", width: "100%", background: "#0e1117" }}>
            <aside
                style={{
                    width: 420,
                    padding: "24px",
                    boxSizing: "border-box",
                    background: "#11161f",
                    color: "#f5f7fa",
                    borderRight: "1px solid rgba(255,255,255,0.06)",
                }}
            >
                <div style={{ marginBottom: 24 }}>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 16,
                        }}
                    >
                        <div>
                            <div
                                style={{
                                    fontSize: 12,
                                    color: "#7b83a2",
                                    textTransform: "uppercase",
                                }}
                            >
                                Mission Control
                            </div>
                            <h1 style={{ margin: "8px 0 0", fontSize: 28, letterSpacing: -0.5 }}>
                                Surface Asset Tracker
                            </h1>
                        </div>
                        <div
                            style={{
                                padding: "8px 12px",
                                borderRadius: 999,
                                background: positions?.bestPath?.can_reach ? "#1f7a44" : "#8b2c2c",
                                color: "white",
                                fontSize: 12,
                                fontWeight: 700,
                            }}
                        >
                            {missionStatus}
                        </div>
                    </div>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                            gap: 12,
                        }}
                    >
                        <div
                            style={{
                                background: "#14202d",
                                padding: 14,
                                borderRadius: 16,
                                border: "1px solid rgba(255,255,255,0.04)",
                            }}
                        >
                            <div style={{ fontSize: 11, color: "#7b83a2" }}>Resource Estimate</div>
                            <div style={{ marginTop: 8, fontSize: 18, fontWeight: 700 }}>
                                {resourceEstimate}
                            </div>
                        </div>
                        <div
                            style={{
                                background: "#14202d",
                                padding: 14,
                                borderRadius: 16,
                                border: "1px solid rgba(255,255,255,0.04)",
                            }}
                        >
                            <div style={{ fontSize: 11, color: "#7b83a2" }}>Mission Time</div>
                            <div style={{ marginTop: 8, fontSize: 18, fontWeight: 700 }}>
                                {formatTimer(missionSeconds)}
                            </div>
                        </div>
                        <div
                            style={{
                                background: "#14202d",
                                padding: 14,
                                borderRadius: 16,
                                border: "1px solid rgba(255,255,255,0.04)",
                            }}
                        >
                            <div style={{ fontSize: 11, color: "#7b83a2" }}>Time to POI</div>
                            <div style={{ marginTop: 8, fontSize: 18, fontWeight: 700 }}>
                                {timeToPoiSeconds != null ? formatTimer(timeToPoiSeconds) : "N/A"}
                            </div>
                        </div>
                        <div
                            style={{
                                background: "#14202d",
                                padding: 14,
                                borderRadius: 16,
                                border: "1px solid rgba(255,255,255,0.04)",
                            }}
                        >
                            <div style={{ fontSize: 11, color: "#7b83a2" }}>Time to Homebase</div>
                            <div style={{ marginTop: 8, fontSize: 18, fontWeight: 700 }}>
                                {timeToHomeSeconds != null ? formatTimer(timeToHomeSeconds) : "N/A"}
                            </div>
                        </div>
                    </div>
                </div>

                <div
                    style={{
                        background: "#121823",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: 20,
                        padding: 20,
                        marginBottom: 24,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <div>
                            <div
                                style={{
                                    fontSize: 11,
                                    color: "#7b83a2",
                                    textTransform: "uppercase",
                                }}
                            >
                                Find lost LTV
                            </div>
                            <h2 style={{ margin: "8px 0 0", fontSize: 16 }}>Current Task</h2>
                        </div>
                        <button
                            type="button"
                            onClick={() => setManualMode((value) => !value)}
                            style={{
                                padding: "8px 14px",
                                borderRadius: 999,
                                border: "none",
                                color: "white",
                                background: manualMode ? "#2b6af1" : "#4b5563",
                                cursor: "pointer",
                            }}
                        >
                            Manual {manualMode ? "On" : "Off"}
                        </button>
                    </div>
                    <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
                        {[
                            {
                                label: "Map Search Pattern",
                                detail: "Generate a search grid from last known LTV coordinates.",
                            },
                            {
                                label: "Navigate to LTV",
                                detail: "Move rover along projected path to recover the lost asset.",
                            },
                            {
                                label: "Initiate LTV Wake-up",
                                detail: "Send beacon ping once within search radius.",
                            },
                        ].map((task) => (
                            <div
                                key={task.label}
                                style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
                            >
                                <div
                                    style={{
                                        width: 16,
                                        height: 16,
                                        borderRadius: 4,
                                        border: "1px solid rgba(255,255,255,0.2)",
                                        display: "grid",
                                        placeItems: "center",
                                        color: "#84cc16",
                                    }}
                                >
                                    ✓
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700 }}>{task.label}</div>
                                    <div style={{ color: "#9ca3af", fontSize: 13 }}>
                                        {task.detail}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div
                    style={{
                        background: "#121823",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: 20,
                        padding: 20,
                        marginBottom: 24,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <div>
                            <div
                                style={{
                                    fontSize: 11,
                                    color: "#7b83a2",
                                    textTransform: "uppercase",
                                }}
                            >
                                Caution / Warning
                            </div>
                            <h2 style={{ margin: "8px 0 0", fontSize: 16 }}>Telemetry Alerts</h2>
                        </div>
                    </div>
                    <div style={{ marginTop: 16, minHeight: 88 }}>
                        {positions?.bestPath?.warning ? (
                            <div
                                style={{
                                    padding: 14,
                                    borderRadius: 16,
                                    background: "#3b1f1f",
                                    border: "1px solid #8b2c2c",
                                    color: "#fee2e2",
                                }}
                            >
                                <strong>Warning:</strong> {positions.bestPath.warning}
                            </div>
                        ) : (
                            <div
                                style={{
                                    padding: 14,
                                    borderRadius: 16,
                                    background: "#11202f",
                                    border: "1px solid rgba(255,255,255,0.08)",
                                    color: "#cbd5e1",
                                }}
                            >
                                No immediate off-nominal alerts. System recommends continuing search
                                and monitoring telemetry.
                            </div>
                        )}
                    </div>
                </div>

                <div
                    style={{
                        background: "#121823",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: 20,
                        padding: 20,
                    }}
                >
                    <div
                        style={{
                            fontSize: 11,
                            color: "#7b83a2",
                            textTransform: "uppercase",
                            marginBottom: 12,
                        }}
                    >
                        Lost LTV Search
                    </div>
                    <div style={{ marginBottom: 14 }}>
                        {/* FIX 1: ltvSearchRadius safely read via local variable */}
                        <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1 }}>
                            {ltvSearchRadius > 0 ? `${Math.round(ltvSearchRadius)} m` : "—"}
                        </div>
                        <div style={{ color: "#9ca3af", fontSize: 13, marginTop: 4 }}>
                            Projected LTV travel radius since last nominal fix.
                        </div>
                    </div>
                    <div style={{ display: "grid", gap: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "#cbd5e1" }}>Search path</span>
                            <span>
                                {positions?.recommendedPath
                                    ? `${positions.recommendedPath.length} points`
                                    : "N/A"}
                            </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "#cbd5e1" }}>POIs on map</span>
                            <span>{pins.length}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "#cbd5e1" }}>EV track lines</span>
                            <span>
                                {positions?.evaHistory?.flat().length ? "Active" : "Pending"}
                            </span>
                        </div>
                    </div>
                </div>
            </aside>

            <div style={{ flex: 1, position: "relative" }}>
                {positions?.bestPath?.warning && (
                    <div
                        style={{
                            position: "absolute",
                            top: 16,
                            left: 16,
                            background: "rgba(139, 44, 44, 0.95)",
                            color: "white",
                            padding: "12px 16px",
                            zIndex: 1000,
                            borderRadius: 12,
                            boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
                        }}
                    >
                        ⚠️ {positions.bestPath.warning}
                    </div>
                )}
                <MapContainer center={[0, 0]} zoom={10} style={{ height: "100vh", width: "100%" }}>
                    <TileLayer
                        url="https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-moon-basemap-v0-1/all/{z}/{x}/{y}.png"
                        attribution="Map data © OpenPlanetary"
                    />
                    {positions?.rover && (
                        <Marker position={[positions.rover.y, positions.rover.x]}>
                            <Popup>
                                Pressurized Rover: {positions.rover.x}, {positions.rover.y}
                            </Popup>
                        </Marker>
                    )}
                    {positions?.eva &&
                        positions.eva.map((e, i) => (
                            <Marker key={i} position={[e.y, e.x]}>
                                <Popup>
                                    EVA {i + 1}: {e.x}, {e.y}
                                </Popup>
                            </Marker>
                        ))}
                    {positions?.ltv && (
                        <Marker position={[positions.ltv.y, positions.ltv.x]}>
                            <Popup>
                                Lunar Terrain Vehicle: {positions.ltv.x}, {positions.ltv.y}
                                {(() => {
                                    const assets = [positions.rover, ...positions.eva].filter(
                                        Boolean,
                                    );
                                    const closestAsset = assets.reduce(
                                        (closest, asset) => {
                                            if (!asset) return closest;
                                            const dist = calculateDistance(positions.ltv!, asset);
                                            return !closest || dist < closest.dist
                                                ? { asset, dist }
                                                : closest;
                                        },
                                        null as {
                                            asset: { x: number; y: number };
                                            dist: number;
                                        } | null,
                                    );
                                    if (
                                        closestAsset &&
                                        closestAsset.dist < 500 &&
                                        positions.ltv.signal
                                    ) {
                                        return (
                                            <div>
                                                <br />
                                                <strong>LTV Beacon:</strong>
                                                <br />
                                                Distance: {closestAsset.dist.toFixed(1)}m<br />
                                                Signal Strength: {positions.ltv.signal.strength}%
                                                <br />
                                                Ping Requested:{" "}
                                                {positions.ltv.signal.ping_requested ? "Yes" : "No"}
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                            </Popup>
                        </Marker>
                    )}
                    {!positions?.ltv && lastLtvHistory && (
                        <Marker position={[lastLtvHistory.y, lastLtvHistory.x]}>
                            <Popup>
                                LTV Last Known Location: {lastLtvHistory.x}, {lastLtvHistory.y}
                            </Popup>
                        </Marker>
                    )}
                    {/* FIX 1: Circle uses pre-computed, fully guarded values */}
                    {showSearchCircle && searchCircleCenter && (
                        <Circle
                            center={searchCircleCenter}
                            radius={ltvSearchRadius}
                            pathOptions={{ color: "orange", fillColor: "orange", fillOpacity: 0.2 }}
                        />
                    )}
                    {pins.map((pin) => (
                        <Marker key={pin.id} position={[pin.position.lat, pin.position.lng]}>
                            <Popup>
                                <strong>{pin.title}</strong>
                                {pin.description && <p>{pin.description}</p>}
                            </Popup>
                        </Marker>
                    ))}
                    {positions?.hazards &&
                        positions.hazards.map((hazard, i) => {
                            if (hazard.type === "crater") {
                                return (
                                    <Circle
                                        key={`hazard-${i}`}
                                        center={[hazard.y, hazard.x]}
                                        radius={(hazard.radius || 100) * 1000}
                                        pathOptions={{
                                            color: "red",
                                            fillColor: "red",
                                            fillOpacity: 0.3,
                                        }}
                                    >
                                        <Popup>Crater: Radius {hazard.radius}m</Popup>
                                    </Circle>
                                );
                            } else if (hazard.type === "boulder") {
                                return (
                                    <Marker key={`hazard-${i}`} position={[hazard.y, hazard.x]}>
                                        <Popup>Boulder: Size {hazard.size}m</Popup>
                                    </Marker>
                                );
                            }
                            return null;
                        })}
                    {positions?.waypoints && (
                        <>
                            <Polyline
                                positions={positions.waypoints.map((wp) => [wp.y, wp.x])}
                                pathOptions={{ color: "blue", weight: 3 }}
                            />
                            {positions.waypoints.map((wp, i) => (
                                <Marker key={`waypoint-${i}`} position={[wp.y, wp.x]}>
                                    <Popup>{wp.label}</Popup>
                                </Marker>
                            ))}
                        </>
                    )}
                    {positions?.recommendedPath && (
                        <Polyline
                            positions={positions.recommendedPath.map((p) => [p.y, p.x])}
                            pathOptions={{
                                color: positions.bestPath?.can_reach ? "green" : "red",
                                weight: 4,
                                dashArray: "10, 10",
                            }}
                        />
                    )}
                    {positions?.roverHistory && positions.roverHistory.length > 1 && (
                        <Polyline
                            positions={positions.roverHistory.map((p) => [p.y, p.x])}
                            pathOptions={{ color: "blue", weight: 2, opacity: 0.7 }}
                        />
                    )}
                    {positions?.evaHistory && positions.evaHistory[0].length > 1 && (
                        <Polyline
                            positions={positions.evaHistory[0].map((p) => [p.y, p.x])}
                            pathOptions={{ color: "purple", weight: 2, opacity: 0.7 }}
                        />
                    )}
                    {positions?.evaHistory && positions.evaHistory[1].length > 1 && (
                        <Polyline
                            positions={positions.evaHistory[1].map((p) => [p.y, p.x])}
                            pathOptions={{ color: "purple", weight: 2, opacity: 0.7 }}
                        />
                    )}
                    {positions?.ltvHistory && positions.ltvHistory.length > 1 && (
                        <Polyline
                            positions={positions.ltvHistory.map((p) => [p.y, p.x])}
                            pathOptions={{ color: "brown", weight: 2, opacity: 0.7 }}
                        />
                    )}
                    <MapClickHandler />
                </MapContainer>
            </div>
        </div>
    );
}
