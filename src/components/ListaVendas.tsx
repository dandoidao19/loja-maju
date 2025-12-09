'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface ItemVenda {
  id: string
  produto_id: string | null
  descricao: string
  quantidade: number
  preco_venda: number
  categoria?: string
}

interface Venda {
  id: string
  numero_transacao: number
  data_venda: string
  cliente: string
  itens: ItemVenda[]
  total: number
  status_pagamento: string
  quantidade_parcelas: number
}

interface ListaVendasProps {
  vendas: Venda[]
  onAtualizar: () => void
}

export default function ListaVendas({ vendas, onAtualizar }: ListaVendasProps) {
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  const toggleExpandir = (id: string) => {
    const novoExpandidos = new Set(expandidos)
    if (novoExpandidos.has(id)) {
      novoExpandidos.delete(id)
    } else {
      novoExpandidos.add(id)
    }
    setExpandidos(novoExpandidos)
  }

  const handleExcluir = async (vendaId: string) => {
    if (!confirm('⚠️ Tem certeza que deseja excluir esta venda?\n\nIsso irá:\n- Reverter o estoque dos produtos (devolver ao estoque)\n- Excluir todos os itens\n- Excluir a transação\n\nEsta ação não pode ser desfeita!')) {
      return
    }

    try {
      // 1. Buscar itens da venda
      const { data: itens, error: erroItens } = await supabase
        .from('itens_venda')
        .select('produto_id, quantidade')
        .eq('venda_id', vendaId)

      if (erroItens) throw erroItens

      // 2. Reverter estoque de cada item (adicionar de volta)
      for (const item of itens || []) {
        if (item.produto_id) {
          // Buscar quantidade atual do produto
          const { data: produto } = await supabase
            .from('produtos')
            .select('quantidade')
            .eq('id', item.produto_id)
            .single()

          if (produto) {
            // Reverter: adicionar a quantidade que foi vendida
            await supabase
              .from('produtos')
              .update({
                quantidade: produto.quantidade + item.quantidade
              })
              .eq('id', item.produto_id)
          }
        }
      }

      // 3. Excluir itens da venda
      const { error: erroExcluirItens } = await supabase
        .from('itens_venda')
        .delete()
        .eq('venda_id', vendaId)

      if (erroExcluirItens) throw erroExcluirItens

      // 4. Excluir venda
      const { error: erroExcluirVenda } = await supabase
        .from('vendas')
        .delete()
        .eq('id', vendaId)

      if (erroExcluirVenda) throw erroExcluirVenda

      alert('✅ Venda excluída com sucesso!')
      onAtualizar()
    } catch (error) {
      console.error('Erro ao excluir venda:', error)
      alert('❌ Erro ao excluir venda. Verifique o console para mais detalhes.')
    }
  }

  const handleEditar = (vendaId: string) => {
    // TODO: Implementar modal de edição
    alert(`🚧 Funcionalidade de edição em desenvolvimento.\n\nVenda ID: ${vendaId}\n\nEm breve você poderá editar:\n- Data da venda\n- Cliente\n- Status de pagamento\n- Parcelas\n- Itens (adicionar/remover/alterar)`)
  }

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR')
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

  if (vendas.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-3">
        <p className="text-center text-gray-500 text-xs">Nenhuma venda registrada</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-3 space-y-1">
      <h2 className="text-xs font-semibold text-gray-800 mb-2">Histórico de Vendas</h2>

      <div className="space-y-1">
        {vendas.map((venda) => (
          <div key={venda.id} className="border border-gray-200 rounded overflow-hidden">
            {/* Resumo em Uma Linha */}
            <button
              onClick={() => toggleExpandir(venda.id)}
              className="w-full bg-gray-50 hover:bg-gray-100 px-2 py-1 flex items-center justify-between transition-colors"
            >
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-gray-800 whitespace-nowrap">
                    #{venda.numero_transacao || 'S/N'}
                  </span>
                  <span className="font-medium text-gray-800 whitespace-nowrap">
                    {formatarData(venda.data_venda)}
                  </span>
                  <span className="text-gray-700 whitespace-nowrap">
                    {venda.cliente}
                  </span>
                  <span className="text-gray-600">📦 {venda.itens?.length || 0}</span>
                  <span className="text-gray-600">💰 R$ {(venda.total || 0).toFixed(2)}</span>
                  <span className="text-gray-600">📋 {venda.quantidade_parcelas}x</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap ${getStatusColor(
                      venda.status_pagamento
                    )}`}
                  >
                    {venda.status_pagamento}
                  </span>
                </div>
              </div>

              <div className="ml-2 text-gray-600 text-xs font-bold">
                {expandidos.has(venda.id) ? '▲' : '▼'}
              </div>
            </button>

            {/* Detalhes Expandidos */}
            {expandidos.has(venda.id) && (
              <div className="bg-white border-t border-gray-200 p-3 space-y-2">
                <h3 className="font-semibold text-gray-800 text-xs mb-2">Itens:</h3>

                {venda.itens && venda.itens.length > 0 ? (
                  <div className="space-y-1">
                    {venda.itens.map((item) => (
                      <div
                        key={item.id}
                        className="bg-gray-50 p-2 rounded border border-gray-200 text-xs"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1">
                            <p className="font-medium text-gray-800">{item.descricao}</p>
                            <div className="flex gap-2 text-gray-600 mt-0.5">
                              <span>Qtd: {item.quantidade}</span>
                              <span>Venda: R$ {(item.preco_venda || 0).toFixed(2)}</span>
                              <span>Subtotal: R$ {((item.quantidade || 0) * (item.preco_venda || 0)).toFixed(2)}</span>
                            </div>
                          </div>
                          {item.categoria && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded whitespace-nowrap">
                              {item.categoria}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic">Nenhum item nesta venda</p>
                )}

                <div className="border-t border-gray-200 pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-800 text-xs">Total:</span>
                    <span className="text-xs font-bold text-green-600">
                      R$ {(venda.total || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* BOTÕES DE AÇÃO */}
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditar(venda.id)}
                      className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => handleExcluir(venda.id)}
                      className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
                    >
                      🗑️ Excluir
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
