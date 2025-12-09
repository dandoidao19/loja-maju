'use client'

import { useState } from 'react'
import ControleCDC from './ControleCDC' // Importa o novo componente
import LimparTransacoes from './LimparTransacoes' // Componente de limpeza
import ImportacaoExcel from './ImportacaoExcel' // Componente de importação
import MenuCategorias from './MenuCategorias' // Importa o novo menu de categorias

// Define os submenus
const submenus = [
  { id: 'cdc', title: 'Centros de Custo', component: ControleCDC },
  { id: 'loja', title: 'Loja', component: MenuCategorias }, // Novo menu de categorias
  { id: 'limpeza', title: 'Limpar Transações', component: LimparTransacoes },
  { id: 'importacao', title: 'Importação Excel', component: ImportacaoExcel },
]

export default function ModuloConfiguracoes() {
  const [menuAtivo, setMenuAtivo] = useState('cdc')
  
  // Função para renderizar o componente ativo
  const renderConteudo = () => {
    const menu = submenus.find(m => m.id === menuAtivo)
    if (!menu) return <div>Selecione uma opção.</div>

    const ComponenteAtivo = menu.component

    // Função para lidar com mudanças de dados
    const handleDataChange = () => {
      console.log('Dados de Centros de Custo alterados.')
    }

    // Função específica para ImportacaoExcel
    const handleImportacaoConcluida = () => {
      console.log('Importação de Excel concluída. Recarregar dados se necessário.')
      // Aqui você chamaria a função de recarregar dados do ModuloCasa, se estivesse aqui.
    }

    // Renderizar o componente baseado no menuAtivo
    switch (menuAtivo) {
      case 'cdc':
        return <ControleCDC onDataChange={handleDataChange} />
      case 'loja':
        return <MenuCategorias />
      case 'limpeza':
        return <LimparTransacoes onDataChange={handleDataChange} />
      case 'importacao':
        return <ImportacaoExcel onImportacaoConcluida={handleImportacaoConcluida} />
      default:
        return <div>Componente não encontrado.</div>
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Configurações</h1>
      
      <div className="flex space-x-4">
        {/* Menu Lateral */}
        <div className="w-56 bg-white p-3 rounded-lg shadow-md flex-shrink-0">
          <h3 className="text-base font-semibold mb-3 border-b pb-2">Opções</h3>
          <nav className="space-y-2">
            {submenus.map(menu => (
              <button
                key={menu.id}
                onClick={() => setMenuAtivo(menu.id)}
                className={`w-full text-left px-2 py-1.5 rounded-md transition-colors text-sm ${
                  menuAtivo === menu.id
                    ? 'bg-blue-500 text-white font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {menu.title}
              </button>
            ))}
          </nav>
        </div>
        
        {/* Conteúdo Principal */}
        <div className="flex-1">
          {renderConteudo()}
        </div>
      </div>
    </div>
  )
}
