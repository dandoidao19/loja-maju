'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import FormularioVenda from './FormularioVenda'
import ListaVendas from './ListaVendas'

interface Venda {
  id: string
  data_venda: string
  cliente: string
  itens: ItemVenda[]
  total: number
  status: string
}

interface ItemVenda {
  id: string
  produto_id: string | null
  descricao: string
  quantidade: number
  preco_venda: number
}

export default function PaginaVendas() {
  const [vendas, setVendas] = useState<Venda[]>([])
  const [loading, setLoading] = useState(true)
  const [novaVendaAberta, setNovaVendaAberta] = useState(false)

  useEffect(() => {
    carregarVendas()
  }, [])

  const carregarVendas = async () => {
    try {
      const { data, error } = await supabase
        .from('vendas')
        .select(`
          *,
          itens_venda (
            id,
            produto_id,
            descricao,
            quantidade,
            preco_venda
          )
        `)
        .order('data_venda', { ascending: false })

      if (error) throw error
      
      // Mapear itens_venda para itens
      const vendasFormatadas = (data || []).map((venda: any) => ({
        ...venda,
        itens: venda.itens_venda || [],
        status: venda.status_pagamento || 'pendente'
      }))
      
      setVendas(vendasFormatadas)
    } catch (error) {
      console.error('Erro ao carregar vendas:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleVendaAdicionada = () => {
    carregarVendas()
    setNovaVendaAberta(false)
  }

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md text-center">
        <p className="text-gray-600">Carregando vendas...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Layout: Formulário à esquerda, Transações à direita */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Esquerda: Formulário */}
        <div className="lg:col-span-1">
          <FormularioVenda
            onVendaAdicionada={handleVendaAdicionada}
            novaVendaAberta={novaVendaAberta}
            onNovaVenda={() => setNovaVendaAberta(!novaVendaAberta)}
          />
        </div>

        {/* Coluna Direita: Transações */}
        <div className="lg:col-span-2">
          <ListaVendas vendas={vendas} onAtualizar={carregarVendas} />
        </div>
      </div>
    </div>
  )
}
