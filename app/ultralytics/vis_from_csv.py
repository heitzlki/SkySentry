import cv2
import math
import numpy as np
import pandas as pd
from pathlib import Path
from collections import defaultdict, deque

"""
Visualize tracked objects from CSV side-by-side with video:
[Video frame] | [2D top-down map]

Major changes vs. your previous script:
- Removed the 3D panel entirely — only video + top‑down map are rendered.
- Guaranteed cleanup of "old" trajectories:
    * Trails are drawn only for currently visible objects (ACTIVE_ONLY=True),
      and we also prune any trail whose object hasn’t appeared within STALE_TTL frames.
- Same greyed-out raw trails + colored smoothed (rolling-mean) line per object.
- Light refactor + comments for clarity.

Requirements: pip install opencv-python pandas numpy
"""

# ---------------- Config ----------------
VIDEO_PATH = "test_videos/test_video21.mp4"
CSV_PATH   = "out_yoloe_prompt_track_persist_v2/detections.csv"
OUT_PATH   = "out_yoloe_prompt_track_persist_v2/viz_video_topdown.mp4"

SHOW_WINDOW     = True
WRITE_VIDEO     = True
TRAIL_LEN       = 60       # number of points kept per trail (world coords)
MEAN_WIN        = 10       # rolling average window for the smoothed line
ACTIVE_ONLY     = True     # draw trails only for objects detected in the current frame
STALE_TTL       = 30       # frames; prune trails if object absent for > this many frames

# Drawing
FONT            = cv2.FONT_HERSHEY_SIMPLEX
TRAIL_THICK     = 1
MEAN_THICK      = 3
POINT_RADIUS    = 6

# Colors (BGR)
BG_COLOR        = (18, 18, 18)
GRID_COLOR      = (30, 30, 30)
HEADER_BG       = (0, 0, 0)
HEADER_FG       = (255, 255, 255)
LABEL_SHADOW    = (10, 10, 10)
LABEL_FG        = (255, 255, 255)
TRAIL_GREY      = (160, 160, 160)  # greyed-out trail color

# 2D map padding (meters around min/max extents)
MAP_PAD         = 0.5

DISPLAY_SCALE   = 0.6
# -----------------------------------------------------------------------------

def color_for_id(gid: int):
    return (
        60 + (37 * (gid + 1)) % 195,
        60 + (91 * (gid + 1)) % 195,
        60 + (13 * (gid + 1)) % 195,
    )

# ---------------- Data loading ----------------

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
    df = df.dropna(subset=["frame","global_id","Xw","Yw","Zw"])  # keep only rows with world coords

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

# ---------------- Helpers ----------------

def rolling_mean(points, win):
    """Compute rolling-average polyline.
    points: list of tuples (x,y[,z]) in world coords.
    Returns a list of same-dimension tuples of smoothed points.
    """
    if not points:
        return []

    pts = np.array(points, dtype=np.float32)  # shape (N, D)
    N, D = pts.shape
    out = []
    for i in range(N):
        k = min(win, i + 1)
        seg = pts[i - k + 1:i + 1]
        m = seg.mean(axis=0)
        out.append(tuple(m.tolist()))
    return out

# ---------------- Rendering ----------------

def render_topdown_panel(panel_size, objects, trails, bounds, active_gids):
    """Draw top-down X-Y map with grey trails and colored mean lines + labels (Z ignored).
    - If ACTIVE_ONLY is True, only draw trails for active_gids (present in this frame).
    - Otherwise, draw trails for any gid present in trails dict.
    """
    H = W = panel_size
    img = np.full((H, W, 3), BG_COLOR, np.uint8)

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
        cv2.line(img, (xg, 0), (xg, H-1), GRID_COLOR, 1)
        cv2.line(img, (0, yg), (W-1, yg), GRID_COLOR, 1)

    # Which gids to draw
    gids_to_draw = set(active_gids) if ACTIVE_ONLY else set(trails.keys())

    # trails (raw) — greyed out
    for gid in sorted(gids_to_draw):
        q = trails.get(gid)
        if not q or len(q) < 2:
            continue
        for i in range(1, len(q)):
            u1,v1 = world_to_px(q[i-1][0], q[i-1][1])
            u2,v2 = world_to_px(q[i][0],   q[i][1])
            cv2.line(img, (u1,v1), (u2,v2), TRAIL_GREY, TRAIL_THICK, cv2.LINE_AA)

        # mean / smoothed line — in object color
        mean_xy = [(p[0], p[1]) for p in rolling_mean(list(q), MEAN_WIN)]
        if len(mean_xy) >= 2:
            col = color_for_id(gid)
            for i in range(1, len(mean_xy)):
                u1,v1 = world_to_px(mean_xy[i-1][0], mean_xy[i-1][1])
                u2,v2 = world_to_px(mean_xy[i][0],   mean_xy[i][1])
                cv2.line(img, (u1,v1), (u2,v2), col, MEAN_THICK, cv2.LINE_AA)

    # points + labels (colored) — only for current objects
    for o in objects:
        u,v = world_to_px(o["Xw"], o["Yw"])
        col = color_for_id(o["gid"])
        cv2.circle(img, (u,v), POINT_RADIUS, col, -1, cv2.LINE_AA)
        label = f'{o["label"]} id:{o["gid"]}'
        cv2.putText(img, label, (u+8, v-6), FONT, 0.5, LABEL_SHADOW, 2, cv2.LINE_AA)
        cv2.putText(img, label, (u+8, v-6), FONT, 0.5, LABEL_FG, 1, cv2.LINE_AA)

    cv2.putText(img, "Top-down (X-Y)", (8, 22), FONT, 0.6, (220,220,220), 1, cv2.LINE_AA)
    return img

# ---------------- Trail maintenance ----------------

def prune_stale_trails(trails, last_seen, current_frame, ttl):
    """Remove any gid whose last_seen is older than ttl frames ago.
    Modifies trails and last_seen in place.
    """
    to_delete = []
    for gid, f in last_seen.items():
        if current_frame - f > ttl:
            to_delete.append(gid)
    for gid in to_delete:
        trails.pop(gid, None)
        last_seen.pop(gid, None)

# ---------------- Main ----------------

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

    PANEL = H  # make map panel square, same height as video
    out_w = W + PANEL
    out_h = H

    # Trails (world coords): gid -> deque[(Xw,Yw,Zw)]
    trails = defaultdict(lambda: deque(maxlen=TRAIL_LEN))
    last_seen_frame = {}  # gid -> last frame index when observed

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
        active_gids = [o["gid"] for o in objs]

        # update trails and last_seen
        for o in objs:
            trails[o["gid"]].append((o["Xw"], o["Yw"], o["Zw"]))
            last_seen_frame[o["gid"]] = frame_idx

        # prune old trails (objects absent for > STALE_TTL frames)
        prune_stale_trails(trails, last_seen_frame, frame_idx, STALE_TTL)

        # render top-down panel
        panel2d = render_topdown_panel(PANEL, objs, trails, bounds, active_gids)

        # compose
        canvas = np.zeros((out_h, out_w, 3), dtype=np.uint8)
        canvas[:, :W] = frame
        canvas[:, W:W+PANEL] = panel2d

        # header strip
        cv2.rectangle(canvas, (0,0), (out_w, 34), HEADER_BG, -1)
        cv2.putText(canvas, f"Frame {frame_idx}", (12, 22), FONT, 0.7, HEADER_FG, 1, cv2.LINE_AA)

        if SHOW_WINDOW:
            # shrink only the on-screen preview
            if DISPLAY_SCALE != 1.0:
                disp = cv2.resize(
                    canvas, None,
                    fx=DISPLAY_SCALE, fy=DISPLAY_SCALE,
                    interpolation=cv2.INTER_AREA
                )
            else:
                disp = canvas
            cv2.imshow("Video | Top-down", disp)
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
