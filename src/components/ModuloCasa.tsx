'use client'

import { supabase } from '@/lib/supabase'
import ModalPagarAvancado from './ModalPagarAvancado' // Importação do componente corrigido
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useDadosFinanceiros } from '@/context/DadosFinanceirosContext'
// import ImportacaoExcel from './ImportacaoExcel' // Movido para ModuloConfiguracoes
import { getDataAtualBrasil, formatarDataParaExibicao } from '@/lib/dateUtils'

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
  caixa_id?: string // Adicionado para corrigir erro TS2339
  origem?: string // Adicionado para corrigir erro TS2339
  centros_de_custo?: {
    nome: string
  }
}

interface FormLancamento {
  descricao: string
  valor: string
  tipo: string
  centroCustoId: string
  data: string
  status: string
  parcelas: number
  prazoParcelas: string // NOVO: Prazo entre parcelas (mensal, quinzenal, semanal, diaria, 10dias, 20dias)
  recorrenciaTipo: string
  recorrenciaQtd: number // NOVO: Quantidade de vezes que o lançamento recorre
  recorrenciaPrazo: string // NOVO: Prazo entre recorrências (mesmas opções do parcelamento)
  recorrenciaDia: string
}

// Função auxiliar para calcular a data de ontem no formato YYYY-MM-DD
const getOntemBrasil = () => {
  const hoje = new Date(getDataAtualBrasil());
  hoje.setDate(hoje.getDate() - 1);
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

// Função auxiliar para calcular a data N dias à frente
const getDataNDias = (dataBase: string, dias: number) => {
  const data = new Date(dataBase);
  data.setDate(data.getDate() + dias);
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

// Função auxiliar para adicionar meses a uma data
const addMonths = (dateString: string, months: number): string => {
  const [ano, mes, dia] = dateString.split('-').map(Number);
  const date = new Date(ano, mes - 1 + months, dia);
  
  // Trata o caso de meses com menos dias (ex: 31 de janeiro + 1 mês = 3 de março)
  if (date.getDate() !== dia) {
    date.setDate(0); // Vai para o último dia do mês anterior
  }

  const novoAno = date.getFullYear();
  const novoMes = String(date.getMonth() + 1).padStart(2, '0');
  const novoDia = String(date.getDate()).padStart(2, '0');
  
  return `${novoAno}-${novoMes}-${novoDia}`;
}

// NOVO: Função para calcular data baseada no prazo
const calcularDataPorPrazo = (dataBase: string, prazo: string): string => {
  switch (prazo) {
    case 'diaria':
      return getDataNDias(dataBase, 2); // +1 dia para corrigir contagem
    case 'semanal':
      return getDataNDias(dataBase, 8); // +1 dia para corrigir contagem
    case '10dias':
      return getDataNDias(dataBase, 11); // +1 dia para corrigir contagem
    case 'quinzenal':
      return getDataNDias(dataBase, 16); // +1 dia para corrigir contagem
    case '20dias':
      return getDataNDias(dataBase, 21); // +1 dia para corrigir contagem
    case 'mensal':
      return addMonths(dataBase, 1);
    default:
      return dataBase;
  }
}

export default function ModuloCasa() {
  const { dados, recarregarLancamentos, atualizarCaixaReal } = useDadosFinanceiros()
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([])
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [todosLancamentos, setTodosLancamentos] = useState<Lancamento[]>([])
  const [loading, setLoading] = useState(false)
  
  const [modoVisualizacao, setModoVisualizacao] = useState<'8dias' | 'mes'>('8dias')
  const [abaLancamentos, setAbaLancamentos] = useState<'padrao' | 'recorrente'>('padrao') // NOVO: Controle de abas

  const [mesFiltro, setMesFiltro] = useState(() => {
    const hoje = new Date()
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  })
  const [mostrarTodos, setMostrarTodos] = useState(false)
  const [user, setUser] = useState<any>(null)
  
  const [modalPagar, setModalPagar] = useState<{ 
    aberto: boolean; 
    lancamento: Lancamento | null;
    passo: 'confirmar_total' | 'valor_parcial' | 'nova_parcela' | 'nova_parcela_data';
    valorPago: number | null;
    novaDataVencimento: string;
  }>({
    aberto: false,
    lancamento: null,
    passo: 'confirmar_total',
    valorPago: null,
    novaDataVencimento: getDataAtualBrasil()
  })

  const [modalExcluir, setModalExcluir] = useState<{ aberto: boolean; lancamento: Lancamento | null }>({
    aberto: false,
    lancamento: null
  })
  const [editandoLancamento, setEditandoLancamento] = useState<Lancamento | null>(null)
  const [caixaRealCasa, setCaixaRealCasa] = useState(0)
  
  const [form, setForm] = useState<FormLancamento>({
    descricao: '',
    valor: '',
    tipo: 'saida',
    centroCustoId: '',
    data: getDataAtualBrasil(),
    status: 'previsto',
    parcelas: 1,
    prazoParcelas: 'mensal', // NOVO: Padrão mensal
    recorrenciaTipo: 'nenhuma',
    recorrenciaQtd: 1, // NOVO: Padrão 1 vez
    recorrenciaPrazo: 'mensal', // NOVO: Padrão mensal
    recorrenciaDia: ''
  })

  const centrosCustoFiltrados = centrosCusto.filter(centro => {
    if (form.tipo === 'entrada') {
      return centro.tipo === 'RECEITA'
    } else {
      return centro.tipo === 'DESPESA'
    }
  })


  const calcularCaixaReal = useCallback(async () => {
    try {
      const hoje = getDataAtualBrasil()
      const { data: centros } = await supabase
        .from("centros_de_custo")
        .select("id")
        .eq("contexto", "casa")
      if (!centros || centros.length === 0) {
        setCaixaRealCasa(0)
        return
      }
      const centroIds = centros.map(c => c.id)
      const { data: lancamentosRealizados } = await supabase
        .from("lancamentos_financeiros")
        .select("*")
        .eq("status", "realizado")
        .lte("data_lancamento", hoje)
        .in("centro_custo_id", centroIds)
      let caixa = 0
      if (lancamentosRealizados) {
        lancamentosRealizados.forEach(lanc => {
          if (lanc.tipo === "entrada") {
            caixa += lanc.valor
          } else {
            caixa -= lanc.valor
          }
        })
      }
      setCaixaRealCasa(caixa)
    } catch (error) {
      console.error("Erro ao calcular caixa real:", error)
      setCaixaRealCasa(0)
    }
  }, [])
  const carregarDados = useCallback(async () => {
    console.log('🔍 Iniciando carregamento de dados...')
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      const { data: centros, error: errorCentros } = await supabase
        .from('centros_de_custo')
        .select('*')
        .eq('contexto', 'casa')
        .order('nome')

      if (errorCentros) {
        console.error('❌ Erro ao carregar centros:', errorCentros)
      } else {
        setCentrosCusto(centros || [])
      }

      let primeiroDia: string
      let ultimoDia: string
      let ordem: 'asc' | 'desc' = 'desc'

      if (modoVisualizacao === '8dias') {
        primeiroDia = getOntemBrasil()
        ultimoDia = getDataNDias(primeiroDia, 7)
        ordem = 'asc'
      } else {
        primeiroDia = `${mesFiltro}-01`
        const [anoStr, mesStr] = mesFiltro.split('-')
        const ano = parseInt(anoStr)
        const mes = parseInt(mesStr)
        const ultimoDiaDate = new Date(ano, mes, 0) 
        ultimoDia = `${ultimoDiaDate.getFullYear()}-${String(ultimoDiaDate.getMonth() + 1).padStart(2, '0')}-${String(ultimoDiaDate.getDate()).padStart(2, '0')}`
        ordem = 'asc' // CORRIGIDO: Alterado para crescente (asc) em vez de decrescente
      }

      // Consulta principal
      const { data: lanc, error: errorLanc } = await supabase
        .from('lancamentos_financeiros')
        .select('*')
        .eq('user_id', user?.id)
        .gte('data_prevista', primeiroDia)
        .lte('data_prevista', ultimoDia)
        .order('data_prevista', { ascending: ordem === 'asc' })

      if (errorLanc) {
        console.error('❌ Erro ao carregar lançamentos:', errorLanc)
      } else {
        const lancamentosComNomes = await Promise.all(
          (lanc || []).map(async (lancamento: any) => {
            if (lancamento.centro_custo_id) {
              const { data: centroCusto } = await supabase
                .from('centros_de_custo')
                .select('nome')
                .eq('id', lancamento.centro_custo_id)
                .single()
              
              return {
                ...lancamento,
                centros_de_custo: centroCusto ? { nome: centroCusto.nome } : undefined
              }
            }
            return lancamento
          })
        )
        setLancamentos(lancamentosComNomes)
      }

      // Consulta para "Todos os Lançamentos" (sem filtro de data)
      const { data: todosLanc, error: errorTodos } = await supabase
        .from('lancamentos_financeiros')
        .select('*')
        .eq('user_id', user?.id)
        .order('data_prevista', { ascending: false })
        .limit(100)

      if (errorTodos) {
        console.error('❌ Erro ao carregar todos os lançamentos:', errorTodos)
      } else {
        const todosLancamentosComNomes = await Promise.all(
          (todosLanc || []).map(async (lancamento: any) => {
            if (lancamento.centro_custo_id) {
              const { data: centroCusto } = await supabase
                .from('centros_de_custo')
                .select('nome')
                .eq('id', lancamento.centro_custo_id)
                .single()
              
              return {
                ...lancamento,
                centros_de_custo: centroCusto ? { nome: centroCusto.nome } : undefined
              }
            }
            return lancamento
          })
        )
        setTodosLancamentos(todosLancamentosComNomes)
      }
    } catch (error) {
      console.error('❌ Erro geral ao carregar dados:', error)
    }
  }, [mesFiltro, modoVisualizacao])

useEffect(() => {
  carregarDados()
}, [carregarDados])

// Sincronizar com cache global
useEffect(() => {
  setCentrosCusto(dados.centrosCustoCasa)
  setLancamentos(dados.lancamentosCasa)
  setTodosLancamentos(dados.todosLancamentosCasa)
  setCaixaRealCasa(dados.caixaRealCasa)
}, [dados.centrosCustoCasa, dados.lancamentosCasa, dados.todosLancamentosCasa, dados.caixaRealCasa])

  const adicionarLancamento = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) {
      alert('Erro: Usuário não identificado. Faça login novamente.')
      return
    }

    setLoading(true)

    const valorNumerico = parseFloat(form.valor)
    const descricaoMaiuscula = form.descricao.toUpperCase()
    const caixaId = '69bebc06-f495-4fed-b0b1-beafb50c017b'
    const lancamentosParaInserir = []

    try {
      // 1. Lógica de Parcelamento
      if (form.parcelas > 1) {
        const valorParcela = valorNumerico / form.parcelas
        const descricaoBase = descricaoMaiuscula
        let dataParcela = form.data

        for (let i = 1; i <= form.parcelas; i++) {
          const descricaoParcela = `${descricaoBase} (${i}/${form.parcelas})`
          
          lancamentosParaInserir.push({
            user_id: user.id,
            descricao: descricaoParcela,
            valor: valorParcela,
            tipo: form.tipo,
            centro_custo_id: form.centroCustoId || null,
            data_lancamento: dataParcela,
            data_prevista: dataParcela,
            status: 'previsto',
            caixa_id: caixaId,
            origem: 'financeiro',
            parcelamento: { atual: i, total: form.parcelas },
            recorrencia: null
          })

          // NOVO: Avança a data conforme o prazo selecionado
          dataParcela = calcularDataPorPrazo(dataParcela, form.prazoParcelas)
        }
      } 
      // 2. NOVO: Lógica de Lançamentos Recorrentes (valor total repetido)
      else if (abaLancamentos === 'recorrente' && form.recorrenciaQtd > 1) {
        const descricaoBase = descricaoMaiuscula
        let dataRecorrencia = form.data

        for (let i = 1; i <= form.recorrenciaQtd; i++) {
          const descricaoRecorrencia = descricaoBase
          
          lancamentosParaInserir.push({
            user_id: user.id,
            descricao: descricaoRecorrencia,
            valor: valorNumerico, // NOVO: Valor total, não dividido
            tipo: form.tipo,
            centro_custo_id: form.centroCustoId || null,
            data_lancamento: dataRecorrencia,
            data_prevista: dataRecorrencia,
            status: 'previsto',
            caixa_id: caixaId,
            origem: 'financeiro',
            parcelamento: null,
            recorrencia: {
              tipo: 'recorrente',
              prazo: form.recorrenciaPrazo,
              qtd: form.recorrenciaQtd,
              atual: i
            }
          })

          // NOVO: Avança a data conforme o prazo selecionado
          dataRecorrencia = calcularDataPorPrazo(dataRecorrencia, form.recorrenciaPrazo)
        }
      }
      // 3. Lógica de Recorrência Mensal/Anual (se não for parcelado e não for recorrente múltiplo)
      else if (form.recorrenciaTipo !== 'nenhuma') {
        const dadosLancamento = {
          user_id: user.id,
          descricao: descricaoMaiuscula,
          valor: valorNumerico,
          tipo: form.tipo,
          centro_custo_id: form.centroCustoId || null,
          data_lancamento: form.data,
          data_prevista: form.data,
          status: 'previsto',
          caixa_id: caixaId,
          origem: 'financeiro',
          parcelamento: null,
          recorrencia: {
            tipo: form.recorrenciaTipo,
            dia: form.recorrenciaDia || form.data.split('-')[2]
          }
        }
        lancamentosParaInserir.push(dadosLancamento)
      }
      // 4. Lançamento Simples
      else {
        const dadosLancamento = {
          user_id: user.id,
          descricao: descricaoMaiuscula,
          valor: valorNumerico,
          tipo: form.tipo,
          centro_custo_id: form.centroCustoId || null,
          data_lancamento: form.data,
          data_prevista: form.data,
          status: 'previsto',
          caixa_id: caixaId,
          origem: 'financeiro',
          parcelamento: null,
          recorrencia: null
        }
        lancamentosParaInserir.push(dadosLancamento)
      }

      if (lancamentosParaInserir.length === 0) {
        throw new Error('Nenhum lançamento para inserir.')
      }

      console.log(`📤 Enviando ${lancamentosParaInserir.length} lançamentos para Supabase:`, lancamentosParaInserir)

      const { error: errorLancamento } = await supabase
        .from('lancamentos_financeiros')
        .insert(lancamentosParaInserir)
        .select()

      if (errorLancamento) {
        throw errorLancamento
      }

      setForm({
        descricao: '',
        valor: '',
        tipo: 'saida',
        centroCustoId: '',
        data: form.data,
        status: 'previsto',
        parcelas: 1,
        prazoParcelas: 'mensal',
        recorrenciaTipo: 'nenhuma',
        recorrenciaQtd: 1,
        recorrenciaPrazo: 'mensal',
        recorrenciaDia: ''
      })
      
     // Recarregar dados do cache
await recarregarLancamentos('casa')
await atualizarCaixaReal('casa')

alert(`✅ ${lancamentosParaInserir.length} Lançamento(s) adicionado(s) com sucesso!`)

} catch (error: any) {
      console.error('❌ Erro ao adicionar lançamento:', error)
      alert('❌ Erro ao adicionar lançamento: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // NOVA FUNÇÃO: Lógica de Pagamento Avançado
  const processarPagamento = async () => {
    if (!modalPagar.lancamento || !user) return

    setLoading(true)
    const lancamento = modalPagar.lancamento
    const valorPago = modalPagar.valorPago !== null ? modalPagar.valorPago : lancamento.valor
    const valorRestante = lancamento.valor - valorPago
    const dataAtual = getDataAtualBrasil()

    try {
      // 1. Atualizar o lançamento original (pagamento parcial ou total)
      const descricaoBase = lancamento.descricao.replace(/\s\(\d+\/\d+\)$/, '') // Remove contador de parcela se existir
      const totalParcelas = lancamento.parcelamento?.total || 1
      const parcelaAtual = lancamento.parcelamento?.atual || 1
      
      let novaDescricaoOriginal = lancamento.descricao
      let novoParcelamento = lancamento.parcelamento

      if (valorRestante > 0 && modalPagar.passo === 'nova_parcela_data') {
        // Se for gerar nova parcela, incrementa o total e atualiza a descrição
        novoParcelamento = { atual: parcelaAtual, total: totalParcelas + 1 }
        novaDescricaoOriginal = `${descricaoBase} (${parcelaAtual}/${totalParcelas + 1})`
      }

      const { error: errorUpdate } = await supabase
        .from('lancamentos_financeiros')
        .update({ 
          status: 'realizado',
          valor: valorPago,
          data_lancamento: dataAtual,
          descricao: novaDescricaoOriginal,
          parcelamento: novoParcelamento
        })
        .eq('id', lancamento.id)

      if (errorUpdate) throw errorUpdate

      // 2. Gerar nova parcela se solicitado
      if (valorRestante > 0 && modalPagar.passo === 'nova_parcela_data') {
        const novaDescricaoParcela = `${descricaoBase} (${totalParcelas + 1}/${totalParcelas + 1})`
        
        const dadosNovaParcela = {
          user_id: user.id,
          descricao: novaDescricaoParcela,
          valor: valorRestante,
          tipo: lancamento.tipo,
          centro_custo_id: lancamento.centro_custo_id,
          data_lancamento: modalPagar.novaDataVencimento,
          data_prevista: modalPagar.novaDataVencimento,
          status: 'previsto',
          caixa_id: lancamento.caixa_id,
          origem: lancamento.origem,
          parcelamento: { atual: totalParcelas + 1, total: totalParcelas + 1 },
          recorrencia: lancamento.recorrencia
        }

        const { error: errorInsert } = await supabase
          .from('lancamentos_financeiros')
          .insert(dadosNovaParcela)
          .select()

        if (errorInsert) throw errorInsert
      }

      // 3. Resetar modal e recarregar dados
     setModalPagar({ 
  aberto: false, 
  lancamento: null, 
  passo: 'confirmar_total', 
  valorPago: null, 
  novaDataVencimento: getDataAtualBrasil() 
})

// Recarregar dados do cache
await recarregarLancamentos('casa')
await atualizarCaixaReal('casa')

alert('✅ Pagamento processado com sucesso!')

} catch (error: any) {
      console.error('❌ Erro ao processar pagamento:', error)
      alert('❌ Erro ao processar pagamento: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const excluirLancamento = async (lancamento: Lancamento) => {
    try {
      const { error } = await supabase
        .from('lancamentos_financeiros')
        .delete()
        .eq('id', lancamento.id)

      if (error) throw error

    setModalExcluir({ aberto: false, lancamento: null })

// Recarregar dados do cache
await recarregarLancamentos('casa')
await atualizarCaixaReal('casa')

alert('✅ Lançamento excluído com sucesso!')

} catch (error: any) {
      console.error('❌ Erro ao excluir lançamento:', error)
      alert('❌ Erro ao excluir lançamento: ' + error.message)
    }
  }

  const iniciarEdicao = (lancamento: Lancamento) => {
    setEditandoLancamento(lancamento)
    
    const dataDoBanco = lancamento.data_lancamento
    const dataPrevistaDoBanco = lancamento.data_prevista || dataDoBanco 
    
    const dataFormatada = dataPrevistaDoBanco.includes('T') 
      ? dataPrevistaDoBanco.split('T')[0]
      : dataPrevistaDoBanco
    
    setForm({
      descricao: lancamento.descricao,
      valor: lancamento.valor.toString(),
      tipo: lancamento.tipo,
      centroCustoId: lancamento.centro_custo_id || '',
      data: dataFormatada,
      status: lancamento.status === 'realizado' ? 'pago' : 'previsto',
      parcelas: lancamento.parcelamento?.total || 1,
      prazoParcelas: lancamento.parcelamento ? 'mensal' : 'mensal',
      recorrenciaTipo: lancamento.recorrencia?.tipo || 'nenhuma',
      recorrenciaQtd: lancamento.recorrencia?.qtd || 1,
      recorrenciaPrazo: lancamento.recorrencia?.prazo || 'mensal',
      recorrenciaDia: lancamento.recorrencia?.dia || ''
    })
  }

  const salvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!editandoLancamento || !user) return

    setLoading(true)

    const dataAtual = getDataAtualBrasil()
    const dataParaLancamento = form.status === 'pago' ? dataAtual : form.data

    const valorNumerico = parseFloat(form.valor)
    const descricaoMaiuscula = form.descricao.toUpperCase()

    try {
      const dadosLancamento = {
        descricao: descricaoMaiuscula,
        valor: valorNumerico,
        tipo: form.tipo,
        centro_custo_id: form.centroCustoId || null,
        data_lancamento: dataParaLancamento, 
        data_prevista: form.data,   
        status: form.status === 'pago' ? 'realizado' : 'previsto',
        parcelamento: editandoLancamento.parcelamento,
        recorrencia: form.recorrenciaTipo !== 'nenhuma' ? {
          tipo: form.recorrenciaTipo,
          dia: form.recorrenciaDia || form.data.split('-')[2]
        } : null
      }

      const { error } = await supabase
        .from('lancamentos_financeiros')
        .update(dadosLancamento)
        .eq('id', editandoLancamento.id)

      if (error) throw error

      setEditandoLancamento(null)
      setForm({
        descricao: '',
        valor: '',
        tipo: 'saida',
        centroCustoId: '',
        data: getDataAtualBrasil(),
        status: 'previsto',
        parcelas: 1,
        prazoParcelas: 'mensal',
        recorrenciaTipo: 'nenhuma',
        recorrenciaQtd: 1,
        recorrenciaPrazo: 'mensal',
        recorrenciaDia: ''
      })
      
    // Recarregar dados do cache
await recarregarLancamentos('casa')
await atualizarCaixaReal('casa')

alert('✅ Lançamento editado com sucesso!')

} catch (error: any) {
      console.error('❌ Erro ao salvar edição:', error)
      alert('❌ Erro ao salvar edição: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const cancelarEdicao = () => {
    setEditandoLancamento(null)
    setForm({
      descricao: '',
      valor: '',
      tipo: 'saida',
      centroCustoId: '',
      data: getDataAtualBrasil(),
      status: 'previsto',
      parcelas: 1,
      prazoParcelas: 'mensal',
      recorrenciaTipo: 'nenhuma',
      recorrenciaQtd: 1,
      recorrenciaPrazo: 'mensal',
      recorrenciaDia: ''
    })
  }

  const handleDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({...form, data: e.target.value})
  }

  const handleMesFiltroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMesFiltro(e.target.value)
    setModoVisualizacao('mes')
  }

  const handleVer8Dias = () => {
    setModoVisualizacao('8dias')
    setMostrarTodos(false)
  }

  const handleVerMes = () => {
    setModoVisualizacao('mes')
    setMostrarTodos(false)
  }

  const handleVerTodos = () => {
    setMostrarTodos(!mostrarTodos)
    setModoVisualizacao('mes')
  }

  const listaParaExibir = mostrarTodos ? todosLancamentos : lancamentos

  const BadgeStatus = ({ status }: { status: string }) => {
    let cor = ''
    let texto = ''
    switch (status) {
      case 'realizado':
        cor = 'bg-green-100 text-green-800'
        texto = 'Pago'
        break
      case 'previsto':
        cor = 'bg-yellow-100 text-yellow-800'
        texto = 'Previsto'
        break
      default:
        cor = 'bg-gray-100 text-gray-800'
        texto = status
    }
    return (
      <span className={`inline-flex items-center px-1 py-0.5 rounded-full text-xs font-medium ${cor}`}>
        {texto}
      </span>
    )
  }

  const ModalExcluir = () => {
    if (!modalExcluir.aberto || !modalExcluir.lancamento) return null

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
        <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm">
          <h3 className="text-lg font-semibold mb-4">Confirmar Exclusão</h3>
          <p className="text-sm text-gray-700 mb-4">
            Tem certeza que deseja excluir o lançamento "{modalExcluir.lancamento.descricao}"? Esta ação é irreversível.
          </p>
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setModalExcluir({ aberto: false, lancamento: null })}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              Cancelar
            </button>
            <button
              onClick={() => excluirLancamento(modalExcluir.lancamento!)}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
            >
              Sim, Excluir
            </button>
          </div>
        </div>
      </div>
    )
  }

  const tituloTabela = mostrarTodos 
    ? 'Todos os Lançamentos' 
    : modoVisualizacao === '8dias' 
      ? `Próximos 8 Dias (a partir de ${formatarDataParaExibicao(getOntemBrasil())})`
      : `Lançamentos de ${mesFiltro}`

  return (
    <div className="space-y-4">
      <ModalPagarAvancado 
        modalPagar={modalPagar} 
        setModalPagar={setModalPagar} 
        processarPagamento={processarPagamento} 
      />
      <ModalExcluir />


      {/* NOVO: Exibicao do Caixa Real */}
      <div className="bg-white p-4 rounded-lg shadow-md border-l-4 border-blue-500">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-800">Caixa Real (Casa)</h3>
          <div className={`text-2xl font-bold ${
            caixaRealCasa < 0 ? "text-red-600" : "text-green-600"
          }`}>
            {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL"
            }).format(caixaRealCasa)}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-md lg:col-span-1">
          <h2 className="text-lg font-semibold mb-3">
            {editandoLancamento ? 'Editar Lançamento' : 'Novo Lançamento'}
          </h2>
          
          {/* NOVO: Sistema de Abas */}
          <div className="flex space-x-2 mb-4 border-b border-gray-200">
            <button
              onClick={() => setAbaLancamentos('padrao')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                abaLancamentos === 'padrao'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              À Vista / Parcelado
            </button>
            <button
              onClick={() => setAbaLancamentos('recorrente')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                abaLancamentos === 'recorrente'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Recorrente
            </button>
          </div>

          <form onSubmit={editandoLancamento ? salvarEdicao : adicionarLancamento} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
              <input
                type="text"
                value={form.descricao}
                onChange={(e) => setForm({...form, descricao: e.target.value})}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                required
                placeholder="Descrição do lançamento"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor Total</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.valor}
                  onChange={(e) => setForm({...form, valor: e.target.value})}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select
                  value={form.tipo}
                  onChange={(e) => setForm({...form, tipo: e.target.value})}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="saida">Saída</option>
                  <option value="entrada">Entrada</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({...form, status: e.target.value})}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="pago">Pago</option>
                  <option value="previsto">Previsto</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Centro de Custo</label>
                <select
                  value={form.centroCustoId}
                  onChange={(e) => setForm({...form, centroCustoId: e.target.value})}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="">Selecione...</option>
                  {centrosCustoFiltrados.map(centro => (
                    <option key={centro.id} value={centro.id}>{centro.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data (Vencimento)</label>
              <input
                type="date"
                value={form.data}
                onChange={handleDataChange} 
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Data selecionada: {formatarDataParaExibicao(form.data)}</p>
            </div>

            {/* NOVO: Campos condicionais baseados na aba selecionada */}
            {abaLancamentos === 'padrao' ? (
              <>
                {/* Aba Padrão: Parcelamento */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Parcelas</label>
                    <input
                      type="number"
                      min="1"
                      value={form.parcelas}
                      onChange={(e) => setForm({...form, parcelas: parseInt(e.target.value) || 1})}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                  {form.parcelas > 1 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Prazo entre Parcelas</label>
                      <select
                        value={form.prazoParcelas}
                        onChange={(e) => setForm({...form, prazoParcelas: e.target.value})}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                      >
                        <option value="diaria">Diária</option>
                        <option value="semanal">Semanal</option>
                        <option value="10dias">10 Dias</option>
                        <option value="quinzenal">Quinzenal</option>
                        <option value="20dias">20 Dias</option>
                        <option value="mensal">Mensal</option>
                      </select>
                    </div>
                  )}
                </div>


              </>
            ) : (
              <>
                {/* Aba Recorrente: Lançamentos repetidos */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade de Vezes</label>
                    <input
                      type="number"
                      min="1"
                      value={form.recorrenciaQtd}
                      onChange={(e) => setForm({...form, recorrenciaQtd: parseInt(e.target.value) || 1})}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prazo entre Lançamentos</label>
                    <select
                      value={form.recorrenciaPrazo}
                      onChange={(e) => setForm({...form, recorrenciaPrazo: e.target.value})}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                    >
                      <option value="diaria">Diária</option>
                      <option value="semanal">Semanal</option>
                      <option value="10dias">10 Dias</option>
                      <option value="quinzenal">Quinzenal</option>
                      <option value="20dias">20 Dias</option>
                      <option value="mensal">Mensal</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            <div className="flex space-x-2 pt-2">
              {editandoLancamento && (
                <button
                  type="button"
                  onClick={cancelarEdicao}
                  className="flex-1 bg-gray-500 text-white py-2 px-3 rounded-md hover:bg-gray-600 text-sm"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className={`${editandoLancamento ? 'flex-1' : 'w-full'} bg-blue-500 text-white py-2 px-3 rounded-md hover:bg-blue-600 disabled:opacity-50 text-sm`}
              >
                {loading ? 'Salvando...' : editandoLancamento ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-md lg:col-span-2">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold">
              {tituloTabela}
            </h2>
            <div className="flex space-x-2">
              {/* <ImportacaoExcel onImportacaoConcluida={carregarDados} /> - Movido para ModuloConfiguracoes */}
              
              <button
                onClick={handleVer8Dias}
                className={`px-3 py-1 rounded text-sm ${modoVisualizacao === '8dias' && !mostrarTodos ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
              >
                8 Dias
              </button>
              <button
                onClick={handleVerMes}
                className={`px-3 py-1 rounded text-sm ${modoVisualizacao === 'mes' && !mostrarTodos ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
              >
                Ver Mês
              </button>
              <button
                onClick={handleVerTodos}
                className={`px-3 py-1 rounded text-sm ${mostrarTodos ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
              >
                Ver Todos
              </button>

              {modoVisualizacao === 'mes' && !mostrarTodos && (
                <input
                  type="month"
                  value={mesFiltro}
                  onChange={handleMesFiltroChange}
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                />
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-1/12 px-1 py-2 text-left font-medium text-gray-700 border-b text-xs">Venc.</th>
                  <th className="w-2/12 px-1 py-2 text-right font-medium text-gray-700 border-b text-xs">Valor</th>
                  <th className="w-4/12 px-1 py-2 text-left font-medium text-gray-700 border-b text-xs">Descrição</th>
                  <th className="w-2/12 px-1 py-2 text-left font-medium text-gray-700 border-b text-xs">Status</th>
                  <th className="w-2/12 px-1 py-2 text-left font-medium text-gray-700 border-b text-xs">CDC</th>
                  <th className="w-1/12 px-1 py-2 text-left font-medium text-gray-700 border-b text-xs">Ações</th>
                </tr>
              </thead>
              <tbody>
                {listaParaExibir.length > 0 ? (
                  listaParaExibir.map((lancamento) => (
                    <tr key={lancamento.id} className={`border-b ${
                      lancamento.status === 'realizado' 
                        ? 'bg-green-100 hover:bg-green-200 font-semibold' // Destaque maior
                        : 'hover:bg-gray-50'
                    }`}>
                      <td className="px-1 py-2 text-gray-700 whitespace-nowrap text-xs">
                        {formatarDataParaExibicao(lancamento.data_prevista || lancamento.data_lancamento)}
                      </td>
                      <td className={`px-1 py-2 text-right font-medium whitespace-nowrap text-xs ${
                        lancamento.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {lancamento.tipo === 'entrada' ? '+' : '-'} R$ {lancamento.valor.toFixed(2)}
                      </td>
                      <td className="px-1 py-2 text-gray-900 truncate text-xs">
                        {lancamento.descricao}
                      </td>
                      <td className="px-1 py-2">
                        <BadgeStatus status={lancamento.status} />
                      </td>
                      <td className="px-1 py-2 text-gray-600 truncate text-xs">
                        {lancamento.centros_de_custo?.nome || '-'}
                      </td>
                      <td className="px-1 py-2">
                        <div className="flex space-x-1 justify-start">
                          {lancamento.status === 'previsto' && (
                            <button
                              onClick={() => setModalPagar({ 
                                aberto: true, 
                                lancamento, 
                                passo: 'confirmar_total', 
                                valorPago: null,
                                novaDataVencimento: lancamento.data_prevista || getDataAtualBrasil()
                              })}
                              className="px-1 py-0.5 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                              title="Marcar como pago"
                            >
                              Pagar
                            </button>
                          )}
                          <button
                            onClick={() => iniciarEdicao(lancamento)}
                            className="px-1 py-0.5 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                            title="Editar lançamento"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setModalExcluir({ aberto: true, lancamento })}
                            className="px-1 py-0.5 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                            title="Excluir lançamento"
                          >
                            Del
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-2 py-4 text-center text-gray-500 text-xs">
                      📭 Nenhum lançamento encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
