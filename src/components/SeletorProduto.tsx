'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Produto {
  id: string
  codigo: string
  descricao: string
  quantidade: number
  preco_custo: number
  preco_venda: number
  categoria: string
}

interface SeletorProdutoProps {
  onSelecionarProduto: (produto: Produto) => void
  onNovoItem: () => void
  placeholder?: string
  descricaoPreenchida?: string
}

export default function SeletorProduto({
  onSelecionarProduto,
  onNovoItem,
  placeholder = 'Buscar ou criar produto...',
  descricaoPreenchida = '',
}: SeletorProdutoProps) {
  const [busca, setBusca] = useState(descricaoPreenchida)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Se já tem descrição preenchida, não busca novamente
    if (descricaoPreenchida) {
      setBusca(descricaoPreenchida)
      return
    }

    if (busca.length > 2) {
      buscarProdutos(busca)
    } else {
      setProdutos([])
    }
  }, [busca, descricaoPreenchida])

  const buscarProdutos = async (termo: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .or(`descricao.ilike.%${termo}%,codigo.ilike.%${termo}%`)
        .limit(10)

      if (error) throw error
      setProdutos(data || [])
      setMostrarSugestoes(true)
    } catch (error) {
      console.error('Erro ao buscar produtos:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelecionarProduto = (produto: Produto) => {
    console.log('✅ Produto selecionado no SeletorProduto:', produto.descricao)
    onSelecionarProduto(produto)
    // Mantém a descrição do produto no campo de busca
    setBusca(produto.descricao)
    setMostrarSugestoes(false)
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onFocus={() => busca.length > 2 && setMostrarSugestoes(true)}
            placeholder={placeholder}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Sugestões */}
          {mostrarSugestoes && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
              {loading ? (
                <div className="p-3 text-gray-600 text-sm">Buscando...</div>
              ) : produtos.length > 0 ? (
                <div className="divide-y">
                  {produtos.map((produto) => (
                    <button
                      key={produto.id}
                      type="button"
                      onClick={() => handleSelecionarProduto(produto)}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors"
                    >
                      <div className="font-medium text-gray-800">{produto.descricao}</div>
                      <div className="text-xs text-gray-600">
                        {produto.codigo} • Estoque: {produto.quantidade} • R$ {produto.preco_venda.toFixed(2)}
                      </div>
                    </button>
                  ))}
                </div>
              ) : busca.length > 2 ? (
                <div className="p-3 text-gray-600 text-sm">Nenhum produto encontrado</div>
              ) : null}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onNovoItem}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap"
        >
          + Novo
        </button>
      </div>
    </div>
  )
}
