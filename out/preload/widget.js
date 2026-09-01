"use strict";
const electron = require("electron");
const ipcChannels = require("./chunks/ipc-channels-X9F-XqCd.js");
const widgetApi = {
  widget: {
    getInstance: (id) => electron.ipcRenderer.invoke(ipcChannels.IPC.WIDGET_INSTANCES_GET, id),
    updateInstance: (id, dto) => electron.ipcRenderer.invoke(ipcChannels.IPC.WIDGET_INSTANCES_UPDATE, id, dto),
    collapse: (id) => electron.ipcRenderer.invoke(ipcChannels.IPC.WIDGET_INSTANCE_COLLAPSE, id),
    expand: (id, options) => electron.ipcRenderer.invoke(ipcChannels.IPC.WIDGET_INSTANCE_EXPAND, id, options),
    hide: (id) => electron.ipcRenderer.invoke(ipcChannels.IPC.WIDGET_INSTANCE_HIDE, id),
    setDisplayMode: (id, mode) => electron.ipcRenderer.invoke(ipcChannels.IPC.WIDGET_INSTANCE_SET_DISPLAY_MODE, id, mode),
    onDisplayModeChanged: (callback) => {
      const listener = (_event, instance) => {
        callback(instance);
      };
      electron.ipcRenderer.on(ipcChannels.IPC.WIDGET_DISPLAY_MODE_CHANGED, listener);
      return () => electron.ipcRenderer.removeListener(ipcChannels.IPC.WIDGET_DISPLAY_MODE_CHANGED, listener);
    }
  },
  widgetNotes: {
    list: () => electron.ipcRenderer.invoke(ipcChannels.IPC.WIDGET_NOTES_LIST),
    create: (dto) => electron.ipcRenderer.invoke(ipcChannels.IPC.WIDGET_NOTES_CREATE, dto),
    update: (id, dto) => electron.ipcRenderer.invoke(ipcChannels.IPC.WIDGET_NOTES_UPDATE, id, dto),
    delete: (id) => electron.ipcRenderer.invoke(ipcChannels.IPC.WIDGET_NOTES_DELETE, id),
    convertToTask: (id, dto) => electron.ipcRenderer.invoke(ipcChannels.IPC.WIDGET_NOTES_CONVERT_TO_TASK, id, dto)
  },
  tasks: {
    list: (filter) => electron.ipcRenderer.invoke(ipcChannels.IPC.TASKS_LIST, filter),
    update: (id, dto) => electron.ipcRenderer.invoke(ipcChannels.IPC.TASKS_UPDATE, id, dto)
  },
  taskViews: {
    list: () => electron.ipcRenderer.invoke(ipcChannels.IPC.TASK_VIEWS_LIST)
  },
  categories: {
    list: () => electron.ipcRenderer.invoke(ipcChannels.IPC.CATEGORIES_LIST)
  },
  kanbanGroups: {
    list: (scopeKey) => electron.ipcRenderer.invoke(ipcChannels.IPC.KANBAN_GROUPS_LIST, scopeKey)
  },
  app: {
    openMain: (route) => electron.ipcRenderer.invoke(ipcChannels.IPC.APP_OPEN_MAIN, route)
  }
};
electron.contextBridge.exposeInMainWorld("widgetApi", widgetApi);
