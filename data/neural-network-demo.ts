import type { SheetData, Workbook } from "@/types/spreadsheet";

export const ROW_COUNT = 40;
export const COLUMN_COUNT = 12;

/** A fresh workbook for each mount; switching tabs never calls this initializer. */
export function createInitialWorkbook(): Workbook {
  const dados: SheetData = {
    A1: "Amostra", B1: "x1", C1: "x2", D1: "Saída real",
    A2: "1", B2: "0.20", C2: "0.40", D2: "0.30",
    A3: "2", B3: "0.30", C3: "0.50", D3: "0.38",
    A4: "3", B4: "0.50", C4: "0.80", D4: "0.62",
    A5: "4", B5: "0.60", C5: "0.70", D5: "0.65",
    A6: "5", B6: "0.80", C6: "0.90", D6: "0.85",
    A8: "Peso inicial w1", B8: "0.20",
    A9: "Peso inicial w2", B9: "0.30",
    A10: "Taxa de aprendizado η", B10: "0.10",
  };
  const treinamento: SheetData = {
    A1: "Amostra", B1: "x1", C1: "x2", D1: "w1", E1: "w2",
    F1: "Saída prevista", G1: "Saída real", H1: "Erro", I1: "Novo w1", J1: "Novo w2",
  };
  const resultados: SheetData = {
    A1: "Amostra", B1: "Saída real", C1: "Saída prevista", D1: "Erro absoluto",
    A8: "MAE", B8: "=AVERAGE(D2:D6)",
  };
  for (let row = 2; row <= 6; row++) {
    Object.assign(treinamento, {
      [`A${row}`]: `=Dados!A${row}`, [`B${row}`]: `=Dados!B${row}`,
      [`C${row}`]: `=Dados!C${row}`, [`G${row}`]: `=Dados!D${row}`,
      [`D${row}`]: row === 2 ? "=Dados!$B$8" : `=I${row - 1}`,
      [`E${row}`]: row === 2 ? "=Dados!$B$9" : `=J${row - 1}`,
      [`F${row}`]: `=B${row}*D${row}+C${row}*E${row}`,
      [`H${row}`]: `=G${row}-F${row}`,
      [`I${row}`]: `=D${row}+Dados!$B$10*H${row}*B${row}`,
      [`J${row}`]: `=E${row}+Dados!$B$10*H${row}*C${row}`,
    });
    Object.assign(resultados, {
      [`A${row}`]: `=Treinamento!A${row}`, [`B${row}`]: `=Treinamento!G${row}`,
      [`C${row}`]: `=Treinamento!F${row}`, [`D${row}`]: `=ABS(B${row}-C${row})`,
    });
  }
  return { worksheets: [
    { id: "dados", name: "Dados", cells: dados },
    { id: "treinamento", name: "Treinamento", cells: treinamento },
    { id: "resultados", name: "Resultados", cells: resultados },
    { id: "analise", name: "Análise", cells: {
      A1: "Análise do treinamento", B1: "Perguntas e respostas",
      A2: "Questão 1", B2: "Qual peso sofreu a maior variação?", A3: "Sua resposta",
      A5: "Questão 2", B5: "O erro diminuiu durante o treinamento?", A6: "Sua resposta",
      A8: "Questão 3", B8: "O que pode acontecer se a taxa de aprendizado for muito alta?", A9: "Sua resposta",
    } },
  ] };
}
