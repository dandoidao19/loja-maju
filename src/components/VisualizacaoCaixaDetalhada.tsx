'use client'

import { supabase } from '@/lib/supabase'
import { useEffect, useState, useCallback } from 'react'
import { getDataAtualBrasil, getMesAtualParaInput, prepararDataParaInsert, formatarDataParaExibicao } from '@/lib/dateUtils'

interface LancamentoFinanceiro {
  id: string
  descricao: string
  valor: number
  tipo: string
  data_lancamento: string
  data_prevista: string
  status: string
  centro_custo_id: string
}

interface TransacaoLoja {
  id: string
  data: string
  valor: number
  tipo: 'entrada' | 'saida'
  status_pagamento: string
  parcela_atual?: number
  total_parcelas?: number
}

interface DiaCaixa {
  data: string
  data_formatada: string
  receitas: number
  despesas: number
  saldo_acumulado: number
}

interface ResumoDia {
  entradas: number
  saidas: number
}

interface VisualizacaoCaixaDetalhadaProps {
  contexto: 'casa' | 'loja'
  titulo?: string
}

export default function VisualizacaoCaixaDetalhada({ contexto, titulo }: VisualizacaoCaixaDetalhadaProps) {
  const [caixaReal, setCaixaReal] = useState(0)
  const [resumoHoje, setResumoHoje] = useState<ResumoDia>({ entradas: 0, saidas: 0 })
  const [caixaPrevisto, setCaixaPrevisto] = useState<DiaCaixa[]>([])
  const [mesFiltro, setMesFiltro] = useState(getMesAtualParaInput())
  const [carregando, setCarregando] = useState(false)

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
  }

  const formatarDataTabela = (dataISO: string) => {
    try {
      const dataFormatada = formatarDataParaExibicao(dataISO)
      
      let dataParaConversao = dataISO;
      if (/^\d{4}-\d{2}-\d{2}$/.test(dataISO)) {
          dataParaConversao = `${dataISO}T12:00:00`;
      }
      const data = new Date(dataParaConversao)
      
      const diaSemana = data.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
      
      return `${diaSemana} - ${dataFormatada}`
    } catch {
      return dataISO
    }
  }

  const buscarDadosLoja = useCallback(async () => {
    try {
      const hoje = getDataAtualBrasil()
      const [ano, mes] = mesFiltro.split('-')
      const primeiroDia = `${ano}-${mes}-01`
      
      const ultimoDiaDate = new Date(parseInt(ano), parseInt(mes), 0)
      const ultimoDiaFormatado = prepararDataParaInsert(ultimoDiaDate)

      // Buscar compras do mês
      const { data: comprasData } = await supabase
        .from('compras')
        .select('*, itens_compra(*)')
        .gte('data_compra', primeiroDia)
        .lte('data_compra', ultimoDiaFormatado)
        .order('data_compra', { ascending: true })

      // Buscar vendas do mês
      const { data: vendasData } = await supabase
        .from('vendas')
        .select('*, itens_venda(*)')
        .gte('data_venda', primeiroDia)
        .lte('data_venda', ultimoDiaFormatado)
        .order('data_venda', { ascending: true })

      let caixaRealCalc = 0
      let entradasHoje = 0
      let saidasHoje = 0
      const transacoesPorData: Record<string, TransacaoLoja[]> = {}

      // Processar compras (saídas)
      if (comprasData) {
        comprasData.forEach(compra => {
          const dataCompra = compra.data_compra.includes('T') 
            ? compra.data_compra.split('T')[0] 
            : compra.data_compra

          const quantidadeParcelas = compra.quantidade_parcelas || 1
          const valorParcela = compra.total / quantidadeParcelas

          // Caixa Real: apenas transações pagas
          if (compra.status_pagamento === 'pago') {
            caixaRealCalc -= compra.total
          }

          // Entradas/Saídas Hoje
          if (dataCompra === hoje) {
            saidasHoje += compra.total
          }

          // Agrupar por data para previsão
          if (!transacoesPorData[dataCompra]) {
            transacoesPorData[dataCompra] = []
          }

          // Se tiver parcelas, dividir
          if (quantidadeParcelas > 1) {
            for (let i = 1; i <= quantidadeParcelas; i++) {
              transacoesPorData[dataCompra].push({
                id: `${compra.id}-${i}`,
                data: dataCompra,
                valor: valorParcela,
                tipo: 'saida',
                status_pagamento: compra.status_pagamento,
                parcela_atual: i,
                total_parcelas: quantidadeParcelas
              })
            }
          } else {
            transacoesPorData[dataCompra].push({
              id: compra.id,
              data: dataCompra,
              valor: compra.total,
              tipo: 'saida',
              status_pagamento: compra.status_pagamento
            })
          }
        })
      }

      // Processar vendas (entradas)
      if (vendasData) {
        vendasData.forEach(venda => {
          const dataVenda = venda.data_venda.includes('T') 
            ? venda.data_venda.split('T')[0] 
            : venda.data_venda

          const quantidadeParcelas = venda.quantidade_parcelas || 1
          const valorParcela = venda.total / quantidadeParcelas

          // Caixa Real: apenas transações pagas
          if (venda.status_pagamento === 'pago') {
            caixaRealCalc += venda.total
          }

          // Entradas/Saídas Hoje
          if (dataVenda === hoje) {
            entradasHoje += venda.total
          }

          // Agrupar por data para previsão
          if (!transacoesPorData[dataVenda]) {
            transacoesPorData[dataVenda] = []
          }

          // Se tiver parcelas, dividir
          if (quantidadeParcelas > 1) {
            for (let i = 1; i <= quantidadeParcelas; i++) {
              transacoesPorData[dataVenda].push({
                id: `${venda.id}-${i}`,
                data: dataVenda,
                valor: valorParcela,
                tipo: 'entrada',
                status_pagamento: venda.status_pagamento,
                parcela_atual: i,
                total_parcelas: quantidadeParcelas
              })
            }
          } else {
            transacoesPorData[dataVenda].push({
              id: venda.id,
              data: dataVenda,
              valor: venda.total,
              tipo: 'entrada',
              status_pagamento: venda.status_pagamento
            })
          }
        })
      }

      // Calcular previsão por dia
      const caixaPrevistoCalc: DiaCaixa[] = []
      const datasUnicas = Object.keys(transacoesPorData).sort()
      let saldoAcumulado = caixaRealCalc
      
      datasUnicas.forEach(data => {
        const transacoesDia = transacoesPorData[data]
        
        let receitas = 0
        let despesas = 0
        
        transacoesDia.forEach(transacao => {
          if (transacao.tipo === 'entrada') {
            receitas += transacao.valor
          } else {
            despesas += transacao.valor
          }
        })

        const saldoDia = receitas - despesas
        saldoAcumulado += saldoDia

        caixaPrevistoCalc.push({
          data,
          data_formatada: formatarDataTabela(data),
          receitas,
          despesas,
          saldo_acumulado: saldoAcumulado
        })
      })

      setCaixaReal(caixaRealCalc)
      setResumoHoje({ entradas: entradasHoje, saidas: saidasHoje })
      setCaixaPrevisto(caixaPrevistoCalc)
      
    } catch (error) {
      console.error(`Erro ao buscar dados loja:`, error)
    }
  }, [mesFiltro])

  const buscarDadosCasa = useCallback(async () => {
    try {
      const hoje = getDataAtualBrasil()
      const [ano, mes] = mesFiltro.split('-')
      const primeiroDia = `${ano}-${mes}-01`
      
      const ultimoDiaDate = new Date(parseInt(ano), parseInt(mes), 0)
      const ultimoDiaFormatado = prepararDataParaInsert(ultimoDiaDate)

      // Buscar centros de custo do contexto
      const { data: centros } = await supabase
        .from('centros_de_custo')
        .select('id')
        .eq('contexto', 'casa')

      if (!centros || centros.length === 0) {
        return
      }

      const centroIds = centros.map(c => c.id)

      // Buscar lançamentos do mês
      const { data: lancamentosMes } = await supabase
        .from('lancamentos_financeiros')
        .select('*')
        .gte('data_prevista', primeiroDia)
        .lte('data_prevista', ultimoDiaFormatado)
        .in('centro_custo_id', centroIds)
        .order('data_prevista', { ascending: true })

      let caixaRealCalc = 0
      let entradasHoje = 0
      let saidasHoje = 0
      const lancamentosPorData: Record<string, LancamentoFinanceiro[]> = {}

      if (lancamentosMes) {
        lancamentosMes.forEach(lanc => {
          const dataPrevista = lanc.data_prevista || lanc.data_lancamento
          const dataLancamento = dataPrevista.includes('T') 
            ? dataPrevista.split('T')[0] 
            : dataPrevista
          
          if (!lancamentosPorData[dataLancamento]) {
            lancamentosPorData[dataLancamento] = []
          }
          lancamentosPorData[dataLancamento].push(lanc)
          
          if (dataLancamento === hoje) {
            if (lanc.tipo === 'entrada') {
              entradasHoje += lanc.valor
            } else {
              saidasHoje += lanc.valor
            }
          }
        })
      }

      // Buscar lançamentos realizados até hoje
      const { data: lancamentosRealizados } = await supabase
        .from('lancamentos_financeiros')
        .select('*')
        .eq('status', 'realizado')
        .lte('data_lancamento', hoje)
        .in('centro_custo_id', centroIds)

      if (lancamentosRealizados) {
        lancamentosRealizados.forEach(lanc => {
          if (lanc.tipo === 'entrada') {
            caixaRealCalc += lanc.valor
          } else {
            caixaRealCalc -= lanc.valor
          }
        })
      }

      // Calcular previsão por dia
      const caixaPrevistoCalc: DiaCaixa[] = []
      const datasUnicas = Object.keys(lancamentosPorData).sort()
      let saldoAcumulado = caixaRealCalc
      
      datasUnicas.forEach(data => {
        const lancamentosDia = lancamentosPorData[data]
        
        let receitas = 0
        let despesas = 0
        
        lancamentosDia.forEach(lanc => {
          if (lanc.tipo === 'entrada') {
            receitas += lanc.valor
          } else {
            despesas += lanc.valor
          }
        })

        const saldoDia = receitas - despesas
        saldoAcumulado += saldoDia

        caixaPrevistoCalc.push({
          data,
          data_formatada: formatarDataTabela(data),
          receitas,
          despesas,
          saldo_acumulado: saldoAcumulado
        })
      })

      setCaixaReal(caixaRealCalc)
      setResumoHoje({ entradas: entradasHoje, saidas: saidasHoje })
      setCaixaPrevisto(caixaPrevistoCalc)
      
    } catch (error) {
      console.error(`Erro ao buscar dados casa:`, error)
    }
  }, [mesFiltro])

  useEffect(() => {
    setCarregando(true)
    if (contexto === 'loja') {
      buscarDadosLoja().finally(() => setCarregando(false))
    } else {
      buscarDadosCasa().finally(() => setCarregando(false))
    }
  }, [contexto, buscarDadosLoja, buscarDadosCasa])

  const tituloExibicao = titulo || (contexto === 'casa' ? 'CAIXA CASA' : 'CAIXA LOJA')
  const [anoMes, mesMes] = mesFiltro.split('-')

  if (carregando) {
    return (
      <div className="bg-white rounded-lg shadow-md p-3 border border-gray-300">
        <p className="text-xs text-gray-500 text-center">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-3 border border-gray-300">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
        <h2 className="text-xs font-bold text-gray-800">{tituloExibicao}</h2>
      </div>

      {/* Caixa Real */}
      <div className="flex justify-between items-start mb-2">
        <span className="text-[9px] text-gray-600">Caixa Real</span>
        <span className="text-[9px] text-gray-500">{formatarDataParaExibicao(getDataAtualBrasil())}</span>
      </div>
      <div className="text-center mb-3">
        <p className={`text-xl font-bold ${caixaReal >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
          {formatarMoeda(caixaReal)}
        </p>
      </div>

      {/* Entradas e Saídas Hoje */}
      <div className="flex justify-between text-[9px] mb-1">
        <span className="text-gray-600">Entradas Hoje:</span>
        <span className="text-green-600 font-semibold">{formatarMoeda(resumoHoje.entradas)}</span>
      </div>
      <div className="flex justify-between text-[9px] mb-3 pb-3 border-b border-gray-300">
        <span className="text-gray-600">Saídas Hoje:</span>
        <span className="text-red-600 font-semibold">{formatarMoeda(resumoHoje.saidas)}</span>
      </div>

      {/* Previsão do Mês */}
      <div className="mb-2">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-[10px] font-bold text-gray-800">
            Previsão do Mês ({anoMes}-{mesMes})
          </h3>
          <input
            type="month"
            value={mesFiltro}
            onChange={(e) => setMesFiltro(e.target.value)}
            className="text-[9px] px-1 py-0.5 border border-gray-300 rounded"
          />
        </div>

        {/* Tabela de Previsão */}
        <div className="max-h-[300px] overflow-y-auto border border-gray-300 rounded">
          <table className="w-full text-[9px]">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="px-1 py-1 text-left font-semibold text-gray-700 border-b text-xs">Data</th>
                <th className="px-1 py-1 text-right font-semibold text-gray-700 border-b text-xs">Receitas</th>
                <th className="px-1 py-1 text-right font-semibold text-gray-700 border-b text-xs">Despesas</th>
                <th className="px-1 py-1 text-right font-semibold text-gray-700 border-b text-xs">Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {caixaPrevisto.length > 0 ? (
                caixaPrevisto.map((dia, idx) => (
                  <tr key={dia.data} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-1 py-1 text-gray-700 text-xs">{dia.data_formatada}</td>
                    <td className="px-1 py-1 text-right text-green-600 font-medium text-xs">
                      {formatarMoeda(dia.receitas)}
                    </td>
                    <td className="px-1 py-1 text-right text-red-600 font-medium text-xs">
                      {formatarMoeda(dia.despesas)}
                    </td>
                    <td className="px-1 py-1 text-right text-blue-600 font-semibold text-xs">
                      {formatarMoeda(dia.saldo_acumulado)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-2 py-4 text-center text-gray-500 text-xs">
                    Nenhum lançamento previsto para este mês
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
