import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    useMapEvents,
    Circle,
    Polyline,
} from "react-leaflet";
import { useState } from "react";
import "leaflet/dist/leaflet.css";
import { usePositions } from "../features/map/hooks/usePositions";
import { Pin } from "../features/map/pins";

function calculateDistance(pos1: { x: number; y: number }, pos2: { x: number; y: number }): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

export default function MapView() {
    const { positions } = usePositions();
    const [pins, setPins] = useState<Pin[]>([]);

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

    return (
        <div style={{ height: "100vh", width: "100%" }}>
            {positions?.bestPath?.warning && (
                <div
                    style={{
                        position: "absolute",
                        top: 10,
                        left: 10,
                        background: "red",
                        color: "white",
                        padding: "10px",
                        zIndex: 1000,
                        borderRadius: "5px",
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
                                const assets = [positions.rover, ...positions.eva].filter(Boolean);
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
                                            Signal Strength: {positions.ltv.signal.strength}%<br />
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
                {!positions?.ltv && positions?.ltvHistory && positions.ltvHistory.length > 0 && (
                    <Marker
                        position={[
                            positions.ltvHistory[positions.ltvHistory.length - 1].y,
                            positions.ltvHistory[positions.ltvHistory.length - 1].x,
                        ]}
                    >
                        <Popup>
                            LTV Last Known Location:{" "}
                            {positions.ltvHistory[positions.ltvHistory.length - 1].x},{" "}
                            {positions.ltvHistory[positions.ltvHistory.length - 1].y}
                        </Popup>
                    </Marker>
                )}
                {((positions?.ltv && positions.ltvSearchRadius > 0) ||
                    (!positions?.ltv &&
                        positions?.ltvHistory &&
                        positions.ltvHistory.length > 0 &&
                        positions.ltvSearchRadius > 0)) && (
                    <Circle
                        center={
                            positions?.ltv
                                ? [positions.ltv.y, positions.ltv.x]
                                : [
                                      positions.ltvHistory[positions.ltvHistory.length - 1].y,
                                      positions.ltvHistory[positions.ltvHistory.length - 1].x,
                                  ]
                        }
                        radius={positions.ltvSearchRadius}
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
                                    radius={(hazard.radius || 100) * 1000} // Convert to meters if needed
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
                {/* Breadcrumbs */}
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
    );
}
