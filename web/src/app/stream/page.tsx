import { CameraGrid } from '@/components/camera-grid';

export default function StreamingPage() {
  return (
    <div className='container mx-auto py-8 pt-20'>
      <div className='mb-8'>
        <h1 className='text-3xl font-bold mb-2'>SkySentry Stream</h1>
        <p className='text-muted-foreground'>
          Real-time camera feeds from all connected devices
        </p>
      </div>

      <CameraGrid />
    </div>
  );
}
