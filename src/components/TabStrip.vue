<template>
  <div class="tab-strip">
    <div
      v-for="item in documents.sessions"
      :key="item.id"
      class="tab-group"
      :class="{ 'tab-group--active': item.id === documents.activeSessionId }"
      @contextmenu.prevent="openMenu($event, item.id)"
    >
      <button
        type="button"
        class="tab"
        @click="documents.setActiveSession(item.id)"
      >
        {{ tabLabel(item) }}
      </button>
      <button
        type="button"
        class="tab__close"
        aria-label="Close tab"
        @click.stop="closeTab(item.id)"
      >
        ×
      </button>
    </div>
    <button type="button" class="tab tab--new" aria-label="New file" @click="newFile">+</button>

    <ContextMenu
      :open="menu.state.open"
      :x="menu.state.x"
      :y="menu.state.y"
      :items="menuItems"
      @close="menu.close"
      @select="onMenuSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import ContextMenu from "@/components/ContextMenu.vue";
import {
  createContextMenuController,
  type ContextMenuActionItem,
  type ContextMenuItem,
} from "@/lib/context-menu";
import { revealInFinder } from "@/lib/workspace-service";
import { useDocumentsStore } from "@/stores/documents";

const documents = useDocumentsStore();
const menu = createContextMenuController();
const menuSessionId = ref("");

const menuSession = computed(() =>
  documents.sessions.find((session) => session.id === menuSessionId.value),
);

const menuItems = computed<ContextMenuItem[]>(() => {
  const session = menuSession.value;
  if (!session) {
    return [];
  }

  return [
    { type: "action", id: "close", label: "Close" },
    { type: "action", id: "close-others", label: "Close Others", disabled: documents.sessions.length < 2 },
    {
      type: "action",
      id: "reveal",
      label: "Reveal in Finder",
      disabled: !session.path,
    },
  ];
});

function tabLabel(item: { path: string; isDirty: () => boolean }) {
  const name = item.path ? item.path.split("/").pop() || "Untitled.md" : "Untitled.md";
  return item.isDirty() ? `${name} *` : name;
}

async function closeTab(id: string) {
  await documents.closeSession(id);
}

function newFile() {
  documents.createNewDocument();
}

function openMenu(event: MouseEvent, sessionId: string) {
  menuSessionId.value = sessionId;
  documents.setActiveSession(sessionId);
  menu.openAt(event.clientX, event.clientY);
}

function onMenuSelect(item: ContextMenuActionItem) {
  const session = menuSession.value;
  if (!session) {
    menu.close("programmatic");
    return;
  }

  if (item.id === "close") {
    menu.close("programmatic");
    void documents.closeSession(session.id);
    return;
  }

  if (item.id === "close-others") {
    menu.close("programmatic");
    void documents.closeOtherSessions(session.id);
    return;
  }

  if (item.id === "reveal" && session.path) {
    menu.close("programmatic");
    void revealCurrentSession(session.path);
  }
}

async function revealCurrentSession(path: string) {
  try {
    await revealInFinder(path);
  } catch (error) {
    window.alert(String(error));
  }
}
</script>
