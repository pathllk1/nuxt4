import { ref } from 'vue';

const isLauncherOpen = ref(false);
const activeToolId = ref<string | null>(null);

export const useGlobalTools = () => {
  const openLauncher = () => {
    isLauncherOpen.value = true;
  };

  const closeLauncher = () => {
    isLauncherOpen.value = false;
  };

  const toggleLauncher = () => {
    isLauncherOpen.value = !isLauncherOpen.value;
  };

  const openTool = (id: string) => {
    activeToolId.value = id;
    isLauncherOpen.value = false;
  };

  const closeTool = () => {
    activeToolId.value = null;
  };

  return {
    isLauncherOpen,
    activeToolId,
    openLauncher,
    closeLauncher,
    toggleLauncher,
    openTool,
    closeTool,
  };
};
