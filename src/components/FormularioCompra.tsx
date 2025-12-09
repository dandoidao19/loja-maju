'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getDataAtualBrasil } from '@/lib/dateUtils'
import SeletorProduto from './SeletorProduto'

interface ItemCompra {
  id: string
  produto_id: string | null
  descricao: string
  quantidade: number
  categoria: string
  preco_custo: number
  preco_venda: number
  minimizado?: boolean
  isNovoCadastro?: boolean
}

interface FormularioCompraProps {
  onCompraAdicionada: () => void
}

const getDataNDias = (dataBase: string, dias: number) => {
  const data = new Date(dataBase)
  data.setDate(data.getDate() + dias)
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

const addMonths = (dateString: string, months: number): string => {
  const [ano, mes, dia] = dateString.split('-').map(Number)
  const date = new Date(ano, mes - 1 + months, dia)

  if (date.getDate() !== dia) {
    date.setDate(0)
  }

  const novoAno = date.getFullYear()
  const novoMes = String(date.getMonth() + 1).padStart(2, '0')
  const novoDia = String(date.getDate()).padStart(2, '0')

  return `${novoAno}-${novoMes}-${novoDia}`
}

export default function FormularioCompra({ onCompraAdicionada }: FormularioCompraProps) {
  const [dataCompra, setDataCompra] = useState(getDataAtualBrasil())
  const [fornecedor, setFornecedor] = useState('')
  const [itens, setItens] = useState<ItemCompra[]>([
    {
      id: Date.now().toString(),
      produto_id: null,
      descricao: '',
      quantidade: 1,
      categoria: '',
      preco_custo: 0,
      preco_venda: 0,
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
      if (data && data.length > 0) {
        setItens((prev) => [{ ...prev[0], categoria: data[0].nome }])
      }
    } catch (error) {
      console.error('Erro ao carregar categorias:', error)
    }
  }

  const calcularTotal = () => {
    return itens.reduce((total, item) => total + item.quantidade * item.preco_custo, 0)
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
        categoria: categorias[0]?.nome || '',
        preco_custo: 0,
        preco_venda: 0,
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
              preco_custo: 0,
              preco_venda: 0,
            }
          : item
      )
    )
  }

  const selecionarProduto = (produto: any, idItem: string) => {
    console.log('📦 Produto selecionado:', produto)
    console.log('📦 ID do item:', idItem)
    
    // BUGFIX: Fazer uma ÚNICA atualização com todos os campos de uma vez
    setItens((prevItens) =>
      prevItens.map((item) =>
        item.id === idItem
          ? {
              ...item,
              produto_id: produto.id,
              descricao: produto.descricao || '',
              preco_custo: produto.preco_custo || 0,
              preco_venda: produto.preco_venda || 0,
              categoria: produto.categoria || '',
            }
          : item
      )
    )
    
    console.log('✅ Item atualizado com dados do produto')
  }

  const buscarUltimoPrecoCusto = async (descricao: string, idItem: string) => {
    try {
      const { data } = await supabase
        .from('produtos')
        .select('preco_custo')
        .ilike('descricao', `%${descricao}%`)
        .order('data_ultima_compra', { ascending: false })
        .limit(1)
        .single()

      if (data) {
        atualizarItem(idItem, 'preco_custo', data.preco_custo)
      }
    } catch (error) {
      console.error('Erro ao buscar último preço:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setLoading(true)

    try {
      if (!fornecedor.trim()) {
        throw new Error('Fornecedor é obrigatório')
      }

      for (const item of itens) {
        if (!item.descricao.trim()) {
          throw new Error('Todos os itens devem ter descrição')
        }
        if (item.quantidade <= 0) {
          throw new Error('Quantidade deve ser maior que 0')
        }
        if (item.preco_custo <= 0) {
          throw new Error('Preço de custo deve ser maior que 0')
        }
        if (item.preco_venda <= 0) {
          throw new Error('Preço de venda deve ser maior que 0')
        }
      }

      const { data: numeroTransacao } = await supabase
        .rpc('obter_proximo_numero_transacao')

      const { data: compraData, error: erroCompra } = await supabase
        .from('compras')
        .insert({
          numero_transacao: numeroTransacao,
          data_compra: dataCompra,
          fornecedor,
          total: calcularTotal(),
          quantidade_itens: itens.length,
          forma_pagamento: 'dinheiro',
          status_pagamento: statusPagamento,
          quantidade_parcelas: quantidadeParcelas,
          prazoparcelas: prazoParcelas,
        })
        .select()
        .single()

      if (erroCompra) {
        console.error('Erro ao inserir compra:', erroCompra)
        throw erroCompra
      }

      for (const item of itens) {
        let produtoId = item.produto_id

        if (!produtoId) {
          const { data: novoProduto, error: erroNovoProduto } = await supabase
            .from('produtos')
            .insert({
              codigo: `${item.categoria.substring(0, 1).toUpperCase()}${Math.floor(Math.random() * 10000)}`,
              descricao: item.descricao,
              quantidade: item.quantidade,
              preco_custo: item.preco_custo,
              valor_repasse: item.preco_custo * 1.3,
              preco_venda: item.preco_venda,
              categoria: item.categoria,
              data_ultima_compra: dataCompra,
            })
            .select()
            .single()

          if (erroNovoProduto) {
            console.error('Erro ao criar novo produto:', erroNovoProduto)
            throw erroNovoProduto
          }
          produtoId = novoProduto.id
        } else {
          const { data: produtoAtual } = await supabase
            .from('produtos')
            .select('quantidade')
            .eq('id', produtoId)
            .single()

          if (produtoAtual) {
            const { error: erroUpdate } = await supabase
              .from('produtos')
              .update({
                quantidade: produtoAtual.quantidade + item.quantidade,
              })
              .eq('id', produtoId)

            if (erroUpdate) {
              console.error('Erro ao atualizar produto:', erroUpdate)
              throw erroUpdate
            }
          }
        }

        const { error: erroItem } = await supabase
          .from('itens_compra')
          .insert({
            compra_id: compraData.id,
            produto_id: produtoId,
            descricao: item.descricao,
            quantidade: item.quantidade,
            categoria: item.categoria,
            preco_custo: item.preco_custo,
            preco_venda: item.preco_venda,
          })

        if (erroItem) {
          console.error('Erro ao inserir item de compra:', erroItem)
          throw erroItem
        }

        await supabase
          .from('movimentacoes_estoque')
          .insert({
            produto_id: produtoId,
            tipo: 'entrada',
            quantidade: item.quantidade,
            observacao: `Compra de ${fornecedor} em ${dataCompra}`,
            data: new Date().toISOString(),
          })
      }

      setDataCompra(getDataAtualBrasil())
      setFornecedor('')
      setItens([
        {
          id: Date.now().toString(),
          produto_id: null,
          descricao: '',
          quantidade: 1,
          categoria: categorias[0]?.nome || '',
          preco_custo: 0,
          preco_venda: 0,
          minimizado: false,
          isNovoCadastro: false,
        },
      ])
      setQuantidadeParcelas(1)
      setPrazoParcelas('mensal')
      setStatusPagamento('pendente')

      console.log('✅ Compra registrada com sucesso!')
      onCompraAdicionada()
    } catch (err) {
      console.error('❌ Erro completo:', err)
      setErro(err instanceof Error ? err.message : 'Erro ao registrar compra')
    } finally {
      setLoading(false)
    }
  }

  const itemAtivo = itens[itens.length - 1]

  return (
    <div className="bg-white rounded-lg shadow-md p-3 space-y-2">
      <h2 className="text-sm font-semibold text-gray-800 mb-2">Nova Compra</h2>

      {erro && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded text-xs">
          {erro}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-2">
        {/* Data e Fornecedor */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Data da Compra
            </label>
            <input
              type="date"
              value={dataCompra}
              onChange={(e) => setDataCompra(e.target.value)}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Fornecedor *
            </label>
            <input
              type="text"
              value={fornecedor}
              onChange={(e) => setFornecedor(e.target.value)}
              placeholder="Nome do fornecedor"
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        {/* Itens Minimizados */}
        {itens.filter((i) => i.minimizado).length > 0 && (
          <div className="border-t pt-2">
            <h3 className="font-semibold text-gray-700 mb-2 text-xs">
              Itens Adicionados ({itens.filter((i) => i.minimizado).length})
            </h3>
            <div className="space-y-1">
              {itens
                .filter((i) => i.minimizado)
                .map((item) => (
                  <div
                    key={item.id}
                    className="bg-gray-50 p-1 rounded border border-gray-200 flex justify-between items-center"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-800 text-xs">{item.descricao}</p>
                      <p className="text-xs text-gray-600">
                        {item.quantidade}x R$ {item.preco_custo.toFixed(2)} = R${' '}
                        {(item.quantidade * item.preco_custo).toFixed(2)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removerItem(item.id)}
                      className="text-red-500 hover:text-red-700 text-xs font-medium ml-2"
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
          <div className="border-t pt-2 bg-blue-50 p-2 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-800 text-xs">
                Item {itens.length} (Em Preenchimento)
              </h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={itemAtivo.isNovoCadastro || false}
                  onChange={() => toggleNovoCadastro(itemAtivo.id)}
                  className="w-3 h-3 rounded border-gray-300"
                />
                <span className="text-xs font-medium text-gray-700">Novo Cadastro</span>
              </label>
            </div>

            <div className="space-y-2">
              {/* Campo Produto - Muda conforme modo */}
              {!itemAtivo.isNovoCadastro ? (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
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
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Descrição do Produto *
                  </label>
                  <input
                    type="text"
                    value={itemAtivo.descricao}
                    onChange={(e) => atualizarItem(itemAtivo.id, 'descricao', e.target.value)}
                    placeholder="Nome do novo produto"
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              )}

              {/* Campo Categoria - Muda conforme modo */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Categoria *
                </label>
                {!itemAtivo.isNovoCadastro ? (
                  <input
                    type="text"
                    value={itemAtivo.categoria}
                    disabled
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg bg-gray-100 text-gray-700"
                  />
                ) : (
                  <select
                    value={itemAtivo.categoria}
                    onChange={(e) => atualizarItem(itemAtivo.id, 'categoria', e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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

              {/* Quantidade */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Quantidade *
                </label>
                <input
                  type="number"
                  value={itemAtivo.quantidade}
                  onChange={(e) =>
                    atualizarItem(itemAtivo.id, 'quantidade', parseInt(e.target.value) || 0)
                  }
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Preço de Custo - Muda conforme modo */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Preço de Custo *
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={itemAtivo.preco_custo}
                    onChange={(e) =>
                      atualizarItem(itemAtivo.id, 'preco_custo', parseFloat(e.target.value) || 0)
                    }
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  {!itemAtivo.isNovoCadastro && (
                    <button
                      type="button"
                      onClick={() => buscarUltimoPrecoCusto(itemAtivo.descricao, itemAtivo.id)}
                      className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-medium"
                    >
                      Buscar
                    </button>
                  )}
                </div>
              </div>

              {/* Preço de Venda */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Preço de Venda *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={itemAtivo.preco_venda}
                  onChange={(e) =>
                    atualizarItem(itemAtivo.id, 'preco_venda', parseFloat(e.target.value) || 0)
                  }
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Informações de Pagamento */}
              <div className="border-t pt-2 mt-2">
                <h4 className="font-semibold text-gray-800 mb-2 text-xs">Informações de Pagamento</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Parcelas
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={quantidadeParcelas}
                      onChange={(e) => setQuantidadeParcelas(parseInt(e.target.value) || 1)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Prazo
                    </label>
                    <select
                      value={prazoParcelas}
                      onChange={(e) => setPrazoParcelas(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="diaria">Diária</option>
                      <option value="semanal">Semanal</option>
                      <option value="mensal">Mensal</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      value={statusPagamento}
                      onChange={(e) => setStatusPagamento(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full mt-2 bg-green-500 hover:bg-green-600 text-white py-1 rounded-lg font-medium text-xs transition-colors"
              >
                + Adicionar Outro Item
              </button>
            </div>
          </div>
        )}

        {/* Total */}
        <div className="bg-gray-50 p-2 rounded-lg border border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-gray-800">Total:</span>
            <span className="text-xl font-bold text-blue-600">
              R$ {calcularTotal().toFixed(2)}
            </span>
          </div>
        </div>

        {/* Botão Registrar */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-1.5 rounded-lg font-semibold text-xs transition-colors"
        >
          {loading ? 'Registrando...' : 'Registrar Compra'}
        </button>
      </form>
    </div>
  )
}
