import { ObjectDetectionDataTable } from '@/app/logs/data-table';

import data from './data.json';

// Transform the data to match the new detection schema
const transformedData = data.map((item) => ({
  frame: item.frame,
  global_id: item.global_id,
  label: item.label,
  x1: item.x1,
  y1: item.y1,
  x2: item.x2,
  y2: item.y2,
  cx: item.cx,
  cy: item.cy,
  Xc: item.Xc,
  Yc: item.Yc,
  Zc: item.Zc,
  Xw: item.Xw,
  Yw: item.Yw,
  Zw: item.Zw,
}));

export default function Page() {
  return (
    <div className='flex flex-1 flex-col pt-20'>
      <div className='@container/main flex flex-1 flex-col gap-2'>
        <div className='flex flex-col gap-4 py-4 md:gap-6 md:py-6 mx-8'>
          <ObjectDetectionDataTable data={transformedData} />
        </div>
      </div>
    </div>
  );
}
