import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  process.stderr.write('Missing env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY\n')
  process.exit(1)
}

process.stdout.write(`Using SUPABASE_URL: ${url}\n`)

const supabase = createClient(url, serviceKey)

function printError(prefix, err) {
  if (!err) {
    process.stderr.write(`${prefix}: Unknown error\n`)
    return
  }
  const msg = err?.message ? String(err.message) : String(err)
  process.stderr.write(`${prefix}: ${msg}\n`)
  const cause = err?.cause
  if (cause) {
    const code = cause?.code ? String(cause.code) : ''
    const cmsg = cause?.message ? String(cause.message) : String(cause)
    process.stderr.write(`${prefix} cause: ${code} ${cmsg}\n`)
  }
  if (err?.stack) {
    process.stderr.write(`${prefix} stack: ${String(err.stack).split('\n').slice(0, 6).join('\n')}\n`)
  }
}

const accounts = [
  { username: 'admin', password: '123456', branch: 'HQ', role: 'admin' },
  { username: 'hq', password: '123456', branch: 'HQ', role: 'user' },
  { username: 'xommoi', password: '123456', branch: 'XÓM MỚI', role: 'user' },
  { username: 'thongnhat', password: '123456', branch: 'THỐNG NHẤT', role: 'user' },
  { username: 'lienkhu45', password: '123456', branch: 'LIÊN KHU 4-5', role: 'user' },
  { username: 'goxoai', password: '123456', branch: 'GÒ XOÀI', role: 'user' },
  { username: 'xuanthoithuong', password: '123456', branch: 'XUÂN THỚI THƯỢNG', role: 'user' },
  { username: 'phanvanhon', password: '123456', branch: 'PHAN VĂN HỚN', role: 'user' },
  { username: 'leloi', password: '123456', branch: 'LÊ LỢI', role: 'user' },
  { username: 'levankhuong', password: '123456', branch: 'LÊ VĂN KHƯƠNG', role: 'user' },
  { username: 'ansuong', password: '123456', branch: 'AN SƯƠNG', role: 'user' },
  { username: 'dangthucvinh', password: '123456', branch: 'ĐẶNG THÚC VỊNH', role: 'user' },
  { username: 'hahuygiap', password: '123456', branch: 'HÀ HUY GIÁP', role: 'user' },
  { username: 'tansonnhi', password: '123456', branch: 'TÂN SƠN NHÌ', role: 'user' },
  { username: 'trungmytay', password: '123456', branch: 'TRUNG MỸ TÂY', role: 'user' },
  { username: 'thoian', password: '123456', branch: 'THỚI AN', role: 'user' },
  { username: 'dreamhome', password: '123456', branch: 'DREAM HOME', role: 'user' },
  { username: 'phanthiet', password: '123456', branch: 'PHAN THIẾT', role: 'user' },
  { username: 'nguyenanhthu', password: '123456', branch: 'NGUYỄN ẢNH THỦ', role: 'user' },
]

function toEmail(username) {
  const u = String(username || '').trim().toLowerCase()
  return `${u}@acehrm.local`
}

const branches = Array.from(new Set(accounts.map(a => a.branch))).map(b => ({ id: b, name: b }))
const branchUpsert = await supabase.from('branches').upsert(branches, { onConflict: 'id' })
if (branchUpsert.error) {
  printError('branches upsert failed', branchUpsert.error)
  process.exit(1)
}

for (const a of accounts) {
  const email = toEmail(a.username)
  const created = await supabase.auth.admin.createUser({
    email,
    password: a.password,
    email_confirm: true,
  })

  if (created.error) {
    const msg = String(created.error.message || '')
    if (!/already|exists/i.test(msg)) {
      printError(`createUser failed (${a.username})`, created.error)
      continue
    }
  }

  let userId = created.data?.user?.id
  if (!userId) {
    const got = await supabase.auth.admin.listUsers({ page: 1, perPage: 2000 })
    if (got.error) {
      printError('listUsers failed', got.error)
      process.exit(1)
    }
    const u = (got.data?.users || []).find(x => String(x.email || '').toLowerCase() === email.toLowerCase())
    userId = u?.id
  }

  if (!userId) {
    process.stderr.write(`Cannot resolve user id for ${a.username}\n`)
    continue
  }

  const upsert = await supabase
    .from('user_profiles')
    .upsert({
      user_id: userId,
      username: a.username,
      branch_id: a.branch,
      role: a.role,
    }, { onConflict: 'user_id' })

  if (upsert.error) {
    printError(`profile upsert failed (${a.username})`, upsert.error)
  } else {
    process.stdout.write(`OK ${a.username} -> ${a.branch} (${a.role})\n`)
  }
}
