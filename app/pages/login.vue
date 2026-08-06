<template>
  <div class="fixed inset-0 flex items-center justify-center overflow-hidden bg-[url('https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?ixlib=rb-1.2.1&auto=format&fit=crop&w=1920&q=80')] bg-cover bg-center z-50">

    <!-- Sidebar -->
    <ClientOnly>
      <AppSidebar />
    </ClientOnly>

    <!-- Login Card with width 800px on medium and up -->
    <div class="relative z-50 w-full md:w-[800px] px-4 animate-fadeIn">
      <div class="bg-white/15 backdrop-blur-xl rounded-2xl p-9 shadow-2xl border-2 border-white/30">
        
        <!-- Card Header -->
        <div class="mb-9 text-center">
          <h1 class="text-4xl font-bold text-white mb-2">Welcome Back</h1>
          <p class="text-white/90 text-lg">Sign in to continue your journey</p>
        </div>

        <!-- Login Form -->
        <form class="space-y-5" @submit.prevent="onSubmit">
          
          <!-- Email Field -->
          <div>
            <label class="block text-base font-medium text-white/90 mb-2">Email address</label>
            <UInput
              v-model="email"
              type="email"
              required
              icon="i-lucide-mail"
              placeholder="Enter your email address"
              size="lg"
              class="w-full nuxt-ui-glass-input"
            />
          </div>

          <!-- Password Field -->
          <div>
            <label class="block text-base font-medium text-white/90 mb-2">Password</label>
            <UInput
              v-model="password"
              type="password"
              required
              icon="i-lucide-lock"
              placeholder="Enter your password"
              size="lg"
              class="w-full nuxt-ui-glass-input"
            />
          </div>

          <!-- Error Message -->
          <div v-if="error" class="bg-red-500/30 backdrop-blur-md text-white p-3.5 rounded-xl border border-red-500/50 text-sm font-medium text-center">
            {{ error }}
          </div>

          <!-- Submit Button -->
          <UButton
            type="submit"
            size="xl"
            block
            :loading="loading"
            class="w-full bg-white/20 hover:bg-white/30 text-white font-semibold rounded-xl border border-white/20 backdrop-blur-md transition-all duration-300 flex justify-center items-center shadow-lg"
          >
            Sign In
          </UButton>

          <!-- Register & Home Links -->
          <div class="mt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm font-medium">
            <NuxtLink to="/signup" class="text-white hover:text-blue-200 transition-colors duration-300 no-underline">
              Don't have an account? Register here
            </NuxtLink>
            <NuxtLink to="/" class="text-white/80 hover:text-white transition-colors duration-300 flex items-center gap-1 no-underline">
              <span>← Back to Home</span>
            </NuxtLink>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuth } from '../composables/useAuth';
import { useRouter } from '#app';
import AppSidebar from '../components/AppSidebar.vue';

definePageMeta({
  layout: 'default'
});

const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref<string | null>(null);

const { login, isAuthenticated, initAuth } = useAuth();
const router = useRouter();

onMounted(() => {
  initAuth();
  if (isAuthenticated.value) {
    router.replace('/dashboard');
  }
});

const onSubmit = async (e?: Event) => {
  if (e) e.preventDefault();
  if (loading.value) return;

  loading.value = true;
  error.value = null;

  try {
    const res = await login({ email: email.value, password: password.value });
    if (res && res.accessToken) {
      await router.push('/dashboard');
    }
  } catch (err: any) {
    console.error('Login error:', err);
    const msg = err.data?.statusMessage || err.data?.message || err.statusMessage || err.message || 'Login failed. Please check your credentials.';
    error.value = msg;
  } finally {
    loading.value = false;
  }
};
</script>

<style>
.nuxt-ui-glass-input input {
  background-color: rgba(255, 255, 255, 0.25) !important;
  color: white !important;
  border-color: rgba(255, 255, 255, 0.4) !important;
  border-width: 2px !important;
  border-radius: 0.75rem !important;
  backdrop-filter: blur(6px) !important;
}

.nuxt-ui-glass-input input::placeholder {
  color: rgba(255, 255, 255, 0.6) !important;
}

.nuxt-ui-glass-input input:focus {
  --tw-ring-color: rgba(255, 255, 255, 0.6) !important;
  border-color: rgba(255, 255, 255, 0.6) !important;
}

.nuxt-ui-glass-input svg {
  color: rgba(255, 255, 255, 0.7) !important;
}
</style>
