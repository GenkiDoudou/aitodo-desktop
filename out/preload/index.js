"use strict";
const electron = require("electron");
const ipcChannels = require("./chunks/ipc-channels-X9F-XqCd.js");
const api = {
  tasks: {
    list: (filter) => electron.ipcRenderer.invoke(ipcChannels.IPC.TASKS_LIST, filter),
    get: (id) => electron.ipcRenderer.invoke(ipcChannels.IPC.TASKS_GET, id),
    getInTrash: (id) => electron.ipcRenderer.invoke(ipcChannels.IPC.TASKS_GET_IN_TRASH, id),
    create: (dto) => electron.ipcRenderer.invoke(ipcChannels.IPC.TASKS_CREATE, dto),
    update: (id, dto) => electron.ipcRenderer.invoke(ipcChannels.IPC.TASKS_UPDATE, id, dto),
    delete: (id, options) => electron.ipcRenderer.invoke(ipcChannels.IPC.TASKS_DELETE, id, options),
    restore: (id) => electron.ipcRenderer.invoke(ipcChannels.IPC.TASKS_RESTORE, id),
    permanentDelete: (id, options) => electron.ipcRenderer.invoke(ipcChannels.IPC.TASKS_PERMANENT_DELETE, id, options),
    emptyTrash: () => electron.ipcRenderer.invoke(ipcChannels.IPC.TASKS_EMPTY_TRASH),
    countTrash: () => electron.ipcRenderer.invoke(ipcChannels.IPC.TASKS_COUNT_TRASH),
    countDone: () => electron.ipcRenderer.invoke(ipcChannels.IPC.TASKS_COUNT_DONE),
    reorder: (ids) => electron.ipcRenderer.invoke(ipcChannels.IPC.TASKS_REORDER, ids)
  },
  kanbanGroups: {
    list: (scopeKey) => electron.ipcRenderer.invoke(ipcChannels.IPC.KANBAN_GROUPS_LIST, scopeKey),
    create: (dto) => electron.ipcRenderer.invoke(ipcChannels.IPC.KANBAN_GROUPS_CREATE, dto),
    update: (id, dto) => electron.ipcRenderer.invoke(ipcChannels.IPC.KANBAN_GROUPS_UPDATE, id, dto),
    delete: (id) => electron.ipcRenderer.invoke(ipcChannels.IPC.KANBAN_GROUPS_DELETE, id)
  },
  messages: {
    list: (kind, source) => electron.ipcRenderer.invoke(ipcChannels.IPC.MESSAGES_LIST, kind, source),
    countUnread: (kind) => electron.ipcRenderer.invoke(ipcChannels.IPC.MESSAGES_COUNT_UNREAD, kind),
    markRead: (id) => electron.ipcRenderer.invoke(ipcChannels.IPC.MESSAGES_MARK_READ, id),
    markAllRead: (kind) => electron.ipcRenderer.invoke(ipcChannels.IPC.MESSAGES_MARK_ALL_READ, kind)
  },
  scheduledSummaries: {
    list: () => electron.ipcRenderer.invoke(ipcChannels.IPC.SCHEDULED_SUMMARIES_LIST),
    create: (dto) => electron.ipcRenderer.invoke(ipcChannels.IPC.SCHEDULED_SUMMARIES_CREATE, dto),
    update: (id, dto) => electron.ipcRenderer.invoke(ipcChannels.IPC.SCHEDULED_SUMMARIES_UPDATE, id, dto),
    delete: (id) => electron.ipcRenderer.invoke(ipcChannels.IPC.SCHEDULED_SUMMARIES_DELETE, id),
    preview: (dto) => electron.ipcRenderer.invoke(ipcChannels.IPC.SCHEDULED_SUMMARIES_PREVIEW, dto),
    runNow: (id) => electron.ipcRenderer.invoke(ipcChannels.IPC.SCHEDULED_SUMMARIES_RUN_NOW, id)
  },
  holidays: {
    calendarMarks: (years) => electron.ipcRenderer.invoke(ipcChannels.IPC.HOLIDAYS_CALENDAR_MARKS, years),
    status: () => electron.ipcRenderer.invoke(ipcChannels.IPC.HOLIDAYS_STATUS),
    refresh: (years) => electron.ipcRenderer.invoke(ipcChannels.IPC.HOLIDAYS_REFRESH, years)
  },
  taskViews: {
    list: () => electron.ipcRenderer.invoke(ipcChannels.IPC.TASK_VIEWS_LIST),
    create: (dto) => electron.ipcRenderer.invoke(ipcChannels.IPC.TASK_VIEWS_CREATE, dto),
    update: (id, dto) => electron.ipcRenderer.invoke(ipcChannels.IPC.TASK_VIEWS_UPDATE, id, dto),
    delete: (id) => electron.ipcRenderer.invoke(ipcChannels.IPC.TASK_VIEWS_DELETE, id),
    previewCount: (rule) => electron.ipcRenderer.invoke(ipcChannels.IPC.TASK_VIEWS_PREVIEW_COUNT, rule),
    createFromTemplate: (templateId) => electron.ipcRenderer.invoke(ipcChannels.IPC.TASK_VIEWS_CREATE_FROM_TEMPLATE, templateId)
  },
  taskActivities: {
    listByTask: (taskId, limit, before) => electron.ipcRenderer.invoke(ipcChannels.IPC.TASK_ACTIVITIES_LIST_BY_TASK, taskId, limit, before),
    count: () => electron.ipcRenderer.invoke(ipcChannels.IPC.TASK_ACTIVITIES_COUNT),
    deleteAll: () => electron.ipcRenderer.invoke(ipcChannels.IPC.TASK_ACTIVITIES_DELETE_ALL),
    purge: () => electron.ipcRenderer.invoke(ipcChannels.IPC.TASK_ACTIVITIES_PURGE),
    deleteTrashed: () => electron.ipcRenderer.invoke(ipcChannels.IPC.TASK_ACTIVITIES_DELETE_TRASHED),
    getRetention: () => electron.ipcRenderer.invoke(ipcChannels.IPC.TASK_ACTIVITY_RETENTION_GET),
    setRetention: (policy) => electron.ipcRenderer.invoke(ipcChannels.IPC.TASK_ACTIVITY_RETENTION_SET, policy)
  },
  categories: {
    list: () => electron.ipcRenderer.invoke(ipcChannels.IPC.CATEGORIES_LIST),
    create: (dto) => electron.ipcRenderer.invoke(ipcChannels.IPC.CATEGORIES_CREATE, dto),
    update: (id, dto) => electron.ipcRenderer.invoke(ipcChannels.IPC.CATEGORIES_UPDATE, id, dto),
    delete: (id) => electron.ipcRenderer.invoke(ipcChannels.IPC.CATEGORIES_DELETE, id),
    reorder: (ids) => electron.ipcRenderer.invoke(ipcChannels.IPC.CATEGORIES_REORDER, ids)
  },
  tags: {
    list: () => electron.ipcRenderer.invoke(ipcChannels.IPC.TAGS_LIST)
  },
  widget: {
    toggle: () => electron.ipcRenderer.invoke(ipcChannels.IPC.WIDGET_TOGGLE),
    show: () => electron.ipcRenderer.invoke(ipcChannels.IPC.WIDGET_SHOW),
    getSettings: () => electron.ipcRenderer.invoke(ipcChannels.IPC.WIDGET_GET_SETTINGS),
    updateSettings: (dto) => electron.ipcRenderer.invoke(ipcChannels.IPC.WIDGET_UPDATE_SETTINGS, dto)
  },
  widgetInstances: {
    list: () => electron.ipcRenderer.invoke(ipcChannels.IPC.WIDGET_INSTANCES_LIST),
    get: (id) => electron.ipcRenderer.invoke(ipcChannels.IPC.WIDGET_INSTANCES_GET, id),
    create: (dto) => electron.ipcRenderer.invoke(ipcChannels.IPC.WIDGET_INSTANCES_CREATE, dto),
    update: (id, dto) => electron.ipcRenderer.invoke(ipcChannels.IPC.WIDGET_INSTANCES_UPDATE, id, dto),
    delete: (id) => electron.ipcRenderer.invoke(ipcChannels.IPC.WIDGET_INSTANCES_DELETE, id),
    show: (id) => electron.ipcRenderer.invoke(ipcChannels.IPC.WIDGET_INSTANCE_SHOW, id),
    hide: (id) => electron.ipcRenderer.invoke(ipcChannels.IPC.WIDGET_INSTANCE_HIDE, id),
    toggle: (id) => electron.ipcRenderer.invoke(ipcChannels.IPC.WIDGET_INSTANCE_TOGGLE, id)
  },
  capture: {
    toggle: () => electron.ipcRenderer.invoke(ipcChannels.IPC.CAPTURE_TOGGLE),
    show: () => electron.ipcRenderer.invoke(ipcChannels.IPC.CAPTURE_SHOW),
    hide: () => electron.ipcRenderer.invoke(ipcChannels.IPC.CAPTURE_HIDE)
  },
  widgetNotes: {
    list: () => electron.ipcRenderer.invoke(ipcChannels.IPC.WIDGET_NOTES_LIST),
    create: (dto) => electron.ipcRenderer.invoke(ipcChannels.IPC.WIDGET_NOTES_CREATE, dto),
    update: (id, dto) => electron.ipcRenderer.invoke(ipcChannels.IPC.WIDGET_NOTES_UPDATE, id, dto),
    delete: (id) => electron.ipcRenderer.invoke(ipcChannels.IPC.WIDGET_NOTES_DELETE, id),
    convertToTask: (id, dto) => electron.ipcRenderer.invoke(ipcChannels.IPC.WIDGET_NOTES_CONVERT_TO_TASK, id, dto)
  },
  app: {
    getDataPath: () => electron.ipcRenderer.invoke(ipcChannels.IPC.APP_GET_DATA_PATH),
    setDataPath: (path) => electron.ipcRenderer.invoke(ipcChannels.IPC.APP_SET_DATA_PATH, path),
    pickDataDir: () => electron.ipcRenderer.invoke(ipcChannels.IPC.APP_PICK_DATA_DIR),
    exportUserConfig: (uiPreferences) => electron.ipcRenderer.invoke(ipcChannels.IPC.APP_EXPORT_USER_CONFIG, uiPreferences),
    importUserConfig: () => electron.ipcRenderer.invoke(ipcChannels.IPC.APP_IMPORT_USER_CONFIG),
    getVersion: () => electron.ipcRenderer.invoke(ipcChannels.IPC.APP_GET_VERSION),
    getInfo: () => electron.ipcRenderer.invoke(ipcChannels.IPC.APP_GET_INFO),
    getShortcuts: () => electron.ipcRenderer.invoke(ipcChannels.IPC.APP_GET_SHORTCUTS),
    setShortcuts: (bindings) => electron.ipcRenderer.invoke(ipcChannels.IPC.APP_SET_SHORTCUTS, bindings),
    getLlmConfig: () => electron.ipcRenderer.invoke(ipcChannels.IPC.APP_GET_LLM_CONFIG),
    setLlmConfig: (config) => electron.ipcRenderer.invoke(ipcChannels.IPC.APP_SET_LLM_CONFIG, config),
    getAiPrompt: () => electron.ipcRenderer.invoke(ipcChannels.IPC.APP_GET_AI_PROMPT),
    setAiPrompt: (config) => electron.ipcRenderer.invoke(ipcChannels.IPC.APP_SET_AI_PROMPT, config),
    parseTaskInput: (text, categories) => electron.ipcRenderer.invoke(ipcChannels.IPC.APP_PARSE_TASK_INPUT, text, categories),
    getCloseBehavior: () => electron.ipcRenderer.invoke(ipcChannels.IPC.APP_GET_CLOSE_BEHAVIOR),
    setCloseBehavior: (behavior) => electron.ipcRenderer.invoke(ipcChannels.IPC.APP_SET_CLOSE_BEHAVIOR, behavior),
    getLaunchAtLogin: () => electron.ipcRenderer.invoke(ipcChannels.IPC.APP_GET_LAUNCH_AT_LOGIN),
    setLaunchAtLogin: (prefs) => electron.ipcRenderer.invoke(ipcChannels.IPC.APP_SET_LAUNCH_AT_LOGIN, prefs),
    confirmClose: (payload) => electron.ipcRenderer.invoke(ipcChannels.IPC.APP_CONFIRM_CLOSE, payload),
    showWindow: () => electron.ipcRenderer.invoke(ipcChannels.IPC.APP_SHOW_WINDOW),
    openMain: (route) => electron.ipcRenderer.invoke(ipcChannels.IPC.APP_OPEN_MAIN, route),
    pickAttachment: () => electron.ipcRenderer.invoke(ipcChannels.IPC.APP_PICK_ATTACHMENT),
    saveAttachment: (dto) => electron.ipcRenderer.invoke(ipcChannels.IPC.APP_SAVE_ATTACHMENT, dto),
    resolveAttachmentUrl: (uri) => electron.ipcRenderer.invoke(ipcChannels.IPC.APP_RESOLVE_ATTACHMENT_URL, uri),
    openAttachment: (uri) => electron.ipcRenderer.invoke(ipcChannels.IPC.APP_OPEN_ATTACHMENT, uri),
    downloadAttachment: (uri, suggestedName) => electron.ipcRenderer.invoke(ipcChannels.IPC.APP_DOWNLOAD_ATTACHMENT, uri, suggestedName),
    onNewTask: (callback) => {
      const listener = () => callback();
      electron.ipcRenderer.on(ipcChannels.IPC.APP_NEW_TASK, listener);
      return () => electron.ipcRenderer.removeListener(ipcChannels.IPC.APP_NEW_TASK, listener);
    },
    onAction: (callback) => {
      const listener = (_event, action) => {
        callback(action);
      };
      electron.ipcRenderer.on(ipcChannels.IPC.APP_ACTION, listener);
      return () => electron.ipcRenderer.removeListener(ipcChannels.IPC.APP_ACTION, listener);
    },
    onCloseRequest: (callback) => {
      const listener = () => callback();
      electron.ipcRenderer.on(ipcChannels.IPC.APP_CLOSE_REQUEST, listener);
      return () => electron.ipcRenderer.removeListener(ipcChannels.IPC.APP_CLOSE_REQUEST, listener);
    },
    onMessagePush: (callback) => {
      const listener = (_event, message) => {
        callback(message);
      };
      electron.ipcRenderer.on(ipcChannels.IPC.APP_MESSAGE_PUSH, listener);
      return () => electron.ipcRenderer.removeListener(ipcChannels.IPC.APP_MESSAGE_PUSH, listener);
    },
    onNavigate: (callback) => {
      const listener = (_event, route) => {
        callback(route);
      };
      electron.ipcRenderer.on(ipcChannels.IPC.APP_NAVIGATE, listener);
      return () => electron.ipcRenderer.removeListener(ipcChannels.IPC.APP_NAVIGATE, listener);
    }
  },
  sync: {
    login: (dto) => electron.ipcRenderer.invoke(ipcChannels.IPC.SYNC_LOGIN, dto),
    register: (dto) => electron.ipcRenderer.invoke(ipcChannels.IPC.SYNC_REGISTER, dto),
    completeLogin: (request) => electron.ipcRenderer.invoke(ipcChannels.IPC.SYNC_COMPLETE_LOGIN, request),
    logout: () => electron.ipcRenderer.invoke(ipcChannels.IPC.SYNC_LOGOUT),
    getStatus: () => electron.ipcRenderer.invoke(ipcChannels.IPC.SYNC_GET_STATUS),
    trigger: () => electron.ipcRenderer.invoke(ipcChannels.IPC.SYNC_TRIGGER),
    setServerUrl: (url) => electron.ipcRenderer.invoke(ipcChannels.IPC.SYNC_SET_SERVER_URL, url),
    setPreferences: (partial) => electron.ipcRenderer.invoke(ipcChannels.IPC.SYNC_SET_PREFERENCES, partial),
    testServerUrl: (url) => electron.ipcRenderer.invoke(ipcChannels.IPC.SYNC_TEST_SERVER_URL, url),
    reportUiPreferences: (prefs) => electron.ipcRenderer.invoke(ipcChannels.IPC.SYNC_REPORT_UI_PREFERENCES, prefs),
    onUiPreferencesApplied: (callback) => {
      const listener = (_event, prefs) => {
        callback(prefs);
      };
      electron.ipcRenderer.on(ipcChannels.IPC.SYNC_UI_PREFERENCES_APPLIED, listener);
      return () => electron.ipcRenderer.removeListener(ipcChannels.IPC.SYNC_UI_PREFERENCES_APPLIED, listener);
    },
    onAuthCompleted: (callback) => {
      const listener = () => {
        callback();
      };
      electron.ipcRenderer.on(ipcChannels.IPC.SYNC_AUTH_COMPLETED, listener);
      return () => electron.ipcRenderer.removeListener(ipcChannels.IPC.SYNC_AUTH_COMPLETED, listener);
    }
  },
  notify: {
    getConfig: () => electron.ipcRenderer.invoke(ipcChannels.IPC.NOTIFY_GET_CONFIG),
    setConfig: (config) => electron.ipcRenderer.invoke(ipcChannels.IPC.NOTIFY_SET_CONFIG, config),
    testIyuu: (token) => electron.ipcRenderer.invoke(ipcChannels.IPC.NOTIFY_TEST_IYUU, token),
    testWebhook: (url, headers) => electron.ipcRenderer.invoke(ipcChannels.IPC.NOTIFY_TEST_WEBHOOK, url, headers),
    listDeliveries: () => electron.ipcRenderer.invoke(ipcChannels.IPC.NOTIFY_LIST_DELIVERIES),
    listPending: () => electron.ipcRenderer.invoke(ipcChannels.IPC.NOTIFY_LIST_PENDING)
  },
  appUpdate: {
    getStatus: () => electron.ipcRenderer.invoke(ipcChannels.IPC.APP_UPDATE_GET_STATUS),
    check: () => electron.ipcRenderer.invoke(ipcChannels.IPC.APP_UPDATE_CHECK),
    quitAndInstall: () => electron.ipcRenderer.invoke(ipcChannels.IPC.APP_UPDATE_QUIT_AND_INSTALL),
    onStatus: (callback) => {
      const listener = (_event, status) => {
        callback(status);
      };
      electron.ipcRenderer.on(ipcChannels.IPC.APP_UPDATE_STATUS, listener);
      return () => electron.ipcRenderer.removeListener(ipcChannels.IPC.APP_UPDATE_STATUS, listener);
    }
  }
};
electron.contextBridge.exposeInMainWorld("api", api);
