import { ref } from 'vue';

const isSidebarCollapsed = ref(true);

export const useAppLayout = () => {
  const toggleSidebar = () => {
    isSidebarCollapsed.value = !isSidebarCollapsed.value;
  };

  const setSidebarCollapsed = (value: boolean) => {
    isSidebarCollapsed.value = value;
  };

  return {
    isSidebarCollapsed,
    toggleSidebar,
    setSidebarCollapsed
  };
};
