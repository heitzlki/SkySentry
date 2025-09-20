'use client';

import { HomeIcon, MapPlusIcon, PencilIcon, UserIcon } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

import { ModeToggle } from '@/components/mode-toggle';
import { buttonVariants } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Dock, DockIcon } from '@/components/ui/dock';
import { Button } from '@/components/ui/button';
import { LayoutDashboard } from '@/components/animate-ui/icons/layout-dashboard';
import { ChartColumn } from '@/components/animate-ui/icons/chart-column';
import { Layers } from '@/components/animate-ui/icons/layers';
import { Cctv } from '@/components/animate-ui/icons/cctv';
import { Binary } from '@/components/animate-ui/icons/binary';
import { AnimateIcon } from '@/components/animate-ui/icons/icon';

export type IconProps = React.HTMLAttributes<SVGElement>;

export function Navbar() {
  return (
    <div className='fixed w-full top-0 z-50 px-4 py-5'>
      <div className='flex flex-col items-center justify-center'>
        <TooltipProvider>
          <Dock direction='middle' className='mt-0 bg-card'>
            <AnimateIcon animateOnHover>
              <DockIcon>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href='/'
                      aria-label='Dashboard'
                      className={cn(
                        buttonVariants({ variant: 'ghost', size: 'icon' }),
                        'size-12 rounded-full'
                      )}>
                      <LayoutDashboard className='size-4' animateOnHover />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Dashboard</p>
                  </TooltipContent>
                </Tooltip>
              </DockIcon>
            </AnimateIcon>
            <AnimateIcon animateOnHover>
              <DockIcon>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href='/logs'
                      aria-label='Logs'
                      className={cn(
                        buttonVariants({ variant: 'ghost', size: 'icon' }),
                        'size-12 rounded-full'
                      )}>
                      <Binary />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Logs</p>
                  </TooltipContent>
                </Tooltip>
              </DockIcon>
            </AnimateIcon>
            <AnimateIcon animateOnHover>
              <DockIcon>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href='/stats'
                      aria-label='Stats'
                      className={cn(
                        buttonVariants({ variant: 'ghost', size: 'icon' }),
                        'size-12 rounded-full'
                      )}>
                      <ChartColumn />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Stats</p>
                  </TooltipContent>
                </Tooltip>
              </DockIcon>
            </AnimateIcon>
            <AnimateIcon animateOnHover>
              <DockIcon>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href='/map'
                      aria-label='Map'
                      className={cn(
                        buttonVariants({ variant: 'ghost', size: 'icon' }),
                        'size-12 rounded-full'
                      )}>
                      <Layers className='size-4' />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Map</p>
                  </TooltipContent>
                </Tooltip>
              </DockIcon>
            </AnimateIcon>
            <AnimateIcon animateOnHover>
              <DockIcon>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href='/stream'
                      aria-label='Stream'
                      className={cn(
                        buttonVariants({ variant: 'ghost', size: 'icon' }),
                        'size-12 rounded-full'
                      )}>
                      <Cctv className='size-4' />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Stream</p>
                  </TooltipContent>
                </Tooltip>
              </DockIcon>
            </AnimateIcon>
            <AnimateIcon animateOnHover>
              <DockIcon>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ModeToggle />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Theme</p>
                  </TooltipContent>
                </Tooltip>
              </DockIcon>
            </AnimateIcon>
          </Dock>
        </TooltipProvider>
      </div>
    </div>
  );
}
