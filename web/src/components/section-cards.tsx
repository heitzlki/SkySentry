'use client';

import { IconTrendingDown, IconTrendingUp } from '@tabler/icons-react';
import { TrendingUp, Activity, AlertTriangle, Target } from 'lucide-react';
import { Label, PolarRadiusAxis, RadialBar, RadialBarChart } from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
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
    <div className='grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-3'>
      {/* Total Objects Detected Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center space-x-2">
            <Activity className="h-6 w-6" />
            <h3 className="text-lg font-semibold">Total Objects Detected</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-semibold tabular-nums text-foreground'>
            {dashboardData.totalObjectsDetected}
          </div>
          <div className='mt-2'>
            <Badge variant='outline' className='border-border text-muted-foreground'>
              <IconTrendingUp />+
              {dashboardData.trends.objectsDetected.percentage}%
            </Badge>
          </div>
          <div className='mt-4 text-sm'>
            <div className='flex gap-2 font-medium text-green-400'>
              Trending up {dashboardData.trends.objectsDetected.period}{' '}
              <IconTrendingUp className='size-4' />
            </div>
            <div className='text-muted-foreground mt-1'>
              Objects detected across all camera feeds
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Distribution Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-6 w-6" />
            <div>
              <h3 className="text-lg font-semibold">Object Classification</h3>
              <p className="text-sm text-muted-foreground">Risk Distribution</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
          <div className='mt-4 text-sm'>
            <div className='flex items-center gap-2 leading-none font-medium text-green-400'>
              Risk classification trending up <TrendingUp className='h-4 w-4' />
            </div>
            <div className='text-muted-foreground leading-none mt-1'>
              Distribution of detected objects by risk level
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accuracy Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center space-x-2">
            <Target className="h-6 w-6" />
            <h3 className="text-lg font-semibold">Detection Accuracy</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-semibold tabular-nums text-foreground'>
            {dashboardData.accuracy}%
          </div>
          <div className='mt-2'>
            <Badge variant='outline' className='border-border text-muted-foreground'>
              <IconTrendingUp />+{dashboardData.trends.accuracy.percentage}%
            </Badge>
          </div>
          <div className='mt-4 text-sm'>
            <div className='flex gap-2 font-medium text-green-400'>
              Accuracy improved {dashboardData.trends.accuracy.period}{' '}
              <IconTrendingUp className='size-4' />
            </div>
            <div className='text-muted-foreground mt-1'>
              AI model performance metrics
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
