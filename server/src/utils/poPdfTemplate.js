const {
  joinVendorShipFromAddress,
  joinPoVendorShipFrom,
} = require("./vendorShipFrom");
const {
  calcAmount,
  calcDiscountAmt,
  calcGstAmt,
  calcLineTotal,
  summarizePoAmounts,
  toPaise,
} = require("./poAmounts");

const escapeHtml = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

/** img[src] when value is a data URI — avoid double-encoding that can break Chromium PDF rasterization */
const escapeDataUriAttr = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;");

const fmtMonthYearLong = (d) => {
  const dt = d ? new Date(d) : new Date();
  const m = dt.getMonth(); // 0-based
  const MON = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ][m];
  return MON;
};

const fmtDateDMY = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

const fmtMoney = (n) => {
  const v = Number(n || 0);
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(v);
  return `₹${formatted}`;
};

const safe = (v) =>
  escapeHtml(
    String(v ?? "")
      .replace(/\s+/g, " ")
      .trim(),
  );

const renderLabelValueRows = (rows = []) =>
  rows
    .filter((r) => r && r.label)
    .map(
      ({ label, value }) => `
      <tr>
        <td><span class="meta-label">${safe(label)}:</span> <span class="meta-value">${safe(value ?? "")}</span></td>
      </tr>
    `,
    )
    .join("");

const joinAddress = (addr = {}) =>
  [addr.street, addr.city, addr.state, addr.zipCode, addr.country]
    .filter(Boolean)
    .join(", ");

const buildPoHeaderFooterContext = ({ po, assets = {} }) => {
  const orderDate = po.orderDate || po.createdAt;
  const monthName = fmtMonthYearLong(orderDate);
  const orderYear = new Date(orderDate || new Date()).getFullYear();
  const poHeaderLabel = `Purchase Order - ${monthName}'${orderYear}`;

  const companyCode = po.company?.companyCode || "";
  const companyTaxId = po.company?.taxId || "";
  const companyPhone = po.company?.phone || "";
  const poNo = po.poNumber || "—";
  const vendor = po.vendor || {};
  const ship = po.shippingAddress || {};
  const officeLoc = joinAddress(po.company?.locations?.[0] || {});
  const shipToPhysical = joinVendorShipFromAddress(ship);
  const shipFromLoc = joinPoVendorShipFrom(po);
  const resolvedDepartment =
    po.department ||
    (Array.isArray(po.lineItems)
      ? po.lineItems.find((li) => li?.item?.department)?.item?.department || ""
      : "");

  const leftMetaRows = [
    { label: "Company", value: companyCode || "" },
    { label: "Department", value: resolvedDepartment },
    { label: "Phone", value: companyPhone || "" },
    { label: "Order Date", value: fmtDateDMY(po.orderDate) || "" },
    { label: "Ship To", value: shipToPhysical || "" },
  ];

  const rightMetaRows = [
    { label: "Vendor Name", value: vendor.name || "" },
    { label: "Vendor Phone", value: vendor.phone || "" },
    { label: "Vendor GST No", value: vendor.taxId || "" },
    {
      label: "Delivery Date",
      value: fmtDateDMY(po.expectedDeliveryDate) || "",
    },
    { label: "Ship From", value: shipFromLoc || "" },
  ];

  return {
    companyCode: safe(companyCode),
    companyTaxId: safe(companyTaxId),
    poHeaderLabel: safe(poHeaderLabel),
    poNo: safe(poNo),
    leftMetaRows,
    rightMetaRows,
    logoSrc: escapeDataUriAttr(assets.logoSrc || ""),
    shreeSrc: escapeDataUriAttr(assets.shreeSrc || ""),
    footerText: safe(officeLoc || shipToPhysical || ""),
  };
};

const renderHeaderMetaRows = (rows = []) =>
  rows
    .filter((r) => r && r.label)
    .map(
      ({ label, value }) =>
        `<div style="font-size:14px; font-family:'Roboto',Arial,sans-serif;line-height:1.3;margin:0 0 2px 0;"><span style="font-weight:700;white-space:nowrap;">${safe(label)}: </span><span>${safe(value || "")}</span></div>`,
    )
    .join("");

const getHeaderTemplate = (
  ctx,
  fontCss = '',
) => `${fontCss ? `<style>${fontCss}</style>` : ''}<div style="width:100%;padding:12px 20px 0;font-family:'Roboto',Arial,sans-serif;background:#fff;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
    <div style="flex:1;">
      <div style="font-size:26px;font-weight:700;color:#13afcd;line-height:1.1;">${ctx.companyCode}</div>
      ${ctx.companyTaxId ? `<div style="font-size:14px;font-weight:600;margin-top:2px;">GST No: ${ctx.companyTaxId}</div>` : ""}
    </div>
    <div style="flex:1;text-align:center;">
      ${ctx.shreeSrc ? `<img src="${ctx.shreeSrc}" style="height:42px;width:auto;display:inline-block;" />` : `<span style="font-size:16px;font-weight:bold;">&#2377;&#2378;&#2381;&#2352;&#2368;&#2350;&#8214;</span>`}
    </div>
    <div style="flex:1;text-align:right;">
      ${ctx.logoSrc ? `<img src="${ctx.logoSrc}" style="height:64px;width:auto;display:inline-block;" />` : ""}
    </div>
  </div>
  <div style="text-align:center;font-size:18px;font-weight:700;margin:2px 0;">${ctx.poHeaderLabel}</div>
  <div style="text-align:center;font-size:16px;font-weight:700;margin:2px 0 6px 0;">${ctx.poNo}</div>
  <div style="border-top:1px solid #ddd;margin:6px 0;"></div>
  <div style="display:flex;gap:16px;">
    <div style="flex:1;padding:0 8px;">${renderHeaderMetaRows(ctx.leftMetaRows)}</div>
    <div style="flex:1;padding:0 8px;">${renderHeaderMetaRows(ctx.rightMetaRows)}</div>
  </div>
  <div style="border-top:1px solid #ddd;margin:6px 0 0 0;"></div>
</div>`;

const getFooterTemplate = (
  ctx,
  fontCss = '',
) => `${fontCss ? `<style>${fontCss}</style>` : ''}<div style="width:100%;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
<div style="width:calc(100% - 40px);margin:0 20px;padding:4px 10px;display:flex;align-items:center;justify-content:center;background:#13afcd;color:#fff;font-family:'Roboto',Arial,sans-serif;font-size:12px;line-height:1.4;box-sizing:border-box;">
${ctx.footerText}</div></div>`;

const poPdfHeaderFooterTemplates = ({ po, assets = {}, fontCss = '' }) => {
  const ctx = buildPoHeaderFooterContext({ po, assets });
  return {
    headerHtml: getHeaderTemplate(ctx, fontCss),
    footerHtml: getFooterTemplate(ctx, fontCss),
  };
};

const poPdfHtml = ({ po, amountInWords, assets = {}, fontCss = '' }) => {
  const normalizedStatus = String(po?.status || "")
    .trim()
    .toLowerCase();
  const isAdminApproved = ["approved_by_admin", "approved", "approve"].includes(
    normalizedStatus,
  );
  const isCompleted = ["completed", "complete"].includes(normalizedStatus);
  const adminStampSrc = assets.adminSignatureSrc || "";
  const superStampSrc = assets.superadminSignatureSrc || "";
  const headerCtx = buildPoHeaderFooterContext({ po, assets });

  const items = Array.isArray(po.lineItems) ? po.lineItems : [];
  const showAdminSignature =
    (isAdminApproved || isCompleted) && Boolean(adminStampSrc);
  const effectiveLeftSignatureSrc = showAdminSignature ? adminStampSrc : "";
  const effectiveRightSignatureSrc =
    isCompleted && superStampSrc ? superStampSrc : "";
  const shippingCost = Math.round(Number(po.shippingCost || 0));
  const summary = summarizePoAmounts(items, po.shippingCost || 0);
  const roundedTotals = {
    qty: summary.qty,
    discount: summary.discountRounded,
    amount: summary.subtotal,
    gst: summary.gstTotal,
    total: summary.itemsTotal,
  };
  const grandTotalWithShipping = summary.grandTotal;

  const rowsHtml = items
    .map((li, idx) => {
      const qty = Number(li.quantity || 0);
      const unit = li.unit || li.item?.unit || "pcs";
      const particulars = li.description || li.item?.name || "";
      const unitPrice = Number(li.unitPrice || 0);
      const discountPct = Number(li.discount || 0);
      const gstPct = Number(li.gstRate || 0);
      const discountAmtRaw = calcDiscountAmt(li);
      const amountRaw = calcAmount(li);
      const gstAmtRaw = calcGstAmt(li);
      const total = calcLineTotal(li);

      return `
        <tr>
          <td class="c">${idx + 1}</td>
          <td>${safe(particulars)}</td>
          <td class="c">${safe(String(qty || ""))}</td>
          <td class="c">${safe(unit)}</td>
          <td class="r">${fmtMoney(toPaise(unitPrice))}</td>
          <td class="r">${discountPct > 0 ? `${safe(String(discountPct))}%` : ""}</td>
          <td class="r amt-discount">${discountAmtRaw > 0 ? fmtMoney(discountAmtRaw) : ""}</td>
          <td class="r">${fmtMoney(amountRaw)}</td>
          <td class="r">${gstPct > 0 ? `${safe(String(gstPct))}%` : ""}</td>
          <td class="r amt-gst">${gstAmtRaw > 0 ? fmtMoney(gstAmtRaw) : ""}</td>
          <td class="r bold">${fmtMoney(total)}</td>
        </tr>
      `;
    })
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Purchase Order</title>
    <style>
      ${fontCss || ''}
      @page { size: A4; }
      * { box-sizing: border-box; }
      body { font-family: 'Roboto', Arial, sans-serif; margin: 0; padding: 0; color: #000; }
      .content { padding: 0 20px; }

      hr { border: none; border-top: 1px solid #ddd; margin: 10px 0; }
      .no-border, .no-border th, .no-border td { border: none; }

      table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 12px; }
      th, td { border: 1px solid #ddd; padding: 4px; text-align: left; }

      .items-table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
      .items-table thead { display: table-header-group; }
      .items-table tr { page-break-inside: auto; break-inside: auto; }
      .items-table th { border: 1px solid #e7e7e7; text-align: center; background: #005887; font-size: 13px; color: #ffffff; font-weight: 700; letter-spacing: 0.2px; }
      .items-table td { border: 1px solid #e7e7e7; font-size: 13px; }
      .items-table td:nth-child(5),
      .items-table td:nth-child(6),
      .items-table td:nth-child(7),
      .items-table td:nth-child(8),
      .items-table td:nth-child(9),
      .items-table td:nth-child(10),
      .items-table td:nth-child(11) { text-align: right; }

      .r { text-align: right; }
      .c { text-align: center; }
      .amt-discount { color: #b91c1c; font-weight: 700; }
      .amt-gst { color: #047857; font-weight: 700; }
      .item-totals-row td { background: #EFF3FA; color: #1F2937; font-weight: 700; }
      .item-totals-row .totals-discount { background: #FEE2E2; color: #7F1D1D; }
      .item-totals-row .totals-gst { background: #DCFCE7; color: #166534; }
      .total-amount-row td { background: #005887; color: #ffffff; padding-top: 4px; padding-bottom: 4px; }
      .shipping-row td { background: #f5f7fb; font-weight: 700; }

      .bold { font-weight: bold; }
      .amount-words {
        font-size: 16px;
        font-weight: 700;
        margin: 10px 0;
        color: #0B2F81;
        background: #FFFF00;
        padding: 8px 10px;
      }

      .signature-block {
        page-break-inside: avoid;
        break-inside: avoid;
        margin-top: 15px;
      }
      .signatures {
        width: 100%;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        font-size: 16px;
        min-height: 12rem;
        box-sizing: border-box;
      }
      .left-sign, .right-sign { flex: 1; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; }
      .left-sign { min-height: 12rem; }
      .right-sign { min-height: 12rem; }
      .left-sign p, .right-sign p { margin: 0; }
      .sign-stamp-slot {
        width: 400px;
        height: 70px;
        margin: 0 auto 10px auto;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .sign-stamp {
        display: block;
        width: 400px;
        height: 160px;
        object-fit: contain;
        margin: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .sign-title { margin-top: 2px; border-top: 2px solid #000000; padding-top: 10px; }
    </style>
  </head>
  <body>
    <div class="content">
      <table class="items-table">
        <thead>
          <tr>
            <th>SL NO</th>
            <th>PARTICULARS</th>
            <th>QTY</th>
            <th>UNIT</th>
            <th>UNIT PRICE</th>
            <th>DISC %</th>
            <th>DISC AMT</th>
            <th>AMOUNT</th>
            <th>GST %</th>
            <th>GST AMT</th>
            <th>TOTAL</th>
          </tr>
        </thead>
        ${rowsHtml || `<tr><td colspan="11" style="text-align:center;">No items</td></tr>`}
        <tr class="item-totals-row">
          <td></td>
          <td class="bold">Totals</td>
          <td class="c bold">${safe(String(roundedTotals.qty || ""))}</td>
          <td></td>
          <td></td>
          <td></td>
          <td class="r totals-discount">${roundedTotals.discount > 0 ? fmtMoney(roundedTotals.discount) : ""}</td>
          <td class="r">${fmtMoney(roundedTotals.amount)}</td>
          <td></td>
          <td class="r totals-gst">${roundedTotals.gst > 0 ? fmtMoney(roundedTotals.gst) : ""}</td>
          <td class="r bold">${fmtMoney(roundedTotals.total)}</td>
        </tr>
        ${
          shippingCost > 0
            ? `
        <tr class="shipping-row">
          <td colspan="10" class="c bold">Shipping</td>
          <td class="r bold">${fmtMoney(shippingCost)}</td>
        </tr>
        `
            : ""
        }
        <tr class="total-amount-row">
          <td colspan="10" class="c bold">Total Amount</td>
          <td class="r bold">${fmtMoney(grandTotalWithShipping)}</td>
        </tr>
      </table>

      <div class="amount-words">Amount (in words): ${safe(amountInWords || "")}</div>

      <div class="signature-block">
        <div class="signatures">
          <div class="left-sign">
            <div class="sign-stamp-slot">
              ${effectiveLeftSignatureSrc ? `<img src="${escapeDataUriAttr(effectiveLeftSignatureSrc)}" class="sign-stamp" alt="Digital signature">` : ""}
            </div>
            <p class="sign-title">(Authorised Signatories)</p>
            <p>Admin & Accounts</p>
          </div>
          <div class="right-sign">
            <div class="sign-stamp-slot">
              ${effectiveRightSignatureSrc ? `<img src="${escapeDataUriAttr(effectiveRightSignatureSrc)}" class="sign-stamp" alt="Digital signature">` : ""}
            </div>
            <p class="sign-title">(Authorised Signatory)</p>
            <p>MD & Founder</p>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;
};

module.exports = { poPdfHtml, poPdfHeaderFooterTemplates };
