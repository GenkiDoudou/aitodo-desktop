/** IPC channel 名称常量，Main 与 Preload 必须一致 */

export const IPC = {
  TASKS_LIST: 'tasks:list',
  TASKS_GET: 'tasks:get',
  TASKS_CREATE: 'tasks:create',
  TASKS_UPDATE: 'tasks:update',
  TASKS_DELETE: 'tasks:delete',
  CATEGORIES_LIST: 'categories:list',
  CATEGORIES_CREATE: 'categories:create',
  CATEGORIES_UPDATE: 'categories:update',
  CATEGORIES_DELETE: 'categories:delete',
  APP_GET_DATA_PATH: 'app:getDataPath',
  APP_SET_DATA_PATH: 'app:setDataPath',
  APP_GET_VERSION: 'app:getVersion',
  APP_GET_INFO: 'app:getInfo',
  /** Main → Renderer：托盘/菜单触发新建任务（兼容旧版） */
  APP_NEW_TASK: 'app:new-task',
  /** Main → Renderer：快捷键/托盘触发的统一动作 */
  APP_ACTION: 'app:action',
  APP_GET_SHORTCUTS: 'app:getShortcuts',
  APP_SET_SHORTCUTS: 'app:setShortcuts',
  APP_SHOW_WINDOW: 'app:showWindow'
} as const
