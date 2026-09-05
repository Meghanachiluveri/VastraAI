import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useMerchantAuthStore } from '../../stores/merchantAuthStore';

interface MerchantRouteProps {
  children: React.ReactNode;
}

/**
 * Route guard that ensures only authenticated merchants can view merchant portal pages.
 * Redirects unauthenticated visitors and regular customers to /merchant/login.
 */
export const MerchantRoute: React.FC<MerchantRouteProps> = ({ children }) => {
  const { isMerchantLoggedIn } = useMerchantAuthStore();
  const location = useLocation();

  if (!isMerchantLoggedIn) {
    return <Navigate to="/merchant/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default MerchantRoute;
