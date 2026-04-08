import formidable from 'formidable';
import fs from 'fs';
import { Readable } from 'stream';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { getDrive } from '../lib/googleDrive.js';

export const config = {
  api: {
    bodyParser: false
  }
};

// 🔻 remove tiếng Việt
function removeVietnameseTones(str = '') {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

// 🔻 parse form
function parseForm(req) {
  const form = formidable({
    multiples: false,
    maxFileSize: 10 * 1024 * 1024 // ⚠️ giảm để tránh Vercel crash
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

// 🔻 xử lý PDF
async function processPdf(filePath, name = 'UNKNOWN') {
  const bytes = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(bytes);

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const safeName = removeVietnameseTones(name);

  pdfDoc.getPages().forEach((page, index) => {
    const { width } = page.getSize();

    page.drawText('DA KY', {
      x: width - 120,
      y: 30,
      size: 12,
      font,
      color: rgb(1, 0, 0)
    });

    page.drawText(`NV: ${safeName}`, {
      x: 30,
      y: 30,
      size: 10,
      font
    });

    page.drawText(`Page ${index + 1}`, {
      x: width / 2 - 20,
      y: 15,
      size: 8,
      font
    });
  });

  const newBytes = await pdfDoc.save({ useObjectStreams: true });

  const newPath = filePath + '-processed.pdf';
  fs.writeFileSync(newPath, newBytes);

  return newPath;
}

export default async function handler(req, res) {
  // ✅ CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let originalPath = null;
  let processedPath = null;

  try {
    // 1. parse
    const { fields, files } = await parseForm(req);

    console.log('FILES:', files);

    const file = files.file?.[0];
    if (!file || !file.filepath) {
      return res.status(400).json({ error: 'File invalid' });
    }

    originalPath = file.filepath;
    const originalName = file.originalFilename || 'file.pdf';

    if (!originalName.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({ error: 'Chỉ nhận PDF' });
    }

    const employeeId = fields.employeeId?.[0] || 'EMP';
    const name = fields.name?.[0] || 'unknown';

    // 2. xử lý PDF
    processedPath = await processPdf(originalPath, name);

    if (!fs.existsSync(processedPath)) {
      throw new Error('Processed file not found');
    }

    // 3. upload drive
    const drive = getDrive();

    const safeName = `${employeeId}_${removeVietnameseTones(name)}.pdf`;

    // 🔥 dùng stream từ buffer (ổn định nhất)
    const buffer = fs.readFileSync(processedPath);
    const stream = Readable.from(buffer);

    const uploadRes = await drive.files.create({
      requestBody: {
        name: safeName,
        mimeType: 'application/pdf',
        parents: [process.env.DRIVE_FOLDER_ID]
      },
      media: {
        mimeType: 'application/pdf',
        body: stream
      }
    });

    const fileId = uploadRes.data.id;

    // 4. public file
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    const url = `https://drive.google.com/file/d/${fileId}/view`;

    return res.status(200).json({
      success: true,
      fileId,
      url
    });

  } catch (error) {
    console.error('UPLOAD ERROR:', error);

    return res.status(500).json({
      error: 'Upload failed',
      detail: error.message
    });

  } finally {
    // 5. cleanup
    try {
      if (originalPath && fs.existsSync(originalPath)) {
        fs.unlinkSync(originalPath);
      }
      if (processedPath && fs.existsSync(processedPath)) {
        fs.unlinkSync(processedPath);
      }
    } catch (e) {
      console.warn('Cleanup error:', e.message);
    }
  }
}