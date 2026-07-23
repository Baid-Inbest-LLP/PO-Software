const ExcelJS = require('exceljs');
const { amountToWordsINR } = require('./amountToWords');
const { joinVendorShipFromAddress, joinPoVendorShipFrom } = require('./vendorShipFrom');
const { readAssetBuffer } = require('./assetLoader');
const {
  calcAmount,
  calcDiscountAmt,
  calcGstAmt,
  calcLineTotal,
  summarizePoAmounts,
  toPaise,
} = require('./poAmounts');

const fmtDateDMY = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
};

const num = (v) => Number(v || 0);
const INR_FMT = '"₹" #,##0';
const wrapAddressForCell = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  const maxCharsPerLine = 48;
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });
  if (current) lines.push(current);
  return lines.join('\n');
};

const border = (cell, color = 'FF000000') => {
  const e = { style: 'thin', color: { argb: color } };
  cell.border = { top: e, left: e, bottom: e, right: e };
};

const generatePOExcel = async (po, { adminSignatureBuffer, mdSignatureBuffer } = {}) => {
  const normalizedStatus = String(po?.status || '').trim().toLowerCase();
  const isAdminApproved = ['approved_by_admin', 'approved', 'approve'].includes(normalizedStatus);
  const isCompleted = ['completed', 'complete'].includes(normalizedStatus);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PO Software';
  wb.created = new Date();

  const ws = wb.addWorksheet('Purchase Order', {
    pageSetup: {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      // Excel margins are in inches. ~0.21in is roughly 20px.
      margins: { left: 0.21, right: 0.21, top: 0.21, bottom: 0.21, header: 0.21, footer: 0.21 },
    },
    views: [{ showGridLines: false }],
  });

  // Wider table columns to prevent clipping and improve readability.
  // CATEGORY column doubled as requested.
  ws.columns = [
    { width: 4 },   // A (left gap)
    { width: 8 },   // B SL NO
    { width: 36 },  // C PARTICULARS
    { width: 9 },   // D QTY
    { width: 9 },   // E UNIT
    { width: 14 },  // F UNIT PRICE
    { width: 10 },  // G DISC %
    { width: 14 },  // H DISC AMT
    { width: 14 },  // I AMOUNT
    { width: 10 },  // J GST %
    { width: 14 },  // K GST AMT
    { width: 16 },  // L TOTAL
    { width: 4 },   // M (right gap)
  ];

  const companyCode = po.company?.companyCode || '';
  const year = (() => { const d = po.orderDate ? new Date(po.orderDate) : new Date(); return d.getFullYear(); })();
  const month = (() => { const d = po.orderDate ? new Date(po.orderDate) : new Date(); return ['January','February','March','April','May','June','July','August','September','October','November','December'][d.getMonth()]; })();

  let r = 1;
  const shreePng = readAssetBuffer('shree_red.png');
  const inbestPng = readAssetBuffer('Inbest_Logo(Blue).png');
  const adminSignaturePng = adminSignatureBuffer || null;
  const mdSignaturePng = mdSignatureBuffer || null;

  // Full-width 3-panel header with left sheet gap (B:D | E:H | I:L).
  ws.getRow(r).height = 34;
  ws.getRow(r + 1).height = 34;
  ws.getRow(r + 2).height = 34;
  ws.mergeCells(`B${r}:D${r + 2}`);
  ws.mergeCells(`E${r}:H${r + 2}`);
  ws.mergeCells(`I${r}:L${r + 2}`);

  ws.getCell(`B${r}`).value = companyCode + (po.company?.taxId ? `\nGST No: ${po.company.taxId}` : '');
  ws.getCell(`B${r}`).font = { name: 'Calibri', bold: true, size: 20, color: { argb: 'FF13AFCD' } };
  ws.getCell(`B${r}`).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  // Keep GST line in black and smaller while retaining blue company code.
  if (po.company?.taxId) {
    ws.getCell(`B${r}`).value = {
      richText: [
        { text: `${companyCode}\n`, font: { name: 'Calibri', bold: true, size: 20, color: { argb: 'FF13AFCD' } } },
        { text: `GST No: ${po.company.taxId}`, font: { name: 'Calibri', bold: true, size: 14, color: { argb: 'FF000000' } } },
      ],
    };
  }
  // Add one helper row under header to ensure long company/GST text never clips.
  ws.getRow(r + 3).height = 10;

  ws.getCell(`E${r}`).alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getCell(`I${r}`).alignment = { vertical: 'middle', horizontal: 'center' };

  // Use real logos in Excel export. Fall back to text if asset files are unavailable.
  if (shreePng) {
    const shreeImgId = wb.addImage({ buffer: shreePng, extension: 'png' });
    ws.addImage(shreeImgId, {
      // Keep Shree exactly in the center panel.
      tl: { col: 6.0, row: 1.0 },
      br: { col: 7.0, row: 2.4 },
    });
  } else {
    ws.getCell(`E${r}`).value = '|| SHREE ||';
    ws.getCell(`E${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell(`E${r}`).font = { name: 'Calibri', size: 14, bold: true };
  }

  if (inbestPng) {
    const inbestImgId = wb.addImage({ buffer: inbestPng, extension: 'png' });
    ws.addImage(inbestImgId, {
      // Pin Inbest to the far-right header panel.
      tl: { col: 11.15, row: 0.95 },
      br: { col: 12, row: 2.6 },
    });
  } else {
    ws.getCell(`I${r}`).value = 'INBEST';
    ws.getCell(`I${r}`).alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getCell(`I${r}`).font = { name: 'Calibri', bold: true, size: 22, color: { argb: 'FF0B2F81' } };
  }

  r += 4;
  ws.mergeCells(`B${r}:L${r}`); ws.getCell(`B${r}`).value = `Purchase Order | ${month}'${year}`; ws.getCell(`B${r}`).font = { name: 'Calibri', size: 20, bold: true }; ws.getCell(`B${r}`).alignment = { horizontal: 'center' };
  r += 1;
  ws.mergeCells(`B${r}:L${r}`); ws.getCell(`B${r}`).value = po.poNumber || ''; ws.getCell(`B${r}`).font = { name: 'Calibri', size: 16, bold: true }; ws.getCell(`B${r}`).alignment = { horizontal: 'center' };
  

  r += 2;
  const shipToText = wrapAddressForCell(joinVendorShipFromAddress(po.shippingAddress) || '');
  const shipFromText = wrapAddressForCell(joinPoVendorShipFrom(po) || '');
  const resolvedDepartment =
    po.department ||
    (Array.isArray(po.lineItems)
      ? po.lineItems.find((li) => li?.item?.department)?.item?.department || ''
      : '');

  // Match poPdfTemplate left/right meta; Ship To and Ship From share one row
  const metaPairs = [
    [['Company', companyCode || ''], ['Vendor Name', po.vendor?.name || '']],
    [['Department', resolvedDepartment], ['Vendor Phone', po.vendor?.phone || '']],
    [['Phone', po.company?.phone || ''], ['Vendor GST No', po.vendor?.taxId || '']],
    [['Order Date', fmtDateDMY(po.orderDate)], ['Delivery Date', fmtDateDMY(po.expectedDeliveryDate)]],
    [['Ship To', shipToText], ['Ship From', shipFromText]],
  ];
  for (let mi = 0; mi < metaPairs.length; mi += 1) {
    const [left, rightCol] = metaPairs[mi];
    const [lLabel, lValue] = left;
    const [rLabel, rValue] = rightCol;
    ws.mergeCells(`B${r}:F${r}`);
    ws.getCell(`B${r}`).value = {
      richText: [
        { font: { name: 'Calibri', size: 13, bold: true }, text: lLabel ? `${lLabel}: ` : '' },
        { font: { name: 'Calibri', size: 13 }, text: lValue || '' },
      ],
    };
    ws.mergeCells(`G${r}:L${r}`);
    ws.getCell(`G${r}`).value = {
      richText: [
        { font: { name: 'Calibri', size: 13, bold: true }, text: rLabel ? `${rLabel}: ` : '' },
        { font: { name: 'Calibri', size: 13 }, text: rValue || '' },
      ],
    };
    ws.getCell(`B${r}`).alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
    ws.getCell(`G${r}`).alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
    const isShipRow = mi === metaPairs.length - 1;
    ws.getRow(r).height = isShipRow ? 56 : 22;
    r += 1;
  }

  // Repeat full top block (logo/title/meta section) on every printed page.
  ws.pageSetup.printTitlesRow = `1:${r - 1}`;

  r += 1;
  const headers = ['SL NO', 'PARTICULARS', 'QTY', 'UNIT', 'UNIT PRICE', 'DISC %', 'DISC AMT', 'AMOUNT', 'GST %', 'GST AMT', 'TOTAL'];
  headers.forEach((h, i) => { const c = ws.getCell(r, i + 2); c.value = h; c.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF005887' } }; c.alignment = { horizontal: 'center', vertical: 'middle' }; border(c); });
  ws.getRow(r).height = 36;
  r += 1;

  let itemsTotalRounded = 0;
  let qtyTotal = 0;
  let discountTotalRaw = 0;
  let amountTotalRaw = 0;
  let gstTotalRaw = 0;
  const shippingCostRounded = Math.round(num(po.shippingCost));
  (po.lineItems || []).forEach((li, idx) => {
    const discountPct = num(li.discount);
    const gstPct = num(li.gstRate);
    const discAmtRaw = calcDiscountAmt(li);
    const amountRaw = calcAmount(li);
    const gstRaw = calcGstAmt(li);
    const roundedTotal = calcLineTotal(li);
    qtyTotal += num(li.quantity);
    discountTotalRaw += discAmtRaw;
    amountTotalRaw += amountRaw;
    gstTotalRaw += gstRaw;
    itemsTotalRounded += roundedTotal;
    const vals = [
      idx + 1,
      li.description || li.item?.name || '',
      num(li.quantity),
      li.unit || li.item?.unit || 'pcs',
      toPaise(num(li.unitPrice)),
      discountPct > 0 ? discountPct : '',
      discAmtRaw > 0 ? discAmtRaw : '',
      amountRaw,
      gstPct > 0 ? gstPct : '',
      gstRaw > 0 ? gstRaw : '',
      roundedTotal,
    ];
    vals.forEach((v, i) => {
      const c = ws.getCell(r, i + 2);
      c.value = v === '' ? '' : v;
      c.font = {
        name: 'Calibri',
        size: 14,
        ...(i === 6 ? { color: { argb: 'FFB91C1C' }, bold: true } : {}),
        ...(i === 9 ? { color: { argb: 'FF047857' }, bold: true } : {}),
        ...(i === 10 ? { bold: true } : {}),
      };
      c.alignment = { horizontal: [0, 2, 3].includes(i) ? 'center' : i >= 4 ? 'right' : 'left', vertical: 'middle', wrapText: i === 1 };
      if ([4, 6, 7, 9].includes(i)) c.numFmt = '"₹" #,##0.00';
      if (i === 10) c.numFmt = INR_FMT;
      border(c);
    });
    ws.getRow(r).height = 24;
    r += 1;
  });

  const summary = summarizePoAmounts(po.lineItems || [], po.shippingCost);
  const totalsVals = [
    '',
    'Totals',
    qtyTotal,
    '',
    '',
    '',
    summary.discountRounded > 0 ? summary.discountRounded : '',
    summary.subtotal,
    '',
    summary.gstTotal > 0 ? summary.gstTotal : '',
    summary.itemsTotal,
  ];
  totalsVals.forEach((v, i) => {
    const c = ws.getCell(r, i + 2);
    c.value = v;
    c.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF1F2937' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF3FA' } };
    if (i === 6) { // DISC AMT total
      c.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF7F1D1D' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
    }
    if (i === 9) { // GST AMT total
      c.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF166534' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
    }
    c.alignment = { horizontal: [0, 2, 3].includes(i) ? 'center' : i >= 4 ? 'right' : 'left', vertical: 'middle' };
    if ([6, 7, 9, 10].includes(i)) c.numFmt = INR_FMT;
    border(c);
  });
  ws.getRow(r).height = 30;
  r += 1;

  if (shippingCostRounded > 0) {
    ws.mergeCells(`B${r}:K${r}`); const s1 = ws.getCell(`B${r}`); s1.value = 'SHIPPING'; s1.font = { name: 'Calibri', size: 16, bold: true }; s1.alignment = { horizontal: 'center', vertical: 'middle' }; s1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF3FA' } }; border(s1);
    const s2 = ws.getCell(`L${r}`); s2.value = shippingCostRounded; s2.numFmt = INR_FMT; s2.font = { name: 'Calibri', size: 16, bold: true }; s2.alignment = { horizontal: 'right', vertical: 'middle' }; s2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF3FA' } }; border(s2);
    ws.getRow(r).height = 22;
    r += 1;
  }

  const grandTotalRounded = summary.grandTotal;
  ws.mergeCells(`B${r}:K${r}`); const g1 = ws.getCell(`B${r}`); g1.value = 'TOTAL AMOUNT'; g1.font = { name: 'Calibri', size: 20, bold: true, color: { argb: 'FFFFFFFF' } }; g1.alignment = { horizontal: 'center', vertical: 'middle' }; g1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF005887' } }; border(g1);
  const g2 = ws.getCell(`L${r}`); g2.value = grandTotalRounded; g2.numFmt = INR_FMT; g2.font = { name: 'Calibri', size: 20, bold: true, color: { argb: 'FFFFFFFF' } }; g2.alignment = { horizontal: 'right', vertical: 'middle' }; g2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF005887' } }; border(g2);
  ws.getRow(r).height = 26;

  r += 2;
  ws.mergeCells(`B${r}:L${r}`); ws.getCell(`B${r}`).value = `Amount (in words): ${amountToWordsINR(grandTotalRounded)}`; ws.getCell(`B${r}`).font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FF0B2F81' } }; ws.getCell(`B${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };

  // Keep signatures very close to the amount-in-words section.
  ws.getRow(r + 1).height = 4;
  r += 2;

  // Signature size (px): Excel 320×100; PDF is larger (400×200) in poPdfTemplate.js
  const EXCEL_SIGNATURE_WIDTH = 300;
  const EXCEL_SIGNATURE_HEIGHT = 120;
  // Center signatures over their respective text groups (B:E and H:L).
  const LEFT_SIGNATURE_COL = 2.4;
  const RIGHT_SIGNATURE_COL = 8.2;
  const SIGNATURE_ROW_OFFSET = -0.55;
  ws.getRow(r).height = 90;
  const signatureRow = r;
  const shouldShowAdminSignature = isAdminApproved || isCompleted;
  const shouldShowMdSignature = isCompleted;
  if (shouldShowAdminSignature && adminSignaturePng) {
    const leftSignatureImageId = wb.addImage({ buffer: adminSignaturePng, extension: 'png' });
    ws.addImage(leftSignatureImageId, {
      tl: { col: LEFT_SIGNATURE_COL, row: signatureRow + SIGNATURE_ROW_OFFSET },
      ext: { width: EXCEL_SIGNATURE_WIDTH, height: EXCEL_SIGNATURE_HEIGHT },
    });
  }
  if (shouldShowMdSignature && mdSignaturePng) {
    const rightSignatureImageId = wb.addImage({ buffer: mdSignaturePng, extension: 'png' });
    ws.addImage(rightSignatureImageId, {
      tl: { col: RIGHT_SIGNATURE_COL, row: signatureRow + SIGNATURE_ROW_OFFSET },
      ext: { width: EXCEL_SIGNATURE_WIDTH, height: EXCEL_SIGNATURE_HEIGHT },
    });
  }
  r += 1;
  ws.getRow(r).height = 8;
  r += 1;
  ws.getRow(r).height = 24;
  ws.mergeCells(`B${r}:E${r}`); ws.getCell(`B${r}`).value = '(Authorised Signatories)'; ws.getCell(`B${r}`).alignment = { horizontal: 'center' }; ws.getCell(`B${r}`).font = { name: 'Calibri', size: 16, bold: true };
  ws.mergeCells(`H${r}:L${r}`); ws.getCell(`H${r}`).value = '(Authorised Signatory)'; ws.getCell(`H${r}`).alignment = { horizontal: 'center' }; ws.getCell(`H${r}`).font = { name: 'Calibri', size: 16, bold: true };
  r += 1;
  ws.mergeCells(`B${r}:E${r}`); ws.getCell(`B${r}`).value = 'Admin & Accounts'; ws.getCell(`B${r}`).alignment = { horizontal: 'center' }; ws.getCell(`B${r}`).font = { name: 'Calibri', size: 14, semibold: true };
  ws.mergeCells(`H${r}:L${r}`); ws.getCell(`H${r}`).value = 'MD & Founder'; ws.getCell(`H${r}`).alignment = { horizontal: 'center' }; ws.getCell(`H${r}`).font = { name: 'Calibri', size: 14, semibold: true };

  const office = [po.company?.locations?.[0]?.street, po.company?.locations?.[0]?.city, po.company?.locations?.[0]?.state, po.company?.locations?.[0]?.zipCode, po.company?.locations?.[0]?.country].filter(Boolean).join(', ');
  const ship = [po.shippingAddress?.street, po.shippingAddress?.city, po.shippingAddress?.state, po.shippingAddress?.zipCode, po.shippingAddress?.country].filter(Boolean).join(', ');
  r += 5;
  ws.mergeCells(`B${r}:L${r}`);
  const f = ws.getCell(`B${r}`);
  f.value = office || ship || '';
  f.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  f.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF13AFCD' } };
  f.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  ws.getRow(r).height = 24;

  return wb.xlsx.writeBuffer();
};

module.exports = { generatePOExcel };
