'use client';

import { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MapPin,
  Camera,
  AlertTriangle,
  Activity,
  Satellite,
  Layers,
  Filter,
  RotateCcw,
  Crosshair,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';

import 'mapbox-gl/dist/mapbox-gl.css';

// Mock camera data
const mockCameras = [
  {
    id: 'cam-001',
    name: 'North Perimeter',
    coordinates: [-122.4194, 37.7749] as [number, number],
    status: 'online' as const,
    lastDetection: new Date(Date.now() - 5 * 60 * 1000),
  },
  {
    id: 'cam-002',
    name: 'South Entrance',
    coordinates: [-122.4234, 37.7689] as [number, number],
    status: 'online' as const,
    lastDetection: new Date(Date.now() - 2 * 60 * 1000),
  },
  {
    id: 'cam-003',
    name: 'East Tower',
    coordinates: [-122.4154, 37.7789] as [number, number],
    status: 'offline' as const,
    lastDetection: new Date(Date.now() - 30 * 60 * 1000),
  },
  {
    id: 'cam-004',
    name: 'West Parking',
    coordinates: [-122.4254, 37.7709] as [number, number],
    status: 'online' as const,
    lastDetection: new Date(Date.now() - 1 * 60 * 1000),
  },
];

// Mock detection events
const mockDetections = [
  {
    id: 'det-001',
    cameraId: 'cam-001',
    type: 'drone',
    coordinates: [-122.4184, 37.7759] as [number, number],
    dangerLevel: 'high' as 'high' | 'medium' | 'low',
    timestamp: new Date(Date.now() - 3 * 60 * 1000),
  },
  {
    id: 'det-002',
    cameraId: 'cam-002',
    type: 'bird',
    coordinates: [-122.4224, 37.7699] as [number, number],
    dangerLevel: 'low' as 'high' | 'medium' | 'low',
    timestamp: new Date(Date.now() - 8 * 60 * 1000),
  },
];

export default function Map() {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [locationStatus, setLocationStatus] = useState<
    'loading' | 'success' | 'error' | 'denied'
  >('loading');
  const [selectedLayer, setSelectedLayer] = useState<
    'cameras' | 'detections' | 'both'
  >('both');
  const [showStats, setShowStats] = useState(true);

  // Real-time data states
  const [cameras, setCameras] = useState(mockCameras);
  const [detections, setDetections] = useState(mockDetections);
  const cameraMarkersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const detectionMarkersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});

  // WebSocket connection for real-time updates
  const { isConnected, lastMessage, connectionError } = useWebSocket(
    'ws://localhost:8000/ws'
  );

  // Function to create camera marker
  const createCameraMarker = (
    camera: (typeof mockCameras)[0],
    map: mapboxgl.Map
  ) => {
    const color = camera.status === 'online' ? '#10b981' : '#ef4444';

    const el = document.createElement('div');
    el.className = 'camera-marker';
    el.style.cssText = `
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background-color: ${color};
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      cursor: pointer;
      transition: transform 0.2s;
    `;

    el.addEventListener('mouseenter', () => {
      el.style.transform = 'scale(1.2)';
    });

    el.addEventListener('mouseleave', () => {
      el.style.transform = 'scale(1)';
    });

    const marker = new mapboxgl.Marker(el)
      .setLngLat(camera.coordinates)
      .setPopup(
        new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div class="p-2">
            <h3 class="font-semibold">${camera.name}</h3>
            <p class="text-sm text-gray-600">Status: ${camera.status}</p>
            <p class="text-sm text-gray-600">Last Detection: ${camera.lastDetection.toLocaleTimeString()}</p>
          </div>
        `)
      )
      .addTo(map);

    return marker;
  };

  // Function to create detection marker
  const createDetectionMarker = (
    detection: (typeof mockDetections)[0],
    map: mapboxgl.Map
  ) => {
    const color =
      detection.dangerLevel === 'high'
        ? '#ef4444'
        : detection.dangerLevel === 'medium'
        ? '#f59e0b'
        : '#10b981';

    const el = document.createElement('div');
    el.className = 'detection-marker';
    el.style.cssText = `
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background-color: ${color};
      border: 2px solid white;
      box-shadow: 0 0 10px ${color}50;
      cursor: pointer;
      animation: pulse 2s infinite;
    `;

    // Add pulse animation if not already added
    if (!document.getElementById('pulse-animation')) {
      const style = document.createElement('style');
      style.id = 'pulse-animation';
      style.textContent = `
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    const marker = new mapboxgl.Marker(el)
      .setLngLat(detection.coordinates)
      .setPopup(
        new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div class="p-2">
            <h3 class="font-semibold">${detection.type.toUpperCase()} Detected</h3>
            <p class="text-sm text-gray-600">Danger Level: ${
              detection.dangerLevel
            }</p>
            <p class="text-sm text-gray-600">Camera: ${detection.cameraId}</p>
            <p class="text-sm text-gray-600">Time: ${detection.timestamp.toLocaleTimeString()}</p>
          </div>
        `)
      )
      .addTo(map);

    return marker;
  };

  // Update camera markers based on current state
  const updateCameraMarkers = (map: mapboxgl.Map) => {
    // Remove existing markers
    Object.values(cameraMarkersRef.current).forEach((marker) =>
      marker.remove()
    );
    cameraMarkersRef.current = {};

    // Add new markers based on layer selection
    if (selectedLayer === 'cameras' || selectedLayer === 'both') {
      cameras.forEach((camera) => {
        cameraMarkersRef.current[camera.id] = createCameraMarker(camera, map);
      });
    }
  };

  // Update detection markers based on current state
  const updateDetectionMarkers = (map: mapboxgl.Map) => {
    // Remove existing markers
    Object.values(detectionMarkersRef.current).forEach((marker) =>
      marker.remove()
    );
    detectionMarkersRef.current = {};

    // Add new markers based on layer selection
    if (selectedLayer === 'detections' || selectedLayer === 'both') {
      detections.forEach((detection) => {
        detectionMarkersRef.current[detection.id] = createDetectionMarker(
          detection,
          map
        );
      });
    }
  };

  useEffect(() => {
    mapboxgl.accessToken =
      'pk.eyJ1IjoiaGVpdHpsa2kiLCJhIjoiY21hbWJvNjhzMGloNDJrc2Rvczdnbmt1YyJ9.FtALe_X3213qHeZmaL0hwQ';

    if (mapContainerRef.current) {
      const defaultCenter: [number, number] = [-122.4194, 37.7749];

      mapRef.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/heitzlki/cmfrmv39r00lf01quemcj7xxn',
        projection: 'globe',
        attributionControl: false,
        center: defaultCenter,
        zoom: 13,
        pitch: 45,
        bearing: 0,
      });

      // Add navigation controls
      mapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Add fullscreen control
      mapRef.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');

      // Add scale control
      mapRef.current.addControl(new mapboxgl.ScaleControl(), 'bottom-left');

      mapRef.current.on('load', () => {
        const map = mapRef.current;
        if (!map) return;

        // Add geofence circle around perimeter
        const center: [number, number] = [-122.4194, 37.7749];
        const radius = 2000; // 2km radius

        // Add circle source
        map.addSource('geofence', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: center,
            },
            properties: {
              radius: radius,
            },
          },
        });

        // Add circle layer
        map.addLayer({
          id: 'geofence-circle',
          type: 'circle',
          source: 'geofence',
          paint: {
            'circle-radius': {
              stops: [
                [0, 0],
                [20, radius],
              ],
            },
            'circle-color': '#3b82f6',
            'circle-opacity': 0.1,
            'circle-stroke-color': '#3b82f6',
            'circle-stroke-width': 2,
            'circle-stroke-opacity': 0.3,
          },
        });

        // Initial marker setup
        updateCameraMarkers(map);
        updateDetectionMarkers(map);
      });

      // Request user's location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userLocation: [number, number] = [
              position.coords.longitude,
              position.coords.latitude,
            ];
            setLocationStatus('success');

            if (mapRef.current) {
              mapRef.current.flyTo({
                center: userLocation,
                zoom: 14,
                pitch: 45,
                bearing: 0,
                speed: 0.8,
                curve: 1.0,
                essential: true,
                duration: 4000,
              });
            }
          },
          (error) => {
            console.error('Error getting user location:', error);
            setLocationStatus(
              error.code === error.PERMISSION_DENIED ? 'denied' : 'error'
            );
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000,
          }
        );
      } else {
        setLocationStatus('error');
      }
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, []);

  // Handle WebSocket messages for real-time updates
  useEffect(() => {
    if (lastMessage && mapRef.current) {
      const map = mapRef.current;

      switch (lastMessage.type) {
        case 'camera_status':
          // Update camera status
          setCameras((prevCameras) =>
            prevCameras.map((camera) =>
              camera.id === lastMessage.data.camera_id
                ? {
                    ...camera,
                    status: lastMessage.data.status as 'online' | 'offline',
                    lastDetection: new Date(lastMessage.data.timestamp),
                  }
                : camera
            )
          );
          break;

        case 'detection':
          // Add new detection
          const newDetection = {
            id: lastMessage.data.id,
            cameraId: lastMessage.data.camera_id,
            type: lastMessage.data.object_type,
            coordinates: [
              lastMessage.data.longitude,
              lastMessage.data.latitude,
            ] as [number, number],
            dangerLevel: lastMessage.data.danger_level as
              | 'high'
              | 'medium'
              | 'low',
            timestamp: new Date(lastMessage.data.timestamp),
          };

          setDetections((prev) => [...prev, newDetection]);

          // Add new detection marker immediately
          if (selectedLayer === 'detections' || selectedLayer === 'both') {
            const marker = createDetectionMarker(newDetection, map);
            detectionMarkersRef.current[newDetection.id] = marker;

            // Auto-pan to new detection if it's high priority
            if (newDetection.dangerLevel === 'high') {
              map.flyTo({
                center: newDetection.coordinates,
                zoom: 15,
                duration: 1000,
              });
            }
          }
          break;

        case 'system_update':
          // Handle system-wide updates
          if (lastMessage.data.cameras) {
            setCameras(lastMessage.data.cameras);
          }
          if (lastMessage.data.detections) {
            setDetections(lastMessage.data.detections);
          }
          break;
      }
    }
  }, [lastMessage, selectedLayer]);

  // Update markers when layer selection changes
  useEffect(() => {
    if (mapRef.current) {
      updateCameraMarkers(mapRef.current);
      updateDetectionMarkers(mapRef.current);
    }
  }, [selectedLayer, cameras, detections]);

  // Update markers when cameras change
  useEffect(() => {
    if (mapRef.current) {
      updateCameraMarkers(mapRef.current);
    }
  }, [cameras]);

  // Update markers when detections change
  useEffect(() => {
    if (mapRef.current) {
      updateDetectionMarkers(mapRef.current);
    }
  }, [detections]);

  const centerOnUser = () => {
    if (navigator.geolocation && mapRef.current) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLocation: [number, number] = [
            position.coords.longitude,
            position.coords.latitude,
          ];
          mapRef.current?.flyTo({
            center: userLocation,
            zoom: 15,
            pitch: 45,
            duration: 2000,
          });
        },
        (error) => {
          console.error('Error getting user location:', error);
        }
      );
    }
  };

  const resetView = () => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [-122.4194, 37.7749],
        zoom: 13,
        pitch: 45,
        bearing: 0,
        duration: 2000,
      });
    }
  };

  return (
    <div className='relative h-screen w-screen'>
      {/* Map Controls */}
      <div className='absolute top-4 left-4 z-10 space-y-2'>
        <Card className='w-80 bg-card border-border text-foreground'>
          <CardHeader>
            <div className='flex items-center gap-2'>
              <Satellite className='h-6 w-6' />
              <CardTitle className='text-foreground'>SkySentry Map</CardTitle>
            </div>
          </CardHeader>
          <CardContent className='space-y-3'>
            {/* Layer Controls */}
            <div className='space-y-2'>
              <label className='text-sm font-medium text-foreground'>
                Map Layers
              </label>
              <Tabs
                value={selectedLayer}
                onValueChange={(value) =>
                  setSelectedLayer(value as 'cameras' | 'detections' | 'both')
                }>
                <TabsList className='grid w-full grid-cols-3 bg-card border border-border p-1 rounded-lg'>
                  <TabsTrigger
                    value='cameras'
                    className='data-[state=active]:bg-accent text-foreground data-[state=active]:text-foreground text-xs'>
                    <Camera className='h-3 w-3 mr-1' />
                    Cameras
                  </TabsTrigger>
                  <TabsTrigger
                    value='detections'
                    className='data-[state=active]:bg-accent text-foreground data-[state=active]:text-foreground text-xs'>
                    <AlertTriangle className='h-3 w-3 mr-1' />
                    Events
                  </TabsTrigger>
                  <TabsTrigger
                    value='both'
                    className='data-[state=active]:bg-accent text-foreground data-[state=active]:text-foreground text-xs'>
                    <Layers className='h-3 w-3 mr-1' />
                    Both
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Action Buttons */}
            <div className='flex gap-2'>
              <Button
                size='sm'
                variant='ghost'
                onClick={centerOnUser}
                className='text-foreground hover:text-foreground hover:bg-accent'>
                <Crosshair className='h-4 w-4 mr-2' />
                My Location
              </Button>
              <Button
                size='sm'
                variant='ghost'
                onClick={resetView}
                className='text-foreground hover:text-foreground hover:bg-accent'>
                <RotateCcw className='h-4 w-4 mr-2' />
                Reset
              </Button>
            </div>

            {/* Real-time Connection Status */}
            <div className='space-y-2 pt-2 border-t border-border'>
              <div className='flex items-center justify-between text-sm text-foreground'>
                <span className='flex items-center gap-1'>
                  {isConnected ? (
                    <Wifi className='h-4 w-4 text-green-400' />
                  ) : (
                    <WifiOff className='h-4 w-4 text-red-400' />
                  )}
                  Live Connection
                </span>
                <div
                  className={`px-2 py-1 rounded-full text-xs ${
                    isConnected
                      ? 'bg-green-500/20 border border-green-400/30 text-green-300'
                      : 'bg-red-500/20 border border-red-400/30 text-red-300'
                  }`}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </div>
              </div>
              {connectionError && (
                <div className='text-xs text-red-300 bg-red-500/10 border border-red-400/30 p-2 rounded'>
                  {connectionError}
                </div>
              )}
            </div>

            {/* Status Overview */}
            <div className='space-y-2 pt-2 border-t border-border'>
              <div className='flex items-center justify-between text-sm text-foreground'>
                <span className='flex items-center gap-1'>
                  <div className='w-2 h-2 rounded-full bg-green-400 animate-pulse' />
                  Online Cameras
                </span>
                <span className='font-medium text-foreground'>
                  {cameras.filter((c) => c.status === 'online').length}
                </span>
              </div>
              <div className='flex items-center justify-between text-sm text-foreground'>
                <span className='flex items-center gap-1'>
                  <div className='w-2 h-2 rounded-full bg-red-400' />
                  Active Detections
                </span>
                <span className='font-medium text-foreground'>
                  {detections.length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Real-time Stats */}
        {showStats && (
          <Card className='w-80 bg-card border-border text-foreground'>
            <CardHeader>
              <div className='flex items-center gap-2'>
                <Activity className='h-6 w-6' />
                <CardTitle className='text-foreground'>Live Activity</CardTitle>
              </div>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-foreground'>High Priority</span>
                  <div className='px-2 py-1 bg-red-500/20 border border-red-400/30 rounded-full text-red-300 text-xs'>
                    {detections.filter((d) => d.dangerLevel === 'high').length}
                  </div>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-foreground'>
                    Medium Priority
                  </span>
                  <div className='px-2 py-1 bg-yellow-500/20 border border-yellow-400/30 rounded-full text-yellow-300 text-xs'>
                    {
                      detections.filter((d) => d.dangerLevel === 'medium')
                        .length
                    }
                  </div>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-foreground'>Low Priority</span>
                  <div className='px-2 py-1 bg-green-500/20 border border-green-400/30 rounded-full text-green-300 text-xs'>
                    {detections.filter((d) => d.dangerLevel === 'low').length}
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className='pt-2 border-t border-border'>
                <p className='text-xs text-muted-foreground mb-2'>
                  Recent Activity
                </p>
                <div className='space-y-1 max-h-24 overflow-y-auto'>
                  {detections
                    .sort(
                      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
                    )
                    .slice(0, 5)
                    .map((detection) => (
                      <div
                        key={detection.id}
                        className='flex items-center justify-between text-xs'>
                        <span className='truncate max-w-[100px] text-foreground'>
                          {detection.type}
                        </span>
                        <div
                          className={`px-2 py-1 rounded-full text-xs ${
                            detection.dangerLevel === 'high'
                              ? 'bg-red-500/20 border border-red-400/30 text-red-300'
                              : detection.dangerLevel === 'medium'
                              ? 'bg-yellow-500/20 border border-yellow-400/30 text-yellow-300'
                              : 'bg-green-500/20 border border-green-400/30 text-green-300'
                          }`}>
                          {detection.dangerLevel}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Location status indicator */}
      {locationStatus === 'loading' && (
        <div className='absolute top-4 right-4 z-10 bg-black/70 text-foreground px-3 py-2 rounded-md text-sm'>
          Getting your location...
        </div>
      )}
      {locationStatus === 'denied' && (
        <div className='absolute top-4 right-4 z-10 bg-orange-600/90 text-foreground px-3 py-2 rounded-md text-sm'>
          Location access denied. Using default location.
        </div>
      )}
      {locationStatus === 'error' && (
        <div className='absolute top-4 right-4 z-10 bg-red-600/90 text-foreground px-3 py-2 rounded-md text-sm'>
          Could not get location. Using default location.
        </div>
      )}

      {/* Map container */}
      <div
        className='h-full w-full relative overflow-hidden cursor-none z-0'
        ref={mapContainerRef}
      />
    </div>
  );
}
