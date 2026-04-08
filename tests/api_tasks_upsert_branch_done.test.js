import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@supabase/supabase-js', () => {
  return { createClient: vi.fn() }
})

import { createClient } from '@supabase/supabase-js'
import handler from '../api/[...path].js'

function makeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(k, v) { this.headers[k] = v },
    end(s) { this.body = String(s || '') },
  }
  return res
}

function makeReq({ token, body } = {}) {
  return {
    method: 'POST',
    headers: { authorization: token ? `Bearer ${token}` : '' },
    query: { path: ['tasks', 'upsert'] },
    body: body ? JSON.stringify(body) : '',
  }
}

function ok(data) {
  return Promise.resolve({ data, error: null })
}

describe('/api/tasks/upsert (branch correction)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    globalThis.process.env.SUPABASE_URL = 'http://localhost:54321'
    globalThis.process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  })

  it('allows branch to revert DONE task (doneApproval PENDING) back to TODO and moves group back', async () => {
    const sessionRow = { username: 'trungmytay', role: 'user', branch: 'TRUNG MỸ TÂY', expires_at: new Date(Date.now() + 60000).toISOString() }
    const curTaskRow = {
      id: 't1',
      group: 'TRUNG MỸ TÂY__DONE',
      created_by: 'hr',
      data: {
        id: 't1',
        group: 'TRUNG MỸ TÂY__DONE',
        status: 'DONE',
        title: 'Test',
        doneApproval: { status: 'PENDING', requestedBy: 'trungmytay', requestedAt: new Date().toISOString(), fromStatus: 'IN_PROGRESS', fromGroup: 'TRUNG MỸ TÂY' },
      },
    }

    const appSessions = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ok([sessionRow])),
        })),
      })),
    }

    const transitionLog = { insert: vi.fn(() => ok([])) }

    const tasks = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ok([curTaskRow])),
        })),
      })),
      upsert: vi.fn(() => ok([])),
    }

    createClient.mockReturnValue({
      from: vi.fn((table) => {
        if (table === 'app_sessions') return appSessions
        if (table === 'tasks') return tasks
        if (table === 'task_transition_log') return transitionLog
        throw new Error(`unexpected table ${table}`)
      }),
    })

    const req = makeReq({ token: 'tok', body: { task: { id: 't1', status: 'TODO' } } })
    const res = makeRes()
    await handler(req, res)

    const payload = JSON.parse(res.body)
    expect(res.statusCode).toBe(200)
    expect(payload.ok).toBe(true)
    expect(tasks.upsert).toHaveBeenCalledTimes(1)

    const upsertArg = tasks.upsert.mock.calls[0][0][0]
    expect(upsertArg.group).toBe('TRUNG MỸ TÂY')
    expect(upsertArg.status).toBe('TODO')
    expect(upsertArg.data.group).toBe('TRUNG MỸ TÂY')
    expect(upsertArg.data.doneApproval.status).toBe('CANCELLED_BY_BRANCH')
    expect(transitionLog.insert).toHaveBeenCalledTimes(1)
  })
})

