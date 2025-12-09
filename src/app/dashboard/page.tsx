// app/dashboard/page.tsx - VERSÃO OTIMIZADA COM MÓDULO LOJA
'use client'

import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import ResumoCaixas from '@/components/ResumoCaixas'
import ModuloCasa from '@/components/ModuloCasa'
import ModuloConfiguracoes from '@/components/ModuloConfiguracoes'
import ModuloLoja from '@/components/ModuloLoja'
import { DadosFinanceirosProvider } from '@/context/DadosFinanceirosContext'

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
    <DadosFinanceirosProvider>
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
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeSection === 'resumo' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                📊 Resumo Caixas
              </button>
              <button
                onClick={() => setActiveSection('casa')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeSection === 'casa' 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                🏠 Módulo Casa
              </button>
              <button
                onClick={() => setActiveSection('loja')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeSection === 'loja' 
                    ? 'bg-purple-500 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                🏪 Módulo Loja
              </button>
              <button
                onClick={() => setActiveSection('configuracoes')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeSection === 'configuracoes' 
                    ? 'bg-gray-500 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                ⚙️ Configurações
              </button>
            </div>
          </div>

          {/* Conteúdo Dinâmico - OTIMIZADO: Componentes permanecem montados */}
          <div style={{ display: activeSection === 'resumo' ? 'block' : 'none' }}>
            <ResumoCaixas />
          </div>
          
          <div style={{ display: activeSection === 'casa' ? 'block' : 'none' }}>
            <ModuloCasa />
          </div>

          <div style={{ display: activeSection === 'loja' ? 'block' : 'none' }}>
            <ModuloLoja />
          </div>

          <div style={{ display: activeSection === 'configuracoes' ? 'block' : 'none' }}>
            <ModuloConfiguracoes />
          </div>
        </div>
      </div>
    </DadosFinanceirosProvider>
  )
}
