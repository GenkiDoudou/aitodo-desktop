const http = require('http')
const WebSocket = require('ws')

http.get('http://127.0.0.1:9229/json', (res) => {
  let d = ''
  res.on('data', (c) => (d += c))
  res.on('end', () => {
    const pages = JSON.parse(d)
    const ws = new WebSocket(pages[0].webSocketDebuggerUrl)
    let id = 1
    const pending = new Map()
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const i = id++
        const t = setTimeout(() => reject(new Error('timeout ' + method)), 10000)
        pending.set(i, { resolve, reject, t })
        ws.send(JSON.stringify({ id: i, method, params }))
      })
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString())
      if (msg.method === 'Runtime.exceptionThrown') {
        console.log('EXC', JSON.stringify(msg.params).slice(0, 2000))
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        const vals = (msg.params.args || []).map((a) => a.value ?? a.description).join(' ')
        console.log('CON', msg.params.type, vals.slice(0, 500))
      }
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id)
        clearTimeout(p.t)
        p.resolve(msg)
        pending.delete(msg.id)
      }
    })
    ws.on('open', async () => {
      try {
        await send('Runtime.enable')
        const ev = await send('Runtime.evaluate', {
          expression: `(() => {
            const app = document.getElementById('app')
            const styles = [...document.styleSheets].map(s => ({ href: s.href, rules: (()=>{try{return s.cssRules?.length}catch(e){return String(e)}})() }))
            const body = getComputedStyle(document.body)
            const first = app?.firstElementChild
            return {
              appHTML: app?.innerHTML?.slice(0, 800),
              firstClass: first?.className,
              firstTag: first?.tagName,
              bodyBg: body.backgroundColor,
              bodyColor: body.color,
              bodyDisplay: body.display,
              appDisplay: app ? getComputedStyle(app).display : null,
              firstDisplay: first ? getComputedStyle(first).display : null,
              firstH: first ? first.getBoundingClientRect().height : null,
              styles,
              route: location.hash,
              vueExists: !!app?.__vue_app__ || !!(app?.firstElementChild && Object.keys(first).some(k=>k.startsWith('__vue')))
            }
          })()`,
          returnByValue: true
        })
        console.log('DETAIL', JSON.stringify(ev.result, null, 2))
      } catch (e) {
        console.error('FAIL', e)
      }
      setTimeout(() => process.exit(0), 800)
    })
  })
})
