const ExcelJS = require('exceljs');
const path = require('node:path');
async function main() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Mesclagens');
  sheet.columns = Array.from({length:8}, () => ({width:15}));
  sheet.mergeCells('A1:E1'); sheet.getCell('A1').value='LABORATÓRIO 1 | CORREÇÃO DE ERRO';
  sheet.mergeCells('A3:B4'); sheet.getCell('A3').value='CONTEXTO DO PROBLEMA\nUma descrição extensa deve continuar legível: observe os dados do processo, identifique a diferença entre previsão e resultado e explique como corrigir o erro sem esconder nenhuma parte desta orientação.';
  sheet.mergeCells('C6:F6'); sheet.getCell('C6').value='OBJETIVO DO ALUNO';
  sheet.mergeCells('H1:H4'); sheet.getCell('H1').value='VERTICAL\nQUATRO\nLINHAS';
  sheet.mergeCells('B8:D10'); sheet.getCell('B8').value='RETANGULAR 3 × 3\nÁrea de leitura compartilhada.';
  sheet.mergeCells('A12:C12'); sheet.getCell('A12').value={formula:'SUM(F12:G12)',result:999};
  sheet.getCell('F12').value=3; sheet.getCell('G12').value=4;
  sheet.getCell('H14').value='Fim';
  for(const address of ['A1','A3','C6','H1','B8','A12']) sheet.getCell(address).alignment={wrapText:true,horizontal:'left',vertical:'middle'};
  sheet.getRow(1).height=30; sheet.getRow(3).height=18; sheet.getRow(6).height=25;
  await workbook.xlsx.writeFile(path.join(__dirname,'merged-cells.xlsx'));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
