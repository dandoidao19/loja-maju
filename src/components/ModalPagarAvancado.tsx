'use client'

import React from 'react'
import { getDataAtualBrasil, formatarDataParaExibicao } from '@/lib/dateUtils'

// Interfaces (devem ser importadas do arquivo principal ou definidas aqui se for um arquivo separado)
interface Lancamento {
  id: string
  descricao: string
  valor: number
  tipo: string
  data_lancamento: string
  data_prevista: string
  centro_custo_id: string
  status: string
  parcelamento?: { atual: number; total: number }
  recorrencia?: any
  caixa_id?: string // Adicionado para corrigir erro TS2339
  origem?: string // Adicionado para corrigir erro TS2339
  centros_de_custo?: {
    nome: string
  }
}

interface ModalPagarState {
  aberto: boolean
  lancamento: Lancamento | null
  passo: 'confirmar_total' | 'valor_parcial' | 'nova_parcela' | 'nova_parcela_data'
  valorPago: number | null
  novaDataVencimento: string
}

interface ModalPagarAvancadoProps {
  modalPagar: ModalPagarState
  setModalPagar: React.Dispatch<React.SetStateAction<ModalPagarState>>
  processarPagamento: () => Promise<void>
}

export default function ModalPagarAvancado({ modalPagar, setModalPagar, processarPagamento }: ModalPagarAvancadoProps) {
  if (!modalPagar.aberto || !modalPagar.lancamento) return null

  const lancamento = modalPagar.lancamento
  const valorRestante = lancamento.valor - (modalPagar.valorPago || 0)

  const fecharModal = () => setModalPagar({ 
    aberto: false, 
    lancamento: null, 
    passo: 'confirmar_total', 
    valorPago: null, 
    novaDataVencimento: getDataAtualBrasil() 
  })

  const avancarPasso = (passo: 'confirmar_total' | 'valor_parcial' | 'nova_parcela' | 'nova_parcela_data', valor?: number) => {
    setModalPagar(prev => ({
      ...prev,
      passo,
      valorPago: valor !== undefined ? valor : prev.valorPago,
      novaDataVencimento: prev.novaDataVencimento || getDataAtualBrasil()
    }))
  }

  // CORREÇÃO: Função de manipulação de valor para evitar a recriação do componente
  const handleValorParcialChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = parseFloat(e.target.value)
    setModalPagar(prev => ({ ...prev, valorPago: isNaN(valor) ? null : valor }))
  }

  // CORREÇÃO: Função de manipulação de data para evitar a recriação do componente
  const handleNovaDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setModalPagar(prev => ({ ...prev, novaDataVencimento: e.target.value }))
  }

  const renderPasso = () => {
    switch (modalPagar.passo) {
      case 'confirmar_total':
        return (
          <>
            <h3 className="text-lg font-semibold mb-4">Confirmar Pagamento</h3>
            <p className="text-sm text-gray-700 mb-4">
              O valor total de **R$ {lancamento.valor.toFixed(2)}** do lançamento "{lancamento.descricao}" será pago?
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => avancarPasso('valor_parcial', 0)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-yellow-200 rounded-md hover:bg-yellow-300"
              >
                Não (Pagamento Parcial)
              </button>
              <button
                onClick={() => processarPagamento()}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
              >
                Sim (Valor Total)
              </button>
            </div>
          </>
        )
      case 'valor_parcial':
        return (
          <>
            <h3 className="text-lg font-semibold mb-4">Pagamento Parcial</h3>
            <p className="text-sm text-gray-700 mb-2">
              Digite o valor pago para "{lancamento.descricao}" (Valor original: R$ {lancamento.valor.toFixed(2)}):
            </p>
            <input
              type="number"
              step="0.01"
              // O valor é controlado pelo estado do modalPagar
              value={modalPagar.valorPago === null ? '' : modalPagar.valorPago}
              onChange={handleValorParcialChange}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm mb-4"
              required
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={fecharModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (modalPagar.valorPago === null || modalPagar.valorPago <= 0 || modalPagar.valorPago > lancamento.valor) {
                    alert('Valor pago inválido.')
                    return
                  }
                  if (lancamento.valor - modalPagar.valorPago > 0.01) { // Verifica se o restante é significativo
                    avancarPasso('nova_parcela')
                  } else {
                    processarPagamento() // Se o valor pago for igual ao total, processa
                  }
                }}
                disabled={modalPagar.valorPago === null || modalPagar.valorPago <= 0}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                OK
              </button>
            </div>
          </>
        )
      case 'nova_parcela':
        return (
          <>
            <h3 className="text-lg font-semibold mb-4">Gerar Nova Parcela?</h3>
            <p className="text-sm text-gray-700 mb-4">
              O valor restante é de **R$ {valorRestante.toFixed(2)}**. Deseja gerar uma nova parcela para este valor?
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => processarPagamento()} // Não gera nova parcela
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-red-200 rounded-md hover:bg-red-300"
              >
                Não (Apenas Alterar Status)
              </button>
              <button
                onClick={() => avancarPasso('nova_parcela_data')}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Sim (Gerar Parcela)
              </button>
            </div>
          </>
        )
      case 'nova_parcela_data':
        return (
          <>
            <h3 className="text-lg font-semibold mb-4">Nova Data de Vencimento</h3>
            <p className="text-sm text-gray-700 mb-2">
              Valor da nova parcela: **R$ {valorRestante.toFixed(2)}**.
            </p>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nova Data de Vencimento</label>
              <input
                type="date"
                // O valor é controlado pelo estado do modalPagar
                value={modalPagar.novaDataVencimento}
                onChange={handleNovaDataChange}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm mb-4"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Data selecionada: {formatarDataParaExibicao(modalPagar.novaDataVencimento)}</p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={fecharModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={() => processarPagamento()}
                disabled={!modalPagar.novaDataVencimento}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                Confirmar e Gerar Parcela
              </button>
            </div>
          </>
        )
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm">
        {renderPasso()}
      </div>
    </div>
  )
}
