import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface UseCopyToClipboardOptions {
    successMessage?: string;
    errorMessage?: string;
    timeout?: number;
}

interface UseCopyToClipboardReturn {
    copied: boolean;
    copy: (text: string) => Promise<boolean>;
    reset: () => void;
}

/**
 * Hook for copying text to clipboard with feedback.
 * 
 * @example
 * const { copy, copied } = useCopyToClipboard();
 * <Button onClick={() => copy(strategyCode)}>
 *   {copied ? 'Copied!' : 'Copy Code'}
 * </Button>
 */
export function useCopyToClipboard(
    options: UseCopyToClipboardOptions = {}
): UseCopyToClipboardReturn {
    const {
        successMessage = 'Copied to clipboard',
        errorMessage = 'Failed to copy',
        timeout = 2000,
    } = options;

    const [copied, setCopied] = useState(false);

    const copy = useCallback(
        async (text: string): Promise<boolean> => {
            if (!navigator?.clipboard) {
                // Fallback for older browsers
                try {
                    const textArea = document.createElement('textarea');
                    textArea.value = text;
                    textArea.style.position = 'fixed';
                    textArea.style.left = '-999999px';
                    textArea.style.top = '-999999px';
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();

                    const success = document.execCommand('copy');
                    document.body.removeChild(textArea);

                    if (success) {
                        setCopied(true);
                        toast.success(successMessage);
                        setTimeout(() => setCopied(false), timeout);
                        return true;
                    }
                    throw new Error('execCommand failed');
                } catch (err) {
                    toast.error(errorMessage);
                    return false;
                }
            }

            try {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                toast.success(successMessage);
                setTimeout(() => setCopied(false), timeout);
                return true;
            } catch (err) {
                toast.error(errorMessage);
                return false;
            }
        },
        [successMessage, errorMessage, timeout]
    );

    const reset = useCallback(() => {
        setCopied(false);
    }, []);

    return { copied, copy, reset };
}

/**
 * Copy button component for convenience.
 */
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CopyButtonProps {
    text: string;
    className?: string;
    variant?: 'default' | 'outline' | 'ghost' | 'secondary';
    size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function CopyButton({ text, className, variant = 'ghost', size = 'icon' }: CopyButtonProps) {
    const { copy, copied } = useCopyToClipboard();

    return (
        <Button
            variant={variant}
            size={size}
            className={className}
            onClick={() => copy(text)}
        >
            {copied ? (
                <Check className="h-4 w-4 text-green-500" />
            ) : (
                <Copy className="h-4 w-4" />
            )}
        </Button>
    );
}

export default useCopyToClipboard;
