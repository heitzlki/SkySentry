'use client';

import { useState } from 'react';
import { VideoStream } from '@/components/video-stream';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Play,
  Pause,
  Square,
  Grid,
  List,
  Settings,
  Activity,
  Wifi,
  WifiOff,
  AlertTriangle,
  Camera,
  Eye,
  EyeOff,
} from 'lucide-react';

// Mock camera data for demonstration
const mockCameras = [
  {
    id: 'cam-001',
    name: 'North Perimeter Camera',
    streamUrl: 'webrtc://localhost:8080/cam-001',
    location: 'North Fence Line',
    isActive: true,
    status: 'online',
  },
  {
    id: 'cam-002',
    name: 'South Entrance Camera',
    streamUrl: 'webrtc://localhost:8080/cam-002',
    location: 'South Gate',
    isActive: true,
    status: 'online',
  },
  {
    id: 'cam-003',
    name: 'East Tower Camera',
    streamUrl: 'webrtc://localhost:8080/cam-003',
    location: 'East Watch Tower',
    isActive: false,
    status: 'maintenance',
  },
  {
    id: 'cam-004',
    name: 'West Parking Camera',
    streamUrl: 'webrtc://localhost:8080/cam-004',
    location: 'West Parking Area',
    isActive: true,
    status: 'online',
  },
];

export default function StreamingPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const activeCameras = mockCameras.filter((cam) => cam.isActive);
  const inactiveCameras = mockCameras.filter((cam) => !cam.isActive);

  const toggleRecording = () => {
    setIsRecording(!isRecording);
  };

  return (
    <div className='container mx-auto py-8 pt-20'>
      {/* Header */}
      <div className='mb-8'>
        <div className='flex items-center justify-between mb-4'>
          <div>
            <h1 className='text-3xl font-bold mb-2 text-foreground'>
              SkySentry Stream
            </h1>
            <p className='text-muted-foreground'>
              Real-time camera feeds from all connected devices
            </p>
          </div>

          <div className='flex items-center gap-4'>
            {/* Recording Control */}
            <Button
              variant={isRecording ? 'secondary' : 'default'}
              onClick={toggleRecording}
              className={
                isRecording
                  ? 'bg-red-600 hover:bg-red-700 text-foreground'
                  : 'bg-blue-600 hover:bg-blue-700 text-foreground'
              }>
              {isRecording ? (
                <Square className='h-4 w-4 mr-2' />
              ) : (
                <Play className='h-4 w-4 mr-2' />
              )}
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </Button>

            {/* View Mode Toggle */}
            <div className='flex gap-2'>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size='sm'
                onClick={() => setViewMode('grid')}
                className={
                  viewMode === 'grid'
                    ? 'bg-blue-600 hover:bg-blue-700 text-foreground'
                    : 'text-foreground hover:text-foreground hover:bg-accent'
                }
                title='Grid View'>
                <Grid className='h-4 w-4' />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size='sm'
                onClick={() => setViewMode('list')}
                className={
                  viewMode === 'list'
                    ? 'bg-blue-600 hover:bg-blue-700 text-foreground'
                    : 'text-foreground hover:text-foreground hover:bg-accent'
                }
                title='List View'>
                <List className='h-4 w-4' />
              </Button>
            </div>
          </div>
        </div>

        {/* Status Overview */}
        <div className='flex items-center gap-6 mb-4'>
          <div className='flex items-center gap-2'>
            <div className='w-3 h-3 rounded-full bg-green-500 animate-pulse' />
            <span className='text-sm text-foreground/70'>
              {activeCameras.length} Active Cameras
            </span>
          </div>
          <div className='flex items-center gap-2'>
            <div className='w-3 h-3 rounded-full bg-red-500' />
            <span className='text-sm text-foreground/70'>
              {inactiveCameras.length} Inactive Cameras
            </span>
          </div>
          {isRecording && (
            <div className='flex items-center gap-2 px-3 py-1 bg-red-500/20 border border-red-400/30 rounded-full'>
              <div className='w-2 h-2 bg-white rounded-full animate-pulse' />
              <span className='text-sm text-red-300'>Recording</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue='live' className='space-y-6'>
        <TabsList className='bg-card border border-border p-1 rounded-lg'>
          <TabsTrigger
            value='live'
            className='data-[state=active]:bg-accent text-foreground data-[state=active]:text-foreground'>
            Live Streams
          </TabsTrigger>
          <TabsTrigger
            value='archives'
            className='data-[state=active]:bg-accent text-foreground data-[state=active]:text-foreground'>
            Stream Archives
          </TabsTrigger>
          <TabsTrigger
            value='settings'
            className='data-[state=active]:bg-accent text-foreground data-[state=active]:text-foreground'>
            Stream Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value='live' className='space-y-6'>
          {selectedCamera ? (
            /* Single Camera View */
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <h2 className='text-xl font-semibold text-foreground'>
                  {mockCameras.find((c) => c.id === selectedCamera)?.name}
                </h2>
                <Button
                  variant='ghost'
                  onClick={() => setSelectedCamera(null)}
                  className='text-foreground hover:text-foreground hover:bg-accent'>
                  <EyeOff className='h-4 w-4 mr-2' />
                  Back to Grid
                </Button>
              </div>
              <VideoStream
                cameraId={selectedCamera}
                cameraName={
                  mockCameras.find((c) => c.id === selectedCamera)?.name || ''
                }
                streamUrl={
                  mockCameras.find((c) => c.id === selectedCamera)?.streamUrl ||
                  ''
                }
                isActive={
                  mockCameras.find((c) => c.id === selectedCamera)?.isActive ||
                  false
                }
                className='w-full'
              />
            </div>
          ) : (
            /* Grid/List View */
            <div
              className={
                viewMode === 'grid'
                  ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                  : 'space-y-4'
              }>
              {mockCameras.map((camera) => (
                <div
                  key={camera.id}
                  className={`cursor-pointer transition-all hover:scale-105 ${
                    viewMode === 'list' ? 'w-full' : ''
                  }`}
                  onClick={() => setSelectedCamera(camera.id)}>
                  <VideoStream
                    cameraId={camera.id}
                    cameraName={camera.name}
                    streamUrl={camera.streamUrl}
                    isActive={camera.isActive}
                    className={viewMode === 'list' ? 'w-full' : ''}
                  />
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value='archives' className='space-y-6'>
          <Card className='bg-card border-border text-foreground'>
            <CardHeader>
              <div className='flex items-center gap-2'>
                <Activity className='h-6 w-6' />
                <CardTitle className='text-foreground'>
                  Stream Archives
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className='text-center py-8 text-muted-foreground'>
                <Activity className='h-12 w-12 mx-auto mb-4 opacity-50' />
                <p>No archived streams available</p>
                <p className='text-sm'>
                  Start recording to create stream archives
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='settings' className='space-y-6'>
          <Card className='bg-card border-border text-foreground'>
            <CardHeader>
              <div className='flex items-center gap-2'>
                <Settings className='h-6 w-6' />
                <CardTitle className='text-foreground'>
                  Stream Settings
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className='space-y-4'>
                <div className='flex items-center justify-between p-4 bg-card border border-border rounded-lg'>
                  <div>
                    <h3 className='font-medium text-foreground'>
                      WebRTC Streaming
                    </h3>
                    <p className='text-sm text-muted-foreground'>
                      Low-latency streaming protocol
                    </p>
                  </div>
                  <div className='px-3 py-1 bg-green-500/20 border border-green-400/30 rounded-full text-green-300 text-sm'>
                    Enabled
                  </div>
                </div>

                <div className='flex items-center justify-between p-4 bg-card border border-border rounded-lg'>
                  <div>
                    <h3 className='font-medium text-foreground'>
                      Auto-Recording
                    </h3>
                    <p className='text-sm text-muted-foreground'>
                      Automatically record detection events
                    </p>
                  </div>
                  <div className='px-3 py-1 bg-red-500/20 border border-red-400/30 rounded-full text-red-300 text-sm'>
                    Disabled
                  </div>
                </div>

                <div className='flex items-center justify-between p-4 bg-card border border-border rounded-lg'>
                  <div>
                    <h3 className='font-medium text-foreground'>
                      Stream Quality
                    </h3>
                    <p className='text-sm text-muted-foreground'>
                      Current: 1080p30
                    </p>
                  </div>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='text-foreground hover:text-foreground hover:bg-accent'>
                    <Settings className='h-4 w-4 mr-2' />
                    Configure
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
