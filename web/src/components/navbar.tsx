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
import { SunMoon } from '@/components/animate-ui/icons/sun-moon';
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
                      href='/analytics'
                      aria-label='Analytics'
                      className={cn(
                        buttonVariants({ variant: 'ghost', size: 'icon' }),
                        'size-12 rounded-full'
                      )}>
                      <ChartColumn />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Analytics</p>
                  </TooltipContent>
                </Tooltip>
              </DockIcon>
            </AnimateIcon>
            <AnimateIcon animateOnHover>
              <DockIcon>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href='/layers'
                      aria-label='Layers'
                      className={cn(
                        buttonVariants({ variant: 'ghost', size: 'icon' }),
                        'size-12 rounded-full'
                      )}>
                      <Layers className='size-4' />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Layers</p>
                  </TooltipContent>
                </Tooltip>
              </DockIcon>
            </AnimateIcon>
            <AnimateIcon animateOnHover>
              <DockIcon>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href='/surveillance'
                      aria-label='Surveillance'
                      className={cn(
                        buttonVariants({ variant: 'ghost', size: 'icon' }),
                        'size-12 rounded-full'
                      )}>
                      <Cctv className='size-4' />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Surveillance</p>
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
