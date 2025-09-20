# viz_from_csv.py
# Visualize tracked objects from CSV side-by-side with video:
# [Video frame] | [3D world view] | [2D top-down map]
#
# Requirements: pip install opencv-python pandas numpy

import cv2
import math
import numpy as np
import pandas as pd
from pathlib import Path
from collections import defaultdict, deque

# ---------------- Config ----------------
VIDEO_PATH = "test_videos/test_video13.mp4"
CSV_PATH   = "out_yoloe_prompt_track_persist_v2/detections.csv"
OUT_PATH   = "out_yoloe_prompt_track_persist_v2/viz_side_by_side.mp4"

SHOW_WINDOW     = True
WRITE_VIDEO     = True
TRAIL_LEN       = 60      # points in trail
FONT            = cv2.FONT_HERSHEY_SIMPLEX

# 3D view (virtual camera) — just for visualization
VIEW_AZIM_DEG   = 35.0    # yaw around Z (turntable)
VIEW_ELEV_DEG   = 25.0    # pitch around X
VIEW_DIST       = 8.0     # perspective distance scalar (bigger = weaker perspective)

# 2D map padding (pixels around min/max extents)
MAP_PAD         = 0.5     # meters of margin


DISPLAY_SCALE   = 0.6
# Panel sizes (the 3D & map panels will be square with height = video height)
# Final composite is [video | 3D | map]
# -------------------------------------------------------------

def color_for_id(gid: int):
    return (
        60 + (37 * (gid + 1)) % 195,
        60 + (91 * (gid + 1)) % 195,
        60 + (13 * (gid + 1)) % 195,
    )

def load_tracks(csv_path: str):
    df = pd.read_csv(csv_path)
    # Ensure columns exist
    needed = {"frame","global_id","label","Xw","Yw","Zw","cx","cy","x1","y1","x2","y2"}
    missing = needed - set(df.columns)
    if missing:
        raise SystemExit(f"CSV missing columns: {missing}")

    # Coerce numeric
    for c in ["frame","global_id","Xw","Yw","Zw"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df = df.dropna(subset=["frame","global_id","Xw","Yw","Zw"])

    # Build per-frame list of detections
    frames = defaultdict(list)
    for _, r in df.iterrows():
        frames[int(r.frame)].append({
            "gid": int(r.global_id),
            "label": str(r.label),
            "Xw": float(r.Xw),
            "Yw": float(r.Yw),
            "Zw": float(r.Zw),
        })

    # World extents for scaling
    if len(df) == 0:
        raise SystemExit("CSV has no rows after filtering.")
    mins = df[["Xw","Yw","Zw"]].min()
    maxs = df[["Xw","Yw","Zw"]].max()
    bounds = {
        "xmin": float(mins["Xw"]), "xmax": float(maxs["Xw"]),
        "ymin": float(mins["Yw"]), "ymax": float(maxs["Yw"]),
        "zmin": float(mins["Zw"]), "zmax": float(maxs["Zw"]),
    }
    return frames, bounds

def rot_x(deg):
    t = math.radians(deg); c, s = math.cos(t), math.sin(t)
    return np.array([[1,0,0],[0,c,-s],[0,s,c]], dtype=np.float32)

def rot_z(deg):
    t = math.radians(deg); c, s = math.cos(t), math.sin(t)
    return np.array([[c,-s,0],[s,c,0],[0,0,1]], dtype=np.float32)

def project_3d_points(points_xyz, panel_w, panel_h, bounds, azim=35, elev=25, dist=8.0):
    """
    Simple 3D renderer: rotate world -> view, then perspective project and scale to panel.
    points_xyz: list of (X,Y,Z) tuples
    Returns list of (u,v) ints in pixels.
    """
    if not points_xyz:
        return []

    # Normalize world to a centered cube for stable view scaling
    xmin, xmax = bounds["xmin"], bounds["xmax"]
    ymin, ymax = bounds["ymin"], bounds["ymax"]
    zmin, zmax = bounds["zmin"], bounds["zmax"]

    cx = 0.5*(xmin+xmax); sx = max(1e-6, (xmax - xmin))
    cy = 0.5*(ymin+ymax); sy = max(1e-6, (ymax - ymin))
    cz = 0.5*(zmin+zmax); sz = max(1e-6, (zmax - zmin))
    s  = max(sx, sy, sz)  # uniform scale

    P = np.array([[ (x-cx)/s, (y-cy)/s, (z-cz)/s ] for (x,y,z) in points_xyz], dtype=np.float32).T  # (3,N)

    # View rotation (Z then X)
    R = rot_x(elev) @ rot_z(azim)
    Pv = R @ P  # (3,N)

    # Perspective (very simple)
    z = Pv[2,:] + dist
    z = np.where(z < 1e-3, 1e-3, z)
    x = (Pv[0,:] / z)
    y = (Pv[1,:] / z)

    # Scale to panel
    # make [-0.6,0.6] → margins; tweak factor for comfortable fit
    scale = 0.85 * min(panel_w, panel_h) / 2.0
    u = (panel_w/2.0 + scale * x).astype(int)
    v = (panel_h/2.0 - scale * y).astype(int)
    return list(zip(u, v))

def render_3d_panel(panel_size, objects, trails, bounds):
    """Draw 3D world view with trails and labels."""
    H = W = panel_size
    img = np.full((H, W, 3), 18, np.uint8)

    # draw grid (optional)
    for t in np.linspace(-0.5, 0.5, 5):
        cv2.line(img, (int(W*(t+0.5)), 0), (int(W*(t+0.5)), H), (30,30,30), 1)
        cv2.line(img, (0, int(H*(t+0.5))), (W, int(H*(t+0.5))), (30,30,30), 1)

    # collect current points
    pts = [(o["Xw"], o["Yw"], o["Zw"]) for o in objects]
    uv = project_3d_points(pts, W, H, bounds, VIEW_AZIM_DEG, VIEW_ELEV_DEG, VIEW_DIST)

    # draw trails first (project each trail polyline)
    for gid, q in trails.items():
        if len(q) < 2: continue
        pts3 = list(q)
        uvt = project_3d_points(pts3, W, H, bounds, VIEW_AZIM_DEG, VIEW_ELEV_DEG, VIEW_DIST)
        col = color_for_id(gid)
        for i in range(1, len(uvt)):
            cv2.line(img, uvt[i-1], uvt[i], col, 2, cv2.LINE_AA)

    # draw points + labels
    for o, (u,v) in zip(objects, uv):
        col = color_for_id(o["gid"])
        cv2.circle(img, (u,v), 5, col, -1, cv2.LINE_AA)
        label = f'{o["label"]} id:{o["gid"]}'
        cv2.putText(img, label, (u+8, v-6), FONT, 0.5, (10,10,10), 2, cv2.LINE_AA)
        cv2.putText(img, label, (u+8, v-6), FONT, 0.5, (255,255,255), 1, cv2.LINE_AA)

    cv2.putText(img, "3D world view", (8, 22), FONT, 0.6, (220,220,220), 1, cv2.LINE_AA)
    return img

def render_topdown_panel(panel_size, objects, trails, bounds):
    """Draw top-down X-Y map with trails and labels (Z ignored for map)."""
    H = W = panel_size
    img = np.full((H, W, 3), 18, np.uint8)

    # Extents with padding
    xmin, xmax = bounds["xmin"], bounds["xmax"]
    ymin, ymax = bounds["ymin"], bounds["ymax"]
    xmin -= MAP_PAD; xmax += MAP_PAD
    ymin -= MAP_PAD; ymax += MAP_PAD

    def world_to_px(x, y):
        # Map X → horizontal, Y → vertical (flip Y for screen)
        u = int((x - xmin) / max(1e-6, (xmax - xmin)) * (W - 1))
        v = int((1.0 - (y - ymin) / max(1e-6, (ymax - ymin))) * (H - 1))
        return u, v

    # grid
    for t in np.linspace(0.0, 1.0, 5):
        xg = int(t*(W-1))
        yg = int(t*(H-1))
        cv2.line(img, (xg, 0), (xg, H-1), (30,30,30), 1)
        cv2.line(img, (0, yg), (W-1, yg), (30,30,30), 1)

    # trails
    for gid, q in trails.items():
        if len(q) < 2: continue
        col = color_for_id(gid)
        for i in range(1, len(q)):
            u1,v1 = world_to_px(q[i-1][0], q[i-1][1])
            u2,v2 = world_to_px(q[i][0],   q[i][1])
            cv2.line(img, (u1,v1), (u2,v2), col, 2, cv2.LINE_AA)

    # points + labels
    for o in objects:
        u,v = world_to_px(o["Xw"], o["Yw"])
        col = color_for_id(o["gid"])
        cv2.circle(img, (u,v), 6, col, -1, cv2.LINE_AA)
        label = f'{o["label"]} id:{o["gid"]}'
        cv2.putText(img, label, (u+8, v-6), FONT, 0.5, (10,10,10), 2, cv2.LINE_AA)
        cv2.putText(img, label, (u+8, v-6), FONT, 0.5, (255,255,255), 1, cv2.LINE_AA)

    cv2.putText(img, "Top-down (X-Y)", (8, 22), FONT, 0.6, (220,220,220), 1, cv2.LINE_AA)
    return img

def main():
    # Load CSV → per-frame detections + bounds
    frames, bounds = load_tracks(CSV_PATH)

    # Open video
    cap = cv2.VideoCapture(VIDEO_PATH)
    if not cap.isOpened():
        raise SystemExit(f"Cannot open video: {VIDEO_PATH}")

    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1280)
    H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 720)
    FPS = cap.get(cv2.CAP_PROP_FPS) or 30.0

    PANEL = H  # make 3D & map square panels, same height as video
    out_w = W + PANEL + PANEL
    out_h = H

    # Trails (world coords): gid -> deque[(Xw,Yw,Zw)]
    trails = defaultdict(lambda: deque(maxlen=TRAIL_LEN))

    writer = None
    if WRITE_VIDEO:
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        Path(OUT_PATH).parent.mkdir(parents=True, exist_ok=True)
        writer = cv2.VideoWriter(str(OUT_PATH), fourcc, FPS, (out_w, out_h))

    frame_idx = -1
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frame_idx += 1

        # current objects for this frame
        objs = frames.get(frame_idx, [])
        # update trails
        for o in objs:
            trails[o["gid"]].append((o["Xw"], o["Yw"], o["Zw"]))

        # render side panels
        panel3d = render_3d_panel(PANEL, objs, trails, bounds)
        panel2d = render_topdown_panel(PANEL, objs, trails, bounds)

        # compose
        canvas = np.zeros((out_h, out_w, 3), dtype=np.uint8)
        canvas[:, :W] = frame
        canvas[:, W:W+PANEL] = panel3d
        canvas[:, W+PANEL:W+2*PANEL] = panel2d

                # header strip
        cv2.rectangle(canvas, (0,0), (out_w, 34), (0,0,0), -1)
        cv2.putText(canvas, f"Frame {frame_idx}", (12, 22), FONT, 0.7, (255,255,255), 1, cv2.LINE_AA)

        if SHOW_WINDOW:
            # ---- NEW: shrink only the on-screen preview ----
            if DISPLAY_SCALE != 1.0:
                disp = cv2.resize(
                    canvas, None,
                    fx=DISPLAY_SCALE, fy=DISPLAY_SCALE,
                    interpolation=cv2.INTER_AREA
                )
            else:
                disp = canvas
            cv2.imshow("Video | 3D | Top-down", disp)
            if cv2.waitKey(1) & 0xFF == 27:
                break


        if writer is not None:
            writer.write(canvas)

    cap.release()
    if writer is not None:
        writer.release()
    cv2.destroyAllWindows()
    print("Done.", "Saved:", OUT_PATH if WRITE_VIDEO else "(no file)")

if __name__ == "__main__":
    main()
