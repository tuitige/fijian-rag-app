import { useAuth as useOidcAuth } from 'react-oidc-context';

// Adapter to make react-oidc-context compatible with existing components
export const useAuth = () => {
  const auth = useOidcAuth();
  
  // Adapt the react-oidc-context interface to match the expected interface
  return {
    user: auth.user ? {
      id: auth.user.profile.sub || '',
      email: auth.user.profile.email || '',
      username: auth.user.profile.preferred_username || auth.user.profile.email || '',
      createdAt: new Date(),
      preferences: {
        learningGoal: 'casual' as const,
        dailyGoalMinutes: 15,
        notificationsEnabled: true,
      }
    } : null,
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    error: auth.error?.message || null,
    // Add any other methods that components might need
    login: async () => { await auth.signinRedirect(); },
    logout: () => { auth.removeUser(); },
    clearError: () => {}, // react-oidc-context handles errors differently
  };
};