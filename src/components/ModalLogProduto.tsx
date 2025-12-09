'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Produto {
  id: string
  codigo: string
  descricao: string
}

interface LogMovimentacao {
  id: string
  data: string
  tipo: 'entrada' | 'saida' | 'ajuste'
  quantidade: number
  observacao: string
  usuario?: string
}

interface ModalLogProdutoProps {
  produto: Produto
  onClose: () => void
}

export default function ModalLogProduto({ produto, onClose }: ModalLogProdutoProps) {
  const [logs, setLogs] = useState<LogMovimentacao[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    carregarLogs()
  }, [produto.id])

  const carregarLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('movimentacoes_estoque')
        .select('*')
        .eq('produto_id', produto.id)
        .order('data', { ascending: false })

      if (error) throw error
      setLogs(data || [])
    } catch (error) {
      console.error('Erro ao carregar logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTipoBadge = (tipo: string) => {
    const tipos: { [key: string]: { bg: string; text: string; label: string } } = {
      entrada: { bg: 'bg-green-100', text: 'text-green-800', label: 'Entrada' },
      saida: { bg: 'bg-red-100', text: 'text-red-800', label: 'Saída' },
      ajuste: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Ajuste' },
    }
    const config = tipos[tipo] || tipos.ajuste
    return config
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Cabeçalho */}
        <div className="sticky top-0 bg-gradient-to-r from-gray-600 to-gray-700 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white">Log de Movimentações</h2>
            <p className="text-gray-200 text-sm mt-1">
              {produto.codigo} - {produto.descricao}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-gray-600 p-2 rounded transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-600">Carregando histórico...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Nenhuma movimentação registrada para este produto</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => {
                const tipoBadge = getTipoBadge(log.tipo)
                return (
                  <div
                    key={log.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${tipoBadge.bg} ${tipoBadge.text}`}
                        >
                          {tipoBadge.label}
                        </span>
                        <span className="text-sm text-gray-600">
                          {new Date(log.data).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <span
                        className={`text-lg font-bold ${
                          log.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {log.tipo === 'entrada' ? '+' : '-'}{log.quantidade}
                      </span>
                    </div>

                    {log.observacao && (
                      <p className="text-sm text-gray-700 bg-gray-100 p-2 rounded mt-2">
                        <span className="font-semibold">Observação:</span> {log.observacao}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="border-t bg-gray-50 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
