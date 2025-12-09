'use client'

import { formatarDataParaExibicao } from '@/lib/dateUtils'

interface DiaCaixa {
  data: string
  data_formatada: string
  receitas: number
  despesas: number
  saldo_acumulado: number
}

interface ResumoDia {
  entradas: number
  saidas: number
}

interface VisualizacaoCaixasProps {
  titulo: string
  caixaReal: number
  resumoHoje: ResumoDia
  caixaPrevisto: DiaCaixa[]
  cor?: 'blue' | 'green'
}

export default function VisualizacaoCaixas({
  titulo,
  caixaReal,
  resumoHoje,
  caixaPrevisto,
  cor = 'blue'
}: VisualizacaoCaixasProps) {
  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
  }

  const formatarMoedaCompacta = (valor: number) => {
    if (valor === 0) return 'R$ 0'
    
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(valor)
  }

  const formatarDataTabela = (dataISO: string) => {
    try {
      const dataFormatada = formatarDataParaExibicao(dataISO)
      
      let dataParaConversao = dataISO;
      if (/^\d{4}-\d{2}-\d{2}$/.test(dataISO)) {
          dataParaConversao = `${dataISO}T12:00:00`;
      }
      const data = new Date(dataParaConversao)
      
      const diaSemana = data.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
      
      return `${diaSemana} - ${dataFormatada}`
    } catch {
      return dataISO
    }
  }

  const corPrincipal = cor === 'blue' ? 'blue' : 'green'
  const corClara = cor === 'blue' ? 'blue-50' : 'green-50'
  const corBorda = cor === 'blue' ? 'blue-200' : 'green-200'
  const corTexto = cor === 'blue' ? 'blue-800' : 'green-800'

  return (
    <div className="space-y-3">
      {/* Título */}
      <h3 className={`text-lg font-bold text-${corTexto}`}>{titulo}</h3>

      {/* Caixa Real */}
      <div className={`bg-${corClara} border-2 border-${corBorda} rounded-lg p-4`}>
        <h4 className={`text-sm font-semibold text-${corTexto} mb-2`}>💰 Caixa Real</h4>
        <p className={`text-2xl font-bold text-${corTexto}`}>
          {formatarMoeda(caixaReal)}
        </p>
        <div className="mt-2 text-xs text-gray-600">
          <p>↗️ Entradas hoje: {formatarMoedaCompacta(resumoHoje.entradas)}</p>
          <p>↘️ Saídas hoje: {formatarMoedaCompacta(resumoHoje.saidas)}</p>
        </div>
      </div>

      {/* Caixa Previsto */}
      <div className="bg-white border border-gray-300 rounded-lg p-3">
        <h4 className={`text-sm font-semibold text-${corTexto} mb-2`}>📊 Caixa Previsto</h4>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="p-2 text-left">Data</th>
                <th className="p-2 text-right">Receitas</th>
                <th className="p-2 text-right">Despesas</th>
                <th className="p-2 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {caixaPrevisto.map((dia, idx) => (
                <tr key={idx} className="border-b hover:bg-gray-50">
                  <td className="p-2">{formatarDataTabela(dia.data)}</td>
                  <td className="p-2 text-right text-green-600">
                    {formatarMoedaCompacta(dia.receitas)}
                  </td>
                  <td className="p-2 text-right text-red-600">
                    {formatarMoedaCompacta(dia.despesas)}
                  </td>
                  <td className={`p-2 text-right font-semibold ${
                    dia.saldo_acumulado >= 0 ? 'text-blue-600' : 'text-red-600'
                  }`}>
                    {formatarMoedaCompacta(dia.saldo_acumulado)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
