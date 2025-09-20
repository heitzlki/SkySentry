"use client"

import * as React from "react"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  IconChevronDown,
  IconCircleCheckFilled,
  IconDotsVertical,
  IconGripVertical,
  IconLayoutColumns,
  IconLoader,
  IconPlus,
  IconMapPin,
  IconTrash,
  IconBell,
  IconEye,
  IconMap,
  IconEdit,
  IconSearch,
  IconRefresh,
} from "@tabler/icons-react"
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  Row,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table"
import { toast } from "sonner"
import { z } from "zod"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

function DetectionDetailDialog({ detection }: { detection: z.infer<typeof schema> }) {
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
        >
          <IconEye className="text-muted-foreground size-4" />
          <span className="sr-only">View details</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {detection.status === "active" && (
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              )}
              {detection.status === "investigating" && (
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              )}
              {detection.status === "resolved" && (
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              )}
              {detection.status === "false-positive" && (
                <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
              )}
              <Badge variant="outline">{detection.objectType}</Badge>
            </div>
            <span className="text-muted-foreground">Detection Details</span>
          </DialogTitle>
          <DialogDescription>
            Detailed information about the detected object
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Detection Image</Label>
              <div className="mt-2">
                <img
                  src={detection.imagePath}
                  alt={detection.objectType}
                  className="w-full h-48 object-cover rounded-lg border"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = `https://picsum.photos/seed/${detection.id}/400/300.jpg`
                  }}
                />
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-muted-foreground">Notes</Label>
              <p className="mt-1 text-sm">{detection.notes || "No additional notes"}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                <div className="mt-1 flex items-center gap-2">
                  {detection.status === "active" && (
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  )}
                  {detection.status === "investigating" && (
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  )}
                  {detection.status === "resolved" && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  )}
                  {detection.status === "false-positive" && (
                    <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                  )}
                  <Badge variant="outline" className="capitalize">
                    {detection.status}
                  </Badge>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-muted-foreground">Danger Score</Label>
                <div className="mt-1">
                  <Badge
                    variant={detection.dangerScore >= 66 ? "destructive" : detection.dangerScore >= 33 ? "default" : "secondary"}
                  >
                    {detection.dangerScore}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Confidence</Label>
                <p className="mt-1 font-mono">{detection.confidence.toFixed(1)}%</p>
              </div>

              <div>
                <Label className="text-sm font-medium text-muted-foreground">Accuracy</Label>
                <p className="mt-1 font-mono">{detection.accuracy.toFixed(1)}%</p>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-muted-foreground">Location</Label>
              <div className="mt-1 flex items-center gap-1">
                <IconMapPin className="text-muted-foreground size-4" />
                <span>{detection.location}</span>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-muted-foreground">Coordinates</Label>
              <div className="mt-1 space-y-1 text-sm font-mono">
                <div>X: {detection.x.toFixed(1)}</div>
                <div>Y: {detection.y.toFixed(1)}</div>
                <div>Z: {detection.z.toFixed(1)}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {detection.speed && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Speed</Label>
                  <p className="mt-1 font-mono">{detection.speed.toFixed(1)} m/s</p>
                </div>
              )}

              {detection.altitude && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Altitude</Label>
                  <p className="mt-1 font-mono">{detection.altitude.toFixed(1)} m</p>
                </div>
              )}
            </div>

            <div>
              <Label className="text-sm font-medium text-muted-foreground">Timestamp</Label>
              <p className="mt-1 text-sm">
                {new Date(detection.timestamp).toLocaleString()}
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium text-muted-foreground">Duration</Label>
              <p className="mt-1 font-mono">{detection.duration.toFixed(1)} seconds</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button onClick={() => {
            toast.info(`Opening map for ${detection.location}`)
            setOpen(false)
          }}>
            <IconMap className="mr-2 size-4" />
            View on Map
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export const schema = z.object({
  id: z.number(),
  objectType: z.string(),
  timestamp: z.string(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  duration: z.number(),
  accuracy: z.number(),
  dangerScore: z.number(),
  imagePath: z.string(),
  location: z.string(),
  status: z.enum(["active", "investigating", "resolved", "false-positive"]),
  confidence: z.number(),
  speed: z.number().optional(),
  altitude: z.number().optional(),
  notes: z.string().optional(),
})

// Create a separate component for the drag handle
function DragHandle({ id }: { id: number }) {
  const { attributes, listeners } = useSortable({
    id,
  })

  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="text-muted-foreground size-7 hover:bg-transparent"
    >
      <IconGripVertical className="text-muted-foreground size-3" />
      <span className="sr-only">Drag to reorder</span>
    </Button>
  )
}

function DraggableRow({ row }: { row: Row<z.infer<typeof schema>> }) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.original.id,
  })

  return (
    <TableRow
      data-state={row.getIsSelected() && "selected"}
      data-dragging={isDragging}
      ref={setNodeRef}
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  )
}

export function ObjectDetectionDataTable({
  data: initialData,
}: {
  data: z.infer<typeof schema>[]
}) {
  const [data, setData] = React.useState(() => initialData)
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [page, setPage] = React.useState(1)
  const [hasMore, setHasMore] = React.useState(true)
  const tableContainerRef = React.useRef<HTMLDivElement>(null)
  const sortableId = React.useId()
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  )

  const columns: ColumnDef<z.infer<typeof schema>>[] = [
    {
      id: "drag",
      header: () => null,
      cell: ({ row }) => <DragHandle id={row.original.id} />,
    },
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "objectType",
      header: "Object Type",
      cell: ({ row }) => (
        <div className="flex flex-col gap-1 w-40">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {row.original.status === "active" && (
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              )}
              {row.original.status === "investigating" && (
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              )}
              {row.original.status === "resolved" && (
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              )}
              {row.original.status === "false-positive" && (
                <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
              )}
              <Badge variant="outline" className="text-muted-foreground px-1.5">
                {row.original.objectType}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="font-mono">{row.original.confidence.toFixed(1)}%</span>
            {row.original.speed && (
              <span className="font-mono">{row.original.speed.toFixed(1)} m/s</span>
            )}
          </div>
        </div>
      ),
      enableHiding: false,
    },
    {
      accessorKey: "timestamp",
      header: "Time",
      cell: ({ row }) => {
        const date = new Date(row.original.timestamp)
        return date.toLocaleString()
      },
    },
    {
      accessorKey: "location",
      header: "Location",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <IconMapPin className="text-muted-foreground size-4" />
          <div className="flex flex-col">
            <span>{row.original.location}</span>
            {row.original.altitude && (
              <span className="text-xs text-muted-foreground">
                Alt: {row.original.altitude.toFixed(1)}m
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "coordinates",
      header: "Coordinates",
      cell: ({ row }) => (
        <div className="text-sm">
          <div>X: {row.original.x}</div>
          <div>Y: {row.original.y}</div>
          <div>Z: {row.original.z}</div>
        </div>
      ),
    },
    {
      accessorKey: "duration",
      header: "Duration (s)",
      cell: ({ row }) => (
        <div className="text-right font-mono">
          {row.original.duration.toFixed(1)}
        </div>
      ),
    },
    {
      accessorKey: "accuracy",
      header: "Accuracy (%)",
      cell: ({ row }) => (
        <div className="text-right font-mono">
          {row.original.accuracy.toFixed(1)}
        </div>
      ),
    },
    {
      accessorKey: "dangerScore",
      header: "Danger Score",
      cell: ({ row }) => {
        const score = row.original.dangerScore
        let variant: "default" | "secondary" | "destructive" = "default"
        let className = ""

        if (score >= 66) {
          variant = "destructive"
          className = "bg-red-100 text-red-800 border-red-200"
        } else if (score >= 33) {
          variant = "default"
          className = "bg-yellow-100 text-yellow-800 border-yellow-200"
        } else {
          variant = "secondary"
          className = "bg-green-100 text-green-800 border-green-200"
        }

        return (
          <div className="text-center">
            <Badge variant={variant} className={className}>
              {score}
            </Badge>
          </div>
        )
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <DetectionDetailDialog detection={row.original} />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              toast.info(`Opening map for ${row.original.location}`)
            }}
          >
            <IconMap className="text-muted-foreground size-4" />
            <span className="sr-only">View on map</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="data-[state=open]:bg-muted text-muted-foreground flex size-8"
                size="icon"
              >
                <IconDotsVertical />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => {
                toast.info(`Editing detection ${row.original.id}`)
              }}>
                <IconEdit className="mr-2 size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                toast.info(`Marking ${row.original.objectType} as resolved`)
              }}>
                <IconCircleCheckFilled className="mr-2 size-4" />
                Mark Resolved
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                toast.info(`Sending notification for ${row.original.objectType}`)
              }}>
                <IconBell className="mr-2 size-4" />
                Send Notification
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                toast.info(`Investigating ${row.original.objectType}`)
              }}>
                <IconSearch className="mr-2 size-4" />
                Investigate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  setData(prev => prev.filter(item => item.id !== row.original.id))
                  toast.success("Detection deleted")
                }}
              >
                <IconTrash className="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => data?.map(({ id }) => id) || [],
    [data]
  )

  const loadMoreData = React.useCallback(async () => {
    if (isLoading || !hasMore) return

    setIsLoading(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 1000))

      const newData = Array.from({ length: 5 }, (_, i) => ({
        id: data.length + i + 1,
        objectType: ["Drone", "Bird", "Aircraft", "Balloon", "Helicopter"][Math.floor(Math.random() * 5)],
        timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
        x: Math.random() * 500,
        y: Math.random() * 500,
        z: Math.random() * 300,
        duration: Math.random() * 60,
        accuracy: 70 + Math.random() * 30,
        dangerScore: Math.floor(Math.random() * 100),
        imagePath: `/detections/mock_${data.length + i + 1}.png`,
        location: `Zone ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`,
        status: ["active", "investigating", "resolved", "false-positive"][Math.floor(Math.random() * 4)] as "active" | "investigating" | "resolved" | "false-positive",
        confidence: 70 + Math.random() * 30,
        speed: Math.random() * 150,
        altitude: Math.random() * 300,
        notes: `Mock detection ${data.length + i + 1}`
      }))

      setData(prev => [...prev, ...newData])
      setPage(prev => prev + 1)

      if (page >= 5) {
        setHasMore(false)
      }
    } catch (error) {
      console.error('Error loading more data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, hasMore, page, data.length])

  React.useEffect(() => {
    const handleScroll = () => {
      if (!tableContainerRef.current || isLoading || !hasMore) return

      const { scrollTop, scrollHeight, clientHeight } = tableContainerRef.current
      const scrollPercentage = (scrollTop + clientHeight) / scrollHeight

      if (scrollPercentage > 0.8) {
        loadMoreData()
      }
    }

    const container = tableContainerRef.current
    if (container) {
      container.addEventListener('scroll', handleScroll)
      return () => container.removeEventListener('scroll', handleScroll)
    }
  }, [loadMoreData, isLoading, hasMore])

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setData((data) => {
        const oldIndex = dataIds.indexOf(active.id)
        const newIndex = dataIds.indexOf(over.id)
        return arrayMove(data, oldIndex, newIndex)
      })
    }
  }

  const addDetection = () => {
    const newDetection = {
      id: data.length + 1,
      objectType: "Unknown Object",
      timestamp: new Date().toISOString(),
      x: Math.random() * 500,
      y: Math.random() * 500,
      z: Math.random() * 300,
      duration: Math.random() * 60,
      accuracy: 70 + Math.random() * 30,
      dangerScore: Math.floor(Math.random() * 100),
      imagePath: `/detections/new_${data.length + 1}.png`,
      location: `Zone ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`,
      status: "active" as const,
      confidence: 70 + Math.random() * 30,
      speed: Math.random() * 150,
      altitude: Math.random() * 300,
      notes: "New detection - manual entry"
    }
    setData(prev => [newDetection, ...prev])
    toast.success("New detection added")
  }

  
  return (
    <Tabs
      defaultValue="outline"
      className="w-full flex-col justify-start gap-6"
    >
      <div className="flex items-center justify-between px-4 lg:px-6">
        <Label htmlFor="view-selector" className="sr-only">
          View
        </Label>
        <Select defaultValue="outline">
          <SelectTrigger
            className="flex w-fit @4xl/main:hidden"
            size="sm"
            id="view-selector"
          >
            <SelectValue placeholder="Select a view" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="outline">Outline</SelectItem>
            <SelectItem value="past-performance">Past Performance</SelectItem>
            <SelectItem value="key-personnel">Key Personnel</SelectItem>
            <SelectItem value="focus-documents">Focus Documents</SelectItem>
          </SelectContent>
        </Select>
        <TabsList className="**:data-[slot=badge]:bg-muted-foreground/30 hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1 @4xl/main:flex">
          <TabsTrigger value="detections">Detections</TabsTrigger>
          <TabsTrigger value="analytics">
            Analytics <Badge variant="secondary">3</Badge>
          </TabsTrigger>
          <TabsTrigger value="threats">
            Threats <Badge variant="secondary">2</Badge>
          </TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <IconLayoutColumns />
                <span className="hidden lg:inline">Customize Columns</span>
                <span className="lg:hidden">Columns</span>
                <IconChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.accessorFn !== "undefined" &&
                    column.getCanHide()
                )
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={addDetection}>
            <IconPlus />
            <span className="hidden lg:inline">Add Detection</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => loadMoreData()}>
            <IconRefresh />
            <span className="hidden lg:inline">Load More</span>
          </Button>
        </div>
      </div>
      <TabsContent
        value="detections"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        <div className="overflow-hidden rounded-lg border" ref={tableContainerRef} style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
            sensors={sensors}
            id={sortableId}
          >
            <Table>
              <TableHeader className="bg-muted sticky top-0 z-10">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id} colSpan={header.colSpan}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody className="**:data-[slot=table-cell]:first:w-8">
                {table.getRowModel().rows?.length ? (
                  <SortableContext
                    items={dataIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {table.getRowModel().rows.map((row) => (
                      <DraggableRow key={row.id} row={row} />
                    ))}
                  </SortableContext>
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DndContext>
        </div>
        <div className="flex items-center justify-between px-4">
          <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
            {table.getFilteredSelectedRowModel().rows.length} of{" "}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Showing {data.length} detections
              </span>
              {isLoading && (
                <IconLoader className="animate-spin size-4" />
              )}
              {!hasMore && (
                <span className="text-sm text-muted-foreground">
                  (All data loaded)
                </span>
              )}
            </div>
          </div>
        </div>
      </TabsContent>
      <TabsContent
        value="analytics"
        className="flex flex-col px-4 lg:px-6"
      >
        <div className="aspect-video w-full flex-1 rounded-lg border border-dashed"></div>
      </TabsContent>
      <TabsContent value="threats" className="flex flex-col px-4 lg:px-6">
        <div className="aspect-video w-full flex-1 rounded-lg border border-dashed"></div>
      </TabsContent>
      <TabsContent
        value="statistics"
        className="flex flex-col px-4 lg:px-6"
      >
        <div className="aspect-video w-full flex-1 rounded-lg border border-dashed"></div>
      </TabsContent>
    </Tabs>
  )
}


