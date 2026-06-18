import { defineStore } from "pinia";
import { createDocumentSession } from "@/lib/document-session";
import { toastSuccess } from "@/composables/useToast";
import {
  clearRecentFiles,
  loadRecentFiles,
  pickMarkdownFile,
  pickSaveHtmlFile,
  pickSaveMarkdownFile,
  readMarkdownFile,
  removeRecentFile,
  saveRecentFile,
  writeMarkdownFile,
  writeTextFile,
} from "@/lib/file-service";
import { createAutosaveQueue } from "@/lib/autosave";
import { saveRecoverySnapshot, clearRecoverySnapshot, loadRecoverySnapshot } from "@/lib/recovery";
import { promptUnsavedChanges } from "@/lib/unsaved-prompt";
import { promptExternalChange } from "@/lib/external-change-prompt";
import { watchFile, unwatchFile } from "@/lib/file-watch";
import { markdownToHtml } from "@/lib/export-html";
import { exportMarkdownToPdf } from "@/lib/export-pdf";
import { exportMarkdownToWord } from "@/lib/export-word";

type Session = ReturnType<typeof createDocumentSession>;

let autosaveQueue: ReturnType<typeof createAutosaveQueue> | null = null;

const SELF_WRITE_IGNORE_MS = 500;
const selfWriteTimestamps = new Map<string, number>();

function markSelfWrite(path: string) {
  if (!path) return;
  selfWriteTimestamps.set(path, Date.now());
}

function isRecentSelfWrite(path: string): boolean {
  const last = selfWriteTimestamps.get(path);
  return last !== undefined && Date.now() - last < SELF_WRITE_IGNORE_MS;
}

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
          markSelfWrite(session.path);
          session.markSaved(content);
          await clearRecoverySnapshot(session.id);
        });
      }
      return autosaveQueue;
    },
    openSession(session: Session) {
      const existing = this.sessions.find((item) => item.id === session.id);
      if (existing) {
        this.activeSessionId = session.id;
        return;
      }
      this.sessions = [...this.sessions, session];
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
    async removeRecent(path: string) {
      this.recentFiles = await removeRecentFile(path);
    },
    async clearRecent() {
      this.recentFiles = await clearRecentFiles();
    },
    async openFile(path: string) {
      const existing = this.sessions.find((session) => session.path === path || session.id === path);
      if (existing) {
        this.activeSessionId = existing.id;
        return existing;
      }

      const restored = await loadRecoverySnapshot(path);
      const { content } = restored ? { content: restored } : await readMarkdownFile(path);
      const session = createDocumentSession({
        id: path,
        path,
        content,
      });
      this.openSession(session);
      void watchFile(path);
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
      markSelfWrite(session.path);
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
      markSelfWrite(path);
      const previousId = session.id;
      const previousPath = session.path;
      session.setPath(path);
      session.markSaved(session.content);

      const nextSession = createDocumentSession({
        id: path,
        path,
        content: session.content,
      });
      this.sessions = this.sessions.filter((item) => item.id !== previousId);
      this.openSession(nextSession);
      if (previousPath) {
        void unwatchFile(previousPath);
      }
      void watchFile(path);
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
    async refreshSessionFromDisk(path: string, force = false) {
      const session = this.sessions.find((item) => item.path === path || item.id === path);
      if (!session) {
        return false;
      }
      if (!force && session.isDirty()) {
        return false;
      }

      const { content } = await readMarkdownFile(path);
      session.markSaved(content);
      this.sessions = [...this.sessions];
      return true;
    },
    async handleExternalFileChange(payload: { path: string; kind: "modified" | "removed" }) {
      if (isRecentSelfWrite(payload.path)) {
        return;
      }
      const session = this.sessions.find((item) => item.path === payload.path);
      if (!session) {
        return;
      }
      if (payload.kind === "removed") {
        session.markMissing(true);
        this.sessions = [...this.sessions];
        return;
      }
      if (!session.isDirty()) {
        await this.refreshSessionFromDisk(payload.path);
        return;
      }
      const action = await promptExternalChange(sessionLabel(session));
      if (action === "reload") {
        await this.refreshSessionFromDisk(payload.path, true);
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
      if (session.path) {
        void unwatchFile(session.path);
      }
      if (this.activeSessionId === id) {
        this.activeSessionId = this.sessions[this.sessions.length - 1]?.id ?? "";
      }
      return true;
    },
    async closeOtherSessions(targetId: string) {
      const target = this.sessions.find((session) => session.id === targetId);
      if (!target) {
        return false;
      }

      this.activeSessionId = targetId;
      const otherIds = this.sessions.filter((session) => session.id !== targetId).map((session) => session.id);
      for (const id of otherIds) {
        const closed = await this.closeSession(id);
        if (!closed) {
          if (this.sessions.some((session) => session.id === targetId)) {
            this.activeSessionId = targetId;
          }
          return false;
        }
      }

      if (this.sessions.some((session) => session.id === targetId)) {
        this.activeSessionId = targetId;
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
      void unwatchFile(oldPath);
      void watchFile(newPath);
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
        return await exportMarkdownToPdf(session.content, title, defaultPath, session.path || undefined);
      } catch (error) {
        window.alert(String(error));
        return null;
      }
    },
    async exportActiveWord() {
      const session = this.activeSession;
      if (!session) {
        return null;
      }

      const title = session.path ? session.path.split("/").pop() ?? "Document" : "Untitled";
      const defaultPath = session.path ? session.path.replace(/\.md$/i, ".docx") : "untitled.docx";
      try {
        const filePath = await exportMarkdownToWord(session.content, title, defaultPath, session.path || undefined);
        if (filePath) {
          toastSuccess(`Word exported: ${filePath.split("/").pop()}`);
        }
        return filePath;
      } catch (error) {
        window.alert(String(error));
        return null;
      }
    },
  },
});
