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
  /** Main → Renderer：托盘/菜单触发新建任务 */
  APP_NEW_TASK: 'app:new-task'
} as const
