import { defineNuxtRouteMiddleware, navigateTo } from '#app';
import { useAuth } from '../composables/useAuth';

export default defineNuxtRouteMiddleware((to) => {
  const { isAuthenticated, initAuth } = useAuth();
  initAuth();

  const publicRoutes = ['/', '/login', '/signup', '/about', '/contact', '/weather', '/privacy', '/terms'];
  const isPublicRoute = publicRoutes.includes(to.path) || Boolean(to.meta?.public);

  if (!isAuthenticated.value && !isPublicRoute) {
    return navigateTo('/login');
  }

  if (isAuthenticated.value && (to.path === '/login' || to.path === '/signup')) {
    return navigateTo('/dashboard');
  }
});
