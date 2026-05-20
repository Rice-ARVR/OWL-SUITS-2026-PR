import { useState, useRef, useEffect, useCallback } from "react";
import styles from "./InteractiveMap.module.css";
import { useNavigationState } from "./useNavigationState";
import { useTelemetry } from "~/hooks/useTelemetry";
import { useMapContext } from "~/contexts/MapContext";

import type {
    Point,
    MapPoint,
    HazardType,
    Mode,
    POIStep,
    Hazard,
    RoverPosition,
    ViewBox,
} from "~/types/map.ts";

import { Grid } from "./map-components/Grid";
import { Marker } from "./map-components/Marker"; // Pins
import { HazardShape } from "./map-components/HazardShape";
import { RoverIcon } from "./map-components/RoverIcon";
import { AstronautIcon } from "./map-components/AstronautIcon";
import { AutonomousLTVPanel } from "./map-components/panels/AutonomousLTVPanel";
import { ManualConfirmModal } from "./map-components/panels/ManualConfirmModal";
import { CriticalAlertPanel } from "./map-components/panels/CriticalAlertPanel";
import { AutonomousStatusPanel } from "./map-components/panels/AutonomousStatusPanel";
import { SignalingPanel } from "./map-components/panels/SignalingPanel";
import { HeadlightNoticePanel } from "./map-components/panels/HeadlightNoticePanel";
import { HazardPOIPanel } from "./map-components/panels/HazardPOIPanel";
import { HazardDetailsPanel } from "./map-components/panels/HazardDetailsPanel";
import { AssetsPanel } from "./map-components/panels/AssetsPanel";

import mockNavState from "./mock-nav-state.json";

// Set to true to use mock navigation data instead of the live backend
const DEBUG_MODE = false;

// ── Main map component ─────────────────────────────────

type ManualPingResult = {
    rssi_value: number;
    category: string;
    distance_min: number;
    distance_max: number;
} | null;

interface InteractiveMapProps {
    onAutonomyChange?: (isAutonomous: boolean) => void;
    onCurrentTargetChange?: (pos: { x: number; y: number } | null) => void;
    stopAutonomyRef?: React.MutableRefObject<(() => void) | undefined>;
    isSignaling?: boolean;
    signalStatus?: "pending" | "success" | "failed" | "not in range";
    lastManualPing?: ManualPingResult;
    headlightNotice?: "on" | "off" | null;
}

export default function InteractiveMap({
    onAutonomyChange,
    onCurrentTargetChange,
    stopAutonomyRef,
    isSignaling = false,
    signalStatus = "pending",
    lastManualPing,
    headlightNotice = null,
}: InteractiveMapProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const coordXInputRef = useRef<HTMLInputElement>(null);

    // Shared map state — single source of truth used by both InteractiveMap and Minimap
    const {
        points,
        setPoints,
        hazards,
        setHazards,
        savedPingHistory,
        setSavedPingHistory,
        savedPathHistory,
        savedSearchArea,
        setSavedSearchArea,
        navState: liveNavState,
        autonomyRequested,
        setAutonomyRequested,
        startAutonomy: ctxStartAutonomy,
        stopAutonomy: ctxStopAutonomy,
        executePing,
    } = useMapContext();

    // ── Navigation SSE hook (mock shim for debug) ──
    const liveNav = useNavigationState(false); // unused when not in DEBUG_MODE

    const { navState, startAutonomy, stopAutonomy } = DEBUG_MODE
        ? {
              navState: autonomyRequested ? (mockNavState as typeof liveNav.navState) : null,
              startAutonomy: async () => {
                  setAutonomyRequested(true);
              },
              stopAutonomy: async () => {
                  setAutonomyRequested(false);
              },
          }
        : {
              navState: liveNavState,
              startAutonomy: ctxStartAutonomy,
              stopAutonomy: ctxStopAutonomy,
          };

    const telemetry = useTelemetry();
    const pos = telemetry.getRoverPosition() ?? { x: 0, y: 0, z: 0 };
    const roverPosition: RoverPosition = {
        ...pos,
        heading: telemetry.getRoverHeading() ?? 0,
    };

    const eva1Imu = telemetry.getEvaImu("eva1");
    const eva2Imu = telemetry.getEvaImu("eva2");
    const ltvLocation = telemetry.getLtvLocation();

    const isAutonomous = navState?.autonomous_driving ?? false;

    // Notify parent when autonomy state changes
    useEffect(() => {
        onAutonomyChange?.(isAutonomous);
    }, [isAutonomous, onAutonomyChange]);

    // Notify parent when current target changes
    useEffect(() => {
        const target = navState?.session?.current_target?.position ?? null;
        onCurrentTargetChange?.(target ?? null);
    }, [navState?.session?.current_target, onCurrentTargetChange]);

    // Drop a persistent POI at the current autonomous target (once per unique position)
    useEffect(() => {
        const target = navState?.session?.current_target;
        if (!isAutonomous || !target) return;
        const { x, y } = target.position;
        setPoints((prev) => {
            const already = prev.some((p) => p.x === x && p.y === y);
            if (already) return prev;
            return [
                ...prev,
                {
                    id: `auto-target-${x}-${y}`,
                    x,
                    y,
                    label: "Waypoint",
                    description: target.description,
                    type: "poi",
                },
            ];
        });
    }, [navState?.session?.current_target, isAutonomous]);

    // Auto-center map on rover when position changes significantly
    const lastCenteredRef = useRef<{ x: number; y: number } | null>(null);
    useEffect(() => {
        if (roverPosition.x === 0 && roverPosition.y === 0) return;
        const last = lastCenteredRef.current;
        if (
            !last ||
            Math.abs(roverPosition.x - last.x) > 500 ||
            Math.abs(roverPosition.y - last.y) > 500
        ) {
            setViewBox((prev) => ({
                ...prev,
                x: roverPosition.x - prev.w / 2,
                y: roverPosition.y - prev.h / 2,
            }));
            lastCenteredRef.current = { x: roverPosition.x, y: roverPosition.y };
        }
    }, [roverPosition.x, roverPosition.y]);

    const [activeHazard, setActiveHazard] = useState<Hazard | null>(null);
    const [mousePos, setMousePos] = useState<Point | null>(null);
    const [mode, setMode] = useState<Mode>("navigate");

    // Autonomous LTV
    const [ltvX, setLtvX] = useState("");
    const [ltvY, setLtvY] = useState("");
    const [showManualConfirm, setShowManualConfirm] = useState(false);
    const [criticalAlert, setCriticalAlert] = useState<string | null>(null);

    // Show popup when status hits critical (backend may already set autonomous_driving=false)
    const prevStatusLevelRef = useRef<string | undefined>(undefined);
    useEffect(() => {
        const level = navState?.status_level;
        if (
            level === "critical" &&
            prevStatusLevelRef.current !== "critical" &&
            navState?.status_message
        ) {
            setCriticalAlert(navState.status_message);
        }
        prevStatusLevelRef.current = level;
    }, [navState?.status_level, navState?.status_message]);
    // Append manual pings (fired outside of autonomous mode) to saved history
    const lastProcessedPingRef = useRef<ManualPingResult>(null);

    useEffect(() => {
        if (!lastManualPing || lastManualPing === lastProcessedPingRef.current) return;
        lastProcessedPingRef.current = lastManualPing;

        const rssi = lastManualPing.rssi_value;
        const outOfRange = isNaN(rssi) || rssi === 1;
        const category = outOfRange ? "not_in_range" : lastManualPing.category;

        const rMin = lastManualPing.distance_min;
        const rMax = lastManualPing.distance_max;

        setSavedPingHistory((prev) => [
            ...prev,
            {
                timestamp: new Date().toISOString(),
                rover_position: { x: roverPosition.x, y: roverPosition.y },
                rssi,
                signal_category: category,
                distance_min: rMin,
                distance_max: rMax,
            },
        ]);

        // Update search area from manual ping (clear it if out of range)
        if (outOfRange) {
            setSavedSearchArea(null);
        } else {
            setSavedSearchArea({
                center: { x: roverPosition.x, y: roverPosition.y },
                radius_min_m: rMin,
                radius_max_m: rMax,
            });
        }
    }, [lastManualPing, roverPosition.x, roverPosition.y]);

    // FAB menu
    const [showAddMenu, setShowAddMenu] = useState(false);

    // Hazard details step
    const [pendingHazard, setPendingHazard] = useState<Hazard | null>(null);
    const [selectedTypes, setSelectedTypes] = useState<HazardType[]>([]);

    // POI workflow
    const [poiStep, setPoiStep] = useState<POIStep>("placing");
    const [pendingPOI, setPendingPOI] = useState<MapPoint | null>(null);
    const [poiName, setPoiName] = useState("");
    const [poiDescription, setPoiDescription] = useState("");
    const [poiCoordX, setPoiCoordX] = useState("");
    const [poiCoordY, setPoiCoordY] = useState("");
    const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);

    // Focus the X coord input whenever a map click autofills it
    useEffect(() => {
        if (pendingPOI && poiStep === "placing") {
            coordXInputRef.current?.focus();
        }
    }, [pendingPOI?.id]);
    const [hoveredPingIndex, setHoveredPingIndex] = useState<number | null>(null);
    const [isTargetHovered, setIsTargetHovered] = useState(false);
    const [isRoverHovered, setIsRoverHovered] = useState(false);
    const [isEva1Hovered, setIsEva1Hovered] = useState(false);
    const [isEva2Hovered, setIsEva2Hovered] = useState(false);
    const [isLtvHovered, setIsLtvHovered] = useState(false);
    const [assetsExpanded, setAssetsExpanded] = useState(false);

    const [viewBox, setViewBox] = useState<ViewBox>({
        x: -500,
        y: -400,
        w: 1000,
        h: 800,
    });

    const [isPanning, setIsPanning] = useState(false);
    const panStart = useRef<{ x: number; y: number; vx: number; vy: number }>({
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
    });

    // ── Coordinate conversion ──

    const getSVGCoords = useCallback(
        (e: React.MouseEvent<SVGSVGElement> | MouseEvent): Point => {
            const svg = svgRef.current;
            if (!svg) return { x: 0, y: 0 };
            const rect = svg.getBoundingClientRect();
            const scaleX = viewBox.w / rect.width;
            const scaleY = viewBox.h / rect.height;
            return {
                x: (e.clientX - rect.left) * scaleX + viewBox.x,
                y: viewBox.y + viewBox.h - (e.clientY - rect.top) * scaleY,
            };
        },
        [viewBox],
    );

    // ── Canvas click ──

    const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
        if (isPanning) return;
        const { x, y } = getSVGCoords(e);

        if (mode === "addPOI" && poiStep === "placing") {
            if (pendingPOI) {
                setPendingPOI((prev) => (prev ? { ...prev, x, y } : null));
                setPoiCoordX(String(Math.round(x)));
                setPoiCoordY(String(Math.round(y)));
                setMousePos(null);
                setPoiStep("naming");
                return;
            } else {
                const defaultName = `POI ${points.filter((p) => p.type === "poi").length + 1}`;
                setPendingPOI({
                    id: crypto.randomUUID(),
                    x,
                    y,
                    label: defaultName,
                    description: "",
                    type: "poi",
                });
                setPoiName(defaultName);
                setPoiDescription("");
                setPoiCoordX(String(Math.round(x)));
                setPoiCoordY(String(Math.round(y)));
            }
        }

        if (mode === "plotHazard") {
            if (!activeHazard) {
                setActiveHazard({
                    id: crypto.randomUUID(),
                    points: [{ x, y }],
                    closed: false,
                    types: [],
                });
            } else {
                setActiveHazard((prev) =>
                    prev ? { ...prev, points: [...prev.points, { x, y }] } : null,
                );
            }
        }
    };

    // ── Mouse move ──

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        const coords = getSVGCoords(e);

        if (isPanning) {
            const dx = e.clientX - panStart.current.x;
            const dy = e.clientY - panStart.current.y;
            const svg = svgRef.current;
            if (!svg) return;
            const rect = svg.getBoundingClientRect();
            const scaleX = viewBox.w / rect.width;
            const scaleY = viewBox.h / rect.height;
            setViewBox((prev) => ({
                ...prev,
                x: panStart.current.vx - dx * scaleX,
                y: panStart.current.vy + dy * scaleY,
            }));
            return;
        }

        if (mode === "plotHazard" && activeHazard) {
            setMousePos(coords);
        }

        if (mode === "addPOI" && poiStep === "placing") {
            setMousePos(coords);
            if (pendingPOI) {
                setPoiCoordX(String(Math.round(coords.x)));
                setPoiCoordY(String(Math.round(coords.y)));
            }
        }
    };

    // ── Pan handlers ──

    const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
        if (mode === "navigate") {
            setIsPanning(true);
            panStart.current = {
                x: e.clientX,
                y: e.clientY,
                vx: viewBox.x,
                vy: viewBox.y,
            };
        }
    };

    const handleMouseUp = () => {
        setIsPanning(false);
    };

    const centerOn = (x: number, y: number) => {
        setViewBox((prev) => ({ ...prev, x: x - prev.w / 2, y: y - prev.h / 2 }));
    };

    const handleMouseLeave = () => {
        setIsPanning(false);
        if (mode === "addPOI" && poiStep === "placing") {
            setMousePos(null);
        }
    };

    // ── Zoom helpers ──

    const ZOOM_FACTOR = 0.25;
    const MIN_VIEW = 200;
    const MAX_VIEW = 8000;

    const zoomBy = useCallback((direction: 1 | -1) => {
        setViewBox((prev) => {
            const factor = direction === 1 ? 1 - ZOOM_FACTOR : 1 + ZOOM_FACTOR;
            const newW = Math.min(MAX_VIEW, Math.max(MIN_VIEW, prev.w * factor));
            const newH = Math.min(MAX_VIEW, Math.max(MIN_VIEW, prev.h * factor));
            return {
                x: prev.x + (prev.w - newW) / 2,
                y: prev.y + (prev.h - newH) / 2,
                w: newW,
                h: newH,
            };
        });
    }, []);

    // Block trackpad/scroll zoom — only allow zoom via buttons
    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
        };
        svg.addEventListener("wheel", onWheel, { passive: false });
        return () => svg.removeEventListener("wheel", onWheel);
    }, []);

    // ── Hazard flow ──

    const finishPlotting = () => {
        if (activeHazard && activeHazard.points.length >= 2) {
            const closed = { ...activeHazard, closed: true };
            setPendingHazard(closed);
            setActiveHazard(null);
            setMousePos(null);
            setSelectedTypes([]);
            setMode("hazardDetails");
        }
    };

    const finishHazard = () => {
        if (pendingHazard) {
            setHazards((prev) => [...prev, { ...pendingHazard, types: selectedTypes }]);
            setPendingHazard(null);
            setSelectedTypes([]);
            setMode("navigate");
        }
    };

    const cancelAll = () => {
        setActiveHazard(null);
        setPendingHazard(null);
        setPendingPOI(null);
        setPoiStep("placing");
        setPoiName("");
        setPoiDescription("");
        setPoiCoordX("");
        setPoiCoordY("");
        setMousePos(null);
        setSelectedTypes([]);
        setLtvX("");
        setLtvY("");
        setMode("navigate");
        setShowAddMenu(false);
    };

    // ── Autonomous LTV workflow ──

    const handleStartAutonomousLTV = () => {
        setShowAddMenu(false);
        setLtvX("");
        setLtvY("");
        setMode("autonomousLTV");
    };

    const handleLaunchAutonomy = async () => {
        setAutonomyRequested(true);
        await startAutonomy();
        setMode("navigate");
    };

    const cancelAutonomousLTV = () => {
        setLtvX("");
        setLtvY("");
        setMode("navigate");
    };

    const handleManualModeRequest = () => {
        if (isAutonomous) {
            setShowManualConfirm(true);
        }
    };

    const confirmStopAutonomy = async () => {
        await stopAutonomy();
        setAutonomyRequested(false);
        setShowManualConfirm(false);
    };

    // Expose stop handler to parent via ref
    useEffect(() => {
        if (stopAutonomyRef) {
            stopAutonomyRef.current = confirmStopAutonomy;
        }
    });

    const undoLastPoint = () => {
        if (!activeHazard) return;
        if (activeHazard.points.length <= 1) {
            setActiveHazard(null);
        } else {
            setActiveHazard((prev) =>
                prev ? { ...prev, points: prev.points.slice(0, -1) } : null,
            );
        }
    };

    const toggleHazardType = (type: HazardType) => {
        setSelectedTypes((prev) =>
            prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
        );
    };

    // ── POI workflow ──

    const confirmPOIName = () => {
        if (!pendingPOI) return;
        const name = poiName.trim() || pendingPOI.label;
        setPendingPOI((prev) => (prev ? { ...prev, label: name } : null));
        setPoiStep("describing");
    };

    const confirmPOIDescription = () => {
        if (!pendingPOI) return;
        const finalPOI = {
            ...pendingPOI,
            label: poiName.trim() || pendingPOI.label,
            description: poiDescription.trim(),
        };
        setPoints((prev) => [...prev, finalPOI]);
        setPendingPOI(null);
        setPoiName("");
        setPoiDescription("");
        setPoiCoordX("");
        setPoiCoordY("");
        setPoiStep("placing");
        setMode("navigate");
    };

    const cancelPOI = () => {
        setPendingPOI(null);
        setPoiName("");
        setPoiDescription("");
        setPoiCoordX("");
        setPoiCoordY("");
        setPoiStep("placing");
        setMode("navigate");
    };

    const placePOIFromCoords = () => {
        const x = parseFloat(poiCoordX);
        const y = parseFloat(poiCoordY);
        if (isNaN(x) || isNaN(y)) return;
        const defaultName =
            poiName.trim() || `POI ${points.filter((p) => p.type === "poi").length + 1}`;
        setPendingPOI((prev) => ({
            id: prev?.id ?? crypto.randomUUID(),
            x,
            y,
            label: defaultName,
            description: "",
            type: "poi",
        }));
        setPoiName(defaultName);
        setPoiDescription("");
        setPoiCoordX("");
        setPoiCoordY("");
        setPoiStep("naming");
    };

    // ── Delete handlers ──

    const deletePoint = (id: string) => {
        setPoints((prev) => prev.filter((p) => p.id !== id));
    };

    const deleteHazard = (id: string) => {
        setHazards((prev) => prev.filter((h) => h.id !== id));
    };

    // ── Keyboard shortcuts ──

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (mode === "addPOI" && pendingPOI) {
                    cancelPOI();
                } else {
                    cancelAll();
                }
            }
            if (e.key === "Enter" && mode === "plotHazard") finishPlotting();
            if (e.key === "Enter" && mode === "hazardDetails") finishHazard();
            if ((e.key === "z" && e.ctrlKey) || (e.key === "z" && e.metaKey)) {
                undoLastPoint();
            }
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    });

    // ── FAB handlers ──

    const handleAddPOI = () => {
        setShowAddMenu(false);
        setMode("addPOI");
    };

    const handlePlotHazard = () => {
        setShowAddMenu(false);
        setMode("plotHazard");
    };

    const cursorClass =
        mode === "navigate" ? (isPanning ? styles.grabbing : styles.grab) : styles.crosshair;

    const showPanel = mode === "plotHazard" || mode === "addPOI";
    const showDetailsPanel = mode === "hazardDetails";

    return (
        <div className={styles.wrapper}>
            {/* ── Autonomous LTV Panel (top-left) ── */}
            {mode === "autonomousLTV" && (
                <AutonomousLTVPanel
                    onLaunch={handleLaunchAutonomy}
                    onCancel={cancelAutonomousLTV}
                />
            )}

            {/* ── Manual mode confirmation overlay ── */}
            {showManualConfirm && (
                <ManualConfirmModal
                    onCancel={() => setShowManualConfirm(false)}
                    onConfirm={confirmStopAutonomy}
                />
            )}

            {/* ── All top-left panels (stacked) ── */}
            {(isAutonomous ||
                isSignaling ||
                showPanel ||
                showDetailsPanel ||
                headlightNotice ||
                criticalAlert) && (
                <div className={styles.panelStack}>
                    {criticalAlert && (
                        <CriticalAlertPanel
                            message={criticalAlert}
                            onDismiss={() => setCriticalAlert(null)}
                        />
                    )}

                    {isAutonomous && mode !== "autonomousLTV" && navState?.session && (
                        <AutonomousStatusPanel
                            session={navState.session}
                            statusMessage={navState.status_message}
                            statusLevel={navState.status_level}
                            onStop={handleManualModeRequest}
                        />
                    )}

                    {isSignaling && (
                        <SignalingPanel
                            signalStatus={signalStatus}
                            lastManualPing={lastManualPing}
                        />
                    )}

                    {headlightNotice && <HeadlightNoticePanel state={headlightNotice} />}

                    {showPanel && (
                        <HazardPOIPanel
                            mode={mode}
                            activeHazard={activeHazard}
                            pendingPOI={pendingPOI}
                            poiStep={poiStep}
                            poiName={poiName}
                            setPoiName={setPoiName}
                            poiDescription={poiDescription}
                            setPoiDescription={setPoiDescription}
                            poiCoordX={poiCoordX}
                            setPoiCoordX={setPoiCoordX}
                            poiCoordY={poiCoordY}
                            setPoiCoordY={setPoiCoordY}
                            coordXInputRef={coordXInputRef}
                            onClose={() => {
                                if (mode === "addPOI" && pendingPOI) {
                                    cancelPOI();
                                } else {
                                    cancelAll();
                                }
                            }}
                            undoLastPoint={undoLastPoint}
                            finishPlotting={finishPlotting}
                            placePOIFromCoords={placePOIFromCoords}
                            confirmPOIName={confirmPOIName}
                            confirmPOIDescription={confirmPOIDescription}
                        />
                    )}

                    {showDetailsPanel && (
                        <HazardDetailsPanel
                            selectedTypes={selectedTypes}
                            toggleHazardType={toggleHazardType}
                            onCancel={cancelAll}
                            onFinish={finishHazard}
                        />
                    )}
                </div>
            )}

            {/* ── FAB button (bottom-right) ── */}
            <div className={styles.fabArea}>
                {mode === "navigate" && showAddMenu && (
                    <div className={styles.fabMenu}>
                        <button className={styles.fabMenuItem} onClick={handleAddPOI}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="3" fill="currentColor" />
                                <circle
                                    cx="12"
                                    cy="12"
                                    r="9"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    fill="none"
                                />
                            </svg>
                            Add POI
                        </button>
                        <button className={styles.fabMenuItem} onClick={handlePlotHazard}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <polygon
                                    points="12,2 22,20 2,20"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    fill="none"
                                    strokeDasharray="3 2"
                                />
                            </svg>
                            Plot Hazard
                        </button>
                    </div>
                )}
                <button
                    className={`${styles.fab} ${showAddMenu ? styles.fabOpen : ""} ${
                        mode === "addPOI" ? styles.fabActivePOI : ""
                    } ${
                        mode === "plotHazard" || mode === "hazardDetails" ? styles.fabActive : ""
                    } ${mode === "autonomousLTV" ? styles.fabActiveDirections : ""}`}
                    onClick={() => {
                        if (mode === "navigate") {
                            setShowAddMenu(!showAddMenu);
                        }
                    }}
                >
                    {(mode === "navigate" || mode === "autonomousLTV") && (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <line
                                x1="12"
                                y1="5"
                                x2="12"
                                y2="19"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                            />
                            <line
                                x1="5"
                                y1="12"
                                x2="19"
                                y2="12"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                            />
                        </svg>
                    )}
                    {mode === "addPOI" && (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="3" fill="currentColor" />
                            <circle
                                cx="12"
                                cy="12"
                                r="9"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="none"
                            />
                        </svg>
                    )}
                    {(mode === "plotHazard" || mode === "hazardDetails") && (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <polygon
                                points="12,2 22,20 2,20"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="none"
                                strokeDasharray="3 2"
                            />
                        </svg>
                    )}
                </button>

                {/* Zoom in / out buttons */}
                <div className={styles.fabZoomRow}>
                    <button
                        className={styles.fabSecondary}
                        onClick={() => zoomBy(1)}
                        title="Zoom in"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <circle
                                cx="11"
                                cy="11"
                                r="7"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="none"
                            />
                            <line
                                x1="16.5"
                                y1="16.5"
                                x2="21"
                                y2="21"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                            />
                            <line
                                x1="8"
                                y1="11"
                                x2="14"
                                y2="11"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                            />
                            <line
                                x1="11"
                                y1="8"
                                x2="11"
                                y2="14"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                            />
                        </svg>
                    </button>
                    <button
                        className={styles.fabSecondary}
                        onClick={() => zoomBy(-1)}
                        title="Zoom out"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <circle
                                cx="11"
                                cy="11"
                                r="7"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="none"
                            />
                            <line
                                x1="16.5"
                                y1="16.5"
                                x2="21"
                                y2="21"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                            />
                            <line
                                x1="8"
                                y1="11"
                                x2="14"
                                y2="11"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                            />
                        </svg>
                    </button>
                </div>

                {/* Autonomous LTV button */}
                <button
                    className={`${styles.fabSecondary} ${styles.fabSecondaryWide} ${
                        mode === "autonomousLTV" || isAutonomous ? styles.fabSecondaryActive : ""
                    }`}
                    onClick={() => {
                        if (isAutonomous) {
                            handleManualModeRequest();
                        } else if (mode !== "autonomousLTV") {
                            handleStartAutonomousLTV();
                        }
                    }}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <circle
                            cx="11"
                            cy="11"
                            r="7"
                            stroke="currentColor"
                            strokeWidth="2"
                            fill="none"
                        />
                        <line
                            x1="16.5"
                            y1="16.5"
                            x2="21"
                            y2="21"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                        />
                        <path
                            d="M11 8a3 3 0 0 1 3 3"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                        />
                    </svg>
                    <span>LTV Search</span>
                </button>
            </div>

            {/* ── SVG canvas ── */}
            <svg
                ref={svgRef}
                className={`${styles.canvas} ${cursorClass}`}
                viewBox={`${viewBox.x} ${-viewBox.y - viewBox.h} ${viewBox.w} ${viewBox.h}`}
                preserveAspectRatio="none"
                onClick={handleCanvasClick}
                onMouseMove={handleMouseMove}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
            >
                <Grid spacing={50} viewBox={viewBox} />

                <line x1="-15" y1="0" x2="15" y2="0" stroke="#555" strokeWidth="1" />
                <line x1="0" y1="-15" x2="0" y2="15" stroke="#555" strokeWidth="1" />

                {/* Saved hazards */}
                {hazards.map((h) => (
                    <HazardShape key={h.id} hazard={h} onDelete={deleteHazard} />
                ))}

                {/* ── Autonomous Nav Overlays ── */}

                {/* Search area donut — only shown in manual mode; hidden during autonomy */}
                {!isAutonomous &&
                    savedSearchArea &&
                    (savedSearchArea.radius_min_m !== 0 || savedSearchArea.radius_max_m !== 0) && (
                        <g>
                            {/* Outer circle (max radius) */}
                            <circle
                                cx={savedSearchArea.center.x}
                                cy={-savedSearchArea.center.y}
                                r={savedSearchArea.radius_max_m}
                                fill="rgba(110, 231, 183, 0.06)"
                                stroke="#6ee7b7"
                                strokeWidth="1.5"
                                strokeDasharray="8 4"
                                opacity="0.4"
                            />
                            {/* Inner circle (min radius) — punches out the donut center */}
                            {savedSearchArea.radius_min_m > 0 && (
                                <circle
                                    cx={savedSearchArea.center.x}
                                    cy={-savedSearchArea.center.y}
                                    r={savedSearchArea.radius_min_m}
                                    fill="#1e1e22"
                                    stroke="#6ee7b7"
                                    strokeWidth="1"
                                    strokeDasharray="4 4"
                                    opacity="0.35"
                                />
                            )}
                            {/* Center crosshair */}
                            <circle
                                cx={savedSearchArea.center.x}
                                cy={-savedSearchArea.center.y}
                                r="4"
                                fill="none"
                                stroke="#6ee7b7"
                                strokeWidth="1"
                                opacity="0.5"
                            />
                            {/* Label */}
                            <text
                                x={savedSearchArea.center.x}
                                y={-savedSearchArea.center.y - savedSearchArea.radius_max_m - 10}
                                textAnchor="middle"
                                fill="#6ee7b7"
                                fontSize="10"
                                opacity="0.6"
                            >
                                Search Area (
                                {savedSearchArea.radius_min_m > 0
                                    ? `${Math.round(savedSearchArea.radius_min_m)}–${Math.round(savedSearchArea.radius_max_m)}m`
                                    : `${Math.round(savedSearchArea.radius_max_m)}m radius`}
                                )
                            </text>
                        </g>
                    )}

                {/* Breadcrumb trail */}
                {savedPathHistory.length >= 2 && (
                    <polyline
                        points={savedPathHistory.map((p) => `${p.x},${-p.y}`).join(" ")}
                        fill="none"
                        stroke="#6ee7b7"
                        strokeWidth="1.5"
                        opacity="0.35"
                    />
                )}

                {/* Projected path (only while autonomous) */}
                {isAutonomous &&
                    navState?.session?.projected_path &&
                    navState.session.projected_path.length >= 1 && (
                        <polyline
                            points={[
                                `${roverPosition.x},${-roverPosition.y}`,
                                ...navState.session.projected_path.map((p) => `${p.x},${-p.y}`),
                            ].join(" ")}
                            fill="none"
                            stroke="#6ee7b7"
                            strokeWidth="2"
                            strokeDasharray="8 4"
                            opacity="0.6"
                        />
                    )}

                {/* Ping history markers (persisted after autonomy stops) */}
                {savedPingHistory.map((ping, i) => {
                    const color =
                        ping.signal_category === "strong"
                            ? "#6ee7b7"
                            : ping.signal_category === "moderate"
                              ? "#fbbf24"
                              : ping.signal_category === "weak"
                                ? "#f97316"
                                : "#ef4444";
                    const isLast = i === savedPingHistory.length - 1;
                    const isHovered = hoveredPingIndex === i;
                    const showRange = isHovered || (isLast && hoveredPingIndex === null);
                    const rMin = ping.distance_min;
                    const rMax = ping.distance_max;
                    const px = ping.rover_position.x;
                    const py = -ping.rover_position.y;
                    return (
                        <g
                            key={`ping-${i}`}
                            onMouseEnter={() => setHoveredPingIndex(i)}
                            onMouseLeave={() => setHoveredPingIndex(null)}
                            style={{ cursor: "default" }}
                        >
                            <circle
                                cx={px}
                                cy={py}
                                r="8"
                                fill="transparent"
                                stroke={color}
                                strokeWidth="2"
                                opacity="0.6"
                            />
                            <circle cx={px} cy={py} r="3" fill={color} opacity="0.8" />
                            <text
                                x={px}
                                y={py - 14}
                                textAnchor="middle"
                                fill={color}
                                fontSize="8"
                                opacity="0.7"
                            >
                                {Math.round(ping.rssi)}dBm
                            </text>
                            {showRange && (
                                <g>
                                    <circle
                                        cx={px}
                                        cy={py}
                                        r={rMax}
                                        fill={`${color}0d`}
                                        stroke={color}
                                        strokeWidth="1.5"
                                        strokeDasharray="8 4"
                                        opacity="0.5"
                                        pointerEvents="none"
                                    />
                                    {rMin > 0 && (
                                        <circle
                                            cx={px}
                                            cy={py}
                                            r={rMin}
                                            fill="#1e1e2240"
                                            stroke={color}
                                            strokeWidth="1"
                                            strokeDasharray="4 4"
                                            opacity="0.4"
                                            pointerEvents="none"
                                        />
                                    )}
                                </g>
                            )}
                            {isHovered &&
                                (() => {
                                    const ts = ping.timestamp
                                        ? new Date(ping.timestamp).toLocaleTimeString([], {
                                              hour: "2-digit",
                                              minute: "2-digit",
                                              second: "2-digit",
                                              timeZone: "America/Chicago",
                                          })
                                        : "—";
                                    const tw = 180;
                                    const lineH = 17;
                                    const th = lineH * 3 + 14;
                                    const tx = px - tw / 2;
                                    const ty = py - 36 - th;
                                    return (
                                        <g>
                                            {/* Tooltip */}
                                            <rect
                                                x={tx}
                                                y={ty}
                                                width={tw}
                                                height={th}
                                                rx="6"
                                                fill="#1e1e22"
                                                stroke="#444"
                                                strokeWidth="1"
                                                pointerEvents="none"
                                            />
                                            <polygon
                                                points={`${px - 6},${ty + th} ${px + 6},${ty + th} ${px},${ty + th + 8}`}
                                                fill="#1e1e22"
                                                stroke="#444"
                                                strokeWidth="1"
                                                pointerEvents="none"
                                            />
                                            <line
                                                x1={px - 6}
                                                y1={ty + th}
                                                x2={px + 6}
                                                y2={ty + th}
                                                stroke="#1e1e22"
                                                strokeWidth="2"
                                                pointerEvents="none"
                                            />
                                            <text
                                                x={px}
                                                y={ty + 8 + lineH * 1}
                                                textAnchor="middle"
                                                fill="#6ee7b7"
                                                fontSize="11"
                                            >
                                                {`x: ${Math.round(ping.rover_position.x)}, y: ${Math.round(ping.rover_position.y)}`}
                                            </text>
                                            <text
                                                x={px}
                                                y={ty + 8 + lineH * 2}
                                                textAnchor="middle"
                                                fill="#aaa"
                                                fontSize="10"
                                            >
                                                {ts}
                                            </text>
                                            <text
                                                x={px}
                                                y={ty + 8 + lineH * 3}
                                                textAnchor="middle"
                                                fill={color}
                                                fontSize="10"
                                            >
                                                {`${Math.round(ping.rssi)} dBm · ${ping.signal_category.replace("_", " ")} · ${rMin}–${rMax} m`}
                                            </text>
                                        </g>
                                    );
                                })()}
                        </g>
                    );
                })}

                {/* Current autonomous target */}
                {isAutonomous &&
                    navState?.session?.current_target &&
                    (() => {
                        const tx = navState.session.current_target.position.x;
                        const ty = -navState.session.current_target.position.y;
                        const tw = 160;
                        const th = 44;
                        const ttx = tx - tw / 2;
                        const tty = ty - 36 - th;
                        return (
                            <g
                                onMouseEnter={() => setIsTargetHovered(true)}
                                onMouseLeave={() => setIsTargetHovered(false)}
                                style={{ cursor: "default" }}
                            >
                                <circle
                                    cx={tx}
                                    cy={ty}
                                    r="10"
                                    fill="none"
                                    stroke="#6ee7b7"
                                    strokeWidth="2"
                                    strokeDasharray="4 2"
                                >
                                    <animate
                                        attributeName="r"
                                        values="8;12;8"
                                        dur="2s"
                                        repeatCount="indefinite"
                                    />
                                    <animate
                                        attributeName="opacity"
                                        values="1;0.4;1"
                                        dur="2s"
                                        repeatCount="indefinite"
                                    />
                                </circle>
                                <circle cx={tx} cy={ty} r="3" fill="#6ee7b7" />
                                {/* Invisible hit area so hover works when cursor is near but not on the small dot */}
                                <circle
                                    cx={tx}
                                    cy={ty}
                                    r="16"
                                    fill="transparent"
                                    pointerEvents="all"
                                />
                                {isTargetHovered && (
                                    <g>
                                        <rect
                                            x={ttx}
                                            y={tty}
                                            width={tw}
                                            height={th}
                                            rx="6"
                                            fill="#1e1e22"
                                            stroke="#444"
                                            strokeWidth="1"
                                            pointerEvents="none"
                                        />
                                        <polygon
                                            points={`${tx - 6},${tty + th} ${tx + 6},${tty + th} ${tx},${tty + th + 8}`}
                                            fill="#1e1e22"
                                            stroke="#444"
                                            strokeWidth="1"
                                            pointerEvents="none"
                                        />
                                        <line
                                            x1={tx - 6}
                                            y1={tty + th}
                                            x2={tx + 6}
                                            y2={tty + th}
                                            stroke="#1e1e22"
                                            strokeWidth="2"
                                            pointerEvents="none"
                                        />
                                        <text
                                            x={tx}
                                            y={tty + 17}
                                            textAnchor="middle"
                                            fill="#6ee7b7"
                                            fontSize="11"
                                            pointerEvents="none"
                                        >
                                            {`x: ${Math.round(navState.session.current_target.position.x)}`}
                                        </text>
                                        <text
                                            x={tx}
                                            y={tty + 34}
                                            textAnchor="middle"
                                            fill="#6ee7b7"
                                            fontSize="11"
                                            pointerEvents="none"
                                        >
                                            {`y: ${Math.round(navState.session.current_target.position.y)}`}
                                        </text>
                                    </g>
                                )}
                            </g>
                        );
                    })()}

                {/* Pending hazard (waiting for details) */}
                {pendingHazard && (
                    <g>
                        <polygon
                            points={pendingHazard.points.map((p) => `${p.x},${-p.y}`).join(" ")}
                            fill="rgba(255, 138, 117, 0.12)"
                            stroke="#ff8a75"
                            strokeWidth="2"
                        />
                        {pendingHazard.points.map((p, i) => (
                            <circle key={i} cx={p.x} cy={-p.y} r="5" fill="#ff8a75" />
                        ))}
                    </g>
                )}

                {/* Active hazard being drawn */}
                {activeHazard && (
                    <g>
                        <polyline
                            points={activeHazard.points.map((p) => `${p.x},${-p.y}`).join(" ")}
                            fill="none"
                            stroke="#ff8a75"
                            strokeWidth="2"
                        />
                        {/* Dashed preview line from last point to cursor */}
                        {mousePos && activeHazard.points.length > 0 && (
                            <line
                                x1={activeHazard.points[activeHazard.points.length - 1].x}
                                y1={-activeHazard.points[activeHazard.points.length - 1].y}
                                x2={mousePos.x}
                                y2={-mousePos.y}
                                stroke="#ff8a75"
                                strokeWidth="1.5"
                                strokeDasharray="4 4"
                                opacity="0.5"
                            />
                        )}
                        {/* Dashed auto-close preview from last point back to first */}
                        {activeHazard.points.length >= 3 && (
                            <line
                                x1={activeHazard.points[activeHazard.points.length - 1].x}
                                y1={-activeHazard.points[activeHazard.points.length - 1].y}
                                x2={activeHazard.points[0].x}
                                y2={-activeHazard.points[0].y}
                                stroke="#ff8a75"
                                strokeWidth="1.5"
                                strokeDasharray="6 4"
                                opacity="0.35"
                            />
                        )}
                        {activeHazard.points.map((p, i) => (
                            <circle key={i} cx={p.x} cy={-p.y} r="5" fill="#ff8a75" />
                        ))}
                    </g>
                )}

                {/* Map points — hovered marker renders last for z-ordering */}
                {points
                    .filter((p) => p.id !== hoveredPointId)
                    .map((p) => (
                        <Marker
                            key={p.id}
                            point={p}
                            roverPosition={roverPosition}
                            onDelete={deletePoint}
                            isHovered={false}
                            onHover={() => setHoveredPointId(p.id)}
                            onLeave={() => setHoveredPointId(null)}
                        />
                    ))}
                {points
                    .filter((p) => p.id === hoveredPointId)
                    .map((p) => (
                        <Marker
                            key={p.id}
                            point={p}
                            roverPosition={roverPosition}
                            onDelete={deletePoint}
                            isHovered={true}
                            onHover={() => setHoveredPointId(p.id)}
                            onLeave={() => setHoveredPointId(null)}
                        />
                    ))}

                {/* Ghost POI — follows cursor while repositioning after first click */}
                {mode === "addPOI" && poiStep === "placing" && pendingPOI && mousePos && (
                    <g opacity="0.3" pointerEvents="none">
                        <path
                            d={`M ${mousePos.x} ${-mousePos.y}
                  C ${mousePos.x - 4} ${-mousePos.y - 6}, ${mousePos.x - 14} ${-mousePos.y - 16}, ${mousePos.x - 14} ${-mousePos.y - 26}
                  A 14 14 0 1 1 ${mousePos.x + 14} ${-mousePos.y - 26}
                  C ${mousePos.x + 14} ${-mousePos.y - 16}, ${mousePos.x + 4} ${-mousePos.y - 6}, ${mousePos.x} ${-mousePos.y} Z`}
                            fill="#6ee7b7"
                            stroke="#1e1e22"
                            strokeWidth="2"
                        />
                        <circle cx={mousePos.x} cy={-mousePos.y - 26} r="5" fill="#1e1e22" />
                    </g>
                )}

                {/* Pending POI (faded while editing) — shown only when cursor is off canvas */}
                {pendingPOI && (poiStep !== "placing" || !mousePos) && (
                    <g opacity="0.4">
                        <path
                            d={`M ${pendingPOI.x} ${-pendingPOI.y}
                  C ${pendingPOI.x - 4} ${-pendingPOI.y - 6}, ${pendingPOI.x - 14} ${-pendingPOI.y - 16}, ${pendingPOI.x - 14} ${-pendingPOI.y - 26}
                  A 14 14 0 1 1 ${pendingPOI.x + 14} ${-pendingPOI.y - 26}
                  C ${pendingPOI.x + 14} ${-pendingPOI.y - 16}, ${pendingPOI.x + 4} ${-pendingPOI.y - 6}, ${pendingPOI.x} ${-pendingPOI.y} Z`}
                            fill="#6ee7b7"
                            stroke="#1e1e22"
                            strokeWidth="2"
                        />
                        <circle cx={pendingPOI.x} cy={-pendingPOI.y - 26} r="5" fill="#1e1e22" />
                        <text
                            x={pendingPOI.x}
                            y={-pendingPOI.y + 14}
                            textAnchor="middle"
                            fill="#ccc"
                            fontSize="11"
                        >
                            {poiName || pendingPOI.label}:{" "}
                            {Math.round(
                                Math.sqrt(
                                    (pendingPOI.x - roverPosition.x) ** 2 +
                                        (pendingPOI.y - roverPosition.y) ** 2,
                                ),
                            )}
                            m
                        </text>
                    </g>
                )}

                {/* Rover */}
                <RoverIcon
                    position={roverPosition}
                    onHover={() => setIsRoverHovered(true)}
                    onLeave={() => setIsRoverHovered(false)}
                />
                {isRoverHovered &&
                    (() => {
                        const px = roverPosition.x;
                        const py = -roverPosition.y;
                        const tw = 160;
                        const th = 24;
                        const tx = px - tw / 2;
                        const ty = py - 40 - th;
                        const coordText = `x: ${Math.round(roverPosition.x)}, y: ${Math.round(roverPosition.y)}`;
                        return (
                            <g>
                                <rect
                                    x={tx}
                                    y={ty}
                                    width={tw}
                                    height={th}
                                    rx="6"
                                    fill="#1e1e22"
                                    stroke="#444"
                                    strokeWidth="1"
                                />
                                <polygon
                                    points={`${px - 6},${ty + th} ${px + 6},${ty + th} ${px},${ty + th + 8}`}
                                    fill="#1e1e22"
                                    stroke="#444"
                                    strokeWidth="1"
                                />
                                <line
                                    x1={px - 6}
                                    y1={ty + th}
                                    x2={px + 6}
                                    y2={ty + th}
                                    stroke="#1e1e22"
                                    strokeWidth="2"
                                />
                                <text
                                    x={px}
                                    y={ty + 16}
                                    textAnchor="middle"
                                    fill="#6ee7b7"
                                    fontSize="11"
                                >
                                    {coordText}
                                </text>
                            </g>
                        );
                    })()}

                {/* LTV last known position — POI pin */}
                {ltvLocation &&
                    (() => {
                        const lx = ltvLocation.x;
                        const ly = -ltvLocation.y;
                        const color = "#fbbf24";
                        const tw = 180;
                        const th = 38;
                        const tx = lx - tw / 2;
                        const ty = ly - 55 - th;
                        return (
                            <g
                                onMouseEnter={() => setIsLtvHovered(true)}
                                onMouseLeave={() => setIsLtvHovered(false)}
                            >
                                <path
                                    d={`M ${lx} ${ly} C ${lx - 4} ${ly - 6}, ${lx - 14} ${ly - 16}, ${lx - 14} ${ly - 26} A 14 14 0 1 1 ${lx + 14} ${ly - 26} C ${lx + 14} ${ly - 16}, ${lx + 4} ${ly - 6}, ${lx} ${ly} Z`}
                                    fill={color}
                                    stroke="#1e1e22"
                                    strokeWidth="2"
                                />
                                <circle cx={lx} cy={ly - 26} r="5" fill="#1e1e22" />
                                <text
                                    x={lx}
                                    y={ly + 14}
                                    textAnchor="middle"
                                    fill="#ccc"
                                    fontSize="11"
                                >
                                    LTV LNP
                                </text>
                                {isLtvHovered && (
                                    <g pointerEvents="none">
                                        <rect
                                            x={tx}
                                            y={ty}
                                            width={tw}
                                            height={th}
                                            rx="6"
                                            fill="#1e1e22"
                                            stroke="#444"
                                            strokeWidth="1"
                                        />
                                        <polygon
                                            points={`${lx - 6},${ty + th} ${lx + 6},${ty + th} ${lx},${ty + th + 8}`}
                                            fill="#1e1e22"
                                            stroke="#444"
                                            strokeWidth="1"
                                        />
                                        <line
                                            x1={lx - 6}
                                            y1={ty + th}
                                            x2={lx + 6}
                                            y2={ty + th}
                                            stroke="#1e1e22"
                                            strokeWidth="2"
                                        />
                                        <text
                                            x={lx}
                                            y={ty + 15}
                                            textAnchor="middle"
                                            fill={color}
                                            fontSize="11"
                                        >
                                            LTV Last Known Position
                                        </text>
                                        <text
                                            x={lx}
                                            y={ty + 30}
                                            textAnchor="middle"
                                            fill="#ccc"
                                            fontSize="11"
                                        >
                                            {`x: ${Math.round(ltvLocation.x)}, y: ${Math.round(ltvLocation.y)}`}
                                        </text>
                                    </g>
                                )}
                            </g>
                        );
                    })()}

                {/* EVA astronauts */}
                {[
                    {
                        imu: eva1Imu,
                        label: "EVA1" as const,
                        hovered: isEva1Hovered,
                        setHovered: setIsEva1Hovered,
                    },
                    {
                        imu: eva2Imu,
                        label: "EVA2" as const,
                        hovered: isEva2Hovered,
                        setHovered: setIsEva2Hovered,
                    },
                ].map(({ imu, label, hovered, setHovered }) => {
                    if (!imu) return null;
                    const px = imu.posx;
                    const py = -imu.posy;
                    const tw = 160;
                    const th = 24;
                    const tx = px - tw / 2;
                    const ty = py - 40 - th;
                    const coordText = `x: ${Math.round(imu.posx)}, y: ${Math.round(imu.posy)}`;
                    const color = label === "EVA1" ? "#93c5fd" : "#f9a8d4";
                    return (
                        <g key={label}>
                            <AstronautIcon
                                x={px}
                                y={imu.posy}
                                heading={imu.heading}
                                label={label}
                                onHover={() => setHovered(true)}
                                onLeave={() => setHovered(false)}
                            />
                            {hovered && (
                                <g>
                                    <rect
                                        x={tx}
                                        y={ty}
                                        width={tw}
                                        height={th}
                                        rx="6"
                                        fill="#1e1e22"
                                        stroke="#444"
                                        strokeWidth="1"
                                    />
                                    <polygon
                                        points={`${px - 6},${ty + th} ${px + 6},${ty + th} ${px},${ty + th + 8}`}
                                        fill="#1e1e22"
                                        stroke="#444"
                                        strokeWidth="1"
                                    />
                                    <line
                                        x1={px - 6}
                                        y1={ty + th}
                                        x2={px + 6}
                                        y2={ty + th}
                                        stroke="#1e1e22"
                                        strokeWidth="2"
                                    />
                                    <text
                                        x={px}
                                        y={ty + 16}
                                        textAnchor="middle"
                                        fill={color}
                                        fontSize="11"
                                    >
                                        {coordText}
                                    </text>
                                </g>
                            )}
                        </g>
                    );
                })}
            </svg>

            {/* ── All Assets panel (top-right) ── */}
            <AssetsPanel
                expanded={assetsExpanded}
                onToggleExpanded={() => setAssetsExpanded((v) => !v)}
                roverPosition={roverPosition}
                eva1Imu={eva1Imu}
                eva2Imu={eva2Imu}
                ltvLocation={ltvLocation}
                points={points}
                savedPingHistory={savedPingHistory}
                hazards={hazards}
                centerOn={centerOn}
            />
        </div>
    );
}
