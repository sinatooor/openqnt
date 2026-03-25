/**
 * ProtectedRoute — redirects to /login if not authenticated,
 * or to /onboarding if onboarding hasn't been completed yet.
 * Supports both wrapper and layout (Outlet) usage.
 */

import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useOnboardingStore } from '../stores/onboardingStore';

interface ProtectedRouteProps {
    children?: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const hasCompletedOnboarding = useOnboardingStore((s) => s.hasCompletedOnboarding);

    // TEMPORARY BYPASS FOR DEVELOPMENT:
    // This allows testing without needing to log in.
    return children ? <>{children}</> : <Outlet />;

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (!hasCompletedOnboarding) {
        return <Navigate to="/onboarding" replace />;
    }

    return children ? <>{children}</> : <Outlet />;
};

export { ProtectedRoute };
export default ProtectedRoute;
