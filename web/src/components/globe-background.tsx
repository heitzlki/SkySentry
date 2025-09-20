"use client";

import { Globe } from "@/components/ui/globe";
import { cn } from "@/lib/utils";

interface GlobeBackgroundProps {
  className?: string;
}

export function GlobeBackground({ className }: GlobeBackgroundProps) {
  return (
    <div className={cn(
      "fixed inset-0 -z-10 overflow-hidden pointer-events-none",
      className
    )}>
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />

      {/* Globe positioned to be more visible in the background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] opacity-20">
        <Globe
          className="opacity-30"
          config={{
            width: 1200,
            height: 1200,
            onRender: () => {},
            devicePixelRatio: 2,
            phi: 0,
            theta: 0.3,
            dark: 1, // Darker globe for background
            diffuse: 0.6,
            mapSamples: 8000,
            mapBrightness: 0.8,
            baseColor: [0.7, 0.8, 1.0], // Light blue base color
            markerColor: [0.3, 0.7, 1.0], // Bright blue markers
            glowColor: [0.4, 0.6, 1.0], // Light blue glow
            markers: [
              { location: [14.5995, 120.9842], size: 0.05 }, // Manila
              { location: [19.076, 72.8777], size: 0.08 }, // Mumbai
              { location: [23.8103, 90.4125], size: 0.06 }, // Dhaka
              { location: [30.0444, 31.2357], size: 0.07 }, // Cairo
              { location: [39.9042, 116.4074], size: 0.08 }, // Beijing
              { location: [-23.5505, -46.6333], size: 0.08 }, // São Paulo
              { location: [19.4326, -99.1332], size: 0.08 }, // Mexico City
              { location: [40.7128, -74.006], size: 0.1 },  // New York
              { location: [34.6937, 135.5022], size: 0.06 }, // Tokyo
              { location: [51.5074, -0.1278], size: 0.08 }, // London
              { location: [48.8566, 2.3522], size: 0.06 },  // Paris
              { location: [35.6762, 139.6503], size: 0.07 }, // Tokyo
              { location: [37.7749, -122.4194], size: 0.08 }, // San Francisco
              { location: [-33.8688, 151.2093], size: 0.06 }, // Sydney
              { location: [55.7558, 37.6173], size: 0.07 },  // Moscow
              { location: [1.3521, 103.8198], size: 0.06 },  // Singapore
            ],
          }}
        />
      </div>

      {/* Radial gradient overlay for depth */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(0,50,100,0.1),rgba(0,0,0,0.4))]" />

      {/* Additional atmospheric effects */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-blue-900/10 via-transparent to-purple-900/10" />

      {/* Subtle moving orb effects */}
      <div className="absolute top-20 left-20 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-1000" />
      <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-cyan-500/3 rounded-full blur-3xl animate-pulse delay-2000" />
    </div>
  );
}