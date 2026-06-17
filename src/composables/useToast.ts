import { ref } from "vue";

export interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

const toasts = ref<Toast[]>([]);
let nextId = 0;

function show(message: string, type: Toast["type"] = "info", durationMs = 3000) {
  const id = nextId++;
  toasts.value = [...toasts.value, { id, message, type }];
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }, durationMs);
}

export function toastSuccess(message: string) {
  show(message, "success");
}

export function toastError(message: string) {
  show(message, "error", 5000);
}

export function toastInfo(message: string) {
  show(message, "info");
}

export function useToast() {
  return { toasts };
}
