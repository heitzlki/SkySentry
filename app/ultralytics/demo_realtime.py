# demo_realtime_topdown_live.py (fading trails)
# Live: [camera with overlays] | [top-down map] using per-frame JSON (no CSV)
# Trails fade out and disappear based on frame age.

import cv2
import json
import numpy as np
from collections import defaultdict, deque
from yoloe_rt import YoloeRealtime

# ---------------- Config ----------------
CAM_INDEX             = 0
DISPLAY_SCALE         = 0.85
TRAIL_MAX_AGE_FRAMES  = 120   # segments older than this are dropped (~4s at 30 FPS)
TRAIL_CAP_PER_OBJ     = 200   # hard cap per-object (safety)
MAP_PAD               = 0.5
PANEL_MATCH_H         = True

FONT = cv2.FONT_HERSHEY_SIMPLEX
WIN  = "YOLOE • Live | Top-down (fading)"

def color_for_id(gid: int):
    return (
        60 + (37 * (gid + 1)) % 195,
        60 + (91 * (gid + 1)) % 195,
        60 + (13 * (gid + 1)) % 195,
    )

def render_topdown_panel(panel_h, panel_w, objects, trails, bounds, cur_frame):
    """
    Draw top-down X-Y map with fading trails.
    trails: gid -> deque[(Xw, Yw, frame_idx)]
    """
    H, W = panel_h, panel_w
    img = np.full((H, W, 3), 18, np.uint8)

    xmin, xmax = bounds["xmin"], bounds["xmax"]
    ymin, ymax = bounds["ymin"], bounds["ymax"]

    # Avoid degenerate ranges
    if abs(xmax - xmin) < 1e-3:
        cx = 0.5 * (xmin + xmax); xmin, xmax = cx - 0.5, cx + 0.5
    if abs(ymax - ymin) < 1e-3:
        cy = 0.5 * (ymin + ymax); ymin, ymax = cy - 0.5, cy + 0.5

    def world_to_px(x, y):
        u = int((x - xmin) / max(1e-6, (xmax - xmin)) * (W - 1))
        v = int((1.0 - (y - ymin) / max(1e-6, (ymax - ymin))) * (H - 1))
        return u, v

    # background grid
    for t in np.linspace(0.0, 1.0, 5):
        xg = int(t*(W-1)); yg = int(t*(H-1))
        cv2.line(img, (xg, 0), (xg, H-1), (30,30,30), 1)
        cv2.line(img, (0, yg), (W-1, yg), (30,30,30), 1)

    # fade + draw trails (segment-wise)
    # opacity/thickness decay curve
    max_age = max(1, TRAIL_MAX_AGE_FRAMES)
    gamma   = 1.5  # steeper fade for older segments
    for gid, q in trails.items():
        if len(q) < 2:
            continue
        base_col = np.array(color_for_id(gid), dtype=np.float32)

        # walk consecutive pairs
        for i in range(1, len(q)):
            (x1, y1, f1) = q[i-1]
            (x2, y2, f2) = q[i]
            age = cur_frame - f2  # use newer endpoint’s age
            if age < 0 or age > TRAIL_MAX_AGE_FRAMES:
                continue

            # 0 (old) -> 1 (fresh)
            t = 1.0 - (age / max_age)
            t = max(0.0, min(1.0, t)) ** gamma

            # fade color & thickness
            col = (base_col * (0.35 + 0.65 * t)).astype(np.int32)  # keep some visibility when recent
            thick = max(1, int(round(4 * t)))  # 1..4 px

            u1, v1 = world_to_px(x1, y1)
            u2, v2 = world_to_px(x2, y2)
            cv2.line(img, (u1, v1), (u2, v2), tuple(int(c) for c in col.tolist()), thick, cv2.LINE_AA)

    # current positions + labels
    for o in objects:
        u, v = world_to_px(o["Xw"], o["Yw"])
        col = color_for_id(o["gid"])
        cv2.circle(img, (u, v), 6, col, -1, cv2.LINE_AA)
        label = f'{o["label"]} id:{o["gid"]}'
        cv2.putText(img, label, (u+8, v-6), FONT, 0.5, (10,10,10), 2, cv2.LINE_AA)
        cv2.putText(img, label, (u+8, v-6), FONT, 0.5, (255,255,255), 1, cv2.LINE_AA)

    cv2.putText(img, "Top-down (X-Y)", (8, 22), FONT, 0.6, (220,220,220), 1, cv2.LINE_AA)
    return img

def main():
    rt = YoloeRealtime(weights="yoloe-11s-seg.pt", device=0)  # set device=None for CPU

    cap = cv2.VideoCapture(CAM_INDEX)
    if not cap.isOpened():
        raise RuntimeError(f"Failed to open webcam index {CAM_INDEX}")
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    cv2.namedWindow(WIN, cv2.WINDOW_NORMAL)

    # trails: gid -> deque[(Xw, Yw, frame_idx)]
    trails = defaultdict(lambda: deque(maxlen=TRAIL_CAP_PER_OBJ))

    # dynamic bounds
    have_bounds = False
    xmin = ymin = float("inf")
    xmax = ymax = float("-inf")

    # prime
    ok, frame = cap.read()
    if not ok:
        raise RuntimeError("Failed to read from webcam (try a different CAM_INDEX).")
    H, W = frame.shape[:2]
    PANEL_H = H if PANEL_MATCH_H else H
    PANEL_W = H  # square panel
    frame_idx = 0

    while True:
        ok, frame = cap.read()
        if not ok:
            break

        json_list, vis = rt.process_frame(frame, return_vis=True)
        if vis is None:
            vis = frame

        # gather objs + update trails/bounds
        objs = []
        for obj in json_list:
            Xw = obj.get("Xw"); Yw = obj.get("Yw")
            if Xw is None or Yw is None:
                continue
            gid   = int(obj["global_id"])
            label = str(obj["label"])
            xw = float(Xw); yw = float(Yw)
            objs.append({"gid": gid, "label": label, "Xw": xw, "Yw": yw})
            trails[gid].append((xw, yw, frame_idx))
            xmin = min(xmin, xw); xmax = max(xmax, xw)
            ymin = min(ymin, yw); ymax = max(ymax, yw)
            have_bounds = True

        # prune old points globally (keeps UI clean even when idle)
        cutoff = frame_idx - TRAIL_MAX_AGE_FRAMES
        for gid, q in list(trails.items()):
            while q and q[0][2] < cutoff:
                q.popleft()

        # fallback bounds until we have data
        if not have_bounds:
            xmin = ymin = -1.0; xmax = ymax = 1.0

        bounds = {
            "xmin": xmin - MAP_PAD, "xmax": xmax + MAP_PAD,
            "ymin": ymin - MAP_PAD, "ymax": ymax + MAP_PAD
        }

        # render top-down
        panel2d = render_topdown_panel(PANEL_H, PANEL_W, objs, trails, bounds, frame_idx)

        # compose [camera | top-down]
        out_h = H; out_w = W + PANEL_W
        canvas = np.zeros((out_h, out_w, 3), dtype=np.uint8)
        canvas[:, :W] = vis
        y0 = (out_h - PANEL_H) // 2
        canvas[y0:y0+PANEL_H, W:W+PANEL_W] = panel2d

        # header
        cv2.rectangle(canvas, (0,0), (out_w, 34), (0,0,0), -1)
        cv2.putText(canvas, "Live: Camera | Top-down (fading trails)", (12, 22), FONT, 0.7, (255,255,255), 1, cv2.LINE_AA)

        disp = cv2.resize(canvas, None, fx=DISPLAY_SCALE, fy=DISPLAY_SCALE, interpolation=cv2.INTER_AREA) \
               if DISPLAY_SCALE != 1.0 else canvas
        cv2.imshow(WIN, disp)

        # optional: print JSON
        # print(json.dumps(json_list), flush=True)

        k = cv2.waitKey(1) & 0xFF
        if k in (27, ord('q')):
            break

        frame_idx += 1

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
