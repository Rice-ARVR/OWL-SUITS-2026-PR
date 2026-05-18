import { useState, useRef, useEffect, useCallback } from "react";
import styles from "./InteractiveMap.module.css";
import { useNavigationState } from "./useNavigationState";
import { useTelemetry } from "~/hooks/useTelemetry";
import { VirtualJoystick } from "~/features/controls/joystick";

import type {
    Point,
    MapPoint,
    HazardType,
    Mode,
    POIStep,
    Hazard,
    DirectionsStep,
    RoverPosition,
    ViewBox,
} from "~/types/map.ts";

import { dist, findPathAroundHazards } from "./Geometry"; // Geometry utilities for pathfinding
import { Grid } from "./map-components/Grid";
import { Marker } from "./map-components/Marker"; // Pins
import { HazardShape } from "./map-components/HazardShape";
import { RoverIcon } from "./map-components/RoverIcon";
import { AstronautIcon } from "./map-components/AstronautIcon";

import mockNavState from "./mock-nav-state.json";

// Set to true to use mock navigation data instead of the live backend
const DEBUG_MODE = false;

// ── Main map component ─────────────────────────────────

type ManualPingResult = {
    rssi_value: number;
    category: string;
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

    // Only connect to the navigation/stream SSE once the user starts autonomy
    const [autonomyRequested, setAutonomyRequested] = useState(false);

    // ── Navigation SSE hook ──
    const liveNav = useNavigationState(autonomyRequested);

    const { navState, connected, startAutonomy, stopAutonomy, executePing } = DEBUG_MODE
        ? {
              navState: autonomyRequested ? (mockNavState as typeof liveNav.navState) : null,
              connected: true,
              startAutonomy: async () => {
                  setAutonomyRequested(true);
              },
              stopAutonomy: async () => {
                  setAutonomyRequested(false);
              },
              executePing: async () => {},
          }
        : liveNav;

    const telemetry = useTelemetry();
    const pos = telemetry.getRoverPosition() ?? { x: 0, y: 0, z: 0 };
    const roverPosition: RoverPosition = {
        ...pos,
        heading: telemetry.getRoverHeading() ?? 0,
    };

    const eva1Imu = telemetry.getEvaImu("eva1");
    const eva2Imu = telemetry.getEvaImu("eva2");

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

    const [points, setPoints] = useState<MapPoint[]>([]);
    const [hazards, setHazards] = useState<Hazard[]>([]);
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
            const timer = setTimeout(() => setCriticalAlert(null), 5000);
            return () => clearTimeout(timer);
        }
        prevStatusLevelRef.current = level;
    }, [navState?.status_level, navState?.status_message]);
    const [savedPingHistory, setSavedPingHistory] = useState<
        {
            timestamp?: string;
            rover_position: { x: number; y: number };
            rssi: number;
            signal_category: string;
        }[]
    >([]);
    const [savedSearchArea, setSavedSearchArea] = useState<{
        center: { x: number; y: number };
        radius_min_m: number;
        radius_max_m: number;
    } | null>(null);

    // Sync ping history from navState into persistent local state
    useEffect(() => {
        if (navState?.session?.ping_history && navState.session.ping_history.length > 0) {
            setSavedPingHistory(navState.session.ping_history);
        }
    }, [navState?.session?.ping_history]);

    // Sync search area from navState into persistent local state
    useEffect(() => {
        if (navState?.session?.search_area) {
            setSavedSearchArea(navState.session.search_area);
        }
    }, [navState?.session?.search_area]);

    // Append manual pings (fired outside of autonomous mode) to saved history
    const lastProcessedPingRef = useRef<ManualPingResult>(null);

    // Match backend get_distance_range()
    const getDistanceRange = (category: string): [number, number] => {
        switch (category) {
            case "strong":
                return [0, 100];
            case "moderate":
                return [100, 462];
            case "weak":
                return [462, 1200];
            default:
                return [1200, 2000];
        }
    };

    useEffect(() => {
        if (!lastManualPing || lastManualPing === lastProcessedPingRef.current) return;
        lastProcessedPingRef.current = lastManualPing;

        setSavedPingHistory((prev) => [
            ...prev,
            {
                timestamp: new Date().toISOString(),
                rover_position: { x: roverPosition.x, y: roverPosition.y },
                rssi: lastManualPing.rssi_value,
                signal_category: lastManualPing.category,
            },
        ]);

        // Update search area from manual ping
        const [rMin, rMax] = getDistanceRange(lastManualPing.category);
        setSavedSearchArea({
            center: { x: roverPosition.x, y: roverPosition.y },
            radius_min_m: rMin,
            radius_max_m: rMax,
        });
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
    const [isRoverHovered, setIsRoverHovered] = useState(false);
    const [isEva1Hovered, setIsEva1Hovered] = useState(false);
    const [isEva2Hovered, setIsEva2Hovered] = useState(false);
    const [assetsExpanded, setAssetsExpanded] = useState(false);

    // Directions workflow
    const [directionsStep, setDirectionsStep] = useState<DirectionsStep>("selectDestination");
    const [waypoints, setWaypoints] = useState<MapPoint[]>([]);
    const [routePath, setRoutePath] = useState<Point[]>([]);
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [segmentDistances, setSegmentDistances] = useState<number[]>([]);

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

        // Directions — click near a POI or ping to add it as waypoint
        if (
            mode === "directions" &&
            (directionsStep === "selectDestination" || directionsStep === "review")
        ) {
            // Scale click radius to current zoom level so it feels consistent
            const clickRadius = Math.max(30, viewBox.w * 0.04);

            // Check POIs — check both pin tip (p.x, p.y) and pin center (p.x, p.y - 26)
            const nearestPOI = points.find((p) => {
                const dTip = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
                const dCenter = Math.sqrt((p.x - x) ** 2 + (p.y - 26 - y) ** 2);
                return Math.min(dTip, dCenter) < clickRadius;
            });
            if (nearestPOI && !waypoints.find((w) => w.id === nearestPOI.id)) {
                setWaypoints((prev) => [...prev, nearestPOI]);
                setDirectionsStep("review");
                return;
            }

            // Check pings
            const nearestPing = savedPingHistory.find((p) => {
                const d = Math.sqrt((p.rover_position.x - x) ** 2 + (p.rover_position.y - y) ** 2);
                return d < clickRadius;
            });
            if (nearestPing) {
                const pingWaypoint: MapPoint = {
                    id: `ping-${nearestPing.rover_position.x}-${nearestPing.rover_position.y}`,
                    x: nearestPing.rover_position.x,
                    y: nearestPing.rover_position.y,
                    label: `Ping ${Math.round(nearestPing.rssi)} dBm`,
                    description: nearestPing.signal_category,
                    type: "poi",
                };
                if (!waypoints.find((w) => w.id === pingWaypoint.id)) {
                    setWaypoints((prev) => [...prev, pingWaypoint]);
                    setDirectionsStep("review");
                }
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
        setWaypoints([]);
        setRoutePath([]);
        setSegmentDistances([]);
        setDirectionsStep("selectDestination");
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

    // ── Directions workflow ──

    const handleStartDirections = () => {
        setShowAddMenu(false);
        setWaypoints([]);
        setRoutePath([]);
        setDirectionsStep("selectDestination");
        setMode("directions");
    };

    const removeWaypoint = (index: number) => {
        setWaypoints((prev) => prev.filter((_, i) => i !== index));
        if (waypoints.length <= 1) {
            setDirectionsStep("selectDestination");
        }
    };

    const reorderWaypoints = (fromIndex: number, toIndex: number) => {
        setWaypoints((prev) => {
            const updated = [...prev];
            const [moved] = updated.splice(fromIndex, 1);
            updated.splice(toIndex, 0, moved);
            return updated;
        });
    };

    const handleDragEnd = () => {
        if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
            reorderWaypoints(dragIndex, dragOverIndex);
        }
        setDragIndex(null);
        setDragOverIndex(null);
    };

    const computeRoute = () => {
        setDirectionsStep("computing");

        setTimeout(() => {
            // Build ordered list of stops: rover → waypoint1 → waypoint2 → ...
            const stops: Point[] = [
                { x: roverPosition.x, y: roverPosition.y },
                ...waypoints.map((w) => ({ x: w.x, y: w.y })),
            ];

            const closedHazards = hazards.filter((h) => h.closed);

            // For each segment, find a path that avoids hazards
            const fullPath: Point[] = [stops[0]];
            const distances: number[] = [];
            for (let i = 0; i < stops.length - 1; i++) {
                const segmentPath = findPathAroundHazards(stops[i], stops[i + 1], closedHazards);
                let segDist = 0;
                for (let j = 0; j < segmentPath.length - 1; j++) {
                    segDist += dist(segmentPath[j], segmentPath[j + 1]);
                }
                distances.push(Math.round(segDist));
                fullPath.push(...segmentPath.slice(1));
            }

            // TODO: Replace with backend call
            // const response = await fetch('/api/compute-route', {
            //   method: 'POST',
            //   body: JSON.stringify({ start: roverPosition, waypoints, hazards }),
            // });
            // const data = await response.json();
            // setRoutePath(data.path);

            setSegmentDistances(distances);
            setRoutePath(fullPath);
            setDirectionsStep("active");
        }, 1500);
    };

    const cancelDirections = () => {
        setWaypoints([]);
        setRoutePath([]);
        setSegmentDistances([]);
        setDirectionsStep("selectDestination");
        setMode("navigate");
    };

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
        mode === "navigate"
            ? isPanning
                ? styles.grabbing
                : styles.grab
            : mode === "directions"
              ? styles.pointer
              : styles.crosshair;

    const showPanel = mode === "plotHazard" || mode === "addPOI";
    const showDetailsPanel = mode === "hazardDetails";

    return (
        <div className={styles.wrapper}>
            {/* ── Directions Panel (top-left) ── */}
            {mode === "directions" && (
                <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path
                                d="M3 12h4l3-9 4 18 3-9h4"
                                stroke="#6ee7b7"
                                strokeWidth="2"
                                fill="none"
                                strokeLinejoin="round"
                                strokeLinecap="round"
                            />
                        </svg>
                        <span className={styles.panelTitle}>
                            {directionsStep === "computing"
                                ? "Computing..."
                                : directionsStep === "active"
                                  ? "Route Active"
                                  : "Directions"}
                        </span>
                        <button className={styles.panelClose} onClick={cancelDirections}>
                            ×
                        </button>
                    </div>

                    {directionsStep === "selectDestination" && waypoints.length === 0 && (
                        <p className={styles.panelHint}>Click a POI or ping to set destination</p>
                    )}

                    {(directionsStep === "review" || directionsStep === "selectDestination") &&
                        waypoints.length > 0 && (
                            <div className={styles.routeList}>
                                {/* Rover origin */}
                                <div className={styles.routeItem}>
                                    <div className={styles.routeIcon}>
                                        <div className={styles.routeDot} />
                                    </div>
                                    <div className={styles.routeLabel}>Rover</div>
                                </div>
                                <div className={styles.routeConnector}>
                                    <div className={styles.routeDots}>⋮</div>
                                </div>

                                {/* Waypoints */}
                                {waypoints.map((wp, index) => (
                                    <div key={wp.id}>
                                        <div
                                            className={`${styles.routeItem} ${styles.routeItemDraggable} ${
                                                dragIndex === index ? styles.routeItemDragging : ""
                                            } ${dragOverIndex === index ? styles.routeItemDragOver : ""}`}
                                            draggable
                                            onDragStart={() => setDragIndex(index)}
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                setDragOverIndex(index);
                                            }}
                                            onDragEnd={handleDragEnd}
                                        >
                                            <div className={styles.routeIcon}>
                                                {index === waypoints.length - 1 ? (
                                                    <svg
                                                        width="14"
                                                        height="14"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                    >
                                                        <path
                                                            d="M12 21c0 0-7-7.5-7-12a7 7 0 1 1 14 0c0 4.5-7 12-7 12z"
                                                            fill="#e74c3c"
                                                            stroke="#1e1e22"
                                                            strokeWidth="1"
                                                        />
                                                        <circle
                                                            cx="12"
                                                            cy="9"
                                                            r="2.5"
                                                            fill="#1e1e22"
                                                        />
                                                    </svg>
                                                ) : (
                                                    <div className={styles.routeDot} />
                                                )}
                                            </div>
                                            <div className={styles.routeLabel}>{wp.label}</div>
                                            <button
                                                className={styles.routeRemove}
                                                onClick={() => removeWaypoint(index)}
                                            >
                                                ×
                                            </button>
                                            <div className={styles.routeDragHandle}>⠿</div>
                                        </div>
                                        {index < waypoints.length - 1 && (
                                            <div className={styles.routeConnector}>
                                                <div className={styles.routeDots}>⋮</div>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                <p className={styles.panelHint} style={{ marginTop: "8px" }}>
                                    Click more POIs or pings to add to path
                                </p>
                                <div className={styles.routeActions}>
                                    <button className={styles.letsGoBtn} onClick={computeRoute}>
                                        Let's go
                                    </button>
                                </div>
                            </div>
                        )}

                    {directionsStep === "computing" && (
                        <div className={styles.computingState}>
                            <div className={styles.spinner} />
                            <span className={styles.panelHint}>Computing best path...</span>
                        </div>
                    )}

                    {directionsStep === "active" && (
                        <div className={styles.routeList}>
                            <div className={styles.routeItem}>
                                <div className={styles.routeIcon}>
                                    <div className={styles.routeDot} />
                                </div>
                                <div className={styles.routeLabel}>Rover</div>
                            </div>
                            {waypoints.map((wp, index) => (
                                <div key={wp.id}>
                                    <div className={styles.routeConnector}>
                                        <div className={styles.routeDots}>⋮</div>
                                        <span className={styles.segmentDistance}>
                                            {segmentDistances[index] ?? 0}m
                                        </span>
                                    </div>
                                    <div className={styles.routeItem}>
                                        <div className={styles.routeIcon}>
                                            {index === waypoints.length - 1 ? (
                                                <svg
                                                    width="14"
                                                    height="14"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                >
                                                    <path
                                                        d="M12 21c0 0-7-7.5-7-12a7 7 0 1 1 14 0c0 4.5-7 12-7 12z"
                                                        fill="#e74c3c"
                                                        stroke="#1e1e22"
                                                        strokeWidth="1"
                                                    />
                                                    <circle cx="12" cy="9" r="2.5" fill="#1e1e22" />
                                                </svg>
                                            ) : (
                                                <div className={styles.routeDot} />
                                            )}
                                        </div>
                                        <div className={styles.routeLabel}>{wp.label}</div>
                                    </div>
                                </div>
                            ))}

                            <div className={styles.totalDistance}>
                                Total: {segmentDistances.reduce((a, b) => a + b, 0)}m
                            </div>

                            <button
                                className={styles.finishBtn}
                                onClick={cancelDirections}
                                style={{ marginTop: "8px" }}
                            >
                                End Navigation
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ── Autonomous LTV Panel (top-left) ── */}
            {mode === "autonomousLTV" && (
                <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <circle
                                cx="11"
                                cy="11"
                                r="7"
                                stroke="#6ee7b7"
                                strokeWidth="2"
                                fill="none"
                            />
                            <line
                                x1="16.5"
                                y1="16.5"
                                x2="21"
                                y2="21"
                                stroke="#6ee7b7"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                            />
                            <path
                                d="M11 8a3 3 0 0 1 3 3"
                                stroke="#6ee7b7"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                            />
                        </svg>
                        <span className={styles.panelTitle}>Autonomous LTV Search</span>
                        <button className={styles.panelClose} onClick={cancelAutonomousLTV}>
                            ×
                        </button>
                    </div>

                    <div className={styles.poiForm}>
                        <button className={styles.finishBtn} onClick={handleLaunchAutonomy}>
                            Start Autonomous Navigation
                        </button>
                    </div>
                </div>
            )}

            {/* ── Manual mode confirmation overlay ── */}
            {showManualConfirm && (
                <div className={styles.confirmOverlay}>
                    <div className={styles.confirmBox}>
                        <p className={styles.confirmText}>
                            Are you sure? This will stop autonomous navigation.
                        </p>
                        <div className={styles.confirmActions}>
                            <button
                                className={styles.confirmCancelBtn}
                                onClick={() => setShowManualConfirm(false)}
                            >
                                Cancel
                            </button>
                            <button className={styles.confirmStopBtn} onClick={confirmStopAutonomy}>
                                Stop Autonomy
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── All top-left panels (stacked) ── */}
            {(isAutonomous ||
                isSignaling ||
                showPanel ||
                showDetailsPanel ||
                headlightNotice ||
                criticalAlert) && (
                <div className={styles.panelStack}>
                    {/* Critical alert panel */}
                    {criticalAlert && (
                        <div
                            className={styles.panel}
                            style={{ position: "relative", borderLeft: "3px solid #e74c3c" }}
                        >
                            <div className={styles.panelHeader}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <polygon
                                        points="12,2 22,20 2,20"
                                        stroke="#e74c3c"
                                        strokeWidth="2"
                                        fill="none"
                                    />
                                    <line
                                        x1="12"
                                        y1="9"
                                        x2="12"
                                        y2="14"
                                        stroke="#e74c3c"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                    />
                                    <circle cx="12" cy="17" r="1" fill="#e74c3c" />
                                </svg>
                                <span className={styles.panelTitle} style={{ color: "#e74c3c" }}>
                                    Autonomous Navigation Stopped
                                </span>
                            </div>
                            <div style={{ padding: "0 12px 10px" }}>
                                <span
                                    className={styles.autoValue}
                                    style={{ color: "#ccc", fontSize: "12px" }}
                                >
                                    {criticalAlert}
                                </span>
                                <p style={{ color: "#888", fontSize: "11px", margin: "6px 0 0" }}>
                                    Control has been returned to the user.
                                </p>
                            </div>
                        </div>
                    )}

                    {isAutonomous && mode !== "autonomousLTV" && navState?.session && (
                        <div className={styles.panel} style={{ position: "relative" }}>
                            <div className={styles.panelHeader}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <circle
                                        cx="11"
                                        cy="11"
                                        r="7"
                                        stroke="#6ee7b7"
                                        strokeWidth="2"
                                        fill="none"
                                    />
                                    <line
                                        x1="16.5"
                                        y1="16.5"
                                        x2="21"
                                        y2="21"
                                        stroke="#6ee7b7"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <span className={styles.panelTitle}>Autonomous Navigation</span>
                                <button
                                    className={styles.panelClose}
                                    onClick={handleManualModeRequest}
                                >
                                    ×
                                </button>
                            </div>

                            <div className={styles.autoStatusBody}>
                                <div className={styles.autoPhaseRow}>
                                    <span className={styles.autoLabel}>Phase</span>
                                    <span className={styles.autoPhaseBadge}>
                                        {navState.session.phase.replace(/_/g, " ")}
                                    </span>
                                </div>

                                {navState.session.current_target && (
                                    <div className={styles.autoTargetBox}>
                                        <span className={styles.autoLabel}>Current Target</span>
                                        <span className={styles.autoTargetDesc}>
                                            {navState.session.current_target.description}
                                        </span>
                                    </div>
                                )}

                                {navState.status_message && (
                                    <div className={styles.autoPhaseRow}>
                                        <span className={styles.autoLabel}>Status</span>
                                        <span
                                            className={styles.autoValue}
                                            style={{
                                                color:
                                                    navState.status_level === "critical"
                                                        ? "#e74c3c"
                                                        : navState.status_level === "warning"
                                                          ? "#fbbf24"
                                                          : navState.status_level === "success"
                                                            ? "#6ee7b7"
                                                            : "#ccc",
                                            }}
                                        >
                                            {navState.status_message}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <button
                                className={styles.stopAutonomyBtn}
                                onClick={handleManualModeRequest}
                            >
                                Stop Autonomous Navigation
                            </button>
                        </div>
                    )}

                    {isSignaling && (
                        <div className={styles.panel} style={{ position: "relative" }}>
                            <div className={styles.panelHeader}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <circle
                                        cx="12"
                                        cy="12"
                                        r="2.5"
                                        fill={
                                            signalStatus === "failed" ||
                                            signalStatus === "not in range"
                                                ? "#e74c3c"
                                                : "#6ee7b7"
                                        }
                                    />
                                    <path
                                        d="M8.5 15.5A5 5 0 0 1 8.5 8.5"
                                        stroke={
                                            signalStatus === "failed" ||
                                            signalStatus === "not in range"
                                                ? "#e74c3c"
                                                : "#6ee7b7"
                                        }
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                    />
                                    <path
                                        d="M15.5 8.5A5 5 0 0 1 15.5 15.5"
                                        stroke={
                                            signalStatus === "failed" ||
                                            signalStatus === "not in range"
                                                ? "#e74c3c"
                                                : "#6ee7b7"
                                        }
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                    />
                                    <path
                                        d="M5.5 18.5A10 10 0 0 1 5.5 5.5"
                                        stroke={
                                            signalStatus === "failed" ||
                                            signalStatus === "not in range"
                                                ? "#e74c3c"
                                                : "#6ee7b7"
                                        }
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                    />
                                    <path
                                        d="M18.5 5.5A10 10 0 0 1 18.5 18.5"
                                        stroke={
                                            signalStatus === "failed" ||
                                            signalStatus === "not in range"
                                                ? "#e74c3c"
                                                : "#6ee7b7"
                                        }
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <span className={styles.panelTitle}>
                                    {signalStatus === "pending"
                                        ? "Signaling LTV"
                                        : signalStatus === "success"
                                          ? "Signal Success"
                                          : signalStatus === "failed"
                                            ? "Signal Failed"
                                            : "Signal Not In Range"}
                                </span>
                            </div>
                            {signalStatus === "success" && lastManualPing && (
                                <div style={{ padding: "0 12px 8px" }}>
                                    <span
                                        className={styles.autoValue}
                                        style={{ color: "#6ee7b7", fontSize: "12px" }}
                                    >
                                        RSSI: {Math.round(lastManualPing.rssi_value)} dBm ·{" "}
                                        {lastManualPing.category}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Headlight notification */}
                    {headlightNotice && (
                        <div className={styles.panel} style={{ position: "relative" }}>
                            <div className={styles.panelHeader}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <circle
                                        cx="12"
                                        cy="12"
                                        r="4"
                                        fill={headlightNotice === "on" ? "#6ee7b7" : "#888"}
                                    />
                                    {headlightNotice === "on" && (
                                        <>
                                            <line
                                                x1="12"
                                                y1="2"
                                                x2="12"
                                                y2="5"
                                                stroke="#6ee7b7"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                            />
                                            <line
                                                x1="12"
                                                y1="19"
                                                x2="12"
                                                y2="22"
                                                stroke="#6ee7b7"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                            />
                                            <line
                                                x1="2"
                                                y1="12"
                                                x2="5"
                                                y2="12"
                                                stroke="#6ee7b7"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                            />
                                            <line
                                                x1="19"
                                                y1="12"
                                                x2="22"
                                                y2="12"
                                                stroke="#6ee7b7"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                            />
                                        </>
                                    )}
                                </svg>
                                <span className={styles.panelTitle}>
                                    {headlightNotice === "on" ? "Headlights On" : "Headlights Off"}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Plot Hazard / Add POI Panel */}
                    {showPanel && (
                        <div className={styles.panel} style={{ position: "relative" }}>
                            <div className={styles.panelHeader}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    {mode === "plotHazard" ? (
                                        <polygon
                                            points="12,2 22,20 2,20"
                                            stroke="#6ee7b7"
                                            strokeWidth="2"
                                            fill="none"
                                            strokeDasharray="3 2"
                                        />
                                    ) : (
                                        <>
                                            <circle cx="12" cy="12" r="3" fill="#6ee7b7" />
                                            <circle
                                                cx="12"
                                                cy="12"
                                                r="9"
                                                stroke="#6ee7b7"
                                                strokeWidth="2"
                                                fill="none"
                                            />
                                        </>
                                    )}
                                </svg>
                                <span className={styles.panelTitle}>
                                    {mode === "plotHazard" ? "Plot a Hazard" : "Add POI"}
                                </span>
                                <button
                                    className={styles.panelClose}
                                    onClick={() => {
                                        if (mode === "addPOI" && pendingPOI) {
                                            cancelPOI();
                                        } else {
                                            cancelAll();
                                        }
                                    }}
                                >
                                    ×
                                </button>
                            </div>

                            {mode === "plotHazard" && activeHazard && (
                                <>
                                    <span className={styles.pointCount}>
                                        {activeHazard.points.length} point
                                        {activeHazard.points.length !== 1 ? "s" : ""} placed
                                    </span>
                                    <div className={styles.panelActions}>
                                        <button className={styles.undoBtn} onClick={undoLastPoint}>
                                            Undo
                                        </button>
                                        {activeHazard.points.length >= 2 && (
                                            <button
                                                className={styles.doneBtn}
                                                onClick={finishPlotting}
                                            >
                                                ✓ Done
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}

                            {mode === "plotHazard" && !activeHazard && (
                                <p className={styles.panelHint}>Click on the map to place points</p>
                            )}

                            {mode === "addPOI" && poiStep === "placing" && (
                                <div>
                                    <p className={styles.panelHint}>
                                        {pendingPOI
                                            ? "Confirm location or edit coordinates"
                                            : "Click on the map to place a POI"}
                                    </p>
                                    {!pendingPOI && (
                                        <p
                                            className={styles.panelHint}
                                            style={{ opacity: 0.5, margin: "4px 0" }}
                                        >
                                            — or enter coordinates —
                                        </p>
                                    )}
                                    <div className={styles.poiForm}>
                                        <input
                                            ref={coordXInputRef}
                                            type="number"
                                            className={styles.poiInput}
                                            value={poiCoordX}
                                            onChange={(e) => setPoiCoordX(e.target.value)}
                                            placeholder="X coordinate"
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    placePOIFromCoords();
                                                }
                                            }}
                                        />
                                        <input
                                            type="number"
                                            className={styles.poiInput}
                                            value={poiCoordY}
                                            onChange={(e) => setPoiCoordY(e.target.value)}
                                            placeholder="Y coordinate"
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    placePOIFromCoords();
                                                }
                                            }}
                                        />
                                        <button
                                            className={styles.doneBtn}
                                            onClick={placePOIFromCoords}
                                            disabled={!poiCoordX || !poiCoordY}
                                            style={{ opacity: !poiCoordX || !poiCoordY ? 0.4 : 1 }}
                                        >
                                            {pendingPOI ? "Confirm" : "Place POI"}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {mode === "addPOI" && poiStep === "naming" && pendingPOI && (
                                <div className={styles.poiForm}>
                                    <label className={styles.poiLabel}>Name</label>
                                    <input
                                        type="text"
                                        className={styles.poiInput}
                                        value={poiName}
                                        onChange={(e) => setPoiName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                confirmPOIName();
                                            }
                                        }}
                                        autoFocus
                                        placeholder="POI name..."
                                    />
                                    <button className={styles.doneBtn} onClick={confirmPOIName}>
                                        Next
                                    </button>
                                </div>
                            )}

                            {mode === "addPOI" && poiStep === "describing" && pendingPOI && (
                                <div className={styles.poiForm}>
                                    <label className={styles.poiLabel}>Description</label>
                                    <textarea
                                        className={styles.poiTextarea}
                                        value={poiDescription}
                                        onChange={(e) => setPoiDescription(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                confirmPOIDescription();
                                            }
                                        }}
                                        autoFocus
                                        placeholder="Description (optional)..."
                                        rows={3}
                                    />
                                    <button
                                        className={styles.doneBtn}
                                        onClick={confirmPOIDescription}
                                    >
                                        ✓ Add POI
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Add Details Panel */}
                    {showDetailsPanel && (
                        <div className={styles.panel} style={{ position: "relative" }}>
                            <div className={styles.panelHeader}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <polygon
                                        points="12,2 22,20 2,20"
                                        stroke="#ff8a75"
                                        strokeWidth="2"
                                        fill="none"
                                    />
                                </svg>
                                <span className={styles.panelTitle}>Add Details</span>
                                <button className={styles.panelClose} onClick={cancelAll}>
                                    ×
                                </button>
                            </div>

                            <div className={styles.detailsBody}>
                                <span className={styles.detailsLabel}>Hazard Type</span>
                                <div className={styles.typeChips}>
                                    {(["regolith", "debris", "crater"] as HazardType[]).map(
                                        (type) => (
                                            <button
                                                key={type}
                                                className={`${styles.typeChip} ${
                                                    selectedTypes.includes(type)
                                                        ? styles.typeChipSelected
                                                        : ""
                                                }`}
                                                onClick={() => toggleHazardType(type)}
                                            >
                                                {type.charAt(0).toUpperCase() + type.slice(1)}
                                            </button>
                                        ),
                                    )}
                                </div>
                            </div>

                            <button className={styles.finishBtn} onClick={finishHazard}>
                                Finish
                            </button>
                        </div>
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
                    } ${mode === "directions" ? styles.fabActiveDirections : ""} ${
                        mode === "autonomousLTV" ? styles.fabActiveDirections : ""
                    }`}
                    onClick={() => {
                        if (mode === "navigate") {
                            setShowAddMenu(!showAddMenu);
                        }
                    }}
                >
                    {mode === "navigate" && (
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
                    {mode === "directions" && (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <path
                                d="M3 12h4l3-9 4 18 3-9h4"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="none"
                                strokeLinejoin="round"
                                strokeLinecap="round"
                            />
                        </svg>
                    )}
                    {mode === "autonomousLTV" && (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
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
                    )}
                </button>

                {/* Directions button */}
                <button
                    className={`${styles.fabSecondary} ${mode === "directions" ? styles.fabSecondaryActive : ""}`}
                    onClick={() => {
                        if (!isAutonomous && mode !== "directions") {
                            handleStartDirections();
                        }
                    }}
                    style={{
                        opacity: isAutonomous ? 0.4 : undefined,
                        cursor: isAutonomous ? "not-allowed" : undefined,
                    }}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2L4.5 20.3l.7.7L12 18l6.8 3 .7-.7z" fill="currentColor" />
                    </svg>
                </button>

                {/* Autonomous LTV button */}
                <button
                    className={`${styles.fabSecondary} ${
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
                </button>

                {/* Zoom in / out buttons */}
                <button className={styles.fabSecondary} onClick={() => zoomBy(1)} title="Zoom in">
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
                <button className={styles.fabSecondary} onClick={() => zoomBy(-1)} title="Zoom out">
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

                {/* Search area donut */}
                {savedSearchArea &&
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
                {navState?.session?.path_history && navState.session.path_history.length >= 2 && (
                    <polyline
                        points={navState.session.path_history
                            .map((p) => `${p.x},${-p.y}`)
                            .join(" ")}
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
                    return (
                        <g
                            key={`ping-${i}`}
                            onMouseEnter={() => setHoveredPingIndex(i)}
                            onMouseLeave={() => setHoveredPingIndex(null)}
                            style={{ cursor: "default" }}
                        >
                            <circle
                                cx={ping.rover_position.x}
                                cy={-ping.rover_position.y}
                                r="8"
                                fill="transparent"
                                stroke={color}
                                strokeWidth="2"
                                opacity="0.6"
                            />
                            <circle
                                cx={ping.rover_position.x}
                                cy={-ping.rover_position.y}
                                r="3"
                                fill={color}
                                opacity="0.8"
                            />
                            <text
                                x={ping.rover_position.x}
                                y={-ping.rover_position.y - 14}
                                textAnchor="middle"
                                fill={color}
                                fontSize="8"
                                opacity="0.7"
                            >
                                {Math.round(ping.rssi)}dBm
                            </text>
                            {hoveredPingIndex === i &&
                                (() => {
                                    const rangeByCategory: Record<string, [number, number]> = {
                                        strong: [0, 50],
                                        moderate: [50, 200],
                                        weak: [200, 500],
                                        very_weak: [500, 1000],
                                    };
                                    const [rMin, rMax] = rangeByCategory[ping.signal_category] ?? [
                                        0, 0,
                                    ];
                                    const ts = ping.timestamp
                                        ? new Date(ping.timestamp).toLocaleTimeString([], {
                                              hour: "2-digit",
                                              minute: "2-digit",
                                              second: "2-digit",
                                          })
                                        : "—";
                                    const px = ping.rover_position.x;
                                    const py = -ping.rover_position.y;
                                    const tw = 180;
                                    const lineH = 17;
                                    const th = lineH * 3 + 14;
                                    const tx = px - tw / 2;
                                    const ty = py - 36 - th;
                                    return (
                                        <g>
                                            {/* Range donuts */}
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
                {isAutonomous && navState?.session?.current_target && (
                    <g>
                        <circle
                            cx={navState.session.current_target.position.x}
                            cy={-navState.session.current_target.position.y}
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
                        <circle
                            cx={navState.session.current_target.position.x}
                            cy={-navState.session.current_target.position.y}
                            r="3"
                            fill="#6ee7b7"
                        />
                        <text
                            x={navState.session.current_target.position.x}
                            y={-navState.session.current_target.position.y + 20}
                            textAnchor="middle"
                            fill="#6ee7b7"
                            fontSize="9"
                            opacity="0.8"
                        >
                            {navState.session.current_target.description}
                        </text>
                    </g>
                )}

                {/* Route path */}
                {routePath.length >= 2 && (
                    <g>
                        {routePath.map((p, i) => {
                            if (i === 0) return null;
                            return (
                                <line
                                    key={`route-${i}`}
                                    x1={routePath[i - 1].x}
                                    y1={-routePath[i - 1].y}
                                    x2={p.x}
                                    y2={-p.y}
                                    stroke="#6ee7b7"
                                    strokeWidth="2.5"
                                    strokeDasharray="10 6"
                                    opacity="0.8"
                                />
                            );
                        })}
                        {routePath.map((p, i) => (
                            <circle
                                key={`route-dot-${i}`}
                                cx={p.x}
                                cy={-p.y}
                                r="4"
                                fill="#6ee7b7"
                                stroke="#1e1e22"
                                strokeWidth="1.5"
                            />
                        ))}
                    </g>
                )}

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

                {/* Directions mode — invisible hit areas over POIs and pings for reliable clicking */}
                {mode === "directions" &&
                    (directionsStep === "selectDestination" || directionsStep === "review") && (
                        <g>
                            {points.map((p) => (
                                <circle
                                    key={`hit-${p.id}`}
                                    cx={p.x}
                                    cy={-p.y - 13}
                                    r={Math.max(20, viewBox.w * 0.025)}
                                    fill="transparent"
                                    style={{ cursor: "pointer" }}
                                />
                            ))}
                            {savedPingHistory.map((ping, i) => (
                                <circle
                                    key={`hit-ping-${i}`}
                                    cx={ping.rover_position.x}
                                    cy={-ping.rover_position.y}
                                    r={Math.max(15, viewBox.w * 0.02)}
                                    fill="transparent"
                                    style={{ cursor: "pointer" }}
                                />
                            ))}
                        </g>
                    )}

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

            {/* ── Virtual Joystick (bottom-left) ── */}
            {!isAutonomous && (
                <div className={styles.joystickArea}>
                    <VirtualJoystick />
                </div>
            )}

            {/* ── All Assets panel (top-right) ── */}
            <div className={styles.assetsPanel}>
                <div
                    className={styles.assetsPanelHeader}
                    onClick={() => setAssetsExpanded((v) => !v)}
                >
                    <span className={styles.assetsPanelTitle}>All Assets</span>
                    <span
                        className={`${styles.assetsChevron} ${assetsExpanded ? styles.assetsChevronOpen : ""}`}
                    >
                        ▼
                    </span>
                </div>

                {assetsExpanded && (
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
                                    <span classsName={styles.assetCoords}>
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
        </div>
    );
}
