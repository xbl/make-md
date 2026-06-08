import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import { useDocumentsStore } from "@/stores/documents";
import "./styles/app.css";
import "highlight.js/styles/github.min.css";
import "./editor/syntax-highlight/themes/hljs-dark.css";

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.mount("#app");

if (typeof window !== "undefined") {
  window.__MAKE_MD_APP__ = {
    openFile: (path: string) => useDocumentsStore(pinia).openFile(path),
  };
}
