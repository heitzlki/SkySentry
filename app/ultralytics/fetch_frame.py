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
    print(f"[DEBUG] Fetching clients from {api_url}")
    
    try:
        url = f"{api_url}/clients"
        print(f"[DEBUG] Making GET request to: {url}")
        response = requests.get(url, timeout=5)
        print(f"[DEBUG] Response status code: {response.status_code}")
        response.raise_for_status()
        
        print(f"[DEBUG] Parsing JSON response")
        data = response.json()
        
        if isinstance(data, dict):
            if not data.get("success", False):
                error_msg = data.get("error", "Unknown error")
                print(f"[ERROR] API error fetching clients: {error_msg}")
                raise ValueError(f"API error: {error_msg}")
            clients = data.get("clients", [])
        else:
            # Backend returns list directly
            clients = data if isinstance(data, list) else []
        
        print(f"[DEBUG] Found {len(clients)} clients: {clients}")
        return clients
        
    except requests.RequestException as e:
        print(f"[ERROR] Request exception fetching clients: {e}")
        print(f"[DEBUG] Exception type: {type(e).__name__}")
        return []
    except json.JSONDecodeError as e:
        print(f"[ERROR] JSON decode error fetching clients: {e}")
        print(f"[DEBUG] Response text: {response.text if 'response' in locals() else 'No response'}")
        return []
    except Exception as e:
        print(f"[ERROR] Unexpected exception in get_clients: {e}")
        print(f"[DEBUG] Exception type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
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
    print(f"[DEBUG] Fetching frame for client {client_id} from {api_url}")
    
    try:
        url = f"{api_url}/clients/{client_id}/latest"
        print(f"[DEBUG] Making GET request to: {url}")
        response = requests.get(url, timeout=5)
        print(f"[DEBUG] Response status code: {response.status_code}")
        response.raise_for_status()
        
        print(f"[DEBUG] Parsing JSON response for client {client_id}")
        data = response.json()
        print(f"[DEBUG] Response data keys: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}")
        
        # Check if image data is present (backend doesn't send 'success' field)
        if "image" not in data or not data.get("image"):
            print(f"[ERROR] No image data in response for client {client_id}")
            print(f"[DEBUG] Full response data: {data}")
            return None
            
        # Extract base64 image data
        image_data = data.get("image")
        print(f"[DEBUG] Image data length: {len(image_data)} for client {client_id}")
        
        # Remove data URL prefix if present (data:image/jpeg;base64,)
        if image_data.startswith("data:image/jpeg;base64,"):
            image_data = image_data.split(",", 1)[1]
            print(f"[DEBUG] Removed data URL prefix for JPEG")
        elif image_data.startswith("data:image/png;base64,"):
            image_data = image_data.split(",", 1)[1]
            print(f"[DEBUG] Removed data URL prefix for PNG")
            
        print(f"[DEBUG] Decoding base64 for client {client_id}")
        image_bytes = base64.b64decode(image_data)
        print(f"[DEBUG] Decoded bytes length: {len(image_bytes)}")
        
        print(f"[DEBUG] Opening image with PIL for client {client_id}")
        image = Image.open(BytesIO(image_bytes))
        print(f"[DEBUG] Image opened: size={image.size}, mode={image.mode}")
        
        return image
        
    except requests.RequestException as e:
        print(f"[ERROR] Request exception fetching frame for client {client_id}: {e}")
        print(f"[DEBUG] Exception type: {type(e).__name__}")
        return None
    except json.JSONDecodeError as e:
        print(f"[ERROR] JSON decode error for client {client_id}: {e}")
        print(f"[DEBUG] Response text: {response.text if 'response' in locals() else 'No response'}")
        return None
    except base64.binascii.Error as e:
        print(f"[ERROR] Base64 decode error for client {client_id}: {e}")
        return None
    except IOError as e:
        print(f"[ERROR] Image processing error for client {client_id}: {e}")
        return None
    except Exception as e:
        print(f"[ERROR] Unexpected exception in get_frame for client {client_id}: {e}")
        print(f"[DEBUG] Exception type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
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