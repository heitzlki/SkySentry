# yoloe_webcam_realtime_json.py
# pip install --upgrade ultralytics opencv-python
import cv2
import json
import time
import math
import numpy as np
from typing import List, Dict, Tuple, Any, Optional
from ultralytics import YOLOE

# ---------------- Config ----------------
WEIGHTS    = "yoloe-11s-seg.pt"     # or yoloe-11m-seg.pt / yoloe-11l-seg.pt
DEVICE     = 0                      # None for CPU; or GPU index (e.g., 0)
IMGSZ      = 960
CONF       = 0.15
IOU        = 0.5
CAM_INDEX  = 0                      # default webcam
WINDOW_NAME = "YOLOE • Live • IDs + 3D"

CLASSES = [
    "white bottle", "paper sign in hand", "paper air plane",
    "black bottle", "paper airplane in hand"
]

# Tracking continuity: labels in the same set are interchangeable for ID continuity
CONTINUITY_GROUPS = [
    {"paper air plane", "paper airplane in hand"},
    {"white bottle", "black bottle"}
]

# Spatial/temporal association limits (in pixels / frames)
REID_MAX_RADIUS_PX = 240
REID_MAX_FRAMES    = 180

# Known object heights (metres) for 3D estimates
OBJ_HEIGHTS = {
    "white bottle": 0.15,
    "black bottle": 0.20,
    "paper sign in hand": 0.20,
    "paper air plane": 0.15,
    "paper airplane in hand": 0.15
}

# Camera pose / geometry
CAM_PITCH_DEG  = 60.0   # camera pitched DOWN by 60° toward the floor
CAM_HEIGHT_M   = 0.1    # camera height above ground (m)

# Field of view (tune to your camera if you know it)
HFOV_DEG = 66.5
VFOV_DEG = 52.6

# ---------------- Small utils ----------------
def color_for_gid(gid: int) -> Tuple[int, int, int]:
    return (
        60 + (37 * (gid + 1)) % 195,
        60 + (91 * (gid + 1)) % 195,
        60 + (13 * (gid + 1)) % 195,
    )

def prepare_prompts(model: YOLOE, classes: List[str]) -> None:
    pe = model.get_text_pe(classes)
    model.set_classes(classes, pe)

def get_masks_resized(r, frame_hw: Tuple[int, int]) -> List[np.ndarray]:
    H, W = frame_hw
    out = []
    if getattr(r, "masks", None) is not None and r.masks is not None and getattr(r.masks, "data", None) is not None:
        md = r.masks.data
        try:
            md = md.cpu().numpy()
        except Exception:
            md = np.array(md)
        for mi in range(len(md)):
            m = md[mi] > 0
            if m.shape != (H, W):
                m = cv2.resize(m.astype(np.uint8), (W, H), interpolation=cv2.INTER_NEAREST).astype(bool)
            out.append(m)
    return out

def parse_detections(r, classes: List[str], frame_hw: Tuple[int, int]) -> List[Dict[str, Any]]:
    H, W = frame_hw
    dets: List[Dict[str, Any]] = []
    if r.boxes is not None and len(r.boxes) > 0:
        boxes = r.boxes.xyxy.cpu().numpy().astype(int)
        clss  = r.boxes.cls.cpu().numpy().astype(int) if r.boxes.cls is not None else np.zeros((len(boxes),), int)
    else:
        boxes = np.empty((0,4), dtype=int); clss = np.empty((0,), dtype=int)

    masks = get_masks_resized(r, (H, W))

    for i, (x1,y1,x2,y2) in enumerate(boxes):
        x1 = max(0, x1); y1 = max(0, y1); x2 = min(W-1, x2); y2 = min(H-1, y2)
        if x2 <= x1 or y2 <= y1: continue
        ci = int(clss[i]) if i < len(clss) else 0
        label = classes[ci] if 0 <= ci < len(classes) else ""
        cx, cy = (x1+x2)*0.5, (y1+y2)*0.5
        dets.append({
            "cls_idx": ci,
            "label": label,
            "bbox": (int(x1), int(y1), int(x2), int(y2)),
            "center": (float(cx), float(cy)),
            "mask": masks[i] if i < len(masks) else None,
        })
    return dets

def center_dist(a: Tuple[float,float], b: Tuple[float,float]) -> float:
    ax, ay = a; bx, by = b
    return float(np.hypot(ax-bx, ay-by))

# --------- Camera math (fx, fy from FOV; 3D estimates) ---------
def fx_fy_from_fov(W: int, H: int, hfov_deg: float, vfov_deg: float) -> Tuple[float,float]:
    hf = math.radians(hfov_deg); vf = math.radians(vfov_deg)
    fx = (W/2.0) / math.tan(hf/2.0)
    fy = (H/2.0) / math.tan(vf/2.0)
    return fx, fy

def rot_x(deg: float) -> np.ndarray:
    t = math.radians(deg)
    c, s = math.cos(t), math.sin(t)
    return np.array([[1,0,0],[0,c,-s],[0,s,c]], dtype=np.float32)

def depth_from_height_px(h_px: int, true_h_m: float, fy_px: float) -> float:
    h = max(1, int(h_px))
    return (fy_px * true_h_m) / float(h)

def cam_xy_from_pixel(u: float, v: float, Zc: float, fx_px: float, fy_px: float, cx: float, cy: float) -> Tuple[float,float]:
    Xc = (u - cx) * Zc / fx_px
    Yc = (v - cy) * Zc / fy_px
    return float(Xc), float(Yc)

def estimate_3d_for_bbox(bbox: Tuple[int,int,int,int], label: str, fx_px: float, fy_px: float,
                         cx: float, cy: float, R_wc: np.ndarray, cam_pos_w: np.ndarray) -> Dict[str, float]:
    x1,y1,x2,y2 = bbox
    h_px = max(1, y2 - y1)
    u = (x1 + x2) * 0.5     # bottom center works well for upright objects
    v = float(y2)

    true_h = OBJ_HEIGHTS.get(label, None)
    if true_h is None:
        return {}

    Zc = depth_from_height_px(h_px, true_h, fy_px)
    Xc, Yc = cam_xy_from_pixel(u, v, Zc, fx_px, fy_px, cx, cy)
    pc = np.array([Xc, Yc, Zc], dtype=np.float32)
    pw = cam_pos_w + R_wc @ pc
    return {"Xc": float(Xc), "Yc": float(Yc), "Zc": float(Zc),
            "Xw": float(pw[0]), "Yw": float(pw[1]), "Zw": float(pw[2])}

# -------- Global Identity Manager (radius+time+continuity only) --------
class IdentityManager:
    def __init__(self, classes: List[str]):
        self.classes = classes
        self.next_gid = 0
        self.active: Dict[int, Dict[str, Any]] = {}    # gid -> {cls, bbox, center, last_frame}
        self.inactive: List[Dict[str, Any]] = []       # [{gid, cls, bbox, center, last_frame}]

        self.cls_group: Dict[int, int] = {}
        group_id = 0
        name_to_idx = {name: i for i, name in enumerate(self.classes)}
        for group in CONTINUITY_GROUPS:
            indices = [name_to_idx[n] for n in group if n in name_to_idx]
            if len(indices) >= 2:
                for ci in indices:
                    self.cls_group[ci] = group_id
                group_id += 1

    def _same_continuity_class(self, ci_a: int, ci_b: int) -> bool:
        if ci_a == ci_b: return True
        ga = self.cls_group.get(ci_a, None)
        gb = self.cls_group.get(ci_b, None)
        return ga is not None and ga == gb

    def _new_gid(self, cls_idx: int, bbox, center, frame_idx: int) -> int:
        gid = self.next_gid; self.next_gid += 1
        self.active[gid] = {"cls": cls_idx, "bbox": bbox, "center": center, "last_frame": frame_idx}
        return gid

    def _match_pool(self, det, pool, frame_idx) -> Optional[int]:
        ci = det["cls_idx"]; dc = det["center"]
        best_gid, best_dist, best_pos = None, float("inf"), -1
        for idx, item in enumerate(pool):
            age = frame_idx - item["last_frame"]
            if age < 0 or age > REID_MAX_FRAMES:
                continue
            if not self._same_continuity_class(item["cls"], ci):
                continue
            dist = center_dist(dc, item["center"])
            if dist <= REID_MAX_RADIUS_PX and dist < best_dist:
                best_gid, best_dist, best_pos = item["gid"], dist, idx
        if best_gid is None:
            return None
        item = pool.pop(best_pos)
        self.active[best_gid] = {
            "cls": item["cls"],
            "bbox": det["bbox"],
            "center": det["center"],
            "last_frame": frame_idx
        }
        return best_gid

    def assign(self, frame_idx: int, frame: np.ndarray, dets: List[Dict[str, Any]]) -> Dict[int, int]:
        used_gids = set()
        idx_to_gid: Dict[int, int] = {}

        # Try active first
        for i, det in enumerate(dets):
            gid = self._match_pool(det, pool=[{"gid": gid, **rec} for gid, rec in self.active.items()], frame_idx=frame_idx)
            if gid is not None and gid not in used_gids:
                used_gids.add(gid)
                idx_to_gid[i] = gid

        # Then inactive
        for i, det in enumerate(dets):
            if i in idx_to_gid: continue
            gid = self._match_pool(det, pool=self.inactive, frame_idx=frame_idx)
            if gid is not None and gid not in used_gids:
                used_gids.add(gid)
                idx_to_gid[i] = gid

        # New IDs
        for i, det in enumerate(dets):
            if i in idx_to_gid: continue
            gid = self._new_gid(det["cls_idx"], det["bbox"], det["center"], frame_idx)
            used_gids.add(gid)
            idx_to_gid[i] = gid

        # Move inactive (not used this frame)
        updated = set(idx_to_gid.values())
        for gid in list(self.active.keys()):
            if gid not in updated:
                rec = self.active.pop(gid)
                self.inactive.append({"gid": gid, **rec})

        # Drop stale inactives
        self.inactive = [it for it in self.inactive if (frame_idx - it["last_frame"]) <= REID_MAX_FRAMES]
        return idx_to_gid

# ---------------- Live webcam -> overlay + per-frame JSON ----------------
def main():
    # Init model + prompts
    model = YOLOE(WEIGHTS)
    if DEVICE is not None:
        model.to(DEVICE)
    prepare_prompts(model, CLASSES)
    use_half = (DEVICE is not None)  # half on CUDA; keep False for CPU

    # Camera
    cap = cv2.VideoCapture(CAM_INDEX)
    if not cap.isOpened():
        raise RuntimeError(f"Failed to open webcam index {CAM_INDEX}")
    # Ask for a decent resolution (best-effort)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_NORMAL)

    # Identity manager & intrinsics (computed on first frame)
    idman = IdentityManager(CLASSES)
    fx = fy = cx = cy = None
    R_wc = rot_x(-CAM_PITCH_DEG)            # camera -> world
    cam_pos_w = np.array([0.0, 0.0, CAM_HEIGHT_M], dtype=np.float32)

    last_t = time.time()
    frame_idx = 0

    try:
        while True:
            ok, frame = cap.read()
            if not ok or frame is None:
                break

            H, W = frame.shape[:2]
            if fx is None:
                fx, fy = fx_fy_from_fov(W, H, HFOV_DEG, VFOV_DEG)
                cx, cy = W/2.0, H/2.0

            # Predict on this frame (seg+boxes)
            results = model.predict(
                source=frame,
                imgsz=IMGSZ, conf=CONF, iou=IOU,
                device=DEVICE, half=use_half, verbose=False
            )
            r = results[0]

            # Parse + assign global IDs
            dets = parse_detections(r, CLASSES, (H, W))
            idx_to_gid = idman.assign(frame_idx, frame, dets)

            # Paint overlay (masks)
            overlay = frame.copy()
            for i, det in enumerate(dets):
                gid = idx_to_gid[i]
                col = color_for_gid(gid)
                m = det.get("mask", None)
                if m is not None and m.shape == (H, W):
                    overlay[m] = col
            out = cv2.addWeighted(overlay, 0.35, frame, 0.65, 0.0)

            # Draw boxes + labels; build JSON for this frame
            json_list = []
            for i, det in enumerate(dets):
                gid = idx_to_gid[i]
                (x1,y1,x2,y2) = det["bbox"]; (cx_px,cy_px) = det["center"]
                col = color_for_gid(gid)

                # 3D coords (metres). If class height unknown, coords dict will be empty.
                coords = {}
                if (fx is not None) and (fy is not None):
                    coords = estimate_3d_for_bbox(det["bbox"], det["label"], fx, fy, cx, cy, R_wc, cam_pos_w)

                # draw
                cv2.rectangle(out, (x1,y1), (x2,y2), col, 2)
                tag = f"{det['label']}  id:{gid}"
                ytxt = max(12, y1 - 6)
                cv2.putText(out, tag, (x1, ytxt), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (20,20,20), 2, cv2.LINE_AA)
                cv2.putText(out, tag, (x1, ytxt), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255,255,255), 1, cv2.LINE_AA)
                cv2.circle(out, (int(cx_px), int(cy_px)), 3, (255,255,255), -1)

                # JSON object
                obj = {
                    "frame": int(frame_idx),
                    "global_id": int(gid),
                    "label": det["label"],
                    "x1": int(x1), "y1": int(y1), "x2": int(x2), "y2": int(y2),
                    "cx": float(cx_px), "cy": float(cy_px),
                    "Xc": coords.get("Xc", None),
                    "Yc": coords.get("Yc", None),
                    "Zc": coords.get("Zc", None),
                    "Xw": coords.get("Xw", None),
                    "Yw": coords.get("Yw", None),
                    "Zw": coords.get("Zw", None)
                }
                json_list.append(obj)

            # Simple FPS estimate
            now = time.time()
            fps = 1.0 / max(1e-6, (now - last_t))
            last_t = now

            # Heads-up panel
            cv2.rectangle(out, (8,8), (8+740, 8+76), (0,0,0), -1)
            title = "YOLOE promptable seg + GlobalIDs (radius+time+continuity) + 3D-from-size"
            cv2.putText(out, title, (14,30), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (255,255,255), 1, cv2.LINE_AA)
            fx_txt = f"fx={fx:.1f}, fy={fy:.1f}, pitch={CAM_PITCH_DEG:.1f}°, h={CAM_HEIGHT_M:.2f}m, FPS={fps:.1f}"
            cv2.putText(out, fx_txt, (14, 52), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (220,220,220), 1, cv2.LINE_AA)

            # Show window
            cv2.imshow(WINDOW_NAME, out)

            # Print JSON for this frame to stdout (one array per frame)
            print(json.dumps(json_list), flush=True)

            # Controls: ESC or q to quit
            k = cv2.waitKey(1) & 0xFF
            if k in (27, ord('q')):
                break

            frame_idx += 1

    finally:
        cap.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
