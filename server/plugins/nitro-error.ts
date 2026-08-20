export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', async (error, { event }) => {
    console.error('==================== [NITRO ERROR] ====================');
    console.error(`Method: ${event?.method} | Path: ${event?.path}`);
    console.error(`Message: ${error?.message || error}`);
    if (error?.stack) {
      console.error(`Stack: ${error.stack}`);
    }
    console.error('========================================================');
  });
});
