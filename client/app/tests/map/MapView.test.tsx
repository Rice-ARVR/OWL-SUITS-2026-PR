import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import MapViewComponent from "../features/map/MapView";

vi.mock("../features/map/hooks/usePositions", () => ({
    usePositions: () => ({
        positions: {
            rover: { x: 0, y: 0, z: 0 },
            eva: [],
            ltv: { x: 10, y: 10, signal: { strength: 75, ping_requested: 1 } },
            hazards: [],
            waypoints: [],
            recommendedPath: [],
            // FIX 1: ltvSearchRadius is always a number in the mock, never undefined
            ltvSearchRadius: 100,
            bestPath: {
                path: [],
                total_distance: 0,
                available_range: 0,
                can_reach: true,
                warning: null,
            },
            roverHistory: [],
            evaHistory: [[], []],
            ltvHistory: [],
        },
    }),
}));

test("renders map UI panel", () => {
    render(<MapViewComponent />);
    expect(screen.getByText(/Surface Asset Tracker/i)).toBeInTheDocument();
    expect(screen.getByText(/Lost LTV Search/i)).toBeInTheDocument();
});
