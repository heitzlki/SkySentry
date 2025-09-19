import torch
from PIL import Image
from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection, infer_device
from pathlib import Path
import time

model_id = "IDEA-Research/grounding-dino-tiny"
device = infer_device()

processor = AutoProcessor.from_pretrained(model_id)
model = AutoModelForZeroShotObjectDetection.from_pretrained(model_id).to(device)


image_path = Path("test_images/IMG_7679.jpg")  
image = Image.open(image_path).convert("RGB")  


# Check for cats and remote controls
text_labels = [["a person", "a hat"]]
t1 = time.time()

inputs = processor(images=image, text=text_labels, return_tensors="pt").to(model.device)


with torch.no_grad():
    outputs = model(**inputs)

print('process: ', time.time() - t1)

t2 = time.time()
results = processor.post_process_grounded_object_detection(
    outputs,
    inputs.input_ids,
    threshold=0.4,
    text_threshold=0.3,
    target_sizes=[image.size[::-1]]  # (H, W)
)


print('PostProcess: ', time.time() - t2)

result = results[0]
for box, score, labels in zip(result["boxes"], result["scores"], result["labels"]):
    box = [round(x, 2) for x in box.tolist()]
    print(f"Detected {labels} with confidence {round(score.item(), 3)} at location {box}")


# ---- Visualise detections (inline, same style) ----
from PIL import ImageDraw, ImageFont

annotated = image.copy()
draw = ImageDraw.Draw(annotated)
font = ImageFont.load_default()

flat_labels = [t for group in text_labels for t in group]

for box, score, labels in zip(result["boxes"], result["scores"], result["labels"]):
    if hasattr(labels, "item"):
        labels = labels.item()
    if isinstance(labels, (int, float)):
        idx = int(labels)
        label_text = flat_labels[idx] if 0 <= idx < len(flat_labels) else f"id_{idx}"
    else:
        label_text = str(labels)

    box = [round(x, 2) for x in box.tolist()]
    x0, y0, x1, y1 = box
    caption = f"{label_text} • {score.item():.2f}"

    draw.rectangle([(x0, y0), (x1, y1)], outline=(0, 255, 0), width=3)
    bbox = draw.textbbox((x0, y0), caption, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    pad = 2
    draw.rectangle([(x0, y0), (x0 + tw + 2*pad, y0 + th + 2*pad)], fill=(0, 255, 0))
    draw.text((x0 + pad, y0 + pad), caption, fill=(0, 0, 0), font=font)

out_path = image_path.with_name(f"annotated_{image_path.name}")
annotated.save(out_path)
print(f"Saved annotated image to: {out_path}")

