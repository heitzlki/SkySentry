from ultralytics import YOLOE

# Initialize a YOLOE model
model = YOLOE("yoloe-11l-seg-pf.pt")

# Run prediction. No prompts required.
# results = model.predict("test_images/IMG_7679.jpg")

names = ['paper airplane']
model.set_classes(names, model.get_text_pe(names))


model.predict(
    source="test_videos/test_video.mp4",  
    conf=0.6,
    save=True,
    show = True,
    project="runs/detect",
    name="oiv7_video"
)

# Show results
# results[0].show()