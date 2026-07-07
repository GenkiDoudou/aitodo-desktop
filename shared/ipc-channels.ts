/** IPC channel 名称常量，Main 与 Preload 必须一致 */

export const IPC = {
  TASKS_LIST: 'tasks:list',
  TASKS_GET: 'tasks:get',
  TASKS_GET_IN_TRASH: 'tasks:getInTrash',
  TASKS_CREATE: 'tasks:create',
  TASKS_UPDATE: 'tasks:update',
  TASKS_DELETE: 'tasks:delete',
  TASKS_RESTORE: 'tasks:restore',
  TASKS_PERMANENT_DELETE: 'tasks:permanentDelete',
  TASKS_EMPTY_TRASH: 'tasks:emptyTrash',
  TASKS_COUNT_TRASH: 'tasks:countTrash',
  TASKS_COUNT_DONE: 'tasks:countDone',
  KANBAN_GROUPS_LIST: 'kanbanGroups:list',
  KANBAN_GROUPS_CREATE: 'kanbanGroups:create',
  KANBAN_GROUPS_UPDATE: 'kanbanGroups:update',
  KANBAN_GROUPS_DELETE: 'kanbanGroups:delete',
  CATEGORIES_LIST: 'categories:list',
  CATEGORIES_CREATE: 'categories:create',
  CATEGORIES_UPDATE: 'categories:update',
  CATEGORIES_DELETE: 'categories:delete',
  APP_GET_DATA_PATH: 'app:getDataPath',
  APP_SET_DATA_PATH: 'app:setDataPath',
  /** 系统文件夹选择器，用于设置数据目录 */
  APP_PICK_DATA_DIR: 'app:pickDataDir',
  APP_EXPORT_USER_CONFIG: 'app:exportUserConfig',
  APP_IMPORT_USER_CONFIG: 'app:importUserConfig',
  APP_GET_VERSION: 'app:getVersion',
  APP_GET_INFO: 'app:getInfo',
  /** Main → Renderer：托盘/菜单触发新建任务（兼容旧版） */
  APP_NEW_TASK: 'app:new-task',
  /** Main → Renderer：快捷键/托盘触发的统一动作 */
  APP_ACTION: 'app:action',
  APP_GET_SHORTCUTS: 'app:getShortcuts',
  APP_SET_SHORTCUTS: 'app:setShortcuts',
  APP_GET_LLM_CONFIG: 'app:getLlmConfig',
  APP_SET_LLM_CONFIG: 'app:setLlmConfig',
  APP_GET_AI_PROMPT: 'app:getAiPrompt',
  APP_SET_AI_PROMPT: 'app:setAiPrompt',
  APP_SHOW_WINDOW: 'app:showWindow',
  /** 系统文件选择器 → 复制到 data/attachments */
  APP_PICK_ATTACHMENT: 'app:pickAttachment',
  /** 将 base64 缓冲区写入 attachments（粘贴图片等） */
  APP_SAVE_ATTACHMENT: 'app:saveAttachment',
  /** 附件 URI → file:// 供预览渲染 */
  APP_RESOLVE_ATTACHMENT_URL: 'app:resolveAttachmentUrl',
  /** 用系统默认程序打开附件 */
  APP_OPEN_ATTACHMENT: 'app:openAttachment',
  /** 附件另存为到用户指定路径 */
  APP_DOWNLOAD_ATTACHMENT: 'app:downloadAttachment',
  /** Main → Renderer：新应用内消息 */
  APP_MESSAGE_PUSH: 'app:message-push',
  MESSAGES_LIST: 'messages:list',
  MESSAGES_COUNT_UNREAD: 'messages:countUnread',
  MESSAGES_MARK_READ: 'messages:markRead',
  MESSAGES_MARK_ALL_READ: 'messages:markAllRead',
  SCHEDULED_SUMMARIES_LIST: 'scheduledSummaries:list',
  SCHEDULED_SUMMARIES_CREATE: 'scheduledSummaries:create',
  SCHEDULED_SUMMARIES_UPDATE: 'scheduledSummaries:update',
  SCHEDULED_SUMMARIES_DELETE: 'scheduledSummaries:delete'
} as const
