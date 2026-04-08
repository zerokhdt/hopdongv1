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
    query: { path: ['tasks', 'complete'] },
    body: body ? JSON.stringify(body) : '',
  }
}

function ok(data) {
  return Promise.resolve({ data, error: null })
}

function err(message) {
  return Promise.resolve({ data: null, error: { message } })
}

describe('/api/tasks/complete (router)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    globalThis.process.env.SUPABASE_URL = 'http://localhost:54321'
    globalThis.process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  })

  it('completes task, moves to done group, logs, and notifies creator when admin', async () => {
    const sessionRow = { username: 'hr', role: 'admin', branch: 'HQ', expires_at: new Date(Date.now() + 60000).toISOString() }
    const curTaskRow = {
      id: 't1',
      group: 'TRUNG MỸ TÂY',
      status: 'IN_PROGRESS',
      title: 'Test',
      created_by: 'hr',
      data: { id: 't1', group: 'TRUNG MỸ TÂY', status: 'IN_PROGRESS', title: 'Test', requestMeta: { originUsername: 'hr', originRole: 'admin', originBranch: 'HQ' } },
    }
    const updatedTaskRow = {
      ...curTaskRow,
      group: 'TRUNG MỸ TÂY__DONE',
      status: 'DONE',
      data: { ...curTaskRow.data, group: 'TRUNG MỸ TÂY__DONE', status: 'DONE' },
    }

    const tasks = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ok([curTaskRow])),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            limit: vi.fn(() => ok([updatedTaskRow])),
          })),
        })),
      })),
    }

    const appSessions = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ok([sessionRow])),
        })),
      })),
    }

    const transitionLog = { insert: vi.fn(() => ok([])) }
    const notifications = { insert: vi.fn(() => ok([])) }

    createClient.mockReturnValue({
      from: vi.fn((table) => {
        if (table === 'app_sessions') return appSessions
        if (table === 'tasks') return tasks
        if (table === 'task_transition_log') return transitionLog
        if (table === 'app_notifications') return notifications
        throw new Error(`unexpected table ${table}`)
      }),
    })

    const req = makeReq({ token: 'tok', body: { id: 't1' } })
    const res = makeRes()
    await handler(req, res)

    const payload = JSON.parse(res.body)
    expect(res.statusCode).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.task.group).toBe('TRUNG MỸ TÂY__DONE')
    expect(payload.task.status).toBe('DONE')
    expect(notifications.insert).toHaveBeenCalledTimes(1)
  })

  it('rolls back task update if notify insert fails when admin', async () => {
    const sessionRow = { username: 'hr', role: 'admin', branch: 'HQ', expires_at: new Date(Date.now() + 60000).toISOString() }
    const curTaskRow = {
      id: 't1',
      group: 'TRUNG MỸ TÂY',
      status: 'IN_PROGRESS',
      title: 'Test',
      created_by: 'hr',
      data: { id: 't1', group: 'TRUNG MỸ TÂY', status: 'IN_PROGRESS', title: 'Test', requestMeta: { originUsername: 'hr', originRole: 'admin', originBranch: 'HQ' } },
    }
    const updatedTaskRow = {
      ...curTaskRow,
      group: 'TRUNG MỸ TÂY__DONE',
      status: 'DONE',
      data: { ...curTaskRow.data, group: 'TRUNG MỸ TÂY__DONE', status: 'DONE' },
    }

    const updateSpy = vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          limit: vi.fn(() => ok([updatedTaskRow])),
        })),
      })),
    }))
    const rollbackSpy = vi.fn(() => ({
      eq: vi.fn(() => ok([])),
    }))

    const tasks = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ok([curTaskRow])),
        })),
      })),
      update: vi.fn((payload) => {
        if (payload && payload.status === 'DONE') return updateSpy(payload)
        return rollbackSpy(payload)
      }),
    }

    const appSessions = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ok([sessionRow])),
        })),
      })),
    }

    const transitionLog = { insert: vi.fn(() => ok([])) }
    const notifications = { insert: vi.fn(() => err('notify_failed')) }

    createClient.mockReturnValue({
      from: vi.fn((table) => {
        if (table === 'app_sessions') return appSessions
        if (table === 'tasks') return tasks
        if (table === 'task_transition_log') return transitionLog
        if (table === 'app_notifications') return notifications
        throw new Error(`unexpected table ${table}`)
      }),
    })

    const req = makeReq({ token: 'tok', body: { id: 't1' } })
    const res = makeRes()
    await handler(req, res)

    const payload = JSON.parse(res.body)
    expect(res.statusCode).toBe(500)
    expect(payload.ok).toBe(false)
    expect(rollbackSpy).toHaveBeenCalled()
  })
})
