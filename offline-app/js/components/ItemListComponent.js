// components/ItemListComponent.js
(function (global) {
  'use strict';

  const ItemListComponent = {
    props: {
      items: { type: [Array, Object], default: () => [] },
      categories: { type: Array, default: () => [] },
      searchQuery: { type: String, default: '' },
      selectedCategory: { type: String, default: 'all' },
      selectedStatus: { type: String, default: 'all' },
      sortBy: { type: String, default: 'newest' },
      loading: { type: Boolean, default: false }
    },
    emits: [
      'update:searchQuery',
      'update:selectedCategory',
      'update:selectedStatus',
      'update:sortBy',
      'toggle-status',
      'edit-item',
      'delete-item'
    ],
    computed: {
      displayItems() {
        let raw = this.items;
        if (raw && raw.value !== undefined) raw = raw.value;
        if (!Array.isArray(raw)) return [];
        return raw.filter((item) => item && typeof item === 'object');
      }
    },
    methods: {
      formatDate(dateStr) {
        return global.Formatters ? global.Formatters.formatDate(dateStr) : (dateStr || '-');
      },
      formatCurrency(val) {
        return global.Formatters ? global.Formatters.formatCurrency(val) : '$' + (Number(val) || 0).toFixed(2);
      },
      getCategoryBadge(category) {
        const cat = (category || '').toLowerCase();
        if (cat.includes('eng')) return 'bg-blue-100 text-blue-800 border-blue-200';
        if (cat.includes('ui') || cat.includes('design')) return 'bg-purple-100 text-purple-800 border-purple-200';
        if (cat.includes('oper')) return 'bg-amber-100 text-amber-800 border-amber-200';
        if (cat.includes('fin')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        return 'bg-pink-100 text-pink-800 border-pink-200';
      },
      getPriorityBadge(priority) {
        if (priority === 'high') return 'bg-rose-100 text-rose-700 border-rose-200 font-bold';
        if (priority === 'medium') return 'bg-amber-100 text-amber-800 border-amber-200';
        return 'bg-sky-100 text-sky-800 border-sky-200';
      }
    },
    template: `
      <div class="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden w-full">
        <!-- Compact Filters Header (Light Theme) -->
        <div class="p-2 sm:p-2.5 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-2 w-full">
          <!-- Search Input -->
          <div class="relative flex-1 max-w-sm">
            <svg class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              :value="searchQuery"
              @input="$emit('update:searchQuery', $event.target.value)"
              placeholder="Search records, categories, notes..."
              class="w-full bg-white border border-slate-300 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-2xs"
            />
          </div>

          <!-- Filters Row -->
          <div class="flex flex-wrap items-center gap-1.5">
            <!-- Category Filter -->
            <select
              :value="selectedCategory"
              @change="$emit('update:selectedCategory', $event.target.value)"
              class="bg-white border border-slate-300 rounded-md px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs cursor-pointer"
            >
              <option value="all">All Categories</option>
              <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
            </select>

            <!-- Status Filter -->
            <select
              :value="selectedStatus"
              @change="$emit('update:selectedStatus', $event.target.value)"
              class="bg-white border border-slate-300 rounded-md px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="completed">Completed Only</option>
            </select>

            <!-- Sort By -->
            <select
              :value="sortBy"
              @change="$emit('update:sortBy', $event.target.value)"
              class="bg-white border border-slate-300 rounded-md px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs cursor-pointer"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
              <option value="value-high">Sort: Value High-to-Low</option>
              <option value="value-low">Sort: Value Low-to-High</option>
            </select>
          </div>
        </div>

        <!-- Full-Width Compact Table View -->
        <div class="overflow-x-auto w-full">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-slate-200 bg-slate-100/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th class="py-2 px-3 w-10 text-center">Done</th>
                <th class="py-2 px-3 min-w-[220px]">Title & Details</th>
                <th class="py-2 px-3 whitespace-nowrap">Category</th>
                <th class="py-2 px-3 whitespace-nowrap">Priority</th>
                <th class="py-2 px-3 whitespace-nowrap">Value</th>
                <th class="py-2 px-3 whitespace-nowrap">Created</th>
                <th class="py-2 px-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-xs">
              <tr
                v-for="item in displayItems"
                :key="item.id"
                class="hover:bg-blue-50/40 transition-colors group"
              >
                <!-- Status Checkbox -->
                <td class="py-2 px-3 whitespace-nowrap text-center">
                  <button
                    type="button"
                    @click="$emit('toggle-status', item)"
                    title="Toggle Completion"
                    :class="item.status === 'completed' ? 'bg-emerald-600 border-emerald-600 text-white' : 'border border-slate-300 hover:border-blue-500 text-transparent'"
                    class="w-4.5 h-4.5 rounded flex items-center justify-center transition-all cursor-pointer mx-auto"
                  >
                    <svg class="w-3 h-3 fill-current stroke-current" viewBox="0 0 20 20">
                      <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                    </svg>
                  </button>
                </td>

                <!-- Title and Notes -->
                <td class="py-2 px-3">
                  <div class="flex items-center space-x-1.5">
                    <span
                      :class="item.status === 'completed' ? 'line-through text-slate-400 font-normal' : 'text-slate-900 font-semibold'"
                    >
                      {{ item.title }}
                    </span>
                    <span class="text-[10px] text-slate-400 font-mono">#{{ item.id }}</span>
                  </div>
                  <p v-if="item.notes" class="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                    {{ item.notes }}
                  </p>
                </td>

                <!-- Category Badge -->
                <td class="py-2 px-3 whitespace-nowrap">
                  <span
                    :class="getCategoryBadge(item.category)"
                    class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border"
                  >
                    {{ item.category }}
                  </span>
                </td>

                <!-- Priority Badge -->
                <td class="py-2 px-3 whitespace-nowrap">
                  <span
                    :class="getPriorityBadge(item.priority)"
                    class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase font-bold border"
                  >
                    {{ item.priority }}
                  </span>
                </td>

                <!-- Value -->
                <td class="py-2 px-3 whitespace-nowrap font-bold text-emerald-700">
                  {{ formatCurrency(item.value) }}
                </td>

                <!-- Created Date -->
                <td class="py-2 px-3 whitespace-nowrap text-[11px] text-slate-500">
                  {{ formatDate(item.created_at) }}
                </td>

                <!-- Actions -->
                <td class="py-2 px-3 whitespace-nowrap text-right">
                  <div class="flex items-center justify-end space-x-1">
                    <button
                      type="button"
                      @click="$emit('edit-item', item)"
                      title="Edit Record"
                      class="p-1 rounded text-blue-600 hover:bg-blue-100/70 transition-colors cursor-pointer"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      @click="$emit('delete-item', item)"
                      title="Delete Record"
                      class="p-1 rounded text-rose-600 hover:bg-rose-100/70 transition-colors cursor-pointer"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>

              <!-- Empty State -->
              <tr v-if="!loading && displayItems.length === 0">
                <td colspan="7" class="py-8 text-center bg-white">
                  <div class="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100 text-slate-400 mb-2">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p class="text-xs font-semibold text-slate-700">No records found</p>
                  <p class="text-[11px] text-slate-400 mt-0.5">Try adjusting your filters or click Add Record above.</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `
  };

  global.ItemListComponent = ItemListComponent;
})(window);
