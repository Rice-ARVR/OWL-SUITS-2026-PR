#!/usr/bin/env python3
"""
DUST Rover LIDAR Visualizer — live mode
Connects to ws://localhost:8000/ws/telemetry and animates sensor readings.
Run while main.py is running:
    python -m app.services.navigation.obstacle_avoidance.lidar_viz
"""

import argparse
import asyncio
import json
import threading
from datetime import datetime

import matplotlib.gridspec as gridspec
import matplotlib.patches as patches
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.animation import FuncAnimation
from matplotlib.lines import Line2D
from mpl_toolkits.mplot3d import Axes3D  # noqa: F401

WS_URL = "ws://localhost:8000/ws/telemetry"
REFRESH_MS = 500  # animation frame interval

# ── Shared state updated by the background WebSocket thread ──────────────────
_sensor_values: np.ndarray = np.full(17, -1.0)
_lock = threading.Lock()
_status = "Connecting…"

POSITIONS = np.array(
    [
        [250, -245, 50],  # 0  front right wheel hub
        [325, -75, 130],  # 1  front right frame
        [325, 0, 130],    # 2  front center frame
        [325, 75, 130],   # 3  front left frame
        [250, 245, 50],   # 4  front left wheel hub
        [325, -75, 130],  # 5  front right frame
        [325, 75, 130],   # 6  front left frame
        [40, -235, 100],  # 7  center right frame
        [40, 235, 100],   # 8  center left frame
        [-215, -215, 70], # 9  rear right wheel hub
        [-320, -50, 10],  # 10 rear right frame
        [-320, 80, 10],   # 11 rear left frame
        [-215, 270, 70],  # 12 rear left wheel hub
        [325, -75, 130],  # 13 front right frame
        [325, 75, 130],   # 14 front left frame
        [250, -245, 50],  # 15 front right wheel hub
        [250, 245, 50],   # 16 front left wheel hub
    ],
    dtype=float,
)


def _yp(yaw_deg: float, pitch_deg: float = 0.0) -> np.ndarray:
    y, p = np.radians(yaw_deg), np.radians(pitch_deg)
    return np.array([np.cos(y) * np.cos(p), np.sin(y) * np.cos(p), -np.sin(p)])


_r = np.radians
DIRECTIONS = np.array(
    [
        _yp(-30),                                        # 0  front right wheel hub — yaw 30° right (CW)
        _yp(-20, 20),                                    # 1  front right frame     — yaw 20° right, pitch 20° down
        _yp(0),                                          # 2  front center          — forward
        _yp(20, 20),                                     # 3  front left frame      — yaw 20° left, pitch 20° down
        _yp(30),                                         # 4  front left wheel hub  — yaw 30° left (CCW)
        _yp(0, 25),                                      # 5  front right frame     — pitch 25° down
        _yp(0, 25),                                      # 6  front left frame      — pitch 25° down
        [0, -np.cos(_r(20)), -np.sin(_r(20))],           # 7  center right          — right, pitch 20° down
        [0,  np.cos(_r(20)), -np.sin(_r(20))],           # 8  center left           — left, pitch 20° down
        [-np.cos(_r(40)), -np.sin(_r(40)), 0],           # 9  rear right wheel hub  — backward, yaw 40° right (CCW)
        [-1, 0, 0],                                      # 10 rear right frame      — backward
        [-1, 0, 0],                                      # 11 rear left frame       — backward
        [-np.cos(_r(40)),  np.sin(_r(40)), 0],           # 12 rear left wheel hub   — backward, yaw 40° left (CW)
        _yp(-20, 10),                                    # 13 front right frame     — yaw 20° right, pitch 10° down
        _yp(20, 10),                                     # 14 front left frame      — yaw 20° left, pitch 10° down
        _yp(-15),                                        # 15 front right wheel hub — yaw 15° right (CW)
        _yp(15),                                         # 16 front left wheel hub  — yaw 15° left (CCW)
    ]
)

MAX_CM = 1000.0
_BG, _FG = "#12121f", "white"

# Sensors whose direction has a forward component (positive X orientation)
FRONT_SENSORS = frozenset({0, 1, 2, 3, 4, 5, 6, 13, 14, 15, 16})

SENSOR_DESCRIPTIONS = {
    0:  ("Front right wheel hub",  "Yaw 30° right (CW)"),
    1:  ("Front right frame",      "Yaw 20° right, pitch 20° down"),
    2:  ("Front center frame",     "Forward"),
    3:  ("Front left frame",       "Yaw 20° left,  pitch 20° down"),
    4:  ("Front left wheel hub",   "Yaw 30° left (CCW)"),
    5:  ("Front right frame",      "Pitch 25° down"),
    6:  ("Front left frame",       "Pitch 25° down"),
    7:  ("Center right frame",     "Right, pitch 20° down"),
    8:  ("Center left frame",      "Left, pitch 20° down"),
    9:  ("Rear right wheel hub",   "Backward, yaw 40° right (CCW)"),
    10: ("Rear right frame",       "Backward"),
    11: ("Rear left frame",        "Backward"),
    12: ("Rear left wheel hub",    "Backward, yaw 40° left (CW)"),
    13: ("Front right frame",      "Yaw 20° right, pitch 10° down"),
    14: ("Front left frame",       "Yaw 20° left,  pitch 10° down"),
    15: ("Front right wheel hub",  "Yaw 15° right (CW)"),
    16: ("Front left wheel hub",   "Yaw 15° left (CCW)"),
}

# Terminal print groups (front → rear within each side, by sensor index)
LEFT_SENSORS   = [4, 3, 6, 14, 16, 8, 12, 11]
CENTER_SENSORS = [2]
RIGHT_SENSORS  = [0, 1, 5, 13, 15, 7, 9, 10]

# 4 header lines + 3 group-label lines + all 17 sensor rows
_PRINT_LINES = 4 + 3 + 17


def _ray_endpoints(values: np.ndarray) -> np.ndarray:
    lengths = np.where(values < 0, MAX_CM, np.clip(values, 0, MAX_CM))
    return POSITIONS + DIRECTIONS * lengths[:, None]


def _box_edges():
    xs, ys, zs = [-320, 325], [-180, 180], [0, 150]
    c = np.array([[x, y, z] for x in xs for y in ys for z in zs])
    pairs = [(0,1),(0,2),(0,4),(1,3),(1,5),(2,3),(2,6),(3,7),(4,5),(4,6),(5,7),(6,7)]
    return [(c[a], c[b]) for a, b in pairs]


def _style_2d(ax, title, xl, yl):
    ax.set_facecolor("#0a0a18")
    ax.tick_params(colors=_FG, labelsize=7)
    ax.set_xlabel(xl, color=_FG, fontsize=8)
    ax.set_ylabel(yl, color=_FG, fontsize=8)
    ax.set_title(title, color=_FG, fontsize=9, pad=5)
    ax.grid(True, alpha=0.12, color="white", linewidth=0.5)
    for sp in ax.spines.values():
        sp.set_edgecolor("#444455")


def _draw_frame(values: np.ndarray, fig, ax3, axXY, axXZ, axYZ, sensor_mask: frozenset = frozenset(range(17))) -> None:
    ends = _ray_endpoints(values)

    ax3.cla()
    axXY.cla()
    axXZ.cla()
    axYZ.cla()

    # 3D styling
    ax3.set_facecolor("#0a0a18")
    for pane in (ax3.xaxis.pane, ax3.yaxis.pane, ax3.zaxis.pane):
        pane.fill = False
        pane.set_edgecolor("#2a2a4a")
    ax3.tick_params(colors=_FG, labelsize=6)
    ax3.set_xlabel("X fwd (cm)", color=_FG, fontsize=7, labelpad=2)
    ax3.set_ylabel("Y left (cm)", color=_FG, fontsize=7, labelpad=2)
    ax3.set_zlabel("Z up (cm)", color=_FG, fontsize=7, labelpad=2)
    ax3.set_title("3D View", color=_FG, fontsize=9, pad=6)

    _style_2d(axXY, "Top View (XY)", "X forward (cm)", "Y left (cm)")
    _style_2d(axXZ, "Side View (XZ)", "X forward (cm)", "Z up (cm)")
    _style_2d(axYZ, "Front / Rear View (YZ)", "Y left (cm)", "Z up (cm)")

    # Rover body wireframe
    box_kw = dict(color="#7777aa", alpha=0.30, linewidth=0.8, linestyle="--")
    for a, b in _box_edges():
        ax3.plot(*zip(a, b), **{**box_kw, "zorder": 1})

    fp = np.array([[-320,-180],[325,-180],[325,180],[-320,180],[-320,-180]])
    axXY.plot(fp[:,0], fp[:,1], **box_kw)
    for wx, wy in [(250,245),(250,-245),(-215,270),(-215,-215)]:
        axXY.add_patch(patches.Circle((wx,wy), 45, fill=False, color="#7777aa", alpha=0.3, lw=0.7))
    axXY.annotate("▶ FWD", xy=(340,0), color="#ffcc44", fontsize=8, va="center", ha="left", alpha=0.8)

    axXZ.plot([-320,325,325,-320,-320],[0,0,150,150,0], **box_kw)
    axYZ.plot([-245,245,245,-245,-245],[0,0,150,150,0], **box_kw)

    # Sensor rays
    for i in sensor_mask:
        p, e = POSITIONS[i], ends[i]
        hit = values[i] >= 0
        col = "#00ee77" if hit else "#2266ff"
        alpha = 0.90 if hit else 0.38

        ax3.plot([p[0],e[0]],[p[1],e[1]],[p[2],e[2]], color=col, alpha=alpha, lw=1.5, zorder=3)
        ax3.scatter(*p, color="#ff9900", s=18, zorder=5, depthshade=False)
        if hit:
            ax3.scatter(*e, color="#ff3333", s=12, zorder=5, depthshade=False)
        ax3.text(e[0],e[1],e[2], str(i), color="#ffff99", fontsize=6, ha="center", va="bottom", zorder=6)

        axXY.plot([p[0],e[0]],[p[1],e[1]], color=col, alpha=alpha, lw=1.2)
        axXY.scatter(p[0],p[1], color="#ff9900", s=16, zorder=5)
        if hit:
            axXY.scatter(e[0],e[1], color="#ff3333", s=10, zorder=5)
        d2 = DIRECTIONS[i,:2]
        nm = np.linalg.norm(d2)
        off = (d2/nm*60) if nm > 0.05 else np.array([0.0,10.0])
        axXY.text(p[0]+off[0],p[1]+off[1], str(i), color="#ffff99", fontsize=6, ha="center", va="center", zorder=6)

        axXZ.plot([p[0],e[0]],[p[2],e[2]], color=col, alpha=alpha, lw=1.2)
        axXZ.scatter(p[0],p[2], color="#ff9900", s=16, zorder=5)
        if hit:
            axXZ.scatter(e[0],e[2], color="#ff3333", s=10, zorder=5)
        axXZ.text(e[0],e[2], str(i), color="#ffff99", fontsize=6, ha="center", va="bottom", zorder=6)

        axYZ.plot([p[1],e[1]],[p[2],e[2]], color=col, alpha=alpha, lw=1.2)
        axYZ.scatter(p[1],p[2], color="#ff9900", s=16, zorder=5)
        if hit:
            axYZ.scatter(e[1],e[2], color="#ff3333", s=10, zorder=5)
        axYZ.text(e[1],e[2], str(i), color="#ffff99", fontsize=6, ha="center", va="bottom", zorder=6)

    for ax in (axXY, axXZ, axYZ):
        ax.set_aspect("equal", adjustable="datalim")

    legend_elems = [
        Line2D([0],[0], color="#00ee77", lw=2, label="Hit — returns distance"),
        Line2D([0],[0], color="#2266ff", lw=2, alpha=0.5, label="No hit — full 10 m shown"),
        Line2D([0],[0], marker="o", color="w", mfc="#ff9900", ms=7, lw=0, label="Sensor origin"),
        Line2D([0],[0], marker="o", color="w", mfc="#ff3333", ms=6, lw=0, label="Hit point"),
    ]
    fig.legend(
        handles=legend_elems,
        loc="lower center",
        ncol=4,
        fontsize=8,
        facecolor="#1a1a2e",
        edgecolor="#555566",
        labelcolor=_FG,
        bbox_to_anchor=(0.5, 0.0),
    )

    mode = "Front Only" if sensor_mask == FRONT_SENSORS else "All Sensors"
    ts = datetime.now().strftime("%H:%M:%S")
    fig.suptitle(
        f"DUST Rover LIDAR — Live  [{mode}]  [{_status}]  {ts}",
        color=_FG,
        fontsize=14,
        fontweight="bold",
    )


# ── Terminal sensor readout ───────────────────────────────────────────────────

_first_print = True


def _print_sensors(values: np.ndarray) -> None:
    global _first_print
    sep = "─" * 66
    ts  = datetime.now().strftime("%H:%M:%S")

    def rows(indices):
        out = []
        for idx in indices:
            loc, orient = SENSOR_DESCRIPTIONS[idx]
            val = values[idx]
            val_str = f"{val:>6.0f} cm" if val >= 0 else "  no hit"
            out.append(f"  {idx:>3}  {loc:<26}  {orient:<30}  {val_str:>8}")
        return out

    lines = [
        f"DUST Rover LIDAR  [{_status}]  {ts}",
        sep,
        f"  {'Idx':>3}  {'Location':<26}  {'Orientation':<30}  {'Value':>8}",
        sep,
        "  LEFT",
        *rows(LEFT_SENSORS),
        "  CENTER",
        *rows(CENTER_SENSORS),
        "  RIGHT",
        *rows(RIGHT_SENSORS),
    ]

    if not _first_print:
        print(f"\033[{_PRINT_LINES}A", end="")
    _first_print = False

    print("\n".join(lines), flush=True)


# ── WebSocket background thread ───────────────────────────────────────────────

async def _ws_listener() -> None:
    global _sensor_values, _status
    import websockets

    while True:
        try:
            async with websockets.connect(WS_URL) as ws:
                _status = "Connected"
                async for raw in ws:
                    data = json.loads(raw)
                    lidar = data["rover"]["pr_telemetry"]["lidar"]
                    arr = np.array(lidar[:17], dtype=float)
                    with _lock:
                        _sensor_values = arr
                    _print_sensors(arr)
        except Exception as exc:
            _status = f"Reconnecting… ({exc})"
            await asyncio.sleep(2)


def _start_ws_thread() -> None:
    def run():
        asyncio.run(_ws_listener())

    t = threading.Thread(target=run, daemon=True)
    t.start()


# ── Animated visualizer ───────────────────────────────────────────────────────

def visualize(sensor_mask: frozenset = frozenset(range(17))) -> None:
    fig = plt.figure(figsize=(18, 10), facecolor=_BG)
    gs = gridspec.GridSpec(
        3, 2, figure=fig,
        hspace=0.40, wspace=0.22,
        left=0.05, right=0.97, top=0.93, bottom=0.09,
    )

    ax3  = fig.add_subplot(gs[:, 0], projection="3d")
    axXY = fig.add_subplot(gs[0, 1])
    axXZ = fig.add_subplot(gs[1, 1])
    axYZ = fig.add_subplot(gs[2, 1])

    def update(_frame):
        with _lock:
            values = _sensor_values.copy()
        _draw_frame(values, fig, ax3, axXY, axXZ, axYZ, sensor_mask)

    ani = FuncAnimation(fig, update, interval=REFRESH_MS, cache_frame_data=False)  # noqa: F841
    plt.show()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="DUST Rover LIDAR Visualizer")
    parser.add_argument(
        "--front",
        action="store_true",
        help="Only show the 11 forward-facing sensors (indices 0-6, 13-16)",
    )
    parser.add_argument(
        "--viz",
        action="store_true",
        help="Render matplotlib animations (default: print sensor values to terminal only)",
    )
    args = parser.parse_args()

    mask = FRONT_SENSORS if args.front else frozenset(range(17))

    if args.viz:
        _start_ws_thread()
        visualize(mask)
    else:
        asyncio.run(_ws_listener())
