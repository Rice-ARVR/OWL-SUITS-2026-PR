import { type RefObject } from "react";
import styles from "../../InteractiveMap.module.css";
import type { Hazard, Mode, POIStep, MapPoint } from "~/types/map";

interface HazardPOIPanelProps {
    mode: Mode;
    activeHazard: Hazard | null;
    pendingPOI: MapPoint | null;
    poiStep: POIStep;
    poiName: string;
    setPoiName: (v: string) => void;
    poiDescription: string;
    setPoiDescription: (v: string) => void;
    poiCoordX: string;
    setPoiCoordX: (v: string) => void;
    poiCoordY: string;
    setPoiCoordY: (v: string) => void;
    coordXInputRef: RefObject<HTMLInputElement | null>;
    onClose: () => void;
    undoLastPoint: () => void;
    finishPlotting: () => void;
    placePOIFromCoords: () => void;
    confirmPOIName: () => void;
    confirmPOIDescription: () => void;
}

export function HazardPOIPanel({
    mode,
    activeHazard,
    pendingPOI,
    poiStep,
    poiName,
    setPoiName,
    poiDescription,
    setPoiDescription,
    poiCoordX,
    setPoiCoordX,
    poiCoordY,
    setPoiCoordY,
    coordXInputRef,
    onClose,
    undoLastPoint,
    finishPlotting,
    placePOIFromCoords,
    confirmPOIName,
    confirmPOIDescription,
}: HazardPOIPanelProps) {
    return (
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
                <button className={styles.panelClose} onClick={onClose}>
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
                            <button className={styles.doneBtn} onClick={finishPlotting}>
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
                    <button className={styles.doneBtn} onClick={confirmPOIDescription}>
                        ✓ Add POI
                    </button>
                </div>
            )}
        </div>
    );
}
