"use strict";
const electron = require("electron");
const ipcChannels = require("./chunks/ipc-channels-DscW9b0H.js");
const captureApi = {
  tasks: {
    create: (dto) => electron.ipcRenderer.invoke(ipcChannels.IPC.TASKS_CREATE, dto)
  },
  categories: {
    list: () => electron.ipcRenderer.invoke(ipcChannels.IPC.CATEGORIES_LIST)
  },
  parseTaskInput: (text, categories) => electron.ipcRenderer.invoke(ipcChannels.IPC.APP_PARSE_TASK_INPUT, text, categories),
  capture: {
    hide: () => electron.ipcRenderer.invoke(ipcChannels.IPC.CAPTURE_HIDE),
    onFocusRequest: (callback) => {
      const handler = () => callback();
      electron.ipcRenderer.on(ipcChannels.IPC.CAPTURE_FOCUS, handler);
      return () => electron.ipcRenderer.removeListener(ipcChannels.IPC.CAPTURE_FOCUS, handler);
    }
  }
};
electron.contextBridge.exposeInMainWorld("captureApi", captureApi);
