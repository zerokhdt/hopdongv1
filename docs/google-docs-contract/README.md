# Google Docs Contract Printing (Recommended)

Goal: generate a **Word-accurate PDF** by using Google Docs as the renderer.

This avoids the common “Word → HTML → Print” formatting drift.

## What You Will Get

- A Google Apps Script Web App endpoint.
- The web app:
  - copies a Google Docs template,
  - replaces placeholders with employee/contract data,
  - exports a PDF,
  - opens a download link.

The ACE HRM UI can send contract data to that endpoint and open the resulting PDF.

## 1) Prepare a Google Docs Template

1. Upload your DOCX contract to Google Drive.
2. Open it with Google Docs.
3. Replace variable parts with placeholders like:

- `{{SO_HD}}`
- `{{HO_TEN}}`
- `{{NGAY_SINH}}`
- `{{NOI_SINH}}`
- `{{CCCD}}`
- `{{NGAY_CAP}}`
- `{{NOI_CAP}}`
- `{{DIEN_THOAI}}`
- `{{EMAIL}}`
- `{{DIA_CHI_THUONG_TRU}}`
- `{{DIA_CHI_TAM_TRU}}`
- `{{CHUC_DANH}}`
- `{{TU_NGAY}}`
- `{{NGAY_KY}}`
- `{{LUONG}}`
- `{{LUONG_CHU}}`
- `{{PC_CHO_O}}`
- `{{PC_DI_LAI}}`
- `{{PC_DIEN_THOAI}}`

4. Copy the template document ID from the URL.

## 2) Deploy the Apps Script Web App

1. Go to https://script.google.com/
2. Create a new project.
3. Paste the content of `Code.gs` from this folder.
4. Set:
   - `TEMPLATE_DOC_ID`
   - `OUTPUT_FOLDER_ID` (optional)
   - `SECRET_TOKEN` (optional)
5. Deploy → New deployment → Type: Web app
   - Execute as: **Me**
   - Who has access: **Anyone** (or Anyone with link)
6. Copy the Web App URL.

## 3) Configure ACE HRM

In the “In hợp đồng” screen (Contract generator):

- Set `Google Web App URL`
- Set `Template Doc ID` (per contract variant if needed)
- (Optional) set `Secret token`

Then click **“Google Docs PDF”**.

## Notes

- This flow generates PDFs in Drive. You can clean old PDFs periodically.
- For stricter security, keep `SECRET_TOKEN` enabled and do not share the web app URL widely.

