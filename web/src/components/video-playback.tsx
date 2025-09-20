'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize,
  Download,
  Share,
  Clock,
  Calendar,
  MapPin,
  Camera
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface VideoPlaybackProps {
  detectionEvent: {
    id: string;
    timestamp: Date;
    cameraId: string;
    cameraName: string;
    objectType: string;
    dangerLevel: 'low' | 'medium' | 'high';
    location: { lat: number; lng: number };
    videoUrl: string;
    duration: number; // in seconds
    description: string;
  };
  className?: string;
}

export function VideoPlayback({ detectionEvent, className = "" }: VideoPlaybackProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(80);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const videoRef = useRef<HTMLVideoElement>(null);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleSeek = (value: number[]) => {
    const newTime = value[0];
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume / 100;
    }
  };

  const skip = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(detectionEvent.duration, videoRef.current.currentTime + seconds));
    }
  };

  const changePlaybackSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const downloadVideo = () => {
    // Create a temporary link to download the video
    const link = document.createElement('a');
    link.href = detectionEvent.videoUrl;
    link.download = `detection-${detectionEvent.id}.mp4`;
    link.click();
  };

  const getDangerBadgeVariant = (level: string) => {
    switch (level) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume / 100;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardContent className="p-0">
        <div className="pb-3 border-b border-border">
          <div className="flex items-center justify-between p-6 pb-3">
            <div className="text-lg text-foreground flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Detection Playback
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={getDangerBadgeVariant(detectionEvent.dangerLevel)} className="capitalize">
                {detectionEvent.dangerLevel} Priority
              </Badge>
              <Badge variant="outline" className="capitalize">
                {detectionEvent.objectType}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground px-6 pb-3">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {detectionEvent.timestamp.toLocaleDateString()}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {detectionEvent.timestamp.toLocaleTimeString()}
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {detectionEvent.location.lat.toFixed(4)}, {detectionEvent.location.lng.toFixed(4)}
            </div>
          </div>
        </div>
        {/* Video Player */}
        <div className="relative aspect-video bg-muted">
          <video
            ref={videoRef}
            className="w-full h-full"
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          >
            <source src={detectionEvent.videoUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>

          {/* Video Overlay Info */}
          <div className="absolute top-2 left-2 bg-card text-foreground px-3 py-1 rounded text-sm border">
            {detectionEvent.cameraName}
          </div>

          <div className="absolute bottom-2 right-2 bg-card text-foreground px-3 py-1 rounded text-sm border">
            {formatTime(currentTime)} / {formatTime(detectionEvent.duration)}
          </div>
        </div>

        {/* Video Controls */}
        <div className="p-4 space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <Slider
              value={[currentTime]}
              max={detectionEvent.duration}
              step={1}
              onValueChange={handleSeek}
              className="w-full"
            />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(detectionEvent.duration)}</span>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => skip(-10)}>
                <SkipBack className="h-4 w-4" />
                <span className="sr-only">Skip back 10s</span>
              </Button>

              <Button size="sm" onClick={togglePlay}>
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>

              <Button size="sm" variant="ghost" onClick={() => skip(10)}>
                <SkipForward className="h-4 w-4" />
                <span className="sr-only">Skip forward 10s</span>
              </Button>

              <div className="flex items-center gap-2 ml-4">
                <Button size="sm" variant="ghost" onClick={() => setIsMuted(!isMuted)}>
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                <div className="w-20">
                  <Slider
                    value={[volume]}
                    max={100}
                    step={1}
                    onValueChange={handleVolumeChange}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Playback Speed */}
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant={playbackSpeed === 0.5 ? "default" : "ghost"}
                  onClick={() => changePlaybackSpeed(0.5)}
                  className="text-xs px-2"
                >
                  0.5x
                </Button>
                <Button
                  size="sm"
                  variant={playbackSpeed === 1 ? "default" : "ghost"}
                  onClick={() => changePlaybackSpeed(1)}
                  className="text-xs px-2"
                >
                  1x
                </Button>
                <Button
                  size="sm"
                  variant={playbackSpeed === 1.5 ? "default" : "ghost"}
                  onClick={() => changePlaybackSpeed(1.5)}
                  className="text-xs px-2"
                >
                  1.5x
                </Button>
                <Button
                  size="sm"
                  variant={playbackSpeed === 2 ? "default" : "ghost"}
                  onClick={() => changePlaybackSpeed(2)}
                  className="text-xs px-2"
                >
                  2x
                </Button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 ml-4">
                <Button size="sm" variant="outline" onClick={downloadVideo}>
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
                <Button size="sm" variant="outline">
                  <Share className="h-4 w-4 mr-1" />
                  Share
                </Button>
                <Button size="sm" variant="outline">
                  <Maximize className="h-4 w-4 mr-1" />
                  Fullscreen
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Detection Details */}
        <div className="p-4 border-t border-border bg-muted">
          <h3 className="font-semibold text-foreground mb-2">Detection Details</h3>
          <p className="text-sm text-muted-foreground">{detectionEvent.description}</p>

          <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
            <div>
              <span className="font-medium text-foreground">Camera ID:</span>
              <span className="ml-2 text-muted-foreground">{detectionEvent.cameraId}</span>
            </div>
            <div>
              <span className="font-medium text-foreground">Object Type:</span>
              <span className="ml-2 text-muted-foreground capitalize">{detectionEvent.objectType}</span>
            </div>
            <div>
              <span className="font-medium text-foreground">Danger Level:</span>
              <Badge
                variant={getDangerBadgeVariant(detectionEvent.dangerLevel)}
                className="ml-2 capitalize text-xs"
              >
                {detectionEvent.dangerLevel}
              </Badge>
            </div>
            <div>
              <span className="font-medium text-foreground">Duration:</span>
              <span className="ml-2 text-muted-foreground">{formatTime(detectionEvent.duration)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}