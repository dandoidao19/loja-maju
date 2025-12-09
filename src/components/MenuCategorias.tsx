'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Categoria {
  id: string
  nome: string
  grupo: string
  percentual_repasse: number
}

export default function MenuCategorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<Categoria | null>(null)
  const [form, setForm] = useState({
    nome: '',
    grupo: '',
    percentual_repasse: 80,
  })
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  useEffect(() => {
    carregarCategorias()
  }, [])

  const carregarCategorias = async () => {
    try {
      const { data, error } = await supabase
        .from('categorias_estoque')
        .select('*')
        .order('nome', { ascending: true })

      if (error) throw error
      setCategorias(data || [])
    } catch (error) {
      console.error('Erro ao carregar categorias:', error)
      setErro('Erro ao carregar categorias')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setSucesso('')

    try {
      if (!form.nome.trim() || !form.grupo.trim()) {
        throw new Error('Categoria e Grupo são obrigatórios')
      }

      if (form.grupo.length !== 1) {
        throw new Error('Grupo deve ser uma única letra')
      }

      if (form.percentual_repasse < 0 || form.percentual_repasse > 100) {
        throw new Error('Percentual de repasse deve estar entre 0 e 100')
      }

      if (editando) {
        // Atualizar categoria existente
        const { error } = await supabase
          .from('categorias_estoque')
          .update({
            nome: form.nome.trim(),
            grupo: form.grupo.toUpperCase(),
            percentual_repasse: form.percentual_repasse,
          })
          .eq('id', editando.id)

        if (error) throw error
        setSucesso('Categoria atualizada com sucesso!')
      } else {
        // Criar nova categoria
        const { error } = await supabase
          .from('categorias_estoque')
          .insert({
            nome: form.nome.trim(),
            grupo: form.grupo.toUpperCase(),
            percentual_repasse: form.percentual_repasse,
          })

        if (error) throw error
        setSucesso('Categoria criada com sucesso!')
      }

      // Limpar formulário
      setForm({ nome: '', grupo: '', percentual_repasse: 80 })
      setEditando(null)
      carregarCategorias()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar categoria')
    }
  }

  const handleEditar = (categoria: Categoria) => {
    setEditando(categoria)
    setForm({
      nome: categoria.nome,
      grupo: categoria.grupo,
      percentual_repasse: categoria.percentual_repasse,
    })
  }

  const handleCancelar = () => {
    setEditando(null)
    setForm({ nome: '', grupo: '', percentual_repasse: 80 })
    setErro('')
    setSucesso('')
  }

  const handleDeletar = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar esta categoria?')) return

    try {
      const { error } = await supabase
        .from('categorias_estoque')
        .delete()
        .eq('id', id)

      if (error) throw error
      setSucesso('Categoria deletada com sucesso!')
      carregarCategorias()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao deletar categoria')
    }
  }

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md text-center">
        <p className="text-gray-600">Carregando categorias...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Formulário */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          {editando ? 'Editar Categoria' : 'Nova Categoria'}
        </h2>

        {erro && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {erro}
          </div>
        )}

        {sucesso && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {sucesso}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {/* Categoria */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoria *
              </label>
              <input
                type="text"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Roupas"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Grupo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Grupo (Letra) *
              </label>
              <input
                type="text"
                value={form.grupo}
                onChange={(e) =>
                  setForm({ ...form, grupo: e.target.value.toUpperCase().slice(0, 1) })
                }
                placeholder="Ex: R"
                maxLength={1}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                required
              />
            </div>

            {/* Percentual de Repasse */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Percentual de Repasse (%) *
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.percentual_repasse}
                onChange={(e) =>
                  setForm({ ...form, percentual_repasse: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="submit"
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 rounded-lg transition-colors"
            >
              {editando ? '✓ Atualizar' : '+ Criar Categoria'}
            </button>
            {editando && (
              <button
                type="button"
                onClick={handleCancelar}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Tabela de Categorias */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Categorias Cadastradas</h2>

        {categorias.length === 0 ? (
          <p className="text-gray-600 text-center py-4">Nenhuma categoria cadastrada</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Categoria</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Grupo</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">
                    % Repasse
                  </th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Ações</th>
                </tr>
              </thead>
              <tbody>
                {categorias.map((categoria) => (
                  <tr key={categoria.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-800">{categoria.nome}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded font-semibold">
                        {categoria.grupo}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-700">
                      {categoria.percentual_repasse.toFixed(2)}%
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => handleEditar(categoria)}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
                        >
                          ✎ Editar
                        </button>
                        <button
                          onClick={() => handleDeletar(categoria.id)}
                          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition-colors"
                        >
                          ✕ Deletar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
