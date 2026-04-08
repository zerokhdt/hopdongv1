import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const distDir = path.resolve(rootDir, 'dist')

function loadDotEnv() {
  const candidates = [path.join(rootDir, '.env.local'), path.join(rootDir, '.env')]
  return Promise.allSettled(candidates.map(p => readFile(p, 'utf8'))).then(results => {
    results.forEach(r => {
      if (r.status !== 'fulfilled') return
      r.value.split(/\r?\n/).forEach(line => {
        const t = line.trim()
        if (!t || t.startsWith('#')) return
        const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
        if (!m) return
        const key = m[1]
        let val = m[2] || ''
        val = val.trim()
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1)
        }
        if (!(key in process.env)) process.env[key] = val
      })
    })
  })
}

function vercelRes(res) {
  res.status = (code) => {
    res.statusCode = code
    return res
  }
  res.json = (data) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(data))
    return res
  }
  res.send = (data) => {
    if (typeof data === 'object') return res.json(data)
    res.end(String(data ?? ''))
    return res
  }
  return res
}

async function parseBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.html') return 'text/html; charset=utf-8'
  if (ext === '.js') return 'text/javascript; charset=utf-8'
  if (ext === '.css') return 'text/css; charset=utf-8'
  if (ext === '.json') return 'application/json; charset=utf-8'
  if (ext === '.svg') return 'image/svg+xml'
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.woff') return 'font/woff'
  if (ext === '.woff2') return 'font/woff2'
  return 'application/octet-stream'
}

async function serveStatic(req, res) {
  const url = new URL(req.url || '/', 'http://localhost')
  let pathname = decodeURIComponent(url.pathname)
  if (pathname === '/') pathname = '/index.html'

  const candidate = path.join(distDir, pathname)
  const safe = path.resolve(candidate)
  if (!safe.startsWith(distDir)) {
    res.statusCode = 404
    res.end('Not Found')
    return
  }

  try {
    const st = await stat(safe)
    if (st.isDirectory()) {
      const idx = path.join(safe, 'index.html')
      const buf = await readFile(idx)
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end(buf)
      return
    }
    const buf = await readFile(safe)
    res.setHeader('Content-Type', contentType(safe))
    res.end(buf)
  } catch {
    const fallback = await readFile(path.join(distDir, 'index.html'))
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(fallback)
  }
}

await loadDotEnv()

const port = Number(process.env.PORT || 4173)

const server = http.createServer(async (req, res) => {
  if (!req.url) return serveStatic(req, res)

  if (req.url.startsWith('/api/login')) {
    try {
      const { default: handler } = await import(path.join(rootDir, 'api', 'login.js'))
      req.body = await parseBody(req)
      vercelRes(res)
      await handler(req, res)
    } catch {
      vercelRes(res).status(500).json({ success: false, message: 'Local preview API error' })
    }
    return
  }

  return serveStatic(req, res)
})

server.listen(port, () => {
  process.stdout.write(`Local preview with API: http://localhost:${port}/\n`)
})

