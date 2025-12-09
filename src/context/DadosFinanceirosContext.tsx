// context/DadosFinanceirosContext.tsx
'use client'

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getDataAtualBrasil } from '@/lib/dateUtils'

interface CentroCusto {
  id: string
  nome: string
  contexto: string
  tipo: string
  categoria: string
  recorrencia: string
}

interface Lancamento {
  id: string
  descricao: string
  valor: number
  tipo: string
  data_lancamento: string
  data_prevista: string
  centro_custo_id: string
  status: string
  parcelamento?: any
  recorrencia?: any
  caixa_id?: string
  origem?: string
  centros_de_custo?: {
    nome: string
  }
}

interface DadosCache {
  centrosCustoCasa: CentroCusto[]
  centrosCustoLoja: CentroCusto[]
  lancamentosCasa: Lancamento[]
  lancamentosLoja: Lancamento[]
  todosLancamentosCasa: Lancamento[]
  todosLancamentosLoja: Lancamento[]
  caixaRealCasa: number
  caixaRealLoja: number
  ultimaAtualizacao: number
}

interface DadosFinanceirosContextType {
  dados: DadosCache
  carregando: boolean
  recarregarDados: () => Promise<void>
  recarregarLancamentos: (contexto: 'casa' | 'loja', periodo?: { inicio: string; fim: string }) => Promise<void>
  atualizarCaixaReal: (contexto: 'casa' | 'loja') => Promise<void>
  limparCache: () => void
}

const DadosFinanceirosContext = createContext<DadosFinanceirosContextType | undefined>(undefined)

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutos

export function DadosFinanceirosProvider({ children }: { children: ReactNode }) {
  const [dados, setDados] = useState<DadosCache>({
    centrosCustoCasa: [],
    centrosCustoLoja: [],
    lancamentosCasa: [],
    lancamentosLoja: [],
    todosLancamentosCasa: [],
    todosLancamentosLoja: [],
    caixaRealCasa: 0,
    caixaRealLoja: 0,
    ultimaAtualizacao: 0
  })
  const [carregando, setCarregando] = useState(false)

  // Função otimizada para buscar centros de custo
  const buscarCentrosCusto = useCallback(async (contexto: 'casa' | 'loja') => {
    const { data, error } = await supabase
      .from('centros_de_custo')
      .select('*')
      .eq('contexto', contexto)
      .order('nome')

    if (error) {
      console.error(`❌ Erro ao carregar centros de custo ${contexto}:`, error)
      return []
    }

    return data || []
  }, [])

  // Função OTIMIZADA para buscar lançamentos com JOIN
  const buscarLancamentos = useCallback(async (
    contexto: 'casa' | 'loja',
    periodo?: { inicio: string; fim: string },
    limite?: number
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      // Buscar IDs dos centros de custo do contexto
      const { data: centros } = await supabase
        .from('centros_de_custo')
        .select('id')
        .eq('contexto', contexto)

      if (!centros || centros.length === 0) return []

      const centroIds = centros.map(c => c.id)

      // Query otimizada com JOIN
      let query = supabase
        .from('lancamentos_financeiros')
        .select(`
          *,
          centros_de_custo!inner(nome)
        `)
        .eq('user_id', user.id)
        .in('centro_custo_id', centroIds)

      if (periodo) {
        query = query
          .gte('data_prevista', periodo.inicio)
          .lte('data_prevista', periodo.fim)
      }

      query = query.order('data_prevista', { ascending: periodo ? true : false })

      if (limite) {
        query = query.limit(limite)
      }

      const { data, error } = await query

      if (error) {
        console.error(`❌ Erro ao carregar lançamentos ${contexto}:`, error)
        return []
      }

      return data || []
    } catch (error) {
      console.error(`❌ Erro ao buscar lançamentos ${contexto}:`, error)
      return []
    }
  }, [])

  // Função para calcular caixa real
  const calcularCaixaReal = useCallback(async (contexto: 'casa' | 'loja') => {
    try {
      const hoje = getDataAtualBrasil()
      
      const { data: centros } = await supabase
        .from('centros_de_custo')
        .select('id')
        .eq('contexto', contexto)

      if (!centros || centros.length === 0) return 0

      const centroIds = centros.map(c => c.id)

      const { data: lancamentosRealizados } = await supabase
        .from('lancamentos_financeiros')
        .select('valor, tipo')
        .eq('status', 'realizado')
        .lte('data_lancamento', hoje)
        .in('centro_custo_id', centroIds)

      let caixa = 0
      if (lancamentosRealizados) {
        lancamentosRealizados.forEach(lanc => {
          if (lanc.tipo === 'entrada') {
            caixa += lanc.valor
          } else {
            caixa -= lanc.valor
          }
        })
      }

      return caixa
    } catch (error) {
      console.error(`❌ Erro ao calcular caixa real ${contexto}:`, error)
      return 0
    }
  }, [])

  // Recarregar TODOS os dados
  const recarregarDados = useCallback(async () => {
    console.log('🔄 Recarregando todos os dados...')
    setCarregando(true)

    try {
      // Buscar tudo em paralelo
      const [
        centrosCasa,
        centrosLoja,
        caixaCasa,
        caixaLoja
      ] = await Promise.all([
        buscarCentrosCusto('casa'),
        buscarCentrosCusto('loja'),
        calcularCaixaReal('casa'),
        calcularCaixaReal('loja')
      ])

      setDados(prev => ({
        ...prev,
        centrosCustoCasa: centrosCasa,
        centrosCustoLoja: centrosLoja,
        caixaRealCasa: caixaCasa,
        caixaRealLoja: caixaLoja,
        ultimaAtualizacao: Date.now()
      }))

      console.log('✅ Dados recarregados com sucesso!')
    } catch (error) {
      console.error('❌ Erro ao recarregar dados:', error)
    } finally {
      setCarregando(false)
    }
  }, [buscarCentrosCusto, calcularCaixaReal])

  // Recarregar apenas lançamentos de um contexto específico
  const recarregarLancamentos = useCallback(async (
    contexto: 'casa' | 'loja',
    periodo?: { inicio: string; fim: string }
  ) => {
    console.log(`🔄 Recarregando lançamentos ${contexto}...`)

    try {
      const [lancamentos, todosLancamentos] = await Promise.all([
        periodo ? buscarLancamentos(contexto, periodo) : [],
        buscarLancamentos(contexto, undefined, 100)
      ])

      if (contexto === 'casa') {
        setDados(prev => ({
          ...prev,
          lancamentosCasa: lancamentos,
          todosLancamentosCasa: todosLancamentos,
          ultimaAtualizacao: Date.now()
        }))
      } else {
        setDados(prev => ({
          ...prev,
          lancamentosLoja: lancamentos,
          todosLancamentosLoja: todosLancamentos,
          ultimaAtualizacao: Date.now()
        }))
      }

      console.log(`✅ Lançamentos ${contexto} recarregados!`)
    } catch (error) {
      console.error(`❌ Erro ao recarregar lançamentos ${contexto}:`, error)
    }
  }, [buscarLancamentos])

  // Atualizar apenas caixa real
  const atualizarCaixaReal = useCallback(async (contexto: 'casa' | 'loja') => {
    const caixa = await calcularCaixaReal(contexto)
    
    if (contexto === 'casa') {
      setDados(prev => ({ ...prev, caixaRealCasa: caixa }))
    } else {
      setDados(prev => ({ ...prev, caixaRealLoja: caixa }))
    }
  }, [calcularCaixaReal])

  // Limpar cache
  const limparCache = useCallback(() => {
    setDados({
      centrosCustoCasa: [],
      centrosCustoLoja: [],
      lancamentosCasa: [],
      lancamentosLoja: [],
      todosLancamentosCasa: [],
      todosLancamentosLoja: [],
      caixaRealCasa: 0,
      caixaRealLoja: 0,
      ultimaAtualizacao: 0
    })
  }, [])

  // Carregar dados iniciais
  useEffect(() => {
    recarregarDados()
  }, [])

  return (
    <DadosFinanceirosContext.Provider
      value={{
        dados,
        carregando,
        recarregarDados,
        recarregarLancamentos,
        atualizarCaixaReal,
        limparCache
      }}
    >
      {children}
    </DadosFinanceirosContext.Provider>
  )
}

export function useDadosFinanceiros() {
  const context = useContext(DadosFinanceirosContext)
  if (context === undefined) {
    throw new Error('useDadosFinanceiros deve ser usado dentro de DadosFinanceirosProvider')
  }
  return context
}
