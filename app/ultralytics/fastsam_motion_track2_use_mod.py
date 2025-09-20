# yoloe_video_via_module.py
# Uses the YoloeRealtime module to process a VIDEO (not webcam),
# writes an annotated MP4 and a CSV (same schema as before).
# pip install --upgrade ultralytics opencv-python

import csv
import cv2
from pathlib import Path

from yoloe_rt_smoothed import YoloeRealtime  # <-- our module

# ---------------- Config ----------------
VIDEO_PATH = "test_videos/test_video13.mp4"
OUT_DIR    = Path("out_yoloe_prompt_track_persist_v2"); OUT_DIR.mkdir(parents=True, exist_ok=True)
CSV_PATH   = OUT_DIR / "detections.csv"
OUT_MP4    = OUT_DIR / "annotated.mp4"

WEIGHTS    = "yoloe-11s-seg.pt"
DEVICE     = 0            # None for CPU
SHOW_WIN   = True         # preview while processing
WIN_NAME   = "YOLOE • Video via Module"

# ---------------- Main ----------------
def main():
    # 1) Init module (prompts/classes come from the module file)
    rt = YoloeRealtime(weights=WEIGHTS, device=DEVICE)

    # 2) Open video
    cap = cv2.VideoCapture(VIDEO_PATH)
    if not cap.isOpened():
        raise SystemExit(f"Cannot open video: {VIDEO_PATH}")

    W  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1280)
    H  = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 720)
    FPS = cap.get(cv2.CAP_PROP_FPS) or 30.0

    # 3) Video writer
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(OUT_MP4), fourcc, FPS, (W, H))

    # 4) CSV writer (same columns/order as your original)
    new_file = not CSV_PATH.exists()
    fcsv = open(CSV_PATH, "w", newline="")  # fresh file each run
    wcsv = csv.writer(fcsv)
    wcsv.writerow([
        "frame","global_id","label","x1","y1","x2","y2","cx","cy",
        "Xc","Yc","Zc","Xw","Yw","Zw"
    ])

    if SHOW_WIN:
        cv2.namedWindow(WIN_NAME, cv2.WINDOW_NORMAL)
        cv2.resizeWindow(WIN_NAME, W, H)

    frame_idx = 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break

            # 5) Process with module (returns JSON list + annotated image)
            json_list, vis = rt.process_frame(frame, return_vis=True)
            if vis is None:
                vis = frame

            # 6) (Optional) tiny info strip
            if rt.fx is not None and rt.fy is not None:
                cv2.rectangle(vis, (8,8), (8+560, 8+64), (0,0,0), -1)
                cv2.putText(vis, "YOLOE promptable seg + GlobalIDs + 3D (via module)",
                            (14,30), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (255,255,255), 1, cv2.LINE_AA)
                fx_txt = f"fx={rt.fx:.1f}, fy={rt.fy:.1f}, pitch={rt.cam_pitch_deg:.1f}°, h={rt.cam_height_m:.2f}m"
                cv2.putText(vis, fx_txt, (14, 52), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (220,220,220), 1, cv2.LINE_AA)

            # 7) Write annotated frame
            writer.write(vis)

            # 8) Stream CSV rows (mirrors your original schema)
            for obj in json_list:
                # None → "" for CSV
                def nz(x): return "" if x is None else x
                wcsv.writerow([
                    obj["frame"], obj["global_id"], obj["label"],
                    obj["x1"], obj["y1"], obj["x2"], obj["y2"],
                    f'{obj["cx"]:.2f}', f'{obj["cy"]:.2f}',
                    nz(obj.get("Xc")), nz(obj.get("Yc")), nz(obj.get("Zc")),
                    nz(obj.get("Xw")), nz(obj.get("Yw")), nz(obj.get("Zw")),
                ])

            if SHOW_WIN:
                cv2.imshow(WIN_NAME, vis)
                if cv2.waitKey(1) & 0xFF == 27:
                    break

            frame_idx += 1

    finally:
        cap.release()
        writer.release()
        fcsv.close()
        if SHOW_WIN:
            cv2.destroyAllWindows()
        print("Saved video:", OUT_MP4)
        print("Saved CSV  :", CSV_PATH)

if __name__ == "__main__":
    main()
