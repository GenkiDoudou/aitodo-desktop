import type { CreateTaskDto, UpdateTaskDto } from './types'

/** IPC 传输前转为 plain object，避免 Vue reactive Proxy 无法结构化克隆 */
export function toPlainCreateTaskDto(dto: CreateTaskDto): CreateTaskDto {
  return JSON.parse(JSON.stringify(dto)) as CreateTaskDto
}

export function toPlainUpdateTaskDto(dto: UpdateTaskDto): UpdateTaskDto {
  return JSON.parse(JSON.stringify(dto)) as UpdateTaskDto
}
