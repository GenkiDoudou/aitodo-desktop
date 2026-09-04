import { d as defineComponent, o as onMounted, b as openBlock, c as createElementBlock, M as Fragment, N as renderList, T as normalizeStyle, e as createBaseVNode, t as toDisplayString, u as unref, ao as TASK_PRIORITIES, i as ref, F as computed, P as ElMessage, _ as _export_sfc, n as normalizeClass, g as createCommentVNode, a5 as withDirectives, af as vModelText, G as watch, ax as isValidTaskPriority, L as createBlock, a as onUnmounted, h as withModifiers, j as createApp, k as element_plus_default } from "./_plugin-vue_export-helper-_mGsRMHs.js";
import { n as nextTaskStatus, S as splitTasksByPriority, W as WIDGET_NOTE_COLORS, V as kanbanScopeKey, a6 as categoryLogoInitial, l as compareTasks, K as KANBAN_DONE_COLUMN_ID, I as KANBAN_UNGROUPED_ID, N as readKanbanConfig, a7 as DEFAULT_KANBAN_STATUS_LABELS, J as KANBAN_STATUS_COLUMNS, L as statusLabelFor, M as shouldShowKanbanDoneColumn, r as resolveHideDoneScope, a8 as WIDGET_KANBAN_DEFAULT_WIDTH, a9 as WIDGET_KANBAN_DEFAULT_HEIGHT, $ as isFilterRuleActive, x as readViewDisplayPreferences, aa as filterTasksForViewWidget, ab as flattenTasksForViewWidget, a5 as widgetInstanceDisplayName } from "./quadrant-tasks-CduHGpn9.js";
const _hoisted_1$4 = { class: "matrix-panel" };
const _hoisted_2$4 = {
  key: 0,
  class: "matrix-panel__empty"
};
const _hoisted_3$4 = {
  key: 1,
  class: "matrix-panel__empty"
};
const _hoisted_4$4 = {
  key: 2,
  class: "matrix-panel__grid"
};
const _hoisted_5$4 = { class: "matrix-panel__quadrant-head" };
const _hoisted_6$4 = { class: "matrix-panel__code" };
const _hoisted_7$4 = { class: "matrix-panel__title" };
const _hoisted_8$4 = { class: "matrix-panel__count" };
const _hoisted_9$3 = {
  key: 0,
  class: "matrix-panel__hint"
};
const _hoisted_10$3 = {
  key: 1,
  class: "matrix-panel__tasks"
};
const _hoisted_11$3 = ["disabled", "onChange"];
const _hoisted_12$2 = ["onClick"];
const _hoisted_13$2 = ["value", "disabled", "onChange"];
const _hoisted_14$1 = ["value"];
const _sfc_main$4 = /* @__PURE__ */ defineComponent({
  __name: "WidgetMatrixPanel",
  setup(__props) {
    const tasks = ref([]);
    const loading = ref(false);
    const updatingIds = ref(/* @__PURE__ */ new Set());
    const priorities = TASK_PRIORITIES;
    const groupedTasks = computed(() => splitTasksByPriority(tasks.value));
    function setUpdating(id, updating) {
      const next = new Set(updatingIds.value);
      if (updating) next.add(id);
      else next.delete(id);
      updatingIds.value = next;
    }
    async function reload() {
      loading.value = true;
      const res = await window.widgetApi.tasks.list({ hideDone: true });
      loading.value = false;
      if (!res.ok) {
        ElMessage.error(res.error.message);
        return;
      }
      tasks.value = res.data;
    }
    async function toggleDone(id) {
      const task = tasks.value.find((t) => t.id === id);
      if (!task) return;
      const next = nextTaskStatus(task.status);
      setUpdating(id, true);
      const res = await window.widgetApi.tasks.update(id, { status: next });
      setUpdating(id, false);
      if (!res.ok) {
        ElMessage.error(res.error.message);
        return;
      }
      await reload();
    }
    async function changePriority(id, event) {
      const priority = Number(event.target.value);
      setUpdating(id, true);
      const res = await window.widgetApi.tasks.update(id, { priority });
      setUpdating(id, false);
      if (!res.ok) {
        ElMessage.error(res.error.message);
        return;
      }
      await reload();
    }
    async function openTask(taskId) {
      await window.widgetApi.app.openMain(`/?view=matrix&taskId=${encodeURIComponent(taskId)}`);
    }
    onMounted(() => {
      void reload();
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("section", _hoisted_1$4, [
        loading.value && tasks.value.length === 0 ? (openBlock(), createElementBlock("div", _hoisted_2$4, "四象限加载中…")) : tasks.value.length === 0 ? (openBlock(), createElementBlock("div", _hoisted_3$4, "暂无未完成任务")) : (openBlock(), createElementBlock("div", _hoisted_4$4, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(unref(priorities), (meta) => {
            return openBlock(), createElementBlock("article", {
              key: meta.value,
              class: "matrix-panel__quadrant",
              style: normalizeStyle({ "--priority-color": meta.color })
            }, [
              createBaseVNode("header", _hoisted_5$4, [
                createBaseVNode("span", _hoisted_6$4, toDisplayString(meta.code), 1),
                createBaseVNode("span", _hoisted_7$4, toDisplayString(meta.quadrantTitle), 1),
                createBaseVNode("span", _hoisted_8$4, toDisplayString(groupedTasks.value[meta.value].length), 1)
              ]),
              groupedTasks.value[meta.value].length === 0 ? (openBlock(), createElementBlock("div", _hoisted_9$3, " 空 ")) : (openBlock(), createElementBlock("div", _hoisted_10$3, [
                (openBlock(true), createElementBlock(Fragment, null, renderList(groupedTasks.value[meta.value], (task) => {
                  return openBlock(), createElementBlock("div", {
                    key: task.id,
                    class: "matrix-panel__task"
                  }, [
                    createBaseVNode("input", {
                      class: "matrix-panel__check",
                      type: "checkbox",
                      disabled: updatingIds.value.has(task.id),
                      onChange: ($event) => toggleDone(task.id)
                    }, null, 40, _hoisted_11$3),
                    createBaseVNode("button", {
                      type: "button",
                      class: "matrix-panel__task-title",
                      onClick: ($event) => openTask(task.id)
                    }, toDisplayString(task.title), 9, _hoisted_12$2),
                    createBaseVNode("select", {
                      class: "matrix-panel__priority",
                      value: task.priority,
                      disabled: updatingIds.value.has(task.id),
                      title: "调整优先级",
                      onChange: ($event) => changePriority(task.id, $event)
                    }, [
                      (openBlock(true), createElementBlock(Fragment, null, renderList(unref(priorities), (option) => {
                        return openBlock(), createElementBlock("option", {
                          key: option.value,
                          value: option.value
                        }, toDisplayString(option.code), 9, _hoisted_14$1);
                      }), 128))
                    ], 40, _hoisted_13$2)
                  ]);
                }), 128))
              ]))
            ], 4);
          }), 128))
        ]))
      ]);
    };
  }
});
const WidgetMatrixPanel = /* @__PURE__ */ _export_sfc(_sfc_main$4, [["__scopeId", "data-v-641d6e56"]]);
const _hoisted_1$3 = { class: "notes-panel" };
const _hoisted_2$3 = { class: "notes-panel__list" };
const _hoisted_3$3 = { class: "notes-panel__items" };
const _hoisted_4$3 = ["onClick"];
const _hoisted_5$3 = {
  key: 0,
  class: "notes-panel__pin"
};
const _hoisted_6$3 = { class: "notes-panel__preview" };
const _hoisted_7$3 = {
  key: 0,
  class: "notes-panel__editor"
};
const _hoisted_8$3 = { class: "notes-panel__toolbar" };
const _hoisted_9$2 = { class: "notes-panel__colors" };
const _hoisted_10$2 = ["title", "onClick"];
const _hoisted_11$2 = { class: "notes-panel__actions" };
const _hoisted_12$1 = {
  key: 0,
  class: "notes-panel__status"
};
const _hoisted_13$1 = {
  key: 1,
  class: "notes-panel__empty"
};
const _sfc_main$3 = /* @__PURE__ */ defineComponent({
  __name: "WidgetNotesPanel",
  setup(__props) {
    const notes = ref([]);
    const selectedId = ref(null);
    const draft = ref("");
    const saving = ref(false);
    const colors = WIDGET_NOTE_COLORS;
    let saveTimer = null;
    const selected = computed(() => notes.value.find((n) => n.id === selectedId.value) ?? null);
    function preview(content) {
      const line = content.split(/\r?\n/).find((s) => s.trim());
      return (line ?? "空白便签").slice(0, 24);
    }
    async function reload() {
      const res = await window.widgetApi.widgetNotes.list();
      if (!res.ok) {
        ElMessage.error(res.error.message);
        return;
      }
      notes.value = res.data;
      if (selectedId.value && !notes.value.some((n) => n.id === selectedId.value)) {
        selectedId.value = notes.value[0]?.id ?? null;
      }
      if (!selectedId.value && notes.value[0]) {
        selectedId.value = notes.value[0].id;
      }
      if (selected.value) {
        draft.value = selected.value.content;
      }
    }
    function selectNote(id) {
      void flushSave();
      selectedId.value = id;
      draft.value = notes.value.find((n) => n.id === id)?.content ?? "";
    }
    async function createNote() {
      const res = await window.widgetApi.widgetNotes.create({ content: "" });
      if (!res.ok) {
        ElMessage.error(res.error.message);
        return;
      }
      notes.value = [res.data, ...notes.value];
      selectedId.value = res.data.id;
      draft.value = "";
    }
    function scheduleSave() {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        void flushSave();
      }, 500);
    }
    async function flushSave() {
      if (!selectedId.value) return;
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      saving.value = true;
      const res = await window.widgetApi.widgetNotes.update(selectedId.value, { content: draft.value });
      saving.value = false;
      if (!res.ok) {
        ElMessage.error(res.error.message);
        return;
      }
      notes.value = notes.value.map((n) => n.id === res.data.id ? res.data : n);
      await reload();
    }
    async function setColor(color) {
      if (!selectedId.value) return;
      const res = await window.widgetApi.widgetNotes.update(selectedId.value, { color });
      if (!res.ok) {
        ElMessage.error(res.error.message);
        return;
      }
      await reload();
    }
    async function togglePin() {
      if (!selected.value) return;
      const res = await window.widgetApi.widgetNotes.update(selected.value.id, {
        pinned: !selected.value.pinned
      });
      if (!res.ok) {
        ElMessage.error(res.error.message);
        return;
      }
      await reload();
    }
    async function convertToTask() {
      if (!selectedId.value) return;
      await flushSave();
      const res = await window.widgetApi.widgetNotes.convertToTask(selectedId.value, {
        deleteNote: true
      });
      if (!res.ok) {
        ElMessage.error(res.error.message);
        return;
      }
      ElMessage.success(`已加入收件箱：${res.data.title}`);
      selectedId.value = null;
      draft.value = "";
      await reload();
    }
    async function deleteNote() {
      if (!selectedId.value) return;
      const id = selectedId.value;
      const res = await window.widgetApi.widgetNotes.delete(id);
      if (!res.ok) {
        ElMessage.error(res.error.message);
        return;
      }
      selectedId.value = null;
      draft.value = "";
      await reload();
    }
    onMounted(() => {
      void reload();
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$3, [
        createBaseVNode("aside", _hoisted_2$3, [
          createBaseVNode("div", { class: "notes-panel__list-head" }, [
            createBaseVNode("button", {
              type: "button",
              class: "notes-panel__new",
              onClick: createNote
            }, "+ 新建")
          ]),
          createBaseVNode("div", _hoisted_3$3, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(notes.value, (note) => {
              return openBlock(), createElementBlock("button", {
                key: note.id,
                type: "button",
                class: normalizeClass(["notes-panel__item", { "is-active": note.id === selectedId.value, [`is-${note.color}`]: true }]),
                onClick: ($event) => selectNote(note.id)
              }, [
                note.pinned ? (openBlock(), createElementBlock("span", _hoisted_5$3, "📌")) : createCommentVNode("", true),
                createBaseVNode("span", _hoisted_6$3, toDisplayString(preview(note.content)), 1)
              ], 10, _hoisted_4$3);
            }), 128))
          ])
        ]),
        selected.value ? (openBlock(), createElementBlock("section", _hoisted_7$3, [
          createBaseVNode("div", _hoisted_8$3, [
            createBaseVNode("div", _hoisted_9$2, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(unref(colors), (color) => {
                return openBlock(), createElementBlock("button", {
                  key: color,
                  type: "button",
                  class: normalizeClass(["notes-panel__color", [`is-${color}`, { "is-selected": selected.value.color === color }]]),
                  title: color,
                  onClick: ($event) => setColor(color)
                }, null, 10, _hoisted_10$2);
              }), 128))
            ]),
            createBaseVNode("div", _hoisted_11$2, [
              createBaseVNode("button", {
                type: "button",
                class: "notes-panel__action",
                onClick: togglePin
              }, toDisplayString(selected.value.pinned ? "取消置顶" : "置顶"), 1),
              createBaseVNode("button", {
                type: "button",
                class: "notes-panel__action",
                onClick: convertToTask
              }, "转为任务"),
              createBaseVNode("button", {
                type: "button",
                class: "notes-panel__action is-danger",
                onClick: deleteNote
              }, "删除")
            ])
          ]),
          withDirectives(createBaseVNode("textarea", {
            "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => draft.value = $event),
            class: normalizeClass(["notes-panel__textarea", `is-${selected.value.color}`]),
            placeholder: "写点什么…",
            onInput: scheduleSave,
            onBlur: flushSave
          }, null, 34), [
            [vModelText, draft.value]
          ]),
          saving.value ? (openBlock(), createElementBlock("p", _hoisted_12$1, "保存中…")) : createCommentVNode("", true)
        ])) : (openBlock(), createElementBlock("div", _hoisted_13$1, "点击「新建」或选择便签"))
      ]);
    };
  }
});
const WidgetNotesPanel = /* @__PURE__ */ _export_sfc(_sfc_main$3, [["__scopeId", "data-v-8c564713"]]);
const _hoisted_1$2 = { class: "widget-kanban" };
const _hoisted_2$2 = {
  key: 0,
  class: "widget-kanban__empty"
};
const _hoisted_3$2 = {
  key: 1,
  class: "widget-kanban__board"
};
const _hoisted_4$2 = { class: "widget-kanban__col-head" };
const _hoisted_5$2 = { class: "widget-kanban__col-title" };
const _hoisted_6$2 = { class: "widget-kanban__col-count" };
const _hoisted_7$2 = { class: "widget-kanban__cards" };
const _hoisted_8$2 = {
  key: 0,
  class: "widget-kanban__col-empty"
};
const _hoisted_9$1 = ["title"];
const _hoisted_10$1 = ["checked", "disabled", "onChange"];
const _hoisted_11$1 = ["onClick"];
const _sfc_main$2 = /* @__PURE__ */ defineComponent({
  __name: "WidgetKanbanView",
  props: {
    tasks: {},
    boardMode: {},
    sortBy: {},
    hideDone: { type: Boolean },
    hideDoneScope: {},
    updatingIds: {},
    categories: {}
  },
  emits: ["toggle-done", "open-task"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const DONE_COLUMN_ID = KANBAN_DONE_COLUMN_ID;
    const scopeKey = kanbanScopeKey({ smart: "all" });
    const customGroups = ref([]);
    const ungroupedName = ref("未分组");
    const sortBy = computed(() => props.sortBy ?? "custom");
    const effectiveHideDoneScope = computed(
      () => props.hideDoneScope ?? resolveHideDoneScope({ hideDone: props.hideDone })
    );
    const updatingIds = computed(() => props.updatingIds ?? /* @__PURE__ */ new Set());
    const categoryMap = computed(() => new Map((props.categories ?? []).map((c) => [c.id, c])));
    const rootTasks = computed(() => props.tasks.filter((task) => !task.parentId));
    const childrenByParent = computed(() => {
      const map = /* @__PURE__ */ new Map();
      for (const task of props.tasks) {
        if (!task.parentId) continue;
        if (!map.has(task.parentId)) map.set(task.parentId, []);
        map.get(task.parentId).push(task);
      }
      return map;
    });
    const groupIdSet = computed(() => new Set(customGroups.value.map((group) => group.id)));
    const displayColumns = computed(() => {
      if (props.boardMode === "status") {
        const labels = readKanbanConfig().statusColumnLabels ?? DEFAULT_KANBAN_STATUS_LABELS;
        return KANBAN_STATUS_COLUMNS.map((status) => ({
          id: status,
          name: statusLabelFor(status, labels)
        }));
      }
      if (props.boardMode === "priority") {
        return TASK_PRIORITIES.map((item) => ({
          id: String(item.value),
          name: `${item.code} · ${item.label}`
        }));
      }
      const cols = [{ id: KANBAN_UNGROUPED_ID, name: ungroupedName.value }];
      for (const group of customGroups.value) {
        cols.push({ id: group.id, name: group.name });
      }
      if (shouldShowKanbanDoneColumn(effectiveHideDoneScope.value)) {
        cols.push({ id: DONE_COLUMN_ID, name: "已完成" });
      }
      return cols;
    });
    function sortTaskList(items) {
      return [...items].sort((a, b) => compareTasks(a, b, sortBy.value));
    }
    function resolveColumnId(task) {
      if (task.kanbanGroupId && groupIdSet.value.has(task.kanbanGroupId)) {
        return task.kanbanGroupId;
      }
      return KANBAN_UNGROUPED_ID;
    }
    function tasksInColumn(columnId) {
      if (props.boardMode === "status") {
        return rootTasks.value.filter((task) => task.status === columnId);
      }
      if (props.boardMode === "priority") {
        const priority = Number(columnId);
        if (!isValidTaskPriority(priority)) return [];
        return rootTasks.value.filter((task) => {
          const value = typeof task.priority === "number" ? task.priority : Number(task.priority);
          return (Number.isFinite(value) ? value : 4) === priority;
        });
      }
      if (columnId === DONE_COLUMN_ID) {
        return rootTasks.value.filter((task) => task.status === "DONE");
      }
      return rootTasks.value.filter((task) => task.status !== "DONE" && resolveColumnId(task) === columnId);
    }
    function columnRows(columnId) {
      const rows = [];
      function walk(task, depth) {
        rows.push({ task, depth });
        for (const child of sortTaskList(childrenByParent.value.get(task.id) ?? [])) {
          walk(child, depth + 1);
        }
      }
      for (const root of sortTaskList(tasksInColumn(columnId))) {
        walk(root, 0);
      }
      return rows;
    }
    function categoryName(task) {
      if (!task.categoryId) return "未分类";
      return categoryMap.value.get(task.categoryId)?.name ?? "未分类";
    }
    function categoryLogo(task) {
      return categoryLogoInitial(categoryName(task));
    }
    function categoryLogoStyle(task) {
      const color = task.categoryId ? categoryMap.value.get(task.categoryId)?.color : null;
      if (color) {
        return { background: color, color: "#fff" };
      }
      return { background: "rgba(255,255,255,0.12)", color: "var(--widget-muted)" };
    }
    async function loadGroups() {
      const res = await window.widgetApi.kanbanGroups.list(scopeKey);
      if (!res.ok) {
        ElMessage.error(res.error.message);
        return;
      }
      customGroups.value = res.data.groups;
      ungroupedName.value = res.data.ungroupedName;
    }
    onMounted(() => {
      if (props.boardMode === "group") {
        void loadGroups();
      }
    });
    watch(
      () => props.boardMode,
      (mode) => {
        if (mode === "group") {
          void loadGroups();
        }
      }
    );
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$2, [
        displayColumns.value.length === 0 ? (openBlock(), createElementBlock("div", _hoisted_2$2, "暂无看板列")) : (openBlock(), createElementBlock("div", _hoisted_3$2, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(displayColumns.value, (col) => {
            return openBlock(), createElementBlock("section", {
              key: col.id,
              class: normalizeClass(["widget-kanban__col", { "is-empty": columnRows(col.id).length === 0 }])
            }, [
              createBaseVNode("header", _hoisted_4$2, [
                createBaseVNode("span", _hoisted_5$2, toDisplayString(col.name), 1),
                createBaseVNode("span", _hoisted_6$2, toDisplayString(columnRows(col.id).length), 1)
              ]),
              createBaseVNode("div", _hoisted_7$2, [
                columnRows(col.id).length === 0 ? (openBlock(), createElementBlock("div", _hoisted_8$2, "空")) : createCommentVNode("", true),
                (openBlock(true), createElementBlock(Fragment, null, renderList(columnRows(col.id), (row) => {
                  return openBlock(), createElementBlock("article", {
                    key: row.task.id,
                    class: normalizeClass(["widget-kanban__card", { "widget-kanban__card--child": row.depth > 0 }]),
                    style: normalizeStyle(row.depth > 0 ? { marginLeft: `${row.depth * 10}px` } : void 0)
                  }, [
                    createBaseVNode("span", {
                      class: "widget-kanban__logo",
                      style: normalizeStyle(categoryLogoStyle(row.task)),
                      title: categoryName(row.task) || "未分类"
                    }, toDisplayString(categoryLogo(row.task)), 13, _hoisted_9$1),
                    createBaseVNode("input", {
                      class: "widget-kanban__check",
                      type: "checkbox",
                      checked: row.task.status === "DONE",
                      disabled: updatingIds.value.has(row.task.id),
                      onChange: ($event) => emit("toggle-done", row.task.id)
                    }, null, 40, _hoisted_10$1),
                    createBaseVNode("button", {
                      type: "button",
                      class: "widget-kanban__title",
                      onClick: ($event) => emit("open-task", row.task.id)
                    }, toDisplayString(row.task.title), 9, _hoisted_11$1)
                  ], 6);
                }), 128))
              ])
            ], 2);
          }), 128))
        ]))
      ]);
    };
  }
});
const WidgetKanbanView = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["__scopeId", "data-v-2358d6c3"]]);
const _hoisted_1$1 = { class: "views-panel" };
const _hoisted_2$1 = {
  key: 0,
  class: "views-panel__empty"
};
const _hoisted_3$1 = {
  key: 1,
  class: "views-panel__empty"
};
const _hoisted_4$1 = {
  key: 2,
  class: "views-panel__list"
};
const _hoisted_5$1 = ["onClick"];
const _hoisted_6$1 = { class: "views-panel__view-name" };
const _hoisted_7$1 = { class: "views-panel__view-meta" };
const _hoisted_8$1 = { class: "views-panel__head" };
const _hoisted_9 = { class: "views-panel__detail-title" };
const _hoisted_10 = {
  key: 0,
  class: "views-panel__notice"
};
const _hoisted_11 = {
  key: 1,
  class: "views-panel__notice views-panel__notice--warn"
};
const _hoisted_12 = {
  key: 2,
  class: "views-panel__empty"
};
const _hoisted_13 = {
  key: 3,
  class: "views-panel__empty"
};
const _hoisted_14 = {
  key: 4,
  class: "views-panel__empty"
};
const _hoisted_15 = {
  key: 5,
  class: "views-panel__empty"
};
const _hoisted_16 = {
  key: 7,
  class: "views-panel__tasks"
};
const _hoisted_17 = ["title"];
const _hoisted_18 = ["disabled", "onChange"];
const _hoisted_19 = ["onClick"];
const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "WidgetViewsPanel",
  props: {
    fixedViewId: {},
    instanceId: {}
  },
  setup(__props) {
    const props = __props;
    const fixedViewId = computed(() => props.fixedViewId?.trim() || null);
    const views = ref([]);
    const tasks = ref([]);
    const categories = ref([]);
    const selectedViewId = ref(null);
    const loadingViews = ref(false);
    const loadingTasks = ref(false);
    const updatingIds = ref(/* @__PURE__ */ new Set());
    const categoryMap = computed(() => new Map(categories.value.map((c) => [c.id, c])));
    const kanbanWidthEnsured = ref(false);
    const selectedView = computed(() => {
      const id = fixedViewId.value ?? selectedViewId.value;
      if (!id) return null;
      return views.value.find((view) => view.id === id) ?? null;
    });
    const hasActiveRule = computed(() => isFilterRuleActive(selectedView.value?.filterRule));
    const isKanbanView = computed(() => selectedView.value?.layout === "kanban");
    const viewHideDoneScope = computed(() => {
      const view = selectedView.value;
      if (!view) return "all";
      const kanbanMode = view.layout === "kanban" ? view.kanbanBoardMode ?? "group" : null;
      return readViewDisplayPreferences(view.id, kanbanMode).hideDoneScope;
    });
    const filteredTasks = computed(() => {
      const view = selectedView.value;
      if (!view) return [];
      return filterTasksForViewWidget(tasks.value, view, { hideDoneScope: viewHideDoneScope.value });
    });
    const listRows = computed(() => flattenTasksForViewWidget(filteredTasks.value));
    function categoryName(task) {
      if (!task.categoryId) return "未分类";
      return categoryMap.value.get(task.categoryId)?.name ?? "未分类";
    }
    function categoryLogo(task) {
      return categoryLogoInitial(categoryName(task));
    }
    function categoryLogoStyle(task) {
      const color = task.categoryId ? categoryMap.value.get(task.categoryId)?.color : null;
      if (color) {
        return { background: color, color: "#fff" };
      }
      return { background: "rgba(255,255,255,0.12)", color: "var(--widget-muted)" };
    }
    async function ensureKanbanWindowSize() {
      if (!props.instanceId || !isKanbanView.value || kanbanWidthEnsured.value) return;
      kanbanWidthEnsured.value = true;
      const res = await window.widgetApi.widget.getInstance(props.instanceId);
      if (!res.ok) return;
      const current = res.data;
      if (current.width >= WIDGET_KANBAN_DEFAULT_WIDTH - 8) return;
      await window.widgetApi.widget.updateInstance(props.instanceId, {
        width: WIDGET_KANBAN_DEFAULT_WIDTH,
        height: Math.max(current.height, WIDGET_KANBAN_DEFAULT_HEIGHT)
      });
    }
    function setUpdating(id, updating) {
      const next = new Set(updatingIds.value);
      if (updating) next.add(id);
      else next.delete(id);
      updatingIds.value = next;
    }
    function layoutLabel(layout) {
      if (layout === "kanban") return "看板";
      if (layout === "timeline") return "时间线";
      if (layout === "quadrant") return "四象限";
      return "列表";
    }
    async function reloadCategories() {
      const res = await window.widgetApi.categories.list();
      if (!res.ok) {
        ElMessage.error(res.error.message);
        return;
      }
      categories.value = res.data;
    }
    async function reloadViews() {
      loadingViews.value = true;
      const res = await window.widgetApi.taskViews.list();
      loadingViews.value = false;
      if (!res.ok) {
        ElMessage.error(res.error.message);
        return;
      }
      views.value = res.data;
      if (selectedViewId.value && !views.value.some((view) => view.id === selectedViewId.value)) {
        selectedViewId.value = null;
        tasks.value = [];
      }
    }
    async function reloadTasks() {
      if (!selectedView.value) return;
      loadingTasks.value = true;
      const res = await window.widgetApi.tasks.list({ smartList: "all", hideDone: false });
      loadingTasks.value = false;
      if (!res.ok) {
        ElMessage.error(res.error.message);
        return;
      }
      tasks.value = res.data;
    }
    async function selectView(id) {
      selectedViewId.value = id;
      await reloadTasks();
    }
    function backToViews() {
      selectedViewId.value = null;
      tasks.value = [];
    }
    async function toggleDone(id) {
      const task = tasks.value.find((t) => t.id === id);
      if (!task) return;
      const next = nextTaskStatus(task.status);
      setUpdating(id, true);
      const res = await window.widgetApi.tasks.update(id, { status: next });
      setUpdating(id, false);
      if (!res.ok) {
        ElMessage.error(res.error.message);
        return;
      }
      await reloadTasks();
    }
    async function openTask(taskId) {
      const base = selectedView.value ? `/?viewId=${encodeURIComponent(selectedView.value.id)}` : "/";
      const sep = base.includes("?") ? "&" : "?";
      await window.widgetApi.app.openMain(`${base}${sep}taskId=${encodeURIComponent(taskId)}`);
    }
    async function bootstrapFixedView() {
      if (!fixedViewId.value) return;
      selectedViewId.value = fixedViewId.value;
      await reloadTasks();
      await ensureKanbanWindowSize();
    }
    watch(fixedViewId, () => {
      kanbanWidthEnsured.value = false;
      void bootstrapFixedView();
    });
    watch(isKanbanView, (kanban) => {
      if (kanban) {
        void ensureKanbanWindowSize();
      }
    });
    onMounted(async () => {
      await Promise.all([reloadViews(), reloadCategories()]);
      await bootstrapFixedView();
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("section", _hoisted_1$1, [
        !fixedViewId.value && !selectedView.value ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
          createBaseVNode("header", { class: "views-panel__head" }, [
            _cache[0] || (_cache[0] = createBaseVNode("span", null, "我的视图", -1)),
            createBaseVNode("button", {
              type: "button",
              class: "views-panel__ghost",
              onClick: reloadViews
            }, "刷新")
          ]),
          loadingViews.value && views.value.length === 0 ? (openBlock(), createElementBlock("div", _hoisted_2$1, "视图加载中…")) : views.value.length === 0 ? (openBlock(), createElementBlock("div", _hoisted_3$1, "暂无自定义视图")) : (openBlock(), createElementBlock("div", _hoisted_4$1, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(views.value, (view) => {
              return openBlock(), createElementBlock("button", {
                key: view.id,
                type: "button",
                class: "views-panel__view",
                onClick: ($event) => selectView(view.id)
              }, [
                createBaseVNode("span", _hoisted_6$1, toDisplayString(view.name), 1),
                createBaseVNode("span", _hoisted_7$1, toDisplayString(layoutLabel(view.layout)), 1)
              ], 8, _hoisted_5$1);
            }), 128))
          ]))
        ], 64)) : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
          createBaseVNode("header", _hoisted_8$1, [
            !fixedViewId.value ? (openBlock(), createElementBlock("button", {
              key: 0,
              type: "button",
              class: "views-panel__back",
              onClick: backToViews
            }, "‹")) : createCommentVNode("", true),
            createBaseVNode("span", _hoisted_9, toDisplayString(selectedView.value?.name ?? "视图"), 1),
            createBaseVNode("button", {
              type: "button",
              class: "views-panel__ghost",
              onClick: reloadTasks
            }, "刷新")
          ]),
          selectedView.value && !hasActiveRule.value ? (openBlock(), createElementBlock("p", _hoisted_10, " 该视图无筛选规则，显示全部未完成任务 ")) : !selectedView.value && fixedViewId.value ? (openBlock(), createElementBlock("p", _hoisted_11, " 绑定的视图不存在或已删除 ")) : createCommentVNode("", true),
          loadingTasks.value && tasks.value.length === 0 ? (openBlock(), createElementBlock("div", _hoisted_12, "任务加载中…")) : !selectedView.value ? (openBlock(), createElementBlock("div", _hoisted_13, "无法加载视图")) : isKanbanView.value && filteredTasks.value.length === 0 ? (openBlock(), createElementBlock("div", _hoisted_14, "暂无匹配任务")) : !isKanbanView.value && listRows.value.length === 0 ? (openBlock(), createElementBlock("div", _hoisted_15, "暂无匹配任务")) : isKanbanView.value ? (openBlock(), createBlock(WidgetKanbanView, {
            key: 6,
            class: "views-panel__kanban",
            tasks: filteredTasks.value,
            "board-mode": selectedView.value.kanbanBoardMode ?? "group",
            "sort-by": selectedView.value.sortBy,
            "hide-done-scope": viewHideDoneScope.value,
            "updating-ids": updatingIds.value,
            categories: categories.value,
            onToggleDone: toggleDone,
            onOpenTask: openTask
          }, null, 8, ["tasks", "board-mode", "sort-by", "hide-done-scope", "updating-ids", "categories"])) : (openBlock(), createElementBlock("div", _hoisted_16, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(listRows.value, (row) => {
              return openBlock(), createElementBlock("div", {
                key: row.task.id,
                class: "views-panel__task",
                style: normalizeStyle(row.depth > 0 ? { marginLeft: `${row.depth * 14}px` } : void 0)
              }, [
                createBaseVNode("span", {
                  class: "views-panel__logo",
                  style: normalizeStyle(categoryLogoStyle(row.task)),
                  title: categoryName(row.task)
                }, toDisplayString(categoryLogo(row.task)), 13, _hoisted_17),
                createBaseVNode("input", {
                  class: "views-panel__check",
                  type: "checkbox",
                  disabled: updatingIds.value.has(row.task.id),
                  onChange: ($event) => toggleDone(row.task.id)
                }, null, 40, _hoisted_18),
                createBaseVNode("button", {
                  type: "button",
                  class: "views-panel__task-title",
                  onClick: ($event) => openTask(row.task.id)
                }, toDisplayString(row.task.title), 9, _hoisted_19)
              ], 4);
            }), 128))
          ]))
        ], 64))
      ]);
    };
  }
});
const WidgetViewsPanel = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__scopeId", "data-v-27a63461"]]);
const _hoisted_1 = ["title"];
const _hoisted_2 = {
  key: 1,
  class: "widget-app__compact-title"
};
const _hoisted_3 = { class: "widget-app__head" };
const _hoisted_4 = { class: "widget-app__title" };
const _hoisted_5 = { class: "widget-app__head-actions" };
const _hoisted_6 = { class: "widget-app__body" };
const _hoisted_7 = {
  key: 0,
  class: "widget-app__loading"
};
const _hoisted_8 = {
  key: 1,
  class: "widget-app__loading"
};
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "WidgetApp",
  setup(__props) {
    const instance = ref(null);
    const loading = ref(true);
    const instanceId = ref("");
    const peekFromHover = ref(false);
    const displayMode = computed(() => instance.value?.displayMode ?? "expanded");
    const isCompactMode = computed(() => displayMode.value === "edge_tab" || displayMode.value === "mini");
    const title = computed(() => {
      if (!instance.value) return "小柒todo 挂件";
      return widgetInstanceDisplayName(instance.value);
    });
    const edgeAnchorClass = computed(
      () => instance.value?.edgeAnchor ? `widget-app--anchor-${instance.value.edgeAnchor}` : ""
    );
    const isHorizontalEdge = computed(
      () => instance.value?.edgeAnchor === "top" || instance.value?.edgeAnchor === "bottom"
    );
    const kindDotClass = computed(() => {
      const kind = instance.value?.kind;
      if (kind === "matrix") return "is-matrix";
      if (kind === "view") return "is-view";
      return "is-notes";
    });
    const compactHint = computed(
      () => displayMode.value === "edge_tab" ? "悬停临时展开，移开即收起；点击细条或拖动可固定展开" : "点击展开查看内容"
    );
    let hoverExpandTimer = null;
    function resolveInstanceId() {
      const hash = window.location.hash.replace(/^#/, "").trim();
      if (hash) return hash;
      return new URLSearchParams(window.location.search).get("id")?.trim() ?? "";
    }
    function applyInstance(next) {
      instance.value = next;
      if (next.displayMode === "edge_tab" || next.displayMode === "mini" || next.displayMode === "hidden") {
        peekFromHover.value = false;
      }
    }
    async function loadInstance() {
      instanceId.value = resolveInstanceId();
      if (!instanceId.value) {
        loading.value = false;
        return;
      }
      const res = await window.widgetApi.widget.getInstance(instanceId.value);
      loading.value = false;
      if (!res.ok) {
        ElMessage.error(res.error.message);
        return;
      }
      applyInstance(res.data);
    }
    function clearHoverExpandTimer() {
      if (hoverExpandTimer) {
        clearTimeout(hoverExpandTimer);
        hoverExpandTimer = null;
      }
    }
    function onCompactHover() {
      if (!instanceId.value || displayMode.value !== "edge_tab") return;
      clearHoverExpandTimer();
      hoverExpandTimer = setTimeout(() => {
        hoverExpandTimer = null;
        peekFromHover.value = true;
        void window.widgetApi.widget.expand(instanceId.value, { peek: true });
      }, 300);
    }
    function onCompactMouseLeave() {
      clearHoverExpandTimer();
    }
    function onShellClick() {
      if (!instanceId.value) return;
      if (!isCompactMode.value) return;
      clearHoverExpandTimer();
      peekFromHover.value = false;
      void window.widgetApi.widget.expand(instanceId.value);
    }
    async function onCollapseClick() {
      if (!instanceId.value || !instance.value) return;
      peekFromHover.value = false;
      const mode = instance.value.displayMode;
      if (mode === "expanded") {
        await window.widgetApi.widget.collapse(instanceId.value);
        return;
      }
      if (mode === "edge_tab" || mode === "mini") {
        await window.widgetApi.widget.hide(instanceId.value);
      }
    }
    async function openMain() {
      peekFromHover.value = false;
      await window.widgetApi.app.openMain("/");
    }
    let cleanupModeListener;
    onMounted(() => {
      void loadInstance();
      cleanupModeListener = window.widgetApi.widget.onDisplayModeChanged((next) => {
        if (next.id === instanceId.value) {
          applyInstance(next);
        }
      });
    });
    onUnmounted(() => {
      clearHoverExpandTimer();
      cleanupModeListener?.();
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", {
        class: normalizeClass(["widget-app", [
          `widget-app--${displayMode.value}`,
          edgeAnchorClass.value,
          { "is-peek": peekFromHover.value }
        ]]),
        onClick: onShellClick
      }, [
        isCompactMode.value ? (openBlock(), createElementBlock("div", {
          key: 0,
          class: normalizeClass(["widget-app__compact", { "is-horizontal-edge": isHorizontalEdge.value }]),
          title: compactHint.value,
          onMouseenter: onCompactHover,
          onMouseleave: onCompactMouseLeave
        }, [
          createBaseVNode("span", {
            class: normalizeClass(["widget-app__compact-dot", kindDotClass.value])
          }, null, 2),
          displayMode.value === "edge_tab" ? (openBlock(), createElementBlock("span", {
            key: 0,
            class: normalizeClass(isHorizontalEdge.value ? "widget-app__compact-title" : "widget-app__compact-vertical")
          }, toDisplayString(title.value), 3)) : (openBlock(), createElementBlock("span", _hoisted_2, toDisplayString(title.value), 1))
        ], 42, _hoisted_1)) : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
          createBaseVNode("header", _hoisted_3, [
            createBaseVNode("span", _hoisted_4, toDisplayString(title.value), 1),
            createBaseVNode("div", _hoisted_5, [
              createBaseVNode("button", {
                type: "button",
                class: "widget-app__icon-btn",
                title: "打开主窗口",
                onClick: withModifiers(openMain, ["stop"])
              }, "⌂"),
              createBaseVNode("button", {
                type: "button",
                class: "widget-app__icon-btn",
                title: "收起",
                onClick: withModifiers(onCollapseClick, ["stop"])
              }, "−")
            ])
          ]),
          createBaseVNode("div", _hoisted_6, [
            loading.value ? (openBlock(), createElementBlock("div", _hoisted_7, "加载中…")) : !instance.value ? (openBlock(), createElementBlock("div", _hoisted_8, "挂件不存在")) : instance.value.kind === "notes" ? (openBlock(), createBlock(WidgetNotesPanel, { key: 2 })) : instance.value.kind === "matrix" ? (openBlock(), createBlock(WidgetMatrixPanel, { key: 3 })) : (openBlock(), createBlock(WidgetViewsPanel, {
              key: 4,
              "fixed-view-id": instance.value.viewId ?? void 0,
              "instance-id": instance.value.id
            }, null, 8, ["fixed-view-id", "instance-id"]))
          ])
        ], 64))
      ], 2);
    };
  }
});
createApp(_sfc_main).use(element_plus_default).mount("#widget-app");
