import type { ComponentProps, HTMLAttributes } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type StatusProps = ComponentProps<typeof Badge> & {
  status: 'safe' | 'dangerous' | 'medium' | 'unsure';
};

export const Status = ({ className, status, ...props }: StatusProps) => (
  <Badge
    className={cn('flex items-center gap-2', 'group', status, className)}
    variant='secondary'
    {...props}
  />
);

export type StatusIndicatorProps = HTMLAttributes<HTMLSpanElement>;

export const StatusIndicator = ({
  className,
  ...props
}: StatusIndicatorProps) => (
  <span className='relative flex h-2 w-2' {...props}>
    <span
      className={cn(
        'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
        'group-[.safe]:bg-emerald-500',
        'group-[.dangerous]:bg-red-500',
        'group-[.medium]:bg-amber-500',
        'group-[.unsure]:bg-gray-500'
      )}
    />
    <span
      className={cn(
        'relative inline-flex h-2 w-2 rounded-full',
        'group-[.safe]:bg-emerald-500',
        'group-[.dangerous]:bg-red-500',
        'group-[.medium]:bg-amber-500',
        'group-[.unsure]:bg-gray-500'
      )}
    />
  </span>
);

export type StatusLabelProps = HTMLAttributes<HTMLSpanElement>;

export const StatusLabel = ({
  className,
  children,
  ...props
}: StatusLabelProps) => (
  <span className={cn('text-muted-foreground', className)} {...props}>
    {children ?? (
      <>
        <span className='hidden group-[.safe]:block'>Safe</span>
        <span className='hidden group-[.dangerous]:block'>Dangerous</span>
        <span className='hidden group-[.medium]:block'>Medium</span>
        <span className='hidden group-[.unsure]:block'>Unsure</span>
      </>
    )}
  </span>
);
