import { defineNuxtRouteMiddleware, navigateTo } from '#app';
import { useAuth } from '../composables/useAuth';

export default defineNuxtRouteMiddleware(async (to) => {
  const { isAuthenticated, initAuth } = useAuth();

  // Run initAuth on both SSR (reads cookies) and Client (reads cookies + localStorage fallback)
  await initAuth();

  const publicRoutes = ['/', '/login', '/signup', '/about', '/contact', '/weather', '/privacy', '/terms'];
  const isPublicRoute = publicRoutes.includes(to.path) || Boolean(to.meta?.public);

  // If user is NOT authenticated and trying to access protected route, redirect to /login
  if (!isAuthenticated.value && !isPublicRoute) {
    return navigateTo('/login');
  }

  // Route protection for Supervisors, Subcontractors vs Back-Office roles
  if (isAuthenticated.value) {
    const { isSupervisor, isSubcontractor } = useAuth();

    if (isSubcontractor.value) {
      // Allowed routes for subcontractors (mobile-first sandboxed wallet + 1-on-1 chat)
      const isAllowedSubconRoute = to.path.startsWith('/subcontractor') || 
        to.path.startsWith('/chat') ||
        ['/weather', '/about', '/contact', '/privacy', '/terms'].includes(to.path);

      if (to.path === '/login' || to.path === '/signup' || to.path === '/dashboard' || !isAllowedSubconRoute) {
        return navigateTo('/subcontractor/wallet');
      }
    } else if (isSupervisor.value) {
      // Allowed routes for site supervisors (field wallet + 1-on-1 chat)
      const isAllowedSupervisorRoute = to.path.startsWith('/field') || 
        to.path.startsWith('/chat') ||
        ['/weather', '/ai-chat', '/about', '/contact', '/privacy', '/terms'].includes(to.path);

      if (to.path === '/login' || to.path === '/signup' || to.path === '/dashboard' || !isAllowedSupervisorRoute) {
        return navigateTo('/field/wallet');
      }
    } else {
      // Standard Back-Office users
      if (to.path === '/login' || to.path === '/signup') {
        return navigateTo('/dashboard');
      }
    }
  }
});
