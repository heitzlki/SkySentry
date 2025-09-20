import cv2
import numpy as np
from yoloe_rt import YoloeRealtime
from fetch_frame import get_frame

rt = YoloeRealtime(weights="yoloe-11s-seg.pt", device=0)  # set device=None 

def get_res_for_id(clientId: str):
    frame = get_frame(clientId)
    # Convert PIL image to numpy array and BGR format for OpenCV
    grab = np.array(frame)
    if grab.shape[-1] == 3:  # RGB to BGR
        frame_np = cv2.cvtColor(grab, cv2.COLOR_RGB2BGR)
    else:
        frame_np = grab
    json_list, vis = rt.process_frame(frame_np, return_vis=False)
    return json_list