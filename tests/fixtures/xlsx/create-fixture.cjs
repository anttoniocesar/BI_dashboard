// Controlled fixture authoring only; Excel-specific code never enters the Lab.
const ExcelJS = require('exceljs');
const path = require('node:path');

(async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BI.Society — fixture técnica';
  workbook.created = new Date('2026-01-01T00:00:00Z');
  workbook.modified = new Date('2026-01-01T00:00:00Z');
  const data = workbook.addWorksheet('Dados base');
  data.getCell('A1').value = 10;
  data.getCell('B1').value = 20;
  data.getCell('C1').value = true;
  data.getCell('D1').value = { text: 'Link inerte', hyperlink: 'https://example.invalid/never-open' };
  data.getCell('A2').value = 'Temperatura';
  data.getCell('B2').value = '001';
  data.getCell('C2').value = '=SUM(A1:B1)'; // Text, not a formula.
  data.getCell('B3').value = false;
  for (const [index, formula] of ['SUM(A1:B1)', 'AVERAGE(A1:B1)', 'MIN(A1:B1)', 'MAX(A1:B1)', 'ABS(-10)', 'SQRT(100)', 'POWER(2,3)'].entries()) {
    data.getCell(`A${index + 3}`).value = { formula, result: 999 };
  }
  data.getCell('A10').value = new Date('2026-01-01T00:00:00Z');
  data.getCell('A10').numFmt = 'yyyy-mm-dd';
  data.getCell('A1').font = { bold: true, italic: true, color: { argb: 'FF142D4E' } };
  data.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF5CF' } };
  data.getCell('A1').alignment = { horizontal: 'right', vertical: 'middle', wrapText: true };
  data.getCell('A1').numFmt = '0.00';
  data.getCell('B1').protection = { locked: false, hidden: true };
  data.getColumn(1).width = 24;
  data.getColumn(2).width = 16;
  data.getRow(1).height = 28;
  await data.protect('fixture', { spinCount: 1 });
  workbook.definedNames.add("'Dados base'!$A$1", 'ValorBase');
  const result = workbook.addWorksheet('Resultado & análise');
  result.getCell('A1').value = { formula: "'Dados base'!A1+'Dados base'!B1", result: 999 };
  result.getCell('A2').value = { formula: "'Dados base'!$A$1*2", result: 999 };
  result.getCell('A3').value = { formula: 'IF(A1>0,1,0)', result: 1 };
  result.getCell('A4').value = { formula: '$A$1+A$2+$A1', result: 999 };
  result.getCell('A5').value = { formula: "SUM('Dados base'!A1:B1)", result: 999 };
  result.getCell('C4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F3F7' } };
  result.mergeCells('E1:F1');
  result.getCell('E1').value = 'Mesclada';
  await workbook.xlsx.writeFile(path.join(__dirname, 'controlled.xlsx'));
  console.log('Fixture controlled.xlsx criada.');
})().catch(error => { console.error(error); process.exitCode = 1; });
