
import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity } from 'lucide-react';
import { API_BASE_URL } from '@/services/api';
import { cn } from '@/lib/utils';
import StatusBadge, { StatusDot } from './StatusBadge';

const checkHealth = async () => {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (!res.ok) throw new Error('Health check failed');
    return res.json();
};

export const SystemStatus = ({ className }: { className?: string }) => {
    const { data, error, isError } = useQuery({
        queryKey: ['health'],
        queryFn: checkHealth,
        refetchInterval: 30000, // Check every 30s
        retry: false
    });

    const isOnline = !isError && data;

    return (
        <div className={cn("flex items-center gap-2 text-sm", className)}>
            <StatusDot
                status={isOnline ? 'success' : 'error'}
                pulse={isOnline}
            />
            <span className={isOnline ? "text-muted-foreground" : "text-destructive"}>
                {isOnline ? "System Online" : "System Offline"}
            </span>
            {isOnline && data?.cpu_usage && (
                <span className="text-xs text-muted-foreground hidden sm:inline-flex items-center gap-1 border-l pl-2 ml-1">
                    <Activity className="w-3 h-3" />
                    CPU: {data.cpu_usage}%
                </span>
            )}
        </div>
    );
};
