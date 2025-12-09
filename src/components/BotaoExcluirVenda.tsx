'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface BotaoExcluirVendaProps {
  vendaId: string
  numeroTransacao: number
  onExcluido: () => void
}

export default function BotaoExcluirVenda({
  vendaId,
  numeroTransacao,
  onExcluido
}: BotaoExcluirVendaProps) {
  const [confirmando, setConfirmando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  const handleExcluir = async () => {
    if (!confirmando) {
      setConfirmando(true)
      return
    }

    setExcluindo(true)

    try {
      // 1. Buscar itens da venda para reverter estoque
      const { data: itens, error: erroItens } = await supabase
        .from('itens_venda')
        .select('produto_id, quantidade')
        .eq('venda_id', vendaId)

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
              quantidade: produtoAtual.quantidade + item.quantidade
            })
            .eq('id', item.produto_id)

          // Registrar movimentação de estoque
          await supabase.from('movimentacoes_estoque').insert({
            produto_id: item.produto_id,
            tipo: 'entrada',
            quantidade: item.quantidade,
            observacao: `Estorno de venda #${numeroTransacao} (excluída)`,
            data: new Date().toISOString()
          })
        }
      }

      // 3. Excluir itens da venda (cascade vai excluir automaticamente se configurado)
      const { error: erroExcluirItens } = await supabase
        .from('itens_venda')
        .delete()
        .eq('venda_id', vendaId)

      if (erroExcluirItens) throw erroExcluirItens

      // 4. Excluir a venda
      const { error: erroExcluirVenda } = await supabase
        .from('vendas')
        .delete()
        .eq('id', vendaId)

      if (erroExcluirVenda) throw erroExcluirVenda

      alert(`✅ Venda #${numeroTransacao} excluída com sucesso!`)
      onExcluido()
    } catch (error) {
      console.error('Erro ao excluir venda:', error)
      alert('❌ Erro ao excluir venda. Verifique o console.')
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
