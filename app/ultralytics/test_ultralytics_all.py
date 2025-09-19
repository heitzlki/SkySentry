from ultralytics import YOLO

# Option A: local path after downloading
model = YOLO("yolov8m-oiv7.pt")

# Option B: load directly from a URL (Ultralytics can fetch remote .pt)
# model = YOLO("https://github.com/ultralytics/assets/releases/download/v8.1.0/yolov8m-oiv7.pt")

# results = model("test_images/IMG_7679.jpg", conf=0.25)
# results[0].show()

model.predict(
    source="test_videos/test_video.mp4",  
    conf=0.25,
    save=True,
    show = True,
    project="runs/detect",
    name="oiv7_video"
)

# See the ~600 class names
print(len(model.names), "classes")
print(list(model.names.values())[:50], "...")
