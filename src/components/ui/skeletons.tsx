import { cn } from "@/lib/utils";
import { CSSProperties } from "react";

interface SkeletonProps {
    className?: string;
    style?: CSSProperties;
}

export const Skeleton = ({ className, style }: SkeletonProps) => (
    <div
        className={cn(
            "animate-pulse rounded-md bg-muted",
            className
        )}
        style={style}
    />
);

export const CardSkeleton = () => (
    <div className="rounded-lg border bg-card p-4 space-y-3">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
    </div>
);

export const TableRowSkeleton = ({ columns = 5 }: { columns?: number }) => (
    <tr className="border-b">
        {Array.from({ length: columns }).map((_, i) => (
            <td key={i} className="p-3">
                <Skeleton className="h-4 w-full" />
            </td>
        ))}
    </tr>
);

export const TableSkeleton = ({ rows = 5, columns = 5 }) => (
    <div className="w-full">
        <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
                <thead>
                    <tr className="bg-muted/50 border-b">
                        {Array.from({ length: columns }).map((_, i) => (
                            <th key={i} className="p-3 text-left">
                                <Skeleton className="h-4 w-20" />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: rows }).map((_, i) => (
                        <TableRowSkeleton key={i} columns={columns} />
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

export const ChartSkeleton = ({ height = "h-64" }: { height?: string }) => (
    <div className={cn("rounded-lg border bg-card p-4", height)}>
        <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-5 w-32" />
            <div className="flex gap-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
            </div>
        </div>
        <div className="flex items-end gap-1 h-[calc(100%-3rem)]">
            {Array.from({ length: 20 }).map((_, i) => (
                <Skeleton
                    key={i}
                    className="flex-1"
                    style={{ height: `${30 + Math.random() * 60}%` }}
                />
            ))}
        </div>
    </div>
);

export const DashboardSkeleton = () => (
    <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
        </div>
        <ChartSkeleton height="h-80" />
        <TableSkeleton rows={5} columns={6} />
    </div>
);

export const StrategySkeleton = () => (
    <div className="space-y-4">
        <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <div className="flex gap-2">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-24" />
            </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
        </div>
    </div>
);

export const ListSkeleton = ({ items = 5 }: { items?: number }) => (
    <div className="space-y-3">
        {Array.from({ length: items }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-2/3" />
                </div>
                <Skeleton className="h-8 w-20" />
            </div>
        ))}
    </div>
);

export default Skeleton;
