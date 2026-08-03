<template>
  <div class="fixed inset-0 flex items-center justify-center overflow-hidden bg-[url('https://images.unsplash.com/photo-1501854140801-50d01698950b?ixlib=rb-1.2.1&auto=format&fit=crop&w=1920&q=80')] bg-cover bg-center z-50">
    
    <!-- Signup Card with width 800px on medium and up -->
    <div class="relative z-10 w-full md:w-[800px] px-4 animate-fadeIn">
      <div class="bg-white/15 backdrop-blur-xl rounded-2xl p-9 shadow-2xl border-2 border-white/30">
        
        <!-- Card Header -->
        <div class="mb-9 text-center">
          <h1 class="text-4xl font-bold text-white mb-2">Create Account</h1>
          <p class="text-white/90 text-lg">Join us to start your journey</p>
        </div>

        <!-- Signup Form with 2-column grid on desktop using Nuxt UI Form -->
        <form @submit.prevent="onSubmit" class="grid grid-cols-2 gap-x-4 gap-y-4">
          
          <!-- Full Name -->
          <div>
            <label class="block text-base font-medium text-white/90 mb-2">Full Name</label>
            <UInput
              v-model="name"
              type="text"
              required
              icon="i-lucide-user"
              placeholder="Enter your full name"
              size="lg"
              class="w-full nuxt-ui-glass-input"
            />
          </div>

          <!-- Email -->
          <div>
            <label class="block text-base font-medium text-white/90 mb-2">Email Address</label>
            <UInput
              v-model="email"
              type="email"
              required
              icon="i-lucide-mail"
              placeholder="Enter your email"
              size="lg"
              class="w-full nuxt-ui-glass-input"
            />
          </div>

          <!-- Password -->
          <div>
            <label class="block text-base font-medium text-white/90 mb-2">Password</label>
            <UInput
              v-model="password"
              type="password"
              required
              icon="i-lucide-lock"
              placeholder="Choose your password"
              size="lg"
              class="w-full nuxt-ui-glass-input"
            />
          </div>

          <!-- Select Firm -->
          <div>
            <label class="block text-base font-medium text-white/90 mb-2">Select Firm</label>
            <USelect
              v-model="firmId"
              required
              :items="firmItems"
              placeholder="Select a firm"
              size="lg"
              class="w-full nuxt-ui-glass-select"
            />
          </div>

          <!-- Messages & Submit Button (spanning 2 cols) -->
          <div class="col-span-2 space-y-4 pt-2">
            <div v-if="error" class="bg-red-500/30 backdrop-blur-md text-white p-3 rounded-xl border border-red-500/50 text-sm text-center">
              {{ error }}
            </div>

            <div v-if="success" class="bg-emerald-500/30 backdrop-blur-md text-white p-3 rounded-xl border border-emerald-500/50 text-sm text-center font-medium">
              Registration successful! Redirecting to login...
            </div>

            <!-- Nuxt UI Button -->
            <UButton
              type="submit"
              size="xl"
              block
              :loading="loading"
              class="w-full bg-white/20 hover:bg-white/30 text-white font-semibold rounded-xl border border-white/20 backdrop-blur-md transition-all duration-300 flex justify-center items-center shadow-lg"
            >
              Create Account
            </UButton>

            <div class="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm font-medium">
              <NuxtLink to="/login" class="text-white hover:text-blue-200 transition-colors duration-300 no-underline">
                Already have an account? Login here
              </NuxtLink>
              <NuxtLink to="/" class="text-white/80 hover:text-white transition-colors duration-300 flex items-center gap-1 no-underline">
                <span>← Back to Home</span>
              </NuxtLink>
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useAuth } from '../composables/useAuth';
import { useRouter } from '#app';

definePageMeta({
  layout: 'default'
});

const name = ref('');
const email = ref('');
const password = ref('');
const firmId = ref('');
const firms = ref<any[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const success = ref(false);

const { signup, isAuthenticated, initAuth } = useAuth();
const router = useRouter();

const firmItems = computed(() => {
  return firms.value.map(firm => ({
    label: `${firm.name} (${firm.code})`,
    value: firm._id
  }));
});

onMounted(async () => {
  initAuth();
  if (isAuthenticated.value) {
    router.replace('/dashboard');
    return;
  }
  try {
    const res = await $fetch<{ data: any[] }>('/api/firms');
    firms.value = res.data || [];
  } catch (err) {
    console.error('Failed to load firms:', err);
    error.value = 'Failed to load firms. Please refresh the page.';
  }
});

const onSubmit = async () => {
  loading.value = true;
  error.value = null;
  success.value = false;

  try {
    await signup({
      name: name.value,
      email: email.value,
      password: password.value,
      firmId: firmId.value
    });
    success.value = true;
    setTimeout(() => {
      router.push('/login');
    }, 2500);
  } catch (err: any) {
    console.error('Signup error:', err);
    error.value = err.data?.message || 'Signup failed. Please try again.';
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

.nuxt-ui-glass-select select, .nuxt-ui-glass-select button {
  background-color: rgba(255, 255, 255, 0.25) !important;
  color: white !important;
  border-color: rgba(255, 255, 255, 0.4) !important;
  border-width: 2px !important;
  border-radius: 0.75rem !important;
  backdrop-filter: blur(6px) !important;
}

.nuxt-ui-glass-select option {
  color: #1e293b !important;
}
</style>
