import React, { useState, useRef, useEffect } from 'react';
import {
  Heart,
  CalendarCheck,
  Activity,
  ClipboardList,
  Settings,
  Shield,
  Smartphone,
  Info,
  LogOut,
  Bell,
  AlertTriangle,
  User,
  Users,
  ChevronDown
} from 'lucide-react';
import { User as UserType, Family } from '../types';

interface NavbarProps {
  currentUser: UserType | null;
  currentFamily: Family | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  overdueCount?: number;
  pendingDoseCount?: number;
  onOpenAuthModal?: () => void;
  onOpenProfileModal?: () => void;
  onOpenInstallModal: () => void;
  onOpenInfoModal: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  currentFamily,
  activeTab,
  setActiveTab,
  overdueCount = 0,
  pendingDoseCount = 0,
  onOpenAuthModal,
  onOpenProfileModal,
  onOpenInstallModal,
  onOpenInfoModal,
  onLogout
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isSuperAdmin = currentUser?.role === 'superadmin';
  const isFamilyAdmin = currentUser?.isFamilyAdmin ?? false;
  const alertCount = overdueCount || pendingDoseCount || 0;

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-4">
          
          {/* Brand Logo & Family Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-tr from-sky-700 to-teal-700 rounded-2xl flex items-center justify-center shadow-md shadow-sky-900/10 text-white shrink-0">
              <Heart className="w-6 h-6 sm:w-7 sm:h-7 fill-white/20 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 font-['Outfit']">
                  CinicoCare
                </span>
                {isSuperAdmin ? (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md border border-purple-200">
                    <Shield className="w-3 h-3" /> Admin Generale
                  </span>
                ) : currentUser ? (
                  <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 bg-sky-50 text-sky-800 rounded-lg border border-sky-200">
                    <Users className="w-3.5 h-3.5" />
                    {currentFamily?.name || 'Gruppo Famiglia'}
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Somministrazione Farmaci & Assistenza Solidale
              </p>
            </div>
          </div>

          {/* Center Navigation Tabs (when logged in) */}
          {currentUser && (
            <nav className="hidden md:flex items-center gap-1 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/60">
              <button
                onClick={() => setActiveTab('today')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all relative ${
                  activeTab === 'today'
                    ? 'bg-white text-sky-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <CalendarCheck className="w-4 h-4" />
                <span>Oggi & Dosi</span>
                {alertCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-rose-600 text-white text-[10px] font-bold rounded-full animate-pulse">
                    {alertCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('therapies')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'therapies'
                    ? 'bg-white text-sky-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Activity className="w-4 h-4" />
                <span>Terapie</span>
              </button>

              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'history'
                    ? 'bg-white text-sky-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <ClipboardList className="w-4 h-4" />
                <span>Storico</span>
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'settings'
                    ? 'bg-white text-sky-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Impostazioni & Anagrafica</span>
              </button>

              {isSuperAdmin && (
                <button
                  onClick={() => setActiveTab('admin')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === 'admin'
                      ? 'bg-purple-700 text-white shadow-xs'
                      : 'text-purple-700 hover:bg-purple-50'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  <span>Pannello SuperAdmin</span>
                </button>
              )}
            </nav>
          )}

          {/* Right Header Actions */}
          <div className="flex items-center gap-2">
            
            {/* Overdue alert indicator button */}
            {alertCount > 0 && currentUser && (
              <button
                onClick={() => setActiveTab('today')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all animate-bounce"
                title={`${alertCount} dosi in attesa o in ritardo!`}
              >
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span className="hidden sm:inline">{alertCount} in attesa</span>
              </button>
            )}

            {/* Install PWA Button */}
            <button
              onClick={onOpenInstallModal}
              className="flex items-center gap-1.5 px-3 py-2 bg-sky-50 hover:bg-sky-100/80 text-sky-800 border border-sky-200 rounded-xl text-xs font-semibold transition-colors shadow-2xs"
              title="Installa su Android / iPhone"
            >
              <Smartphone className="w-4 h-4 text-sky-700" />
              <span className="hidden lg:inline">Installa App</span>
            </button>

            {/* Info / Author & License */}
            <button
              onClick={onOpenInfoModal}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
              title="Informazioni, Autore Nicola Cirillo, Licenza CC & Privacy"
              aria-label="Informazioni e licenza"
            >
              <Info className="w-5 h-5" />
            </button>

            {/* User Profile or Login button */}
            {currentUser ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  onMouseEnter={() => setIsUserMenuOpen(true)}
                  className="flex items-center gap-2 pl-2 border-l border-slate-200 cursor-pointer p-1.5 rounded-xl hover:bg-slate-50 transition-colors"
                  aria-expanded={isUserMenuOpen}
                  title="Menu profilo utente"
                >
                  <div className="w-8 h-8 rounded-xl bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs">
                    {currentUser.name ? currentUser.name.charAt(0) : 'U'}
                  </div>
                  <div className="hidden xl:block text-left">
                    <div className="text-xs font-bold text-slate-900 leading-tight">
                      {currentUser.name}
                    </div>
                    <div className="text-[10px] text-slate-500 capitalize">
                      {currentUser.role === 'superadmin' ? 'SuperAdmin' : currentUser.role}
                    </div>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 hidden sm:block transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180 text-sky-700' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isUserMenuOpen && (
                  <div
                    onMouseLeave={() => setIsUserMenuOpen(false)}
                    className="absolute right-0 top-full pt-1 w-64 z-50 animate-fade-in"
                  >
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-2">
                      <div className="p-2.5 border-b border-slate-100">
                        <div className="font-bold text-xs text-slate-900">{currentUser.name}</div>
                        <div className="text-[11px] text-slate-500 truncate" title={currentUser.email}>{currentUser.email}</div>
                        <div className="mt-1.5">
                          <span className="inline-block px-2 py-0.5 bg-sky-100 text-sky-800 text-[10px] font-bold rounded-md capitalize">
                            {currentUser.role === 'superadmin' ? 'Amministratore Generale' : (currentUser.isFamilyAdmin ? 'Familiare (Admin)' : 'Caregiver')}
                          </span>
                        </div>
                      </div>

                      <div className="p-1 space-y-0.5">
                        {onOpenProfileModal && (
                          <button
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              onOpenProfileModal();
                            }}
                            className="w-full text-left px-2.5 py-2 text-xs text-slate-700 hover:bg-slate-100 rounded-xl flex items-center gap-2 font-medium transition-colors"
                          >
                            <User className="w-3.5 h-3.5 text-sky-700" />
                            Modifica Profilo & Password
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            onLogout();
                          }}
                          className="w-full text-left px-2.5 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-2 font-medium transition-colors"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Esci dall'account
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                {onOpenAuthModal && (
                  <button
                    onClick={onOpenAuthModal}
                    className="px-3.5 py-1.5 bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                  >
                    Accedi o Registrati
                  </button>
                )}
              </div>
            )}

          </div>

        </div>

        {/* Mobile Bottom / Secondary Navigation Bar (only when logged in) */}
        {currentUser && (
          <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-100 bg-white">
            <button
              onClick={() => setActiveTab('today')}
              className={`flex flex-col items-center gap-1 py-1 px-3 text-[11px] font-semibold ${
                activeTab === 'today' ? 'text-sky-700' : 'text-slate-500'
              }`}
            >
              <div className="relative">
                <CalendarCheck className="w-5 h-5" />
                {alertCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-600 rounded-full animate-ping"></span>
                )}
              </div>
              <span>Oggi</span>
            </button>

            <button
              onClick={() => setActiveTab('therapies')}
              className={`flex flex-col items-center gap-1 py-1 px-3 text-[11px] font-semibold ${
                activeTab === 'therapies' ? 'text-sky-700' : 'text-slate-500'
              }`}
            >
              <Activity className="w-5 h-5" />
              <span>Terapie</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex flex-col items-center gap-1 py-1 px-3 text-[11px] font-semibold ${
                activeTab === 'history' ? 'text-sky-700' : 'text-slate-500'
              }`}
            >
              <ClipboardList className="w-5 h-5" />
              <span>Storico</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex flex-col items-center gap-1 py-1 px-3 text-[11px] font-semibold ${
                activeTab === 'settings' ? 'text-sky-700' : 'text-slate-500'
              }`}
            >
              <Settings className="w-5 h-5" />
              <span>Anagrafica</span>
            </button>

            {isSuperAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex flex-col items-center gap-1 py-1 px-3 text-[11px] font-semibold ${
                  activeTab === 'admin' ? 'text-purple-700' : 'text-slate-500'
                }`}
              >
                <Shield className="w-5 h-5" />
                <span>Admin</span>
              </button>
            )}
          </div>
        )}

      </div>
    </header>
  );
};
