'use client';

import { useState, useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Calendar,
  Filter,
  Search,
  Download,
  AlertTriangle,
  Camera,
  MapPin,
  Activity,
  Clock,
  Zap,
  Eye,
  Trash2,
  RotateCcw,
} from 'lucide-react';

// Mock detection event data
const mockDetectionEvents = [
  {
    id: 'det-001',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    cameraId: 'cam-001',
    cameraName: 'North Perimeter Camera',
    objectType: 'drone',
    confidence: 0.92,
    dangerLevel: 'high' as const,
    location: { lat: 37.7749, lng: -122.4194 },
    imageUrl: '/api/placeholder/det-001.jpg',
    videoUrl: '/api/stream/det-001.mp4',
    status: 'active' as const,
    description: 'High-confidence drone detection near north perimeter',
  },
  {
    id: 'det-002',
    timestamp: new Date(Date.now() - 12 * 60 * 1000),
    cameraId: 'cam-002',
    cameraName: 'South Entrance Camera',
    objectType: 'bird',
    confidence: 0.78,
    dangerLevel: 'low' as const,
    location: { lat: 37.7689, lng: -122.4234 },
    imageUrl: '/api/placeholder/det-002.jpg',
    videoUrl: '/api/stream/det-002.mp4',
    status: 'resolved' as const,
    description: 'Bird flying over south entrance area',
  },
  {
    id: 'det-003',
    timestamp: new Date(Date.now() - 25 * 60 * 1000),
    cameraId: 'cam-004',
    cameraName: 'West Parking Camera',
    objectType: 'human',
    confidence: 0.85,
    dangerLevel: 'medium' as const,
    location: { lat: 37.7709, lng: -122.4254 },
    imageUrl: '/api/placeholder/det-003.jpg',
    videoUrl: '/api/stream/det-003.mp4',
    status: 'active' as const,
    description: 'Unauthorized person detected in restricted parking area',
  },
  {
    id: 'det-004',
    timestamp: new Date(Date.now() - 45 * 60 * 1000),
    cameraId: 'cam-001',
    cameraName: 'North Perimeter Camera',
    objectType: 'plane',
    confidence: 0.67,
    dangerLevel: 'low' as const,
    location: { lat: 37.7759, lng: -122.4184 },
    imageUrl: '/api/placeholder/det-004.jpg',
    videoUrl: '/api/stream/det-004.mp4',
    status: 'resolved' as const,
    description: 'Commercial aircraft passing overhead',
  },
  {
    id: 'det-005',
    timestamp: new Date(Date.now() - 60 * 60 * 1000),
    cameraId: 'cam-002',
    cameraName: 'South Entrance Camera',
    objectType: 'other',
    confidence: 0.45,
    dangerLevel: 'medium' as const,
    location: { lat: 37.7699, lng: -122.4224 },
    imageUrl: '/api/placeholder/det-005.jpg',
    videoUrl: '/api/stream/det-005.mp4',
    status: 'investigating' as const,
    description: 'Unidentified object requires further investigation',
  },
];

export default function LogsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterDanger, setFilterDanger] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('24h');

  const filteredEvents = useMemo(() => {
    return mockDetectionEvents.filter((event) => {
      const matchesSearch =
        event.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.cameraName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.objectType.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType =
        filterType === 'all' || event.objectType === filterType;
      const matchesDanger =
        filterDanger === 'all' || event.dangerLevel === filterDanger;
      const matchesStatus =
        filterStatus === 'all' || event.status === filterStatus;

      return matchesSearch && matchesType && matchesDanger && matchesStatus;
    });
  }, [searchTerm, filterType, filterDanger, filterStatus]);

  const getDangerBadgeVariant = (level: string) => {
    switch (level) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'destructive';
      case 'investigating':
        return 'default';
      case 'resolved':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const exportData = () => {
    const dataStr = JSON.stringify(filteredEvents, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `detection-logs-${
      new Date().toISOString().split('T')[0]
    }.json`;
    link.click();
  };

  return (
    <div className='container mx-auto py-8 pt-20'>
      {/* Header */}
      <div className='mb-8'>
        <div className='flex items-center justify-between mb-4'>
          <div>
            <h1 className='text-3xl font-bold mb-2 text-foreground'>
              Detection Logs
            </h1>
            <p className='text-muted-foreground'>
              View and analyze all detection events and system activities
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <Button
              variant='ghost'
              onClick={exportData}
              className='text-foreground hover:text-foreground hover:bg-accent'>
              <Download className='h-4 w-4 mr-2' />
              Export
            </Button>
            <Button
              variant='ghost'
              className='text-foreground hover:text-foreground hover:bg-accent'>
              <RotateCcw className='h-4 w-4 mr-2' />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className='grid grid-cols-1 md:grid-cols-4 gap-4 mb-6'>
          <Card className='bg-card border-border text-foreground'>
            <CardContent className='p-4'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm text-muted-foreground'>Total Events</p>
                  <p className='text-2xl font-bold text-foreground'>
                    {mockDetectionEvents.length}
                  </p>
                </div>
                <Activity className='h-8 w-8 text-blue-400' />
              </div>
            </CardContent>
          </Card>

          <Card className='bg-card border-border text-foreground'>
            <CardContent className='p-4'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm text-muted-foreground'>
                    Active Threats
                  </p>
                  <p className='text-2xl font-bold text-red-400'>
                    {
                      mockDetectionEvents.filter(
                        (e) => e.dangerLevel === 'high' && e.status === 'active'
                      ).length
                    }
                  </p>
                </div>
                <AlertTriangle className='h-8 w-8 text-red-400' />
              </div>
            </CardContent>
          </Card>

          <Card className='bg-card border-border text-foreground'>
            <CardContent className='p-4'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm text-muted-foreground'>Last Hour</p>
                  <p className='text-2xl font-bold text-green-400'>
                    {
                      mockDetectionEvents.filter(
                        (e) =>
                          Date.now() - e.timestamp.getTime() < 60 * 60 * 1000
                      ).length
                    }
                  </p>
                </div>
                <Clock className='h-8 w-8 text-green-400' />
              </div>
            </CardContent>
          </Card>

          <Card className='bg-card border-border text-foreground'>
            <CardContent className='p-4'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm text-muted-foreground'>
                    Avg Confidence
                  </p>
                  <p className='text-2xl font-bold text-yellow-400'>
                    {Math.round(
                      (mockDetectionEvents.reduce(
                        (acc, e) => acc + e.confidence,
                        0
                      ) /
                        mockDetectionEvents.length) *
                        100
                    )}
                    %
                  </p>
                </div>
                <Zap className='h-8 w-8 text-yellow-400' />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filters */}
      <Card className='bg-card border-border text-foreground mb-6'>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <Filter className='h-6 w-6' />
            <CardTitle className='text-foreground'>Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 md:grid-cols-5 gap-4'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground' />
              <Input
                placeholder='Search events...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className='pl-10 bg-card border-border text-foreground placeholder:text-muted-foreground'
              />
            </div>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue placeholder='Object Type' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Types</SelectItem>
                <SelectItem value='drone'>Drone</SelectItem>
                <SelectItem value='bird'>Bird</SelectItem>
                <SelectItem value='plane'>Plane</SelectItem>
                <SelectItem value='human'>Human</SelectItem>
                <SelectItem value='other'>Other</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterDanger} onValueChange={setFilterDanger}>
              <SelectTrigger>
                <SelectValue placeholder='Danger Level' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Levels</SelectItem>
                <SelectItem value='high'>High</SelectItem>
                <SelectItem value='medium'>Medium</SelectItem>
                <SelectItem value='low'>Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder='Status' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Status</SelectItem>
                <SelectItem value='active'>Active</SelectItem>
                <SelectItem value='investigating'>Investigating</SelectItem>
                <SelectItem value='resolved'>Resolved</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger>
                <SelectValue placeholder='Date Range' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='1h'>Last Hour</SelectItem>
                <SelectItem value='24h'>Last 24 Hours</SelectItem>
                <SelectItem value='7d'>Last 7 Days</SelectItem>
                <SelectItem value='30d'>Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Detection Events Table */}
      <Card className='bg-card border-border text-foreground'>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <Activity className='h-6 w-6' />
            <CardTitle className='text-foreground'>
              Detection Events ({filteredEvents.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue='list' className='w-auto mb-4'>
            <TabsList>
              <TabsTrigger value='list'>List View</TabsTrigger>
              <TabsTrigger value='timeline'>Timeline</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className='rounded-md border border-border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='text-muted-foreground'>
                    Timestamp
                  </TableHead>
                  <TableHead className='text-muted-foreground'>
                    Camera
                  </TableHead>
                  <TableHead className='text-muted-foreground'>
                    Object Type
                  </TableHead>
                  <TableHead className='text-muted-foreground'>
                    Confidence
                  </TableHead>
                  <TableHead className='text-muted-foreground'>
                    Danger Level
                  </TableHead>
                  <TableHead className='text-muted-foreground'>
                    Status
                  </TableHead>
                  <TableHead className='text-muted-foreground'>
                    Description
                  </TableHead>
                  <TableHead className='text-muted-foreground'>
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.map((event) => (
                  <TableRow
                    key={event.id}
                    className='border-border hover:bg-card'>
                    <TableCell className='font-medium text-foreground'>
                      <div className='flex items-center gap-1'>
                        <Calendar className='h-4 w-4 text-blue-400' />
                        {event.timestamp.toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell className='text-foreground'>
                      <div className='flex items-center gap-1'>
                        <Camera className='h-4 w-4 text-green-400' />
                        {event.cameraName}
                      </div>
                    </TableCell>
                    <TableCell className='text-foreground'>
                      <Badge
                        variant='outline'
                        className='capitalize border-border text-foreground'>
                        {event.objectType}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-foreground'>
                      <div className='flex items-center gap-2'>
                        <div className='w-full bg-muted rounded-full h-2'>
                          <div
                            className='bg-blue-500 h-2 rounded-full'
                            style={{ width: `${event.confidence * 100}%` }}
                          />
                        </div>
                        <span className='text-sm text-foreground'>
                          {Math.round(event.confidence * 100)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className='text-foreground'>
                      <Badge
                        variant={getDangerBadgeVariant(event.dangerLevel)}
                        className='capitalize'>
                        {event.dangerLevel}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-foreground'>
                      <Badge
                        variant={getStatusBadgeVariant(event.status)}
                        className='capitalize'>
                        {event.status}
                      </Badge>
                    </TableCell>
                    <TableCell className='max-w-xs truncate text-muted-foreground'>
                      {event.description}
                    </TableCell>
                    <TableCell className='text-foreground'>
                      <div className='flex items-center gap-2'>
                        <Button
                          variant='ghost'
                          size='sm'
                          className='text-foreground hover:text-foreground hover:bg-accent h-8 w-8 p-0'
                          title='View details'>
                          <Eye className='h-4 w-4' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='sm'
                          className='text-foreground hover:text-foreground hover:bg-accent h-8 w-8 p-0'
                          title='View on map'>
                          <MapPin className='h-4 w-4' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='sm'
                          className='text-foreground hover:text-foreground hover:bg-accent h-8 w-8 p-0'
                          title='Delete event'>
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredEvents.length === 0 && (
            <div className='text-center py-8 text-muted-foreground'>
              <AlertTriangle className='h-12 w-12 mx-auto mb-4 opacity-50' />
              <p>No detection events found matching your filters.</p>
              <p className='text-sm'>Try adjusting your search criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
