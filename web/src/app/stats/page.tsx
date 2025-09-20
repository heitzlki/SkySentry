'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartAreaInteractive } from '@/components/chart-area-interactive';
import { SectionCards } from '@/components/section-cards';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  Camera,
  Zap,
  Clock,
  BarChart3,
  PieChart,
  LineChart,
  Download,
  RefreshCw,
  Calendar,
  Target,
  Shield,
  Eye,
} from 'lucide-react';

// Mock analytics data
const mockAnalytics = {
  overview: {
    totalDetections: 1247,
    activeThreats: 3,
    systemUptime: '99.8%',
    avgResponseTime: 2.3,
    camerasOnline: 4,
    totalCameras: 4,
  },
  detectionTrends: {
    daily: [
      { date: '2024-01-01', detections: 45, threats: 2 },
      { date: '2024-01-02', detections: 52, threats: 1 },
      { date: '2024-01-03', detections: 38, threats: 3 },
      { date: '2024-01-04', detections: 67, threats: 0 },
      { date: '2024-01-05', detections: 29, threats: 1 },
      { date: '2024-01-06', detections: 84, threats: 2 },
      { date: '2024-01-07', detections: 56, threats: 1 },
    ],
    byType: {
      drone: 234,
      bird: 456,
      plane: 123,
      human: 89,
      other: 345,
    },
    byDangerLevel: {
      high: 67,
      medium: 234,
      low: 946,
    },
  },
  performance: {
    accuracy: 94.2,
    falsePositives: 5.8,
    avgConfidence: 87.3,
    systemLoad: 45,
    memoryUsage: 62,
    networkLatency: 23,
  },
  cameraStats: [
    {
      id: 'cam-001',
      name: 'North Perimeter',
      status: 'online',
      uptime: '99.9%',
      detections: 456,
      threats: 12,
      lastActive: new Date(Date.now() - 2 * 60 * 1000),
    },
    {
      id: 'cam-002',
      name: 'South Entrance',
      status: 'online',
      uptime: '98.7%',
      detections: 234,
      threats: 8,
      lastActive: new Date(Date.now() - 5 * 60 * 1000),
    },
    {
      id: 'cam-003',
      name: 'East Tower',
      status: 'offline',
      uptime: '0%',
      detections: 123,
      threats: 3,
      lastActive: new Date(Date.now() - 30 * 60 * 1000),
    },
    {
      id: 'cam-004',
      name: 'West Parking',
      status: 'online',
      uptime: '99.2%',
      detections: 434,
      threats: 14,
      lastActive: new Date(Date.now() - 1 * 60 * 1000),
    },
  ],
};

export default function StatsPage() {
  const [timeRange, setTimeRange] = useState('7d');
  const [selectedMetric, setSelectedMetric] = useState('detections');

  const getTrendIcon = (current: number, previous: number) => {
    const change = ((current - previous) / previous) * 100;
    if (change > 0) {
      return <TrendingUp className='h-4 w-4 text-green-500' />;
    } else if (change < 0) {
      return <TrendingDown className='h-4 w-4 text-red-500' />;
    }
    return null;
  };

  const formatChange = (current: number, previous: number) => {
    const change = ((current - previous) / previous) * 100;
    return change.toFixed(1);
  };

  return (
    <div className='container mx-auto py-8 pt-20'>
      {/* Header */}
      <div className='mb-8'>
        <div className='flex items-center justify-between mb-4'>
          <div>
            <h1 className='text-3xl font-bold mb-2 text-foreground'>
              Analytics Dashboard
            </h1>
            <p className='text-muted-foreground'>
              Comprehensive system performance and detection analytics
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className='w-32'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='24h'>24 Hours</SelectItem>
                <SelectItem value='7d'>7 Days</SelectItem>
                <SelectItem value='30d'>30 Days</SelectItem>
                <SelectItem value='90d'>90 Days</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant='ghost'
              className='text-foreground hover:text-foreground hover:bg-accent'>
              <Download className='h-4 w-4 mr-2' />
              Export
            </Button>
            <Button
              variant='ghost'
              className='text-foreground hover:text-foreground hover:bg-accent'>
              <RefreshCw className='h-4 w-4 mr-2' />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8'>
        <Card className='bg-card border-border text-foreground'>
          <CardContent className='p-6'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm text-muted-foreground'>
                  Total Detections
                </p>
                <p className='text-3xl font-bold text-foreground'>
                  {mockAnalytics.overview.totalDetections.toLocaleString()}
                </p>
                <div className='flex items-center gap-1 text-sm text-green-400'>
                  {getTrendIcon(1247, 1156)}
                  <span>+7.8% from last period</span>
                </div>
              </div>
              <Activity className='h-12 w-12 text-blue-400' />
            </div>
          </CardContent>
        </Card>

        <Card className='bg-card border-border text-foreground'>
          <CardContent className='p-6'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm text-muted-foreground'>Active Threats</p>
                <p className='text-3xl font-bold text-red-400'>
                  {mockAnalytics.overview.activeThreats}
                </p>
                <div className='flex items-center gap-1 text-sm text-red-400'>
                  {getTrendIcon(3, 5)}
                  <span>-40% from last period</span>
                </div>
              </div>
              <AlertTriangle className='h-12 w-12 text-red-400' />
            </div>
          </CardContent>
        </Card>

        <Card className='bg-card border-border text-foreground'>
          <CardContent className='p-6'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm text-muted-foreground'>System Accuracy</p>
                <p className='text-3xl font-bold text-foreground'>
                  {mockAnalytics.performance.accuracy}%
                </p>
                <div className='flex items-center gap-1 text-sm text-green-400'>
                  {getTrendIcon(94.2, 91.5)}
                  <span>+2.7% improvement</span>
                </div>
              </div>
              <Target className='h-12 w-12 text-green-400' />
            </div>
          </CardContent>
        </Card>

        <Card className='bg-card border-border text-foreground'>
          <CardContent className='p-6'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm text-muted-foreground'>System Uptime</p>
                <p className='text-3xl font-bold text-foreground'>
                  {mockAnalytics.overview.systemUptime}
                </p>
                <div className='flex items-center gap-1 text-sm text-green-400'>
                  <Shield className='h-4 w-4' />
                  <span>All systems operational</span>
                </div>
              </div>
              <BarChart3 className='h-12 w-12 text-purple-400' />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue='overview' className='space-y-6'>
        <TabsList>
          <TabsTrigger value='overview'>Overview</TabsTrigger>
          <TabsTrigger value='detections'>Detections</TabsTrigger>
          <TabsTrigger value='performance'>Performance</TabsTrigger>
          <TabsTrigger value='cameras'>Cameras</TabsTrigger>
        </TabsList>

        <TabsContent value='overview' className='space-y-6'>
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            <Card className='bg-card border-border text-foreground'>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <LineChart className='h-6 w-6' />
                  <CardTitle className='text-foreground'>
                    Detection Trends
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ChartAreaInteractive />
              </CardContent>
            </Card>

            <Card className='bg-card border-border text-foreground'>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <PieChart className='h-6 w-6' />
                  <CardTitle className='text-foreground'>
                    Detection Types
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className='space-y-4'>
                  {Object.entries(mockAnalytics.detectionTrends.byType).map(
                    ([type, count]) => (
                      <div
                        key={type}
                        className='flex items-center justify-between'>
                        <div className='flex items-center gap-2'>
                          <div
                            className={`w-3 h-3 rounded-full ${
                              type === 'drone'
                                ? 'bg-red-500'
                                : type === 'bird'
                                ? 'bg-blue-500'
                                : type === 'plane'
                                ? 'bg-green-500'
                                : type === 'human'
                                ? 'bg-yellow-500'
                                : 'bg-gray-500'
                            }`}
                          />
                          <span className='capitalize font-medium text-foreground'>
                            {type}
                          </span>
                        </div>
                        <span className='font-bold text-foreground'>
                          {count}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <SectionCards />
        </TabsContent>

        <TabsContent value='detections' className='space-y-6'>
          <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
            <Card className='bg-card border-border text-foreground'>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <AlertTriangle className='h-6 w-6' />
                  <CardTitle className='text-foreground'>
                    By Danger Level
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className='space-y-4'>
                  {Object.entries(
                    mockAnalytics.detectionTrends.byDangerLevel
                  ).map(([level, count]) => (
                    <div key={level}>
                      <div className='flex items-center justify-between mb-2'>
                        <span className='capitalize font-medium text-foreground'>
                          {level}
                        </span>
                        <span className='font-bold text-foreground'>
                          {count}
                        </span>
                      </div>
                      <div className='w-full bg-muted rounded-full h-2'>
                        <div
                          className={`h-2 rounded-full ${
                            level === 'high'
                              ? 'bg-red-500'
                              : level === 'medium'
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                          }`}
                          style={{ width: `${(count / 1247) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className='bg-card border-border text-foreground'>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <TrendingUp className='h-6 w-6' />
                  <CardTitle className='text-foreground'>
                    False Positive Rate
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className='text-center'>
                  <div className='text-4xl font-bold text-orange-400 mb-2'>
                    {mockAnalytics.performance.falsePositives}%
                  </div>
                  <p className='text-sm text-muted-foreground'>
                    Below industry average of 8.2%
                  </p>
                  <div className='mt-4 flex items-center justify-center gap-1 text-green-400'>
                    <TrendingUp className='h-4 w-4' />
                    <span className='text-sm'>Improving trend</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className='bg-card border-border text-foreground'>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <Zap className='h-6 w-6' />
                  <CardTitle className='text-foreground'>
                    Average Confidence
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className='text-center'>
                  <div className='text-4xl font-bold text-blue-400 mb-2'>
                    {mockAnalytics.performance.avgConfidence}%
                  </div>
                  <p className='text-sm text-muted-foreground'>
                    Overall system confidence level
                  </p>
                  <div className='mt-4'>
                    <div className='w-full bg-muted rounded-full h-3'>
                      <div
                        className='bg-blue-500 h-3 rounded-full'
                        style={{
                          width: `${mockAnalytics.performance.avgConfidence}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value='performance' className='space-y-6'>
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            <Card className='bg-card border-border text-foreground'>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <Activity className='h-6 w-6' />
                  <CardTitle className='text-foreground'>
                    System Performance
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className='space-y-4'>
                  <div className='flex items-center justify-between'>
                    <span className='text-foreground'>CPU Usage</span>
                    <span className='font-medium text-foreground'>
                      {mockAnalytics.performance.systemLoad}%
                    </span>
                  </div>
                  <div className='w-full bg-muted rounded-full h-2'>
                    <div
                      className='bg-blue-500 h-2 rounded-full'
                      style={{
                        width: `${mockAnalytics.performance.systemLoad}%`,
                      }}
                    />
                  </div>

                  <div className='flex items-center justify-between'>
                    <span className='text-foreground'>Memory Usage</span>
                    <span className='font-medium text-foreground'>
                      {mockAnalytics.performance.memoryUsage}%
                    </span>
                  </div>
                  <div className='w-full bg-muted rounded-full h-2'>
                    <div
                      className='bg-green-500 h-2 rounded-full'
                      style={{
                        width: `${mockAnalytics.performance.memoryUsage}%`,
                      }}
                    />
                  </div>

                  <div className='flex items-center justify-between'>
                    <span className='text-foreground'>Network Latency</span>
                    <span className='font-medium text-foreground'>
                      {mockAnalytics.performance.networkLatency}ms
                    </span>
                  </div>
                  <div className='w-full bg-muted rounded-full h-2'>
                    <div
                      className='bg-yellow-500 h-2 rounded-full'
                      style={{
                        width: `${
                          (mockAnalytics.performance.networkLatency / 100) * 100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className='bg-card border-border text-foreground'>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <Clock className='h-6 w-6' />
                  <CardTitle className='text-foreground'>
                    Response Times
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className='space-y-4'>
                  <div className='flex items-center justify-between'>
                    <span className='text-foreground'>Average Response</span>
                    <span className='font-medium text-foreground'>
                      {mockAnalytics.overview.avgResponseTime}s
                    </span>
                  </div>
                  <div className='text-sm text-muted-foreground'>
                    Time from detection to alert
                  </div>

                  <div className='flex items-center justify-between'>
                    <span className='text-foreground'>Peak Response</span>
                    <span className='font-medium text-foreground'>4.1s</span>
                  </div>

                  <div className='flex items-center justify-between'>
                    <span className='text-foreground'>Min Response</span>
                    <span className='font-medium text-foreground'>0.8s</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value='cameras' className='space-y-6'>
          <div className='grid grid-cols-1 gap-6'>
            {mockAnalytics.cameraStats.map((camera) => (
              <Card
                key={camera.id}
                className='bg-card border-border text-foreground'>
                <CardContent className='p-6'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-4'>
                      <div className='flex items-center gap-2'>
                        <Camera className='h-5 w-5 text-blue-400' />
                        <div>
                          <h3 className='font-semibold text-foreground'>
                            {camera.name}
                          </h3>
                          <p className='text-sm text-muted-foreground'>
                            {camera.id}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          camera.status === 'online' ? 'default' : 'secondary'
                        }
                        className={
                          camera.status === 'online'
                            ? 'bg-green-500/20 text-green-400 border-green-500/30'
                            : 'bg-red-500/20 text-red-400 border-red-500/30'
                        }>
                        {camera.status}
                      </Badge>
                    </div>

                    <div className='grid grid-cols-4 gap-6 text-center'>
                      <div>
                        <p className='text-2xl font-bold text-foreground'>
                          {camera.detections}
                        </p>
                        <p className='text-sm text-muted-foreground'>
                          Detections
                        </p>
                      </div>
                      <div>
                        <p className='text-2xl font-bold text-red-400'>
                          {camera.threats}
                        </p>
                        <p className='text-sm text-muted-foreground'>Threats</p>
                      </div>
                      <div>
                        <p className='text-2xl font-bold text-foreground'>
                          {camera.uptime}
                        </p>
                        <p className='text-sm text-muted-foreground'>Uptime</p>
                      </div>
                      <div>
                        <p className='text-sm text-muted-foreground'>
                          Last Active
                        </p>
                        <p className='font-medium text-foreground'>
                          {camera.lastActive.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
