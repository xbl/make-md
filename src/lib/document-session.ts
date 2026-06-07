export type DocumentSessionInput = {
  id: string;
  path: string;
  content: string;
};

export function createDocumentSession(input: DocumentSessionInput) {
  let content = input.content;
  let savedContent = input.content;
  let dirty = false;

  return {
    id: input.id,
    path: input.path,
    get content() {
      return content;
    },
    updateContent(nextContent: string) {
      content = nextContent;
      dirty = nextContent !== savedContent;
    },
    setPath(nextPath: string) {
      input.path = nextPath;
    },
    markDirty() {
      dirty = true;
    },
    markSaved(nextSavedContent: string) {
      content = nextSavedContent;
      savedContent = nextSavedContent;
      dirty = false;
    },
    isDirty() {
      return dirty;
    },
  };
}
