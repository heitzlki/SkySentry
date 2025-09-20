import { AppSidebar } from '@/components/app-sidebar';
import { ChartAreaInteractive } from '@/components/chart-area-interactive';
import { ObjectDetectionDataTable } from '@/app/logs/data-table';
import { SectionCards } from '@/components/section-cards';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

import data from './data.json';

// Ensure data status values match the schema enum
const validatedData = data.map(item => ({
  ...item,
  status: item.status as "active" | "investigating" | "resolved" | "false-positive"
}));

export default function Page() {
  return (
    <div className='flex flex-1 flex-col pt-20'>
      <div className='@container/main flex flex-1 flex-col gap-2'>
        <div className='flex flex-col gap-4 py-4 md:gap-6 md:py-6'>
          <ObjectDetectionDataTable data={validatedData} />
        </div>
      </div>
    </div>
  );
}
