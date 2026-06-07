const PREFIX = "make-md:recovery:";

export async function saveRecoverySnapshot(id: string, content: string) {
  localStorage.setItem(PREFIX + id, content);
}

export async function loadRecoverySnapshot(id: string): Promise<string | null> {
  return localStorage.getItem(PREFIX + id);
}

export async function clearRecoverySnapshot(id: string) {
  localStorage.removeItem(PREFIX + id);
}
