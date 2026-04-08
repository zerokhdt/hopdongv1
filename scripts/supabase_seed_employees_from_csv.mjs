import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { parseCsv } from '../src/utils/csv.js'

const inputPath = process.argv[2]

if (!inputPath) {
  process.stderr.write('Usage: node scripts/supabase_seed_employees_from_csv.mjs <input.csv>\n')
  process.exit(1)
}

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  process.stderr.write('Missing env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY\n')
  process.exit(1)
}

const inputAbs = path.isAbsolute(inputPath) ? inputPath : path.join(process.cwd(), inputPath)
const supabase = createClient(url, serviceKey)

function normalizeBranch(v) {
  const s = String(v || '').trim()
  if (!s) return ''
  return s.toUpperCase().replace(/\s+/g, ' ')
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const raw = await fs.readFile(inputAbs, 'utf8')
const rows = parseCsv(raw, ',')

if (!rows || rows.length < 2) {
  process.stderr.write('CSV không có dữ liệu\n')
  process.exit(1)
}

const header = rows[0].map(h => String(h || '').trim())
const data = rows.slice(1)

const headerIndex = new Map()
for (let i = 0; i < header.length; i++) {
  if (!headerIndex.has(header[i])) headerIndex.set(header[i], i)
}

const get = (row, name) => {
  const i = headerIndex.get(name)
  if (i === undefined) return ''
  return String(row[i] ?? '').trim()
}

const employees = []
const branchesSet = new Set()

for (const r of data) {
  const row = r.slice()
  while (row.length < header.length) row.push('')

  const id = get(row, 'Mã NV')
  const name = get(row, 'Họ và Tên')
  if (!id || !name) continue

  const deptRaw = get(row, 'Bộ Phận Làm Việc (Chi Nhánh/Phòng Ban Hệ Thống)') || get(row, 'Nơi Làm Việc')
  const department = normalizeBranch(deptRaw)
  if (department) branchesSet.add(department)

  const emp = {
    id,
    name,
    title: get(row, 'Nhóm') || null,
    position: get(row, 'Vị Trí 1') || null,
    department: department || null,
    email: get(row, 'Email') || null,
    phone: get(row, 'Điện Thoại') || null,
    start_date: get(row, 'Ngày Bắt Đầu Làm Việc') || null,
    probation_date: get(row, 'Ngày Thử Việc') || null,
    seniority: get(row, 'Thâm Niên (tính từ ngày làm việc chính thức)') || null,
    contract_date: get(row, 'Ngày Ký Hợp Đồng') || null,
    renew_date: get(row, 'Ngày Tái Ký Hợp Đồng') || null,
    education: get(row, 'Trình Độ Học Vấn (Cao Đẳng, Đại Học)') || null,
    major: get(row, 'Chuyên Ngành') || null,
    pedagogy_cert: get(row, 'Chứng Chỉ NVSP') || null,
    has_insurance: get(row, 'Đóng BHXH') || null,
    insurance_agency: get(row, 'Cơ Quan Tham Gia BHXH') || null,
    document_status: get(row, 'Tình Trạng Hợp Đồng (Còn Hiệu Lực/ Hết Hạn)') || null,
    salary: get(row, 'Lương Căn Bản') || null,
    cccd: get(row, 'Số CCCD') || null,
    dob: get(row, 'Ngày Sinh') || null,
    address: get(row, 'Địa Chỉ Thường Trú') || null,
    nationality: get(row, 'Quốc Tịch') || null,
  }

  employees.push(emp)
}

const branches = Array.from(branchesSet).map(b => ({ id: b, name: b }))
if (branches.length > 0) {
  const up = await supabase.from('branches').upsert(branches, { onConflict: 'id' })
  if (up.error) {
    process.stderr.write(`branches upsert failed: ${up.error.message}\n`)
    process.exit(1)
  }
}

let upserted = 0
for (const part of chunk(employees, 300)) {
  const up = await supabase.from('employees').upsert(part, { onConflict: 'id' })
  if (up.error) {
    process.stderr.write(`employees upsert failed: ${up.error.message}\n`)
    process.exit(1)
  }
  upserted += part.length
}

process.stdout.write(`OK\nBranches: ${branches.length}\nEmployees: ${upserted}\n`)

