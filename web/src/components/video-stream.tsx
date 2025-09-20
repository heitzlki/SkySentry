'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Camera,
  Signal,
  WifiOff
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface VideoStreamProps {
  cameraId: string;
  cameraName: string;
  streamUrl: string;
  isActive?: boolean;
  className?: string;
}

export function VideoStream({
  cameraId,
  cameraName,
  streamUrl,
  isActive = true,
  className = ""
}: VideoStreamProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive) {
      setIsPlaying(false);
      setConnectionStatus('disconnected');
      return;
    }

    const simulateConnection = () => {
      setConnectionStatus('connecting');
      setTimeout(() => {
        setConnectionStatus('connected');
      }, 2000);
    };

    simulateConnection();

    return () => {
      setIsPlaying(false);
      setConnectionStatus('disconnected');
    };
  }, [isActive, streamUrl]);

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      setConnectionStatus('connecting');
      setTimeout(() => {
        setConnectionStatus('connected');
      }, 1000);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'disconnected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Live';
      case 'connecting': return 'Connecting...';
      case 'disconnected': return 'Offline';
      default: return 'Unknown';
    }
  };

  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardContent className="p-0">
        <div className="pb-3 border-b border-border">
          <div className="flex items-center justify-between p-6 pb-3">
            <div className="text-lg text-foreground flex items-center gap-2">
              <Camera className="h-5 w-5" />
              {cameraName}
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={connectionStatus === 'connected' ? 'default' : 'secondary'}
                className="flex items-center gap-1"
              >
                <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
                {getStatusText()}
              </Badge>
            </div>
          </div>
        </div>
        <div
          ref={containerRef}
          className="relative aspect-video bg-muted group"
        >
          {/* Video Placeholder with simulated feed */}
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-background">
            {connectionStatus === 'connected' && isPlaying ? (
              <div className="relative w-full h-full">
                {/* Simulated video feed with moving elements */}
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <div className="absolute top-1/3 right-1/3 w-3 h-3 bg-yellow-500 rounded-full animate-bounce" />
                  <div className="absolute bottom-1/4 left-1/2 w-1 h-1 bg-green-500 rounded-full animate-ping" />

                  {/* Scanning line effect */}
                  <div className="absolute top-0 left-0 w-full h-0.5 bg-green-400 opacity-50 animate-scan" />

                  {/* Camera info overlay */}
                  <div className="absolute top-2 left-2 text-foreground text-xs bg-card px-2 py-1 rounded border">
                    CAM-{cameraId.slice(-4)} • LIVE
                  </div>

                  {/* Timestamp */}
                  <div className="absolute bottom-2 right-2 text-foreground text-xs bg-card px-2 py-1 rounded border">
                    {new Date().toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                <Camera className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-sm">
                  {connectionStatus === 'disconnected' ? 'Camera Offline' :
                   connectionStatus === 'connecting' ? 'Connecting...' :
                   'Click Play to Start Stream'}
                </p>
              </div>
            )}
          </div>

          {/* Video Controls Overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={togglePlay}
                  disabled={!isActive || connectionStatus === 'connecting'}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={toggleMute}
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {streamUrl.includes('webrtc') ? 'WebRTC' : 'RTMP'}
                </Badge>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={toggleFullscreen}
                >
                  <Maximize className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Connection Status Indicator */}
          {connectionStatus === 'connecting' && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400"></div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}