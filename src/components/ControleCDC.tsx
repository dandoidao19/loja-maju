'use client'

import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'

interface CentroCusto {
  id: string
  nome: string
  contexto: string
  tipo: string
  categoria: string
  recorrencia: string
}

interface ControleCDCProps {
  onDataChange: () => void; // Para notificar o pai sobre mudanças
}

export default function ControleCDC({ onDataChange }: ControleCDCProps) {
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([])
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  
  // Estado do formulário com valores PADRÃO CORRETOS
  const [formCentroCusto, setFormCentroCusto] = useState({
    nome: '',
    contexto: 'casa' as 'casa' | 'loja',
    tipo: 'DESPESA' as 'RECEITA' | 'DESPESA',
    categoria: '',
    recorrencia: 'VARIAVEL' as 'FIXO' | 'VARIAVEL'
  })

  useEffect(() => {
    carregarUsuarioECentros()
  }, [])

  const carregarUsuarioECentros = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    
    const { data: centros, error } = await supabase
      .from('centros_de_custo')
      .select('*')
      .order('contexto')
      .order('tipo')
      .order('nome')

    if (error) {
      console.error('Erro ao carregar centros:', error)
    } else if (centros) {
      setCentrosCusto(centros)
    }
  }

  const adicionarCentroCusto = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) {
      alert('Erro: Usuário não identificado')
      return
    }

    // VALIDAÇÃO EXTRA - garantir que os valores estão corretos
    const dadosValidados = {
      user_id: user.id,
      nome: formCentroCusto.nome.toUpperCase().trim(),
      contexto: formCentroCusto.contexto, // Já validado pelo TypeScript
      tipo: formCentroCusto.tipo, // Já validado pelo TypeScript
      categoria: formCentroCusto.categoria.toUpperCase().trim() || 'OUTROS',
      recorrencia: formCentroCusto.recorrencia // Já validado pelo TypeScript
    }

    console.log('Tentando inserir:', dadosValidados)

    setLoading(true)

    try {
      const { error } = await supabase
        .from('centros_de_custo')
        .insert(dadosValidados)

      if (error) {
        throw error
      }

      // Sucesso
      setFormCentroCusto({
        nome: '',
        contexto: 'casa',
        tipo: 'DESPESA',
        categoria: '',
        recorrencia: 'VARIAVEL'
      })
      
      await carregarUsuarioECentros()
      onDataChange() // Notifica o componente pai
      alert('✅ Centro de custo adicionado com sucesso!')
      
    } catch (error: any) {
      console.error('Erro detalhado:', error)
      alert('❌ Erro ao adicionar: ' + error.message + '\n\nValores enviados: ' + JSON.stringify({
        nome: formCentroCusto.nome,
        contexto: formCentroCusto.contexto,
        tipo: formCentroCusto.tipo,
        categoria: formCentroCusto.categoria,
        recorrencia: formCentroCusto.recorrencia
      }, null, 2))
    } finally {
      setLoading(false)
    }
  }

  const deletarCentroCusto = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este centro de custo?')) {
      return
    }

    const { error } = await supabase
      .from('centros_de_custo')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Erro: ' + error.message)
    } else {
      carregarUsuarioECentros()
      onDataChange() // Notifica o componente pai
      alert('Centro de custo excluído com sucesso!')
    }
  }

  // Estatísticas
  const estatisticas = {
    total: centrosCusto.length,
    casa: centrosCusto.filter(c => c.contexto === 'casa').length,
    loja: centrosCusto.filter(c => c.contexto === 'loja').length,
    receitas: centrosCusto.filter(c => c.tipo === 'RECEITA').length,
    despesas: centrosCusto.filter(c => c.tipo === 'DESPESA').length
  }

  return (
    <div className="space-y-6">
      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
          <h3 className="text-xs font-medium text-blue-800">Total</h3>
          <p className="text-lg font-bold text-blue-600">{estatisticas.total}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <h3 className="text-sm font-medium text-green-800">Casa</h3>
          <p className="text-xl font-bold text-green-600">{estatisticas.casa}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <h3 className="text-sm font-medium text-purple-800">Loja</h3>
          <p className="text-xl font-bold text-purple-600">{estatisticas.loja}</p>
        </div>
        <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
          <h3 className="text-sm font-medium text-emerald-800">Receitas</h3>
          <p className="text-xl font-bold text-emerald-600">{estatisticas.receitas}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <h3 className="text-sm font-medium text-red-800">Despesas</h3>
          <p className="text-xl font-bold text-red-600">{estatisticas.despesas}</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-3">Centros de Custo</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulário */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Adicionar Centro de Custo</h3>
            <form onSubmit={adicionarCentroCusto} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700">Nome *</label>
                <input
                  type="text"
                  value={formCentroCusto.nome}
                  onChange={(e) => setFormCentroCusto({...formCentroCusto, nome: e.target.value})}
                  className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 uppercase text-sm"
                  required
                  placeholder="EX: MERCADO, SALARIO..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700">Contexto *</label>
                  <select
                    value={formCentroCusto.contexto}
                    onChange={(e) => setFormCentroCusto({...formCentroCusto, contexto: e.target.value as 'casa' | 'loja'})}
                    className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                    required
                  >
                    <option value="casa">Casa</option>
                    <option value="loja">Loja</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Tipo *</label>
                  <select
                    value={formCentroCusto.tipo}
                    onChange={(e) => setFormCentroCusto({...formCentroCusto, tipo: e.target.value as 'RECEITA' | 'DESPESA'})}
                    className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                    required
                  >
                    <option value="RECEITA">Receita</option>
                    <option value="DESPESA">Despesa</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Categoria *</label>
                  <input
                    type="text"
                    value={formCentroCusto.categoria}
                    onChange={(e) => setFormCentroCusto({...formCentroCusto, categoria: e.target.value})}
                    className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 uppercase text-sm"
                    required
                    placeholder="EX: ALIMENTAÇÃO..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Recorrência *</label>
                  <select
                    value={formCentroCusto.recorrencia}
                    onChange={(e) => setFormCentroCusto({...formCentroCusto, recorrencia: e.target.value as 'FIXO' | 'VARIAVEL'})}
                    className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                    required
                  >
                    <option value="FIXO">Fixo</option>
                    <option value="VARIAVEL">Variável</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? 'Adicionando...' : 'Adicionar Centro de Custo'}
              </button>
            </form>
          </div>

          {/* Lista */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Centros de Custo ({centrosCusto.length})</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {centrosCusto.map(centro => (
                <div key={centro.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="font-semibold text-sm text-gray-800">{centro.nome}</span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          centro.contexto === 'casa' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {centro.contexto.toUpperCase()}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          centro.tipo === 'RECEITA' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {centro.tipo}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600">
                        <div><strong>Categoria:</strong> {centro.categoria}</div>
                        <div><strong>Recorrência:</strong> {centro.recorrencia}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => deletarCentroCusto(centro.id)}
                      className="text-red-500 hover:text-red-700 ml-2"
                      title="Excluir"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
              {centrosCusto.length === 0 && (
                <p className="text-gray-500 text-center py-4">Nenhum centro de custo cadastrado.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
