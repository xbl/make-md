export function createAutosaveQueue(
  writeFn: (content: string) => Promise<void>,
  debounceMs = 1000,
) {
  let pending: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    schedule(content: string) {
      pending = content;
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = null;
        void this.flush();
      }, debounceMs);
    },
    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (pending !== null) {
        const content = pending;
        pending = null;
        await writeFn(content);
      }
    },
  };
}
