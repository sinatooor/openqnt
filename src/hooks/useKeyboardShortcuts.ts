import { useEffect, useCallback } from "react";
import { toast } from "sonner";

interface KeyboardShortcutsConfig {
    onSave?: () => void;
    onUndo?: () => void;
    onRedo?: () => void;
    onRun?: () => void;
    onSearch?: () => void;
    onExport?: () => void;
    onHelp?: () => void;
    enabled?: boolean;
}

/**
 * Hook for handling keyboard shortcuts in the workspace.
 * 
 * Shortcuts:
 * - Ctrl/Cmd + S: Save
 * - Ctrl/Cmd + Z: Undo
 * - Ctrl/Cmd + Shift + Z: Redo
 * - Ctrl/Cmd + Enter: Run/Execute
 * - Ctrl/Cmd + K: Search
 * - Ctrl/Cmd + E: Export
 * - F1: Help
 */
export const useKeyboardShortcuts = ({
    onSave,
    onUndo,
    onRedo,
    onRun,
    onSearch,
    onExport,
    onHelp,
    enabled = true,
}: KeyboardShortcutsConfig) => {
    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            if (!enabled) return;

            const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
            const modifier = isMac ? event.metaKey : event.ctrlKey;

            // Ctrl/Cmd + S: Save
            if (modifier && event.key === "s") {
                event.preventDefault();
                if (onSave) {
                    onSave();
                    toast.success("Saved", { duration: 1500 });
                }
                return;
            }

            // Ctrl/Cmd + Z: Undo
            if (modifier && event.key === "z" && !event.shiftKey) {
                event.preventDefault();
                if (onUndo) {
                    onUndo();
                }
                return;
            }

            // Ctrl/Cmd + Shift + Z: Redo
            if (modifier && event.key === "z" && event.shiftKey) {
                event.preventDefault();
                if (onRedo) {
                    onRedo();
                }
                return;
            }

            // Ctrl/Cmd + Enter: Run
            if (modifier && event.key === "Enter") {
                event.preventDefault();
                if (onRun) {
                    onRun();
                    toast.info("Running...", { duration: 1500 });
                }
                return;
            }

            // Ctrl/Cmd + K: Search
            if (modifier && event.key === "k") {
                event.preventDefault();
                if (onSearch) {
                    onSearch();
                }
                return;
            }

            // Ctrl/Cmd + E: Export
            if (modifier && event.key === "e") {
                event.preventDefault();
                if (onExport) {
                    onExport();
                }
                return;
            }

            // F1: Help
            if (event.key === "F1") {
                event.preventDefault();
                if (onHelp) {
                    onHelp();
                }
                return;
            }
        },
        [enabled, onSave, onUndo, onRedo, onRun, onSearch, onExport, onHelp]
    );

    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [handleKeyDown]);
};

// Shortcut display helper
export const SHORTCUTS = [
    { key: "⌘/Ctrl + S", action: "Save workspace" },
    { key: "⌘/Ctrl + Z", action: "Undo" },
    { key: "⌘/Ctrl + ⇧ + Z", action: "Redo" },
    { key: "⌘/Ctrl + Enter", action: "Run backtest" },
    { key: "⌘/Ctrl + K", action: "Search blocks" },
    { key: "⌘/Ctrl + E", action: "Export strategy" },
    { key: "F1", action: "Show help" },
];

export default useKeyboardShortcuts;
