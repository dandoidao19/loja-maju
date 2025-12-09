'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import VisualizacaoCaixaDetalhada from './VisualizacaoCaixaDetalhada'
import { formatarDataParaExibicao } from '@/lib/dateUtils'

interface TransacaoFinanceira {
  id: string
  numero_transacao: number
  tipo: 'compra' | 'venda'
  data: string
  cliente_fornecedor: string
  parcela_atual: number
  total_parcelas: number
  valor_parcela: number
  valor_total: number
  status_pagamento: string
}

export default function TelaInicialLoja() {
  const [transacoes, setTransacoes] = useState<TransacaoFinanceira[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    carregarTransacoes()
  }, [])

  const carregarTransacoes = async () => {
    try {
      setLoading(true)

      // Buscar compras
      const { data: comprasData } = await supabase
        .from('compras')
        .select('id, numero_transacao, data_compra, fornecedor, total, status_pagamento, quantidade_parcelas')
        .order('data_compra', { ascending: false })
        .limit(50)

      // Buscar vendas
      const { data: vendasData } = await supabase
        .from('vendas')
        .select('id, numero_transacao, data_venda, cliente, total, status_pagamento, quantidade_parcelas')
        .order('data_venda', { ascending: false })
        .limit(50)

      const todasTransacoes: TransacaoFinanceira[] = []

      // Processar compras (criar parcelas)
      if (comprasData) {
        comprasData.forEach((compra) => {
          const quantidadeParcelas = compra.quantidade_parcelas || 1
          const valorParcela = compra.total / quantidadeParcelas

          for (let i = 1; i <= quantidadeParcelas; i++) {
            todasTransacoes.push({
              id: `${compra.id}-${i}`,
              numero_transacao: compra.numero_transacao || 0,
              tipo: 'compra',
              data: compra.data_compra,
              cliente_fornecedor: compra.fornecedor,
              parcela_atual: i,
              total_parcelas: quantidadeParcelas,
              valor_parcela: valorParcela,
              valor_total: compra.total,
              status_pagamento: compra.status_pagamento,
            })
          }
        })
      }

      // Processar vendas (criar parcelas)
      if (vendasData) {
        vendasData.forEach((venda) => {
          const quantidadeParcelas = venda.quantidade_parcelas || 1
          const valorParcela = venda.total / quantidadeParcelas

          for (let i = 1; i <= quantidadeParcelas; i++) {
            todasTransacoes.push({
              id: `${venda.id}-${i}`,
              numero_transacao: venda.numero_transacao || 0,
              tipo: 'venda',
              data: venda.data_venda,
              cliente_fornecedor: venda.cliente,
              parcela_atual: i,
              total_parcelas: quantidadeParcelas,
              valor_parcela: valorParcela,
              valor_total: venda.total,
              status_pagamento: venda.status_pagamento,
            })
          }
        })
      }

      // Ordenar por data (mais recentes primeiro)
      todasTransacoes.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())

      setTransacoes(todasTransacoes.slice(0, 50))
    } catch (error) {
      console.error('Erro ao carregar transações:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatarCurrency = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pago':
        return 'bg-green-100 text-green-800'
      case 'pendente':
        return 'bg-yellow-100 text-yellow-800'
      case 'parcial':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handlePagar = async (transacao: TransacaoFinanceira) => {
    try {
      const tabela = transacao.tipo === 'compra' ? 'compras' : 'vendas'
      const idOriginal = transacao.id.split('-')[0] // Remove sufixo da parcela
      
      const { error } = await supabase
        .from(tabela)
        .update({ status_pagamento: 'pago' })
        .eq('id', idOriginal)

      if (error) throw error

      // Recarregar dados
      carregarTransacoes()
      alert('Status atualizado para PAGO!')
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
      alert('Erro ao atualizar status')
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-3">
        <p className="text-center text-gray-500 text-xs">Carregando dados...</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {/* COLUNA ESQUERDA (1/3) - Visualização de Caixa Detalhada */}
      <div className="col-span-1">
        <VisualizacaoCaixaDetalhada contexto="loja" titulo="CAIXA LOJA" />
      </div>

      {/* COLUNA DIREITA (2/3) - Transações Financeiras */}
      <div className="col-span-2">
        <div className="bg-white rounded-lg shadow-md p-3">
          <h2 className="text-xs font-semibold text-gray-800 mb-2">Transações Financeiras</h2>

          {transacoes.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">Nenhuma transação registrada</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-1/12 px-1 py-2 text-left font-medium text-gray-700 border-b text-xs">Data</th>
                    <th className="w-1/12 px-1 py-2 text-left font-medium text-gray-700 border-b text-xs">Status</th>
                    <th className="w-2/12 px-1 py-2 text-right font-medium text-gray-700 border-b text-xs">Valor</th>
                    <th className="w-3/12 px-1 py-2 text-left font-medium text-gray-700 border-b text-xs">Cliente/Fornecedor</th>
                    <th className="w-1/12 px-1 py-2 text-center font-medium text-gray-700 border-b text-xs">Parcelas</th>
                    <th className="w-1/12 px-1 py-2 text-center font-medium text-gray-700 border-b text-xs">Nº Trans.</th>
                    <th className="w-1/12 px-1 py-2 text-center font-medium text-gray-700 border-b text-xs">Tipo</th>
                    <th className="w-1/12 px-1 py-2 text-center font-medium text-gray-700 border-b text-xs">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {transacoes.map((transacao) => (
                    <tr key={transacao.id} className="border-b hover:bg-gray-50">
                      <td className="px-1 py-2 text-gray-700 whitespace-nowrap text-xs">
                        {formatarDataParaExibicao(transacao.data)}
                      </td>
                      <td className="px-1 py-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getStatusColor(
                            transacao.status_pagamento
                          )}`}
                        >
                          {transacao.status_pagamento}
                        </span>
                      </td>
                      <td className={`px-1 py-2 text-right font-medium whitespace-nowrap text-xs ${
                        transacao.tipo === 'venda' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transacao.tipo === 'venda' ? '+' : '-'} {formatarCurrency(transacao.valor_parcela)}
                      </td>
                      <td className="px-1 py-2 text-gray-900 truncate text-xs">
                        {transacao.cliente_fornecedor} {transacao.total_parcelas > 1 && (
                          <span className="text-gray-500 text-[10px]">
                            - {transacao.parcela_atual}/{transacao.total_parcelas}
                          </span>
                        )}
                      </td>
                      <td className="px-1 py-2 text-center text-gray-600 text-xs">
                        {transacao.total_parcelas}x
                      </td>
                      <td className="px-1 py-2 text-center text-gray-700 font-medium text-xs">
                        #{transacao.numero_transacao}
                      </td>
                      <td className="px-1 py-2 text-center">
                        <span className={`text-[10px] font-medium ${
                          transacao.tipo === 'venda' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transacao.tipo === 'venda' ? '📈 VENDA' : '📉 COMPRA'}
                        </span>
                      </td>
                      <td className="px-1 py-2 text-center">
                        {transacao.status_pagamento !== 'pago' && (
                          <button
                            onClick={() => handlePagar(transacao)}
                            className="px-1 py-0.5 bg-green-500 text-white text-[10px] rounded hover:bg-green-600"
                            title="Marcar como pago"
                          >
                            PAGAR
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
