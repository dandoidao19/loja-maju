'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import FormularioCompra from './FormularioCompra'
import ListaCompras from './ListaCompras'

interface Compra {
  id: string
  data_compra: string
  fornecedor: string
  itens: ItemCompra[]
  total: number
  quantidade_parcelas: number
  status: string
}

interface ItemCompra {
  id: string
  produto_id: string
  descricao: string
  quantidade: number
  categoria: string
  preco_custo: number
  preco_venda: number
}

export default function PaginaCompras() {
  const [compras, setCompras] = useState<Compra[]>([])
  const [loading, setLoading] = useState(true)
  const [novaCompraAberta, setNovaCompraAberta] = useState(false)

  useEffect(() => {
    carregarCompras()
  }, [])

  const carregarCompras = async () => {
    try {
      const { data, error } = await supabase
        .from('compras')
        .select(`
          *,
          itens_compra (
            id,
            produto_id,
            descricao,
            quantidade,
            categoria,
            preco_custo,
            preco_venda
          )
        `)
        .order('data_compra', { ascending: false })

      if (error) throw error
      setCompras(data || [])
    } catch (error) {
      console.error('Erro ao carregar compras:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCompraAdicionada = () => {
    carregarCompras()
    setNovaCompraAberta(false)
  }

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md text-center">
        <p className="text-gray-600">Carregando compras...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Layout: Formulário à esquerda, Transações à direita */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Esquerda: Formulário */}
        <div className="lg:col-span-1">
          <FormularioCompra
            onCompraAdicionada={handleCompraAdicionada}
            novaCompraAberta={novaCompraAberta}
            onNovaCompra={() => setNovaCompraAberta(!novaCompraAberta)}
          />
        </div>

        {/* Coluna Direita: Transações */}
        <div className="lg:col-span-2">
          <ListaCompras compras={compras} onAtualizar={carregarCompras} />
        </div>
      </div>
    </div>
  )
}
