import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface DashboardStats {
  totalRevenue: number;
  pendingQuotes: number;
  approvedQuotes: number;
  rejectedQuotes: number;
  topVaccines: {
    name: string;
    quantity: number;
  }[];
  revenueByUnit: {
    unit: string;
    revenue: number;
  }[];
  quotesByStatus: {
    status: string;
    count: number;
  }[];
}

interface Profile {
  full_name: string;
  unit: string;
}

const STATUS_COLORS = {
  'Aprovados': '#10B981',  // Green
  'Pendentes': '#F59E0B',  // Yellow
  'Rejeitados': '#EF4444', // Red
};

export default function Dashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    pendingQuotes: 0,
    approvedQuotes: 0,
    rejectedQuotes: 0,
    topVaccines: [],
    revenueByUnit: [],
    quotesByStatus: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  async function fetchProfile() {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, unit')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  }

  async function fetchDashboardStats() {
    try {
      const [
        { data: quotesData },
        { data: quoteItemsData },
        { data: profilesData },
      ] = await Promise.all([
        supabase
          .from('quotes')
          .select(`
            id,
            status,
            discount,
            created_by,
            created_at,
            quote_items (
              quantity,
              price
            )
          `),
        supabase
          .from('quote_items')
          .select(`
            quantity,
            vaccine:vaccine_id(name)
          `),
        supabase
          .from('profiles')
          .select('id, unit'),
      ]);

      // Calculate total revenue and quotes by status
      let totalRevenue = 0;
      const revenueByUnitMap = new Map();
      const statusCount = { approved: 0, pending: 0, rejected: 0 };

      quotesData?.forEach(quote => {
        const quoteTotal = quote.quote_items.reduce((sum: number, item: any) => 
          sum + (item.quantity * item.price), 0) - (quote.discount || 0);

        if (quote.status === 'approved') {
          totalRevenue += quoteTotal;
          
          // Map revenue to unit
          const profile = profilesData?.find(p => p.id === quote.created_by);
          if (profile) {
            const currentRevenue = revenueByUnitMap.get(profile.unit) || 0;
            revenueByUnitMap.set(profile.unit, currentRevenue + quoteTotal);
          }
        }
        
        statusCount[quote.status as keyof typeof statusCount]++;
      });

      // Calculate top vaccines
      const vaccineCount = new Map();
      quoteItemsData?.forEach(item => {
        const name = item.vaccine.name;
        const current = vaccineCount.get(name) || 0;
        vaccineCount.set(name, current + item.quantity);
      });

      const topVaccines = Array.from(vaccineCount.entries())
        .map(([name, quantity]) => ({ name, quantity }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      const revenueByUnit = Array.from(revenueByUnitMap.entries())
        .map(([unit, revenue]) => ({ unit, revenue }))
        .sort((a, b) => b.revenue - a.revenue);

      const quotesByStatus = [
        { status: 'Aprovados', count: statusCount.approved },
        { status: 'Pendentes', count: statusCount.pending },
        { status: 'Rejeitados', count: statusCount.rejected },
      ];

      setStats({
        totalRevenue,
        pendingQuotes: statusCount.pending,
        approvedQuotes: statusCount.approved,
        rejectedQuotes: statusCount.rejected,
        topVaccines,
        revenueByUnit,
        quotesByStatus,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
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
      {/* User Info */}
      {profile && (
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Bem-vindo(a), {profile.full_name}</h2>
          <p className="text-gray-600">Unidade: {profile.unit}</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Receita Total</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL'
            }).format(stats.totalRevenue)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Orçamentos Pendentes</h3>
          <p className="mt-2 text-3xl font-bold text-yellow-500">{stats.pendingQuotes}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Orçamentos Aprovados</h3>
          <p className="mt-2 text-3xl font-bold text-green-500">{stats.approvedQuotes}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Orçamentos Rejeitados</h3>
          <p className="mt-2 text-3xl font-bold text-red-500">{stats.rejectedQuotes}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Unit Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Receita por Unidade</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.revenueByUnit}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="unit" />
                <YAxis
                  tickFormatter={(value) => 
                    new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                      notation: 'compact',
                    }).format(value)
                  }
                />
                <Tooltip
                  formatter={(value: number) =>
                    new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(value)
                  }
                />
                <Bar dataKey="revenue" fill="#3d9948" name="Receita" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Vaccines Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Vacinas Mais Vendidas</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.topVaccines}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="quantity" fill="#0094d9" name="Quantidade" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quotes by Status Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm col-span-2">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Status dos Orçamentos</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.quotesByStatus}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.status}: ${entry.count}`}
                >
                  {stats.quotesByStatus.map((entry) => (
                    <Cell key={`cell-${entry.status}`} fill={STATUS_COLORS[entry.status]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}