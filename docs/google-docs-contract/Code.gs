const DEFAULT_TEMPLATE_DOC_ID = '1mJzGvkgUBK-YPXTDtYO1ZvtVvPrPQUseXHbya2MyH5g';
const DEFAULT_OUTPUT_FOLDER_ID = '11VJTTuoq3pIj5fA0YVUUQEhRFLW_fSu7';
const DEFAULT_SECRET_TOKEN = 'ACE_HR_CONTRACT_2026__v1__9sP3mK7uQ2xL4wN8cR5tD6yH1gF0zV';
const WEBAPP_VERSION = '2026-03-30_documents-multi_v2';

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function escapeRegExp(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceInContainer(container, key, value) {
  if (!container) return;
  const pattern = '\\{\\{' + escapeRegExp(key) + '\\}\\}';
  container.replaceText(pattern, String(value ?? ''));
}

function getReqBody_(e) {
  try {
    return JSON.parse((e && e.postData && e.postData.contents) ? e.postData.contents : '{}') || {};
  } catch (_) {
    return {};
  }
}

function getSecret_(e, body) {
  const q = (e && e.parameter) ? e.parameter.secret : '';
  const b = body ? body.secret : '';
  return q || b || '';
}

function getConfig_() {
  const props = PropertiesService.getScriptProperties().getProperties() || {};
  return {
    templateDocId: props.TEMPLATE_DOC_ID || DEFAULT_TEMPLATE_DOC_ID,
    outputFolderId: props.OUTPUT_FOLDER_ID || DEFAULT_OUTPUT_FOLDER_ID,
    secretToken: props.SECRET_TOKEN || DEFAULT_SECRET_TOKEN,
  };
}

function resolveTemplateId_(body) {
  const cfg = getConfig_();
  return (body && body.templateDocId) || cfg.templateDocId;
}

function resolveOutputFolder_(body) {
  const cfg = getConfig_();
  return (body && body.outputFolderId) || cfg.outputFolderId;
}

function makeOutputName_(body) {
  const name = (body && body.outputName) ? String(body.outputName).trim() : '';
  if (name) return name;
  const so = body && body.placeholders ? String(body.placeholders.SO_HD || '').trim() : '';
  const hoTen = body && body.placeholders ? String(body.placeholders.HO_TEN || '').trim() : '';
  return ['HOP_DONG', so, hoTen].filter(Boolean).join('_') || ('HOP_DONG_' + Date.now());
}

function doGet(e) {
  return jsonOut({ ok: true, message: 'contract-docs-webapp', version: WEBAPP_VERSION });
}

function doPost(e) {
  const body = getReqBody_(e);
  const secret = getSecret_(e, body);
  const cfg = getConfig_();
  if (cfg.secretToken && secret !== cfg.secretToken) {
    return jsonOut({ ok: false, error: 'UNAUTHORIZED', version: WEBAPP_VERSION });
  }

  const emailTo = body && body.emailTo ? String(body.emailTo).trim() : '';
  const emailSubject = body && body.emailSubject ? String(body.emailSubject).trim() : '';
  const emailBody = body && body.emailBody ? String(body.emailBody) : '';
  const placeholders = (body && body.placeholders) ? body.placeholders : {};
  const outFolderId = resolveOutputFolder_(body);
  const outFolder = outFolderId ? DriveApp.getFolderById(outFolderId) : null;

  const documents = (body && body.documents && Array.isArray(body.documents)) ? body.documents : null;
  const items = [];
  const attachments = [];
  var requestedCount = 0;

  if (documents && documents.length > 0) {
    requestedCount = documents.length;
    for (var i = 0; i < documents.length; i++) {
      var d = documents[i] || {};
      var templateId = d.templateDocId ? String(d.templateDocId).trim() : '';
      var outName = d.outputName ? String(d.outputName).trim() : '';
      if (!outName) outName = makeOutputName_({ outputName: 'ACE' });

      if (!templateId) {
        items.push({ ok: false, templateDocId: templateId, outputName: outName, error: 'MISSING_TEMPLATE_DOC_ID' });
        continue;
      }

      try {
        var templateFile = DriveApp.getFileById(templateId);
        var copiedFile = outFolder ? templateFile.makeCopy(outName, outFolder) : templateFile.makeCopy(outName);
        var copiedDocId = copiedFile.getId();

        var doc = DocumentApp.openById(copiedDocId);
        var bodyEl = doc.getBody();
        var headerEl = doc.getHeader();
        var footerEl = doc.getFooter();

        Object.keys(placeholders || {}).forEach(function(k) {
          var v = placeholders[k];
          replaceInContainer(bodyEl, k, v);
          replaceInContainer(headerEl, k, v);
          replaceInContainer(footerEl, k, v);
        });

        doc.saveAndClose();

        var pdfBlob = copiedFile.getBlob().getAs(MimeType.PDF).setName(outName + '.pdf');
        var pdfFile = outFolder ? outFolder.createFile(pdfBlob) : DriveApp.createFile(pdfBlob);
        pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

        var fileId = pdfFile.getId();
        var viewUrl = pdfFile.getUrl();
        var downloadUrl = 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(fileId);

        items.push({
          ok: true,
          fileId: fileId,
          viewUrl: viewUrl,
          downloadUrl: downloadUrl,
          name: pdfFile.getName(),
        });
        attachments.push(pdfBlob);
      } catch (err) {
        items.push({
          ok: false,
          templateDocId: templateId,
          outputName: outName,
          error: String(err && err.message ? err.message : err),
        });
      }
    }
  } else {
    requestedCount = 1;
    var templateId = resolveTemplateId_(body);
    if (!templateId) return jsonOut({ ok: false, error: 'MISSING_TEMPLATE_DOC_ID', version: WEBAPP_VERSION });

    var outName = makeOutputName_(body);
    try {
      var templateFile = DriveApp.getFileById(templateId);
      var copiedFile = outFolder ? templateFile.makeCopy(outName, outFolder) : templateFile.makeCopy(outName);
      var copiedDocId = copiedFile.getId();

      var doc = DocumentApp.openById(copiedDocId);
      var bodyEl = doc.getBody();
      var headerEl = doc.getHeader();
      var footerEl = doc.getFooter();

      Object.keys(placeholders || {}).forEach(function(k) {
        var v = placeholders[k];
        replaceInContainer(bodyEl, k, v);
        replaceInContainer(headerEl, k, v);
        replaceInContainer(footerEl, k, v);
      });

      doc.saveAndClose();

      var pdfBlob = copiedFile.getBlob().getAs(MimeType.PDF).setName(outName + '.pdf');
      var pdfFile = outFolder ? outFolder.createFile(pdfBlob) : DriveApp.createFile(pdfBlob);
      pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      var fileId = pdfFile.getId();
      var viewUrl = pdfFile.getUrl();
      var downloadUrl = 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(fileId);

      items.push({
        ok: true,
        fileId: fileId,
        viewUrl: viewUrl,
        downloadUrl: downloadUrl,
        name: pdfFile.getName(),
      });
      attachments.push(pdfBlob);
    } catch (err2) {
      items.push({
        ok: false,
        templateDocId: templateId,
        outputName: outName,
        error: String(err2 && err2.message ? err2.message : err2),
      });
    }
  }

  var emailed = false;
  if (emailTo && emailTo.indexOf('@') !== -1 && attachments.length > 0) {
    try {
      var okItems = items.filter(function(it) { return it && it.ok; });
      var badItems = items.filter(function(it) { return it && !it.ok; });
      var links = okItems.map(function(it) { return '<li><a href="' + it.viewUrl + '">' + it.name + '</a></li>'; }).join('');
      var fails = badItems.map(function(it) { return '<li>' + (it.outputName || 'N/A') + ' — ' + (it.error || 'ERROR') + '</li>'; }).join('');
      MailApp.sendEmail({
        to: emailTo,
        subject: emailSubject || ('ACE - ' + (okItems.length === 1 ? okItems[0].name : 'Tài liệu')),
        htmlBody: emailBody || ('<p>ACE đã xuất file PDF.</p><ul>' + links + '</ul>' + (fails ? ('<p><strong>Không tạo được:</strong></p><ul>' + fails + '</ul>') : '')),
        attachments: attachments,
      });
      emailed = true;
    } catch (_) {
      emailed = false;
    }
  }

  return jsonOut({
    ok: true,
    version: WEBAPP_VERSION,
    requestedCount: requestedCount,
    generatedCount: attachments.length,
    items: items,
    emailed: emailed,
  });
}
