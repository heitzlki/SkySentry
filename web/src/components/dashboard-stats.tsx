'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Camera,
  Activity,
  AlertTriangle,
  Target,
  Shield,
  Zap,
} from 'lucide-react';

interface SystemStats {
  total_cameras: number;
  online_cameras: number;
  total_detections: number;
  detection_types: Record<string, number>;
}

export function DashboardStats() {
  const [stats, setStats] = useState<SystemStats>({
    total_cameras: 0,
    online_cameras: 0,
    total_detections: 0,
    detection_types: {},
  });

  useEffect(() => {
    // Simulate fetching stats from API
    const fetchStats = async () => {
      // In a real implementation, this would fetch from the backend API
      const mockStats: SystemStats = {
        total_cameras: 5,
        online_cameras: 4,
        total_detections: 127,
        detection_types: {
          insect: 45,
          bird: 32,
          plane: 18,
          human: 12,
          drone: 15,
          other: 5,
        },
      };
      setStats(mockStats);
    };

    fetchStats();

    // Set up periodic updates
    const interval = setInterval(fetchStats, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const getHighRiskDetections = () => {
    // Simulate high risk detections (drones, humans, planes)
    return (
      stats.detection_types.drone +
      stats.detection_types.human +
      stats.detection_types.plane
    );
  };

  const getCameraUptime = () => {
    // Calculate uptime percentage
    return stats.total_cameras > 0
      ? Math.round((stats.online_cameras / stats.total_cameras) * 100)
      : 0;
  };

  return (
    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
      <Card className='bg-card border-border text-foreground'>
        <CardContent className='p-6'>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle className='text-lg mb-2 text-foreground'>
                Total Cameras
              </CardTitle>
              <p className='text-3xl font-bold text-blue-400'>
                {stats.total_cameras}
              </p>
              <div className='flex items-center gap-1 text-sm text-green-400 mt-2'>
                <span>{getCameraUptime()}% uptime</span>
              </div>
            </div>
            <Camera className='w-10 h-10 text-blue-400' />
          </div>
        </CardContent>
      </Card>

      <Card className='bg-card border-border text-foreground'>
        <CardContent className='p-6'>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle className='text-lg mb-2 text-foreground'>
                Total Detections
              </CardTitle>
              <p className='text-3xl font-bold text-purple-400'>
                {stats.total_detections}
              </p>
              <div className='flex items-center gap-1 text-sm text-green-400 mt-2'>
                <span>+12 this week</span>
              </div>
            </div>
            <Target className='w-10 h-10 text-purple-400' />
          </div>
        </CardContent>
      </Card>

      <Card className='bg-card border-border text-foreground'>
        <CardContent className='p-6'>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle className='text-lg mb-2 text-foreground'>
                System Status
              </CardTitle>
              <p className='text-3xl font-bold text-green-400'>100%</p>
              <div className='flex items-center gap-1 text-sm text-green-400 mt-2'>
                <span>All systems operational</span>
              </div>
            </div>
            <Shield className='w-10 h-10 text-green-400' />
          </div>
        </CardContent>
      </Card>

      <Card className='bg-card border-border text-foreground'>
        <CardContent className='p-6'>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle className='text-lg mb-2 text-foreground'>
                High Risk
              </CardTitle>
              <p className='text-3xl font-bold text-red-400'>
                {getHighRiskDetections()}
              </p>
              <div className='flex items-center gap-1 text-sm text-orange-400 mt-2'>
                <span>+8 this week</span>
              </div>
            </div>
            <AlertTriangle className='w-10 h-10 text-red-400' />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
