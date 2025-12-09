'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface BotaoExcluirCompraProps {
  compraId: string
  numeroTransacao: number
  onExcluido: () => void
}

export default function BotaoExcluirCompra({
  compraId,
  numeroTransacao,
  onExcluido
}: BotaoExcluirCompraProps) {
  const [confirmando, setConfirmando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  const handleExcluir = async () => {
    if (!confirmando) {
      setConfirmando(true)
      return
    }

    setExcluindo(true)

    try {
      // 1. Buscar itens da compra para reverter estoque
      const { data: itens, error: erroItens } = await supabase
        .from('itens_compra')
        .select('produto_id, quantidade')
        .eq('compra_id', compraId)

      if (erroItens) throw erroItens

      // 2. Reverter estoque de cada produto
      for (const item of itens || []) {
        const { data: produtoAtual } = await supabase
          .from('produtos')
          .select('quantidade')
          .eq('id', item.produto_id)
          .single()

        if (produtoAtual) {
          await supabase
            .from('produtos')
            .update({
              quantidade: produtoAtual.quantidade - item.quantidade
            })
            .eq('id', item.produto_id)

          // Registrar movimentação de estoque
          await supabase.from('movimentacoes_estoque').insert({
            produto_id: item.produto_id,
            tipo: 'saida',
            quantidade: item.quantidade,
            observacao: `Estorno de compra #${numeroTransacao} (excluída)`,
            data: new Date().toISOString()
          })
        }
      }

      // 3. Excluir itens da compra
      const { error: erroExcluirItens } = await supabase
        .from('itens_compra')
        .delete()
        .eq('compra_id', compraId)

      if (erroExcluirItens) throw erroExcluirItens

      // 4. Excluir a compra
      const { error: erroExcluirCompra } = await supabase
        .from('compras')
        .delete()
        .eq('id', compraId)

      if (erroExcluirCompra) throw erroExcluirCompra

      alert(`✅ Compra #${numeroTransacao} excluída com sucesso!`)
      onExcluido()
    } catch (error) {
      console.error('Erro ao excluir compra:', error)
      alert('❌ Erro ao excluir compra. Verifique o console.')
    } finally {
      setExcluindo(false)
      setConfirmando(false)
    }
  }

  return (
    <div className="flex gap-2">
      {!confirmando ? (
        <button
          onClick={() => setConfirmando(true)}
          className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded"
        >
          🗑️ Excluir
        </button>
      ) : (
        <>
          <button
            onClick={handleExcluir}
            disabled={excluindo}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded disabled:opacity-50"
          >
            {excluindo ? 'Excluindo...' : '✓ Confirmar'}
          </button>
          <button
            onClick={() => setConfirmando(false)}
            disabled={excluindo}
            className="px-3 py-1 bg-gray-300 hover:bg-gray-400 text-gray-800 text-sm rounded disabled:opacity-50"
          >
            ✕ Cancelar
          </button>
        </>
      )}
    </div>
  )
}
