'use client'

import { supabase } from '@/lib/supabase'
import { useState, useEffect, useCallback } from 'react'

interface CentroCusto {
  id: string
  nome: string
  contexto: string
  tipo: string
  categoria: string
  recorrencia: string
}

interface LimparTransacoesProps {
  onDataChange: () => void; // Para notificar o pai sobre mudanças
}

export default function LimparTransacoes({ onDataChange }: LimparTransacoesProps) {
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([])
  const [loading, setLoading] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [statusAtual, setStatusAtual] = useState('')
  const [user, setUser] = useState<any>(null)
  
  // Filtros
  const [filtroContexto, setFiltroContexto] = useState<'todos' | 'casa' | 'loja'>('todos')
  const [filtroCentroCusto, setFiltroCentroCusto] = useState<string>('todos')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'previsto' | 'realizado'>('todos')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'entrada' | 'saida'>('todos')
  
  // Lançamentos a serem excluídos
  const [lancamentos, setLancamentos] = useState<any[]>([])
  const [selecionados, setSelecionados] = useState<string[]>([])

  const carregarCentrosCusto = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    
    const { data: centros, error } = await supabase
      .from('centros_de_custo')
      .select('*')
      .order('nome')

    if (error) {
      console.error('Erro ao carregar centros:', error)
    } else if (centros) {
      setCentrosCusto(centros)
    }
  }, [])

  useEffect(() => {
    carregarCentrosCusto()
  }, [carregarCentrosCusto])

    const buscarLancamentos = useCallback(async () => {
    if (!user) return
    
    setLoading(true)
    setStatusAtual('Buscando lançamentos...')
    setLancamentos([])
    setSelecionados([])

    try {
      // 1. Criar mapa de Centros de Custo (para contornar o erro de relacionamento)
      const centrosMap = new Map(centrosCusto.map(c => [c.id, c.nome]))

      let query = supabase
        .from('lancamentos_financeiros')
        // Buscar apenas o centro_custo_id, sem tentar o join implícito
        .select('id, descricao, valor, tipo, status, data_prevista, centro_custo_id') 
        .eq('user_id', user.id)
        .order('data_prevista', { ascending: true })

      // Aplicar filtros
      if (filtroStatus !== 'todos') {
        query = query.eq('status', filtroStatus)
      }
      if (filtroTipo !== 'todos') {
        query = query.eq('tipo', filtroTipo)
      }
      
      // Filtro de contexto (casa/loja)
      if (filtroContexto !== 'todos') {
        const centrosFiltrados = centrosCusto.filter(c => c.contexto === filtroContexto).map(c => c.id)
        
        if (centrosFiltrados.length === 0) {
          setLancamentos([])
          setStatusAtual('Nenhum centro de custo encontrado para o contexto selecionado.')
          setLoading(false)
          return
        }
        
        query = query.in('centro_custo_id', centrosFiltrados)
      }

      // Filtro de centro de custo específico
      if (filtroCentroCusto !== 'todos') {
        query = query.eq('centro_custo_id', filtroCentroCusto)
      }

      const { data, error } = await query

      if (error) throw error

      // 2. Mapear os resultados para adicionar o nome do Centro de Custo
      const lancamentosMapeados = (data || []).map(lancamento => ({
        ...lancamento,
        centros_de_custo: {
          nome: centrosMap.get(lancamento.centro_custo_id) || '-'
        }
      }))

      setLancamentos(lancamentosMapeados)
      setStatusAtual(`Encontrados ${lancamentosMapeados.length} lançamentos.`)
      
    } catch (error: any) {
      console.error('Erro ao buscar lançamentos:', error.message || error)
      setStatusAtual('Erro ao buscar lançamentos.')
    } finally {
      setLoading(false)
    }
  }, [user, filtroContexto, filtroCentroCusto, filtroStatus, filtroTipo, centrosCusto])

  useEffect(() => {
    buscarLancamentos()
  }, [buscarLancamentos])

  const toggleSelecao = (id: string) => {
    setSelecionados(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const toggleSelecaoTodos = () => {
    if (selecionados.length === lancamentos.length) {
      setSelecionados([])
    } else {
      setSelecionados(lancamentos.map(l => l.id))
    }
  }

  const executarExclusao = async () => {
    if (selecionados.length === 0) {
      alert('Selecione pelo menos um lançamento para excluir.')
      return
    }

    if (!confirm(`Tem certeza que deseja excluir ${selecionados.length} lançamento(s)? Esta ação é irreversível.`)) {
      return
    }

    setLoading(true)
    setProgresso(0)
    setStatusAtual('Iniciando exclusão em lote...')

    try {
      const total = selecionados.length
      let excluidos = 0

      // Excluir em lotes para evitar timeout (ou um loop simples para garantir a barra de progresso)
      for (let i = 0; i < total; i++) {
        const id = selecionados[i]
        
        const { error } = await supabase
          .from('lancamentos_financeiros')
          .delete()
          .eq('id', id)

        if (error) {
          console.error(`Erro ao excluir lançamento ${id}:`, error)
        } else {
          excluidos++
        }

        // Atualizar barra de progresso
        const progressoAtual = Math.round((excluidos / total) * 100)
        setProgresso(progressoAtual)
        setStatusAtual(`Excluindo... ${excluidos} de ${total} concluídos.`)
      }

      alert(`✅ Exclusão concluída! ${excluidos} lançamento(s) excluído(s).`)
      onDataChange() // Notificar o pai (ModuloCasa)
      buscarLancamentos() // Recarregar a lista
      
    } catch (error) {
      alert('❌ Erro fatal durante a exclusão.')
      console.error('Erro fatal:', error)
    } finally {
      setLoading(false)
      setProgresso(0)
      setStatusAtual('')
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4">Limpar Transações em Lote</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Filtro Contexto */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Contexto</label>
            <select
              value={filtroContexto}
              onChange={(e) => setFiltroContexto(e.target.value as 'todos' | 'casa' | 'loja')}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
            >
              <option value="todos">Todos</option>
              <option value="casa">Casa</option>
              <option value="loja">Loja</option>
            </select>
          </div>
          
          {/* Filtro Centro de Custo */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Centro de Custo</label>
            <select
              value={filtroCentroCusto}
              onChange={(e) => setFiltroCentroCusto(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
            >
              <option value="todos">Todos</option>
              {centrosCusto
                .filter(c => filtroContexto === 'todos' || c.contexto === filtroContexto)
                .map(c => (
                  <option key={c.id} value={c.id}>{c.nome} ({c.contexto})</option>
                ))}
            </select>
          </div>

          {/* Filtro Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as 'todos' | 'previsto' | 'realizado')}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
            >
              <option value="todos">Todos</option>
              <option value="previsto">Previsto</option>
              <option value="realizado">Pago</option>
            </select>
          </div>

          {/* Filtro Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Tipo</label>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value as 'todos' | 'entrada' | 'saida')}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
            >
              <option value="todos">Todos</option>
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </select>
          </div>
        </div>

        <button
          onClick={buscarLancamentos}
          disabled={loading}
          className="w-full bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 disabled:opacity-50 mb-4"
        >
          {loading ? 'Buscando...' : `Buscar Lançamentos (${lancamentos.length})`}
        </button>

        {/* Barra de Progresso */}
        {loading && progresso > 0 && (
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm text-gray-600">
              <span>{statusAtual}</span>
              <span>{progresso}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-red-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progresso}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Tabela de Seleção */}
        <div className="overflow-x-auto max-h-96">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selecionados.length === lancamentos.length && lancamentos.length > 0}
                    onChange={toggleSelecaoTodos}
                    className="rounded text-red-600"
                    disabled={lancamentos.length === 0}
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CDC</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {lancamentos.map((lancamento) => (
                <tr key={lancamento.id} className={selecionados.includes(lancamento.id) ? 'bg-red-50' : 'hover:bg-gray-50'}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selecionados.includes(lancamento.id)}
                      onChange={() => toggleSelecao(lancamento.id)}
                      className="rounded text-red-600"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lancamento.data_prevista}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{lancamento.descricao}</td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${
                    lancamento.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lancamento.valor)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lancamento.centros_de_custo?.nome || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lancamento.status}</td>
                </tr>
              ))}
              {lancamentos.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">Nenhum lançamento encontrado com os filtros atuais.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <button
          onClick={executarExclusao}
          disabled={loading || selecionados.length === 0}
          className="mt-6 w-full bg-red-600 text-white py-3 px-4 rounded-md hover:bg-red-700 disabled:opacity-50 text-lg font-semibold"
        >
          {loading ? statusAtual : `Excluir ${selecionados.length} Lançamento(s) Selecionado(s)`}
        </button>
      </div>
    </div>
  )
}
