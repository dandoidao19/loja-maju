'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface ItemCompra {
  id: string
  descricao: string
  quantidade: number
  categoria: string
  preco_custo: number
  preco_venda: number
}

interface Compra {
  id: string
  numero_transacao: number
  data_compra: string
  fornecedor: string
  total: number
  quantidade_itens: number
  quantidade_parcelas: number
  status_pagamento: string
  itens?: ItemCompra[]
}

interface ListaComprasProps {
  atualizarLista?: boolean
}

export default function ListaCompras({ atualizarLista }: ListaComprasProps) {
  const [compras, setCompras] = useState<Compra[]>([])
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    carregarCompras()
  }, [atualizarLista])

  const carregarCompras = async () => {
    try {
      setLoading(true)

      const { data: comprasData, error: erroCompras } = await supabase
        .from('compras')
        .select('*')
        .order('data_compra', { ascending: false })
        .limit(50)

      if (erroCompras) throw erroCompras

      const comprasComItens = await Promise.all(
        (comprasData || []).map(async (compra) => {
          const { data: itensData, error: erroItens } = await supabase
            .from('itens_compra')
            .select('*')
            .eq('compra_id', compra.id)

          if (erroItens) {
            console.error(`Erro ao buscar itens da compra ${compra.id}:`, erroItens)
            return { ...compra, itens: [] }
          }

          return {
            ...compra,
            itens: itensData || [],
          }
        })
      )

      setCompras(comprasComItens)
    } catch (error) {
      console.error('Erro ao carregar compras:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpandir = (compraId: string) => {
    const novoExpandidos = new Set(expandidos)
    if (novoExpandidos.has(compraId)) {
      novoExpandidos.delete(compraId)
    } else {
      novoExpandidos.add(compraId)
    }
    setExpandidos(novoExpandidos)
  }

  const handleExcluir = async (compraId: string) => {
    if (!confirm('⚠️ Tem certeza que deseja excluir esta compra?\n\nIsso irá:\n- Reverter o estoque dos produtos\n- Excluir todos os itens\n- Excluir a transação\n\nEsta ação não pode ser desfeita!')) {
      return
    }

    try {
      // 1. Buscar itens da compra
      const { data: itens, error: erroItens } = await supabase
        .from('itens_compra')
        .select('produto_id, quantidade')
        .eq('compra_id', compraId)

      if (erroItens) throw erroItens

      // 2. Reverter estoque de cada item
      for (const item of itens || []) {
        if (item.produto_id) {
          // Buscar quantidade atual do produto
          const { data: produto } = await supabase
            .from('produtos')
            .select('quantidade')
            .eq('id', item.produto_id)
            .single()

          if (produto) {
            // Reverter: subtrair a quantidade que foi adicionada
            await supabase
              .from('produtos')
              .update({
                quantidade: produto.quantidade - item.quantidade
              })
              .eq('id', item.produto_id)
          }
        }
      }

      // 3. Excluir itens da compra
      const { error: erroExcluirItens } = await supabase
        .from('itens_compra')
        .delete()
        .eq('compra_id', compraId)

      if (erroExcluirItens) throw erroExcluirItens

      // 4. Excluir compra
      const { error: erroExcluirCompra } = await supabase
        .from('compras')
        .delete()
        .eq('id', compraId)

      if (erroExcluirCompra) throw erroExcluirCompra

      alert('✅ Compra excluída com sucesso!')
      carregarCompras()
    } catch (error) {
      console.error('Erro ao excluir compra:', error)
      alert('❌ Erro ao excluir compra. Verifique o console para mais detalhes.')
    }
  }

  const handleEditar = (compraId: string) => {
    // TODO: Implementar modal de edição
    // Por enquanto, apenas alerta
    alert(`🚧 Funcionalidade de edição em desenvolvimento.\n\nCompra ID: ${compraId}\n\nEm breve você poderá editar:\n- Data da compra\n- Fornecedor\n- Status de pagamento\n- Parcelas\n- Itens (adicionar/remover/alterar)`)
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

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-3">
        <p className="text-center text-gray-500 text-xs">Carregando compras...</p>
      </div>
    )
  }

  if (compras.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-3">
        <p className="text-center text-gray-500 text-xs">Nenhuma compra registrada</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-3 space-y-1">
      <h2 className="text-xs font-semibold text-gray-800 mb-2">Histórico de Compras</h2>

      <div className="space-y-1">
        {compras.map((compra) => (
          <div key={compra.id} className="border border-gray-200 rounded overflow-hidden">
            {/* Resumo em Uma Linha */}
            <button
              onClick={() => toggleExpandir(compra.id)}
              className="w-full bg-gray-50 hover:bg-gray-100 px-2 py-1 flex items-center justify-between transition-colors"
            >
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-gray-800 whitespace-nowrap">
                    #{compra.numero_transacao || 'S/N'}
                  </span>
                  <span className="font-medium text-gray-800 whitespace-nowrap">
                    {formatarData(compra.data_compra)}
                  </span>
                  <span className="text-gray-700 whitespace-nowrap">
                    {compra.fornecedor}
                  </span>
                  <span className="text-gray-600">📦 {compra.itens?.length || 0}</span>
                  <span className="text-gray-600">💰 R$ {(compra.total || 0).toFixed(2)}</span>
                  <span className="text-gray-600">📋 {compra.quantidade_parcelas}x</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap ${getStatusColor(
                      compra.status_pagamento
                    )}`}
                  >
                    {compra.status_pagamento}
                  </span>
                </div>
              </div>

              <div className="ml-2 text-gray-600 text-xs font-bold">
                {expandidos.has(compra.id) ? '▲' : '▼'}
              </div>
            </button>

            {/* Detalhes Expandidos */}
            {expandidos.has(compra.id) && (
              <div className="bg-white border-t border-gray-200 p-3 space-y-2">
                <h3 className="font-semibold text-gray-800 text-xs mb-2">Itens:</h3>

                {compra.itens && compra.itens.length > 0 ? (
                  <div className="space-y-1">
                    {compra.itens.map((item) => (
                      <div
                        key={item.id}
                        className="bg-gray-50 p-2 rounded border border-gray-200 text-xs"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1">
                            <p className="font-medium text-gray-800">{item.descricao}</p>
                            <div className="flex gap-2 text-gray-600 mt-0.5">
                              <span>Qtd: {item.quantidade}</span>
                              <span>Custo: R$ {(item.preco_custo || 0).toFixed(2)}</span>
                              <span>Venda: R$ {(item.preco_venda || 0).toFixed(2)}</span>
                              <span>Subtotal: R$ {((item.quantidade || 0) * (item.preco_custo || 0)).toFixed(2)}</span>
                            </div>
                          </div>
                          <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded whitespace-nowrap">
                            {item.categoria}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic">Nenhum item nesta compra</p>
                )}

                <div className="border-t border-gray-200 pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-800 text-xs">Total:</span>
                    <span className="text-xs font-bold text-green-600">
                      R$ {(compra.total || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* BOTÕES DE AÇÃO */}
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditar(compra.id)}
                      className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => handleExcluir(compra.id)}
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
