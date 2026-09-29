import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const A5_WIDTH_PX = 559; // ~148mm at 96 DPI
const A5_HEIGHT_PX = 794; // ~210mm at 96 DPI

const centerOnPage = (pdf, width, height) => {
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const x = Math.max((pdfWidth - width) / 2, 0);
  const y = Math.max((pdfHeight - height) / 2, 0);
  return { x, y };
};

export const exportHtmlToPDF = async (htmlContent, filename, options = {}) => {
  const element = document.createElement('div');
  element.innerHTML = htmlContent;
  element.id = `pdf-export-${Date.now()}`;
  element.style.width = `${A5_WIDTH_PX}px`;
  element.style.minHeight = `${A5_HEIGHT_PX}px`;
  element.style.boxSizing = 'border-box';
  element.style.backgroundColor = '#ffffff';
  element.style.position = 'absolute';
  element.style.left = '-9999px';
  element.style.top = '0';
  document.body.appendChild(element);

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a5');
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    if (options.fitToSinglePage) {
      let renderWidth = pdfWidth;
      let renderHeight = (canvas.height * renderWidth) / canvas.width;

      if (renderHeight > pdfHeight) {
        const scale = pdfHeight / renderHeight;
        renderHeight = pdfHeight;
        renderWidth *= scale;
      }

      const { x, y } = centerOnPage(pdf, renderWidth, renderHeight);
      pdf.addImage(imgData, 'PNG', x, y, renderWidth, renderHeight);
    } else {
      const imgWidth = pdfWidth;
      const pageHeight = pdfHeight;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
    }

    pdf.save(`${filename}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  } finally {
    if (element.parentNode) {
      element.parentNode.removeChild(element);
    }
  }
};

/**
 * Generate Order Invoice HTML with exact return deductions matching Invoicing-Panel invoice template
 */
export const generateOrderInvoiceHTML = (order, companyName = 'COMPANY', currencySymbol = 'Rs') => {
  const formatVal = (val) => `${currencySymbol} ${(Number(val) || 0).toLocaleString()}`;
  const rawDate = order.createdAt ? new Date(order.createdAt) : new Date();
  const dateStr = `${String(rawDate.getDate()).padStart(2, '0')}/${String(rawDate.getMonth() + 1).padStart(2, '0')}/${rawDate.getFullYear()}`;
  const orderNumber = order.orderNumber || order.id || 'ORD-000000';
  const displayName = companyName.trim() ? companyName.toUpperCase() : 'COMPANY';

  const items = order.items
    ? (Array.isArray(order.items) ? order.items : Object.values(order.items))
    : [];

  const discountPct = Number(order.discount) || 0;

  let grossOriginalSubtotal = 0;
  let totalReturnedAmount = 0;

  const itemRows = items.map((item) => {
    const itemName = item.productName || 'Unnamed Item';
    const qty = Number(item.quantity) || 0;
    const returnedQty = Number(item.returnedQty || item.returnedQuantity) || 0;
    const price = Number(item.salePrice || item.unitPrice || item.price) || 0;
    
    const lineGross = qty * price;
    const lineReturn = returnedQty * price;

    grossOriginalSubtotal += lineGross;
    totalReturnedAmount += lineReturn;

    return `
      <tr>
        <td style="padding: 4px 6px; border: 1px solid #e5e7eb; text-align: center; font-size: 11px;">${qty}</td>
        <td style="padding: 4px 6px; border: 1px solid #e5e7eb; font-size: 11px; font-weight: 500;">${itemName}</td>
        <td style="padding: 4px 6px; border: 1px solid #e5e7eb; text-align: center; font-size: 11px;">
          ${returnedQty > 0 ? `<span style="color: #ef4444; font-weight: 600;">${returnedQty} (-${formatVal(lineReturn)})</span>` : '—'}
        </td>
        <td style="padding: 4px 6px; border: 1px solid #e5e7eb; text-align: right; font-size: 11px;">${formatVal(price)}</td>
        <td style="padding: 4px 6px; border: 1px solid #e5e7eb; text-align: right; font-size: 11px; font-weight: 500;">${formatVal(lineGross)}</td>
      </tr>
    `;
  }).join('');

  // Deduct returns from subtotal
  const netSubtotal = Math.max(0, grossOriginalSubtotal - totalReturnedAmount);
  const discountAmount = discountPct > 0 ? (netSubtotal * discountPct) / 100 : 0;
  const finalNetTotal = Math.max(0, netSubtotal - discountAmount);

  return `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; width: ${A5_WIDTH_PX}px; min-height: ${A5_HEIGHT_PX}px; margin: 0 auto; background-color: #ffffff; color: #0f172a; box-sizing: border-box; padding: 24px 28px;">
      
      <!-- Top Brand Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 8px; border-bottom: 2px solid #0f172a;">
        <div>
          <div style="font-size: 18px; letter-spacing: 0.08em; color: #0f172a; font-weight: 800; text-transform: uppercase;">${displayName}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 1px; font-weight: 600; letter-spacing: 0.05em;">OFFICIAL INVOICE</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 14px; letter-spacing: 0.06em; color: #64748b; text-transform: uppercase;">
            NO. <span style="font-weight: 800; color: #0f172a;">${orderNumber}</span>
          </div>
          <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
            <span style="font-weight: 500;">Date:</span>
            <span style="color: #0f172a; font-weight: 700; margin-left: 4px;">${dateStr}</span>
          </div>
        </div>
      </div>

      <!-- Customer & Booker Details (No Boxes, Line Below Header) -->
      <div style="display: flex; gap: 20px; margin: 10px 0 12px;">
        <div style="flex: 1;">
          <div style="font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; color: #64748b; padding-bottom: 3px; border-bottom: 1.5px solid #cbd5e1; margin-bottom: 5px;">
            Billed To
          </div>
          <div style="font-size: 12px; line-height: 1.35; color: #1e293b;">
            <div style="font-weight: 700; color: #0f172a; font-size: 13px; margin-bottom: 2px;">${order.customerName || 'Customer / Shop'}</div>
            <div style="color: #475569; margin-top: 1px;">
              <span style="font-weight: 600; color: #64748b;">Address:</span> ${order.customerAddress || '—'}
            </div>
            <div style="color: #475569; margin-top: 1px;">
              <span style="font-weight: 600; color: #64748b;">Mobile:</span> ${order.customerPhone || '—'}
            </div>
          </div>
        </div>

        <div style="flex: 1;">
          <div style="font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; color: #64748b; padding-bottom: 3px; border-bottom: 1.5px solid #cbd5e1; margin-bottom: 5px;">
            Order Booker / Employee
          </div>
          <div style="font-size: 12px; line-height: 1.35; color: #1e293b;">
            <div style="font-weight: 700; color: #0f172a; font-size: 13px; margin-bottom: 2px;">${order.createdByName || '—'}</div>
            <div style="color: #64748b; margin-top: 1px;">
              <span style="font-weight: 600;">Payment:</span> ${order.paymentType === 'cash' || order.paymentStatus === 'paid' ? 'Cash' : 'Credit'}
            </div>
          </div>
        </div>
      </div>

      ${order.notes ? `
        <div style="margin-bottom: 10px; padding: 6px 10px; background-color: #fffbe6; border-left: 3px solid #f59e0b; border-radius: 3px;">
          <span style="font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; color: #b45309; margin-right: 6px;">Order Notes:</span>
          <span style="font-size: 11px; color: #78350f;">${order.notes}</span>
        </div>
      ` : ''}

      <!-- Order Items Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
        <thead>
          <tr style="background-color: #f1f5f9; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; font-size: 10px;">
            <th style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; width: 10%;">Qty</th>
            <th style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: left;">Item / Product</th>
            <th style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; width: 22%;">Returned</th>
            <th style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: right; width: 20%;">Price</th>
            <th style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: right; width: 22%;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <!-- Financial Totals Table with Explicit Returns Deduction -->
      <div style="display: flex; justify-content: flex-end; margin-bottom: 14px;">
        <table style="width: 270px; border-collapse: collapse; font-size: 11px;">
          <tr>
            <td style="padding: 4px 8px; border: 1px solid #e2e8f0; color: #64748b;">Subtotal</td>
            <td style="padding: 4px 8px; border: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #0f172a;">${formatVal(grossOriginalSubtotal)}</td>
          </tr>
          ${totalReturnedAmount > 0 ? `
            <tr>
              <td style="padding: 4px 8px; border: 1px solid #e2e8f0; color: #ef4444;">Returned Items (-)</td>
              <td style="padding: 4px 8px; border: 1px solid #e2e8f0; text-align: right; color: #ef4444; font-weight: 600;">-${formatVal(totalReturnedAmount)}</td>
            </tr>
            <tr style="background-color: #f8fafc;">
              <td style="padding: 4px 8px; border: 1px solid #e2e8f0; color: #475569; font-weight: 600;">Net Subtotal</td>
              <td style="padding: 4px 8px; border: 1px solid #e2e8f0; text-align: right; color: #0f172a; font-weight: 600;">${formatVal(netSubtotal)}</td>
            </tr>
          ` : ''}
          ${discountPct > 0 ? `
            <tr>
              <td style="padding: 4px 8px; border: 1px solid #e2e8f0; color: #64748b;">Discount (${discountPct}%)</td>
              <td style="padding: 4px 8px; border: 1px solid #e2e8f0; text-align: right; color: #ef4444; font-weight: 600;">-${formatVal(discountAmount)}</td>
            </tr>
          ` : ''}
          <tr style="background-color: #f8fafc; font-weight: 700; font-size: 14px;">
            <td style="padding: 6px 8px; border: 1.5px solid #cbd5e1; color: #0f172a;">Total</td>
            <td style="padding: 6px 8px; border: 1.5px solid #cbd5e1; text-align: right; color: #2563eb;">${formatVal(finalNetTotal)}</td>
          </tr>
        </table>
      </div>

      <!-- Footer Note -->
      <div style="margin-top: 16px; padding-top: 10px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 10px; color: #94a3b8;">
        Thank you for your business! · Generated electronically by ${displayName}
      </div>

    </div>
  `;
};

/**
 * Export single order invoice to PDF (forced single-page fitting)
 */
export const exportOrderInvoiceToPDF = async (order, companyName = 'COMPANY', currencySymbol = 'Rs') => {
  const html = generateOrderInvoiceHTML(order, companyName, currencySymbol);
  const filename = `invoice-${order.orderNumber || order.id}`;
  await exportHtmlToPDF(html, filename, { fitToSinglePage: true });
};

/**
 * Export multiple order invoices into ONE single PDF file (1 order per page)
 */
export const exportMultipleInvoicesToPDF = async (orders = [], companyName = 'COMPANY', currencySymbol = 'Rs') => {
  if (!orders || orders.length === 0) return;

  if (orders.length === 1) {
    await exportOrderInvoiceToPDF(orders[0], companyName, currencySymbol);
    return;
  }

  const pdf = new jsPDF('p', 'mm', 'a5');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    const htmlContent = generateOrderInvoiceHTML(order, companyName, currencySymbol);

    const element = document.createElement('div');
    element.innerHTML = htmlContent;
    element.id = `pdf-export-${Date.now()}-${i}`;
    element.style.width = `${A5_WIDTH_PX}px`;
    element.style.minHeight = `${A5_HEIGHT_PX}px`;
    element.style.boxSizing = 'border-box';
    element.style.backgroundColor = '#ffffff';
    element.style.position = 'absolute';
    element.style.left = '-9999px';
    element.style.top = '0';
    document.body.appendChild(element);

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
      });

      const imgData = canvas.toDataURL('image/png');

      if (i > 0) {
        pdf.addPage();
      }

      let renderWidth = pdfWidth;
      let renderHeight = (canvas.height * renderWidth) / canvas.width;

      if (renderHeight > pdfHeight) {
        const scale = pdfHeight / renderHeight;
        renderHeight = pdfHeight;
        renderWidth *= scale;
      }

      const { x, y } = centerOnPage(pdf, renderWidth, renderHeight);
      pdf.addImage(imgData, 'PNG', x, y, renderWidth, renderHeight);
    } catch (error) {
      console.error(`Error adding order ${order.orderNumber || order.id} to combined PDF:`, error);
    } finally {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }
  }

  const dateTag = new Date().toISOString().split('T')[0];
  pdf.save(`invoices-combined-${dateTag}.pdf`);
};

/**
 * Generate Checklist PDF HTML layout
 */
export const generateSummaryHTML = (summaries = [], period = 'All Time', companyName = 'COMPANY', currencySymbol = 'Rs') => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const printedOn = `${day}/${month}/${now.getFullYear()}`;
  const formattedPeriod = period.charAt(0).toUpperCase() + period.slice(1);
  const displayName = companyName.trim() ? companyName.toUpperCase() : 'COMPANY';

  const formatCurrencyVal = (val) => `${currencySymbol} ${(Number(val) || 0).toLocaleString()}`;

  const formatOriginalAmount = (qty, totalValue) => {
    if (!qty || qty <= 0) return '';
    const perPiece = qty > 0 ? totalValue / qty : 0;
    return `
      <div style="font-weight: 400; color: #111827;">${qty.toLocaleString()} × ${formatCurrencyVal(perPiece)}</div>
    `;
  };

  const tableRows = summaries.length > 0
    ? summaries
        .map((summary, index) => {
          const rowBackground = index % 2 === 0 ? '#ffffff' : '#f9fafb';

          return `
            <tr style="background-color: ${rowBackground};">
              <td style="padding: 14px; border-bottom: 1px solid #dfe3eb; border-right: 1px solid #cbd5e1;">
                <div style="font-weight: 500; color: #1f2933; font-size: 13px;">${summary.productName}</div>
                ${summary.categoryName ? `<div style="margin-top: 3px; font-size: 11px; color: #64748b;">${summary.categoryName}</div>` : ''}
              </td>
              <td style="padding: 14px; border-bottom: 1px solid #dfe3eb; border-right: 1px solid #cbd5e1;">
                ${formatOriginalAmount(summary.totalOrderedQuantity, summary.totalOrderedValue)}
              </td>
              <td style="padding: 14px; border-bottom: 1px solid #dfe3eb; border-right: 1px solid #cbd5e1;"></td>
              <td style="padding: 14px; border-bottom: 1px solid #dfe3eb; border-right: 1px solid #cbd5e1;"></td>
              <td style="padding: 14px; border-bottom: 1px solid #dfe3eb;"></td>
            </tr>
          `;
        })
        .join('')
    : `
      <tr>
        <td colspan="5" style="padding: 40px 16px; border: 1px solid #e5e7eb; text-align: center; color: #9aa5b1; font-weight: 400;">
          No product data available for this selection.
        </td>
      </tr>
    `;

  const totalOriginalAmount = summaries.reduce((sum, s) => sum + (s.totalOrderedValue || 0), 0);

  return `
    <div id="summary-pdf" style="font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f0f2f5; padding: 30px 0; min-height: ${A5_HEIGHT_PX}px;">
      <div style="width: ${A5_WIDTH_PX}px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 18px 45px rgba(15, 23, 42, 0.14); border-radius: 14px; overflow: hidden;">
        <div style="height: 14px; background: linear-gradient(90deg, #2563eb 0%, #3b82f6 25%, #8b5cf6 50%, #ec4899 75%, #f59e0b 100%);"></div>
        <div style="padding: 32px 36px;">
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="font-size: 26px; font-weight: 700; letter-spacing: 0.06em; color: #1e293b; text-transform: uppercase;">
              ${displayName}
            </div>
            <div style="display: flex; align-items: center; gap: 16px; font-size: 11px; font-weight: 600; color: #64748b; letter-spacing: 0.06em; text-transform: uppercase;">
              <span style="color: #2563eb; background-color: #eff6ff; padding: 4px 8px; border-radius: 6px; border: 1px solid #bfdbfe;">Checklist PDF</span>
              <span>Printed: <span style="color: #1e293b;">${printedOn}</span></span>
              <span>Period: <span style="color: #1e293b;">${formattedPeriod}</span></span>
            </div>
          </div>
          
          <div style="margin-top: 24px; border: 1.5px solid #cbd5e1; border-radius: 10px; overflow: hidden;">
            <table style="width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; color: #1f2933;">
              <thead>
                <tr style="background-color: #f1f5f9; text-transform: uppercase; letter-spacing: 0.05em; color: #475569;">
                  <th style="padding: 12px 14px; border-bottom: 1.5px solid #cbd5e1; border-right: 1px solid #cbd5e1; width: 25%; text-align: left;">Product</th>
                  <th style="padding: 12px 14px; border-bottom: 1.5px solid #cbd5e1; border-right: 1px solid #cbd5e1; width: 22%; text-align: left;">Original Amount</th>
                  <th style="padding: 12px 14px; border-bottom: 1.5px solid #cbd5e1; border-right: 1px solid #cbd5e1; width: 18%; text-align: left;">Returns</th>
                  <th style="padding: 12px 14px; border-bottom: 1.5px solid #cbd5e1; border-right: 1px solid #cbd5e1; width: 18%; text-align: left;">Sales</th>
                  <th style="padding: 12px 14px; border-bottom: 1.5px solid #cbd5e1; width: 17%; text-align: left;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
              <tfoot>
                <tr style="background-color: #f8fafc; font-weight: 600; color: #0f172a;">
                  <td style="padding: 14px; border-top: 1.5px solid #cbd5e1; border-right: 1px solid #cbd5e1;">Totals</td>
                  <td style="padding: 14px; border-top: 1.5px solid #cbd5e1; border-right: 1px solid #cbd5e1; color: #2563eb;">
                    ${formatCurrencyVal(totalOriginalAmount)}
                  </td>
                  <td style="padding: 14px; border-top: 1.5px solid #cbd5e1; border-right: 1px solid #cbd5e1;"></td>
                  <td style="padding: 14px; border-top: 1.5px solid #cbd5e1; border-right: 1px solid #cbd5e1;"></td>
                  <td style="padding: 14px; border-top: 1.5px solid #cbd5e1;"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
};
