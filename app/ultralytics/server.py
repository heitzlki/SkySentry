from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import requests
import json
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import uvicorn
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Import your existing AI processing function
from demo_realtime_test import get_res_for_id

# Initialize FastAPI app
app = FastAPI(
    title="SkySentry AI Processing API",
    description="FastAPI server for processing SkySentry camera feeds with AI models",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure as needed for security
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration from environment variables
DEFAULT_BACKEND_URL = os.getenv("BACKEND_URL", "https://demo8080.shivi.io/api")
FASTAPI_HOST = os.getenv("FASTAPI_HOST", "0.0.0.0")
FASTAPI_PORT = int(os.getenv("FASTAPI_PORT", "8001"))
FASTAPI_RELOAD = os.getenv("FASTAPI_RELOAD", "true").lower() == "true"
LOG_LEVEL = os.getenv("LOG_LEVEL", "info")

# Response models
class ClientInfo(BaseModel):
    client_id: str
    timestamp: Optional[str] = None
    size: Optional[int] = None
    stats: Optional[Dict[str, Any]] = None

class FrameResponse(BaseModel):
    success: bool
    client_id: str
    image: Optional[str] = None
    timestamp: Optional[str] = None
    size: Optional[int] = None
    stats: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class ClientsListResponse(BaseModel):
    success: bool
    clients: List[str]
    count: int
    error: Optional[str] = None

class AIProcessingResponse(BaseModel):
    success: bool
    client_id: str
    detections: Optional[List[Dict[str, Any]]] = None
    detection_count: Optional[int] = None
    error: Optional[str] = None

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "SkySentry AI Processing API",
        "version": "1.0.0",
        "endpoints": {
            "GET /clients": "Get all connected clients",
            "GET /client/{client_id}": "Get latest frame data for specific client",
            "GET /client/{client_id}/info": "Get frame metadata for specific client"
        }
    }

@app.get("/clients", response_model=ClientsListResponse)
async def get_all_clients(backend_url: str = Query(DEFAULT_BACKEND_URL, description="Backend API URL")):
    """
    Get list of all connected client IDs from the SkySentry backend.
    
    Args:
        backend_url: Base URL of the SkySentry API (default: https://demo8080.shivi.io/api)
        
    Returns:
        List of client ID strings with success status
    """
    try:
        response = requests.get(f"{backend_url}/clients", timeout=10)
        response.raise_for_status()
        
        data = response.json()
        print(data)
        
        if isinstance(data, dict):
            success = data.get("success", True)
            clients = data.get("clients", [])
            error = data.get("error")
        elif isinstance(data, list):
            success = True
            clients = data
            error = None
        else:
            success = False
            clients = []
            error = "Invalid response format"
            
        return ClientsListResponse(
            success=success,
            clients=clients,
            count=len(clients),
            error=error
        )
        
    except requests.RequestException as e:
        raise HTTPException(
            status_code=503, 
            detail=f"Failed to connect to backend: {str(e)}"
        )
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=502, 
            detail=f"Invalid response from backend: {str(e)}"
        )

@app.get("/client/{client_id}", response_model=FrameResponse)
async def get_client_frame(
    client_id: str, 
    backend_url: str = Query(DEFAULT_BACKEND_URL, description="Backend API URL")
):
    """
    Get the latest frame data for a specific client ID.
    
    Args:
        client_id: The client ID to fetch frame for
        backend_url: Base URL of the SkySentry API (default: https://demo8080.shivi.io/api)
        
    Returns:
        Complete frame data including base64 image, timestamp, size, and stats
    """
    try:
        response = requests.get(f"{backend_url}/clients/{client_id}/latest", timeout=10)
        response.raise_for_status()
        
        data = response.json()
        if not data.get("success", False):
            return FrameResponse(
                success=False,
                client_id=client_id,
                error=data.get("error", "No frame available")
            )
            
        return FrameResponse(
            success=True,
            client_id=data.get("clientId", client_id),
            image=data.get("image"),  # Already base64 encoded with data URL prefix
            timestamp=data.get("timestamp"),
            size=data.get("size"),
            stats=data.get("stats", {})
        )
        
    except requests.RequestException as e:
        raise HTTPException(
            status_code=503, 
            detail=f"Failed to connect to backend for client {client_id}: {str(e)}"
        )
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=502, 
            detail=f"Invalid response from backend for client {client_id}: {str(e)}"
        )

@app.get("/client/{client_id}/info", response_model=ClientInfo)
async def get_client_info(
    client_id: str, 
    backend_url: str = Query(DEFAULT_BACKEND_URL, description="Backend API URL")
):
    """
    Get frame metadata for a specific client ID (without image data).
    
    Args:
        client_id: The client ID to fetch info for
        backend_url: Base URL of the SkySentry API (default: https://demo8080.shivi.io/api)
        
    Returns:
        Frame metadata including timestamp, size, and buffer stats
    """
    try:
        response = requests.get(f"{backend_url}/clients/{client_id}/latest", timeout=10)
        response.raise_for_status()
        
        data = response.json()
        if not data.get("success", False):
            raise HTTPException(
                status_code=404, 
                detail=f"No frame data available for client {client_id}"
            )
            
        return ClientInfo(
            client_id=data.get("clientId", client_id),
            timestamp=data.get("timestamp"),
            size=data.get("size"),
            stats=data.get("stats", {})
        )
        
    except requests.RequestException as e:
        raise HTTPException(
            status_code=503, 
            detail=f"Failed to connect to backend for client {client_id}: {str(e)}"
        )
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=502, 
            detail=f"Invalid response from backend for client {client_id}: {str(e)}"
        )

@app.get("/ai/process/{client_id}", response_model=AIProcessingResponse)
async def process_client_with_ai(client_id: str):
    """
    Process the latest frame from a client ID with AI object detection using YOLO.
    
    This endpoint:
    1. Fetches the latest frame from the specified client ID
    2. Runs YOLO object detection and tracking 
    3. Returns detected objects with bounding boxes, labels, and tracking IDs
    
    Args:
        client_id: The client ID to process with AI
        
    Returns:
        AI processing results with detected objects, bounding boxes, labels, and tracking info
    """
    try:
        # Call your existing AI processing function
        detections = get_res_for_id(client_id)
        
        if detections is None:
            return AIProcessingResponse(
                success=False,
                client_id=client_id,
                error="No frame available or AI processing failed"
            )
        
        # Handle case where detections is empty list
        if isinstance(detections, list) and len(detections) == 0:
            return AIProcessingResponse(
                success=True,
                client_id=client_id,
                detections=[],
                detection_count=0
            )
            
        return AIProcessingResponse(
            success=True,
            client_id=client_id,
            detections=detections if isinstance(detections, list) else [detections],
            detection_count=len(detections) if isinstance(detections, list) else 1
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"AI processing failed for client {client_id}: {str(e)}"
        )

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "SkySentry AI Processing API",
        "backend_url": DEFAULT_BACKEND_URL
    }

if __name__ == "__main__":
    uvicorn.run(
        "server:app", 
        host=FASTAPI_HOST, 
        port=FASTAPI_PORT, 
        reload=FASTAPI_RELOAD,
        log_level=LOG_LEVEL
    )

