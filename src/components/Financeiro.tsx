'use client'

import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'

interface CentroCusto {
  id: string
  nome: string
  tipo: string
}

interface Lancamento {
  id: string
  descricao: string
  valor: number
  tipo: string
  data_lancamento: string
  centro_custo_nome: string
}

export default function Financeiro() {
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([])
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [loading, setLoading] = useState(false)
  
  // Estado do formulário
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [tipo, setTipo] = useState('entrada')
  const [centroCustoId, setCentroCustoId] = useState('')
  const [data, setData] = useState(new Date().toISOString().split('T')[0])

  // Carregar dados
  useEffect(() => {
    carregarDados()
  }, [])

  const carregarDados = async () => {
    const { data: centros } = await supabase
      .from('centros_de_custo')
      .select('*')
      .order('nome')

    const { data: lanc } = await supabase
      .from('lancamentos_financeiros')
      .select(`
        *,
        centros_de_custo (nome)
      `)
      .order('data_lancamento', { ascending: false })

    if (centros) setCentrosCusto(centros)
    if (lanc) setLancamentos(lanc as any)
  }

  const adicionarLancamento = async (e: React.FormEvent) => {
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
      .from('lancamentos_financeiros')
      .insert({
        descricao,
        valor: parseFloat(valor),
        tipo,
        centro_custo_id: centroCustoId || null,
        data_lancamento: data,
        caixa_id: caixas[0].id
      })

    if (error) {
      alert('Erro: ' + error.message)
    } else {
      // Limpar formulário e recarregar
      setDescricao('')
      setValor('')
      setTipo('entrada')
      setCentroCustoId('')
      carregarDados()
      alert('Lançamento adicionado com sucesso!')
    }

    setLoading(false)
  }

  // Calcular totais
  const totalEntradas = lancamentos
    .filter(l => l.tipo === 'entrada')
    .reduce((sum, l) => sum + l.valor, 0)

  const totalSaidas = lancamentos
    .filter(l => l.tipo === 'saida')
    .reduce((sum, l) => sum + l.valor, 0)

  const saldo = totalEntradas - totalSaidas

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <h3 className="text-sm font-medium text-green-800">Entradas</h3>
          <p className="text-2xl font-bold text-green-600">R$ {totalEntradas.toFixed(2)}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <h3 className="text-sm font-medium text-red-800">Saídas</h3>
          <p className="text-2xl font-bold text-red-600">R$ {totalSaidas.toFixed(2)}</p>
        </div>
        <div className={`p-4 rounded-lg border ${
          saldo >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'
        }`}>
          <h3 className="text-sm font-medium">Saldo</h3>
          <p className={`text-2xl font-bold ${
            saldo >= 0 ? 'text-blue-600' : 'text-orange-600'
          }`}>
            R$ {saldo.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulário */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Novo Lançamento</h2>
          <form onSubmit={adicionarLancamento} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Descrição</label>
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Valor</label>
              <input
                type="number"
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Tipo</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Centro de Custo</label>
              <select
                value={centroCustoId}
                onChange={(e) => setCentroCustoId(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Selecione...</option>
                {centrosCusto.map(centro => (
                  <option key={centro.id} value={centro.id}>
                    {centro.nome} ({centro.tipo})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Data</label>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Adicionando...' : 'Adicionar Lançamento'}
            </button>
          </form>
        </div>

        {/* Lista de Lançamentos */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Últimos Lançamentos</h2>
          <div className="space-y-3">
            {lancamentos.map(lancamento => (
              <div key={lancamento.id} className="border-b pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{lancamento.descricao}</p>
                    <p className="text-sm text-gray-500">
                      {lancamento.centro_custo_nome} • {new Date(lancamento.data_lancamento).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`font-bold ${
                    lancamento.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {lancamento.tipo === 'entrada' ? '+' : '-'} R$ {lancamento.valor.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
            {lancamentos.length === 0 && (
              <p className="text-gray-500 text-center py-4">Nenhum lançamento encontrado.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}