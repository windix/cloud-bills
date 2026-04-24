import { plugin } from 'bun'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { GlobalWindow } from 'happy-dom'

// Manually install happy-dom globals (bunfig environment="happy-dom" is broken in bun 1.3.12)
const win = new GlobalWindow() as any
// Copy all 439 own properties (HTML/SVG elements, DOM APIs, etc.) onto global
for (const key of Object.getOwnPropertyNames(win)) {
  try {
    const val = win[key]
    if (val !== undefined) (global as any)[key] = val
  } catch {}
}
// Ensure window self-reference is correct
;(global as any).window = global

plugin({
  name: 'vue-sfc',
  setup(build) {
    build.onLoad({ filter: /\.vue$/ }, async (args) => {
      const source = await Bun.file(args.path).text()
      const { descriptor, errors } = parse(source, { filename: args.path })

      if (errors.length) {
        throw new Error(errors[0].message)
      }

      const id = Math.random().toString(36).slice(2)

      // Compile script — genDefaultAs makes the SFC export use the alias directly
      const scriptResult = compileScript(descriptor, {
        id,
        genDefaultAs: '__sfc_main__',
      })

      // scriptResult.content already declares `const __sfc_main__ = ...`
      // Do NOT call rewriteDefault — it uses @babel/parser which lacks TS support
      const scriptCode = scriptResult.content

      // Compile template
      let templateCode = ''
      if (descriptor.template) {
        const templateResult = compileTemplate({
          source: descriptor.template.content,
          filename: args.path,
          id,
          scoped: descriptor.styles.some((s) => s.scoped),
          compilerOptions: {
            bindingMetadata: scriptResult.bindings,
          },
        })
        templateCode = templateResult.code
      }

      const output = [
        scriptCode,
        templateCode,
        `__sfc_main__.render = render`,
        `export default __sfc_main__`,
      ].join('\n')

      return {
        contents: output,
        loader: 'ts',
      }
    })
  },
})
