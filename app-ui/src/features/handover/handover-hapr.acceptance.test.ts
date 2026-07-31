import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourceRoot = resolve(process.cwd(), 'src')

/** HAPR red acceptance inventory: todo cases stay visible until their owning phase lands. */
describe('HAPR Handover and Return acceptance', () => {
  it('keeps the demo reference outside production routing and imports', () => {
    const router = readFileSync(resolve(sourceRoot, 'app/routing/router.tsx'), 'utf8')
    const livePage = readFileSync(resolve(sourceRoot, 'features/handover/handover-page.tsx'), 'utf8')
    const demo = readFileSync(resolve(sourceRoot, 'features/handover/handover-page-demo.tsx'), 'utf8')
    expect(router).not.toContain('handover-page-demo')
    expect(livePage).not.toContain('handover-page-demo')
    expect(demo).toContain('export function HandoverPageDemo()')
    expect(demo).not.toContain('export function HandoverPage()')
  })

})
