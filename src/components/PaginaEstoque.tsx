'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import ModalEditarProduto from './ModalEditarProduto'
import ModalLogProduto from './ModalLogProduto'

interface Produto {
  id: string
  codigo: string
  descricao: string
  quantidade: number
  preco_custo: number
  valor_repasse: number
  preco_venda: number
  data_ultima_compra: string
}

export default function PaginaEstoque() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [modalEditarAberto, setModalEditarAberto] = useState(false)
  const [modalLogAberto, setModalLogAberto] = useState(false)
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null)

  useEffect(() => {
    carregarProdutos()
  }, [])

  const carregarProdutos = async () => {
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .order('descricao', { ascending: true })

      if (error) throw error
      setProdutos(data || [])
    } catch (error) {
      console.error('Erro ao carregar produtos:', error)
    } finally {
      setLoading(false)
    }
  }

  const calcularValorTotalEstoque = () => {
    return produtos.reduce((total, produto) => {
      const preco = produto.preco_venda || 0
      return total + (produto.quantidade || 0) * preco
    }, 0)
  }

  const abrirModalEditar = (produto: Produto) => {
    setProdutoSelecionado(produto)
    setModalEditarAberto(true)
  }

  const abrirModalLog = (produto: Produto) => {
    setProdutoSelecionado(produto)
    setModalLogAberto(true)
  }

  const fecharModais = () => {
    setModalEditarAberto(false)
    setModalLogAberto(false)
    setProdutoSelecionado(null)
  }

  const handleProdutoAtualizado = () => {
    carregarProdutos()
    fecharModais()
  }

  if (loading) {
    return (
      <div className="bg-white p-3 rounded-lg shadow-md text-center">
        <p className="text-gray-600 text-xs">Carregando estoque...</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Cabeçalho com Botão e Valor Total - COMPACTO */}
      <div className="bg-white rounded-lg shadow-md p-3 flex justify-between items-center">
        <button
          onClick={() => {
            setProdutoSelecionado(null)
            setModalEditarAberto(true)
          }}
          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors"
        >
          + Cadastrar Item
        </button>

        <div className="text-right">
          <p className="text-[10px] text-gray-600">Valor Total em Estoque</p>
          <p className="text-lg font-bold text-green-600">
            R$ {calcularValorTotalEstoque().toFixed(2)}
          </p>
        </div>
      </div>

      {/* Tabela de Estoque - COMPACTA */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {produtos.length === 0 ? (
          <div className="p-3 text-center text-gray-500">
            <p className="text-xs">Nenhum produto cadastrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-2 py-1.5 text-left font-semibold text-gray-700 text-xs">Código</th>
                  <th className="px-2 py-1.5 text-left font-semibold text-gray-700 text-xs">Descrição</th>
                  <th className="px-2 py-1.5 text-center font-semibold text-gray-700 text-xs">Qtd</th>
                  <th className="px-2 py-1.5 text-right font-semibold text-gray-700 text-xs">Custo</th>
                  <th className="px-2 py-1.5 text-right font-semibold text-gray-700 text-xs">Repasse</th>
                  <th className="px-2 py-1.5 text-right font-semibold text-gray-700 text-xs">Venda</th>
                  <th className="px-2 py-1.5 text-left font-semibold text-gray-700 text-xs">Ult. Compra</th>
                  <th className="px-2 py-1.5 text-center font-semibold text-gray-700 text-xs">Ações</th>
                </tr>
              </thead>
              <tbody>
                {produtos.map((produto) => (
                  <tr
                    key={produto.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-2 py-1.5 text-gray-800 font-medium text-xs">{produto.codigo}</td>
                    <td className="px-2 py-1.5 text-gray-800 text-xs">{produto.descricao}</td>
                    <td className="px-2 py-1.5 text-center text-gray-700">
                      <span className="inline-block bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full font-medium text-xs">
                        {produto.quantidade}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right text-gray-700 text-xs">
                      R$ {produto.preco_custo.toFixed(2)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-gray-700 text-xs">
                      R$ {(Number(produto.valor_repasse) || 0).toFixed(2)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-gray-700 font-semibold text-xs">
                      R$ {(Number(produto.preco_venda) || 0).toFixed(2)}
                    </td>
                    <td className="px-2 py-1.5 text-gray-600 text-xs">
                      {new Date(produto.data_ultima_compra).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => abrirModalEditar(produto)}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-0.5 rounded text-[9px] font-medium transition-colors"
                          title="Editar produto"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => abrirModalLog(produto)}
                          className="bg-gray-500 hover:bg-gray-600 text-white px-2 py-0.5 rounded text-[9px] font-medium transition-colors"
                          title="Ver log de movimentações"
                        >
                          📋
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modais */}
      {modalEditarAberto && (
        <ModalEditarProduto
          produto={produtoSelecionado}
          onClose={fecharModais}
          onSave={handleProdutoAtualizado}
        />
      )}

      {modalLogAberto && produtoSelecionado && (
        <ModalLogProduto produto={produtoSelecionado} onClose={fecharModais} />
      )}
    </div>
  )
}
