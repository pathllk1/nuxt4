import { defineNuxtRouteMiddleware, navigateTo } from '#app';
import { useAuth } from '../composables/useAuth';

export default defineNuxtRouteMiddleware((to) => {
  const { isAuthenticated, initAuth } = useAuth();

  // Run initAuth on both SSR (reads cookies) and Client (reads cookies + localStorage fallback)
  initAuth();

  const isPublicRoute = to.path === '/login' || to.path === '/signup';

  // If user is NOT authenticated and trying to access protected route, redirect to /login
  if (!isAuthenticated.value && !isPublicRoute) {
    return navigateTo('/login');
  }

  // If user IS authenticated and trying to access /login or /signup, redirect to /dashboard
  if (isAuthenticated.value && isPublicRoute) {
    return navigateTo('/dashboard');
  }
});
