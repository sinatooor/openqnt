/**
 * WorkflowManagerStore - Manages multiple open workflow tabs and the saved workflow library.
 *
 * Architecture:
 * - `tabs[]`          : open workflow tabs (in-memory snapshots of the canvas per tab)
 * - `savedWorkflows[]`: persisted library of user-saved workflows
 * - `activeTabId`     : which tab is currently shown on the canvas
 *
 * When the user switches tabs:
 *  1. The current tab's canvas state is flushed via `syncFromCanvas()`
 *  2. `switchTab()` updates `activeTabId`
 *  3. The canvas reads the new active tab and hydrates `strategyFlowStore`
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Viewport } from '@xyflow/react';
import type { StrategyFlowNode, StrategyFlowEdge } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const generateId = () =>
  `wf-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExecutionOrder = 'v0' | 'v1';

/** A workflow that has been saved to the library */
export interface SavedWorkflow {
  id: string;
  name: string;
  description: string;
  nodes: StrategyFlowNode[];
  edges: StrategyFlowEdge[];
  /** Whether this workflow is published and will run automatically */
  isActive: boolean;
  /** v1 = one branch fully before next; v0 = legacy interleaved */
  executionOrder: ExecutionOrder;
  savedAt: number;
  updatedAt: number;
  tags: string[];
}

/** An open canvas tab (may or may not be saved yet) */
export interface WorkflowTab {
  /** Unique tab instance id */
  id: string;
  /** Points to a SavedWorkflow.id if this tab has been saved */
  workflowId: string | null;
  name: string;
  description: string;
  nodes: StrategyFlowNode[];
  edges: StrategyFlowEdge[];
  viewport: Viewport;
  isActive: boolean;
  executionOrder: ExecutionOrder;
  isModified: boolean;
  lastSavedAt: number | null;
}

// ---------------------------------------------------------------------------
// Store state & actions
// ---------------------------------------------------------------------------

interface WorkflowManagerState {
  tabs: WorkflowTab[];
  activeTabId: string;
  savedWorkflows: SavedWorkflow[];
}

interface WorkflowManagerActions {
  // ── Tab management ──────────────────────────────────────────────────────
  createNewTab: (overrides?: Partial<Omit<WorkflowTab, 'id'>>) => string;
  closeTab: (tabId: string) => void;
  /** Switch active tab — caller is responsible for hydrating the canvas */
  switchTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<WorkflowTab>) => void;
  /** Push the current canvas state into the given tab snapshot */
  syncFromCanvas: (
    tabId: string,
    data: {
      nodes: StrategyFlowNode[];
      edges: StrategyFlowEdge[];
      viewport: Viewport;
      name: string;
      description: string;
    },
  ) => void;

  // ── Workflow library ────────────────────────────────────────────────────
  saveWorkflow: (tabId: string) => void;
  /** Open a saved workflow in a new tab (or focus existing tab) */
  loadWorkflow: (workflowId: string) => string;
  deleteWorkflow: (workflowId: string) => void;

  // ── Per-tab settings ────────────────────────────────────────────────────
  toggleActive: (tabId: string) => void;
  setExecutionOrder: (tabId: string, order: ExecutionOrder) => void;

  // ── Selectors ────────────────────────────────────────────────────────────
  getActiveTab: () => WorkflowTab | undefined;
  getTab: (tabId: string) => WorkflowTab | undefined;
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

const createDefaultTab = (overrides?: Partial<WorkflowTab>): WorkflowTab => ({
  id: generateId(),
  workflowId: null,
  name: 'Untitled Strategy',
  description: '',
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  isActive: false,
  executionOrder: 'v1',
  isModified: false,
  lastSavedAt: null,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const _defaultTab = createDefaultTab();

export const useWorkflowManagerStore = create<WorkflowManagerState & WorkflowManagerActions>()(
  persist(
    (set, get) => ({
      tabs: [_defaultTab],
      activeTabId: _defaultTab.id,
      savedWorkflows: [],

      // ── Tab management ────────────────────────────────────────────────────

      createNewTab: (overrides) => {
        const newTab = createDefaultTab(overrides as Partial<WorkflowTab>);
        set((s) => ({ tabs: [...s.tabs, newTab], activeTabId: newTab.id }));
        return newTab.id;
      },

      closeTab: (tabId) => {
        const { tabs, activeTabId } = get();
        if (tabs.length <= 1) return; // keep at least one tab open

        const idx = tabs.findIndex((t) => t.id === tabId);
        const remaining = tabs.filter((t) => t.id !== tabId);
        let newActive = activeTabId;

        if (activeTabId === tabId) {
          // switch to adjacent
          newActive = remaining[Math.max(0, idx - 1)].id;
        }

        set({ tabs: remaining, activeTabId: newActive });
      },

      switchTab: (tabId) => {
        set({ activeTabId: tabId });
      },

      updateTab: (tabId, updates) => {
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, ...updates } : t)),
        }));
      },

      syncFromCanvas: (tabId, data) => {
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  nodes: data.nodes,
                  edges: data.edges,
                  viewport: data.viewport,
                  name: data.name,
                  description: data.description,
                  isModified: true,
                }
              : t,
          ),
        }));
      },

      // ── Workflow library ──────────────────────────────────────────────────

      saveWorkflow: (tabId) => {
        const tab = get().tabs.find((t) => t.id === tabId);
        if (!tab) return;

        const now = Date.now();
        const existingId = tab.workflowId;

        if (existingId) {
          // Update existing saved workflow
          set((s) => ({
            savedWorkflows: s.savedWorkflows.map((w) =>
              w.id === existingId
                ? {
                    ...w,
                    name: tab.name,
                    description: tab.description,
                    nodes: tab.nodes,
                    edges: tab.edges,
                    isActive: tab.isActive,
                    executionOrder: tab.executionOrder,
                    updatedAt: now,
                  }
                : w,
            ),
            tabs: s.tabs.map((t) =>
              t.id === tabId ? { ...t, isModified: false, lastSavedAt: now } : t,
            ),
          }));
        } else {
          // Save as new
          const newId = generateId();
          const saved: SavedWorkflow = {
            id: newId,
            name: tab.name,
            description: tab.description,
            nodes: tab.nodes,
            edges: tab.edges,
            isActive: tab.isActive,
            executionOrder: tab.executionOrder,
            savedAt: now,
            updatedAt: now,
            tags: [],
          };
          set((s) => ({
            savedWorkflows: [...s.savedWorkflows, saved],
            tabs: s.tabs.map((t) =>
              t.id === tabId
                ? { ...t, workflowId: newId, isModified: false, lastSavedAt: now }
                : t,
            ),
          }));
        }
      },

      loadWorkflow: (workflowId) => {
        const { savedWorkflows, tabs } = get();
        const wf = savedWorkflows.find((w) => w.id === workflowId);
        if (!wf) return '';

        // Already open? Focus that tab.
        const existing = tabs.find((t) => t.workflowId === workflowId);
        if (existing) {
          set({ activeTabId: existing.id });
          return existing.id;
        }

        // Open in a new tab
        const newTab = createDefaultTab({
          workflowId: wf.id,
          name: wf.name,
          description: wf.description,
          nodes: wf.nodes,
          edges: wf.edges,
          isActive: wf.isActive,
          executionOrder: wf.executionOrder,
          isModified: false,
          lastSavedAt: wf.updatedAt,
        });

        set((s) => ({ tabs: [...s.tabs, newTab], activeTabId: newTab.id }));
        return newTab.id;
      },

      deleteWorkflow: (workflowId) => {
        set((s) => ({
          savedWorkflows: s.savedWorkflows.filter((w) => w.id !== workflowId),
        }));
      },

      // ── Per-tab settings ──────────────────────────────────────────────────

      toggleActive: (tabId) => {
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId ? { ...t, isActive: !t.isActive, isModified: true } : t,
          ),
        }));
      },

      setExecutionOrder: (tabId, order) => {
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId ? { ...t, executionOrder: order, isModified: true } : t,
          ),
        }));
      },

      // ── Selectors ─────────────────────────────────────────────────────────

      getActiveTab: () => {
        const { tabs, activeTabId } = get();
        return tabs.find((t) => t.id === activeTabId);
      },

      getTab: (tabId) => get().tabs.find((t) => t.id === tabId),
    }),
    {
      name: 'workflow-manager-storage',
      storage: createJSONStorage(() => localStorage),
      // Persist everything — tabs hold snapshot of canvas data
      partialize: (s) => ({
        tabs: s.tabs,
        activeTabId: s.activeTabId,
        savedWorkflows: s.savedWorkflows,
      }),
    },
  ),
);

// ---------------------------------------------------------------------------
// Convenience selectors
// ---------------------------------------------------------------------------

export const selectActiveTab = (s: WorkflowManagerState & WorkflowManagerActions) =>
  s.tabs.find((t) => t.id === s.activeTabId);

export const selectSavedWorkflows = (s: WorkflowManagerState & WorkflowManagerActions) =>
  s.savedWorkflows;
