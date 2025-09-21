'use client';

import { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { TrendingUp, Camera, Eye, Target } from 'lucide-react';
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

import {
  Status,
  StatusIndicator,
  StatusLabel,
} from '@/components/ui/shadcn-io/status';

import 'mapbox-gl/dist/mapbox-gl.css';

// Computer vision detection data
const detectionData = [
  { category: '🚁 Drone', confidence: 88 },
  { category: '🐦 Bird', confidence: 75 },
  { category: '🎈 Balloon', confidence: 80 },
  { category: '✈️ Aircraft', confidence: 94 },
  { category: '🚁 Heli', confidence: 85 },
  { category: '🪁 Kite', confidence: 70 },
];

// Moving object types with spawn weights
const objectTypes = [
  { name: 'Drone', emoji: '🚁', color: '#ff4444', weight: 1 },
  { name: 'Bird', emoji: '🐦', color: '#44ff44', weight: 8 }, // Much higher spawn rate for birds
  { name: 'Aircraft', emoji: '✈️', color: '#4444ff', weight: 1 },
  { name: 'Balloon', emoji: '🎈', color: '#ffff44', weight: 1 },
];

// Function to get weighted random object type
const getWeightedRandomObjectType = () => {
  const totalWeight = objectTypes.reduce((sum, type) => sum + type.weight, 0);
  let random = Math.random() * totalWeight;

  for (const type of objectTypes) {
    random -= type.weight;
    if (random <= 0) {
      return type;
    }
  }

  return objectTypes[0]; // Fallback
};

// Moving object interface
interface MovingObject {
  id: string;
  type: string;
  emoji: string;
  color: string;
  startPoint: [number, number];
  endPoint: [number, number];
  currentPoint: [number, number];
  progress: number;
  element: HTMLElement;
  label: HTMLElement;
}

const chartConfig = {
  confidence: {
    label: 'Detection Confidence %',
    color: '#37FF8B',
  },
} satisfies ChartConfig;

// Function to generate random points within a radius
function generateRandomPointsAroundLocation(
  centerLng: number,
  centerLat: number,
  minRadius: number = 20,
  maxRadius: number = 150,
  count: number = 3
): [number, number][] {
  const points: [number, number][] = [];

  for (let i = 0; i < count; i++) {
    // Random angle in radians
    const angle = Math.random() * 2 * Math.PI;

    // Random radius between min and max (in meters)
    const radius = minRadius + Math.random() * (maxRadius - minRadius);

    // Convert radius from meters to degrees (approximate)
    // 1 degree ≈ 111,320 meters at equator
    const radiusInDegrees = radius / 111320;

    // Calculate new coordinates
    const deltaLat = radiusInDegrees * Math.cos(angle);
    const deltaLng =
      (radiusInDegrees * Math.sin(angle)) /
      Math.cos((centerLat * Math.PI) / 180);

    const newLng = centerLng + deltaLng;
    const newLat = centerLat + deltaLat;

    points.push([newLng, newLat]);
  }

  return points;
}

export default function Map() {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const randomMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const movingObjectsRef = useRef<MovingObject[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const spawnIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [locationStatus, setLocationStatus] = useState<
    'loading' | 'success' | 'error' | 'denied'
  >('loading');
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isZoomComplete, setIsZoomComplete] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Handle client-side hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Update time on client side only
  useEffect(() => {
    if (!isClient) return;

    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString());
    };

    updateTime(); // Set initial time
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, [isClient]);

  // Function to create a moving object
  const createMovingObject = () => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const bounds = map.getBounds();

    // Check if bounds is valid
    if (!bounds) return;

    // Get random object type using weighted system
    const objectType = getWeightedRandomObjectType();

    // Generate random start and end points at opposite edges of the viewport
    const isHorizontal = Math.random() > 0.5;
    let startPoint: [number, number];
    let endPoint: [number, number];

    if (isHorizontal) {
      // Move horizontally across the screen
      const lat =
        bounds.getSouth() +
        Math.random() * (bounds.getNorth() - bounds.getSouth());
      startPoint = [bounds.getWest(), lat];
      endPoint = [bounds.getEast(), lat];
    } else {
      // Move vertically across the screen
      const lng =
        bounds.getWest() +
        Math.random() * (bounds.getEast() - bounds.getWest());
      startPoint = [lng, bounds.getNorth()];
      endPoint = [lng, bounds.getSouth()];
    }

    // Randomly decide direction
    if (Math.random() > 0.5) {
      [startPoint, endPoint] = [endPoint, startPoint];
    }

    // Create object element
    const objectElement = document.createElement('div');
    objectElement.className = 'moving-object';
    objectElement.style.cssText = `
      width: 8px;
      height: 8px;
      background-color: ${objectType.color};
      border-radius: 50%;
      border: 1px solid rgba(255, 255, 255, 0.8);
      position: absolute;
      z-index: 1000;
      box-shadow: 0 0 8px ${objectType.color}40;
      transition: none;
    `;

    // Create label element
    const labelElement = document.createElement('div');
    labelElement.className = 'object-label';
    labelElement.textContent = `${objectType.emoji} ${objectType.name}`;
    labelElement.style.cssText = `
      position: absolute;
      font-size: 10px;
      color: white;
      background: rgba(0, 0, 0, 0.7);
      padding: 1px 4px;
      border-radius: 3px;
      white-space: nowrap;
      pointer-events: none;
      left: 12px;
      top: -2px;
      border: 1px solid ${objectType.color}60;
      font-weight: 500;
    `;

    objectElement.appendChild(labelElement);
    map.getContainer().appendChild(objectElement);

    const movingObject: MovingObject = {
      id: Math.random().toString(36).substr(2, 9),
      type: objectType.name,
      emoji: objectType.emoji,
      color: objectType.color,
      startPoint,
      endPoint,
      currentPoint: startPoint,
      progress: 0,
      element: objectElement,
      label: labelElement,
    };

    movingObjectsRef.current.push(movingObject);
  };

  // Function to update moving objects positions
  const updateMovingObjects = () => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const objectsToRemove: string[] = [];

    movingObjectsRef.current.forEach((obj) => {
      // Update progress (drastically increased speed)
      obj.progress += 0.002; // Increased from 0.002 to 0.015 - 7.5x faster

      if (obj.progress >= 1) {
        // Object has reached the end, mark for removal
        objectsToRemove.push(obj.id);
        obj.element.remove();
        return;
      }

      // Calculate current position using linear interpolation
      const lng =
        obj.startPoint[0] +
        (obj.endPoint[0] - obj.startPoint[0]) * obj.progress;
      const lat =
        obj.startPoint[1] +
        (obj.endPoint[1] - obj.startPoint[1]) * obj.progress;
      obj.currentPoint = [lng, lat];

      // Convert coordinates to screen position
      const point = map.project([lng, lat]);

      // Update element position
      obj.element.style.left = `${point.x - 4}px`;
      obj.element.style.top = `${point.y - 4}px`;
    });

    // Remove completed objects
    objectsToRemove.forEach((id) => {
      movingObjectsRef.current = movingObjectsRef.current.filter(
        (obj) => obj.id !== id
      );
    });
  };

  // Animation loop
  const animate = () => {
    updateMovingObjects();
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  // Function to start spawning objects
  const startObjectSpawning = () => {
    const spawnInterval = setInterval(() => {
      if (movingObjectsRef.current.length < 15) {
        // Increased from 5 to 15 concurrent objects
        createMovingObject();
      }
    }, 200 + Math.random() * 500); // Drastically increased: spawn every 200-700ms instead of 2-5 seconds

    return spawnInterval;
  };

  useEffect(() => {
    if (!isClient) return;

    mapboxgl.accessToken =
      'pk.eyJ1IjoiaGVpdHpsa2kiLCJhIjoiY21hbWJvNjhzMGloNDJrc2Rvczdnbmt1YyJ9.FtALe_X3213qHeZmaL0hwQ';

    if (mapContainerRef.current) {
      // Initialize map with global view - no random location
      mapRef.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/heitzlki/cmfrmv39r00lf01quemcj7xxn',
        projection: 'globe',
        attributionControl: false,
        center: [0, 20], // Centered on equator, slightly north for better view
        zoom: 1.5, // Global view of the entire world
        pitch: 0,
        bearing: 0,
      });

      // Start animation loop (but objects won't spawn until zoom is complete)
      animationFrameRef.current = requestAnimationFrame(animate);

      // Request user's location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userLocation: [number, number] = [
              position.coords.longitude,
              position.coords.latitude,
            ];

            setLocationStatus('success');

            // Only zoom and add markers after successful location confirmation
            if (mapRef.current) {
              // Remove existing markers if any
              if (markerRef.current) {
                markerRef.current.remove();
              }
              randomMarkersRef.current.forEach((marker) => marker.remove());
              randomMarkersRef.current = [];

              // Create main user location marker
              markerRef.current = new mapboxgl.Marker({
                color: '#ef4444', // Red color for user location
                scale: 1.5,
              })
                .setLngLat(userLocation)
                .addTo(mapRef.current);

              // Generate and add random points around user location
              const randomPoints = generateRandomPointsAroundLocation(
                userLocation[0],
                userLocation[1]
              );

              randomPoints.forEach((point, index) => {
                const marker = new mapboxgl.Marker({
                  color: '#22c55e', // Green color for random points
                  scale: 1.0,
                })
                  .setLngLat(point)
                  .addTo(mapRef.current!);

                randomMarkersRef.current.push(marker);
              });

              // Fly to user's location with dramatic global-to-local transition
              mapRef.current.flyTo({
                center: userLocation,
                zoom: 18, // Much higher zoom for street-level view
                pitch: 45, // Increase pitch for better 3D view
                bearing: 0,
                speed: 0.6, // Slower speed for dramatic effect
                curve: 1.2, // More curved trajectory
                essential: true,
                duration: 8000, // Longer duration for global to local transition
              });

              mapRef.current.once('moveend', () => {
                setIsZoomComplete(true);
                // Start spawning objects only after zoom is complete
                spawnIntervalRef.current = startObjectSpawning();
              });
            }
          },
          (error) => {
            console.error('Error getting user location:', error);

            if (error.code === error.PERMISSION_DENIED) {
              setLocationStatus('denied');
            } else {
              setLocationStatus('error');
            }

            // Stay at global view if geolocation fails - start spawning immediately for global view
            setIsZoomComplete(true);
            spawnIntervalRef.current = startObjectSpawning();
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000, // 5 minutes
          }
        );
      } else {
        // No geolocation support - start spawning immediately
        setIsZoomComplete(true);
        spawnIntervalRef.current = startObjectSpawning();
      }
    }

    // Cleanup function
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (spawnIntervalRef.current) {
        clearInterval(spawnIntervalRef.current);
      }
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, [isClient]);

  return (
    <div className='relative h-screen w-screen'>
      {/* Location status indicator */}
      {locationStatus === 'loading' && (
        <div className='absolute top-4 left-4 z-10 bg-black/70 text-white px-3 py-2 rounded-md text-sm'>
          Getting your location...
        </div>
      )}
      {locationStatus === 'denied' && (
        <div className='absolute top-4 left-4 z-10 bg-orange-600/90 text-white px-3 py-2 rounded-md text-sm'>
          Location access denied. Showing global view.
        </div>
      )}
      {locationStatus === 'error' && (
        <div className='absolute top-4 left-4 z-10 bg-red-600/90 text-white px-3 py-2 rounded-md text-sm'>
          Could not get location. Showing global view.
        </div>
      )}

      {/* Glassmorphism Computer Vision Info Card */}
      <div className='absolute top-4 right-4 z-10 w-80'>
        <Card className='bg-black/20 backdrop-blur-md border-white/20 text-white shadow-2xl'>
          <CardHeader className='items-center'>
            <CardTitle className='text-lg text-center justify-center items-center flex flex-col'>
              Analytics
              <Status status='safe' className='mt-2'>
                <StatusIndicator />
                <StatusLabel />
              </Status>
            </CardTitle>
          </CardHeader>
          <CardContent className=''>
            <ChartContainer
              config={chartConfig}
              className='mx-auto max-h-[240px]'>
              <RadarChart data={detectionData}>
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent className='bg-black/80 border-white/20 text-white' />
                  }
                />
                <PolarAngleAxis
                  dataKey='category'
                  tick={{ fill: 'white', fontSize: 11 }}
                />
                <PolarGrid stroke='#fff' />
                <Radar
                  dataKey='confidence'
                  fill='#37FF8B'
                  fillOpacity={0.3}
                  stroke='#37FF8B'
                  strokeWidth={2}
                  dot={{
                    r: 3,
                    fillOpacity: 1,
                    fill: '#37FF8B',
                  }}
                />
              </RadarChart>
            </ChartContainer>

            {/* Camera Stats */}
            <div className='mt-4 space-y-2 text-sm'>
              <div className='flex justify-between items-center'>
                <span className='text-gray-300'>Active Cameras:</span>
                <span className='font-semibold text-green-400'>3</span>
              </div>
              <div className='flex justify-between items-center'>
                <span className='text-gray-300'>Objects Detected:</span>
                <span className='font-semibold text-blue-400'>847</span>
              </div>
              <div className='flex justify-between items-center'>
                <span className='text-gray-300'>Processing FPS:</span>
                <span className='font-semibold text-yellow-400'>30.2</span>
              </div>
            </div>
          </CardContent>
          <CardFooter className='flex-col gap-2 text-xs pt-0'>
            <div className='flex items-center gap-2 leading-none font-medium text-green-400'>
              Detection accuracy up by 12.3% <TrendingUp className='h-3 w-3' />
            </div>
            <div className='text-gray-400 flex items-center gap-2 leading-none'>
              Last updated: {isClient ? currentTime : '--:--:--'}
            </div>
          </CardFooter>
        </Card>
      </div>

      <div
        className='h-full w-full relative overflow-hidden cursor-none z-0'
        ref={mapContainerRef}
      />
    </div>
  );
}
