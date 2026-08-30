import { d as defineComponent, o as onMounted, a as onUnmounted, r as resolveComponent, b as openBlock, c as createElementBlock, e as createBaseVNode, f as createVNode, w as withCtx, u as unref, p as plus_default, n as normalizeClass, t as toDisplayString, g as createCommentVNode, h as withModifiers, i as ref, D as DEFAULT_TASK_PRIORITY, j as createApp, k as element_plus_default } from "./_plugin-vue_export-helper-D7E7GOLT.js";
import { Q as QuickAddInput, T as TaskPriorityFlagMenu, t as toParseCategories, b as buildQuickCreateTaskDtoFromDraft } from "./TaskPriorityFlagMenu-DX6JCblL.js";
const _hoisted_1 = { class: "quick-capture" };
const _hoisted_2 = { class: "quick-capture__bar" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "QuickCaptureApp",
  setup(__props) {
    const text = ref("");
    const submitting = ref(false);
    const status = ref("");
    const statusError = ref(false);
    const priority = ref(DEFAULT_TASK_PRIORITY);
    const categories = ref([]);
    const inputRef = ref(null);
    let cleanupFocus;
    function focusInput() {
      inputRef.value?.focus();
    }
    async function loadCategories() {
      const res = await window.captureApi.categories.list();
      if (res.ok) {
        categories.value = toParseCategories(res.data);
      }
    }
    async function hideWindow() {
      await window.captureApi.capture.hide();
    }
    function onEscape() {
      text.value = "";
      status.value = "";
      priority.value = DEFAULT_TASK_PRIORITY;
      void hideWindow();
    }
    async function onSubmit() {
      const trimmed = text.value.trim();
      if (!trimmed || submitting.value) return;
      submitting.value = true;
      status.value = "";
      statusError.value = false;
      try {
        await loadCategories();
        const cats = toParseCategories(categories.value);
        const parsedRes = await window.captureApi.parseTaskInput(trimmed, cats);
        if (!parsedRes.ok) {
          status.value = parsedRes.error.message;
          statusError.value = true;
          return;
        }
        const dto = buildQuickCreateTaskDtoFromDraft(parsedRes.data.draft, trimmed, cats, {
          triagedAt: null,
          priority: priority.value
        });
        if (!dto.title.trim()) {
          status.value = "请输入任务内容";
          statusError.value = true;
          return;
        }
        const res = await window.captureApi.tasks.create(dto);
        if (!res.ok) {
          status.value = res.error.message;
          statusError.value = true;
          return;
        }
        text.value = "";
        priority.value = DEFAULT_TASK_PRIORITY;
        const fallbackHint = parsedRes.data.fellBackToLocal && parsedRes.data.draft.warnings[0] ? `（${parsedRes.data.draft.warnings[0]}）` : "";
        status.value = `已保存：${res.data.title}${fallbackHint}`;
        setTimeout(() => {
          void hideWindow();
        }, 180);
      } catch (err) {
        status.value = err instanceof Error ? err.message : "保存失败";
        statusError.value = true;
      } finally {
        submitting.value = false;
      }
    }
    onMounted(async () => {
      await loadCategories();
      cleanupFocus = window.captureApi.capture.onFocusRequest(() => {
        void loadCategories();
        focusInput();
      });
      focusInput();
    });
    onUnmounted(() => {
      cleanupFocus?.();
    });
    return (_ctx, _cache) => {
      const _component_el_icon = resolveComponent("el-icon");
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createBaseVNode("form", {
          class: "quick-capture__shell",
          onSubmit: withModifiers(onSubmit, ["prevent"])
        }, [
          createBaseVNode("div", _hoisted_2, [
            createVNode(_component_el_icon, {
              class: "quick-capture__plus",
              "aria-hidden": "true"
            }, {
              default: withCtx(() => [
                createVNode(unref(plus_default))
              ]),
              _: 1
            }),
            createVNode(QuickAddInput, {
              ref_key: "inputRef",
              ref: inputRef,
              modelValue: text.value,
              "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => text.value = $event),
              categories: categories.value,
              placeholder: "输入任务，回车保存到收件箱…",
              onEnter: onSubmit,
              onEscape
            }, null, 8, ["modelValue", "categories"]),
            createVNode(TaskPriorityFlagMenu, {
              modelValue: priority.value,
              "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => priority.value = $event),
              class: "quick-capture__priority"
            }, null, 8, ["modelValue"])
          ]),
          status.value ? (openBlock(), createElementBlock("p", {
            key: 0,
            class: normalizeClass(["quick-capture__status", { "is-error": statusError.value }])
          }, toDisplayString(status.value), 3)) : createCommentVNode("", true)
        ], 32)
      ]);
    };
  }
});
createApp(_sfc_main).use(element_plus_default).mount("#capture-app");
