import { useState } from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, Info, CheckCircle } from 'lucide-react';

type DialogVariant = 'default' | 'destructive' | 'warning' | 'info';

interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: DialogVariant;
    onConfirm: () => void | Promise<void>;
    onCancel?: () => void;
}

const variantStyles = {
    default: {
        icon: CheckCircle,
        iconClass: 'text-primary',
        buttonClass: '',
    },
    destructive: {
        icon: AlertTriangle,
        iconClass: 'text-destructive',
        buttonClass: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    },
    warning: {
        icon: AlertTriangle,
        iconClass: 'text-yellow-500',
        buttonClass: 'bg-yellow-500 text-white hover:bg-yellow-600',
    },
    info: {
        icon: Info,
        iconClass: 'text-blue-500',
        buttonClass: 'bg-blue-500 text-white hover:bg-blue-600',
    },
};

export const ConfirmDialog = ({
    open,
    onOpenChange,
    title,
    description,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'default',
    onConfirm,
    onCancel,
}: ConfirmDialogProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const { icon: Icon, iconClass, buttonClass } = variantStyles[variant];

    const handleConfirm = async () => {
        setIsLoading(true);
        try {
            await onConfirm();
            onOpenChange(false);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        onCancel?.();
        onOpenChange(false);
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full bg-muted ${iconClass}`}>
                            <Icon className="w-5 h-5" />
                        </div>
                        <AlertDialogTitle>{title}</AlertDialogTitle>
                    </div>
                    <AlertDialogDescription className="pl-12">
                        {description}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={handleCancel} disabled={isLoading}>
                        {cancelText}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirm}
                        disabled={isLoading}
                        className={buttonClass}
                    >
                        {isLoading ? 'Processing...' : confirmText}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

// Hook for easy confirmation dialogs
export const useConfirmDialog = () => {
    const [state, setState] = useState<{
        open: boolean;
        title: string;
        description: string;
        variant: DialogVariant;
        onConfirm: () => void | Promise<void>;
    }>({
        open: false,
        title: '',
        description: '',
        variant: 'default',
        onConfirm: () => { },
    });

    const confirm = (options: {
        title: string;
        description: string;
        variant?: DialogVariant;
    }): Promise<boolean> => {
        return new Promise((resolve) => {
            setState({
                open: true,
                title: options.title,
                description: options.description,
                variant: options.variant || 'default',
                onConfirm: () => resolve(true),
            });
        });
    };

    const dialog = (
        <ConfirmDialog
            open={state.open}
            onOpenChange={(open) => setState((s) => ({ ...s, open }))}
            title={state.title}
            description={state.description}
            variant={state.variant}
            onConfirm={state.onConfirm}
        />
    );

    return { confirm, dialog };
};

export default ConfirmDialog;
