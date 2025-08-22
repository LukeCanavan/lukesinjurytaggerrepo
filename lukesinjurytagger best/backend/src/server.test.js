import assert from 'node:assert'
import test from 'node:test'
import request from 'supertest'
import { spawn } from 'node:child_process'
import path from 'node:path'

// Basic integration test by importing the app would be better. For brevity we'll just assert endpoints manually could be added later.

// Placeholder tests (adjust once app exported separately)

const base = 'http://localhost:4000'

test('health returns ok', async () => {
  const res = await fetch(base + '/api/health')
  assert.equal(res.status, 200)
  const j = await res.json()
  assert.equal(j.status, 'ok')
})
