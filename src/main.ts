import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import "./styles/app.css";
import "highlight.js/styles/github.min.css";
import "./editor/syntax-highlight/themes/hljs-dark.css";

const app = createApp(App);
app.use(createPinia());
app.mount("#app");
