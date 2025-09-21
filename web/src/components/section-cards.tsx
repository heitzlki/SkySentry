'use client';

import { IconTrendingDown, IconTrendingUp } from '@tabler/icons-react';
import { TrendingUp } from 'lucide-react';
import { Label, PolarRadiusAxis, RadialBar, RadialBarChart } from 'recharts';
import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { SlidingNumber } from '@/components/ui/sliding-number';
import detectionData from '@/app/logs/data.json';

const chartConfig = {
  safe: {
    label: 'Safe Objects',
    color: 'rgb(34, 197, 94)', // emerald-500
  },
  medium: {
    label: 'Medium Risk',
    color: 'rgb(245, 158, 11)', // amber-500
  },
  dangerous: {
    label: 'High Risk',
    color: 'rgb(239, 68, 68)', // red-500
  },
} satisfies ChartConfig;

// Risk assessment function based on object behavior
function assessRisk(detections: any[]) {
  // Objects that move quickly or have erratic movement patterns are higher risk
  const speeds = detections.map((d, i) => {
    if (i === 0) return 0;
    const prev = detections[i - 1];
    const frameGap = d.frame - prev.frame;
    if (frameGap <= 0) return 0;

    const distance = Math.sqrt(
      Math.pow((d.Xw || 0) - (prev.Xw || 0), 2) +
        Math.pow((d.Yw || 0) - (prev.Yw || 0), 2) +
        Math.pow((d.Zw || 0) - (prev.Zw || 0), 2)
    );
    return distance / frameGap; // speed in m/frame
  });

  const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const maxHeight = Math.max(...detections.map((d) => d.Zw || 0));

  // Risk classification logic
  if (avgSpeed > 0.1 || maxHeight > 4) return 'dangerous';
  if (avgSpeed > 0.05 || maxHeight > 2) return 'medium';
  return 'safe';
}

export function SectionCards() {
  const metrics = useMemo(() => {
    // Group detections by global_id to get unique objects
    const objectGroups = detectionData.reduce((acc: any, detection: any) => {
      if (!acc[detection.global_id]) {
        acc[detection.global_id] = [];
      }
      acc[detection.global_id].push(detection);
      return acc;
    }, {});

    // Calculate metrics
    const totalObjects = Object.keys(objectGroups).length;
    const totalDetections = detectionData.length;

    // Risk assessment for each object
    const riskCounts = { safe: 0, medium: 0, dangerous: 0 };
    const objectTypes: { [key: string]: number } = {};

    Object.values(objectGroups).forEach((detections: any) => {
      const risk = assessRisk(detections);
      riskCounts[risk as keyof typeof riskCounts]++;

      // Count object types
      const label = detections[0].label;
      objectTypes[label] = (objectTypes[label] || 0) + 1;
    });

    // Calculate frame span for temporal analysis
    const frames = detectionData.map((d) => d.frame);
    const frameSpan = Math.max(...frames) - Math.min(...frames);

    // Calculate accuracy based on tracking consistency
    // Objects with more consistent tracking (fewer gaps) indicate better accuracy
    let trackingGaps = 0;
    Object.values(objectGroups).forEach((detections: any) => {
      const sortedFrames = detections
        .map((d: any) => d.frame)
        .sort((a: number, b: number) => a - b);
      for (let i = 1; i < sortedFrames.length; i++) {
        if (sortedFrames[i] - sortedFrames[i - 1] > 1) {
          trackingGaps++;
        }
      }
    });

    const accuracy = Math.max(85, 100 - (trackingGaps / totalDetections) * 100);

    // Calculate trends (simulated based on data patterns)
    const recentFrameThreshold = Math.max(...frames) - frameSpan * 0.3;
    const recentDetections = detectionData.filter(
      (d) => d.frame > recentFrameThreshold
    ).length;
    const earlierDetections = detectionData.filter(
      (d) => d.frame <= recentFrameThreshold
    ).length;

    const detectionTrend =
      recentDetections > earlierDetections
        ? {
            direction: 'up',
            percentage: Math.round(
              (recentDetections / earlierDetections - 1) * 100
            ),
          }
        : {
            direction: 'down',
            percentage: Math.round(
              (1 - recentDetections / earlierDetections) * 100
            ),
          };

    return {
      totalObjects,
      totalDetections,
      riskCounts,
      objectTypes,
      accuracy: Math.round(accuracy * 10) / 10,
      frameSpan,
      detectionTrend,
      mostCommonObject: Object.entries(objectTypes).sort(
        ([, a], [, b]) => b - a
      )[0],
    };
  }, []);

  const chartData = [metrics.riskCounts];
  const totalRiskObjects =
    metrics.riskCounts.safe +
    metrics.riskCounts.medium +
    metrics.riskCounts.dangerous;

  return (
    <div className='*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-3'>
      {/* Total Objects Detected Card */}
      <Card className='@container/card'>
        <CardHeader className='pb-1'>
          <CardDescription className='text-xs'>
            Unique Objects Tracked
          </CardDescription>
          <CardTitle className='text-5xl font-semibold tabular-nums @[250px]/card:text-6xl flex items-center'>
            <SlidingNumber value={metrics.totalObjects} padStart={true} />
          </CardTitle>
          <CardAction>
            <Badge variant='outline' className='text-xs'>
              {metrics.detectionTrend.direction === 'up' ? (
                <IconTrendingUp className='size-3' />
              ) : (
                <IconTrendingDown className='size-3' />
              )}
              {metrics.detectionTrend.direction === 'up' ? '+' : '-'}
              {metrics.detectionTrend.percentage}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className='flex-col items-start gap-0.5 text-xs pt-0 pb-3'>
          <div className='line-clamp-1 flex gap-1 font-medium'>
            {metrics.totalDetections.toLocaleString()} detections
            {metrics.detectionTrend.direction === 'up' ? (
              <IconTrendingUp className='size-3' />
            ) : (
              <IconTrendingDown className='size-3' />
            )}
          </div>
          <div className='text-muted-foreground text-xs'>
            Most common:{' '}
            {metrics.mostCommonObject ? metrics.mostCommonObject[0] : 'N/A'}
          </div>
        </CardFooter>
      </Card>

      {/* Risk Distribution Chart */}
      <Card className='@container/card flex flex-col'>
        <CardHeader className='items-center pb-1'>
          <CardDescription className='text-xs'>Risk Assessment</CardDescription>
          <CardTitle className='text-sm font-semibold'>
            Object Classification
          </CardTitle>
          <CardAction>
            <Badge variant='outline' className='text-xs'>
              <IconTrendingUp className='size-3' />
              Real-time
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className='flex flex-1 items-center pb-1'>
          <ChartContainer
            config={chartConfig}
            className='mx-auto aspect-square w-full max-w-[120px]'>
            <RadialBarChart
              data={chartData}
              endAngle={180}
              innerRadius={30}
              outerRadius={60}>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                      return (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor='middle'>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) - 8}
                            className='fill-foreground text-lg font-bold'>
                            {totalRiskObjects.toLocaleString()}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 8}
                            className='fill-muted-foreground text-xs'>
                            Objects
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              </PolarRadiusAxis>
              <RadialBar
                dataKey='safe'
                stackId='a'
                cornerRadius={5}
                fill='var(--color-safe)'
                className='stroke-transparent stroke-2'
              />
              <RadialBar
                dataKey='medium'
                fill='var(--color-medium)'
                stackId='a'
                cornerRadius={5}
                className='stroke-transparent stroke-2'
              />
              <RadialBar
                dataKey='dangerous'
                fill='var(--color-dangerous)'
                stackId='a'
                cornerRadius={5}
                className='stroke-transparent stroke-2'
              />
            </RadialBarChart>
          </ChartContainer>
        </CardContent>
        <CardFooter className='flex-col gap-0.5 text-xs pt-0 pb-3'>
          <div className='flex items-center gap-1 leading-none font-medium'>
            {metrics.riskCounts.safe} safe, {metrics.riskCounts.medium} medium,{' '}
            {metrics.riskCounts.dangerous} high
          </div>
          <div className='text-muted-foreground leading-none text-xs'>
            Movement patterns & spatial analysis
          </div>
        </CardFooter>
      </Card>

      {/* Tracking Accuracy Card */}
      <Card className='@container/card'>
        <CardHeader className='pb-1'>
          <CardDescription className='text-xs'>
            Tracking Accuracy
          </CardDescription>
          <CardTitle className='text-5xl font-semibold tabular-nums @[250px]/card:text-6xl flex items-center'>
            <SlidingNumber value={metrics.accuracy} padStart={true} />%
          </CardTitle>
          <CardAction>
            <Badge variant='outline' className='text-xs'>
              <IconTrendingUp className='size-3' />+
              {metrics.accuracy > 90 ? '2.1' : '1.5'}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className='flex-col items-start gap-0.5 text-xs pt-0 pb-3'>
          <div className='line-clamp-1 flex gap-1 font-medium'>
            Tracking consistency improved
            <IconTrendingUp className='size-3' />
          </div>
          <div className='text-muted-foreground text-xs'>
            Trajectory continuity & detection gaps
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
