'use client';

import * as React from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from '@tanstack/react-table';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Status,
  StatusIndicator,
  StatusLabel,
} from '@/components/ui/shadcn-io/status';
import {
  IconChevronDown,
  IconEye,
  IconLayoutColumns,
} from '@tabler/icons-react';
import { EllipsisVertical } from '@/components/animate-ui/icons/ellipsis-vertical';
import { AnimateIcon } from '@/components/animate-ui/icons/icon';

// Define the detection schema based on your data structure
export const detectionSchema = z.object({
  frame: z.number(),
  global_id: z.number(),
  label: z.string(),
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
  cx: z.number(),
  cy: z.number(),
  Xc: z.number().optional(),
  Yc: z.number().optional(),
  Zc: z.number().optional(),
  Xw: z.number().optional(),
  Yw: z.number().optional(),
  Zw: z.number().optional(),
});

// Grouped detection schema
export const groupedDetectionSchema = z.object({
  id: z.string(),
  global_id: z.number(),
  label: z.string(),
  status: z.enum(['safe', 'medium', 'dangerous', 'unsure']),
  firstFrame: z.number(),
  lastFrame: z.number(),
  frameCount: z.number(),
  avgPosition: z.object({
    camera: z.object({ x: z.number(), y: z.number(), z: z.number() }),
    world: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  }),
  bbox: z.object({
    x1: z.number(),
    y1: z.number(),
    x2: z.number(),
    y2: z.number(),
    width: z.number(),
    height: z.number(),
  }),
});

type Detection = z.infer<typeof detectionSchema>;
type GroupedDetection = z.infer<typeof groupedDetectionSchema>;

// Function to determine status based on object type (danger assessment)
function getObjectStatus(
  label: string
): 'safe' | 'medium' | 'dangerous' | 'unsure' {
  const dangerousObjects = [
    'knife',
    'gun',
    'weapon',
    'explosive',
    'bomb',
    'pistol',
    'rifle',
    'paper air plane',
  ];
  const moderateObjects = [
    'drone',
    'aircraft',
    'helicopter',
    'vehicle',
    'car',
    'truck',
    'bottle',
  ];
  const safeObjects = [
    'piece of paper',
    'paper',
    'book',
    'cup',
    'phone',
    'laptop',
  ];

  const lowerLabel = label.toLowerCase();

  if (dangerousObjects.some((dangerous) => lowerLabel.includes(dangerous))) {
    return 'dangerous'; // High danger
  }

  if (moderateObjects.some((moderate) => lowerLabel.includes(moderate))) {
    return 'medium'; // Moderate danger
  }

  if (safeObjects.some((safe) => lowerLabel.includes(safe))) {
    return 'safe'; // Safe objects
  }

  return 'unsure'; // Unknown/uncertain objects
}

// Function to group detections by global_id and label
function groupDetections(detections: Detection[]): GroupedDetection[] {
  const groups = new Map<string, Detection[]>();

  // Group by global_id and label
  detections.forEach((detection) => {
    const key = `${detection.global_id}_${detection.label}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(detection);
  });

  // Convert groups to grouped detections
  return Array.from(groups.entries())
    .map(([key, detectionGroup]) => {
      const firstDetection = detectionGroup[0];
      const lastDetection = detectionGroup[detectionGroup.length - 1];

      // Calculate average positions
      const validCameraCoords = detectionGroup.filter(
        (d) => d.Xc !== undefined && d.Yc !== undefined && d.Zc !== undefined
      );
      const validWorldCoords = detectionGroup.filter(
        (d) => d.Xw !== undefined && d.Yw !== undefined && d.Zw !== undefined
      );

      const avgCameraPos =
        validCameraCoords.length > 0
          ? {
              x:
                validCameraCoords.reduce((sum, d) => sum + d.Xc!, 0) /
                validCameraCoords.length,
              y:
                validCameraCoords.reduce((sum, d) => sum + d.Yc!, 0) /
                validCameraCoords.length,
              z:
                validCameraCoords.reduce((sum, d) => sum + d.Zc!, 0) /
                validCameraCoords.length,
            }
          : { x: 0, y: 0, z: 0 };

      const avgWorldPos =
        validWorldCoords.length > 0
          ? {
              x:
                validWorldCoords.reduce((sum, d) => sum + d.Xw!, 0) /
                validWorldCoords.length,
              y:
                validWorldCoords.reduce((sum, d) => sum + d.Yw!, 0) /
                validWorldCoords.length,
              z:
                validWorldCoords.reduce((sum, d) => sum + d.Zw!, 0) /
                validWorldCoords.length,
            }
          : { x: 0, y: 0, z: 0 };

      // Calculate average bounding box
      const avgBbox = {
        x1: Math.round(
          detectionGroup.reduce((sum, d) => sum + d.x1, 0) /
            detectionGroup.length
        ),
        y1: Math.round(
          detectionGroup.reduce((sum, d) => sum + d.y1, 0) /
            detectionGroup.length
        ),
        x2: Math.round(
          detectionGroup.reduce((sum, d) => sum + d.x2, 0) /
            detectionGroup.length
        ),
        y2: Math.round(
          detectionGroup.reduce((sum, d) => sum + d.y2, 0) /
            detectionGroup.length
        ),
      };

      return {
        id: key,
        global_id: firstDetection.global_id,
        label: firstDetection.label,
        status: getObjectStatus(firstDetection.label),
        firstFrame: Math.min(...detectionGroup.map((d) => d.frame)),
        lastFrame: Math.max(...detectionGroup.map((d) => d.frame)),
        frameCount: detectionGroup.length,
        avgPosition: {
          camera: avgCameraPos,
          world: avgWorldPos,
        },
        bbox: {
          ...avgBbox,
          width: avgBbox.x2 - avgBbox.x1,
          height: avgBbox.y2 - avgBbox.y1,
        },
      };
    })
    .sort((a, b) => a.global_id - b.global_id);
}

function DetectionDetailDialog({ detection }: { detection: GroupedDetection }) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <AnimateIcon animateOnHover>
        <DialogTrigger asChild>
          <Button variant='ghost' size='icon' className='h-12 w-12'>
            <EllipsisVertical animateOnHover className='w-8' />

            <span className='sr-only'>View details</span>
          </Button>
        </DialogTrigger>
      </AnimateIcon>

      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Badge variant='outline'>{detection.label}</Badge>
            <span className='text-muted-foreground'>
              Detection #{detection.global_id}
            </span>
          </DialogTitle>
          <DialogDescription>
            Detailed information about the detected object
          </DialogDescription>
        </DialogHeader>

        <div className='grid grid-cols-2 gap-6'>
          <div className='space-y-4'>
            <div>
              <h4 className='text-sm font-medium text-muted-foreground mb-2'>
                Bounding Box
              </h4>
              <div className='text-sm space-y-1'>
                <div>
                  Top-left: ({detection.bbox.x1}, {detection.bbox.y1})
                </div>
                <div>
                  Bottom-right: ({detection.bbox.x2}, {detection.bbox.y2})
                </div>
                <div>
                  Size: {detection.bbox.width} × {detection.bbox.height} px
                </div>
              </div>
            </div>

            <div>
              <h4 className='text-sm font-medium text-muted-foreground mb-2'>
                Frame Range
              </h4>
              <div className='text-sm space-y-1'>
                <div>First frame: {detection.firstFrame}</div>
                <div>Last frame: {detection.lastFrame}</div>
                <div>Total frames: {detection.frameCount}</div>
              </div>
            </div>
          </div>

          <div className='space-y-4'>
            <div>
              <h4 className='text-sm font-medium text-muted-foreground mb-2'>
                Camera Coordinates (m)
              </h4>
              <div className='text-sm font-mono space-y-1'>
                <div>X: {detection.avgPosition.camera.x.toFixed(3)}</div>
                <div>Y: {detection.avgPosition.camera.y.toFixed(3)}</div>
                <div>Z: {detection.avgPosition.camera.z.toFixed(3)}</div>
              </div>
            </div>

            <div>
              <h4 className='text-sm font-medium text-muted-foreground mb-2'>
                World Coordinates (m)
              </h4>
              <div className='text-sm font-mono space-y-1'>
                <div>X: {detection.avgPosition.world.x.toFixed(3)}</div>
                <div>Y: {detection.avgPosition.world.y.toFixed(3)}</div>
                <div>Z: {detection.avgPosition.world.z.toFixed(3)}</div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ObjectDetectionDataTable({
  data: rawData,
}: {
  data: Detection[];
}) {
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);

  // Group the raw detection data
  const groupedData = React.useMemo(() => groupDetections(rawData), [rawData]);

  const columns: ColumnDef<GroupedDetection>[] = [
    {
      accessorKey: 'global_id',
      header: 'ID',
      size: 80,
      cell: ({ row }) => (
        <div className='font-mono text-sm font-semibold text-center'>
          #{row.original.global_id}
        </div>
      ),
    },
    {
      accessorKey: 'label',
      header: 'Object Type',
      size: 180,
      cell: ({ row }) => (
        <div className='flex items-center gap-2'>
          <Badge variant='outline' className='text font-medium p-1'>
            {row.original.label}
          </Badge>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Threat Level',
      size: 140,
      cell: ({ row }) => (
        <Status status={row.original.status}>
          <StatusIndicator />
          <StatusLabel />
        </Status>
      ),
    },
    {
      accessorKey: 'frameCount',
      header: 'Detection Info',
      size: 120,
      cell: ({ row }) => (
        <div className='text-sm space-y-1'>
          <div className='font-medium'>{row.original.frameCount} frames</div>
          <div className='text-xs text-muted-foreground font-mono'>
            {row.original.firstFrame} → {row.original.lastFrame}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'cameraPosition',
      header: 'Camera Position (m)',
      size: 160,
      cell: ({ row }) => (
        <div className='text-xs font-mono bg-muted/30 rounded-md p-2 space-y-1'>
          <div className='flex justify-between'>
            <span className='text-muted-foreground'>X:</span>
            <span className='font-medium'>
              {row.original.avgPosition.camera.x.toFixed(2)}
            </span>
          </div>
          <div className='flex justify-between'>
            <span className='text-muted-foreground'>Y:</span>
            <span className='font-medium'>
              {row.original.avgPosition.camera.y.toFixed(2)}
            </span>
          </div>
          <div className='flex justify-between'>
            <span className='text-muted-foreground'>Z:</span>
            <span className='font-medium'>
              {row.original.avgPosition.camera.z.toFixed(2)}
            </span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'worldPosition',
      header: 'World Position (m)',
      size: 160,
      cell: ({ row }) => (
        <div className='text-xs font-mono bg-muted/30 rounded-md p-2 space-y-1'>
          <div className='flex justify-between'>
            <span className='text-muted-foreground'>X:</span>
            <span className='font-medium'>
              {row.original.avgPosition.world.x.toFixed(2)}
            </span>
          </div>
          <div className='flex justify-between'>
            <span className='text-muted-foreground'>Y:</span>
            <span className='font-medium'>
              {row.original.avgPosition.world.y.toFixed(2)}
            </span>
          </div>
          <div className='flex justify-between'>
            <span className='text-muted-foreground'>Z:</span>
            <span className='font-medium'>
              {row.original.avgPosition.world.z.toFixed(2)}
            </span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'bbox',
      header: 'Bounding Box',
      size: 140,
      cell: ({ row }) => (
        <div className='text-xs space-y-1'>
          <div className='font-medium font-mono'>
            {row.original.bbox.width} × {row.original.bbox.height}
          </div>
          <div className='text-muted-foreground font-mono text-[10px]'>
            ({row.original.bbox.x1}, {row.original.bbox.y1})
          </div>
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 100,
      cell: ({ row }) => (
        <div className='flex justify-center'>
          <DetectionDetailDialog detection={row.original} />
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: groupedData,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className='w-full space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-xl font-semibold tracking-tight'>
            Object Detections
          </h2>
          <p className='text-sm text-muted-foreground mt-1'>
            Showing {groupedData.length} grouped detections from{' '}
            {rawData.length} total frames
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='outline' size='sm' className='gap-2'>
              <IconLayoutColumns className='size-4' />
              Columns
              <IconChevronDown className='size-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-56'>
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className='capitalize'
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }>
                    {column.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className='rounded-lg border bg-card shadow-sm'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className='border-b bg-muted/50'>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className='font-semibold text-foreground py-4'
                    style={{ width: header.getSize() }}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row, index) => (
                <TableRow
                  key={row.id}
                  className={`border-b hover:bg-muted/30 transition-colors ${
                    index % 2 === 0 ? 'bg-background' : 'bg-muted/10'
                  }`}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className='py-4'
                      style={{ width: cell.column.getSize() }}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-32 text-center text-muted-foreground'>
                  <div className='flex flex-col items-center gap-2'>
                    <IconEye className='size-8 opacity-50' />
                    <p>No detections found.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
