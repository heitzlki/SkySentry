'use client';

import { IconTrendingDown, IconTrendingUp } from '@tabler/icons-react';
import { TrendingUp } from 'lucide-react';
import { Label, PolarRadiusAxis, RadialBar, RadialBarChart } from 'recharts';

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
import { SlidingNumber } from '../../components/motion-primitives/sliding-number';
import dashboardData from '@/data/dashboard-metrics.json';

const chartConfig = {
  low: {
    label: 'Low Risk',
    color: 'var(--chart-1)',
  },
  medium: {
    label: 'Medium Risk',
    color: 'var(--chart-2)',
  },
  high: {
    label: 'High Risk',
    color: 'var(--chart-))',
  },
} satisfies ChartConfig;

export function SectionCards() {
  const chartData = [dashboardData.riskLevels];
  const totalRiskObjects =
    dashboardData.riskLevels.low +
    dashboardData.riskLevels.medium +
    dashboardData.riskLevels.high;

  return (
    <div className='*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-3'>
      {/* Total Objects Detected Card */}
      <Card className='@container/card'>
        <CardHeader>
          <CardDescription>Total Objects Detected</CardDescription>
          <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl flex items-center'>
            <SlidingNumber value={dashboardData.totalObjectsDetected} />
          </CardTitle>
          <CardAction>
            <Badge variant='outline'>
              <IconTrendingUp />+
              {dashboardData.trends.objectsDetected.percentage}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className='flex-col items-start gap-1.5 text-sm'>
          <div className='line-clamp-1 flex gap-2 font-medium'>
            Trending up {dashboardData.trends.objectsDetected.period}{' '}
            <IconTrendingUp className='size-4' />
          </div>
          <div className='text-muted-foreground'>
            Objects detected across all camera feeds
          </div>
        </CardFooter>
      </Card>

      {/* Risk Distribution Chart */}
      <Card className='@container/card flex flex-col'>
        <CardHeader className='items-center pb-0'>
          <CardDescription>Risk Distribution</CardDescription>
          <CardTitle className='text-lg font-semibold'>
            Object Classification
          </CardTitle>
          <CardAction>
            <Badge variant='outline'>
              <IconTrendingUp />+
              {dashboardData.trends.riskDistribution.percentage}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className='flex flex-1 items-center pb-0'>
          <ChartContainer
            config={chartConfig}
            className='mx-auto aspect-square w-full max-w-[200px]'>
            <RadialBarChart
              data={chartData}
              endAngle={180}
              innerRadius={60}
              outerRadius={110}>
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
                            y={(viewBox.cy || 0) - 16}
                            className='fill-foreground text-xl font-bold'>
                            {totalRiskObjects.toLocaleString()}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 4}
                            className='fill-muted-foreground text-sm'>
                            Objects
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              </PolarRadiusAxis>
              <RadialBar
                dataKey='low'
                stackId='a'
                cornerRadius={5}
                fill='var(--color-low)'
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
                dataKey='high'
                fill='var(--color-high)'
                stackId='a'
                cornerRadius={5}
                className='stroke-transparent stroke-2'
              />
            </RadialBarChart>
          </ChartContainer>
        </CardContent>
        <CardFooter className='flex-col gap-1.5 text-sm'>
          <div className='flex items-center gap-2 leading-none font-medium'>
            Risk classification trending up <TrendingUp className='h-4 w-4' />
          </div>
          <div className='text-muted-foreground leading-none'>
            Distribution of detected objects by risk level
          </div>
        </CardFooter>
      </Card>

      {/* Accuracy Card */}
      <Card className='@container/card'>
        <CardHeader>
          <CardDescription>Detection Accuracy</CardDescription>
          <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl flex items-center'>
            <SlidingNumber value={dashboardData.accuracy} />%
          </CardTitle>
          <CardAction>
            <Badge variant='outline'>
              <IconTrendingUp />+{dashboardData.trends.accuracy.percentage}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className='flex-col items-start gap-1.5 text-sm'>
          <div className='line-clamp-1 flex gap-2 font-medium'>
            Accuracy improved {dashboardData.trends.accuracy.period}{' '}
            <IconTrendingUp className='size-4' />
          </div>
          <div className='text-muted-foreground'>
            AI model performance metrics
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
