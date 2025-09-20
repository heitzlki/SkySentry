'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Camera,
  Activity,
  AlertTriangle,
  MapPin,
  Satellite,
  Shield,
} from 'lucide-react';
import { DashboardStats } from '@/components/dashboard-stats';
import { CameraGrid } from '@/components/camera-grid';
import { RecentDetections } from '@/components/recent-detections';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Home() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Simulate initial connection
    const timer = setTimeout(() => setIsConnected(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className='container mx-auto p-6 space-y-6 min-h-screen relative'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>
            SkySentry Dashboard
          </h1>
          <p className='text-muted-foreground'>
            Real-time drone detection and monitoring platform
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <Badge variant={isConnected ? 'default' : 'secondary'}>
            <Activity className='w-3 h-3 mr-1' />
            {isConnected ? 'Connected' : 'Connecting...'}
          </Badge>
          <Button>
            <Camera className='w-4 h-4 mr-2' />
            Add Camera
          </Button>
        </div>
      </div>

      <DashboardStats />

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <CameraGrid />
        <RecentDetections />
      </div>

      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <MapPin className='w-5 h-5' />
            <div>
              <h3 className='text-lg font-semibold leading-none tracking-tight'>
                Camera Locations
              </h3>
              <p className='text-sm text-muted-foreground'>
                Geographic distribution of active cameras
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className='h-96 bg-muted rounded-lg flex items-center justify-center'>
            <div className='text-center'>
              <MapPin className='w-12 h-12 mx-auto mb-4 text-muted-foreground' />
              <p className='text-muted-foreground'>
                Map visualization will be displayed here
              </p>
              <Button variant='outline' className='mt-4'>
                View Full Map
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
