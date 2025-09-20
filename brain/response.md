Here’s what each CSV column means and how the values are produced:

frame — The video frame index starting at 0 (one row per detection per frame).

global_id — A persistent track ID from IdentityManager.
It’s maintained across frames using only: (a) distance between detection centers (≤ REID_MAX_RADIUS_PX), (b) time gap (≤ REID_MAX_FRAMES), and (c) label “continuity groups” (e.g., paper air plane ↔ paper airplane in hand, white bottle ↔ black bottle). Once assigned, the ID is reused whenever a new detection sufficiently matches.

label — The promptable class name for the detection (from CLASSES), e.g., “white bottle”.

x1, y1, x2, y2 — The clamped pixel coordinates of the 2D bounding box (top-left (x1,y1), bottom-right (x2,y2)). Integers in image pixels.

cx, cy — The 2D center of the box in pixels, formatted with two decimals.
Computed as ((x1+x2)/2, (y1+y2)/2) after clamping.

Xc, Yc, Zc — Estimated camera-coordinate 3D position (metres) of the detection point used for ranging (the box’s bottom-center).

Zc (depth) is estimated from apparent pixel height using a known true object height:
Zc = (fy_px \* true_height_m) / bbox_height_px.

Xc, Yc are back-projected with pinhole intrinsics from FOV (fx, fy) and principal point at image center.

If the object’s true height isn’t known (not in OBJ_HEIGHTS), these fields are left blank for that row.

Xw, Yw, Zw — The same point expressed in the world frame (metres).
World coordinates are computed by rotating the camera vector by the camera pitch (using R_wc = rot_x(-CAM_PITCH_DEG)) and then translating by the assumed camera position cam_pos_w = (0, 0, CAM_HEIGHT_M).
Intuition:

Zw is height above the world origin (the floor is near 0 if geometry is consistent).

Xw, Yw lie on the ground plane directions given the camera’s down-tilt.
