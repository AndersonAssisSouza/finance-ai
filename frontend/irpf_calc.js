/* Finance AI — Calculadora de IR completa
 *
 * Tabela progressiva 2025 (ano-base 2024):
 *   até   2.259,20: isento
 *   até   2.826,65: 7.5%  — parcela a deduzir   169,44
 *   até   3.751,05: 15%   — parcela a deduzir   381,44
 *   até   4.664,68: 22.5% — parcela a deduzir   662,77
 *   acima        : 27.5% — parcela a deduzir   896,00
 *
 * Simplificada: 20% sobre rendimento tributável (teto R$ 16.754,34)
 * Dedução padrão (simples): R$ 1.844,32 por dependente (valor de referência)
 */

const TABELA_2024 = [
  { limite: 2259.20,  aliquota: 0.00,  deduzir: 0 },
  { limite: 2826.65,  aliquota: 0.075, deduzir: 169.44 },
  { limite: 3751.05,  aliquota: 0.15,  deduzir: 381.44 },
  { limite: 4664.68,  aliquota: 0.225, deduzir: 662.77 },
  { limite: Infinity, aliquota: 0.275, deduzir: 896.00 }
];

const TETO_DESCONTO_SIMPLIFICADO = 16754.34;
const DEPENDENTE_DEDUCAO_ANUAL = 2275.08; // referência
const EDUCACAO_TETO = 3561.50;           // por pessoa/ano
const PREVIDENCIA_TETO_PCT = 0.12;       // do rendimento bruto
const SAUDE_SEM_TETO = true;

function calcularImpostoMensal(rendimentoMensal) {
  for (const faixa of TABELA_2024) {
    if (rendimentoMensal <= faixa.limite) {
      return Math.max(0, rendimentoMensal * faixa.aliquota - faixa.deduzir);
    }
  }
  return 0;
}

function calcularImpostoAnual(rendimentoAnual) {
  const mensal = rendimentoAnual / 12;
  return calcularImpostoMensal(mensal) * 12;
}

/**
 * Calcula imposto devido com ambas modalidades (completa × simplificada)
 * e retorna a que gera menor imposto.
 *
 * Entrada:
 *   rendimentoTributavel: bruto anual
 *   imposto_retido: IRRF já pago na fonte
 *   deducoes: {
 *     dependentes: qtde,
 *     previdencia: R$,
 *     saude: R$,
 *     educacao: R$ (somatório por dependente, cada um com teto),
 *     pensao: R$
 *   }
 *
 * Saída:
 *   { escolhida, simplificada, completa, restituicao_ou_pagar, detalhes }
 */
function calcularDeclaracao(input) {
  const rend = +input.rendimentoTributavel || 0;
  const rendIsento = +input.rendimentoIsento || 0;
  const retido = +input.irretido || 0;
  const d = input.deducoes || {};

  // Modalidade simplificada: 20% do rendimento, teto R$ 16.754
  const descontoSimples = Math.min(rend * 0.20, TETO_DESCONTO_SIMPLIFICADO);
  const baseSimples = Math.max(0, rend - descontoSimples);
  const impostoSimples = calcularImpostoAnual(baseSimples);

  // Modalidade completa: deduções efetivas
  const dedDependentes = (+d.dependentes || 0) * DEPENDENTE_DEDUCAO_ANUAL;
  const dedPrevidencia = Math.min(+d.previdencia || 0, rend * PREVIDENCIA_TETO_PCT);
  const dedSaude = +d.saude || 0;
  const dedEducacao = Math.min(+d.educacao || 0, (1 + (+d.dependentes || 0)) * EDUCACAO_TETO);
  const dedPensao = +d.pensao || 0;
  const totalDeducoes = dedDependentes + dedPrevidencia + dedSaude + dedEducacao + dedPensao;

  const baseCompleta = Math.max(0, rend - totalDeducoes);
  const impostoCompleto = calcularImpostoAnual(baseCompleta);

  // Escolhe menor
  const escolhida = impostoCompleto < impostoSimples ? "completa" : "simplificada";
  const impostoDevido = Math.min(impostoCompleto, impostoSimples);
  const saldo = retido - impostoDevido; // positivo = restituição, negativo = a pagar

  return {
    rendimento: rend,
    rendimentoIsento: rendIsento,
    retido,
    simplificada: {
      desconto: descontoSimples,
      base: baseSimples,
      imposto: impostoSimples,
      aliquotaEfetiva: rend > 0 ? (impostoSimples / rend * 100) : 0
    },
    completa: {
      deducoes: {
        dependentes: dedDependentes,
        previdencia: dedPrevidencia,
        saude: dedSaude,
        educacao: dedEducacao,
        pensao: dedPensao,
        total: totalDeducoes
      },
      base: baseCompleta,
      imposto: impostoCompleto,
      aliquotaEfetiva: rend > 0 ? (impostoCompleto / rend * 100) : 0
    },
    escolhida,
    impostoDevido,
    saldo,                     // >0 restituição, <0 a pagar
    restituicao: Math.max(0, saldo),
    aPagar: Math.max(0, -saldo)
  };
}

/**
 * Carnê-leão: imposto mensal sobre rendimentos de PJ, aluguéis recebidos,
 * trabalho sem CLT. Calcula valor a pagar em DARF código 0190.
 */
function calcularCarneLeao(rendimentoMensal, deducoesMensais = 0) {
  const base = Math.max(0, rendimentoMensal - deducoesMensais);
  return {
    rendimento: rendimentoMensal,
    deducoes: deducoesMensais,
    base,
    imposto: calcularImpostoMensal(base),
    codigoDARF: "0190"
  };
}

/**
 * Ganho de capital em investimentos (simples):
 * Lucro = valor atual - valor pago
 * Ações (acima de 20k/mês): 15% sobre lucro
 * FII: 20% sobre lucro
 * Cripto: 15% (isento até 35k/mês)
 */
function calcularGanhoCapital(investments) {
  const out = [];
  for (const i of investments) {
    const custo = i.quantity * i.avg_price;
    const valor = i.quantity * i.current_price;
    const lucro = valor - custo;
    let aliquota = 0, isento = false;
    if (i.type === "acoes") aliquota = 0.15;
    else if (i.type === "fii") aliquota = 0.20;
    else if (i.type === "cripto") aliquota = 0.15;
    else aliquota = 0.15; // outros
    out.push({
      ticker: i.ticker || i.name,
      tipo: i.type,
      custo, valor, lucro,
      aliquota,
      imposto_potencial: lucro > 0 ? lucro * aliquota : 0
    });
  }
  return out;
}

window.IRPFCalc = {
  TABELA_2024, DEPENDENTE_DEDUCAO_ANUAL,
  calcularImpostoMensal, calcularImpostoAnual,
  calcularDeclaracao, calcularCarneLeao, calcularGanhoCapital
};
