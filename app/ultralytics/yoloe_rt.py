# yoloe_rt.py
# pip install --upgrade ultralytics opencv-python
import math
import json
from typing import List, Dict, Tuple, Any, Optional

import cv2
import numpy as np
from ultralytics import YOLOE

# ---------------- Defaults / Config Structs ----------------
DEFAULT_CLASSES = [
    "white bottle", "paper sign in hand", "paper air plane",
    "black bottle", "paper airplane in hand"
]

DEFAULT_CONTINUITY_GROUPS = [
    {"paper air plane", "paper airplane in hand"},
    {"white bottle", "black bottle"}
]

DEFAULT_OBJ_HEIGHTS_M = {
    "white bottle": 0.15,
    "black bottle": 0.20,
    "paper sign in hand": 0.20,
    "paper air plane": 0.15,
    "paper airplane in hand": 0.15
}

# ---------------- Utilities ----------------
def _get_masks_resized(r, frame_hw: Tuple[int, int]) -> List[np.ndarray]:
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

def _parse_detections(r, classes: List[str], frame_hw: Tuple[int, int]) -> List[Dict[str, Any]]:
    H, W = frame_hw
    dets: List[Dict[str, Any]] = []
    if r.boxes is not None and len(r.boxes) > 0:
        boxes = r.boxes.xyxy.cpu().numpy().astype(int)
        clss  = r.boxes.cls.cpu().numpy().astype(int) if r.boxes.cls is not None else np.zeros((len(r.boxes),), int)
    else:
        boxes = np.empty((0,4), dtype=int); clss = np.empty((0,), dtype=int)

    masks = _get_masks_resized(r, (H, W))

    for i, (x1,y1,x2,y2) in enumerate(boxes):
        x1 = max(0, x1); y1 = max(0, y1); x2 = min(W-1, x2); y2 = min(H-1, y2)
        if x2 <= x1 or y2 <= y1: 
            continue
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

def _center_dist(a: Tuple[float,float], b: Tuple[float,float]) -> float:
    ax, ay = a; bx, by = b
    return float(np.hypot(ax-bx, ay-by))

def _fx_fy_from_fov(W: int, H: int, hfov_deg: float, vfov_deg: float) -> Tuple[float,float]:
    hf = math.radians(hfov_deg); vf = math.radians(vfov_deg)
    fx = (W/2.0) / math.tan(hf/2.0)
    fy = (H/2.0) / math.tan(vf/2.0)
    return fx, fy

def _rot_x(deg: float) -> np.ndarray:
    t = math.radians(deg)
    c, s = math.cos(t), math.sin(t)
    return np.array([[1,0,0],[0,c,-s],[0,s,c]], dtype=np.float32)

def _depth_from_height_px(h_px: int, true_h_m: float, fy_px: float) -> float:
    h = max(1, int(h_px))
    return (fy_px * true_h_m) / float(h)

def _cam_xy_from_pixel(u: float, v: float, Zc: float, fx_px: float, fy_px: float, cx: float, cy: float) -> Tuple[float,float]:
    Xc = (u - cx) * Zc / fx_px
    Yc = (v - cy) * Zc / fy_px
    return float(Xc), float(Yc)

def _estimate_3d_for_bbox(bbox: Tuple[int,int,int,int], label: str, fx_px: float, fy_px: float,
                          cx: float, cy: float, R_wc: np.ndarray, cam_pos_w: np.ndarray,
                          obj_heights: Dict[str, float]) -> Dict[str, float]:
    x1,y1,x2,y2 = bbox
    h_px = max(1, y2 - y1)
    u = (x1 + x2) * 0.5   # bottom center
    v = float(y2)

    true_h = obj_heights.get(label, None)
    if true_h is None:
        return {}

    Zc = _depth_from_height_px(h_px, true_h, fy_px)
    Xc, Yc = _cam_xy_from_pixel(u, v, Zc, fx_px, fy_px, cx, cy)
    pc = np.array([Xc, Yc, Zc], dtype=np.float32)
    pw = cam_pos_w + R_wc @ pc
    return {"Xc": float(Xc), "Yc": float(Yc), "Zc": float(Zc),
            "Xw": float(pw[0]), "Yw": float(pw[1]), "Zw": float(pw[2])}

# ---------------- Identity Manager (radius+time+continuity only) ----------------
class IdentityManager:
    def __init__(self, classes: List[str], continuity_groups: List[set], 
                 reid_max_radius_px: int, reid_max_frames: int):
        self.classes = classes
        self.reid_max_radius_px = reid_max_radius_px
        self.reid_max_frames = reid_max_frames
        self.next_gid = 0
        self.active: Dict[int, Dict[str, Any]] = {}    # gid -> {cls, bbox, center, last_frame}
        self.inactive: List[Dict[str, Any]] = []       # [{gid, cls, bbox, center, last_frame}]

        # Build continuity group map: class index -> group id
        self.cls_group: Dict[int, int] = {}
        group_id = 0
        name_to_idx = {name: i for i, name in enumerate(self.classes)}
        for group in continuity_groups:
            indices = [name_to_idx[n] for n in group if n in name_to_idx]
            if len(indices) >= 2:
                for ci in indices:
                    self.cls_group[ci] = group_id
                group_id += 1

    def _same_continuity_class(self, ci_a: int, ci_b: int) -> bool:
        if ci_a == ci_b: 
            return True
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
            if age < 0 or age > self.reid_max_frames:
                continue
            if not self._same_continuity_class(item["cls"], ci):
                continue
            dist = _center_dist(dc, item["center"])
            if dist <= self.reid_max_radius_px and dist < best_dist:
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

    def assign(self, frame_idx: int, dets: List[Dict[str, Any]]) -> Dict[int, int]:
        used_gids = set(); idx_to_gid: Dict[int, int] = {}

        # Try active first
        for i, det in enumerate(dets):
            gid = self._match_pool(det, pool=[{"gid": gid, **rec} for gid, rec in self.active.items()], frame_idx=frame_idx)
            if gid is not None and gid not in used_gids:
                used_gids.add(gid); idx_to_gid[i] = gid

        # Then inactive
        for i, det in enumerate(dets):
            if i in idx_to_gid: continue
            gid = self._match_pool(det, pool=self.inactive, frame_idx=frame_idx)
            if gid is not None and gid not in used_gids:
                used_gids.add(gid); idx_to_gid[i] = gid

        # New IDs
        for i, det in enumerate(dets):
            if i in idx_to_gid: continue
            gid = self._new_gid(det["cls_idx"], det["bbox"], det["center"], frame_idx)
            used_gids.add(gid); idx_to_gid[i] = gid

        # Move unmatched actives to inactive and prune stale
        updated = set(idx_to_gid.values())
        for gid in list(self.active.keys()):
            if gid not in updated:
                rec = self.active.pop(gid)
                self.inactive.append({"gid": gid, **rec})
        self.inactive = [it for it in self.inactive if (frame_idx - it["last_frame"]) <= self.reid_max_frames]
        return idx_to_gid

# ---------------- Public Module Class ----------------
class YoloeRealtime:
    """
    Importable, stateful realtime YOLOE processor.
    Usage:
        rt = YoloeRealtime(weights="yoloe-11s-seg.pt")
        json_list, vis = rt.process_frame(frame, return_vis=True)
    """
    def __init__(
        self,
        weights: str = "yoloe-11s-seg.pt",
        device: Optional[int] = 0,          # None for CPU, or GPU index
        imgsz: int = 960,
        conf: float = 0.15,
        iou: float = 0.5,
        classes: List[str] = DEFAULT_CLASSES,
        continuity_groups: List[set] = DEFAULT_CONTINUITY_GROUPS,
        reid_max_radius_px: int = 240,
        reid_max_frames: int = 180,
        obj_heights_m: Dict[str, float] = DEFAULT_OBJ_HEIGHTS_M,
        cam_pitch_deg: float = 60.0,
        cam_height_m: float = 0.1,
        hfov_deg: float = 66.5,
        vfov_deg: float = 52.6
    ):
        self.weights = weights
        self.device = device
        self.imgsz = imgsz
        self.conf = conf
        self.iou = iou
        self.classes = classes
        self.obj_heights_m = obj_heights_m

        self.cam_pitch_deg = cam_pitch_deg
        self.cam_height_m = cam_height_m
        self.hfov_deg = hfov_deg
        self.vfov_deg = vfov_deg

        # Model
        self.model = YOLOE(self.weights)
        if self.device is not None:
            self.model.to(self.device)
        pe = self.model.get_text_pe(self.classes)
        self.model.set_classes(self.classes, pe)
        self.use_half = (self.device is not None)

        # State
        self.idman = IdentityManager(self.classes, continuity_groups, reid_max_radius_px, reid_max_frames)
        self.frame_idx = 0

        # Intrinsics / extrinsics (filled on first frame)
        self.fx = None; self.fy = None; self.cx = None; self.cy = None
        self.R_wc = _rot_x(-self.cam_pitch_deg)  # camera->world
        self.cam_pos_w = np.array([0.0, 0.0, self.cam_height_m], dtype=np.float32)

    def reset_ids(self):
        """Clear identity state and frame counter (e.g., when starting a new stream)."""
        self.idman = IdentityManager(self.classes, DEFAULT_CONTINUITY_GROUPS, 
                                     self.idman.reid_max_radius_px, self.idman.reid_max_frames)
        self.frame_idx = 0

    def process_frame(self, frame_bgr: np.ndarray, return_vis: bool = False) -> Tuple[List[Dict[str, Any]], Optional[np.ndarray]]:
        """
        Run YOLOE on a single BGR frame.
        Returns (json_list, vis_frame) where vis_frame is None if return_vis=False.
        """
        if frame_bgr is None or frame_bgr.size == 0:
            return [], None

        H, W = frame_bgr.shape[:2]
        if self.fx is None:
            self.fx, self.fy = _fx_fy_from_fov(W, H, self.hfov_deg, self.vfov_deg)
            self.cx, self.cy = W/2.0, H/2.0

        # Predict on this frame
        results = self.model.predict(
            source=frame_bgr,
            imgsz=self.imgsz, conf=self.conf, iou=self.iou,
            device=self.device, half=self.use_half, verbose=False
        )
        r = results[0]

        # Parse + assign IDs
        dets = _parse_detections(r, self.classes, (H, W))
        idx_to_gid = self.idman.assign(self.frame_idx, dets)

        # Build JSON + (optional) visualization
        json_list: List[Dict[str, Any]] = []
        vis = frame_bgr.copy() if return_vis else None

        for i, det in enumerate(dets):
            gid = idx_to_gid[i]
            (x1,y1,x2,y2) = det["bbox"]; (cx_px,cy_px) = det["center"]

            coords = {}
            if (self.fx is not None) and (self.fy is not None):
                coords = _estimate_3d_for_bbox(det["bbox"], det["label"], 
                                               self.fx, self.fy, self.cx, self.cy,
                                               self.R_wc, self.cam_pos_w, self.obj_heights_m)

            obj = {
                "frame": int(self.frame_idx),
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

            if return_vis:
                col = (60 + (37 * (gid + 1)) % 195, 60 + (91 * (gid + 1)) % 195, 60 + (13 * (gid + 1)) % 195)
                # mask overlay
                m = det.get("mask", None)
                if m is not None and m.shape == (H, W):
                    vis[m] = col
                # bbox, label, center
                cv2.rectangle(vis, (x1,y1), (x2,y2), col, 2)
                tag = f"{det['label']}  id:{gid}"
                ytxt = max(12, y1 - 6)
                cv2.putText(vis, tag, (x1, ytxt), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (20,20,20), 2, cv2.LINE_AA)
                cv2.putText(vis, tag, (x1, ytxt), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255,255,255), 1, cv2.LINE_AA)
                cv2.circle(vis, (int(cx_px), int(cy_px)), 3, (255,255,255), -1)

        self.frame_idx += 1
        return json_list, vis
