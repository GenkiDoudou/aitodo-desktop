const http = require('http')
const WebSocket = require('ws')
const fs = require('fs')

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
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id)
        clearTimeout(p.t)
        p.resolve(msg)
        pending.delete(msg.id)
      }
    })
    ws.on('open', async () => {
      try {
        const overlay = await send('Runtime.evaluate', {
          expression: `({
            overlays: [...document.querySelectorAll('.el-overlay,.el-dialog,.el-loading-mask,.v-modal')].map(el => ({
              cls: el.className,
              display: getComputedStyle(el).display,
              visibility: getComputedStyle(el).visibility,
              z: getComputedStyle(el).zIndex,
              opacity: getComputedStyle(el).opacity,
              rect: el.getBoundingClientRect()
            })),
            homeBg: getComputedStyle(document.querySelector('.home')||document.body).backgroundColor,
            sidebarBg: getComputedStyle(document.querySelector('.sidebar')||document.body).backgroundColor
          })`,
          returnByValue: true
        })
        console.log('OVERLAY', JSON.stringify(overlay.result, null, 2))
        const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true })
        const b64 = shot.result?.data
        if (b64) {
          fs.writeFileSync('dist/_cdp_shot.png', Buffer.from(b64, 'base64'))
          console.log('SHOT_SAVED dist/_cdp_shot.png', Buffer.from(b64, 'base64').length)
        } else {
          console.log('NO_SHOT', JSON.stringify(shot).slice(0, 300))
        }
      } catch (e) {
        console.error('FAIL', e)
      }
      process.exit(0)
    })
  })
})
