import { defineStore } from "pinia";
import { createDocumentSession } from "@/lib/document-session";
import {
  loadRecentFiles,
  pickMarkdownFile,
  pickSaveHtmlFile,
  pickSaveMarkdownFile,
  readMarkdownFile,
  saveRecentFile,
  writeMarkdownFile,
  writeTextFile,
} from "@/lib/file-service";
import { createAutosaveQueue } from "@/lib/autosave";
import { saveRecoverySnapshot, clearRecoverySnapshot, loadRecoverySnapshot } from "@/lib/recovery";
import { promptUnsavedChanges } from "@/lib/unsaved-prompt";
import { markdownToHtml } from "@/lib/export-html";
import { exportMarkdownToPdf } from "@/lib/export-pdf";

type Session = ReturnType<typeof createDocumentSession>;

let autosaveQueue: ReturnType<typeof createAutosaveQueue> | null = null;

function sessionLabel(session: Session) {
  if (!session.path) {
    return "Untitled.md";
  }
  return session.path.split("/").pop() ?? session.path;
}

export const useDocumentsStore = defineStore("documents", {
  state: () => ({
    sessions: [] as Session[],
    activeSessionId: "",
    recentFiles: [] as string[],
  }),
  getters: {
    activeSession(state): Session | undefined {
      return state.sessions.find((session) => session.id === state.activeSessionId);
    },
  },
  actions: {
    getAutosaveQueue() {
      if (!autosaveQueue) {
        autosaveQueue = createAutosaveQueue(async (content: string) => {
          const session = this.activeSession;
          if (!session?.path) {
            return;
          }
          await writeMarkdownFile(session.path, content);
          session.markSaved(content);
          await clearRecoverySnapshot(session.id);
        });
      }
      return autosaveQueue;
    },
    openSession(session: Session) {
      this.sessions = [...this.sessions.filter((item) => item.id !== session.id), session];
      this.activeSessionId = session.id;
    },
    createNewDocument() {
      const id = `untitled-${Date.now()}`;
      const session = createDocumentSession({
        id,
        path: "",
        content: "",
      });
      this.openSession(session);
      return session;
    },
    async loadRecent() {
      this.recentFiles = await loadRecentFiles();
    },
    async openFile(path: string) {
      const restored = await loadRecoverySnapshot(path);
      const { content } = restored ? { content: restored } : await readMarkdownFile(path);
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
    async openFileDialog() {
      const path = await pickMarkdownFile();
      if (!path) {
        return null;
      }
      return this.openFile(path);
    },
    async saveActiveFile() {
      const session = this.activeSession;
      if (!session) {
        return null;
      }
      if (!session.path) {
        return this.saveAsDialog();
      }

      await this.flushAutosave();
      await writeMarkdownFile(session.path, session.content);
      session.markSaved(session.content);
      this.recentFiles = await saveRecentFile(session.path);
      await clearRecoverySnapshot(session.id);
      return session.path;
    },
    async saveAsDialog() {
      const session = this.activeSession;
      if (!session) {
        return null;
      }

      const path = await pickSaveMarkdownFile(session.path || undefined);
      if (!path) {
        return null;
      }

      await writeMarkdownFile(path, session.content);
      const previousId = session.id;
      session.setPath(path);
      session.markSaved(session.content);

      const nextSession = createDocumentSession({
        id: path,
        path,
        content: session.content,
      });
      this.sessions = this.sessions.filter((item) => item.id !== previousId);
      this.openSession(nextSession);
      this.recentFiles = await saveRecentFile(path);
      await clearRecoverySnapshot(path);
      await clearRecoverySnapshot(previousId);
      return path;
    },
    scheduleAutosave(content: string) {
      const session = this.activeSession;
      if (session) {
        session.updateContent(content);
        void saveRecoverySnapshot(session.id, content);
      }
      if (session?.path) {
        this.getAutosaveQueue().schedule(content);
      }
    },
    async flushAutosave() {
      await this.getAutosaveQueue().flush();
    },
    setRecentFiles(paths: string[]) {
      this.recentFiles = paths;
    },
    setActiveSession(id: string) {
      this.activeSessionId = id;
    },
    async closeSession(id: string) {
      const session = this.sessions.find((item) => item.id === id);
      if (!session) {
        return true;
      }

      if (session.isDirty()) {
        this.activeSessionId = id;
        const action = await promptUnsavedChanges(sessionLabel(session));
        if (action === "cancel") {
          return false;
        }
        if (action === "save") {
          const saved = await this.saveActiveFile();
          if (!saved) {
            return false;
          }
        } else {
          await clearRecoverySnapshot(session.id);
        }
      }

      this.sessions = this.sessions.filter((item) => item.id !== id);
      if (this.activeSessionId === id) {
        this.activeSessionId = this.sessions[this.sessions.length - 1]?.id ?? "";
      }
      return true;
    },
    async confirmBeforeQuit(): Promise<boolean> {
      for (const session of [...this.sessions]) {
        if (!session.isDirty()) {
          continue;
        }
        this.activeSessionId = session.id;
        const action = await promptUnsavedChanges(sessionLabel(session));
        if (action === "cancel") {
          return false;
        }
        if (action === "save") {
          const saved = await this.saveActiveFile();
          if (!saved) {
            return false;
          }
        } else {
          await clearRecoverySnapshot(session.id);
        }
      }
      await this.flushAutosave();
      return true;
    },
    labelForSession(session: Session) {
      return sessionLabel(session);
    },
    retargetSessionPath(oldPath: string, newPath: string) {
      const session = this.sessions.find((item) => item.id === oldPath || item.path === oldPath);
      if (!session) {
        return;
      }
      const content = session.content;
      const nextSession = createDocumentSession({
        id: newPath,
        path: newPath,
        content,
      });
      if (session.isDirty()) {
        nextSession.markDirty();
      }
      this.sessions = this.sessions
        .filter((item) => item.id !== oldPath && item.path !== oldPath)
        .concat(nextSession);
      if (this.activeSessionId === oldPath) {
        this.activeSessionId = newPath;
      }
    },
    async exportActiveHtml() {
      const session = this.activeSession;
      if (!session) {
        return null;
      }

      const title = session.path ? session.path.split("/").pop() ?? "Document" : "Untitled";
      const html = markdownToHtml(session.content, title);
      const defaultPath = session.path ? session.path.replace(/\.md$/i, ".html") : "untitled.html";
      const path = await pickSaveHtmlFile(defaultPath);
      if (!path) {
        return null;
      }

      await writeTextFile(path, html);
      return path;
    },
    async exportActivePdf() {
      const session = this.activeSession;
      if (!session) {
        return null;
      }

      const title = session.path ? session.path.split("/").pop() ?? "Document" : "Untitled";
      const defaultPath = session.path ? session.path.replace(/\.md$/i, ".pdf") : "untitled.pdf";
      try {
        return await exportMarkdownToPdf(session.content, title, defaultPath);
      } catch (error) {
        window.alert(String(error));
        return null;
      }
    },
  },
});
