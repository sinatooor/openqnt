/**
 * cardRegistry — data-driven mapping from cardType → component.
 *
 * MessageList renders cards by looking up cardType here. Adding a new card =
 * drop a file in cards/ + add one entry below.
 */

import type { FC } from 'react';
import { ToolCallCard } from './ToolCallCard';
import { StrategyNodesCard } from './StrategyNodesCard';
import { NavigationActionCard } from './NavigationActionCard';
import { CodeBlockCard } from './CodeBlockCard';
import { BossSubtreeCard } from './BossSubtreeCard';
import { PlotCard } from './PlotCard';
import { TableCard } from './TableCard';
import { BuilderStatusCard } from './BuilderStatusCard';

export const cardRegistry: Record<string, FC<{ payload: any }>> = {
  navigation_action: NavigationActionCard,
  code_block: CodeBlockCard,
  boss_subtree: BossSubtreeCard,
  plot: PlotCard,
  table: TableCard,
  // Live Builder-agent status panel (Phase 5). One card per assistant message,
  // updated in place as the TS sidecar emits validate / verify / submit events.
  builder_status: BuilderStatusCard,
  // strategy_nodes is rendered specially because it reads from message.strategyNodes
  // tool_call is rendered via the StoredToolCall list, not the cards list
};

export {
  ToolCallCard,
  StrategyNodesCard,
  NavigationActionCard,
  CodeBlockCard,
  BossSubtreeCard,
  PlotCard,
  TableCard,
  BuilderStatusCard,
};
