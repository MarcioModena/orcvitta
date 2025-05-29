import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Syringe, Users, FileText, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

function Layout() {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const [profile, setProfile] = React.useState<{ full_name: string; unit: string } | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  async function fetchProfile() {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, unit')
        .eq('id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-gray-500">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              {/* Logo */}
              <div className="flex-shrink-0 flex items-center">
                <Syringe className="h-8 w-8 text-primary" />
                <span className="ml-2 text-xl font-bold text-gray-900">OrcVitta</span>
              </div>

              {/* Navigation Links */}
              <div className="hidden sm:ml-6 sm:flex sm:space-x-4">
                <Link
                  to="/"
                  className={`inline-flex items-center px-4 py-2 text-sm font-medium ${
                    isActive('/') 
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-gray-500 hover:text-primary hover:border-b-2 hover:border-primary'
                  }`}
                >
                  <LayoutDashboard className="w-5 h-5 mr-2" />
                  <span>Dashboard</span>
                </Link>
                <Link
                  to="/vaccines"
                  className={`inline-flex items-center px-4 py-2 text-sm font-medium ${
                    isActive('/vaccines')
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-gray-500 hover:text-primary hover:border-b-2 hover:border-primary'
                  }`}
                >
                  <Syringe className="w-5 h-5 mr-2" />
                  <span>Vacinas</span>
                </Link>
                <Link
                  to="/clients"
                  className={`inline-flex items-center px-4 py-2 text-sm font-medium ${
                    isActive('/clients')
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-gray-500 hover:text-primary hover:border-b-2 hover:border-primary'
                  }`}
                >
                  <Users className="w-5 h-5 mr-2" />
                  <span>Clientes</span>
                </Link>
                <Link
                  to="/quotes"
                  className={`inline-flex items-center px-4 py-2 text-sm font-medium ${
                    isActive('/quotes')
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-gray-500 hover:text-primary hover:border-b-2 hover:border-primary'
                  }`}
                >
                  <FileText className="w-5 h-5 mr-2" />
                  <span>Orçamentos</span>
                </Link>
              </div>
            </div>

            {/* User Profile & Sign Out */}
            <div className="flex items-center">
              {profile && (
                <div className="mr-4 text-right">
                  <p className="text-sm font-medium text-gray-900">{profile.full_name}</p>
                  <p className="text-xs text-gray-500">{profile.unit}</p>
                </div>
              )}
              <button
                onClick={signOut}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary rounded-md hover:bg-gray-50"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;