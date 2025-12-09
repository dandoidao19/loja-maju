'use client'

import { useState } from 'react'
import TelaInicialLoja from './TelaInicialLoja'
import PaginaEstoque from './PaginaEstoque'
import PaginaCompras from './PaginaCompras'
import PaginaVendas from './PaginaVendas'
import ModuloCondicional from './ModuloCondicional'

type AbaLoja = 'inicial' | 'estoque' | 'vendas' | 'compras' | 'condicional'

export default function ModuloLoja() {
  const [abaAtiva, setAbaAtiva] = useState<AbaLoja>('inicial')

  const abas: { id: AbaLoja; titulo: string; icone: string }[] = [
    { id: 'inicial', titulo: 'Inicial', icone: '🏠' },
    { id: 'estoque', titulo: 'Estoque', icone: '📦' },
    { id: 'vendas', titulo: 'Vendas', icone: '💰' },
    { id: 'compras', titulo: 'Compras', icone: '📥' },
    { id: 'condicional', titulo: 'Condicional', icone: '⚙️' },
  ]

  const renderizarConteudo = () => {
    switch (abaAtiva) {
      case 'inicial':
        return <TelaInicialLoja />
      case 'estoque':
        return <PaginaEstoque />
      case 'vendas':
        return <PaginaVendas />
      case 'compras':
        return <PaginaCompras />
      case 'condicional':
        return <ModuloCondicional />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Menu Horizontal */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <nav className="flex flex-wrap gap-0">
          {abas.map((aba) => (
            <button
              key={aba.id}
              onClick={() => setAbaAtiva(aba.id)}
              className={`flex-1 min-w-max px-6 py-4 font-medium transition-all border-b-2 ${
                abaAtiva === aba.id
                  ? 'bg-blue-50 text-blue-600 border-blue-500'
                  : 'bg-white text-gray-700 border-transparent hover:bg-gray-50'
              }`}
            >
              <span className="mr-2">{aba.icone}</span>
              {aba.titulo}
            </button>
          ))}
        </nav>
      </div>

      {/* Conteúdo da Aba Ativa */}
      {renderizarConteudo()}
    </div>
  )
}
