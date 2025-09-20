'use client';

import { useEffect, useState } from 'react';

export const ResponsiveModeIndicator = ({
  className = '',
  showInProduction = false,
}: {
  className?: string;
  showInProduction?: boolean;
}) => {
  const [breakpoint, setBreakpoint] = useState('');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const checkBreakpoint = () => {
      const width = window.innerWidth;
      if (width < 640) return 'default';
      if (width < 768) return 'sm';
      if (width < 1024) return 'md';
      if (width < 1280) return 'lg';
      if (width < 1536) return 'xl';
      return '2xl';
    };

    const handleResize = () => {
      setBreakpoint(checkBreakpoint());
    };

    // Check if we should show in production
    if (!showInProduction && process.env.NODE_ENV === 'production') {
      setVisible(false);
      return;
    } else {
      setVisible(true);
    }

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [showInProduction]);

  if (!visible) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 bg-background/80 text-foreground px-2 py-1 rounded-md text-sm z-50 ${className}`}>
      Breakpoint: <span className='font-bold'>{breakpoint}</span>
    </div>
  );
};
