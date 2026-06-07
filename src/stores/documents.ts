import { defineStore } from "pinia";
import { createDocumentSession } from "@/lib/document-session";
import { readMarkdownFile, saveRecentFile, writeMarkdownFile } from "@/lib/file-service";
import { createAutosaveQueue } from "@/lib/autosave";
import { saveRecoverySnapshot, clearRecoverySnapshot, loadRecoverySnapshot } from "@/lib/recovery";

type Session = ReturnType<typeof createDocumentSession>;

export const useDocumentsStore = defineStore("documents", {
  state: () => ({
    sessions: [] as Session[],
    activeSessionId: "",
    recentFiles: [] as string[],
    autosaveQueue: createAutosaveQueue(async (content: string) => {
      const session = this.activeSession;
      if (!session || !session.path) return;
      await writeMarkdownFile(session.path, content);
      session.markSaved(content);
    }),
  }),
  getters: {
    activeSession(state): Session | undefined {
      return state.sessions.find((session) => session.id === state.activeSessionId);
    },
  },
  actions: {
    openSession(session: Session) {
      this.sessions = [...this.sessions.filter((item) => item.id !== session.id), session];
      this.activeSessionId = session.id;
    },
    async openFile(path: string) {
      const restored = await loadRecoverySnapshot(path);
      const { content } = restored
        ? { content: restored }
        : await readMarkdownFile(path);
      const session = createDocumentSession({
        id: path,
        path,
        content,
      });
      this.openSession(session);
      this.recentFiles = await saveRecentFile(path);
      if (restored) {
        session.markDirty();
      }
      return session;
    },
    async saveActiveFile() {
      const session = this.activeSession;
      if (!session || !session.path) {
        return null;
      }

      await writeMarkdownFile(session.path, session.content);
      session.markSaved(session.content);
      this.recentFiles = await saveRecentFile(session.path);
      await clearRecoverySnapshot(session.path);
      return session.path;
    },
    scheduleAutosave(content: string) {
      this.autosaveQueue.schedule(content);
      const session = this.activeSession;
      if (session) {
        saveRecoverySnapshot(session.id, content);
      }
    },
    async flushAutosave() {
      await this.autosaveQueue.flush();
    },
    setRecentFiles(paths: string[]) {
      this.recentFiles = paths;
    },
    setActiveSession(id: string) {
      this.activeSessionId = id;
    },
    async saveRecoveryForSession(id: string, content: string) {
      await saveRecoverySnapshot(id, content);
    },
  },
});
