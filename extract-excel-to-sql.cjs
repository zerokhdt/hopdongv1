
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelPath = process.env.EXCEL_PATH || './ACE-NHAN-SU.xlsx';
const outputJsPath = './src/data/employees_seed.js';
const outputSqlPath = './supabase_migration.sql';
const outputCsvPath = './employees.csv';

function excelDateToJSDate(excelDate) {
  if (!excelDate || isNaN(excelDate)) return excelDate;
  const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
  return date.toISOString().split('T')[0];
}

try {
  const workbook = XLSX.readFile(excelPath);
  const employees = [];
  const branches = new Set();

  workbook.SheetNames.forEach(sheetName => {
    // Skip redundant or off sheets
    if (sheetName.includes("THÔI VIỆC") || sheetName.includes("TỔNG NHÂN SỰ")) return;

    const worksheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (sheetName === "ACE-DS NHÂN SỰ HỆ THỐNG") {
      let currentDept = "HEAD OFFICE";
      for (let i = 3; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || row.length < 4) continue;
        
        if (row[1]) currentDept = String(row[1]).trim();
        const name = row[3];
        if (!name) continue;

        branches.add(currentDept);
        employees.push({
          id: `EMP_HO_${employees.length}`,
          name: String(name).trim(),
          position: String(row[4] || '').trim(),
          department: currentDept,
          phone: String(row[6] || '').trim(),
          email: String(row[7] || '').trim(),
          startDate: '',
          salary: '',
          cccd: '',
          dob: '',
          address: '',
          nationality: 'Việt Nam'
        });
      }
    } else if (sheetName.startsWith("CN ")) {
      const branchName = sheetName.replace("CN ", "").trim();
      branches.add(branchName);
      
      // Determine header row (usually 2, but some sheets like NGUYỄN ẢNH THỦ might be different)
      let startRow = 3;
      if (rawRows[1] && rawRows[1].includes("STT")) startRow = 2;
      else if (rawRows[0] && rawRows[0].includes("STT")) startRow = 1;

      for (let i = startRow; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || row.length < 3) continue;
        
        const name = row[2];
        if (!name || String(name).toLowerCase().includes("off") || String(name).toLowerCase().includes("lưu cn")) continue; 

        employees.push({
          id: `EMP_${branchName.replace(/\s+/g, '_')}_${i}`,
          title: String(row[1] || '').trim(), 
          name: String(name).trim(),
          position: String(row[3] || '').trim(),
          department: branchName,
          phone: String(row[4] || '').trim(),
          email: String(row[5] || '').trim(),
          startDate: excelDateToJSDate(row[7] || row[6]), 
          probationDate: excelDateToJSDate(row[7]),
          seniority: String(row[8] || '').trim(),
          contractDate: excelDateToJSDate(row[9]),
          renewDate: excelDateToJSDate(row[10]),
          education: String(row[11] || '').trim(),
          major: String(row[12] || '').trim(),
          pedagogyCert: String(row[13] || '').trim(),
          hasInsurance: String(row[14] || '').trim(),
          insuranceAgency: String(row[15] || '').trim(),
          documentStatus: String(row[16] || '').trim(),
          address: '',
          nationality: 'Việt Nam',
          dob: '',
          cccd: ''
        });
      }
    }
  });

  // Generate JS Seed
  const seedData = {
    employees: employees,
    branches: Array.from(branches)
  };
  const jsContent = `export const SEED_DATA = ${JSON.stringify(seedData, null, 2)};`;
  fs.writeFileSync(outputJsPath, jsContent);

  // Generate CSV
  const csvHeaders = ['id', 'name', 'position', 'department', 'email', 'phone', 'startDate', 'seniority', 'education', 'address'];
  const csvRows = employees.map(e => 
    csvHeaders.map(h => `"${(e[h] || '').toString().replace(/"/g, '""')}"`).join(',')
  );
  fs.writeFileSync(outputCsvPath, [csvHeaders.join(','), ...csvRows].join('\n'), 'utf8');

  // Generate SQL
  let sql = `-- Database Migration for Supabase\n\n`;
  
  // Branches Table
  sql += `CREATE TABLE IF NOT EXISTS branches (\n`;
  sql += `  id TEXT PRIMARY KEY,\n`;
  sql += `  name TEXT NOT NULL,\n`;
  sql += `  created_at TIMESTAMPTZ DEFAULT NOW()\n`;
  sql += `);\n\n`;

  Array.from(branches).forEach(b => {
    sql += `INSERT INTO branches (id, name) VALUES ('${b.replace(/'/g, "''")}', '${b.replace(/'/g, "''")}') ON CONFLICT (id) DO NOTHING;\n`;
  });

  // Employees Table
  sql += `\nCREATE TABLE IF NOT EXISTS employees (\n`;
  sql += `  id TEXT PRIMARY KEY,\n`;
  sql += `  title TEXT,\n`;
  sql += `  name TEXT NOT NULL,\n`;
  sql += `  position TEXT,\n`;
  sql += `  department TEXT REFERENCES branches(id),\n`;
  sql += `  email TEXT,\n`;
  sql += `  phone TEXT,\n`;
  sql += `  start_date TEXT,\n`;
  sql += `  probation_date TEXT,\n`;
  sql += `  seniority TEXT,\n`;
  sql += `  contract_date TEXT,\n`;
  sql += `  renew_date TEXT,\n`;
  sql += `  education TEXT,\n`;
  sql += `  major TEXT,\n`;
  sql += `  pedagogy_cert TEXT,\n`;
  sql += `  has_insurance TEXT,\n`;
  sql += `  insurance_agency TEXT,\n`;
  sql += `  document_status TEXT,\n`;
  sql += `  salary TEXT,\n`;
  sql += `  cccd TEXT,\n`;
  sql += `  dob TEXT,\n`;
  sql += `  address TEXT,\n`;
  sql += `  nationality TEXT DEFAULT 'Việt Nam',\n`;
  sql += `  avatar_url TEXT,\n`;
  sql += `  created_at TIMESTAMPTZ DEFAULT NOW()\n`;
  sql += `);\n\n`;

  employees.forEach(emp => {
    sql += `INSERT INTO employees (id, title, name, position, department, email, phone, start_date, probation_date, seniority, contract_date, renew_date, education, major, pedagogy_cert, has_insurance, insurance_agency, document_status, salary, cccd, dob, address, nationality)\n`;
    sql += `VALUES (\n`;
    sql += `  '${emp.id.replace(/'/g, "''")}', \n`;
    sql += `  '${(emp.title || '').replace(/'/g, "''")}', \n`;
    sql += `  '${emp.name.replace(/'/g, "''")}', \n`;
    sql += `  '${emp.position.replace(/'/g, "''")}', \n`;
    sql += `  '${emp.department.replace(/'/g, "''")}', \n`;
    sql += `  '${emp.email.replace(/'/g, "''")}', \n`;
    sql += `  '${emp.phone.replace(/'/g, "''")}', \n`;
    sql += `  '${emp.startDate}', \n`;
    sql += `  '${emp.probationDate}', \n`;
    sql += `  '${emp.seniority}', \n`;
    sql += `  '${emp.contractDate}', \n`;
    sql += `  '${emp.renewDate}', \n`;
    sql += `  '${(emp.education || '').replace(/'/g, "''")}', \n`;
    sql += `  '${(emp.major || '').replace(/'/g, "''")}', \n`;
    sql += `  '${(emp.pedagogyCert || '').replace(/'/g, "''")}', \n`;
    sql += `  '${(emp.hasInsurance || '').replace(/'/g, "''")}', \n`;
    sql += `  '${(emp.insuranceAgency || '').replace(/'/g, "''")}', \n`;
    sql += `  '${(emp.documentStatus || '').replace(/'/g, "''")}', \n`;
    sql += `  '${emp.salary || ''}', \n`;
    sql += `  '${emp.cccd || ''}', \n`;
    sql += `  '${emp.dob || ''}', \n`;
    sql += `  '${emp.address.replace(/'/g, "''")}', \n`;
    sql += `  '${emp.nationality}'\n`;
    sql += `) ON CONFLICT (id) DO UPDATE SET\n`;
    sql += `  name = EXCLUDED.name,\n`;
    sql += `  position = EXCLUDED.position,\n`;
    sql += `  department = EXCLUDED.department,\n`;
    sql += `  seniority = EXCLUDED.seniority;\n\n`;
  });

  fs.writeFileSync(outputSqlPath, sql);

  console.log(`✅ Extracted ${employees.length} employees and ${branches.size} branches.`);
  console.log(`✅ Files generated: ${outputJsPath}, ${outputSqlPath}, ${outputCsvPath}`);

} catch (error) {
  console.error('❌ Error:', error);
}
