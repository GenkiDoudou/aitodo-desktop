const http = require('http')
const WebSocket = require('ws')

http.get('http://127.0.0.1:9229/json', (res) => {
  let d = ''
  res.on('data', (c) => (d += c))
  res.on('end', () => {
    const pages = JSON.parse(d)
    if (!pages[0]) {
      console.log('NO_PAGE')
      process.exit(1)
    }
    console.log('URL', pages[0].url)
    const ws = new WebSocket(pages[0].webSocketDebuggerUrl)
    let id = 1
    const pending = new Map()
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const i = id++
        const t = setTimeout(() => reject(new Error('timeout ' + method)), 8000)
        pending.set(i, { resolve, reject, t })
        ws.send(JSON.stringify({ id: i, method, params }))
      })
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString())
      if (
        msg.method === 'Runtime.consoleAPICalled' ||
        msg.method === 'Runtime.exceptionThrown' ||
        msg.method === 'Log.entryAdded'
      ) {
        console.log('EVT', msg.method, JSON.stringify(msg.params).slice(0, 1200))
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
        await send('Log.enable')
        await send('Network.enable')
        const ev = await send('Runtime.evaluate', {
          expression: `({
            ready: document.readyState,
            appChild: document.getElementById('app')?.childElementCount ?? -1,
            scripts: [...document.scripts].map(s => s.src),
            hasApi: typeof window.api,
            href: location.href
          })`,
          returnByValue: true
        })
        console.log('PAGE', JSON.stringify(ev.result, null, 2))
        const res = await send('Runtime.evaluate', {
          expression: `JSON.stringify(performance.getEntriesByType('resource').map(e => ({
            name: e.name.replace(/^.*\\/out\\/renderer\\//, ''),
            type: e.initiatorType,
            size: e.transferSize,
            dur: Math.round(e.duration)
          })))`,
          returnByValue: true
        })
        console.log('RESOURCES', res.result?.result?.value)
      } catch (e) {
        console.error('FAIL', e)
      }
      setTimeout(() => process.exit(0), 500)
    })
  })
}).on('error', (e) => {
  console.error('CDP not reachable', e.message)
  process.exit(1)
})
