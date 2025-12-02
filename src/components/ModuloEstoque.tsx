'use client'

import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'

interface Produto {
  id: string
  nome: string
  sku: string
  descricao: string
  preco_custo: number
  preco_venda: number
  estoque_atual: number
  estoque_minimo: number
  unidade_medida: string
  categoria: string
  ativo: boolean
}

interface Fornecedor {
  id: string
  nome: string
  telefone: string
}

interface Movimentacao {
  id: string
  produto_nome: string
  tipo: string
  quantidade: number
  observacao: string
  data_movimentacao: string
}

export default function ModuloEstoque() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [loading, setLoading] = useState(false)
  const [abaAtiva, setAbaAtiva] = useState('produtos') // 'produtos', 'movimentacoes', 'fornecedores'
  
  // Estados do formulário de produto
  const [formProduto, setFormProduto] = useState({
    nome: '',
    sku: '',
    descricao: '',
    preco_custo: '',
    preco_venda: '',
    estoque_minimo: '0',
    unidade_medida: 'un',
    categoria: ''
  })

  // Estados do formulário de movimentação
  const [formMovimentacao, setFormMovimentacao] = useState({
    produto_id: '',
    tipo: 'entrada',
    quantidade: '',
    valor_unitario: '',
    observacao: '',
    data_movimentacao: new Date().toISOString().split('T')[0]
  })

  // Carregar dados
  useEffect(() => {
    carregarDados()
  }, [])

  const carregarDados = async () => {
    const { data: prods } = await supabase
      .from('produtos')
      .select('*')
      .order('nome')

    const { data: forns } = await supabase
      .from('fornecedores')
      .select('*')
      .order('nome')

    const { data: movs } = await supabase
      .from('movimentacoes_estoque')
      .select(`
        *,
        produtos (nome)
      `)
      .order('data_movimentacao', { ascending: false })
      .limit(50)

    if (prods) setProdutos(prods)
    if (forns) setFornecedores(forns)
    if (movs) setMovimentacoes(movs as any)
  }

  const adicionarProduto = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase
      .from('produtos')
      .insert({
        nome: formProduto.nome,
        sku: formProduto.sku,
        descricao: formProduto.descricao,
        preco_custo: parseFloat(formProduto.preco_custo) || 0,
        preco_venda: parseFloat(formProduto.preco_venda) || 0,
        estoque_minimo: parseInt(formProduto.estoque_minimo) || 0,
        unidade_medida: formProduto.unidade_medida,
        categoria: formProduto.categoria
      })

    if (error) {
      alert('Erro: ' + error.message)
    } else {
      setFormProduto({
        nome: '',
        sku: '',
        descricao: '',
        preco_custo: '',
        preco_venda: '',
        estoque_minimo: '0',
        unidade_medida: 'un',
        categoria: ''
      })
      carregarDados()
      alert('Produto adicionado com sucesso!')
    }

    setLoading(false)
  }

  const adicionarMovimentacao = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Pega o primeiro caixa do usuário
    const { data: caixas } = await supabase
      .from('caixas')
      .select('id')
      .limit(1)

    if (!caixas || caixas.length === 0) {
      alert('Nenhum caixa encontrado!')
      return
    }

    const { error } = await supabase
      .from('movimentacoes_estoque')
      .insert({
        produto_id: formMovimentacao.produto_id,
        tipo: formMovimentacao.tipo,
        quantidade: parseInt(formMovimentacao.quantidade),
        valor_unitario: parseFloat(formMovimentacao.valor_unitario) || 0,
        observacao: formMovimentacao.observacao,
        data_movimentacao: formMovimentacao.data_movimentacao,
        origem: 'ajuste'
      })

    if (error) {
      alert('Erro: ' + error.message)
    } else {
      setFormMovimentacao({
        produto_id: '',
        tipo: 'entrada',
        quantidade: '',
        valor_unitario: '',
        observacao: '',
        data_movimentacao: new Date().toISOString().split('T')[0]
      })
      carregarDados()
      alert('Movimentação registrada com sucesso!')
    }

    setLoading(false)
  }

  // Estatísticas
  const estatisticas = {
    totalProdutos: produtos.length,
    estoqueBaixo: produtos.filter(p => p.estoque_atual <= p.estoque_minimo).length,
    valorTotalEstoque: produtos.reduce((sum, p) => sum + (p.estoque_atual * p.preco_custo), 0)
  }

  return (
    <div className="space-y-6">
      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h3 className="text-sm font-medium text-blue-800">Total de Produtos</h3>
          <p className="text-2xl font-bold text-blue-600">{estatisticas.totalProdutos}</p>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
          <h3 className="text-sm font-medium text-orange-800">Estoque Baixo</h3>
          <p className="text-2xl font-bold text-orange-600">{estatisticas.estoqueBaixo}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <h3 className="text-sm font-medium text-green-800">Valor em Estoque</h3>
          <p className="text-2xl font-bold text-green-600">R$ {estatisticas.valorTotalEstoque.toFixed(2)}</p>
        </div>
      </div>

      {/* Menu de Abas */}
      <div className="bg-white p-4 rounded-lg shadow-md">
        <div className="flex space-x-4">
          <button
            onClick={() => setAbaAtiva('produtos')}
            className={`px-4 py-2 rounded-lg ${
              abaAtiva === 'produtos' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📦 Produtos
          </button>
          <button
            onClick={() => setAbaAtiva('movimentacoes')}
            className={`px-4 py-2 rounded-lg ${
              abaAtiva === 'movimentacoes' 
                ? 'bg-green-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            🔄 Movimentações
          </button>
          <button
            onClick={() => setAbaAtiva('fornecedores')}
            className={`px-4 py-2 rounded-lg ${
              abaAtiva === 'fornecedores' 
                ? 'bg-purple-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            🏢 Fornecedores
          </button>
        </div>
      </div>

      {/* Conteúdo das Abas */}
      {abaAtiva === 'produtos' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulário de Produto */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Novo Produto</h2>
            <form onSubmit={adicionarProduto} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nome do Produto *</label>
                <input
                  type="text"
                  value={formProduto.nome}
                  onChange={(e) => setFormProduto({...formProduto, nome: e.target.value})}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">SKU</label>
                  <input
                    type="text"
                    value={formProduto.sku}
                    onChange={(e) => setFormProduto({...formProduto, sku: e.target.value})}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Categoria</label>
                  <input
                    type="text"
                    value={formProduto.categoria}
                    onChange={(e) => setFormProduto({...formProduto, categoria: e.target.value})}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Preço de Custo</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formProduto.preco_custo}
                    onChange={(e) => setFormProduto({...formProduto, preco_custo: e.target.value})}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Preço de Venda</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formProduto.preco_venda}
                    onChange={(e) => setFormProduto({...formProduto, preco_venda: e.target.value})}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Estoque Mínimo</label>
                <input
                  type="number"
                  value={formProduto.estoque_minimo}
                  onChange={(e) => setFormProduto({...formProduto, estoque_minimo: e.target.value})}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Descrição</label>
                <textarea
                  value={formProduto.descricao}
                  onChange={(e) => setFormProduto({...formProduto, descricao: e.target.value})}
                  rows={3}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? 'Adicionando...' : 'Adicionar Produto'}
              </button>
            </form>
          </div>

          {/* Lista de Produtos */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Lista de Produtos</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {produtos.map(produto => (
                <div key={produto.id} className="border-b pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{produto.nome}</p>
                      <div className="flex space-x-2 text-xs text-gray-500 mt-1">
                        <span>SKU: {produto.sku}</span>
                        <span>•</span>
                        <span>Estoque: {produto.estoque_atual}</span>
                        {produto.estoque_atual <= produto.estoque_minimo && (
                          <span className="text-red-500 font-semibold">• ESTOQUE BAIXO</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        Custo: R$ {produto.preco_custo.toFixed(2)} | Venda: R$ {produto.preco_venda.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {produtos.length === 0 && (
                <p className="text-gray-500 text-center py-4">Nenhum produto cadastrado.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {abaAtiva === 'movimentacoes' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulário de Movimentação */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Nova Movimentação</h2>
            <form onSubmit={adicionarMovimentacao} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Produto *</label>
                <select
                  value={formMovimentacao.produto_id}
                  onChange={(e) => setFormMovimentacao({...formMovimentacao, produto_id: e.target.value})}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Selecione um produto</option>
                  {produtos.map(produto => (
                    <option key={produto.id} value={produto.id}>
                      {produto.nome} (Estoque: {produto.estoque_atual})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tipo *</label>
                  <select
                    value={formMovimentacao.tipo}
                    onChange={(e) => setFormMovimentacao({...formMovimentacao, tipo: e.target.value})}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="entrada">Entrada</option>
                    <option value="saida">Saída</option>
                    <option value="ajuste">Ajuste</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Quantidade *</label>
                  <input
                    type="number"
                    value={formMovimentacao.quantidade}
                    onChange={(e) => setFormMovimentacao({...formMovimentacao, quantidade: e.target.value})}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Valor Unitário</label>
                <input
                  type="number"
                  step="0.01"
                  value={formMovimentacao.valor_unitario}
                  onChange={(e) => setFormMovimentacao({...formMovimentacao, valor_unitario: e.target.value})}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Observação</label>
                <input
                  type="text"
                  value={formMovimentacao.observacao}
                  onChange={(e) => setFormMovimentacao({...formMovimentacao, observacao: e.target.value})}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: Compra do fornecedor, Ajuste de inventário..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Data</label>
                <input
                  type="date"
                  value={formMovimentacao.data_movimentacao}
                  onChange={(e) => setFormMovimentacao({...formMovimentacao, data_movimentacao: e.target.value})}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 disabled:opacity-50"
              >
                {loading ? 'Registrando...' : 'Registrar Movimentação'}
              </button>
            </form>
          </div>

          {/* Histórico de Movimentações */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Histórico de Movimentações</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {movimentacoes.map(mov => (
                <div key={mov.id} className="border-b pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{mov.produto_nome}</p>
                      <div className="flex space-x-2 text-xs text-gray-500 mt-1">
                        <span className={`px-2 py-1 rounded ${
                          mov.tipo === 'entrada' ? 'bg-green-100 text-green-800' : 
                          mov.tipo === 'saida' ? 'bg-red-100 text-red-800' : 
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {mov.tipo.toUpperCase()}
                        </span>
                        <span>Qtd: {mov.quantidade}</span>
                        <span>•</span>
                        <span>{new Date(mov.data_movimentacao).toLocaleDateString('pt-BR')}</span>
                      </div>
                      {mov.observacao && (
                        <p className="text-xs text-gray-600 mt-1">{mov.observacao}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {movimentacoes.length === 0 && (
                <p className="text-gray-500 text-center py-4">Nenhuma movimentação registrada.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {abaAtiva === 'fornecedores' && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Fornecedores</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fornecedores.map(fornecedor => (
              <div key={fornecedor.id} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800">{fornecedor.nome}</h3>
                {fornecedor.telefone && (
                  <p className="text-sm text-gray-600 mt-1">📞 {fornecedor.telefone}</p>
                )}
              </div>
            ))}
            {fornecedores.length === 0 && (
              <p className="text-gray-500 text-center py-4 col-span-3">Nenhum fornecedor cadastrado.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}