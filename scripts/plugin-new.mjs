#!/usr/bin/env node
/**
 * 新插件脚手架：把 templates/plugin 复制为 packages/dsh-<name>，做令牌替换。
 *
 * 用法：
 *   node scripts/plugin-new.mjs <name> [--description "一句话说明"]
 *
 * 令牌：
 *   {{NAME}}        短名，如 hello（目录 packages/dsh-hello）
 *   {{PKG}}         完整包名，如 @hundun/dsh-hello
 *   {{ID}}          补丁行 id，如 hundun-hello
 *   {{DESCRIPTION}} 包描述
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolvePath(SCRIPT_DIR, '..')
const TEMPLATE_DIR = join(REPO_ROOT, 'templates', 'plugin')
const SCOPE = 'hundun'

/** 极简参数解析：位置参数 <name>，可选 --description "..." 或 --description=... */
function parseArgs(argv) {
  const args = { name: null, description: '' }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--description') {
      args.description = argv[i + 1] ?? ''
      i++
    } else if (arg.startsWith('--description=')) {
      args.description = arg.slice('--description='.length)
    } else if (!arg.startsWith('--') && args.name === null) {
      args.name = arg
    } else {
      console.error(`[plugin-new] 无法识别的参数：${arg}`)
      process.exit(1)
    }
  }
  return args
}

/** 递归收集文件清单。 */
function collectFiles(dir, base = '') {
  const files = []
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry)
    const rel = base ? `${base}/${entry}` : entry
    if (statSync(full).isDirectory()) files.push(...collectFiles(full, rel))
    else files.push({ rel, full })
  }
  return files
}

const args = parseArgs(process.argv.slice(2))
if (args.name === null || !/^[a-z][a-z0-9-]*$/.test(args.name)) {
  console.error('[plugin-new] 用法：node scripts/plugin-new.mjs <name> [--description "一句话说明"]')
  console.error('          <name> 须为小写字母开头的 kebab-case（如 my-feature）')
  process.exit(1)
}

const pkgDir = join(REPO_ROOT, 'packages', `dsh-${args.name}`)
if (existsSync(pkgDir)) {
  console.error(`[plugin-new] 目标已存在：${relative(REPO_ROOT, pkgDir)}`)
  process.exit(1)
}
if (!existsSync(TEMPLATE_DIR)) {
  console.error(`[plugin-new] 模板目录不存在：${relative(REPO_ROOT, TEMPLATE_DIR)}`)
  process.exit(1)
}

const tokens = {
  '{{NAME}}': args.name,
  '{{PKG}}': `@${SCOPE}/dsh-${args.name}`,
  '{{ID}}': `${SCOPE}-${args.name}`,
  '{{DESCRIPTION}}': args.description,
}

/** 令牌替换：tpl 文件名同样替换（去掉 .tpl 后缀）。 */
function substitute(text) {
  return text.replace(/\{\{[A-Z]+\}\}/g, (match) => tokens[match] ?? match)
}

const files = collectFiles(TEMPLATE_DIR)
for (const { rel, full } of files) {
  const outRel = substitute(rel.endsWith('.tpl') ? rel.slice(0, -'.tpl'.length) : rel)
  const outPath = join(pkgDir, outRel)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, substitute(readFileSync(full, 'utf8')))
  console.log(`[plugin-new] 生成 ${relative(REPO_ROOT, outPath)}`)
}

console.log('')
console.log(`[plugin-new] 完成：${relative(REPO_ROOT, pkgDir)}`)
console.log('接下来：')
console.log('  pnpm install                 # 链接新 workspace 包')
console.log('  node scripts/aggregate.mjs   # 把新插件并入聚合包 dsh-all')
console.log('  pnpm -r build                # 验证构建')
