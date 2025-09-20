'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, AlertTriangle, Target, Clock } from 'lucide-react';

interface DetectionEvent {
  id: string;
  camera_id: string;
  object_type: string;
  confidence: number;
  danger_score: number;
  danger_level: string;
  timestamp: string;
  coordinates: {
    x: number;
    y: number;
    z: number;
  };
}

export function RecentDetections() {
  const [detections, setDetections] = useState<DetectionEvent[]>([]);

  useEffect(() => {
    // Simulate fetching recent detections from API
    const fetchDetections = async () => {
      // In a real implementation, this would fetch from the backend API
      const mockDetections: DetectionEvent[] = [
        {
          id: '1',
          camera_id: 'Camera 1',
          object_type: 'drone',
          confidence: 0.95,
          danger_score: 85,
          danger_level: 'high',
          timestamp: new Date(Date.now() - 30000).toISOString(), // 30 seconds ago
          coordinates: { x: 100, y: 200, z: 150 }
        },
        {
          id: '2',
          camera_id: 'Camera 2',
          object_type: 'bird',
          confidence: 0.78,
          danger_score: 25,
          danger_level: 'low',
          timestamp: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
          coordinates: { x: 250, y: 180, z: 80 }
        },
        {
          id: '3',
          camera_id: 'Camera 4',
          object_type: 'human',
          confidence: 0.88,
          danger_score: 75,
          danger_level: 'high',
          timestamp: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
          coordinates: { x: 150, y: 300, z: 200 }
        },
        {
          id: '4',
          camera_id: 'Camera 1',
          object_type: 'plane',
          confidence: 0.92,
          danger_score: 70,
          danger_level: 'medium',
          timestamp: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
          coordinates: { x: 400, y: 100, z: 500 }
        },
        {
          id: '5',
          camera_id: 'Camera 3',
          object_type: 'insect',
          confidence: 0.65,
          danger_score: 10,
          danger_level: 'low',
          timestamp: new Date(Date.now() - 900000).toISOString(), // 15 minutes ago
          coordinates: { x: 50, y: 50, z: 20 }
        }
      ];
      setDetections(mockDetections);
    };

    fetchDetections();

    // Set up periodic updates
    const interval = setInterval(fetchDetections, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const getDangerBadge = (level: string) => {
    switch (level) {
      case 'high':
        return <Badge variant="destructive">High</Badge>;
      case 'medium':
        return <Badge variant="default" className="bg-yellow-500">Medium</Badge>;
      case 'low':
        return <Badge variant="secondary">Low</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = Math.floor((now.getTime() - time.getTime()) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const getObjectTypeIcon = (objectType: string) => {
    switch (objectType) {
      case 'drone':
        return <Activity className="h-4 w-4" />;
      case 'human':
        return <AlertTriangle className="h-4 w-4" />;
      case 'plane':
        return <Target className="h-4 w-4" />;
      default:
        return <Target className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6" />
          <div>
            <h3 className="text-lg font-semibold leading-none tracking-tight">
              Recent Detections
            </h3>
            <p className="text-sm text-muted-foreground">
              Latest object detection events across all cameras
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          {detections.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No recent detections</p>
              <p className="text-sm">Detections will appear here when objects are detected</p>
            </div>
          ) : (
            <div className="space-y-3">
              {detections.map((detection) => (
                <div
                  key={detection.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg border border-border"
                >
                  <div className="flex items-center space-x-3">
                    <div className="text-muted-foreground">
                      {getObjectTypeIcon(detection.object_type)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium capitalize text-foreground">
                          {detection.object_type}
                        </span>
                        {getDangerBadge(detection.danger_level)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {detection.camera_id} • {isNaN(detection.confidence * 100) ? '0' : (detection.confidence * 100).toFixed(0)}% confidence
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-destructive">
                      {isNaN(detection.danger_score) ? '0' : detection.danger_score.toFixed(0)}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {getTimeAgo(detection.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="mt-4 pt-4 border-t border-border">
          <Button variant="outline" className="w-full">
            View All Detection Logs
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}