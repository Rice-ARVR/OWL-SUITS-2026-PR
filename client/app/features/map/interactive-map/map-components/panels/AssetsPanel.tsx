import styles from "../../InteractiveMap.module.css";
import type { MapPoint, Hazard, RoverPosition } from "~/types/map";
import type { ImuUnit } from "~/types/telemetry";
import type { SavedPingRecord } from "~/contexts/MapContext";

interface AssetsPanelProps {
    expanded: boolean;
    onToggleExpanded: () => void;
    roverPosition: RoverPosition;
    eva1Imu: ImuUnit | null | undefined;
    eva2Imu: ImuUnit | null | undefined;
    points: MapPoint[];
    savedPingHistory: SavedPingRecord[];
    hazards: Hazard[];
    centerOn: (x: number, y: number) => void;
}

export function AssetsPanel({
    expanded,
    onToggleExpanded,
    roverPosition,
    eva1Imu,
    eva2Imu,
    points,
    savedPingHistory,
    hazards,
    centerOn,
}: AssetsPanelProps) {
    return (
        <div className={styles.assetsPanel}>
            <div className={styles.assetsPanelHeader} onClick={onToggleExpanded}>
                <span className={styles.assetsPanelTitle}>All Assets</span>
                <span
                    className={`${styles.assetsChevron} ${expanded ? styles.assetsChevronOpen : ""}`}
                >
                    ▼
                </span>
            </div>

            {expanded && (
                <div className={styles.assetsList}>
                    {/* Rover */}
                    <div className={styles.assetGroup}>Rover</div>
                    <div
                        className={styles.assetItem}
                        onClick={() => centerOn(roverPosition.x, roverPosition.y)}
                    >
                        <span className={styles.assetDot} style={{ background: "#6ee7b7" }} />
                        <div className={styles.assetItemBody}>
                            <span className={styles.assetLabel}>Rover</span>
                            <span className={styles.assetCoords}>
                                x: {Math.round(roverPosition.x)}, y:{" "}
                                {Math.round(roverPosition.y)}
                            </span>
                        </div>
                    </div>

                    {/* EVAs */}
                    {(eva1Imu || eva2Imu) && <div className={styles.assetGroup}>EVAs</div>}
                    {eva1Imu && (
                        <div
                            className={styles.assetItem}
                            onClick={() => centerOn(eva1Imu.posx, eva1Imu.posy)}
                        >
                            <span
                                className={styles.assetDot}
                                style={{ background: "#93c5fd" }}
                            />
                            <div className={styles.assetItemBody}>
                                <span className={styles.assetLabel}>EVA 1</span>
                                <span className={styles.assetCoords}>
                                    x: {Math.round(eva1Imu.posx)}, y: {Math.round(eva1Imu.posy)}
                                </span>
                            </div>
                        </div>
                    )}
                    {eva2Imu && (
                        <div
                            className={styles.assetItem}
                            onClick={() => centerOn(eva2Imu.posx, eva2Imu.posy)}
                        >
                            <span
                                className={styles.assetDot}
                                style={{ background: "#f9a8d4" }}
                            />
                            <div className={styles.assetItemBody}>
                                <span className={styles.assetLabel}>EVA 2</span>
                                <span className={styles.assetCoords}>
                                    x: {Math.round(eva2Imu.posx)}, y: {Math.round(eva2Imu.posy)}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* POIs */}
                    {points.filter((p) => p.type === "poi").length > 0 && (
                        <div className={styles.assetGroup}>POIs</div>
                    )}
                    {points
                        .filter((p) => p.type === "poi")
                        .map((p) => (
                            <div
                                key={p.id}
                                className={styles.assetItem}
                                onClick={() => centerOn(p.x, p.y)}
                            >
                                <span
                                    className={styles.assetDot}
                                    style={{ background: "#6ee7b7" }}
                                />
                                <div className={styles.assetItemBody}>
                                    <span className={styles.assetLabel}>{p.label}</span>
                                    <span className={styles.assetCoords}>
                                        x: {Math.round(p.x)}, y: {Math.round(p.y)}
                                    </span>
                                </div>
                            </div>
                        ))}

                    {/* Pings */}
                    {savedPingHistory.length > 0 && (
                        <div className={styles.assetGroup}>Pings</div>
                    )}
                    {savedPingHistory.map((ping, i) => {
                        const pingColor =
                            ping.signal_category === "strong"
                                ? "#6ee7b7"
                                : ping.signal_category === "moderate"
                                  ? "#fbbf24"
                                  : ping.signal_category === "weak"
                                    ? "#f97316"
                                    : "#ef4444";
                        return (
                            <div
                                key={i}
                                className={styles.assetItem}
                                onClick={() =>
                                    centerOn(ping.rover_position.x, ping.rover_position.y)
                                }
                            >
                                <span
                                    className={styles.assetDot}
                                    style={{ background: pingColor }}
                                />
                                <div className={styles.assetItemBody}>
                                    <span className={styles.assetLabel}>
                                        Ping {i + 1} · {Math.round(ping.rssi)} dBm
                                    </span>
                                    <span className={styles.assetCoords}>
                                        x: {Math.round(ping.rover_position.x)}, y:{" "}
                                        {Math.round(ping.rover_position.y)}
                                    </span>
                                </div>
                            </div>
                        );
                    })}

                    {/* Hazards */}
                    {hazards.length > 0 && <div className={styles.assetGroup}>Hazards</div>}
                    {hazards.map((h) => {
                        const cx = h.points.reduce((s, p) => s + p.x, 0) / h.points.length;
                        const cy = h.points.reduce((s, p) => s + p.y, 0) / h.points.length;
                        return (
                            <div
                                key={h.id}
                                className={styles.assetItem}
                                onClick={() => centerOn(cx, cy)}
                            >
                                <span
                                    className={styles.assetDot}
                                    style={{ background: "#ff8a75" }}
                                />
                                <div className={styles.assetItemBody}>
                                    <span className={styles.assetLabel}>
                                        {h.types.length ? h.types.join(", ") : "Hazard"}
                                    </span>
                                    <span className={styles.assetCoords}>
                                        x: {Math.round(cx)}, y: {Math.round(cy)}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
