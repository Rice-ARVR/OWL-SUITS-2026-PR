export interface Point {
    x: number;
    y: number;
}

export interface MapPoint {
    id: string;
    x: number;
    y: number;
    label: string;
    description: string;
    type: "poi" | "base" | "rover" | "custom";
}

export type HazardType = "regolith" | "debris" | "crater";

export interface Hazard {
    id: string;
    points: Point[];
    closed: boolean;
    types: HazardType[];
}

export type Mode =
    | "navigate"
    | "addPOI"
    | "plotHazard"
    | "hazardDetails"
    | "directions"
    | "autonomousLTV";
export type POIStep = "placing" | "naming" | "describing";
export type DirectionsStep = "selectDestination" | "review" | "computing" | "active";

export interface RoverPosition {
    x: number;
    y: number;
    z: number;
    heading: number; // degrees, 0 = up/north
}

export interface ViewBox {
    x: number;
    y: number;
    w: number;
    h: number;
}
