// components/ImportacaoExcel.tsx
'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { prepararDataParaInsert } from '@/lib/dateUtils'
import readXlsxFile from 'read-excel-file'

interface ImportacaoExcelProps {
  onImportacaoConcluida: () => void
}

// Cache para centros de custo (evita múltiplas consultas)
const centrosCache = new Map()

// Valores permitidos para origem (baseado na constraint do banco)
const ORIGENS_PERMITIDAS = ['financeiro', 'caixa', 'cartao', 'transferencia']

export default function ImportacaoExcel({ onImportacaoConcluida }: ImportacaoExcelProps) {
  const [loading, setLoading] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [statusAtual, setStatusAtual] = useState('')
  const [user, setUser] = useState<any>(null)

  // Função para converter data do Excel
  const converterDataExcel = (excelDate: any): string => {
    // Se já for string no formato YYYY-MM-DD
    if (typeof excelDate === 'string') {
      const dataRegex = /^\d{4}-\d{2}-\d{2}$/
      if (dataRegex.test(excelDate)) {
        return excelDate
      }
      
      // Tentar converter com Date (para formatos como DD/MM/YYYY ou MM/DD/YYYY)
      const dateObj = new Date(excelDate)
      if (!isNaN(dateObj.getTime())) {
        const ano = dateObj.getFullYear()
        const mes = String(dateObj.getMonth() + 1).padStart(2, '0')
        const dia = String(dateObj.getDate()).padStart(2, '0')
        return `${ano}-${mes}-${dia}`
      }
    }
    
    // Se for número (serial do Excel)
    if (typeof excelDate === 'number') {
      // Excel usa 1 = 01/01/1900
      const baseDate = new Date(1900, 0, 1)
      // Ajuste para o bug do Excel (29/02/1900 não existe)
      const excelBugAdjustment = excelDate > 60 ? 1 : 0
      
      const date = new Date(baseDate.getTime() + (excelDate - excelBugAdjustment) * 24 * 60 * 60 * 1000)
      
      const ano = date.getFullYear()
      const mes = String(date.getMonth() + 1).padStart(2, '0')
      const dia = String(date.getDate()).padStart(2, '0')
      return `${ano}-${mes}-${dia}`
    }
    
    // Se for objeto Date
    if (excelDate instanceof Date) {
      const ano = excelDate.getFullYear()
      const mes = String(excelDate.getMonth() + 1).padStart(2, '0')
      const dia = String(excelDate.getDate()).padStart(2, '0')
      return `${ano}-${mes}-${dia}`
    }
    
    throw new Error(`Formato de data não suportado: ${excelDate}`)
  }

  // Buscar ID do centro de custo COM CACHE
  const buscarCentroCustoId = async (nomeCentroCusto: string) => {
    const nomeNormalizado = nomeCentroCusto.toUpperCase().trim()
    
    // Verificar cache primeiro
    if (centrosCache.has(nomeNormalizado)) {
      return centrosCache.get(nomeNormalizado)
    }

    try {
      const { data, error } = await supabase
        .from('centros_de_custo')
        .select('id')
        .ilike('nome', nomeNormalizado)
        .eq('contexto', 'casa')
        .single()

      if (error || !data) {
        // Se não encontrou, criar um centro de custo padrão
        const centroPadrao = await criarCentroCustoPadrao(nomeNormalizado)
        if (centroPadrao) {
          centrosCache.set(nomeNormalizado, centroPadrao.id)
          return centroPadrao.id
        }
        return null
      }
      
      // Adicionar ao cache
      centrosCache.set(nomeNormalizado, data.id)
      return data.id

    } catch (error) {
      console.warn(`Erro ao buscar centro de custo ${nomeNormalizado}:`, error)
      return null
    }
  }

  // Criar centro de custo automaticamente se não existir
  const criarCentroCustoPadrao = async (nome: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      // Determinar tipo baseado no nome
      const tipo = nome.includes('SALARIO') || nome.includes('SALÁRIO') ? 'RECEITA' : 'DESPESA'
      
      const { data, error } = await supabase
        .from('centros_de_custo')
        .insert({
          nome: nome,
          contexto: 'casa',
          tipo: tipo,
          categoria: 'OUTROS',
          recorrencia: 'VARIAVEL',
          user_id: user.id
        })
        .select()
        .single()

      if (error) {
        console.warn('Erro ao criar centro de custo:', error)
        return null
      }

      console.log(`✅ Centro de custo criado: ${nome}`)
      return data

    } catch (error) {
      console.warn('Erro ao criar centro de custo:', error)
      return null
    }
  }

  // Mapeamento inteligente de centros de custo
  const mapearCentroCusto = (centroCusto: string): string => {
    const centroUpper = centroCusto.toUpperCase().trim()
    
    const mapeamentos: { [key: string]: string } = {
      'GASTOS TRANSPORTES': 'TRANSPORTE',
      'UNHA MARA': 'LAZER',
      'TRANSPORTE': 'TRANSPORTE',
      'COMBUSTIVEL': 'TRANSPORTE',
      'GASOLINA': 'TRANSPORTE',
      'UBER': 'TRANSPORTE',
      'TAXI': 'TRANSPORTE',
      'ALIMENTACAO': 'ALIMENTACAO',
      'SUPERMERCADO': 'ALIMENTACAO',
      'RESTAURANTE': 'ALIMENTACAO',
      'LANCHE': 'ALIMENTACAO',
      'MORADIA': 'MORADIA',
      'ALUGUEL': 'MORADIA',
      'CONDOMINIO': 'MORADIA',
      'ENERGIA': 'UTILIDADES',
      'AGUA': 'UTILIDADES',
      'INTERNET': 'UTILIDADES',
      'TELEFONE': 'UTILIDADES',
      'SAUDE': 'SAUDE',
      'MEDICO': 'SAUDE',
      'FARMACIA': 'SAUDE',
      'PLANO DE SAUDE': 'SAUDE',
      'LAZER': 'LAZER',
      'CINEMA': 'LAZER',
      'ACADEMIA': 'LAZER',
      'SALARIO': 'SALARIO',
      'SALÁRIO': 'SALARIO'
    }

    // Buscar mapeamento exato ou parcial
    for (const [key, value] of Object.entries(mapeamentos)) {
      if (centroUpper.includes(key) || key.includes(centroUpper)) {
        return value
      }
    }

    return centroUpper // Retorna o original se não encontrar mapeamento
  }

  // Função para processar arquivo Excel
  const processarExcel = async (file: File) => {
    setStatusAtual('📊 Lendo arquivo Excel...')
    
    try {
      // Ler arquivo Excel
      const rows = await readXlsxFile(file)
      
      if (!rows || rows.length < 2) {
        throw new Error('Planilha vazia ou com apenas cabeçalho')
      }

      setStatusAtual('🔍 Analisando estrutura...')

      // Detectar mapeamento de colunas automaticamente
      const cabecalhos = rows[0].map(h => 
        h?.toString().trim().toUpperCase().replace(/^"|"$/g, '') || ''
      )

      // Mapear colunas de forma flexível
      const mapeamento: any = {}
      const colunasEsperadas = [
        { key: 'DATA', aliases: ['DATA', 'DATE', 'DT', 'DIA'] },
        { key: 'DESCRICAO', aliases: ['DESCRICAO', 'DESCRIÇÃO', 'DESC', 'NOME', 'OBS'] },
        { key: 'VALOR', aliases: ['VALOR', 'VALUE', 'VL', 'PREÇO', 'PRECO'] },
        { key: 'TIPO', aliases: ['TIPO', 'TYPE', 'CATEGORIA', 'CAT'] },
        { key: 'STATUS', aliases: ['STATUS', 'SITUACAO', 'SITUAÇÃO'] },
        { key: 'CENTRO_CUSTO', aliases: ['CENTRO_CUSTO', 'CENTRO DE CUSTO', 'CENTRO', 'CATEGORIA', 'CAT'] }
      ]
      
      colunasEsperadas.forEach(({ key, aliases }) => {
        const cabecalhoEncontrado = cabecalhos.find(h => {
          const headerStr = h.toString().toUpperCase()
          return aliases.some(alias => headerStr.includes(alias) || alias.includes(headerStr))
        })
        if (cabecalhoEncontrado) {
          mapeamento[key] = cabecalhos.indexOf(cabecalhoEncontrado)
        }
      })

      // Verificar colunas faltantes
      const colunasFaltantes = colunasEsperadas
        .filter(({ key }) => mapeamento[key] === undefined)
        .map(({ key }) => key)

      if (colunasFaltantes.length > 0) {
        throw new Error(`Colunas não encontradas: ${colunasFaltantes.join(', ')}`)
      }

      const lancamentos = []
      const totalLinhas = rows.length - 1 // Excluindo cabeçalho
      
      setStatusAtual('🔄 Processando lançamentos...')

      // Processar linhas de dados
      for (let i = 1; i < rows.length; i++) {
        const linha = rows[i]
        if (!linha || linha.length === 0) continue

        // Atualizar progresso
        const progressoAtual = Math.round(((i - 1) / totalLinhas) * 50) // 50% para processamento
        setProgresso(progressoAtual)

        // Extrair dados
        const rawData = linha[mapeamento.DATA]
        const rawDescricao = linha[mapeamento.DESCRICAO]
        const rawValor = linha[mapeamento.VALOR]
        const rawTipo = linha[mapeamento.TIPO]
        const rawStatus = linha[mapeamento.STATUS]
        const rawCentroCusto = linha[mapeamento.CENTRO_CUSTO]

        const descricao = rawDescricao?.toString()?.trim() || ''
        const tipo = rawTipo?.toString()?.trim() || ''
        const status = rawStatus?.toString()?.trim() || ''
        let centroCusto = rawCentroCusto?.toString()?.trim() || ''

        // Pular linhas vazias
        if (!rawData && !descricao && rawValor === null) continue

        // Validar campos obrigatórios
        if (!rawData || !descricao || rawValor === null || rawValor === undefined) {
          throw new Error(`Linha ${i + 1}: Campos DATA, DESCRICAO e VALOR são obrigatórios`)
        }

        // Converter data
        let dataFormatada: string
        try {
          dataFormatada = converterDataExcel(rawData)
        } catch (error) {
          throw new Error(`Linha ${i + 1}: Data inválida: ${rawData}`)
        }

        // Validar formato da data
        const dataRegex = /^\d{4}-\d{2}-\d{2}$/
        if (!dataRegex.test(dataFormatada)) {
          throw new Error(`Linha ${i + 1}: Data inválida: ${dataFormatada}`)
        }

        // Converter valor
        let valorNumerico: number
        if (typeof rawValor === 'number') {
          valorNumerico = rawValor
        } else {
          const valorStr = rawValor.toString()
          const valorLimpo = valorStr
            .replace(/[^\d,.-]/g, '')
            .replace(/\./g, '')
            .replace(',', '.')
          
          valorNumerico = parseFloat(valorLimpo)
        }

        if (isNaN(valorNumerico) || valorNumerico <= 0) {
          throw new Error(`Linha ${i + 1}: Valor inválido: ${rawValor}`)
        }

        // Normalizar Tipo
        const tipoNormalizado = tipo.toUpperCase().includes('ENTRADA') ? 'entrada' : 'saida'

        // Normalizar Status
        const statusNormalizado = status.toUpperCase().includes('PAGO') || status.toUpperCase().includes('REALIZADO') ? 'realizado' : 'previsto'

        // Mapear Centro de Custo
        centroCusto = mapearCentroCusto(centroCusto || descricao)
        const centroCustoId = await buscarCentroCustoId(centroCusto)

        if (!centroCustoId) {
          throw new Error(`Linha ${i + 1}: Não foi possível determinar ou criar Centro de Custo para "${centroCusto}"`)
        }

        lancamentos.push({
          descricao: descricao.toUpperCase(),
          valor: valorNumerico,
          tipo: tipoNormalizado,
          centro_custo_id: centroCustoId,
          data_lancamento: statusNormalizado === 'realizado' ? dataFormatada : null,
          data_prevista: dataFormatada,
          status: statusNormalizado,
          caixa_id: '69bebc06-f495-4fed-b0b1-beafb50c017b', // ID Fixo
          origem: 'importacao_excel',
          parcelamento: null,
          recorrencia: null
        })
      }

      setStatusAtual(`✅ ${lancamentos.length} lançamentos processados. Inserindo no banco...`)
      setProgresso(50)

      // Inserir no Supabase
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado.')

      const lancamentosComUser = lancamentos.map(l => ({ ...l, user_id: user.id }))

      const { error: errorInsert } = await supabase
        .from('lancamentos_financeiros')
        .insert(lancamentosComUser)

      if (errorInsert) throw errorInsert

      setStatusAtual('🎉 Importação concluída com sucesso!')
      setProgresso(100)
      alert(`✅ Importação concluída! ${lancamentos.length} lançamentos inseridos.`)
      setModalAberto(false)
      onImportacaoConcluida()

    } catch (error: any) {
      console.error('Erro na importação:', error)
      alert('❌ Erro na importação: ' + error.message)
      setProgresso(0)
      setStatusAtual('Erro.')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setLoading(true)
      processarExcel(file)
    }
  }

  const baixarModelo = () => {
    // Cria um arquivo CSV de modelo com os cabeçalhos corretos
    const csvContent = "DATA,DESCRICAO,VALOR,TIPO,STATUS,CENTRO_CUSTO\n2023-10-01,Salário Mensal,3000.00,ENTRADA,PAGO,SALARIO\n2023-10-05,Conta de Luz,150.50,SAIDA,PREVISTO,ENERGIA"
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', 'modelo_importacao_financeira.csv')
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      {/* Botão para abrir modal (se estiver no ModuloCasa) */}
      {/* Se estiver no ModuloConfiguracoes, o componente é renderizado diretamente */}
      {window.location.pathname.includes('configuracoes') ? (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4">Importação de Lançamentos (Excel)</h2>
          <div className="space-y-4">
            {/* Barra de Progresso */}
            {loading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>{statusAtual}</span>
                  <span>{progresso}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progresso}%` }}
                  ></div>
                </div>
              </div>
            )}

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">📋 Formato da Planilha:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• <strong>DATA:</strong> Qualquer formato de data (DD/MM/YYYY, YYYY-MM-DD, ou serial do Excel)</li>
                <li>• <strong>DESCRICAO:</strong> Texto livre</li>
                <li>• <strong>VALOR:</strong> Número (1500.00 ou 1.500,00)</li>
                <li>• <strong>TIPO:</strong> ENTRADA ou SAIDA</li>
                <li>• <strong>STATUS:</strong> PAGO ou PREVISTO</li>
                <li>• <strong>CENTRO_CUSTO:</strong> Nome do centro de custo</li>
              </ul>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={baixarModelo}
                className="flex-1 bg-gray-500 text-white py-2 px-3 rounded hover:bg-gray-600 text-sm"
                disabled={loading}
              >
                📥 Baixar Modelo
              </button>
              
              <label className="flex-1 bg-blue-500 text-white py-2 px-3 rounded hover:bg-blue-600 text-sm text-center cursor-pointer">
                {loading ? '📤 Importando...' : '📤 Selecionar Excel'}
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={loading}
                />
              </label>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setModalAberto(true)}
          className="px-3 py-1 rounded text-sm bg-purple-500 text-white hover:bg-purple-600"
        >
          Importar Excel
        </button>
      )}

      {/* Modal (se estiver no ModuloCasa) */}
      {modalAberto && !window.location.pathname.includes('configuracoes') && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Importar Lançamentos (Excel)</h3>
            <div className="space-y-4">
              {/* Barra de Progresso */}
              {loading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>{statusAtual}</span>
                    <span>{progresso}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progresso}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">📋 Formato da Planilha:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• <strong>DATA:</strong> Qualquer formato de data (DD/MM/YYYY, YYYY-MM-DD, ou serial do Excel)</li>
                  <li>• <strong>DESCRICAO:</strong> Texto livre</li>
                  <li>• <strong>VALOR:</strong> Número (1500.00 ou 1.500,00)</li>
                  <li>• <strong>TIPO:</strong> ENTRADA ou SAIDA</li>
                  <li>• <strong>STATUS:</strong> PAGO ou PREVISTO</li>
                  <li>• <strong>CENTRO_CUSTO:</strong> Nome do centro de custo</li>
                </ul>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={baixarModelo}
                  className="flex-1 bg-gray-500 text-white py-2 px-3 rounded hover:bg-gray-600 text-sm"
                  disabled={loading}
                >
                  📥 Baixar Modelo
                </button>
                
                <label className="flex-1 bg-blue-500 text-white py-2 px-3 rounded hover:bg-blue-600 text-sm text-center cursor-pointer">
                  {loading ? '📤 Importando...' : '📤 Selecionar Excel'}
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={loading}
                  />
                </label>
              </div>

              <button
                onClick={() => setModalAberto(false)}
                className="w-full bg-gray-300 text-gray-700 py-2 px-3 rounded hover:bg-gray-400 text-sm"
                disabled={loading}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
