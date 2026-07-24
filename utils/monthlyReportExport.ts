import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from './currency';
import { buildMonthlyReport, monthlyReportFilename, type MonthlyReport, type MonthlyReportData, type MonthlyReportGroup, type MonthlyReportMetadata } from './monthlyReport';

const percentage = (value: number): string => `${(value * 100).toFixed(1)}%`;
const generatedLabel = (date: Date): string => date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

const addPdfFooter = (doc: jsPDF, metadata: MonthlyReportMetadata) => {
  const drawingDoc = doc as any;
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    drawingDoc.setDrawColor(226, 232, 240);
    drawingDoc.line(14, doc.internal.pageSize.height - 13, doc.internal.pageSize.width - 14, doc.internal.pageSize.height - 13);
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`${metadata.locationName} | ${metadata.dateFrom} to ${metadata.dateTo} | Production-based profitability`, 14, doc.internal.pageSize.height - 8);
    doc.text(`Page ${page} of ${pageCount}`, doc.internal.pageSize.width - 14, doc.internal.pageSize.height - 8, { align: 'right' });
  }
};

const addPdfGroupTable = (doc: jsPDF, title: string, groups: MonthlyReportGroup[], startY: number, metadata: MonthlyReportMetadata) => {
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(title, 14, startY);
  autoTable(doc, {
    startY: startY + 4,
    head: [['Category', 'Treatments', 'Patients', 'Production', 'Payment', 'Total Cost', 'Net Profit', 'Margin']],
    body: groups.slice(0, 15).map(group => [
      group.name, String(group.treatments), String(group.patients), formatCurrency(group.production, metadata.currency),
      formatCurrency(group.payment, metadata.currency), formatCurrency(group.totalCost, metadata.currency),
      formatCurrency(group.netProfit, metadata.currency), percentage(group.netMargin)
    ]),
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 7, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14, bottom: 18 }
  });
};

export const exportMonthlyReportToPDF = (data: MonthlyReportData, metadata: MonthlyReportMetadata) => {
  const report = buildMonthlyReport(data);
  const generatedAt = metadata.generatedAt || new Date();
  const doc = new jsPDF('landscape', 'mm', 'a3');
  const drawingDoc = doc as any;
  const width = doc.internal.pageSize.width;

  drawingDoc.setFillColor(15, 23, 42);
  drawingDoc.rect(0, 0, width, 38, 'F');
  doc.setFontSize(21);
  doc.setTextColor(255, 255, 255);
  doc.text('Monthly Treatment & Profitability Report', 14, 17);
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(`${metadata.locationName}  |  ${metadata.dateFrom} to ${metadata.dateTo}  |  ${metadata.currency}`, 14, 27);
  doc.text(`Generated ${generatedLabel(generatedAt)}`, width - 14, 27, { align: 'right' });

  const cards = [
    ['Treatments', String(report.summary.treatmentCount)],
    ['Patients', String(report.summary.patientCount)],
    ['Production', formatCurrency(report.summary.production, metadata.currency)],
    ['Payments', formatCurrency(report.summary.payment, metadata.currency)],
    ['Total Cost', formatCurrency(report.summary.totalCost, metadata.currency)],
    ['Net Profit', formatCurrency(report.summary.netProfit, metadata.currency)],
    ['Net Margin', percentage(report.summary.netMargin)],
    ['Collection Rate', percentage(report.summary.collectionRate)]
  ];
  const cardWidth = (width - 28 - 7 * 3) / 8;
  cards.forEach(([label, value], index) => {
    const x = 14 + index * (cardWidth + 3);
    drawingDoc.setFillColor(index === 5 ? 236 : 248, index === 5 ? 253 : 250, index === 5 ? 245 : 252);
    drawingDoc.setDrawColor(index === 5 ? 167 : 226, index === 5 ? 243 : 232, index === 5 ? 208 : 240);
    drawingDoc.roundedRect(x, 44, cardWidth, 20, 2, 2, 'FD');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(label.toUpperCase(), x + 3, 50);
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    drawingDoc.text(value, x + 3, 59, { maxWidth: cardWidth - 6 });
  });

  autoTable(doc, {
    startY: 71,
    head: [['Date', 'Pt Name', 'Age', 'Phone', 'City', 'Pt Type', 'Treatment', 'Dentist / Doctor', 'Cost', 'Payment', 'Balance', 'Lab Cost', 'Material Cost', 'Doctor Cost', 'Total Cost', 'Net Profit']],
    body: report.rows.length ? report.rows.map(row => [
      row.date, row.patientName, row.age === null ? '-' : String(row.age), row.phone, row.city, row.patientType,
      row.treatment, row.doctor, formatCurrency(row.cost, metadata.currency), formatCurrency(row.payment, metadata.currency),
      formatCurrency(row.balance, metadata.currency), formatCurrency(row.labCost, metadata.currency), formatCurrency(row.materialCost, metadata.currency),
      formatCurrency(row.doctorCost, metadata.currency), formatCurrency(row.totalCost, metadata.currency), formatCurrency(row.netProfit, metadata.currency)
    ]) : [['No treatments were recorded in this period.', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']],
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 6, fontStyle: 'bold', halign: 'center', valign: 'middle' },
    bodyStyles: { fontSize: 5.8, textColor: [30, 41, 59], cellPadding: 1.5, valign: 'middle' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 18 }, 1: { cellWidth: 25 }, 2: { cellWidth: 9, halign: 'center' }, 3: { cellWidth: 20 },
      4: { cellWidth: 17 }, 5: { cellWidth: 18 }, 6: { cellWidth: 31 }, 7: { cellWidth: 25 },
      8: { halign: 'right' }, 9: { halign: 'right' }, 10: { halign: 'right' }, 11: { halign: 'right' },
      12: { halign: 'right' }, 13: { halign: 'right' }, 14: { halign: 'right' }, 15: { halign: 'right' }
    },
    didParseCell: hook => {
      if (hook.section === 'body' && hook.column.index === 15 && report.rows[hook.row.index]?.netProfit < 0) {
        hook.cell.styles.textColor = [190, 24, 93];
        hook.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { left: 8, right: 8, bottom: 18 }
  });

  doc.addPage();
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text('Performance Analysis', 14, 20);
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Ranked by treatment production. Top 15 categories are shown in each section.', 14, 28);
  addPdfGroupTable(doc, 'Treatment Performance', report.byTreatment, 39, metadata);
  const firstEnd = Number((doc as any).lastAutoTable?.finalY || 85);
  addPdfGroupTable(doc, 'Clinician Performance', report.byDoctor, firstEnd + 10, metadata);
  const secondEnd = Number((doc as any).lastAutoTable?.finalY || 145);
  if (secondEnd > doc.internal.pageSize.height - 65) doc.addPage();
  addPdfGroupTable(doc, 'Patient Type Performance', report.byPatientType, secondEnd > doc.internal.pageSize.height - 65 ? 20 : secondEnd + 10, metadata);

  addPdfFooter(doc, metadata);
  doc.save(monthlyReportFilename(metadata, 'pdf'));
};

const currencyFormat = (currency: MonthlyReportMetadata['currency']) => currency === 'MMK' ? '#,##0" Ks"' : '$#,##0.00';

const styleSheet = (worksheet: any, range: string, currencyColumns: number[], percentColumns: number[] = []) => {
  worksheet['!autofilter'] = { ref: range };
  worksheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
  const decoded = range.match(/:([A-Z]+)(\d+)$/);
  const rowCount = decoded ? Number(decoded[2]) : 1;
  for (let row = 2; row <= rowCount; row += 1) {
    currencyColumns.forEach(column => {
      const cell = worksheet[`${String.fromCharCode(65 + column)}${row}`];
      if (cell?.t === 'n') cell.z = worksheet.__currencyFormat;
    });
    percentColumns.forEach(column => {
      const cell = worksheet[`${String.fromCharCode(65 + column)}${row}`];
      if (cell?.t === 'n') cell.z = '0.0%';
    });
  }
};

const groupSheetRows = (groups: MonthlyReportGroup[]) => groups.map(group => ({
  Category: group.name, Treatments: group.treatments, Patients: group.patients, Production: group.production,
  Payment: group.payment, 'Total Cost': group.totalCost, 'Net Profit': group.netProfit, 'Net Margin': group.netMargin
}));

export const exportMonthlyReportToExcel = async (data: MonthlyReportData, metadata: MonthlyReportMetadata) => {
  const XLSX = await import('xlsx');
  const report: MonthlyReport = buildMonthlyReport(data);
  const workbook = XLSX.utils.book_new();
  const generatedAt = metadata.generatedAt || new Date();
  const summaryRows: Array<[string, string | number]> = [
    ['MONTHLY TREATMENT & PROFITABILITY REPORT', ''], ['Report Scope', metadata.locationName], ['Date From', metadata.dateFrom],
    ['Date To', metadata.dateTo], ['Generated', generatedLabel(generatedAt)], ['Currency', metadata.currency], ['', ''],
    ['Treatments', report.summary.treatmentCount], ['Distinct Patients', report.summary.patientCount], ['Production', report.summary.production],
    ['Payment', report.summary.payment], ['Treatment Balance', report.summary.balance], ['Material Cost', report.summary.materialCost],
    ['Lab Cost', report.summary.labCost], ['Doctor Cost', report.summary.doctorCost], ['Total Cost', report.summary.totalCost],
    ['Net Profit', report.summary.netProfit], ['Net Margin', report.summary.netMargin], ['Collection Rate', report.summary.collectionRate], ['', ''],
    ['Definition', 'Net Profit = Treatment Cost - Material Cost - Lab Cost - Doctor Cost. Unrelated operating expenses are excluded.']
  ];
  const summarySheet: any = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet['!cols'] = [{ wch: 24 }, { wch: 90 }];
  [10, 11, 12, 13, 14, 15, 16, 17].forEach(row => { if (summarySheet[`B${row}`]?.t === 'n') summarySheet[`B${row}`].z = currencyFormat(metadata.currency); });
  [18, 19].forEach(row => { if (summarySheet[`B${row}`]?.t === 'n') summarySheet[`B${row}`].z = '0.0%'; });
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Executive Summary');

  const detailRows = report.rows.map(row => ({
    Date: row.date, 'Pt Name': row.patientName, Age: row.age ?? '', Phone: row.phone, City: row.city, 'Pt Type': row.patientType,
    Treatment: row.treatment, 'Dentist / Doctor': row.doctor, Cost: row.cost, Payment: row.payment, Balance: row.balance,
    'Lab Cost': row.labCost, 'Material Cost': row.materialCost, 'Doctor Cost': row.doctorCost, 'Total Cost': row.totalCost,
    'Net Profit': row.netProfit, 'Net Margin': row.netMargin
  }));
  const detailSheet: any = XLSX.utils.json_to_sheet(detailRows, { header: ['Date', 'Pt Name', 'Age', 'Phone', 'City', 'Pt Type', 'Treatment', 'Dentist / Doctor', 'Cost', 'Payment', 'Balance', 'Lab Cost', 'Material Cost', 'Doctor Cost', 'Total Cost', 'Net Profit', 'Net Margin'] });
  detailSheet['!cols'] = [12, 24, 8, 17, 16, 16, 30, 24, 15, 15, 15, 15, 16, 15, 15, 15, 13].map(wch => ({ wch }));
  detailSheet.__currencyFormat = currencyFormat(metadata.currency);
  styleSheet(detailSheet, `A1:Q${Math.max(1, detailRows.length + 1)}`, [8, 9, 10, 11, 12, 13, 14, 15], [16]);
  delete detailSheet.__currencyFormat;
  XLSX.utils.book_append_sheet(workbook, detailSheet, 'Treatment Detail');

  const appendGroupSheet = (name: string, groups: MonthlyReportGroup[]) => {
    const rows = groupSheetRows(groups);
    const sheet: any = XLSX.utils.json_to_sheet(rows, { header: ['Category', 'Treatments', 'Patients', 'Production', 'Payment', 'Total Cost', 'Net Profit', 'Net Margin'] });
    sheet['!cols'] = [32, 12, 12, 16, 16, 16, 16, 13].map(wch => ({ wch }));
    sheet.__currencyFormat = currencyFormat(metadata.currency);
    styleSheet(sheet, `A1:H${Math.max(1, rows.length + 1)}`, [3, 4, 5, 6], [7]);
    delete sheet.__currencyFormat;
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  };
  appendGroupSheet('By Treatment', report.byTreatment);
  appendGroupSheet('By Doctor', report.byDoctor);
  appendGroupSheet('By Patient Type', report.byPatientType);
  XLSX.writeFile(workbook, monthlyReportFilename(metadata, 'xlsx'));
};