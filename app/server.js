import express from 'express'
import http from 'http'
import { Server } from 'socket.io'

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

const rooms = new Map()

app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size })
})

app.get('/room/:code', (req, res) => {
  const room = rooms.get(req.params.code)
  res.json(room || { code: req.params.code, state: null })
})

app.post('/room/:code', (req, res) => {
  const { state } = req.body || {}
  const code = req.params.code
  if (!code || !state) {
    res.status(400).json({ error: 'Missing room code or state' })
    return
  }

  rooms.set(code, state)
  io.to(code).emit('state:update', state)
  res.json({ ok: true, code, state })
})

io.on('connection', (socket) => {
  socket.on('join-room', (code) => {
    if (!code) return
    socket.join(code)
    const state = rooms.get(code)
    if (state) {
      socket.emit('state:update', state)
    }
  })

  socket.on('state:update', (payload) => {
    const { code, state } = payload || {}
    if (!code || !state) return
    rooms.set(code, state)
    socket.to(code).emit('state:update', state)
  })
})

const PORT = process.env.PORT || 3001
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Sync server running on http://0.0.0.0:${PORT}`)
})
