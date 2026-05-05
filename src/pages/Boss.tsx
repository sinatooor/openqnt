/**
 * Boss — legacy /boss route.
 *
 * Now renders the unified AiChat page with `defaultMode='boss'`. Existing
 * deep-links continue to work; the multi-agent dispatch flow runs through
 * the unified BossSubtreeCard rendered inside the conversation.
 */

import AiChat from './AiChat';

const Boss = () => <AiChat defaultMode="boss" defaultFilter="boss" />;

export default Boss;
