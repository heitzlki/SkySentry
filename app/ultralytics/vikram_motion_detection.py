import cv2
import numpy as np
import pandas as pd
from collections import deque
from pathlib import Path

# ---------------- Tunables (stricter defaults) ----------------
VIDEO_PATH      = "test_videos/test_video.mp4"
OUTPUT_DIR      = "out_motion_strict"

# --- Recall + steady (preset A) ---
MIN_AREA        = 550
MAX_AREA        = 180000
ASPECT_MIN      = 0.30
ASPECT_MAX      = 4.2
MIN_SOLIDITY    = 0.45
MIN_EXTENT      = 0.35

HISTORY         = 300
VAR_THRESHOLD   = 12
FG_THRESHOLD    = 125
WARMUP_FRAMES   = 10
GAUSS_BLUR_K    = 0    # disable pre-blur to keep edges

KERNEL_OPEN     = (3, 3)
KERNEL_CLOSE    = (3, 3)
KERNEL_DILATE   = (5, 5)

USE_FLOW        = True
MIN_SPEED_PX    = 1.6
MIN_MEAN_SPEED  = 0.8

IOU_MATCH_DIST  = 0.28
MAX_MISSES      = 10
CONFIRM_WIN_N   = 6
CONFIRM_MIN_K   = 3
IGNORE_BORDER_PX= 4



Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)

cap = cv2.VideoCapture(VIDEO_PATH)
if not cap.isOpened():
    raise SystemExit(f"Cannot open: {VIDEO_PATH}")

W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
FPS = cap.get(cv2.CAP_PROP_FPS) or 30.0

fourcc = cv2.VideoWriter_fourcc(*"mp4v")
writer = cv2.VideoWriter(str(Path(OUTPUT_DIR, "annotated.mp4")), fourcc, FPS, (W, H))

# Background subtractor (no shadows)
fg = cv2.createBackgroundSubtractorMOG2(history=HISTORY, varThreshold=VAR_THRESHOLD, detectShadows=False)
kernel_open   = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, KERNEL_OPEN)
kernel_close  = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, KERNEL_CLOSE)
kernel_dilate = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, KERNEL_DILATE)

# Optical flow state
prev_gray = None

# Simple tracker with temporal confirmation
tracks = {}       # id -> {box:[x1,y1,x2,y2], misses:int, hits:deque(bool, N)}
next_id = 1

def iou(a, b):
    ax1, ay1, ax2, ay2 = a; bx1, by1, bx2, by2 = b
    x1, y1 = max(ax1, bx1), max(ay1, by1)
    x2, y2 = min(ax2, bx2), min(ay2, by2)
    w, h = max(0, x2-x1), max(0, y2-y1)
    inter = w*h
    area_a = max(0, (ax2-ax1)*(ay2-ay1))
    area_b = max(0, (bx2-bx1)*(by2-by1))
    denom = max(1e-6, area_a + area_b - inter)
    return inter / denom

def associate(dets, tracks, iou_thr=IOU_MATCH_DIST):
    assigned_det = set()
    assigned_trk = set()
    matches = []
    # greedy best match per track
    for tid, t in tracks.items():
        best_iou, best_j = 0.0, None
        for j, d in enumerate(dets):
            if j in assigned_det: continue
            ov = iou(t["box"], d)
            if ov > best_iou:
                best_iou, best_j = ov, j
        if best_j is not None and best_iou >= iou_thr:
            matches.append((tid, best_j))
            assigned_trk.add(tid)
            assigned_det.add(best_j)
    new = [j for j in range(len(dets)) if j not in assigned_det]
    missed = [tid for tid in tracks.keys() if tid not in assigned_trk]
    return matches, new, missed

def shape_quality(contour, bbox_area):
    area = cv2.contourArea(contour)
    if area <= 0 or bbox_area <= 0: return 0.0, 0.0
    hull = cv2.convexHull(contour)
    hull_area = cv2.contourArea(hull)
    solidity = area / max(1e-6, hull_area)
    extent   = area / max(1e-6, bbox_area)
    return solidity, extent

rows = []
frame_idx = 0

while True:
    ok, frame = cap.read()
    if not ok:
        break
    frame_idx += 1

    # Slight denoise before FG helps a lot
    if GAUSS_BLUR_K > 0:
        frame_blur = cv2.GaussianBlur(frame, (GAUSS_BLUR_K, GAUSS_BLUR_K), 0)
    else:
        frame_blur = frame

    # Foreground mask
    mask = fg.apply(frame_blur)

    # Morphology pipeline: open (remove specks) -> close (fill small holes) -> dilate
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel_open, iterations=1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel_close, iterations=1)
    _, mask = cv2.threshold(mask, FG_THRESHOLD, 255, cv2.THRESH_BINARY)
    mask = cv2.dilate(mask, kernel_dilate, iterations=2)

    # Optical flow (for motion confidence)
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    if prev_gray is not None and USE_FLOW:
        flow = cv2.calcOpticalFlowFarneback(prev_gray, gray, None, 0.5, 3, 15, 3, 5, 1.2, 0)
        speed = np.hypot(flow[...,0], flow[...,1])
    else:
        flow = None; speed = None
    prev_gray = gray

    # Contours → detections
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    dets = []
    for c in cnts:
        x, y, w, h = cv2.boundingRect(c)
        if x <= IGNORE_BORDER_PX or y <= IGNORE_BORDER_PX or \
           (x+w) >= (W-IGNORE_BORDER_PX) or (y+h) >= (H-IGNORE_BORDER_PX):
            continue
        area = w*h
        if area < MIN_AREA or area > MAX_AREA: continue
        aspect = w / float(h) if h > 0 else 999.0
        if not (ASPECT_MIN <= aspect <= ASPECT_MAX): continue

        # shape quality
        sol, ext = shape_quality(c, area)
        if sol < MIN_SOLIDITY or ext < MIN_EXTENT: continue

        # motion confidence inside box
        if speed is not None:
            sx = speed[max(0,y):min(H,y+h), max(0,x):min(W,x+w)]
            if sx.size == 0: continue
            sp_med = float(np.median(sx))
            sp_mean = float(np.mean(sx))
            if sp_med < MIN_SPEED_PX and sp_mean < MIN_MEAN_SPEED:  # require decent movement
                continue

        dets.append([x, y, x+w, y+h])

    # Warmup: let BG model stabilize first few frames
    if frame_idx <= WARMUP_FRAMES:
        vis = frame.copy()
        writer.write(vis)
        cv2.imshow("Motion detection (strict)", vis)
        if cv2.waitKey(1) & 0xFF == 27: break
        continue

    # Associate with tracks
    matches, new_idx, missed = associate(dets, tracks)

    # Update matched tracks
    for tid, j in matches:
        tracks[tid]["box"] = dets[j]
        tracks[tid]["misses"] = 0
        tracks[tid]["hits"].append(True)

    # New tracks
    for j in new_idx:
        tracks[next_id] = {
            "box": dets[j],
            "misses": 0,
            "hits": deque([True], maxlen=CONFIRM_WIN_N)
        }
        next_id += 1

    # Age missed tracks
    to_del = []
    for tid in missed:
        tracks[tid]["misses"] += 1
        tracks[tid]["hits"].append(False)
        if tracks[tid]["misses"] > MAX_MISSES:
            to_del.append(tid)
    for tid in to_del:
        tracks.pop(tid, None)

    # Draw confirmed tracks only (temporal voting K-of-N)
    vis = frame.copy()
    for tid, t in tracks.items():
        hits = t["hits"]
        seen_k = sum(hits)
        confirmed = (len(hits) >= min(CONFIRM_WIN_N, 3)) and (seen_k >= CONFIRM_MIN_K)

        x1,y1,x2,y2 = map(int, t["box"])
        cx, cy = (x1+x2)//2, (y1+y2)//2
        color = (80, 200, 255) if confirmed and t["misses"] == 0 else (120, 120, 120)

        # draw only confirmed tracks brightly; unconfirmed as faint boxes (or skip drawing them)
        if confirmed:
            cv2.rectangle(vis, (x1,y1), (x2,y2), color, 2)
            cv2.circle(vis, (cx,cy), 3, (255,255,255), -1)
            cv2.putText(vis, f"id{tid}", (x1, max(12, y1-6)), cv2.FONT_HERSHEY_SIMPLEX, 0.5,
                        (10,10,10), 2, cv2.LINE_AA)
            cv2.putText(vis, f"id{tid}", (x1, max(12, y1-6)), cv2.FONT_HERSHEY_SIMPLEX, 0.5,
                        (255,255,255), 1, cv2.LINE_AA)

            rows.append({
                "frame": frame_idx,
                "track_id": tid,
                "x1": x1, "y1": y1, "x2": x2, "y2": y2,
                "cx": cx, "cy": cy,
                "confirmed": True
            })
        else:
            # (optional) draw faint boxes for debugging; comment out to hide
            cv2.rectangle(vis, (x1,y1), (x2,y2), (90,90,90), 1)

    writer.write(vis)
    cv2.imshow("Motion detection (strict)", vis)
    if cv2.waitKey(1) & 0xFF == 27: break

cap.release()
writer.release()
cv2.destroyAllWindows()

# Save CSV of confirmed only
df = pd.DataFrame(rows)
csv_path = Path(OUTPUT_DIR, "detections.csv")
df.to_csv(csv_path, index=False)
print(f"Saved: {Path(OUTPUT_DIR,'annotated.mp4')} and {csv_path}")
