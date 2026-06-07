<template>
  <div class="app-shell">
    <aside class="app-shell__sidebar" data-testid="sidebar">
      <Sidebar />
    </aside>

    <section class="app-shell__main">
      <TabStrip class="app-shell__tabs" />
      <EditorPane class="app-shell__editor" data-testid="editor-pane" />
      <StatusBar class="app-shell__status" data-testid="status-bar" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import Sidebar from "@/components/Sidebar.vue";
import TabStrip from "@/components/TabStrip.vue";
import EditorPane from "@/components/EditorPane.vue";
import StatusBar from "@/components/StatusBar.vue";
import { useWorkspaceStore } from "@/stores/workspace";

const workspace = useWorkspaceStore();

onMounted(() => {
  void workspace.hydrateRecentItems();
});
</script>
