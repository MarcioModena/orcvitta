import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Vaccine {
  id: string;
  name: string;
  manufacturer: string;
  stock: number;
  price: number;
}

export default function Vaccines() {
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingVaccine, setEditingVaccine] = useState<Vaccine | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    manufacturer: '',
    stock: 0,
    price: 0,
  });
  const [stockData, setStockData] = useState({
    vaccineId: '',
    quantity: 0,
  });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchVaccines();
  }, []);

  async function fetchVaccines() {
    try {
      const { data, error } = await supabase
        .from('vaccines')
        .select('*')
        .order('name');

      if (error) throw error;
      setVaccines(data || []);
    } catch (error) {
      console.error('Error fetching vaccines:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingVaccine) {
        const { error } = await supabase
          .from('vaccines')
          .update(formData)
          .eq('id', editingVaccine.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('vaccines')
          .insert([formData]);

        if (error) throw error;
      }
      
      setIsModalOpen(false);
      setEditingVaccine(null);
      setFormData({ name: '', manufacturer: '', stock: 0, price: 0 });
      fetchVaccines();
    } catch (error) {
      console.error('Error saving vaccine:', error);
    }
  }

  async function handleStockUpdate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const vaccine = vaccines.find(v => v.id === stockData.vaccineId);
      if (!vaccine) return;

      const { error } = await supabase
        .from('vaccines')
        .update({ stock: vaccine.stock + stockData.quantity })
        .eq('id', stockData.vaccineId);

      if (error) throw error;
      
      setIsStockModalOpen(false);
      setStockData({ vaccineId: '', quantity: 0 });
      fetchVaccines();
    } catch (error) {
      console.error('Error updating stock:', error);
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase
        .from('vaccines')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setConfirmDelete(null);
      fetchVaccines();
    } catch (error) {
      console.error('Error deleting vaccine:', error);
    }
  }

  function handleEdit(vaccine: Vaccine) {
    setEditingVaccine(vaccine);
    setFormData({
      name: vaccine.name,
      manufacturer: vaccine.manufacturer,
      stock: vaccine.stock,
      price: vaccine.price,
    });
    setIsModalOpen(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Vacinas</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsStockModalOpen(true)}
            className="bg-secondary text-white px-4 py-2 rounded-md hover:bg-secondary/90 flex items-center"
          >
            <Package className="w-4 h-4 mr-2" />
            Gerenciar Estoque
          </button>
          <button
            onClick={() => {
              setEditingVaccine(null);
              setFormData({ name: '', manufacturer: '', stock: 0, price: 0 });
              setIsModalOpen(true);
            }}
            className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Vacina
          </button>
        </div>
      </div>

      {/* Vaccines Table */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nome
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fabricante
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estoque
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Preço
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {vaccines.map((vaccine) => (
              <tr key={vaccine.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {vaccine.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {vaccine.manufacturer}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    vaccine.stock < 10 
                      ? 'bg-red-100 text-red-800'
                      : vaccine.stock < 30
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {vaccine.stock} unidades
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  }).format(vaccine.price)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleEdit(vaccine)}
                    className="text-primary hover:text-primary/90 mr-3"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  {confirmDelete === vaccine.id ? (
                    <div className="inline-flex items-center space-x-2">
                      <button
                        onClick={() => handleDelete(vaccine.id)}
                        className="text-red-600 hover:text-red-900 font-medium text-xs"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="text-gray-500 hover:text-gray-700 font-medium text-xs"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(vaccine.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Vaccine Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingVaccine ? 'Editar Vacina' : 'Nova Vacina'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nome</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Fabricante</label>
                <input
                  type="text"
                  required
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Estoque</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Preço</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                />
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingVaccine(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90"
                >
                  {editingVaccine ? 'Salvar Alterações' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Management Modal */}
      {isStockModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Gerenciar Estoque</h2>
            <form onSubmit={handleStockUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Vacina</label>
                <select
                  required
                  value={stockData.vaccineId}
                  onChange={(e) => setStockData({ ...stockData, vaccineId: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                >
                  <option value="">Selecione uma vacina</option>
                  {vaccines.map((vaccine) => (
                    <option key={vaccine.id} value={vaccine.id}>
                      {vaccine.name} (Estoque atual: {vaccine.stock})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Quantidade a adicionar</label>
                <input
                  type="number"
                  required
                  value={stockData.quantity}
                  onChange={(e) => setStockData({ ...stockData, quantity: parseInt(e.target.value) })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                />
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsStockModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90"
                >
                  Atualizar Estoque
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}