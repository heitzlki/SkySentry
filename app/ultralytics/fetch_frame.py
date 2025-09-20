import requests
import base64
from PIL import Image
from io import BytesIO
from typing import List, Optional
import json

# Default API base URL - can be overridden
DEFAULT_API_URL = "https://demo8080.shivi.io/api"

def get_clients(api_url: str = DEFAULT_API_URL) -> List[str]:
    """
    Get list of all connected client IDs from the Golang backend.
    
    Args:
        api_url: Base URL of the SkySentry API (default: https://demo8080.shivi.io/api)
        
    Returns:
        List of client ID strings
        
    Raises:
        requests.RequestException: If API request fails
        ValueError: If API response is invalid
    """
    try:
        response = requests.get(f"{api_url}/clients", timeout=5)
        response.raise_for_status()
        
        data = response.json()
        if not data.get("success", False):
            raise ValueError(f"API error: {data.get('error', 'Unknown error')}")
            
        return data.get("clients", [])
        
    except requests.RequestException as e:
        print(f"Error fetching clients: {e}")
        return []
    except json.JSONDecodeError as e:
        print(f"Error parsing response: {e}")
        return []

def get_frame(client_id: str, api_url: str = DEFAULT_API_URL) -> Optional[Image.Image]:
    """
    Get the latest frame (image) for a specific client ID.
    
    Args:
        client_id: The client ID to fetch frame for
        api_url: Base URL of the SkySentry API (default: https://demo8080.shivi.io/api)
        
    Returns:
        PIL Image object if successful, None if no frame available or error
        
    Raises:
        requests.RequestException: If API request fails
        ValueError: If API response is invalid
    """
    try:
        response = requests.get(f"{api_url}/clients/{client_id}/latest", timeout=5)
        response.raise_for_status()
        
        data = response.json()
        if not data.get("success", False):
            print(f"No frame available for client {client_id}: {data.get('error', 'Unknown error')}")
            return None
            
        # Extract base64 image data
        image_data = data.get("image")
        if not image_data:
            print(f"No image data for client {client_id}")
            return None
            
        # Remove data URL prefix if present (data:image/jpeg;base64,)
        if image_data.startswith("data:image/jpeg;base64,"):
            image_data = image_data.split(",", 1)[1]
        elif image_data.startswith("data:image/png;base64,"):
            image_data = image_data.split(",", 1)[1]
            
        # Decode base64 and convert to PIL Image
        image_bytes = base64.b64decode(image_data)
        image = Image.open(BytesIO(image_bytes))
        
        return image
        
    except requests.RequestException as e:
        print(f"Error fetching frame for client {client_id}: {e}")
        return None
    except (json.JSONDecodeError, base64.binascii.Error, IOError) as e:
        print(f"Error processing frame data for client {client_id}: {e}")
        return None

def get_frame_info(client_id: str, api_url: str = DEFAULT_API_URL) -> Optional[dict]:
    """
    Get frame metadata for a specific client ID.
    
    Args:
        client_id: The client ID to fetch frame info for
        api_url: Base URL of the SkySentry API (default: https://demo8080.shivi.io/api)
        
    Returns:
        Dictionary with frame metadata (timestamp, size, stats) if successful, None otherwise
    """
    try:
        response = requests.get(f"{api_url}/clients/{client_id}/latest", timeout=5)
        response.raise_for_status()
        
        data = response.json()
        if not data.get("success", False):
            return None
            
        # Return metadata without the image data
        return {
            "client_id": data.get("clientId"),
            "timestamp": data.get("timestamp"),
            "size": data.get("size"),
            "stats": data.get("stats", {})
        }
        
    except (requests.RequestException, json.JSONDecodeError) as e:
        print(f"Error fetching frame info for client {client_id}: {e}")
        return None

# Example usage
if __name__ == "__main__":
    # Test the functions
    print("Testing SkySentry frame fetching...")
    
    # Get all clients
    clients = get_clients()
    print(f"Found {len(clients)} clients: {clients}")
    
    # Try to get frame for each client
    for client_id in clients:
        print(f"\nFetching frame for client: {client_id}")
        
        # Get frame info
        info = get_frame_info(client_id)
        if info:
            print(f"  Timestamp: {info['timestamp']}")
            print(f"  Size: {info['size']} bytes")
            print(f"  Stats: {info['stats']}")
        
        # Get actual frame
        frame = get_frame(client_id)
        if frame:
            print(f"  Image: {frame.size} pixels, mode: {frame.mode}")
        else:
            print(f"  No frame available")