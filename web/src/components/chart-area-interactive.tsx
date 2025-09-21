'use client';

import * as React from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Bar,
  BarChart,
  Line,
  LineChart,
  Scatter,
  ScatterChart,
  ZAxis,
} from 'recharts';
import { useMemo, useCallback, useEffect } from 'react';

import { useIsMobile } from '@/hooks/use-mobile';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import detectionData from '@/app/logs/data.json';
import { generateObjectColors, getUniqueGlobalIds } from '@/lib/object-colors';

export const description = 'Real-time detection analytics';

const chartConfig = {
  detections: {
    label: 'Detections',
    color: 'hsl(var(--emerald-500))',
  },
  objects: {
    label: 'Unique Objects',
    color: 'hsl(var(--amber-500))',
  },
  height: {
    label: 'Height (m)',
    color: 'hsl(var(--red-500))',
  },
  distance: {
    label: 'Distance (m)',
    color: 'hsl(var(--gray-500))',
  },
  safe: {
    label: 'Safe Objects',
    color: 'rgb(34, 197, 94)', // emerald-500
  },
  dangerous: {
    label: 'Dangerous Objects',
    color: 'rgb(239, 68, 68)', // red-500
  },
  medium: {
    label: 'Medium Risk',
    color: 'rgb(245, 158, 11)', // amber-500
  },
  unsure: {
    label: 'Unsure',
    color: 'rgb(107, 114, 128)', // gray-500
  },
} satisfies ChartConfig;

export function ChartAreaInteractive() {
  const isMobile = useIsMobile();
  const [chartType, setChartType] = React.useState('temporal');

  // Timeline slider state
  const [timelineProgress, setTimelineProgress] = React.useState([0]);
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [streamingData, setStreamingData] = React.useState(detectionData);

  // Autoplay state
  const [isAutoPlaying, setIsAutoPlaying] = React.useState(false);
  const [autoPlaySpeed, setAutoPlaySpeed] = React.useState(50); // milliseconds per frame
  const autoPlayIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  const processedData = useMemo(() => {
    // Ensure we have valid detection data
    if (!Array.isArray(streamingData) || streamingData.length === 0) {
      return {
        temporalData: [],
        spatialData: [],
        objectTypeData: [],
        trackingData: [],
        objectColors: new Map(),
        maxFrame: 0,
        spatialBounds: { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 },
      };
    }

    // Calculate the frame range based on timeline progress
    const maxFrame = Math.max(...streamingData.map((d: any) => d.frame || 0));
    const targetFrame = Math.floor((timelineProgress[0] / 100) * maxFrame);
    const filteredData = streamingData.filter(
      (d: any) => d.frame <= targetFrame
    );

    // Generate unique colors for each global_id
    const uniqueGlobalIds = getUniqueGlobalIds(filteredData);
    const objectColors = generateObjectColors(uniqueGlobalIds);

    // Calculate spatial bounds for perfect square
    const validSpatialData = filteredData.filter(
      (d: any) =>
        d &&
        typeof d.Xw === 'number' &&
        !isNaN(d.Xw) &&
        typeof d.Yw === 'number' &&
        !isNaN(d.Yw) &&
        typeof d.Zw === 'number' &&
        !isNaN(d.Zw)
    );

    let spatialBounds = {
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
      minZ: 0,
      maxZ: 0,
    };
    if (validSpatialData.length > 0) {
      const xValues = validSpatialData.map((d: any) => d.Xw);
      const yValues = validSpatialData.map((d: any) => d.Yw);
      const zValues = validSpatialData.map((d: any) => d.Zw);

      const minX = Math.min(...xValues);
      const maxX = Math.max(...xValues);
      const minY = Math.min(...yValues);
      const maxY = Math.max(...yValues);
      const minZ = Math.min(...zValues);
      const maxZ = Math.max(...zValues);

      // Calculate the maximum range to make it square
      const rangeX = maxX - minX;
      const rangeY = maxY - minY;
      const maxRange = Math.max(rangeX, rangeY);

      // Center the smaller dimension
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      spatialBounds = {
        minX: centerX - maxRange / 2,
        maxX: centerX + maxRange / 2,
        minY: centerY - maxRange / 2,
        maxY: centerY + maxRange / 2,
        minZ,
        maxZ,
      };
    }

    // Group detections by frame for temporal analysis
    const frameGroups = filteredData.reduce(
      (acc: Record<number, any[]>, detection: any) => {
        if (typeof detection.frame === 'number') {
          if (!acc[detection.frame]) {
            acc[detection.frame] = [];
          }
          acc[detection.frame].push(detection);
        }
        return acc;
      },
      {}
    );

    // Create temporal chart data
    const temporalData = Object.entries(frameGroups)
      .map(([frame, detections]: [string, any[]]) => {
        const frameNum = parseInt(frame);
        const validDetections = detections.filter(
          (d) => d && typeof d === 'object'
        );
        const heightData = validDetections
          .filter((d: any) => typeof d.Zw === 'number' && !isNaN(d.Zw))
          .map((d: any) => d.Zw);

        return {
          frame: frameNum,
          detections: validDetections.length,
          uniqueObjects: new Set(
            validDetections
              .map((d: any) => d.global_id)
              .filter((id) => typeof id === 'number')
          ).size,
          avgHeight:
            heightData.length > 0
              ? heightData.reduce((sum: number, h: number) => sum + h, 0) /
                heightData.length
              : 0,
        };
      })
      .filter((item) => !isNaN(item.frame))
      .sort((a, b) => a.frame - b.frame);

    // Create spatial distribution data (3D positions) with colors
    const spatialData = validSpatialData
      .filter((d: any) => typeof d.global_id === 'number')
      .map((d: any) => ({
        x: d.Xw,
        y: d.Yw,
        z: d.Zw,
        label: d.label || 'Unknown',
        global_id: d.global_id,
        frame: d.frame,
        color: objectColors.get(d.global_id) || 'rgb(107, 114, 128)',
      }));

    // Create object type distribution
    const objectTypes = filteredData.reduce(
      (acc: Record<string, number>, detection: any) => {
        if (detection && typeof detection.label === 'string') {
          acc[detection.label] = (acc[detection.label] || 0) + 1;
        }
        return acc;
      },
      {}
    );

    const objectTypeData = Object.entries(objectTypes)
      .map(([label, count]) => ({ label, count }))
      .sort((a: any, b: any) => b.count - a.count);

    // Create tracking consistency data
    const objectGroups = filteredData.reduce(
      (acc: Record<number, any>, detection: any) => {
        if (detection && typeof detection.global_id === 'number') {
          if (!acc[detection.global_id]) {
            acc[detection.global_id] = {
              global_id: detection.global_id,
              frames: [],
              label: detection.label || 'Unknown',
            };
          }
          if (typeof detection.frame === 'number') {
            acc[detection.global_id].frames.push(detection.frame);
          }
        }
        return acc;
      },
      {}
    );

    const trackingData = Object.values(objectGroups)
      .filter((track: any) => track.frames.length > 0)
      .map((track: any) => {
        const sortedFrames = track.frames.sort((a: number, b: number) => a - b);
        const frameSpan =
          sortedFrames[sortedFrames.length - 1] - sortedFrames[0] + 1;
        const actualFrames = sortedFrames.length;
        const consistency =
          frameSpan > 0 ? (actualFrames / frameSpan) * 100 : 0;

        return {
          global_id: track.global_id,
          label: track.label,
          consistency: Math.round(Math.max(0, Math.min(100, consistency))),
          duration: frameSpan,
          detections: actualFrames,
        };
      });

    return {
      temporalData,
      spatialData,
      objectTypeData,
      trackingData,
      objectColors,
      maxFrame,
      spatialBounds,
    };
  }, [streamingData, timelineProgress]);

  // Streaming functionality
  const fetchNewData = useCallback(async () => {
    try {
      // Replace with your actual API endpoint
      const response = await fetch('/api/detections/latest');
      if (response.ok) {
        const newData = await response.json();
        setStreamingData((prevData) => [...prevData, ...newData]);
      }
    } catch (error) {
      console.error('Failed to fetch new detection data:', error);
    }
  }, []);

  // Autoplay functionality
  const startAutoPlay = useCallback(() => {
    if (autoPlayIntervalRef.current) {
      clearInterval(autoPlayIntervalRef.current);
    }

    autoPlayIntervalRef.current = setInterval(() => {
      setTimelineProgress((current) => {
        const newProgress = current[0] + 1;
        if (newProgress >= 100) {
          // If we reach the end, either stop or start streaming
          setIsAutoPlaying(false);
          if (isStreaming) {
            return [100];
          }
          return [100];
        }
        return [newProgress];
      });
    }, autoPlaySpeed);
  }, [autoPlaySpeed, isStreaming]);

  const stopAutoPlay = useCallback(() => {
    if (autoPlayIntervalRef.current) {
      clearInterval(autoPlayIntervalRef.current);
      autoPlayIntervalRef.current = null;
    }
  }, []);

  // Handle autoplay state changes
  useEffect(() => {
    if (isAutoPlaying) {
      startAutoPlay();
    } else {
      stopAutoPlay();
    }

    return () => stopAutoPlay();
  }, [isAutoPlaying, startAutoPlay, stopAutoPlay]);

  // Handle streaming effect
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isStreaming && timelineProgress[0] === 100) {
      interval = setInterval(() => {
        fetchNewData();
      }, 3000); // Poll every 3 seconds
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isStreaming, timelineProgress, fetchNewData]);

  const handleTimelineChange = (value: number[]) => {
    setTimelineProgress(value);
    if (value[0] < 100) {
      setIsStreaming(false);
    }
    // Pause autoplay when manually changing timeline
    if (isAutoPlaying) {
      setIsAutoPlaying(false);
    }
  };

  const toggleAutoPlay = () => {
    if (timelineProgress[0] >= 100) {
      // If at the end, reset to beginning and start
      setTimelineProgress([0]);
      setIsAutoPlaying(true);
    } else {
      setIsAutoPlaying(!isAutoPlaying);
    }
  };

  const toggleStreaming = () => {
    if (timelineProgress[0] === 100) {
      setIsStreaming(!isStreaming);
    } else {
      // Move to the end and start streaming
      setTimelineProgress([100]);
      setIsStreaming(true);
    }
    // Stop autoplay when starting streaming
    setIsAutoPlaying(false);
  };

  const resetTimeline = () => {
    setTimelineProgress([0]);
    setIsStreaming(false);
    setIsAutoPlaying(false);
  };

  const stepBackward = () => {
    setTimelineProgress((current) => [Math.max(0, current[0] - 5)]);
    setIsAutoPlaying(false);
  };

  const stepForward = () => {
    setTimelineProgress((current) => [Math.min(100, current[0] + 5)]);
    setIsAutoPlaying(false);
  };

  // Use all temporal data by default (no filtering by time range)
  const filteredTemporalData = processedData.temporalData;

  return (
    <Card className='@container/card'>
      <CardHeader>
        <CardTitle>Detection Analytics</CardTitle>
        <CardDescription>
          <span className='hidden @[540px]/card:block'>
            Real-time analysis of object detection and tracking performance
          </span>
          <span className='@[540px]/card:hidden'>
            Object detection analytics
          </span>
        </CardDescription>

        {/* Timeline Slider */}
        <div className='space-y-3 pt-4 border-t'>
          <div className='flex items-center justify-between'>
            <span className='text-sm font-medium'>Timeline</span>
            <div className='flex items-center gap-1'>
              <Button
                variant='outline'
                size='sm'
                onClick={stepBackward}
                disabled={timelineProgress[0] === 0}
                className='px-2'>
                <SkipBack className='h-3 w-3' />
              </Button>

              <Button
                variant={isAutoPlaying ? 'destructive' : 'default'}
                size='sm'
                onClick={toggleAutoPlay}
                className='px-3'>
                {isAutoPlaying ? (
                  <>
                    <Pause className='h-4 w-4 mr-1' />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className='h-4 w-4 mr-1' />
                    Play
                  </>
                )}
              </Button>

              <Button
                variant='outline'
                size='sm'
                onClick={stepForward}
                disabled={timelineProgress[0] === 100}
                className='px-2'>
                <SkipForward className='h-3 w-3' />
              </Button>

              <Button
                variant='outline'
                size='sm'
                onClick={resetTimeline}
                disabled={timelineProgress[0] === 0 && !isAutoPlaying}
                className='px-2'>
                <RotateCcw className='h-4 w-4' />
              </Button>

              <Button
                variant={isStreaming ? 'destructive' : 'secondary'}
                size='sm'
                onClick={toggleStreaming}
                disabled={timelineProgress[0] < 100 && !isStreaming}
                className='px-3'>
                {isStreaming ? 'Stop Stream' : 'Stream'}
              </Button>
            </div>
          </div>

          {/* Speed Control */}
          <div className='flex items-center gap-3 px-2'>
            <span className='text-xs text-muted-foreground'>Speed:</span>
            <div className='flex items-center gap-2 flex-1'>
              <span className='text-xs'>Slow</span>
              <Slider
                value={[101 - autoPlaySpeed]}
                onValueChange={(value) => setAutoPlaySpeed(101 - value[0])}
                max={95}
                min={5}
                step={5}
                className='flex-1 max-w-24'
              />
              <span className='text-xs'>Fast</span>
            </div>
          </div>

          <div className='px-2'>
            <Slider
              value={timelineProgress}
              onValueChange={handleTimelineChange}
              max={100}
              step={1}
              className='w-full'
            />
          </div>

          <div className='flex justify-between text-xs text-muted-foreground px-2'>
            <span>Frame 0</span>
            <span>
              Current: Frame{' '}
              {Math.floor((timelineProgress[0] / 100) * processedData.maxFrame)}
              {isAutoPlaying && ' (Playing)'}
              {isStreaming && ' (Live)'}
            </span>
            <span>Frame {processedData.maxFrame}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
        <Tabs value={chartType} onValueChange={setChartType} className='w-full'>
          <TabsList className='grid w-full grid-cols-4'>
            <TabsTrigger value='temporal'>Timeline</TabsTrigger>
            <TabsTrigger value='objects'>Objects</TabsTrigger>
            <TabsTrigger value='spatial'>3D Space</TabsTrigger>
            <TabsTrigger value='tracking'>Tracking</TabsTrigger>
          </TabsList>

          <TabsContent value='temporal' className='mt-6'>
            <ChartContainer
              config={chartConfig}
              className='aspect-auto h-[300px] w-full'>
              <AreaChart data={filteredTemporalData}>
                <defs>
                  <linearGradient
                    id='fillDetections'
                    x1='0'
                    y1='0'
                    x2='0'
                    y2='1'>
                    <stop
                      offset='5%'
                      stopColor='rgb(34, 197, 94)'
                      stopOpacity={0.8}
                    />
                    <stop
                      offset='95%'
                      stopColor='rgb(34, 197, 94)'
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                  <linearGradient id='fillObjects' x1='0' y1='0' x2='0' y2='1'>
                    <stop
                      offset='5%'
                      stopColor='rgb(245, 158, 11)'
                      stopOpacity={0.8}
                    />
                    <stop
                      offset='95%'
                      stopColor='rgb(245, 158, 11)'
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey='frame'
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                  tickFormatter={(value) => `Frame ${value}`}
                />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) => `Frame ${value}`}
                      indicator='dot'
                    />
                  }
                />
                <Area
                  dataKey='detections'
                  type='natural'
                  fill='url(#fillDetections)'
                  stroke='rgb(34, 197, 94)'
                  stackId='a'
                />
                <Area
                  dataKey='uniqueObjects'
                  type='natural'
                  fill='url(#fillObjects)'
                  stroke='rgb(245, 158, 11)'
                  stackId='b'
                />
              </AreaChart>
            </ChartContainer>
          </TabsContent>

          <TabsContent value='objects' className='mt-6'>
            <ChartContainer
              config={chartConfig}
              className='aspect-auto h-[300px] w-full'>
              <BarChart data={processedData.objectTypeData.slice(0, 10)}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey='label'
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  angle={-45}
                  textAnchor='end'
                  height={80}
                />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator='dashed' />}
                />
                <Bar dataKey='count' fill='rgb(34, 197, 94)' radius={4} />
              </BarChart>
            </ChartContainer>
          </TabsContent>

          <TabsContent value='spatial' className='mt-6'>
            <ChartContainer
              config={chartConfig}
              className='aspect-square h-[400px] w-full'>
              <ScatterChart
                data={processedData.spatialData.slice(0, 200)}
                margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <defs>
                  {/* Define square dot shape */}
                  <marker
                    id='square-dot'
                    markerWidth='4'
                    markerHeight='4'
                    refX='2'
                    refY='2'>
                    <rect
                      x='0'
                      y='0'
                      width='4'
                      height='4'
                      fill='currentColor'
                    />
                  </marker>
                </defs>
                <CartesianGrid />
                <XAxis
                  type='number'
                  dataKey='x'
                  name='X Position'
                  unit='m'
                  tickLine={false}
                  axisLine={false}
                  domain={[
                    processedData.spatialBounds.minX,
                    processedData.spatialBounds.maxX,
                  ]}
                />
                <YAxis
                  type='number'
                  dataKey='y'
                  name='Y Position'
                  unit='m'
                  tickLine={false}
                  axisLine={false}
                  domain={[
                    processedData.spatialBounds.minY,
                    processedData.spatialBounds.maxY,
                  ]}
                />
                <ZAxis
                  type='number'
                  dataKey='z'
                  range={[16, 64]} // Smaller size range
                  name='Height'
                  unit='m'
                />
                <ChartTooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={
                    <ChartTooltipContent
                      hideLabel
                      formatter={(value, name, props) => (
                        <div className='flex flex-col gap-1 min-w-[130px] text-xs'>
                          {name === 'x' && (
                            <div className='flex justify-between'>
                              <span className='text-muted-foreground'>
                                X Position:
                              </span>
                              <span className='font-medium'>{value}m</span>
                            </div>
                          )}
                          {name === 'y' && (
                            <div className='flex justify-between'>
                              <span className='text-muted-foreground'>
                                Y Position:
                              </span>
                              <span className='font-medium'>{value}m</span>
                            </div>
                          )}
                          {name === 'z' && (
                            <div className='flex justify-between'>
                              <span className='text-muted-foreground'>
                                Height:
                              </span>
                              <span className='font-medium'>{value}m</span>
                            </div>
                          )}
                          {props.payload && (
                            <>
                              <div className='flex justify-between'>
                                <span className='text-muted-foreground'>
                                  Object ID:
                                </span>
                                <span className='font-medium'>
                                  {props.payload.global_id}
                                </span>
                              </div>
                              <div className='flex justify-between'>
                                <span className='text-muted-foreground'>
                                  Type:
                                </span>
                                <span className='font-medium'>
                                  {props.payload.label}
                                </span>
                              </div>
                              <div className='flex justify-between'>
                                <span className='text-muted-foreground'>
                                  Frame:
                                </span>
                                <span className='font-medium'>
                                  {props.payload.frame}
                                </span>
                              </div>
                              <div className='flex justify-between'>
                                <span className='text-muted-foreground'>
                                  Age:
                                </span>
                                <span className='font-medium'>
                                  {Math.max(
                                    0,
                                    processedData.maxFrame - props.payload.frame
                                  )}{' '}
                                  frames ago
                                </span>
                              </div>
                              <div className='flex items-center gap-2'>
                                <span className='text-muted-foreground'>
                                  Color:
                                </span>
                                <div
                                  className='w-3 h-3 border border-border'
                                  style={{
                                    backgroundColor: props.payload.color,
                                    opacity: props.payload.opacity || 1,
                                  }}
                                />
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    />
                  }
                />

                {/* Render trajectory lines first (behind the points) */}
                {Array.from(processedData.objectColors.entries()).map(
                  ([globalId, color]) => {
                    const objectData = processedData.spatialData
                      .filter((d) => d.global_id === globalId)
                      .sort((a, b) => a.frame - b.frame)
                      .slice(0, 50);

                    if (objectData.length < 2) return null;

                    // Create path data for trajectory line
                    const pathData = objectData
                      .map((d, i) => {
                        const x =
                          ((d.x - processedData.spatialBounds.minX) /
                            (processedData.spatialBounds.maxX -
                              processedData.spatialBounds.minX)) *
                          100;
                        const y =
                          ((d.y - processedData.spatialBounds.minY) /
                            (processedData.spatialBounds.maxY -
                              processedData.spatialBounds.minY)) *
                          100;
                        return `${i === 0 ? 'M' : 'L'} ${x} ${100 - y}`;
                      })
                      .join(' ');

                    return (
                      <svg
                        key={`trajectory-${globalId}`}
                        className='absolute inset-0 pointer-events-none'>
                        <path
                          d={pathData}
                          stroke={color}
                          strokeWidth='1'
                          strokeOpacity='0.3'
                          fill='none'
                          strokeDasharray='2,2'
                        />
                      </svg>
                    );
                  }
                )}

                {/* Render individual scatter points for each object with their unique colors and fading */}
                {Array.from(processedData.objectColors.entries()).map(
                  ([globalId, color]) => {
                    const objectData = processedData.spatialData
                      .filter((d) => d.global_id === globalId)
                      .slice(0, 50)
                      .map((d) => {
                        // Calculate opacity based on frame age
                        const frameAge = processedData.maxFrame - d.frame;
                        const maxAge = 30; // Fade over 30 frames
                        const opacity = Math.max(
                          0.2,
                          1 - (frameAge / maxAge) * 0.8
                        );

                        return {
                          ...d,
                          opacity,
                          // Adjust color with opacity
                          colorWithOpacity: color
                            .replace('rgb(', 'rgba(')
                            .replace(')', `, ${opacity})`),
                        };
                      });

                    if (objectData.length === 0) return null;

                    return (
                      <Scatter
                        key={globalId}
                        data={objectData}
                        fill={color}
                        name={`Object ${globalId}`}
                        shape='square' // Use square shape instead of circle
                      />
                    );
                  }
                )}
              </ScatterChart>
            </ChartContainer>
          </TabsContent>

          <TabsContent value='tracking' className='mt-6'>
            <ChartContainer
              config={chartConfig}
              className='aspect-auto h-[300px] w-full'>
              <LineChart data={processedData.trackingData.slice(0, 20)}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey='global_id'
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => `ID ${value}`}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  label={{
                    value: 'Consistency %',
                    angle: -90,
                    position: 'insideLeft',
                  }}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) => `Object ID: ${value}`}
                      formatter={(value, name) => [
                        `${value}${name === 'consistency' ? '%' : ''}`,
                        name === 'consistency'
                          ? 'Tracking Consistency'
                          : name === 'duration'
                          ? 'Duration (frames)'
                          : 'Total Detections',
                      ]}
                    />
                  }
                />
                <Line
                  type='monotone'
                  dataKey='consistency'
                  stroke='rgb(107, 114, 128)'
                  strokeWidth={2}
                  dot={{ fill: 'rgb(107, 114, 128)' }}
                />
              </LineChart>
            </ChartContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
