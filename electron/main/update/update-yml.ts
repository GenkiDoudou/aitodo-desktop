/** 解析 electron-builder / 自研 latest*.yml（version/path/sha512，可选重复 part:） */

export interface UpdateManifest {
  version: string
  path: string
  sha512: string
  /** 有序分卷文件名；空数组表示整包单文件 */
  parts: string[]
}

export function parseUpdateYml(text: string): UpdateManifest {
  const version = matchField(text, 'version')
  const path = matchField(text, 'path')
  const sha512 = matchField(text, 'sha512')
  if (!version || !path || !sha512) {
    throw new Error('更新清单缺少 version / path / sha512')
  }
  const parts: string[] = []
  const partRe = /^part:\s*(.+?)\s*$/gm
  let m: RegExpExecArray | null
  while ((m = partRe.exec(text)) !== null) {
    const name = m[1]?.trim()
    if (name) parts.push(name)
  }
  return {
    version: version.trim(),
    path: path.trim(),
    sha512: sha512.trim(),
    parts
  }
}

function matchField(text: string, key: string): string | null {
  const re = new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm')
  const m = text.match(re)
  return m?.[1] ?? null
}

/** 简单 semver 比较：a > b → 1；相等 → 0；a < b → -1 */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1
    if (pa[i] < pb[i]) return -1
  }
  return 0
}

function parseSemver(v: string): [number, number, number] {
  const cleaned = v.trim().replace(/^v/i, '').split('-')[0] ?? '0.0.0'
  const parts = cleaned.split('.').map((p) => Number.parseInt(p, 10) || 0)
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0]
}
