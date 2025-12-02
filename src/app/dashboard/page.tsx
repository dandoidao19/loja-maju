'use client'

import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import ResumoCaixas from '@/components/ResumoCaixas'
import ModuloCasa from '@/components/ModuloCasa'
import ModuloConfiguracoes from '@/components/ModuloConfiguracoes'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('resumo') // 'resumo', 'casa', 'loja', 'configuracoes'
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/')
      } else {
        setUser(session.user)
        setLoading(false)
      }
    }

    checkAuth()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-lg">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              Loja Maju - {
                activeSection === 'resumo' ? 'Resumo de Caixas' :
                activeSection === 'casa' ? 'Módulo Casa' :
                activeSection === 'loja' ? 'Módulo Loja' :
                'Configurações'
              }
            </h1>
            <p className="text-gray-600">
              Bem-vindo, {user?.email}!
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
          >
            Sair
          </button>
        </div>

        {/* Menu de Navegação */}
        <div className="bg-white p-4 rounded-lg shadow-md mb-6">
          <div className="flex space-x-4">
            <button
              onClick={() => setActiveSection('resumo')}
              className={`px-4 py-2 rounded-lg ${
                activeSection === 'resumo' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📊 Resumo Caixas
            </button>
            <button
              onClick={() => setActiveSection('casa')}
              className={`px-4 py-2 rounded-lg ${
                activeSection === 'casa' 
                  ? 'bg-green-500 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              🏠 Módulo Casa
            </button>
            <button
              onClick={() => setActiveSection('loja')}
              className={`px-4 py-2 rounded-lg ${
                activeSection === 'loja' 
                  ? 'bg-purple-500 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              🏪 Módulo Loja
            </button>
            <button
              onClick={() => setActiveSection('configuracoes')}
              className={`px-4 py-2 rounded-lg ${
                activeSection === 'configuracoes' 
                  ? 'bg-gray-500 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              ⚙️ Configurações
            </button>
          </div>
        </div>

        {/* Conteúdo Dinâmico */}
        {activeSection === 'resumo' && <ResumoCaixas />}
        
        {activeSection === 'casa' && <ModuloCasa />}

        {activeSection === 'configuracoes' && <ModuloConfiguracoes />}

        {activeSection === 'loja' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-2xl font-semibold mb-4">🏪 Módulo Loja</h2>
              <p className="text-gray-600 mb-6">
                Controle completo da loja: produtos, vendas, compras e condicionais.
              </p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button className="bg-blue-500 text-white py-4 px-6 rounded-lg hover:bg-blue-600 text-left">
                  <div className="font-semibold">📦 Estoque</div>
                  <div className="text-sm opacity-90">Gerenciar produtos</div>
                </button>
                
                <button className="bg-green-500 text-white py-4 px-6 rounded-lg hover:bg-green-600 text-left">
                  <div className="font-semibold">💰 Vendas</div>
                  <div className="text-sm opacity-90">Registrar vendas</div>
                </button>
                
                <button className="bg-purple-500 text-white py-4 px-6 rounded-lg hover:bg-purple-600 text-left">
                  <div className="font-semibold">🛒 Compras</div>
                  <div className="text-sm opacity-90">Comprar produtos</div>
                </button>
                
                <button className="bg-orange-500 text-white py-4 px-6 rounded-lg hover:bg-orange-600 text-left">
                  <div className="font-semibold">🔄 Condicionais</div>
                  <div className="text-sm opacity-90">Entrada/saída</div>
                </button>
              </div>
            </div>

            {/* Seção de Ações Rápidas */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-4">Ações Rápidas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <button className="border border-gray-300 p-4 rounded-lg hover:bg-gray-50 text-left">
                  <div className="font-semibold text-gray-800">➕ Novo Produto</div>
                  <div className="text-sm text-gray-600">Cadastrar item no estoque</div>
                </button>
                
                <button className="border border-gray-300 p-4 rounded-lg hover:bg-gray-50 text-left">
                  <div className="font-semibold text-gray-800">🧾 Nova Venda</div>
                  <div className="text-sm text-gray-600">Registrar venda rápida</div>
                </button>
                
                <button className="border border-gray-300 p-4 rounded-lg hover:bg-gray-50 text-left">
                  <div className="font-semibold text-gray-800">📋 Nova Compra</div>
                  <div className="text-sm text-gray-600">Comprar de fornecedor</div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}