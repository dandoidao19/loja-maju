'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getDataAtualBrasil } from '@/lib/dateUtils'
import SeletorProduto from './SeletorProduto'

interface ItemVenda {
  id: string
  produto_id: string | null
  descricao: string
  quantidade: number
  categoria: string
  preco_venda: number
  estoque_atual?: number
  minimizado?: boolean
  isNovoCadastro?: boolean
}

interface FormularioVendaProps {
  onVendaAdicionada: () => void
}

export default function FormularioVenda({ onVendaAdicionada }: FormularioVendaProps) {
  const [dataVenda, setDataVenda] = useState(getDataAtualBrasil())
  const [cliente, setCliente] = useState('')
  const [itens, setItens] = useState<ItemVenda[]>([
    {
      id: Date.now().toString(),
      produto_id: null,
      descricao: '',
      quantidade: 1,
      categoria: '',
      preco_venda: 0,
      estoque_atual: 0,
      minimizado: false,
      isNovoCadastro: false,
    },
  ])
  const [categorias, setCategorias] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const [quantidadeParcelas, setQuantidadeParcelas] = useState(1)
  const [prazoParcelas, setPrazoParcelas] = useState('mensal')
  const [statusPagamento, setStatusPagamento] = useState('pendente')

  useEffect(() => {
    carregarCategorias()
  }, [])

  const carregarCategorias = async () => {
    try {
      const { data, error } = await supabase
        .from('categorias_estoque')
        .select('*')
        .order('nome', { ascending: true })

      if (error) throw error
      setCategorias(data || [])
    } catch (error) {
      console.error('Erro ao carregar categorias:', error)
    }
  }

  const calcularTotal = () => {
    return itens.reduce((total, item) => total + item.quantidade * item.preco_venda, 0)
  }

  const adicionarNovoItem = () => {
    setItens((prev) =>
      prev.map((item, idx) => (idx === prev.length - 1 ? { ...item, minimizado: true } : item))
    )

    setItens((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        produto_id: null,
        descricao: '',
        quantidade: 1,
        categoria: '',
        preco_venda: 0,
        estoque_atual: 0,
        minimizado: false,
        isNovoCadastro: false,
      },
    ])
  }

  const removerItem = (idItem: string) => {
    if (itens.length > 1) {
      setItens(itens.filter((item) => item.id !== idItem))
    } else {
      alert('Você deve ter pelo menos um item')
    }
    setErro('')
  }

  const atualizarItem = (idItem: string, campo: string, valor: any) => {
    setItens(
      itens.map((item) =>
        item.id === idItem ? { ...item, [campo]: valor } : item
      )
    )
  }

  const toggleNovoCadastro = (idItem: string) => {
    setItens(
      itens.map((item) =>
        item.id === idItem
          ? {
              ...item,
              isNovoCadastro: !item.isNovoCadastro,
              produto_id: null,
              descricao: '',
              categoria: !item.isNovoCadastro ? categorias[0]?.nome || '' : '',
              preco_venda: 0,
              estoque_atual: 0,
            }
          : item
      )
    )
  }

  const selecionarProduto = (produto: any, idItem: string) => {
    setItens((prevItens) =>
      prevItens.map((item) =>
        item.id === idItem
          ? {
              ...item,
              produto_id: produto.id,
              descricao: produto.descricao || '',
              categoria: produto.categoria || '',
              preco_venda: produto.preco_venda || 0,
              estoque_atual: produto.quantidade || 0,
            }
          : item
      )
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setLoading(true)

    try {
      if (!cliente.trim()) {
        throw new Error('Cliente é obrigatório')
      }

      for (const item of itens) {
        if (!item.descricao.trim()) {
          throw new Error('Todos os itens devem ter descrição')
        }
        if (item.quantidade <= 0) {
          throw new Error('Quantidade deve ser maior que 0')
        }
        if (item.preco_venda <= 0) {
          throw new Error('Preço de venda deve ser maior que 0')
        }
      }

      const { data: numeroTransacao, error: erroNumero } = await supabase
        .rpc('obter_proximo_numero_transacao')
      
      if (erroNumero) {
        console.error('Erro ao obter número de transação:', erroNumero)
        throw new Error('Erro ao gerar número da venda')
      }

      const { data: vendaDataArray, error: erroVenda } = await supabase
        .from('vendas')
        .insert({
          numero_transacao: numeroTransacao,
          data_venda: dataVenda,
          cliente,
          total: calcularTotal(),
          quantidade_itens: itens.length,
          forma_pagamento: 'dinheiro',
          status_pagamento: statusPagamento,
          quantidade_parcelas: quantidadeParcelas,
          prazoparcelas: prazoParcelas,
        })
        .select()

      if (erroVenda) {
        console.error('Erro ao inserir venda:', erroVenda)
        throw new Error(`Erro ao criar venda: ${erroVenda.message}`)
      }

      if (!vendaDataArray || vendaDataArray.length === 0) {
        throw new Error('Erro: venda não foi criada no banco de dados')
      }

      const vendaData = vendaDataArray[0]

      for (const item of itens) {
        let produtoId = item.produto_id

        if (!produtoId) {
          const { data: novoProdutoArray, error: erroNovoProduto } = await supabase
            .from('produtos')
            .insert({
              codigo: `${item.categoria.substring(0, 1).toUpperCase()}${Math.floor(Math.random() * 10000)}`,
              descricao: item.descricao,
              quantidade: -item.quantidade,
              preco_custo: 0,
              valor_repasse: 0,
              preco_venda: item.preco_venda,
              categoria: item.categoria,
              data_ultima_compra: dataVenda,
            })
            .select()

          if (erroNovoProduto) {
            console.error('Erro ao criar novo produto:', erroNovoProduto)
            throw erroNovoProduto
          }
          const novoProduto = novoProdutoArray && novoProdutoArray.length > 0 ? novoProdutoArray[0] : null
          if (!novoProduto) throw new Error('Erro ao obter dados do novo produto')
          produtoId = novoProduto.id
        } else {
          const { data: produtoAtualArray } = await supabase
            .from('produtos')
            .select('quantidade')
            .eq('id', produtoId)

          const produtoAtual = produtoAtualArray && produtoAtualArray.length > 0 ? produtoAtualArray[0] : null

          if (produtoAtual) {
            const { error: erroUpdate } = await supabase
              .from('produtos')
              .update({
                quantidade: produtoAtual.quantidade - item.quantidade,
              })
              .eq('id', produtoId)

            if (erroUpdate) {
              console.error('Erro ao atualizar produto:', erroUpdate)
              throw erroUpdate
            }
          }
        }

        const { error: erroItem } = await supabase
          .from('itens_venda')
          .insert({
            venda_id: vendaData.id,
            produto_id: produtoId,
            descricao: item.descricao,
            quantidade: item.quantidade,
            preco_venda: item.preco_venda,
          })

        if (erroItem) {
          console.error('Erro ao inserir item de venda:', erroItem)
          throw erroItem
        }

        await supabase
          .from('movimentacoes_estoque')
          .insert({
            produto_id: produtoId,
            tipo: 'saida',
            quantidade: item.quantidade,
            observacao: `Venda para ${cliente} em ${dataVenda}`,
            data: new Date().toISOString(),
          })
      }

      setDataVenda(getDataAtualBrasil())
      setCliente('')
      setItens([
        {
          id: Date.now().toString(),
          produto_id: null,
          descricao: '',
          quantidade: 1,
          categoria: '',
          preco_venda: 0,
          estoque_atual: 0,
          minimizado: false,
          isNovoCadastro: false,
        },
      ])
      setQuantidadeParcelas(1)
      setPrazoParcelas('mensal')
      setStatusPagamento('pendente')

      console.log('✅ Venda registrada com sucesso!')
      onVendaAdicionada()
    } catch (err) {
      console.error('❌ Erro completo:', err)
      setErro(err instanceof Error ? err.message : 'Erro ao registrar venda')
    } finally {
      setLoading(false)
    }
  }

  const itemAtivo = itens[itens.length - 1]

  return (
    <div className="bg-white rounded-lg shadow-md p-3 space-y-2">
      <h2 className="text-sm font-semibold text-gray-800 mb-2">Nova Venda</h2>

      {erro && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1.5 rounded text-xs">
          {erro}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-2">
        {/* Data e Cliente */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
              Data da Venda
            </label>
            <input
              type="date"
              value={dataVenda}
              onChange={(e) => setDataVenda(e.target.value)}
              className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
              Cliente *
            </label>
            <input
              type="text"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Nome do cliente"
              className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
              required
            />
          </div>
        </div>

        {/* Itens Minimizados */}
        {itens.filter((i) => i.minimizado).length > 0 && (
          <div className="border-t pt-1.5">
            <h3 className="font-semibold text-gray-700 mb-1 text-[10px]">
              Itens Adicionados ({itens.filter((i) => i.minimizado).length})
            </h3>
            <div className="space-y-0.5">
              {itens
                .filter((i) => i.minimizado)
                .map((item) => (
                  <div
                    key={item.id}
                    className="bg-gray-50 p-1 rounded border border-gray-200 flex justify-between items-center"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-800 text-[10px]">{item.descricao}</p>
                      <p className="text-[9px] text-gray-600">
                        {item.quantidade}x R$ {item.preco_venda.toFixed(2)} = R${' '}
                        {(item.quantidade * item.preco_venda).toFixed(2)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removerItem(item.id)}
                      className="text-red-500 hover:text-red-700 text-[10px] font-medium ml-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Item Ativo (em edição) */}
        {itemAtivo && (
          <div className="border-t pt-1.5 bg-green-50 p-2 rounded border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-800 text-[10px]">
                Item {itens.length} (Em Preenchimento)
              </h3>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={itemAtivo.isNovoCadastro || false}
                  onChange={() => toggleNovoCadastro(itemAtivo.id)}
                  className="w-2.5 h-2.5 rounded border-gray-300"
                />
                <span className="text-[9px] font-medium text-gray-700">Novo Cadastro</span>
              </label>
            </div>

            <div className="space-y-1.5">
              {/* Campo Produto - Muda conforme modo */}
              {!itemAtivo.isNovoCadastro ? (
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                    Produto (Busca e Seleção)
                  </label>
                  <SeletorProduto
                    onSelecionarProduto={(produto) => selecionarProduto(produto, itemAtivo.id)}
                    onNovoItem={() => {}}
                    placeholder="Buscar produto existente..."
                    descricaoPreenchida={itemAtivo.descricao}
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                    Descrição do Produto *
                  </label>
                  <input
                    type="text"
                    value={itemAtivo.descricao}
                    onChange={(e) => atualizarItem(itemAtivo.id, 'descricao', e.target.value)}
                    placeholder="Nome do novo produto"
                    className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                    required
                  />
                </div>
              )}

              {/* Campo Categoria - Muda conforme modo */}
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                  Categoria *
                </label>
                {!itemAtivo.isNovoCadastro ? (
                  <input
                    type="text"
                    value={itemAtivo.categoria}
                    disabled
                    className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded bg-gray-100 text-gray-700"
                  />
                ) : (
                  <select
                    value={itemAtivo.categoria}
                    onChange={(e) => atualizarItem(itemAtivo.id, 'categoria', e.target.value)}
                    className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                    required
                  >
                    <option value="">Selecione uma categoria</option>
                    {categorias.map((cat) => (
                      <option key={cat.id} value={cat.nome}>
                        {cat.nome}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Quantidade e Estoque */}
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                    Quantidade *
                  </label>
                  <input
                    type="number"
                    value={itemAtivo.quantidade}
                    onChange={(e) =>
                      atualizarItem(itemAtivo.id, 'quantidade', parseInt(e.target.value) || 0)
                    }
                    className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                    Estoque Atual
                  </label>
                  <input
                    type="number"
                    value={itemAtivo.estoque_atual || 0}
                    disabled
                    className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded bg-gray-100 text-gray-700"
                  />
                </div>
              </div>

              {/* Preço de Venda */}
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                  Preço de Venda *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={itemAtivo.preco_venda}
                  onChange={(e) =>
                    atualizarItem(itemAtivo.id, 'preco_venda', parseFloat(e.target.value) || 0)
                  }
                  className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                  required
                />
              </div>

              {/* Informações de Pagamento */}
              <div className="border-t pt-1.5 mt-1.5">
                <h4 className="font-semibold text-gray-800 mb-1 text-[10px]">Informações de Pagamento</h4>
                <div className="grid grid-cols-3 gap-1.5">
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                      Parcelas
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={quantidadeParcelas}
                      onChange={(e) => setQuantidadeParcelas(parseInt(e.target.value) || 1)}
                      className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                      Prazo
                    </label>
                    <select
                      value={prazoParcelas}
                      onChange={(e) => setPrazoParcelas(e.target.value)}
                      className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                    >
                      <option value="diaria">Diária</option>
                      <option value="semanal">Semanal</option>
                      <option value="mensal">Mensal</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                      Status
                    </label>
                    <select
                      value={statusPagamento}
                      onChange={(e) => setStatusPagamento(e.target.value)}
                      className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                    >
                      <option value="pendente">Pendente</option>
                      <option value="pago">Pago</option>
                      <option value="parcial">Parcial</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Botão Adicionar Novo Item */}
              <button
                type="button"
                onClick={adicionarNovoItem}
                className="w-full mt-1.5 bg-green-500 hover:bg-green-600 text-white py-1 rounded font-medium text-[10px] transition-colors"
              >
                + Adicionar Outro Item
              </button>
            </div>
          </div>
        )}

        {/* Total */}
        <div className="bg-gray-50 p-1.5 rounded border border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-gray-800">Total:</span>
            <span className="text-base font-bold text-green-600">
              R$ {calcularTotal().toFixed(2)}
            </span>
          </div>
        </div>

        {/* Botão Registrar */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-1.5 rounded font-semibold text-xs transition-colors"
        >
          {loading ? 'Registrando...' : 'Registrar Venda'}
        </button>
      </form>
    </div>
  )
}
