/**
 * PageHeader - Consistent title bar for app pages (executions, credentials, settings, etc.)
 * Same width (max-w-7xl) and styling across all pages.
 */

import { ReactNode } from 'react';

interface PageHeaderProps {
    icon?: ReactNode;
    title: string;
    subtitle?: ReactNode;
    actions?: ReactNode;
}

const CONTAINER_CLASS = 'max-w-7xl mx-auto px-6';

export const PAGE_HEADER_CLASSES = 'flex items-center justify-between py-3 bg-[#252526]/90 backdrop-blur-sm border-b border-white/10';

export const PageHeader = ({ icon, title, subtitle, actions }: PageHeaderProps) => {
    return (
        <header className={`sticky top-14 z-30 ${PAGE_HEADER_CLASSES}`}>
            <div className={`w-full ${CONTAINER_CLASS} flex items-center justify-between`}>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        {icon}
                        <h1 className="text-white font-medium text-sm tracking-tight">
                            {title}
                        </h1>
                    </div>
                    {subtitle != null && (
                        <>
                            <div className="h-4 w-px bg-white/10" />
                            <span className="text-white/40 text-xs flex items-center">
                                {subtitle}
                            </span>
                        </>
                    )}
                </div>
                {actions != null && (
                    <div className="flex items-center gap-2">
                        {actions}
                    </div>
                )}
            </div>
        </header>
    );
};

export const PAGE_CONTENT_CLASS = CONTAINER_CLASS;
