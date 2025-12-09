'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getDataAtualBrasil } from '@/lib/dateUtils'
import SeletorProduto from './SeletorProduto'

interface ItemCondicional {
  id: string
  produto_id: string | null
  descricao: string
  quantidade: number
  categoria: string
  preco_custo: number
  preco_venda: number
  status: 'pendente' | 'devolvido' | 'efetivado'
  valor_efetivado?: number
  minimizado?: boolean
  isNovoCadastro?: boolean
}

interface TransacaoCondicional {
  id: string
  numero_transacao: number
  tipo: 'recebido' | 'enviado'
  origem: string
  data_transacao: string
  observacao: string
  status: 'pendente' | 'resolvido' | 'cancelado'
  itens: ItemCondicional[]
}

export default function ModuloCondicional() {
  const [tipo, setTipo] = useState<'recebido' | 'enviado'>('recebido')
  const [origem, setOrigem] = useState('')
  const [dataTransacao, setDataTransacao] = useState(getDataAtualBrasil())
  const [observacao, setObservacao] = useState('')
  const [itens, setItens] = useState<ItemCondicional[]>([
    {
      id: Date.now().toString(),
      produto_id: null,
      descricao: '',
      quantidade: 1,
      categoria: '',
      preco_custo: 0,
      preco_venda: 0,
      status: 'pendente',
      minimizado: false,
      isNovoCadastro: false,
    },
  ])
  const [categorias, setCategorias] = useState<any[]>([])
  const [transacoes, setTransacoes] = useState<TransacaoCondicional[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [transacaoSelecionada, setTransacaoSelecionada] = useState<TransacaoCondicional | null>(null)
  const [transacoesExpandidas, setTransacoesExpandidas] = useState<Set<string>>(new Set())

  useEffect(() => {
    carregarCategorias()
    carregarTransacoes()
  }, [])

  const toggleTransacao = (id: string) => {
    const novasExpandidas = new Set(transacoesExpandidas)
    if (novasExpandidas.has(id)) {
      novasExpandidas.delete(id)
    } else {
      novasExpandidas.add(id)
    }
    setTransacoesExpandidas(novasExpandidas)
  }

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

  const carregarTransacoes = async () => {
    try {
      const { data, error } = await supabase
        .from('transacoes_condicionais')
        .select(`
          *,
          itens_condicionais (
            *,
            produtos (descricao, categoria)
          )
        `)
        .order('data_transacao', { ascending: false })

      if (error) throw error

      const transacoesFormatadas = data?.map((t: any) => ({
        id: t.id,
        numero_transacao: t.numero_transacao,
        tipo: t.tipo,
        origem: t.origem,
        data_transacao: t.data_transacao,
        observacao: t.observacao,
        status: t.status,
        itens: t.itens_condicionais?.map((i: any) => ({
          id: i.id,
          produto_id: i.produto_id,
          descricao: i.produtos?.descricao || '',
          quantidade: i.quantidade,
          categoria: i.produtos?.categoria || '',
          status: i.status,
          valor_efetivado: i.valor_efetivado,
          preco_custo: 0,
          preco_venda: 0,
        })) || [],
      })) || []

      setTransacoes(transacoesFormatadas)
    } catch (error) {
      console.error('Erro ao carregar transações:', error)
      setErro('Erro ao carregar transações condicionais')
    }
  }

  const adicionarItem = () => {
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
        status: 'pendente',
        minimizado: false,
        isNovoCadastro: false,
      },
    ])
  }

  const removerItem = (id: string) => {
    if (itens.length > 1) {
      setItens(itens.filter((i) => i.id !== id))
    } else {
      alert('Você deve ter pelo menos um item')
    }
    setErro('')
  }

  const atualizarItem = (id: string, campo: string, valor: any) => {
    setItens(itens.map((i) => (i.id === id ? { ...i, [campo]: valor } : i)))
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
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setLoading(true)

    try {
      if (!origem.trim()) {
        throw new Error('Origem é obrigatória')
      }

      for (const item of itens) {
        if (!item.descricao.trim()) {
          throw new Error('Todos os itens devem ter descrição')
        }
        if (item.quantidade <= 0) {
          throw new Error('Quantidade deve ser maior que 0')
        }
        if (item.isNovoCadastro) {
          if (item.preco_custo <= 0) {
            throw new Error('Preço de custo deve ser maior que 0 para novos produtos')
          }
          if (item.preco_venda <= 0) {
            throw new Error('Preço de venda deve ser maior que 0 para novos produtos')
          }
        }
      }

      const { data: numeroTransacao } = await supabase.rpc('obter_proximo_numero_transacao')

      const { data: transacaoData, error: erroTransacao } = await supabase
        .from('transacoes_condicionais')
        .insert({
          numero_transacao: numeroTransacao,
          tipo,
          origem,
          data_transacao: dataTransacao,
          observacao,
          status: 'pendente',
        })
        .select()

      if (erroTransacao || !transacaoData || transacaoData.length === 0) {
        throw new Error('Erro ao criar transação condicional')
      }

      const transacaoId = transacaoData[0].id

      for (const item of itens) {
        let produtoId = item.produto_id

        if (!produtoId) {
          const { data: novoProduto, error: erroNovoProduto } = await supabase
            .from('produtos')
            .insert({
              codigo: `${item.categoria.substring(0, 1).toUpperCase()}${Math.floor(Math.random() * 10000)}`,
              descricao: item.descricao,
              quantidade: tipo === 'recebido' ? item.quantidade : -item.quantidade,
              preco_custo: item.preco_custo,
              valor_repasse: item.preco_custo * 1.3,
              preco_venda: item.preco_venda,
              categoria: item.categoria,
              data_ultima_compra: dataTransacao,
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
            const novaQuantidade =
              tipo === 'recebido'
                ? produtoAtual.quantidade + item.quantidade
                : produtoAtual.quantidade - item.quantidade

            await supabase
              .from('produtos')
              .update({ quantidade: novaQuantidade })
              .eq('id', produtoId)
          }
        }

        const { error: erroItem } = await supabase.from('itens_condicionais').insert({
          transacao_id: transacaoId,
          produto_id: produtoId,
          quantidade: item.quantidade,
          status: 'pendente',
        })

        if (erroItem) throw erroItem

        await supabase.from('movimentacoes_estoque').insert({
          produto_id: produtoId,
          tipo: tipo === 'recebido' ? 'entrada' : 'saida',
          quantidade: item.quantidade,
          observacao: `Condicional ${tipo} - ${origem}`,
          data: new Date().toISOString(),
        })
      }

      setOrigem('')
      setDataTransacao(getDataAtualBrasil())
      setObservacao('')
      setItens([
        {
          id: Date.now().toString(),
          produto_id: null,
          descricao: '',
          quantidade: 1,
          categoria: categorias[0]?.nome || '',
          preco_custo: 0,
          preco_venda: 0,
          status: 'pendente',
          minimizado: false,
          isNovoCadastro: false,
        },
      ])

      alert('✅ Transação condicional registrada com sucesso!')
      carregarTransacoes()
    } catch (err) {
      console.error('Erro:', err)
      setErro(err instanceof Error ? err.message : 'Erro ao registrar transação')
    } finally {
      setLoading(false)
    }
  }

  const resolverTransacao = async (transacao: TransacaoCondicional) => {
    setTransacaoSelecionada(transacao)
  }

  const finalizarResolucao = async () => {
    if (!transacaoSelecionada) return

    setLoading(true)
    try {
      await supabase
        .from('transacoes_condicionais')
        .update({ status: 'resolvido' })
        .eq('id', transacaoSelecionada.id)

      for (const item of transacaoSelecionada.itens) {
        await supabase
          .from('itens_condicionais')
          .update({
            status: item.status,
            valor_efetivado: item.valor_efetivado,
            data_resolucao: new Date().toISOString(),
          })
          .eq('id', item.id)

        if (item.status === 'devolvido') {
          const { data: produtoAtual } = await supabase
            .from('produtos')
            .select('quantidade')
            .eq('id', item.produto_id)
            .single()

          if (produtoAtual) {
            const novaQuantidade =
              transacaoSelecionada.tipo === 'recebido'
                ? produtoAtual.quantidade - item.quantidade
                : produtoAtual.quantidade + item.quantidade

            await supabase
              .from('produtos')
              .update({ quantidade: novaQuantidade })
              .eq('id', item.produto_id)

            await supabase.from('movimentacoes_estoque').insert({
              produto_id: item.produto_id,
              tipo: transacaoSelecionada.tipo === 'recebido' ? 'saida' : 'entrada',
              quantidade: item.quantidade,
              observacao: `Devolução de condicional - ${transacaoSelecionada.origem}`,
              data: new Date().toISOString(),
            })
          }
        } else if (item.status === 'efetivado' && item.valor_efetivado) {
          const { data: numeroTransacaoFinanceira } = await supabase.rpc('obter_proximo_numero_transacao')
          
          if (transacaoSelecionada.tipo === 'recebido') {
            const { data: compraData, error: erroCompra } = await supabase
              .from('compras')
              .insert({
                numero_transacao: numeroTransacaoFinanceira,
                data_compra: new Date().toISOString().split('T')[0],
                fornecedor: transacaoSelecionada.origem,
                total: item.valor_efetivado,
                quantidade_itens: 1,
                forma_pagamento: 'dinheiro',
                status_pagamento: 'pendente',
                quantidade_parcelas: 1,
                prazoparcelas: 'mensal',
              })
              .select()
              .single()
            
            if (erroCompra) throw erroCompra
            
            await supabase.from('itens_compra').insert({
              compra_id: compraData.id,
              produto_id: item.produto_id,
              descricao: item.descricao,
              quantidade: item.quantidade,
              categoria: item.categoria,
              preco_custo: item.valor_efetivado / item.quantidade,
              preco_venda: 0,
            })
          } else {
            const { data: vendaData, error: erroVenda } = await supabase
              .from('vendas')
              .insert({
                numero_transacao: numeroTransacaoFinanceira,
                data_venda: new Date().toISOString().split('T')[0],
                cliente: transacaoSelecionada.origem,
                total: item.valor_efetivado,
                quantidade_itens: 1,
                forma_pagamento: 'dinheiro',
                status_pagamento: 'pendente',
                quantidade_parcelas: 1,
                prazoparcelas: 'mensal',
              })
              .select()
              .single()
            
            if (erroVenda) throw erroVenda
            
            await supabase.from('itens_venda').insert({
              venda_id: vendaData.id,
              produto_id: item.produto_id,
              descricao: item.descricao,
              quantidade: item.quantidade,
              preco_venda: item.valor_efetivado / item.quantidade,
            })
          }
        }
      }

      alert('✅ Transação resolvida com sucesso!')
      setTransacaoSelecionada(null)
      carregarTransacoes()
    } catch (error) {
      console.error('Erro ao resolver transação:', error)
      setErro('Erro ao resolver transação')
    } finally {
      setLoading(false)
    }
  }

  const itemAtivo = itens[itens.length - 1]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* COLUNA ESQUERDA: FORMULÁRIO COMPACTO */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-lg shadow-md p-3 space-y-2">
          <h2 className="text-sm font-semibold text-gray-800 mb-2">Nova Transação Condicional</h2>

          {erro && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1.5 rounded text-xs">
              {erro}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-2">
            {/* Tipo de Transação */}
            <div>
              <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                Tipo de Transação *
              </label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as 'recebido' | 'enviado')}
                className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="recebido">📥 Recebido (de Fornecedor)</option>
                <option value="enviado">📤 Enviado (para Cliente)</option>
              </select>
            </div>

            {/* Data e Origem */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                  Data *
                </label>
                <input
                  type="date"
                  value={dataTransacao}
                  onChange={(e) => setDataTransacao(e.target.value)}
                  className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                  {tipo === 'recebido' ? 'Fornecedor' : 'Cliente'} *
                </label>
                <input
                  type="text"
                  value={origem}
                  onChange={(e) => setOrigem(e.target.value)}
                  placeholder={tipo === 'recebido' ? 'Nome do fornecedor' : 'Nome do cliente'}
                  className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                  required
                />
              </div>
            </div>

            {/* Observação */}
            <div>
              <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                Observação
              </label>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Informações adicionais..."
                className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                rows={2}
              />
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
                            Qtd: {item.quantidade} | Custo: R$ {item.preco_custo.toFixed(2)}
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
              <div className="border-t pt-1.5 bg-purple-50 p-2 rounded border border-purple-200">
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
                        className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                        required
                      />
                    </div>
                  )}

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
                        className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
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
                      className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                      Preço de Custo (R$) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={itemAtivo.preco_custo}
                      onChange={(e) =>
                        atualizarItem(itemAtivo.id, 'preco_custo', parseFloat(e.target.value) || 0)
                      }
                      placeholder="0.00"
                      className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                      required={itemAtivo.isNovoCadastro}
                      disabled={!itemAtivo.isNovoCadastro && !itemAtivo.produto_id}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                      Preço de Venda (R$) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={itemAtivo.preco_venda}
                      onChange={(e) =>
                        atualizarItem(itemAtivo.id, 'preco_venda', parseFloat(e.target.value) || 0)
                      }
                      placeholder="0.00"
                      className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                      required={itemAtivo.isNovoCadastro}
                      disabled={!itemAtivo.isNovoCadastro && !itemAtivo.produto_id}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={adicionarItem}
                    className="w-full mt-1.5 bg-green-500 hover:bg-green-600 text-white py-1 rounded font-medium text-[10px] transition-colors"
                  >
                    + Adicionar Outro Item
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white py-1.5 rounded font-semibold text-xs transition-colors"
            >
              {loading ? 'Registrando...' : 'Registrar Transação'}
            </button>
          </form>
        </div>
      </div>

      {/* COLUNA DIREITA: TRANSAÇÕES COM MINIMIZAÇÃO */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-lg shadow-md p-3">
          <h2 className="text-sm font-semibold text-gray-800 mb-2">Transações Condicionais</h2>

          {transacoes.length === 0 ? (
            <p className="text-gray-600 text-xs">Nenhuma transação cadastrada</p>
          ) : (
            <div className="space-y-2">
              {transacoes.map((transacao) => {
                const expandida = transacoesExpandidas.has(transacao.id)
                
                return (
                  <div
                    key={transacao.id}
                    className={`border rounded overflow-hidden hover:border-purple-300 transition-colors ${
                      transacao.status === 'resolvido' 
                        ? 'border-green-300' 
                        : 'border-gray-200'
                    }`}
                  >
                    {/* CABEÇALHO MINIMIZADO */}
                    <div
                      onClick={() => toggleTransacao(transacao.id)}
                      className={`p-2 cursor-pointer hover:bg-gray-100 transition-colors ${
                        transacao.status === 'resolvido' ? 'bg-green-50' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-800">
                              #{transacao.numero_transacao}
                            </span>
                            <span className="text-xs text-gray-600">
                              {transacao.origem}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(transacao.data_transacao).toLocaleDateString('pt-BR')}
                            </span>
                            {transacao.status === 'resolvido' && (
                              <span className="text-[9px] bg-green-600 text-white px-1.5 py-0.5 rounded">
                                ✓ Resolvido
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-gray-600">
                              {transacao.tipo === 'recebido' ? '📥 Recebido' : '📤 Enviado'}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              {transacao.itens?.length || 0} {transacao.itens?.length === 1 ? 'item' : 'itens'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {transacao.status === 'pendente' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                resolverTransacao(transacao)
                              }}
                              className="px-2 py-0.5 bg-green-600 hover:bg-green-700 text-white rounded text-[10px] font-medium"
                            >
                              Resolver
                            </button>
                          )}
                          <div className="text-gray-400 text-xs">
                            {expandida ? '▼' : '▶'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* DETALHES EXPANDIDOS */}
                    {expandida && (
                      <div className="p-2 bg-white border-t border-gray-200">
                        {transacao.observacao && (
                          <p className="text-xs text-gray-600 mb-2">
                            <span className="font-medium">Obs:</span> {transacao.observacao}
                          </p>
                        )}

                        <div className="border-t pt-2">
                          <p className="text-xs font-semibold text-gray-700 mb-1">Itens:</p>
                          <div className="space-y-1">
                            {transacao.itens.map((item) => (
                              <div
                                key={item.id}
                                className="bg-gray-50 p-1.5 rounded text-xs"
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-800 text-[10px]">
                                      {item.descricao}
                                      {transacao.status === 'resolvido' && (
                                        <span className={`ml-1 ${
                                          item.status === 'efetivado' ? 'text-green-600' : 'text-orange-600'
                                        }`}>
                                          ({item.status === 'efetivado' ? 'Efetivado' : 'Devolvido'})
                                        </span>
                                      )}
                                    </p>
                                    <p className="text-[9px] text-gray-600">
                                      Qtd: {item.quantidade}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Resolução */}
      {transacaoSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-purple-800 mb-3">
              Resolver Transação #{transacaoSelecionada.numero_transacao}
            </h2>

            <p className="text-xs text-gray-600 mb-3">
              Para cada item, escolha se será <strong>devolvido</strong> (reverte estoque) ou{' '}
              <strong>efetivado</strong> (gera {transacaoSelecionada.tipo === 'recebido' ? 'compra' : 'venda'} no financeiro):
            </p>

            <div className="space-y-2">
              {transacaoSelecionada.itens.map((item, idx) => (
                <div key={item.id} className="border rounded p-2">
                  <p className="font-medium text-gray-800 mb-1.5 text-xs">
                    {item.descricao} - Qtd: {item.quantidade}
                  </p>

                  <div className="flex gap-1.5 mb-1.5">
                    <button
                      onClick={() => {
                        const novosItens = [...transacaoSelecionada.itens]
                        novosItens[idx].status = 'devolvido'
                        setTransacaoSelecionada({ ...transacaoSelecionada, itens: novosItens })
                      }}
                      className={`flex-1 py-1.5 rounded text-xs font-medium ${
                        item.status === 'devolvido'
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Devolver
                    </button>
                    <button
                      onClick={() => {
                        const novosItens = [...transacaoSelecionada.itens]
                        novosItens[idx].status = 'efetivado'
                        setTransacaoSelecionada({ ...transacaoSelecionada, itens: novosItens })
                      }}
                      className={`flex-1 py-1.5 rounded text-xs font-medium ${
                        item.status === 'efetivado'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Efetivar
                    </button>
                  </div>

                  {item.status === 'efetivado' && (
                    <div>
                      <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                        Valor de Efetivação (R$) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={item.valor_efetivado || ''}
                        onChange={(e) => {
                          const novosItens = [...transacaoSelecionada.itens]
                          novosItens[idx].valor_efetivado = parseFloat(e.target.value) || 0
                          setTransacaoSelecionada({ ...transacaoSelecionada, itens: novosItens })
                        }}
                        placeholder="0.00"
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setTransacaoSelecionada(null)}
                className="flex-1 py-1.5 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded text-xs font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={finalizarResolucao}
                disabled={loading}
                className="flex-1 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium disabled:opacity-50"
              >
                {loading ? 'Salvando...' : 'Confirmar Resolução'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
