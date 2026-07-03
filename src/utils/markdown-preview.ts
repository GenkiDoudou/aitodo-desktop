export { createTaskMarkdownIt, renderTaskMarkdownHtml } from './task-markdown'

import { createTaskMarkdownIt } from './task-markdown'

/** 兼容旧引用：单例 MarkdownIt 实例 */
export const taskMarkdownIt = createTaskMarkdownIt()
