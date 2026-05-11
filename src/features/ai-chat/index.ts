/**
 * Public API for the unified AI chat feature.
 */

// Mountable components
export { GlobalAiPanel } from './components/GlobalAiPanel';
export { GlobalAiFab } from './components/GlobalAiFab';
export { GlobalAiBackdrop } from './components/GlobalAiBackdrop';
export { CommandPalette, useCommandPalette } from './components/CommandPalette';
export { SelectionPill } from './components/SelectionPill';
export { ArtifactRail } from './components/ArtifactRail';
export { AskAi, type AskAiTarget } from './components/AskAiButton';
export { PinButton } from './components/PinButton';

// Page components (used by /ai-chat and /boss routes)
export { ConversationHistorySidebar } from './components/ConversationHistorySidebar';
export { MessageList } from './components/MessageList';
export { Composer } from './components/Composer';
export { EmptyState } from './components/EmptyState';
export { EmptyStateLanding } from './components/EmptyStateLanding';
export { SkillChip } from './components/SkillChip';
export { PageContextChip } from './components/PageContextChip';
export { ContextRing } from './components/ContextRing';

// Hooks
export { usePageContext } from './hooks/usePageContext';

// Stores (for advanced consumers)
export { usePanelStore } from './state/panelStore';
export { useAiChatStore } from './state/aiChatStore';
export { usePageContextStore } from './state/pageContextStore';
export { useArtifactStore } from './state/artifactStore';

// Types
export type { ChatMode, SkillId, PageContext } from './types';

// Skills + modes
export { SKILLS, getSkill } from './skills/registry';
export { MODE_LIST, MODE_REGISTRY, getMode } from './transports/modeRegistry';
