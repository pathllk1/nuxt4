<template>
  <div class="relative w-full">
    
    <!-- Full-screen background with animated gradient effect -->
    <div class="fixed inset-0 z-0 bg-white bg-fixed min-h-screen h-full overflow-hidden">
      <!-- Main animated gradient -->
      <div class="animated-gradient absolute inset-0"></div>

      <!-- Additional color blobs for more visible color variety -->
      <div class="color-blob color-blob-1"></div>
      <div class="color-blob color-blob-2"></div>
    </div>

    <!-- Content container -->
    <div class="relative z-10 w-full flex flex-col items-center min-h-[calc(100vh-140px)] py-8 px-4 overflow-hidden">
      
      <!-- Hero Section -->
      <div class="w-full max-w-7xl mx-auto mb-16 fade-in">
        <div class="bg-white/70 backdrop-blur-lg rounded-2xl shadow-xl p-8 md:p-12 border border-white/50 overflow-hidden relative">
          <!-- Decorative elements -->
          <div class="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-yellow-500/20 to-purple-500/20 rounded-full blur-2xl"></div>
          <div class="absolute -bottom-24 -left-24 w-48 h-48 bg-gradient-to-tr from-green-500/20 to-teal-500/20 rounded-full blur-2xl"></div>

          <div class="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div class="md:w-1/2 text-center md:text-left">
              <h1 class="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 text-slate-800 animate-fadeIn">
                <span class="bg-clip-text text-transparent bg-gradient-to-r from-green-500 via-yellow-500 to-purple-500">
                  Business Management Suite
                </span>
              </h1>
              <p class="text-lg md:text-xl text-slate-700 mb-8 animate-fadeIn animation-delay-200">
                A comprehensive solution for managing your business operations, finances, inventory, and workforce - all in one place.
              </p>
              <div class="flex flex-wrap gap-4 justify-center md:justify-start animate-fadeIn animation-delay-300">
                <ClientOnly>
                  <NuxtLink v-if="!isAuthenticated" to="/login" class="px-6 py-3 bg-gradient-to-r from-green-500 via-yellow-500 to-purple-500 text-white rounded-lg hover:shadow-lg transform hover:scale-105 transition-all duration-300 flex items-center font-medium no-underline">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    Get Started
                  </NuxtLink>
                  <NuxtLink v-else to="/dashboard" class="px-6 py-3 bg-gradient-to-r from-green-500 via-yellow-500 to-purple-500 text-white rounded-lg hover:shadow-lg transform hover:scale-105 transition-all duration-300 flex items-center font-medium no-underline">
                    <svg class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
                    </svg>
                    Go to Dashboard
                  </NuxtLink>
                </ClientOnly>
                <NuxtLink to="/about" class="px-6 py-3 bg-white text-purple-600 border border-green-200 rounded-lg hover:bg-yellow-50 hover:shadow-md transform hover:scale-105 transition-all duration-300 flex items-center font-medium no-underline">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Learn More
                </NuxtLink>
              </div>
            </div>
            <div class="md:w-1/2 flex justify-center md:justify-end">
              <img src="https://img.freepik.com/free-vector/business-team-discussing-ideas-startup_74855-4380.jpg" alt="Business Management" class="w-full max-w-md rounded-xl shadow-lg transform hover:scale-102 transition-all duration-500 hover:shadow-xl" />
            </div>
          </div>
        </div>
      </div>

      <!-- Features Section -->
      <div class="w-full max-w-7xl mx-auto mb-16">
        <h2 class="text-3xl md:text-4xl font-bold text-center mb-12 text-slate-800 relative">
          <span class="bg-clip-text text-transparent bg-gradient-to-r from-green-500 via-yellow-500 to-purple-500">
            Powerful Features
          </span>
          <div class="absolute w-24 h-1 bg-gradient-to-r from-green-400 via-yellow-400 to-purple-400 bottom-0 left-1/2 transform -translate-x-1/2 mt-2 rounded-full"></div>
        </h2>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          
          <!-- Financial Management Card -->
          <div class="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:scale-102 border border-gray-100 feature-card">
            <div class="h-48 overflow-hidden">
              <img src="https://img.freepik.com/free-vector/finance-financial-performance-concept-illustration_53876-40450.jpg" alt="Financial Management" class="w-full h-full object-cover transition-transform duration-500 hover:scale-110" />
            </div>
            <div class="p-6">
              <h3 class="text-xl font-bold mb-2 text-green-600">Financial Management</h3>
              <p class="text-gray-600 mb-4">Track expenses, manage cash flow, and generate financial reports with our comprehensive financial tools.</p>
              <NuxtLink to="/accounting/ledger" class="text-green-600 hover:text-green-800 font-medium flex items-center no-underline">
                Explore
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </NuxtLink>
            </div>
          </div>

          <!-- Employee Wages Card -->
          <div class="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:scale-102 border border-gray-100 feature-card">
            <div class="h-48 overflow-hidden">
              <img src="https://img.freepik.com/free-vector/tiny-hr-manager-looking-candidate-job-interview_74855-19908.jpg" alt="Employee Wages" class="w-full h-full object-cover transition-transform duration-500 hover:scale-110" />
            </div>
            <div class="p-6">
              <h3 class="text-xl font-bold mb-2 text-yellow-600">Employee Wages</h3>
              <p class="text-gray-600 mb-4">Manage employee payroll, track attendance, and generate wage reports with our intuitive wage management system.</p>
              <NuxtLink to="/wages" class="text-yellow-600 hover:text-yellow-800 font-medium flex items-center no-underline">
                Explore
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </NuxtLink>
            </div>
          </div>

          <!-- Inventory Management Card -->
          <div class="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:scale-102 border border-gray-100 feature-card">
            <div class="h-48 overflow-hidden">
              <img src="https://img.freepik.com/free-vector/warehouse-workers-checking-inventory-illustration_23-2148798392.jpg" alt="Inventory Management" class="w-full h-full object-cover transition-transform duration-500 hover:scale-110" />
            </div>
            <div class="p-6">
              <h3 class="text-xl font-bold mb-2 text-teal-600">Inventory Management</h3>
              <p class="text-gray-600 mb-4">Track stock levels, manage bills, and optimize your inventory with our powerful inventory management tools.</p>
              <NuxtLink to="/inventory" class="text-teal-600 hover:text-teal-800 font-medium flex items-center no-underline">
                Explore
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </NuxtLink>
            </div>
          </div>

          <!-- Document Management Card -->
          <div class="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:scale-102 border border-gray-100 feature-card">
            <div class="h-48 overflow-hidden">
              <img src="https://img.freepik.com/free-vector/documents-concept-illustration_114360-138.jpg" alt="Document Management" class="w-full h-full object-cover transition-transform duration-500 hover:scale-110" />
            </div>
            <div class="p-6">
              <h3 class="text-xl font-bold mb-2 text-orange-600">Document Management</h3>
              <p class="text-gray-600 mb-4">Store, organize, and access important documents securely with our document management system.</p>
              <NuxtLink to="/documents" class="text-orange-600 hover:text-orange-800 font-medium flex items-center no-underline">
                Explore
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </NuxtLink>
            </div>
          </div>

          <!-- Labor Operations Card -->
          <div class="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:scale-102 border border-gray-100 feature-card">
            <div class="h-48 overflow-hidden">
              <img src="https://img.freepik.com/free-vector/woman-checking-giant-check-list_23-2148099800.jpg" alt="Labor Operations" class="w-full h-full object-cover transition-transform duration-500 hover:scale-110" />
            </div>
            <div class="p-6">
              <h3 class="text-xl font-bold mb-2 text-purple-600">Labor Operations</h3>
              <p class="text-gray-600 mb-4">Keep track of workforce activities, shifts, master roll records, and labor assignments efficiently.</p>
              <NuxtLink to="/labor" class="text-purple-600 hover:text-purple-800 font-medium flex items-center no-underline">
                Explore
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </NuxtLink>
            </div>
          </div>

          <!-- Productivity Tools Card -->
          <div class="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:scale-102 border border-gray-100 feature-card">
            <div class="h-48 overflow-hidden">
              <img src="https://img.freepik.com/free-vector/web-development-programmer-engineering-coding-website-augmented-reality-interface-screens-developer-project-engineer-programming-software-application-design-cartoon-illustration_107791-3863.jpg" alt="Productivity Tools" class="w-full h-full object-cover transition-transform duration-500 hover:scale-110" />
            </div>
            <div class="p-6">
              <h3 class="text-xl font-bold mb-2 text-green-600">Productivity Tools</h3>
              <p class="text-gray-600 mb-4">Boost your productivity with our suite of tools including calculator, news reader, PDF tools, and more.</p>
              <button @click="openTools" class="text-green-600 hover:text-green-800 font-medium flex items-center bg-transparent border-0 cursor-pointer p-0 font-sans text-left">
                Explore
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

        </div>
      </div>

      <!-- Customer Testimonials Section -->
      <div class="w-full max-w-7xl mx-auto mb-16">
        <div class="bg-gradient-to-r from-green-400 via-yellow-300 to-purple-400 rounded-2xl shadow-xl p-8 md:p-12 text-white">
          <h2 class="text-3xl md:text-4xl font-bold mb-8 text-center">What Our Customers Say</h2>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Testimonial 1 -->
            <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 hover:bg-white/20 transition-all duration-300">
              <div class="flex justify-center mb-4">
                <div class="w-16 h-16 rounded-full overflow-hidden border-2 border-white">
                  <img src="https://randomuser.me/api/portraits/men/32.jpg" alt="Robert Johnson" class="w-full h-full object-cover" />
                </div>
              </div>
              <p class="text-white/90 text-center mb-4 italic">
                "This business suite has transformed how we manage our operations. The financial tools alone have saved us countless hours each month."
              </p>
              <p class="text-white font-bold text-center">Robert Johnson</p>
              <p class="text-white/80 text-center text-sm">CEO, Johnson Enterprises</p>
            </div>

            <!-- Testimonial 2 -->
            <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 hover:bg-white/20 transition-all duration-300">
              <div class="flex justify-center mb-4">
                <div class="w-16 h-16 rounded-full overflow-hidden border-2 border-white">
                  <img src="https://randomuser.me/api/portraits/women/44.jpg" alt="Sarah Williams" class="w-full h-full object-cover" />
                </div>
              </div>
              <p class="text-white/90 text-center mb-4 italic">
                "The inventory management system is intuitive and powerful. We've reduced our stockouts by 75% since implementing this solution."
              </p>
              <p class="text-white font-bold text-center">Sarah Williams</p>
              <p class="text-white/80 text-center text-sm">Operations Manager, Retail Solutions</p>
            </div>

            <!-- Testimonial 3 -->
            <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 hover:bg-white/20 transition-all duration-300">
              <div class="flex justify-center mb-4">
                <div class="w-16 h-16 rounded-full overflow-hidden border-2 border-white">
                  <img src="https://randomuser.me/api/portraits/men/67.jpg" alt="Michael Chen" class="w-full h-full object-cover" />
                </div>
              </div>
              <p class="text-white/90 text-center mb-4 italic">
                "Managing employee wages used to be a nightmare. Now it's a breeze with the automated payroll system and detailed reports."
              </p>
              <p class="text-white font-bold text-center">Michael Chen</p>
              <p class="text-white/80 text-center text-sm">HR Director, Tech Innovations</p>
            </div>
          </div>
        </div>
      </div>
      
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuth } from '../composables/useAuth';

definePageMeta({
  layout: 'default'
});

const { isAuthenticated } = useAuth();

const openTools = () => {
  alert('Global Tools are not implemented in the Nuxt app yet.');
};
</script>

<style>
/* Keyframes and global/page styles matching styles.css */
@keyframes gradientAnimation {
  0% { background-position: 0% 50%; }
  20% { background-position: 20% 0%; }
  40% { background-position: 100% 50%; }
  60% { background-position: 80% 100%; }
  80% { background-position: 0% 100%; }
  100% { background-position: 0% 50%; }
}

.animated-gradient {
  background: linear-gradient(
    -45deg,
    rgba(134, 239, 172, 0.6),
    rgba(45, 212, 191, 0.6),
    rgba(250, 204, 21, 0.6),
    rgba(134, 239, 172, 0.6)
  );
  background-size: 400% 400%;
  animation: gradientAnimation 20s ease-in-out infinite;
}

.color-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.5;
  mix-blend-mode: screen;
}

.color-blob-1 {
  background-color: rgba(134, 239, 172, 0.7);
  width: 40vw;
  height: 40vw;
  top: -10%;
  left: -10%;
  animation: blob-move-1 25s ease-in-out infinite alternate;
}

.color-blob-2 {
  background-color: rgba(45, 212, 191, 0.7);
  width: 35vw;
  height: 35vw;
  top: 60%;
  left: 60%;
  animation: blob-move-2 20s ease-in-out infinite alternate;
}

@keyframes blob-move-1 {
  0% { transform: translate(0, 0) scale(1); }
  100% { transform: translate(10%, 10%) scale(1.1); }
}

@keyframes blob-move-2 {
  0% { transform: translate(0, 0) scale(1); }
  100% { transform: translate(-15%, -10%) scale(1.15); }
}

.feature-card {
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.feature-card:hover {
  transform: translateY(-5px);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-in {
  animation: fadeIn 0.3s ease-in-out;
}

.animate-fadeIn {
  animation: fadeIn 0.5s ease-out forwards;
}

.animation-delay-200 {
  animation-delay: 0.2s;
}

.animation-delay-300 {
  animation-delay: 0.3s;
}
</style>
