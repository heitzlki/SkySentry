'use client';

import { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';

import 'mapbox-gl/dist/mapbox-gl.css';

export default function Map() {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [locationStatus, setLocationStatus] = useState<
    'loading' | 'success' | 'error' | 'denied'
  >('loading');

  useEffect(() => {
    mapboxgl.accessToken =
      'pk.eyJ1IjoiaGVpdHpsa2kiLCJhIjoiY21hbWJvNjhzMGloNDJrc2Rvczdnbmt1YyJ9.FtALe_X3213qHeZmaL0hwQ';

    if (mapContainerRef.current) {
      // Initialize map with a default location first
      const defaultCenter: [number, number] = [-74.5, 40];

      mapRef.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/heitzlki/cmfrmv39r00lf01quemcj7xxn',
        projection: 'globe',
        attributionControl: false,
        center: defaultCenter,
        zoom: 100,
        pitch: 0,
        bearing: 0,
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

            // Fly to user's location
            if (mapRef.current) {
              mapRef.current.flyTo({
                center: userLocation,
                zoom: 12,
                pitch: 30,
                bearing: 0,
                speed: 0.8,
                curve: 1.0,
                essential: true,
                duration: 6000,
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

            // Fallback to default location if geolocation fails
            if (mapRef.current) {
              mapRef.current.flyTo({
                center: defaultCenter,
                zoom: 12,
                pitch: 30,
                bearing: 0,
                speed: 0.8,
                curve: 1.0,
                essential: true,
                duration: 6000,
              });
            }
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000, // 5 minutes
          }
        );
      } else {
        setLocationStatus('error');
        console.error('Geolocation is not supported by this browser.');

        // Fallback to default location
        if (mapRef.current) {
          mapRef.current.flyTo({
            center: defaultCenter,
            zoom: 12,
            pitch: 30,
            bearing: 0,
            speed: 0.8,
            curve: 1.0,
            essential: true,
            duration: 6000,
          });
        }
      }
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, []);

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
          Location access denied. Using default location.
        </div>
      )}
      {locationStatus === 'error' && (
        <div className='absolute top-4 left-4 z-10 bg-red-600/90 text-white px-3 py-2 rounded-md text-sm'>
          Could not get location. Using default location.
        </div>
      )}

      <div
        className='h-full w-full relative overflow-hidden cursor-none z-0'
        ref={mapContainerRef}
      />
    </div>
  );
}
