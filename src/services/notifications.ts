/**
 * Notification Service
 * 
 * Centralized notification management for consistent toast messages.
 * Wraps sonner toast with app-specific configurations.
 */
import { toast as sonnerToast, ExternalToast } from "sonner";

type NotificationType = "success" | "error" | "info" | "warning" | "loading";

interface NotificationOptions extends ExternalToast {
    id?: string | number;
}

class NotificationService {
    private defaultDuration = 4000;

    /**
     * Show a success notification
     */
    success(message: string, options?: NotificationOptions) {
        return sonnerToast.success(message, {
            duration: this.defaultDuration,
            ...options,
        });
    }

    /**
     * Show an error notification
     */
    error(message: string, options?: NotificationOptions) {
        return sonnerToast.error(message, {
            duration: 6000, // Errors stay longer
            ...options,
        });
    }

    /**
     * Show an info notification
     */
    info(message: string, options?: NotificationOptions) {
        return sonnerToast.info(message, {
            duration: this.defaultDuration,
            ...options,
        });
    }

    /**
     * Show a warning notification
     */
    warning(message: string, options?: NotificationOptions) {
        return sonnerToast.warning(message, {
            duration: 5000,
            ...options,
        });
    }

    /**
     * Show a loading notification that can be updated
     */
    loading(message: string, options?: NotificationOptions) {
        return sonnerToast.loading(message, options);
    }

    /**
     * Show a promise-based notification
     */
    promise<T>(
        promise: Promise<T>,
        messages: {
            loading: string;
            success: string | ((data: T) => string);
            error: string | ((error: any) => string);
        }
    ) {
        return sonnerToast.promise(promise, messages);
    }

    /**
     * Dismiss a specific notification or all
     */
    dismiss(id?: string | number) {
        if (id) {
            sonnerToast.dismiss(id);
        } else {
            sonnerToast.dismiss();
        }
    }

    // Pre-configured notifications for common actions

    strategySaved() {
        this.success("Strategy saved", { description: "Your changes have been saved." });
    }

    backtestStarted() {
        return this.loading("Running backtest...", { id: "backtest" });
    }

    backtestComplete(stats?: { totalReturn?: number; trades?: number }) {
        this.dismiss("backtest");
        if (stats) {
            const returnStr = stats.totalReturn ? `${stats.totalReturn.toFixed(2)}%` : "N/A";
            this.success("Backtest complete", {
                description: `Return: ${returnStr}, Trades: ${stats.trades || 0}`
            });
        } else {
            this.success("Backtest complete");
        }
    }

    backtestFailed(error?: string) {
        this.dismiss("backtest");
        this.error("Backtest failed", { description: error || "An error occurred" });
    }

    strategyLaunched(mode: "paper" | "live") {
        const modeText = mode === "live" ? "LIVE" : "Paper";
        this.success(`Strategy launched (${modeText})`, {
            description: mode === "live" ? "⚠️ Trading with real money" : "Simulated trading active"
        });
    }

    strategyStopped() {
        this.info("Strategy stopped");
    }

    connectionError() {
        this.error("Connection error", { description: "Backend not reachable" });
    }

    unauthorized() {
        this.warning("Session expired", { description: "Please log in again" });
    }
}

// Export singleton instance
export const notify = new NotificationService();
export default notify;
