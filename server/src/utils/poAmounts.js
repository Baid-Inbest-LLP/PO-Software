/**
 * Industry-standard PO money rules (INR):
 * - Amount & GST Amt: full paise (2 decimals)
 * - Line Total: round(Amount + GST Amt)
 * - Document Subtotal: round(sum of Amounts)
 * - Document GST: round(sum of GST Amts)
 * - Shipping: round(shipping)
 * - Grand Total: Subtotal + GST + Shipping
 */

const toPaise = (n) => Math.round((Number(n) || 0) * 100) / 100;
const roundRupee = (n) => Math.round(Number(n) || 0);

const calcDiscountAmt = (item) => {
  const base = (Number(item?.quantity) || 0) * (Number(item?.unitPrice) || 0);
  return toPaise(base * ((Number(item?.discount) || 0) / 100));
};

const calcAmount = (item) => {
  const base = (Number(item?.quantity) || 0) * (Number(item?.unitPrice) || 0);
  return toPaise(base - calcDiscountAmt(item));
};

const calcGstAmt = (item) => {
  const stored = Number(item?.gstAmount);
  if (stored > 0) return toPaise(stored);
  const amount = calcAmount(item);
  return toPaise(amount * ((Number(item?.gstRate) || 0) / 100));
};

const calcLineTotal = (item) => roundRupee(calcAmount(item) + calcGstAmt(item));

const summarizePoAmounts = (lineItems = [], shippingCost = 0) => {
  const totals = (lineItems || []).reduce(
    (acc, item) => {
      const amount = calcAmount(item);
      const gst = calcGstAmt(item);
      const lineTotal = roundRupee(amount + gst);
      return {
        qty: acc.qty + (Number(item?.quantity) || 0),
        discount: acc.discount + calcDiscountAmt(item),
        amount: acc.amount + amount,
        gst: acc.gst + gst,
        lineTotalsSum: acc.lineTotalsSum + lineTotal,
      };
    },
    { qty: 0, discount: 0, amount: 0, gst: 0, lineTotalsSum: 0 },
  );

  const subtotal = roundRupee(totals.amount);
  const gstTotal = roundRupee(totals.gst);
  const shipping = roundRupee(shippingCost);
  const grandTotal = subtotal + gstTotal + shipping;

  return {
    ...totals,
    discountRounded: roundRupee(totals.discount),
    subtotal,
    gstTotal,
    shipping,
    grandTotal,
    itemsTotal: totals.lineTotalsSum,
  };
};

const applyLineItemAmounts = (item) => {
  const amount = calcAmount(item);
  const gstAmount = toPaise(amount * ((Number(item.gstRate) || 0) / 100));
  const totalPrice = roundRupee(amount + gstAmount);
  return { amount, gstAmount, totalPrice };
};

module.exports = {
  toPaise,
  roundRupee,
  calcDiscountAmt,
  calcAmount,
  calcGstAmt,
  calcLineTotal,
  summarizePoAmounts,
  applyLineItemAmounts,
};
