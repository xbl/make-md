export function createAutosaveQueue(writeFn: (content: string) => Promise<void>) {
  let pending: string | null = null;

  return {
    schedule(content: string) {
      pending = content;
    },
    async flush() {
      if (pending !== null) {
        const content = pending;
        pending = null;
        await writeFn(content);
      }
    },
  };
}
