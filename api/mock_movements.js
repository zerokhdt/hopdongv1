import fs from 'fs';
import path from 'path';

// Mock in-memory database stored in a local file so it survives hot reloads
const MOCK_DB_PATH = path.resolve('.mock_movements.json');

function readDb() {
  try {
    if (fs.existsSync(MOCK_DB_PATH)) {
      return JSON.parse(fs.readFileSync(MOCK_DB_PATH, 'utf-8'));
    }
  } catch (e) {}
  return { movements: [] };
}

function writeDb(data) {
  fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(data, null, 2));
}

export default async function mockMovementsHandler(req, res) {
  const urlObj = new URL(req.url, 'http://localhost');
  const route = urlObj.pathname.replace('/api/', ''); // e.g. movements/create
  const db = readDb();
  
  // Extract mock token to determine user/branch
  const token = req.headers.authorization?.replace('Bearer ', '') || '';
  const isBranch = token.includes('branch');
  const currentUser = isBranch ? 'chinhanh1' : 'moon';
  const role = isBranch ? 'user' : 'admin';
  const currentBranch = isBranch ? 'TRUNG MỸ TÂY' : 'HQ';

  const MOCK_MAP = (m) => ({
    id: m.id,
    type: m.type,
    employee_name: m.employee_name,
    employee_id: m.employee_id,
    status: m.status,
    branch: m.branch,
    created_at: m.created_at,
    processed_at: m.processed_at,
    created_by: m.created_by,
    processed_by: m.processed_by,
    decision_note: m.decision_note,
    note: m.note,
    payload: m.payload,
    attachments: m.attachments,
  });

  if (route === 'movements/create') {
    const body = req.body || {};
    const newMovement = {
      id: 'mock-mov-' + Date.now(),
      type: body.type,
      employee_id: body.employeeId || null,
      employee_name: body.employeeName || 'Unknown',
      status: 'PENDING',
      branch: currentBranch,
      created_by: currentUser,
      created_at: new Date().toISOString(),
      payload: body.payload || {},
      attachments: body.attachments || [],
      note: body.note || '',
    };
    db.movements.push(newMovement);
    writeDb(db);
    return res.status(200).json({ ok: true, id: newMovement.id });
  }

  if (route === 'movements/my') {
    const myMovs = db.movements.filter(m => m.created_by === currentUser || m.branch === currentBranch);
    return res.status(200).json({ ok: true, movements: myMovs.map(MOCK_MAP).sort((a,b) => b.created_at.localeCompare(a.created_at)) });
  }

  if (route === 'movements/pending' || route === 'movements/list') {
    let list = db.movements;
    // Admins see all, branches see theirs
    if (role !== 'admin') {
       list = list.filter(m => m.branch === currentBranch);
    }
    const statusFilter = urlObj.searchParams.get('status') || 'ALL';
    // If pending list, only show pending/revision
    if (route === 'movements/pending') {
       list = list.filter(m => m.status === 'PENDING' || m.status === 'REVISION');
    } else if (statusFilter !== 'ALL') {
       list = list.filter(m => m.status === statusFilter);
    }
    return res.status(200).json({ ok: true, movements: list.map(MOCK_MAP).sort((a,b) => b.created_at.localeCompare(a.created_at)) });
  }

  if (route === 'movements/decide') {
    if (role !== 'admin') return res.status(403).json({ ok: false, message: 'Forbidden' });
    const { id, decision, decisionNote } = req.body || {};
    const mov = db.movements.find(m => m.id === id);
    if (!mov) return res.status(404).json({ ok: false, message: 'Not found' });
    
    mov.status = decision === 'APPROVE' ? 'APPROVED' : decision === 'REJECT' ? 'REJECTED' : 'REVISION';
    mov.processed_by = currentUser;
    mov.processed_at = new Date().toISOString();
    mov.decision_note = decisionNote || '';
    
    writeDb(db);
    
    return res.status(200).json({
      ok: true,
      updatedEmployee: {
         id: mov.employee_id || 'TEMP-' + Date.now(),
         name: mov.employee_name,
         department: mov.branch,
         position: mov.payload?.position || mov.payload?.newRole || 'Unknown',
         raw_status: decision === 'APPROVE' ? 'ACTIVE' : 'PENDING'
      }
    });
  }

  return res.status(404).json({ ok: false, message: 'Mock Not Found' });
}
