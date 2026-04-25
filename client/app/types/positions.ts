export interface Position {
    x: number;
    y: number;
    z?: number;
}

export interface Hazard {
    type: string;
    x: number;
    y: number;
    radius?: number;
    size?: number;
}

export interface Waypoint {
    x: number;
    y: number;
    label: string;
}

export interface BestPath {
    path: Position[];
    total_distance: number;
    available_range: number;
    can_reach: boolean;
    warning: string | null;
}

export interface LtvPosition extends Position {
    signal?: {
        strength: number;
        ping_requested: number;
    };
}

export interface Positions {
    rover: Position | null;
    eva: Position[];
    ltv: LtvPosition | null;
    hazards: Hazard[];
    waypoints: Waypoint[];
    recommendedPath: Position[];
    ltvSearchRadius: number;
    bestPath: BestPath;
    roverHistory: Position[];
    evaHistory: Position[][];
    ltvHistory: Position[];
}
