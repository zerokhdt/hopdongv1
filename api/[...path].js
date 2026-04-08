import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

function json(res, status, data) {
  res.statusCode = status
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

function safeString(v) {
  return String(v ?? '').trim()
}

function normalizeUsername(v) {
  return String(v || '').trim().toLowerCase()
}

function normalizeBranch(v) {
  const s = String(v || '').trim()
  if (!s) return ''
  return s.toUpperCase().replace(/\s+/g, ' ')
}

function getBearerToken(req) {
  const h = req?.headers?.authorization || req?.headers?.Authorization || ''
  const t = String(h || '').trim()
  if (!t) return ''
  const m = t.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : ''
}

async function readJsonBody(req) {
  if (req?.body && typeof req.body === 'object') return req.body
  if (typeof req?.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }

  const chunks = []
  try {
    for await (const chunk of req) chunks.push(chunk)
  } catch {
    return {}
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function getAdminSupabaseOrNull() {
  const url = safeString(process.env.SUPABASE_URL)
  const serviceKey = safeString(process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (!url || !serviceKey) return null
  return { url, serviceKey, supabase: createClient(url, serviceKey, { auth: { persistSession: false } }) }
}

async function requireSession(req, res) {
  const cfg = getAdminSupabaseOrNull()
  if (!cfg) {
    json(res, 500, { ok: false, message: 'Missing env: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY' })
    return null
  }
  const token = getBearerToken(req)
  if (!token) {
    json(res, 401, { ok: false, message: 'Missing Authorization Bearer token' })
    return null
  }

  const sessionRes = await cfg.supabase
    .from('app_sessions')
    .select('username,role,branch,expires_at')
    .eq('token', token)
    .limit(1)

  if (sessionRes.error) {
    json(res, 500, { ok: false, message: `Session lookup failed: ${sessionRes.error.message}` })
    return null
  }
  const session = (sessionRes.data || [])[0]
  if (!session) {
    json(res, 401, { ok: false, message: 'Session expired. Please login again.' })
    return null
  }
  if (session.expires_at && Date.parse(session.expires_at) < Date.now()) {
    json(res, 401, { ok: false, message: 'Session expired. Please login again.' })
    return null
  }

  return { ...cfg, session }
}

function timingSafeEqualHex(aHex, bHex) {
  const a = Buffer.from(aHex, 'hex')
  const b = Buffer.from(bHex, 'hex')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

function scryptHashHex(password, salt) {
  const saltBuf = Buffer.isBuffer(salt) ? salt : Buffer.from(String(salt || ''), 'base64')
  const key = crypto.scryptSync(String(password || ''), saltBuf, 64, { N: 16384, r: 8, p: 1 })
  return key.toString('hex')
}

function verifyPassword(password, stored) {
  const raw = safeString(stored)
  if (!raw) return false
  if (raw.startsWith('scrypt:')) {
    const parts = raw.split(':')
    if (parts.length !== 3) return false
    const saltB64 = parts[1]
    const hashHex = parts[2]
    const computed = scryptHashHex(password, saltB64)
    return timingSafeEqualHex(computed, hashHex)
  }
  // Plaintext fallback removed for security — all accounts must use scrypt hash
  console.warn('[auth] Account has unencrypted password, rejecting for security. Run hash:password script to migrate.')
  return false
}

function readLocalAccounts() {
  const raw = safeString(process.env.APP_ACCOUNTS_JSON)
  try {
    const parsed = JSON.parse(raw || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function upsertSession({ supabaseUrl, serviceRoleKey, token, username, role, branch }) {
  const url = new URL('/rest/v1/app_sessions', supabaseUrl)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const resp = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Profile': 'public',
      'Content-Profile': 'public',
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify([{ token, username, role, branch, expires_at: expiresAt }]),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(text || `session_${resp.status}`)
  }
}

async function fetchFirstAccount({ supabaseUrl, serviceRoleKey, username }) {
  const url = new URL('/rest/v1/accounts', supabaseUrl)
  url.searchParams.set('select', 'username,password_hash,branch,role,active')
  url.searchParams.set('username', `eq.${username}`)
  url.searchParams.set('limit', '1')

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 8000)
  try {
    const resp = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Accept-Profile': 'public',
        'Content-Profile': 'public',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      signal: ctrl.signal,
    })
    const text = await resp.text()
    if (!resp.ok) throw new Error(text || `supabase_${resp.status}`)
    const rows = JSON.parse(text || '[]')
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null
  } finally {
    clearTimeout(t)
  }
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function toDoneGroup(g) {
  const s = safeString(g)
  if (!s) return s
  if (s.endsWith('__DONE')) return s
  return `${s}__DONE`
}

function appendActivity(data, entry) {
  const d = data && typeof data === 'object' ? data : {}
  const current = Array.isArray(d.activityLog) ? d.activityLog : []
  return { ...d, activityLog: [...current, entry] }
}

async function listAdminUsernames(supabase) {
  const out = await supabase
    .from('accounts')
    .select('username,role,active')
    .eq('role', 'admin')
    .limit(200)
  if (out.error) throw new Error(out.error.message)
  return (out.data || [])
    .filter(r => r && r.active !== false)
    .map(r => safeString(r.username))
    .filter(Boolean)
}

function restrictUserUpdate(existing, incoming) {
  const now = new Date().toISOString()
  const next = {
    ...existing,
    status: safeString(incoming?.status) || existing.status,
    progress: typeof incoming?.progress === 'number' ? incoming.progress : existing.progress,
    comments: Array.isArray(incoming?.comments) ? incoming.comments : existing.comments,
    activityLog: Array.isArray(incoming?.activityLog) ? incoming.activityLog : existing.activityLog,
    lastUpdated: now,
  }
  return next
}

function toTaskRow(task, actor, createdByOverride) {
  const data = task || {}
  const id = safeString(data.id)
  const group = safeString(data.group)
  const title = safeString(data.title)
  const status = safeString(data.status)
  const priority = safeString(data.priority)
  const endDate = safeString(data.endDate)
  const now = new Date().toISOString()
  return {
    id,
    group,
    title,
    status,
    priority,
    end_date: endDate || null,
    data: { ...data, lastUpdated: now },
    updated_at: now,
    created_by: createdByOverride || actor || null,
  }
}

function mapEmployeeToDb(e) {
  const id = safeString(e?.id)
  const department = normalizeBranch(e?.department)
  return {
    id,
    title: safeString(e?.title) || null,
    name: safeString(e?.name) || null,
    position: safeString(e?.position) || null,
    department: department || null,
    email: safeString(e?.email) || null,
    phone: safeString(e?.phone) || null,
    start_date: safeString(e?.startDate) || null,
    probation_date: safeString(e?.probationDate) || null,
    seniority: safeString(e?.seniority) || null,
    contract_date: safeString(e?.contractDate) || null,
    renew_date: safeString(e?.renewDate) || null,
    education: safeString(e?.education) || null,
    major: safeString(e?.major) || null,
    pedagogy_cert: safeString(e?.pedagogyCert) || null,
    has_insurance: safeString(e?.hasInsurance) || null,
    insurance_agency: safeString(e?.insuranceAgency) || null,
    document_status: safeString(e?.documentStatus) || null,
    salary: safeString(e?.salary) || null,
    salary_base: safeString(e?.salaryBase) || null,
    allowance_housing: safeString(e?.allowanceHousing) || null,
    allowance_travel: safeString(e?.allowanceTravel) || null,
    allowance_phone: safeString(e?.allowancePhone) || null,
    cccd: safeString(e?.cccd) || null,
    cccd_date: safeString(e?.cccd_date) || null,
    cccd_place: safeString(e?.cccd_place) || null,
    dob: safeString(e?.dob) || null,
    address: safeString(e?.address) || null,
    current_address: safeString(e?.currentAddress) || null,
    nationality: safeString(e?.nationality) || null,
    avatar_url: safeString(e?.avatar_url) || null,
    bank_account: safeString(e?.bankAccount) || null,
    bank_name: safeString(e?.bankName) || null,
    tax_code: safeString(e?.taxCode) || null,
    note: safeString(e?.note) || null,
    raw_status: safeString(e?.rawStatus) || null,
  }
}

function mapMovementEmployeePatch(payload = {}) {
  const p = payload && typeof payload === 'object' ? payload : {}
  const out = {}
  const set = (k, v) => {
    const s = safeString(v)
    if (s) out[k] = s
  }

  set('name', p.name || p.employeeName || p.hoTen)
  set('position', p.position || p.newRole)
  set('department', p.department || p.newDepartment)
  set('phone', p.phone)
  set('email', p.email)
  set('salary', p.salary || p.newSalaryText || p.newSalary)
  set('salary_base', p.salaryBase)
  set('allowance_housing', p.housingAllowance)
  set('allowance_travel', p.travelAllowance)
  set('allowance_phone', p.phoneAllowance)
  set('cccd', p.cccd)
  set('cccd_date', p.cccdDate || p.cccd_date)
  set('cccd_place', p.cccdPlace || p.cccd_place)
  set('dob', p.birthDate || p.dob)
  set('address', p.permanentAddress || p.address)
  set('current_address', p.temporaryAddress || p.currentAddress)
  set('nationality', p.nationality)
  set('note', p.note)

  return out
}

async function maybeNotifyWebhook(kind, payload) {
  const url = safeString(process.env.MOVEMENT_WEBHOOK_URL)
  if (!url) return
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, ...payload }),
    })
  } catch (_e) {}
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.end('')
    return
  }
  const parts = Array.isArray(req?.query?.path) ? req.query.path : (req?.query?.path ? [req.query.path] : [])
  const route = parts.map(p => String(p || '').trim()).filter(Boolean).join('/')

  if (!route) return json(res, 404, { ok: false, message: 'Not Found' })

  if (route === 'login') {
    if (req.method !== 'POST') return json(res, 405, { success: false, message: 'Method Not Allowed' })
    const body = await readJsonBody(req)
    const { username, password } = body || {}
    const un = normalizeUsername(username)
    const pw = safeString(password)
    if (!un || !pw) return json(res, 400, { success: false, message: 'Thiếu tài khoản hoặc mật khẩu' })

    const supabaseUrl = safeString(process.env.SUPABASE_URL)
    const serviceRoleKey = safeString(process.env.SUPABASE_SERVICE_ROLE_KEY)
    try {
      if (supabaseUrl && serviceRoleKey) {
        const row = await fetchFirstAccount({ supabaseUrl, serviceRoleKey, username: un })
        if (!row) return json(res, 401, { success: false, message: 'Sai tài khoản hoặc mật khẩu!' })
        if (row.active === false) return json(res, 403, { success: false, message: 'Tài khoản đã bị khóa' })
        const ok = verifyPassword(pw, row.password_hash)
        if (!ok) return json(res, 401, { success: false, message: 'Sai tài khoản hoặc mật khẩu!' })
        const token = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : String(Date.now())
        await upsertSession({ supabaseUrl, serviceRoleKey, token, username: un, role: row.role, branch: row.branch })
        return json(res, 200, { success: true, token, branch: row.branch, role: row.role })
      }
      const users = readLocalAccounts()
      if (users.length === 0) {
        return json(res, 500, { success: false, message: 'Chưa cấu hình SUPABASE_* hoặc APP_ACCOUNTS_JSON' })
      }
      const user = users.find(u => normalizeUsername(u?.username) === un && safeString(u?.password) === pw)
      if (!user) return json(res, 401, { success: false, message: 'Sai tài khoản hoặc mật khẩu!' })
      const token = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : String(Date.now())
      return json(res, 200, { success: true, token, branch: user.branch, role: user.role || 'user' })
    } catch (e) {
      const msg = e?.message ? String(e.message) : 'unknown'
      const short = msg.length > 220 ? msg.slice(0, 220) + '…' : msg
      return json(res, 500, { success: false, message: `Lỗi máy chủ đăng nhập (Supabase). ${short}` })
    }
  }

  if (route === 'sync') {
    const SCRIPT_URL = process.env.VITE_SCRIPT_URL
    const SYNC_SECRET = process.env.VITE_SYNC_SECRET || 'moon_map_2026'
    if (!SCRIPT_URL) return json(res, 500, { status: 'error', message: 'Thiếu Script URL' })

    const VI_TO_EN = {
      ID: 'id',
      'Tiêu đề': 'title',
      'Phân loại': 'group',
      'Nhóm': 'assignee',
      'Bắt đầu': 'startDate',
      'Kết thúc': 'endDate',
      'Trạng thái': 'status',
      'Ghi chú': 'comments',
      'Cập nhật lần cuối': 'lastUpdated',
      Tags: 'tags',
      Subtasks: 'subtasks',
      'Hoạt động': 'activityLog',
    }
    const EN_TO_VI = Object.fromEntries(Object.entries(VI_TO_EN).map(([k, v]) => [v, k]))
    const translateTask = (task, mapping) => {
      if (!task) return {}
      const newTask = {}
      for (const key in task) {
        const translatedKey = mapping[key] || key
        let val = task[key]
        if (val === null || val === undefined) val = ''
        newTask[translatedKey] = val
      }
      return newTask
    }

    try {
      let response
      if (req.method === 'POST') {
        const body = await readJsonBody(req)
        const translatedTasks = (body.tasks || []).map(t => translateTask(t, EN_TO_VI))
        response = await fetch(SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ secret: SYNC_SECRET, tasks: translatedTasks }),
        })
      } else if (req.method === 'GET') {
        const separator = SCRIPT_URL.includes('?') ? '&' : '?'
        response = await fetch(`${SCRIPT_URL}${separator}secret=${encodeURIComponent(SYNC_SECRET)}`)
      } else {
        return json(res, 405, { status: 'error', message: 'Method Not Allowed' })
      }

      const text = await response.text()
      try {
        const data = JSON.parse(text)
        if (data.tasks && Array.isArray(data.tasks)) data.tasks = data.tasks.map(t => translateTask(t, VI_TO_EN))
        return json(res, 200, data)
      } catch (_e) {
        return json(res, 500, { status: 'error', message: 'Google API trả về nội dung không đúng định dạng JSON', debug: text.slice(0, 200) })
      }
    } catch (error) {
      return json(res, 500, { status: 'error', message: error.message })
    }
  }

  if (route === 'contract') {
    const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwbOz62rPEq-o2NLGkLArF1z5JsZ2H54YU7vqe3fll-eIy3llxaVe-IR-y8AvWvrnpYzw/exec'
    const SCRIPT_URL = process.env.VITE_CONTRACT_SCRIPT_URL || process.env.VITE_SCRIPT_URL || DEFAULT_SCRIPT_URL
    const SECRET = process.env.VITE_CONTRACT_SECRET || process.env.VITE_SYNC_SECRET || 'moon_map_2026'
    if (!SCRIPT_URL) return json(res, 500, { ok: false, error: 'MISSING_SCRIPT_URL' })
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' })
    try {
      const body = await readJsonBody(req)
      const { templateDocId, outputFolderId, outputName, placeholders, documents, emailTo, emailSubject, emailBody } = body || {}
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ secret: SECRET, templateDocId, outputFolderId, outputName, placeholders, documents, emailTo, emailSubject, emailBody }),
      })
      const text = await response.text()
      let data
      try {
        data = JSON.parse(text)
      } catch (_e) {
        return json(res, 500, { ok: false, error: 'INVALID_JSON_FROM_SCRIPT', debug: text.slice(0, 200) })
      }
      return json(res, response.ok ? 200 : 500, data)
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message })
    }
  }

  if (route === 'tasks/list') {
    if (req.method !== 'GET') return json(res, 405, { ok: false, message: 'Method Not Allowed' })
    const ctx = await requireSession(req, res)
    if (!ctx) return
    const role = safeString(ctx.session.role)
    const branch = safeString(ctx.session.branch)
    const branchDone = branch ? `${branch}__DONE` : ''
    let q = ctx.supabase.from('tasks').select('data').order('updated_at', { ascending: false })
    if (role !== 'admin') {
      const allDone = 'ALL__DONE'
      const hqDone = 'HQ__DONE'
      q = q.or(`group.eq.${branch},group.eq.${branchDone},group.eq.ALL,group.eq.${allDone},group.eq.HQ,group.eq.${hqDone}`)
    }
    const out = await q
    if (out.error) return json(res, 500, { ok: false, message: out.error.message })
    const tasks = (out.data || []).map(r => r?.data).filter(Boolean)
    return json(res, 200, { ok: true, tasks })
  }

  if (route === 'tasks/upsert') {
    if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Method Not Allowed' })
    const ctx = await requireSession(req, res)
    if (!ctx) return
    const role = safeString(ctx.session.role)
    const branch = safeString(ctx.session.branch)
    const branchDone = branch ? `${branch}__DONE` : ''
    const actor = safeString(ctx.session.username)
    const body = await readJsonBody(req)
    const tasks = Array.isArray(body?.tasks) ? body.tasks : (body?.task ? [body.task] : [])
    if (tasks.length === 0) return json(res, 400, { ok: false, message: 'Missing task(s)' })

    if (role === 'admin') {
      const ids = tasks.map(t => safeString(t?.id)).filter(Boolean)
      const createdByMap = new Map()
      for (const part of chunk(ids, 600)) {
        const sel = await ctx.supabase.from('tasks').select('id,created_by').in('id', part)
        if (sel.error) return json(res, 500, { ok: false, message: sel.error.message })
        ;(sel.data || []).forEach(r => {
          if (r?.id) createdByMap.set(String(r.id), safeString(r.created_by))
        })
      }
      const rows = tasks
        .map(t => {
          const id = safeString(t?.id)
          const row = toTaskRow(t, actor, createdByMap.get(id) || null)
          return row
        })
        .filter(r => r.id)
      if (rows.length === 0) return json(res, 400, { ok: false, message: 'Invalid task(s)' })
      const up = await ctx.supabase.from('tasks').upsert(rows, { onConflict: 'id' })
      if (up.error) return json(res, 500, { ok: false, message: up.error.message })
      return json(res, 200, { ok: true, count: rows.length })
    }

    let updated = 0
    for (const incoming of tasks) {
      const id = safeString(incoming?.id)
      if (!id) continue
      const curRes = await ctx.supabase.from('tasks').select('id,group,data,created_by').eq('id', id).limit(1)
      if (curRes.error) return json(res, 500, { ok: false, message: curRes.error.message })
      const cur = (curRes.data || [])[0]
      if (!cur) continue
      const currentGroup = safeString(cur.group)
      if (currentGroup !== branch && currentGroup !== branchDone) continue

      const now = new Date().toISOString()
      const incomingStatus = safeString(incoming?.status).toUpperCase()
      const curData = cur.data || {}
      const curDoneApproval = curData?.doneApproval || null
      const donePending = safeString(curDoneApproval?.status) === 'PENDING'
      const isInDoneGroup = currentGroup === branchDone
      const isCorrectionOutOfDoneGroup = isInDoneGroup && incomingStatus && incomingStatus !== 'DONE'

      if (isCorrectionOutOfDoneGroup && !donePending) continue
      const nextData = restrictUserUpdate(cur.data || {}, incoming || {})
      let nextGroup = currentGroup

      if (isCorrectionOutOfDoneGroup) {
        nextGroup = branch
        nextData.group = branch
        nextData.status = incomingStatus || 'TODO'
        nextData.doneApproval = {
          ...curDoneApproval,
          status: 'CANCELLED_BY_BRANCH',
          cancelledBy: actor,
          cancelledAt: now,
        }
        nextData.activityLog = [
          ...(Array.isArray(nextData.activityLog) ? nextData.activityLog : []),
          { type: 'branch_correction', from: 'DONE', to: nextData.status, at: now, by: actor },
        ]

        try {
          await ctx.supabase.from('task_transition_log').insert([{
            task_id: id,
            step: 'BRANCH_CORRECTION',
            ok: true,
            from_status: 'DONE',
            to_status: nextData.status,
            from_group: branchDone,
            to_group: branch,
            actor,
            actor_role: role,
            actor_branch: branch,
            meta: { reason: 'branch_mistake_done' },
          }])
        } catch (_e) {}
      }

      const row = {
        id,
        group: nextGroup,
        title: safeString(nextData.title),
        status: safeString(nextData.status),
        priority: safeString(nextData.priority),
        end_date: safeString(nextData.endDate) || null,
        data: nextData,
        updated_at: now,
        created_by: safeString(cur.created_by) || actor || null,
      }
      const up = await ctx.supabase.from('tasks').upsert([row], { onConflict: 'id' })
      if (up.error) return json(res, 500, { ok: false, message: up.error.message })
      updated++
    }
    return json(res, 200, { ok: true, count: updated })
  }


  if (route === 'tasks/delete') {
    if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Method Not Allowed' })
    const ctx = await requireSession(req, res)
    if (!ctx) return
    if (safeString(ctx.session.role) !== 'admin') return json(res, 403, { ok: false, message: 'Forbidden' })
    const body = await readJsonBody(req)
    const id = safeString(body?.id)
    if (!id) return json(res, 400, { ok: false, message: 'Missing id' })
    const del = await ctx.supabase.from('tasks').delete().eq('id', id)
    if (del.error) return json(res, 500, { ok: false, message: del.error.message })
    return json(res, 200, { ok: true })
  }

  if (route === 'tasks/complete') {
    if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Method Not Allowed' })
    const ctx = await requireSession(req, res)
    if (!ctx) return
    const actor = safeString(ctx.session.username)
    const actorRole = safeString(ctx.session.role)
    const actorBranch = safeString(ctx.session.branch)
    const body = await readJsonBody(req)
    const id = safeString(body?.id)
    if (!id) return json(res, 400, { ok: false, message: 'Missing id' })

    const curRes = await ctx.supabase.from('tasks').select('*').eq('id', id).limit(1)
    if (curRes.error) return json(res, 500, { ok: false, message: curRes.error.message })
    const cur = (curRes.data || [])[0]
    if (!cur) return json(res, 404, { ok: false, message: 'Not found' })
    const fromStatus = safeString(cur.status)
    const fromGroup = safeString(cur.group)
    if (actorRole !== 'admin') {
      if (fromGroup !== actorBranch) return json(res, 403, { ok: false, message: 'Forbidden' })
    }
    const toStatus = 'DONE'
    const toGroup = toDoneGroup(fromGroup)
    const now = new Date().toISOString()

    const requestMeta = cur.data?.requestMeta || null
    const targetUsername = safeString(requestMeta?.originUsername) || safeString(cur.created_by)

    const nextData0 = appendActivity(cur.data, {
      type: 'auto_transition',
      fromStatus,
      toStatus,
      fromGroup,
      toGroup,
      at: now,
      actor,
      actorRole,
      origin: safeString(requestMeta?.originRole) || (targetUsername ? 'unknown' : ''),
    })
    const doneApproval = actorRole === 'admin'
      ? { status: 'APPROVED', requestedBy: actor, requestedAt: now, approvedBy: actor, approvedAt: now, fromStatus, fromGroup }
      : { status: 'PENDING', requestedBy: actor, requestedAt: now, fromStatus, fromGroup }
    const nextData = { ...nextData0, status: toStatus, group: toGroup, lastUpdated: now, doneApproval }

    const logStep = async (step, ok, extra = {}) => {
      await ctx.supabase.from('task_transition_log').insert([{
        task_id: id,
        step,
        ok,
        from_status: fromStatus,
        to_status: toStatus,
        from_group: fromGroup,
        to_group: toGroup,
        actor,
        actor_role: actorRole,
        actor_branch: actorBranch,
        error: extra?.error || null,
        meta: extra?.meta || {},
      }])
    }

    try {
      const up = await ctx.supabase
        .from('tasks')
        .update({ status: toStatus, group: toGroup, data: nextData, updated_at: now })
        .eq('id', id)
        .select('*')
        .limit(1)

      if (up.error) {
        await logStep('UPDATE_TASK', false, { error: up.error.message })
        return json(res, 500, { ok: false, message: up.error.message })
      }
      await logStep('UPDATE_TASK', true)

      if (actorRole === 'admin') {
        if (targetUsername) {
          const insN = await ctx.supabase.from('app_notifications').insert([{
            target_username: targetUsername,
            kind: 'TASK_DONE',
            payload: { taskId: id, title: cur.title, fromStatus, toStatus, fromGroup, toGroup, actor, actorRole, originRole: requestMeta?.originRole || null, originBranch: requestMeta?.originBranch || null },
          }])
          if (insN.error) {
            await logStep('NOTIFY', false, { error: insN.error.message })
            const rb = await ctx.supabase.from('tasks').update({ status: fromStatus || null, group: fromGroup, data: cur.data, updated_at: now }).eq('id', id)
            if (rb.error) await logStep('ROLLBACK', false, { error: rb.error.message })
            else await logStep('ROLLBACK', true)
            return json(res, 500, { ok: false, message: insN.error.message })
          }
          await logStep('NOTIFY', true, { meta: { targetUsername, kind: 'TASK_DONE' } })
        }
      } else {
        const admins = await listAdminUsernames(ctx.supabase)
        const rows = admins.map(un => ({
          target_username: un,
          kind: 'TASK_DONE_REQUEST',
          payload: { taskId: id, title: cur.title, fromStatus, toStatus, fromGroup, toGroup, actor, actorRole, originUsername: requestMeta?.originUsername || null, originRole: requestMeta?.originRole || null, originBranch: requestMeta?.originBranch || null },
        }))
        if (rows.length > 0) {
          const insN = await ctx.supabase.from('app_notifications').insert(rows)
          if (insN.error) {
            await logStep('NOTIFY', false, { error: insN.error.message })
            const rb = await ctx.supabase.from('tasks').update({ status: fromStatus || null, group: fromGroup, data: cur.data, updated_at: now }).eq('id', id)
            if (rb.error) await logStep('ROLLBACK', false, { error: rb.error.message })
            else await logStep('ROLLBACK', true)
            return json(res, 500, { ok: false, message: insN.error.message })
          }
          await logStep('NOTIFY', true, { meta: { admins: rows.length, kind: 'TASK_DONE_REQUEST' } })
        }
      }

      const updated = (up.data || [])[0]
      return json(res, 200, { ok: true, task: updated?.data || null })
    } catch (e) {
      try { await logStep('EXCEPTION', false, { error: e?.message || String(e) }) } catch (_e) {}
      return json(res, 500, { ok: false, message: e?.message || String(e) })
    }
  }

  if (route === 'tasks/done-review') {
    if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Method Not Allowed' })
    const ctx = await requireSession(req, res)
    if (!ctx) return
    const actor = safeString(ctx.session.username)
    const actorRole = safeString(ctx.session.role)
    const actorBranch = safeString(ctx.session.branch)
    if (actorRole !== 'admin') return json(res, 403, { ok: false, message: 'Forbidden' })
    const body = await readJsonBody(req)
    const id = safeString(body?.id)
    const decision = safeString(body?.decision).toUpperCase()
    if (!id) return json(res, 400, { ok: false, message: 'Missing id' })
    if (!['APPROVE', 'REJECT'].includes(decision)) return json(res, 400, { ok: false, message: 'Invalid decision' })

    const curRes = await ctx.supabase.from('tasks').select('*').eq('id', id).limit(1)
    if (curRes.error) return json(res, 500, { ok: false, message: curRes.error.message })
    const cur = (curRes.data || [])[0]
    if (!cur) return json(res, 404, { ok: false, message: 'Not found' })

    const now = new Date().toISOString()
    const data = cur.data && typeof cur.data === 'object' ? cur.data : {}
    const reqMeta = data.requestMeta || null
    const doneApproval = data.doneApproval || null
    const fromStatus = safeString(doneApproval?.fromStatus) || safeString(cur.status)
    const fromGroup = safeString(doneApproval?.fromGroup) || safeString(cur.group)
    const toStatus = safeString(cur.status)
    const toGroup = safeString(cur.group)
    const originUsername = safeString(reqMeta?.originUsername) || safeString(cur.created_by)

    const logStep = async (step, ok, extra = {}) => {
      await ctx.supabase.from('task_transition_log').insert([{
        task_id: id,
        step,
        ok,
        from_status: fromStatus,
        to_status: toStatus,
        from_group: fromGroup,
        to_group: toGroup,
        actor,
        actor_role: actorRole,
        actor_branch: actorBranch,
        error: extra?.error || null,
        meta: extra?.meta || {},
      }])
    }

    if (safeString(doneApproval?.status) !== 'PENDING') return json(res, 400, { ok: false, message: 'No pending done approval' })

    if (decision === 'APPROVE') {
      const nextData = {
        ...data,
        doneApproval: { ...doneApproval, status: 'APPROVED', approvedBy: actor, approvedAt: now },
        lastUpdated: now,
      }
      const up = await ctx.supabase.from('tasks').update({ data: nextData, updated_at: now }).eq('id', id).select('*').limit(1)
      if (up.error) {
        await logStep('DONE_REVIEW_APPROVE', false, { error: up.error.message })
        return json(res, 500, { ok: false, message: up.error.message })
      }
      await logStep('DONE_REVIEW_APPROVE', true)
      if (originUsername) {
        const insN = await ctx.supabase.from('app_notifications').insert([{
          target_username: originUsername,
          kind: 'TASK_DONE_APPROVED',
          payload: { taskId: id, title: cur.title, actor, actorRole, group: toGroup },
        }])
        if (insN.error) await logStep('NOTIFY', false, { error: insN.error.message })
        else await logStep('NOTIFY', true, { meta: { targetUsername: originUsername, kind: 'TASK_DONE_APPROVED' } })
      }
      const updated = (up.data || [])[0]
      return json(res, 200, { ok: true, task: updated?.data || null })
    }

    const rollbackStatus = safeString(doneApproval?.fromStatus) || 'IN_PROGRESS'
    const rollbackGroup = safeString(doneApproval?.fromGroup) || fromGroup
    const rollbackData = {
      ...data,
      status: rollbackStatus,
      group: rollbackGroup,
      doneApproval: { ...doneApproval, status: 'REJECTED', rejectedBy: actor, rejectedAt: now },
      lastUpdated: now,
    }
    const up = await ctx.supabase.from('tasks').update({ status: rollbackStatus, group: rollbackGroup, data: rollbackData, updated_at: now }).eq('id', id).select('*').limit(1)
    if (up.error) {
      await logStep('DONE_REVIEW_REJECT', false, { error: up.error.message })
      return json(res, 500, { ok: false, message: up.error.message })
    }
    await logStep('DONE_REVIEW_REJECT', true, { meta: { rollbackStatus, rollbackGroup } })
    if (originUsername) {
      const insN = await ctx.supabase.from('app_notifications').insert([{
        target_username: originUsername,
        kind: 'TASK_DONE_REJECTED',
        payload: { taskId: id, title: cur.title, actor, actorRole, group: rollbackGroup },
      }])
      if (insN.error) await logStep('NOTIFY', false, { error: insN.error.message })
      else await logStep('NOTIFY', true, { meta: { targetUsername: originUsername, kind: 'TASK_DONE_REJECTED' } })
    }
    const updated = (up.data || [])[0]
    return json(res, 200, { ok: true, task: updated?.data || null })
  }

  if (route === 'notifications/poll') {
    if (req.method !== 'GET') return json(res, 405, { ok: false, message: 'Method Not Allowed' })
    const ctx = await requireSession(req, res)
    if (!ctx) return
    const since = safeString(req?.query?.since || '')
    let q = ctx.supabase
      .from('app_notifications')
      .select('id,kind,payload,created_at')
      .eq('target_username', safeString(ctx.session.username))
      .is('delivered_at', null)
      .order('created_at', { ascending: true })
      .limit(50)
    if (since) q = q.gte('created_at', since)
    const out = await q
    if (out.error) return json(res, 500, { ok: false, message: out.error.message })
    return json(res, 200, { ok: true, notifications: out.data || [] })
  }

  if (route === 'notifications/ack') {
    if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Method Not Allowed' })
    const ctx = await requireSession(req, res)
    if (!ctx) return
    const body = await readJsonBody(req)
    const ids = Array.isArray(body?.ids) ? body.ids.map(safeString).filter(Boolean) : []
    if (ids.length === 0) return json(res, 400, { ok: false, message: 'Missing ids' })
    const now = new Date().toISOString()
    const up = await ctx.supabase
      .from('app_notifications')
      .update({ delivered_at: now })
      .in('id', ids)
      .eq('target_username', safeString(ctx.session.username))
    if (up.error) return json(res, 500, { ok: false, message: up.error.message })
    return json(res, 200, { ok: true })
  }

  if (route === 'contracts/issue-log') {
    if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Method Not Allowed' })
    const ctx = await requireSession(req, res)
    if (!ctx) return
    const body = await readJsonBody(req)
    const row = {
      issue_key: safeString(body?.issueKey) || null,
      method: safeString(body?.method) || null,
      so_hd: safeString(body?.soHd) || null,
      employee_id: safeString(body?.employeeId) || null,
      employee_name: safeString(body?.employeeName) || null,
      branch: safeString(body?.branch) || safeString(ctx.session.branch) || null,
      filename: safeString(body?.filename) || null,
      drive_file_id: safeString(body?.driveFileId) || null,
      drive_view_url: safeString(body?.driveViewUrl) || null,
      created_by: safeString(ctx.session.username) || null,
    }
    if (!row.method) return json(res, 400, { ok: false, message: 'Missing method' })
    const ins = await ctx.supabase.from('contract_issue_log').insert([row])
    if (ins.error) return json(res, 500, { ok: false, message: ins.error.message })
    return json(res, 200, { ok: true })
  }

  if (route === 'employees/import') {
    if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Method Not Allowed' })
    const ctx = await requireSession(req, res)
    if (!ctx) return
    if (safeString(ctx.session.role) !== 'admin') return json(res, 403, { ok: false, message: 'Forbidden' })
    const body = await readJsonBody(req)
    const employeesRaw = Array.isArray(body?.employees) ? body.employees : []
    const replaceAll = !!body?.replaceAll
    const overwriteExisting = body?.overwriteExisting !== false
    const employees = employeesRaw.map(mapEmployeeToDb).filter(e => e.id && e.name)
    if (employees.length === 0) return json(res, 400, { ok: false, message: 'No employees to import' })
    const branchesSet = new Set()
    employees.forEach(e => {
      const b = normalizeBranch(e.department)
      if (b) branchesSet.add(b)
    })
    const branches = Array.from(branchesSet).map(b => ({ id: b, name: b }))
    if (branches.length > 0) {
      const up = await ctx.supabase.from('branches').upsert(branches, { onConflict: 'id' })
      if (up.error) return json(res, 500, { ok: false, message: `branches upsert failed: ${up.error.message}` })
    }
    if (replaceAll) {
      const del = await ctx.supabase.from('employees').delete().neq('id', '')
      if (del.error) return json(res, 500, { ok: false, message: `employees delete failed: ${del.error.message}` })
    }
    let toUpsert = employees
    if (!replaceAll && !overwriteExisting) {
      const existingIds = new Set()
      for (const idsChunk of chunk(employees.map(e => e.id), 600)) {
        const sel = await ctx.supabase.from('employees').select('id').in('id', idsChunk)
        if (sel.error) return json(res, 500, { ok: false, message: `employees select failed: ${sel.error.message}` })
        ;(sel.data || []).forEach(r => { if (r?.id) existingIds.add(String(r.id)) })
      }
      toUpsert = employees.filter(e => !existingIds.has(e.id))
      if (toUpsert.length === 0) return json(res, 200, { ok: true, branches: branches.length, employees: 0 })
    }
    let upserted = 0
    for (const part of chunk(toUpsert, 300)) {
      const up = await ctx.supabase.from('employees').upsert(part, { onConflict: 'id' })
      if (up.error) return json(res, 500, { ok: false, message: `employees upsert failed: ${up.error.message}` })
      upserted += part.length
    }
    return json(res, 200, { ok: true, branches: branches.length, employees: upserted })
  }

  if (route === 'employees/import-request') {
    if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Method Not Allowed' })
    const ctx = await requireSession(req, res)
    if (!ctx) return
    if (safeString(ctx.session.role) === 'admin') return json(res, 400, { ok: false, message: 'Admin không cần gửi yêu cầu' })
    const branch = normalizeBranch(ctx.session.branch)
    if (!branch) return json(res, 400, { ok: false, message: 'Thiếu thông tin chi nhánh' })
    const body = await readJsonBody(req)
    const employeesRaw = Array.isArray(body?.employees) ? body.employees : []
    const overwriteExisting = body?.overwriteExisting !== false
    const employees = employeesRaw
      .map(e => ({
        id: safeString(e?.id),
        title: safeString(e?.title) || '',
        name: safeString(e?.name) || '',
        position: safeString(e?.position) || '',
        department: normalizeBranch(e?.department) || branch,
        email: safeString(e?.email) || '',
        phone: safeString(e?.phone) || '',
        startDate: safeString(e?.startDate) || '',
        probationDate: safeString(e?.probationDate) || '',
        contractDate: safeString(e?.contractDate) || '',
        renewDate: safeString(e?.renewDate) || '',
        dob: safeString(e?.dob) || '',
        nationality: safeString(e?.nationality) || '',
        address: safeString(e?.address) || '',
        cccd: safeString(e?.cccd) || '',
        cccd_date: safeString(e?.cccd_date) || '',
        cccd_place: safeString(e?.cccd_place) || '',
        education: safeString(e?.education) || '',
        major: safeString(e?.major) || '',
        pedagogyCert: safeString(e?.pedagogyCert) || '',
        hasInsurance: safeString(e?.hasInsurance) || '',
        insuranceAgency: safeString(e?.insuranceAgency) || '',
        documentStatus: safeString(e?.documentStatus) || '',
        salary: safeString(e?.salary) || '',
        note: safeString(e?.note) || '',
      }))
      .filter(e => e.id && e.name)
    if (employees.length === 0) return json(res, 400, { ok: false, message: 'No employees to request' })
    const wrongBranch = employees.find(e => normalizeBranch(e.department) !== branch)
    if (wrongBranch) return json(res, 400, { ok: false, message: 'Chỉ được gửi dữ liệu thuộc chi nhánh của bạn' })
    const ins = await ctx.supabase.from('employee_import_requests').insert([{
      branch,
      created_by: safeString(ctx.session.username),
      status: 'PENDING',
      overwrite_existing: overwriteExisting,
      employees,
    }]).select('id')
    if (ins.error) return json(res, 500, { ok: false, message: `Request insert failed: ${ins.error.message}` })
    const id = (ins.data || [])[0]?.id
    return json(res, 200, { ok: true, id, employees: employees.length })
  }

  if (route === 'employees/import-requests/list') {
    if (req.method !== 'GET') return json(res, 405, { ok: false, message: 'Method Not Allowed' })
    const ctx = await requireSession(req, res)
    if (!ctx) return
    if (safeString(ctx.session.role) !== 'admin') return json(res, 403, { ok: false, message: 'Forbidden' })
    const status = safeString(req?.query?.status || 'PENDING')
    let q = ctx.supabase.from('employee_import_requests').select('id,branch,created_by,status,overwrite_existing,employees,created_at,processed_by,processed_at,decision_note').order('created_at', { ascending: false })
    if (status && status !== 'ALL') q = q.eq('status', status)
    const out = await q
    if (out.error) return json(res, 500, { ok: false, message: out.error.message })
    return json(res, 200, { ok: true, requests: out.data || [] })
  }

  if (route === 'employees/import-requests/decide') {
    if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Method Not Allowed' })
    const ctx = await requireSession(req, res)
    if (!ctx) return
    if (safeString(ctx.session.role) !== 'admin') return json(res, 403, { ok: false, message: 'Forbidden' })
    const body = await readJsonBody(req)
    const id = safeString(body?.id)
    const decision = safeString(body?.decision).toUpperCase()
    if (!id) return json(res, 400, { ok: false, message: 'Missing id' })
    if (!['APPROVE', 'REJECT'].includes(decision)) return json(res, 400, { ok: false, message: 'Invalid decision' })
    const decisionNote = safeString(body?.decisionNote) || null

    const rowRes = await ctx.supabase.from('employee_import_requests').select('*').eq('id', id).limit(1)
    if (rowRes.error) return json(res, 500, { ok: false, message: rowRes.error.message })
    const reqRow = (rowRes.data || [])[0]
    if (!reqRow) return json(res, 404, { ok: false, message: 'Not found' })

    const now = new Date().toISOString()
    const actor = safeString(ctx.session.username)
    if (decision === 'REJECT') {
      const up = await ctx.supabase.from('employee_import_requests').update({ status: 'REJECTED', processed_by: actor, processed_at: now, decision_note: decisionNote }).eq('id', id)
      if (up.error) return json(res, 500, { ok: false, message: up.error.message })
      return json(res, 200, { ok: true })
    }

    const employees = Array.isArray(reqRow.employees) ? reqRow.employees : []
    const overwriteExisting = reqRow.overwrite_existing !== false
    const mapped = employees.map(mapEmployeeToDb).filter(e => e.id && e.name)
    if (mapped.length > 0) {
      const branchesSet = new Set()
      mapped.forEach(e => { const b = normalizeBranch(e.department); if (b) branchesSet.add(b) })
      const branches = Array.from(branchesSet).map(b => ({ id: b, name: b }))
      if (branches.length > 0) {
        const upB = await ctx.supabase.from('branches').upsert(branches, { onConflict: 'id' })
        if (upB.error) return json(res, 500, { ok: false, message: `branches upsert failed: ${upB.error.message}` })
      }

      let toUpsert = mapped
      if (!overwriteExisting) {
        const existingIds = new Set()
        for (const idsChunk of chunk(mapped.map(e => e.id), 600)) {
          const sel = await ctx.supabase.from('employees').select('id').in('id', idsChunk)
          if (sel.error) return json(res, 500, { ok: false, message: `employees select failed: ${sel.error.message}` })
          ;(sel.data || []).forEach(r => { if (r?.id) existingIds.add(String(r.id)) })
        }
        toUpsert = mapped.filter(e => !existingIds.has(e.id))
      }

      for (const part of chunk(toUpsert, 300)) {
        const upE = await ctx.supabase.from('employees').upsert(part, { onConflict: 'id' })
        if (upE.error) return json(res, 500, { ok: false, message: `employees upsert failed: ${upE.error.message}` })
      }
    }

    const upReq = await ctx.supabase.from('employee_import_requests').update({ status: 'APPROVED', processed_by: actor, processed_at: now, decision_note: decisionNote }).eq('id', id)
    if (upReq.error) return json(res, 500, { ok: false, message: upReq.error.message })
    return json(res, 200, { ok: true })
  }

  if (route === 'movements/create') {
    if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Method Not Allowed' })
    const ctx = await requireSession(req, res)
    if (!ctx) return
    const body = await readJsonBody(req)
    const type = safeString(body?.type).toUpperCase()
    const employeeId = safeString(body?.employeeId) || null
    const employeeName = safeString(body?.employeeName)
    const payload = body?.payload && typeof body.payload === 'object' ? body.payload : {}
    const attachments = Array.isArray(body?.attachments) ? body.attachments : []
    const note = safeString(body?.note) || null
    if (!type) return json(res, 400, { ok: false, message: 'Missing type' })
    if (!employeeName) return json(res, 400, { ok: false, message: 'Missing employeeName' })
    const branch = normalizeBranch(ctx.session.branch)
    if (!branch) return json(res, 400, { ok: false, message: 'Missing branch' })
    const ins = await ctx.supabase.from('personnel_movements').insert([{
      branch,
      created_by: safeString(ctx.session.username),
      type,
      status: 'PENDING',
      employee_id: employeeId,
      employee_name: employeeName,
      payload,
      attachments,
      note,
    }]).select('id')
    if (ins.error) return json(res, 500, { ok: false, message: ins.error.message })
    const id = (ins.data || [])[0]?.id
    const audit = await ctx.supabase.from('personnel_movement_audit').insert([{ movement_id: id, action: 'CREATE', actor: safeString(ctx.session.username), meta: { type, employeeId, employeeName } }])
    if (audit.error) return json(res, 500, { ok: false, message: audit.error.message })
    await maybeNotifyWebhook('MOVEMENT_CREATE', { id, branch, type, employeeId, employeeName, createdBy: safeString(ctx.session.username) })
    return json(res, 200, { ok: true, id })
  }

  if (route === 'movements/my') {
    if (req.method !== 'GET') return json(res, 405, { ok: false, message: 'Method Not Allowed' })
    const ctx = await requireSession(req, res)
    if (!ctx) return
    const status = safeString(req?.query?.status || '')
    const branch = normalizeBranch(ctx.session.branch)
    let q = ctx.supabase.from('personnel_movements')
      .select('id,branch,created_by,type,status,employee_id,employee_name,payload,attachments,note,created_at,processed_by,processed_at,decision_note')
      .order('created_at', { ascending: false })
    if (safeString(ctx.session.role) !== 'admin') q = q.eq('branch', branch)
    if (status && status !== 'ALL') q = q.eq('status', status)
    const out = await q
    if (out.error) return json(res, 500, { ok: false, message: out.error.message })
    return json(res, 200, { ok: true, movements: out.data || [] })
  }

  if (route === 'movements/pending' || route === 'movements/list') {
    if (req.method !== 'GET') return json(res, 405, { ok: false, message: 'Method Not Allowed' })
    const ctx = await requireSession(req, res)
    if (!ctx) return
    if (safeString(ctx.session.role) !== 'admin') return json(res, 403, { ok: false, message: 'Forbidden' })
    const status = safeString(req?.query?.status || (route === 'movements/pending' ? 'PENDING' : 'ALL'))
    const branch = normalizeBranch(req?.query?.branch || '')
    const type = safeString(req?.query?.type || '').toUpperCase()
    let q = ctx.supabase.from('personnel_movements')
      .select('id,branch,created_by,type,status,employee_id,employee_name,payload,attachments,note,created_at,processed_by,processed_at,decision_note')
      .order('created_at', { ascending: false })
    if (status && status !== 'ALL') q = q.eq('status', status)
    if (branch) q = q.eq('branch', branch)
    if (type) q = q.eq('type', type)
    const out = await q
    if (out.error) return json(res, 500, { ok: false, message: out.error.message })
    return json(res, 200, { ok: true, movements: out.data || [] })
  }

  if (route === 'movements/decide') {
    if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Method Not Allowed' })
    const ctx = await requireSession(req, res)
    if (!ctx) return
    if (safeString(ctx.session.role) !== 'admin') return json(res, 403, { ok: false, message: 'Forbidden' })
    const body = await readJsonBody(req)
    const id = safeString(body?.id)
    const decision = safeString(body?.decision).toUpperCase()
    const decisionNote = safeString(body?.decisionNote) || null
    if (!id) return json(res, 400, { ok: false, message: 'Missing id' })
    if (!['APPROVE', 'REJECT', 'REVISION'].includes(decision)) return json(res, 400, { ok: false, message: 'Invalid decision' })

    const rowRes = await ctx.supabase.from('personnel_movements').select('*').eq('id', id).limit(1)
    if (rowRes.error) return json(res, 500, { ok: false, message: rowRes.error.message })
    const movement = (rowRes.data || [])[0]
    if (!movement) return json(res, 404, { ok: false, message: 'Not found' })
    if (safeString(movement.status) !== 'PENDING' && safeString(movement.status) !== 'REVISION') return json(res, 400, { ok: false, message: 'Request already decided' })

    const now = new Date().toISOString()
    const actor = safeString(ctx.session.username)

    if (decision !== 'APPROVE') {
      const nextStatus = decision === 'REJECT' ? 'REJECTED' : 'REVISION'
      const up = await ctx.supabase.from('personnel_movements').update({ status: nextStatus, processed_by: actor, processed_at: now, decision_note: decisionNote }).eq('id', id)
      if (up.error) return json(res, 500, { ok: false, message: up.error.message })
      const audit = await ctx.supabase.from('personnel_movement_audit').insert([{ movement_id: id, action: nextStatus, actor, meta: { decisionNote } }])
      if (audit.error) return json(res, 500, { ok: false, message: audit.error.message })
      await maybeNotifyWebhook('MOVEMENT_DECIDE', { id, decision: nextStatus, branch: movement.branch, type: movement.type, employeeId: movement.employee_id, employeeName: movement.employee_name, processedBy: actor })
      return json(res, 200, { ok: true })
    }

    const type = safeString(movement.type).toUpperCase()
    const branch = normalizeBranch(movement.branch)
    const employeeId = safeString(movement.employee_id || body?.employeeId || '')
    const payload = movement.payload && typeof movement.payload === 'object' ? movement.payload : {}

    let updatedEmployee = null
    if (type === 'LEAVE') {
      const leaveType = safeString(payload.leaveType || payload.type || payload.leave_type) || 'ANNUAL'
      const from = safeString(payload.from)
      const to = safeString(payload.to)
      const days = Number(payload.days || 0) || null
      const reason = safeString(payload.reason) || null
      if (!employeeId) return json(res, 400, { ok: false, message: 'Missing employeeId' })
      if (!from || !to) return json(res, 400, { ok: false, message: 'Missing from/to' })
      const ins = await ctx.supabase.from('employee_leaves').insert([{
        employee_id: employeeId,
        employee_name: safeString(movement.employee_name),
        branch,
        leave_type: leaveType,
        from,
        to,
        days,
        reason,
        created_by: safeString(movement.created_by),
        approved_by: actor,
        approved_at: now,
      }])
      if (ins.error) return json(res, 500, { ok: false, message: ins.error.message })
    } else {
      if (!employeeId && type !== 'ONBOARDING') return json(res, 400, { ok: false, message: 'Missing employeeId' })
      if (type === 'ONBOARDING') {
        const idToUse = employeeId || safeString(payload.employeeId || payload.id || '')
        if (!idToUse) return json(res, 400, { ok: false, message: 'Missing employeeId (Mã NV)' })
        const patch = mapMovementEmployeePatch(payload)
        if (!patch.name) patch.name = safeString(movement.employee_name)
        patch.department = patch.department || branch
        const up = await ctx.supabase.from('employees').upsert([{ id: idToUse, ...patch }], { onConflict: 'id' }).select('*').limit(1)
        if (up.error) return json(res, 500, { ok: false, message: up.error.message })
        updatedEmployee = (up.data || [])[0] || null
      } else {
        const patch = mapMovementEmployeePatch(payload)
        if (Object.keys(patch).length > 0) {
          const up = await ctx.supabase.from('employees').update(patch).eq('id', employeeId).select('*').limit(1)
          if (up.error) return json(res, 500, { ok: false, message: up.error.message })
          updatedEmployee = (up.data || [])[0] || null
        }
      }
    }

    const upMove = await ctx.supabase.from('personnel_movements').update({ status: 'APPROVED', processed_by: actor, processed_at: now, decision_note: decisionNote, employee_id: employeeId || movement.employee_id }).eq('id', id)
    if (upMove.error) return json(res, 500, { ok: false, message: upMove.error.message })
    const audit = await ctx.supabase.from('personnel_movement_audit').insert([{ movement_id: id, action: 'APPROVED', actor, meta: { decisionNote, type } }])
    if (audit.error) return json(res, 500, { ok: false, message: audit.error.message })
    await maybeNotifyWebhook('MOVEMENT_DECIDE', { id, decision: 'APPROVED', branch: movement.branch, type: movement.type, employeeId: employeeId || movement.employee_id, employeeName: movement.employee_name, processedBy: actor })
    return json(res, 200, { ok: true, updatedEmployee })
  }

  return json(res, 404, { ok: false, message: 'Not Found' })
}
