// components/ItemFormComponent.js
(function (global) {
  'use strict';

  const ItemFormComponent = {
    props: {
      show: { type: Boolean, default: false },
      itemToEdit: { type: Object, default: null },
      categories: { type: Array, default: () => [] }
    },
    emits: ['close', 'save'],
    data() {
      return {
        form: {
          title: '',
          category: 'Engineering',
          priority: 'medium',
          status: 'active',
          value: 0,
          notes: ''
        },
        errors: {}
      };
    },
    watch: {
      itemToEdit: {
        immediate: true,
        handler(newVal) {
          if (newVal) {
            this.form = {
              title: newVal.title || '',
              category: newVal.category || 'Engineering',
              priority: newVal.priority || 'medium',
              status: newVal.status || 'active',
              value: newVal.value || 0,
              notes: newVal.notes || ''
            };
          } else {
            this.resetForm();
          }
          this.errors = {};
        }
      }
    },
    methods: {
      resetForm() {
        this.form = {
          title: '',
          category: this.categories[0] || 'Engineering',
          priority: 'medium',
          status: 'active',
          value: 0,
          notes: ''
        };
        this.errors = {};
      },
      handleSubmit() {
        const val = global.Validators.validateItem(this.form);
        if (!val.isValid) {
          this.errors = val.errors;
          return;
        }
        this.$emit('save', { ...this.form });
      }
    },
    template: `
      <div v-if="show" class="fixed inset-0 z-[60] overflow-y-auto flex items-center justify-center p-3 bg-slate-900/40 backdrop-blur-xs" style="z-index: 60;" @click.self="$emit('close')" @keydown.esc="$emit('close')">
        <div class="relative bg-white border border-slate-200 rounded-xl w-full max-w-md p-4 sm:p-5 shadow-xl text-slate-800">
          <!-- Modal Header -->
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <div class="flex items-center space-x-2">
              <span class="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              <h3 class="text-sm sm:text-base font-bold text-slate-900">
                {{ itemToEdit ? 'Edit WebSQL Record' : 'Create New Record' }}
              </h3>
            </div>
            <button
              type="button"
              @click="$emit('close')"
              class="text-slate-400 hover:text-slate-700 rounded-md p-1 transition-colors cursor-pointer"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Form Body -->
          <form @submit.prevent="handleSubmit" class="mt-3 space-y-3">
            <!-- Title -->
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Record Title *</label>
              <input
                type="text"
                v-model="form.title"
                placeholder="e.g. Database schema update"
                class="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
              <p v-if="errors.title" class="text-[11px] text-rose-600 mt-0.5 font-medium">{{ errors.title }}</p>
            </div>

            <!-- Category & Priority Row -->
            <div class="grid grid-cols-2 gap-2.5">
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
                <select
                  v-model="form.category"
                  class="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                <select
                  v-model="form.priority"
                  class="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <!-- Status & Value Row -->
            <div class="grid grid-cols-2 gap-2.5">
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                <select
                  v-model="form.status"
                  class="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="active">Active (Pending)</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Valuation / Cost (₹)</label>
                <input
                  type="number"
                  step="any"
                  v-model="form.value"
                  placeholder="0.00"
                  class="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <!-- Notes -->
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Notes / SQL Metadata</label>
              <textarea
                v-model="form.notes"
                rows="2"
                placeholder="Optional notes or details saved locally into WebSQL"
                class="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              ></textarea>
            </div>

            <!-- Modal Actions -->
            <div class="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                @click="$emit('close')"
                class="px-3 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="px-3.5 py-1.5 rounded-md text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
              >
                {{ itemToEdit ? 'Save Changes' : 'Insert into WebSQL' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    `
  };

  global.ItemFormComponent = ItemFormComponent;
})(window);
