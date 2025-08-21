import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import multer from 'multer'
import { exportWorkbook } from './xlsx.js'
import { extractClips } from './ffmpeg.js'
import Database from 'better-sqlite3'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import pino from 'pino'
import pinoHttp from 'pino-http'

const VERSION = process.env.APP_VERSION || '0.1.0'
const app = express()

const logger = pino({ level: process.env.LOG_LEVEL || 'info' })
app.use(pinoHttp({ logger }))
app.use(helmet())

const allowedOrigin = process.env.CORS_ORIGIN || '*'
app.use(cors({ origin: (origin, cb)=> {
  if (allowedOrigin === '*' || !origin || origin === allowedOrigin) return cb(null, true)
  return cb(new Error('Not allowed by CORS'))
}}))
app.use(express.json({ limit:'10mb' }))

const limiter = rateLimit({ windowMs: 60_000, max: 120 })
app.use('/api/', limiter)

// Simple auth placeholder (shared token) if AUTH_TOKEN set
app.use((req,res,next)=> {
  const token = process.env.AUTH_TOKEN
  if (!token) return next()
  if (req.headers['authorization'] === `Bearer ${token}`) return next()
  return res.status(401).json({ error: 'Unauthorized' })
})

const PORT = process.env.PORT || 4000
const DATA_DIR = process.env.DATA_DIR || path.resolve('data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
const DB_FILE = path.join(DATA_DIR, 'events.db')

const db = new Database(DB_FILE)
db.pragma('journal_mode = WAL')
db.exec(`CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  timestamp_s REAL NOT NULL,
  label TEXT NOT NULL,
  note TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)`)

// Migration: add new columns if not present
const cols = db.prepare("PRAGMA table_info(events)").all().map(c=>c.name)
const addCol = (name, def) => { if (!cols.includes(name)) db.exec(`ALTER TABLE events ADD COLUMN ${name} ${def}`) }
addCol('match_id', 'TEXT DEFAULT ""')
addCol('player', 'TEXT DEFAULT ""')
addCol('severity', 'INTEGER DEFAULT 0')

const insertStmt = db.prepare('INSERT INTO events (id, timestamp_s, label, note, match_id, player, severity) VALUES (@id,@timestamp_s,@label,@note,@match_id,@player,@severity)')
const listStmt = db.prepare('SELECT id, timestamp_s, label, note, match_id, player, severity, created_at FROM events ORDER BY timestamp_s')
const deleteStmt = db.prepare('DELETE FROM events WHERE id = ?')

// Dynamic patch builder
function updateEvent(id, fields) {
  const allowed = ['label','note','match_id','player','severity','timestamp_s']
  const sets = []
  const params = { id }
  for (const k of allowed) if (k in fields) { sets.push(`${k}=@${k}`); params[k]=fields[k] }
  if (!sets.length) return
  const sql = `UPDATE events SET ${sets.join(', ')} WHERE id=@id`
  db.prepare(sql).run(params)
}

app.get('/api/health', (req,res)=> {
  const rowCount = db.prepare('SELECT count(*) as c FROM events').get().c
  res.json({status:'ok', version: VERSION, events: rowCount, time: Date.now()})
})
app.get('/api/version', (req,res)=> res.json({ version: VERSION }))

app.get('/api/events', (req,res)=> {
  const { label } = req.query
  let rows = listStmt.all()
  if (label) rows = rows.filter(r=> r.label === label)
  res.json(rows)
})

app.post('/api/events', (req,res)=> {
  const { timestamp_s, label, note, match_id='', player='', severity=0 } = req.body
  if (timestamp_s == null || !label) return res.status(400).json({ error: 'timestamp_s and label required' })
  const evt = { id: Date.now().toString(36)+Math.random().toString(36).slice(2,6), timestamp_s: Number(timestamp_s), label, note: note||'', match_id, player, severity: Number(severity)||0 }
  insertStmt.run(evt)
  res.json(evt)
})

app.patch('/api/events/:id', (req,res)=> {
  updateEvent(req.params.id, req.body || {})
  const row = db.prepare('SELECT id, timestamp_s, label, note, match_id, player, severity, created_at FROM events WHERE id=?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })
  res.json(row)
})

app.delete('/api/events/:id', (req,res)=> {
  deleteStmt.run(req.params.id)
  res.json({ ok: true })
})

app.get('/api/export/xlsx', (req,res)=> {
  const events = listStmt.all()
  const wb = exportWorkbook(events)
  const tmp = path.join(DATA_DIR, `events_${Date.now()}.xlsx`)
  wb.write(tmp)
  res.download(tmp, 'events.xlsx', err => { if (!err) fs.unlink(tmp, ()=>{}) })
})

app.get('/api/export/csv', (req,res)=> {
  const events = listStmt.all()
  const header = 'id,timestamp_s,time_hms,label,note,match_id,player,severity\n'
  const rows = events.map(e=> {
    const hms = new Date(e.timestamp_s*1000).toISOString().substr(11,8)
    const esc = v => '"'+String(v).replace(/"/g,'""')+'"'
    return [e.id, e.timestamp_s, hms, e.label, e.note||'', e.match_id||'', e.player||'', e.severity??0].map(esc).join(',')
  }).join('\n')
  const csv = header + rows + '\n'
  res.setHeader('Content-Type','text/csv')
  res.setHeader('Content-Disposition','attachment; filename="events.csv"')
  res.send(csv)
})

// Video upload (optional local processing)
const upload = multer({ dest: path.join(DATA_DIR, 'uploads') })

app.post('/api/upload', upload.single('video'), (req,res)=> {
  res.json({ file: req.file.filename })
})

app.post('/api/extract', async (req,res)=> {
  const { source, pre=2, post=2 } = req.body
  try {
    const events = listStmt.all()
    const outDir = path.join(DATA_DIR, 'clips', Date.now().toString())
    const clips = await extractClips({ source, events, pre, post, outDir })
    res.json({ outDir, clips })
  } catch (e) {
    logger.error(e)
    res.status(500).json({ error: e.message })
  }
})

app.use((err, req, res, next) => {
  logger.error({ err }, 'Unhandled error')
  res.status(500).json({ error: 'Internal Server Error' })
})

app.listen(PORT, ()=> logger.info(`API listening on :${PORT}`))
