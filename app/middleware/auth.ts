import { defineNuxtRouteMiddleware, navigateTo } from '#app';
import { useAuth } from '../composables/useAuth';

export default defineNuxtRouteMiddleware((to) => {
  const { isAuthenticated, initAuth } = useAuth();
  initAuth();

  if (!isAuthenticated.value && to.path !== '/login' && to.path !== '/signup') {
    return navigateTo('/login');
  }

  if (isAuthenticated.value && (to.path === '/login' || to.path === '/signup')) {
    return navigateTo('/dashboard');
  }
});
