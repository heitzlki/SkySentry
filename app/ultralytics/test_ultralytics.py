from ultralytics import YOLO

# Load a pre-trained YOLOv10n model
model = YOLO("yolov10n.pt")

# Perform object detection on an image
results = model("test_images/IMG_7679.jpg")

# Display the results
results[0].show()