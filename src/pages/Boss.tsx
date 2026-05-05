/**
 * Boss — legacy /boss route.
 *
 * The Boss tab was merged into the unified AI Chat surface. The route
 * stays alive for old bookmarks/deep-links and now just redirects to
 * /ai-chat with `mode=boss` so AiChat sets the right default mode.
 */

import { Navigate } from 'react-router-dom';

const Boss = () => <Navigate to="/ai-chat?mode=boss" replace />;

export default Boss;
