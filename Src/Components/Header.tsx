import React from 'react';
import { 
  Building2, 
  Plus, 
  LayoutDashboard, 
  BookOpen, 
  Settings, 
  RefreshCw, 
  Wifi, 
  Receipt,
  Sun,
  Moon,
  BarChart3,
  CalendarDays,
  Boxes,
  TrainFront
} from 'lucide-react';
import { CompanySettings } from '../types/booking';
import { RiyalIcon } from './RiyalIcon';
import type { LiveExchangeRate } from '../utils/exchangeRate';

interface HeaderProps {
  activeTab:
    | 'dashboard'
    | 'bookings'
    | 'reports'
    | 'calendar'
    | 'management'
    | 'train'
    | 'new-booking'
    | 'settings';
  setActiveTab: (
    tab:
      | 'dashboard'
      | 'bookings'
      | 'reports'
      | 'calendar'
      | 'management'
      | 'train'
      | 'new-booking'
      | 'settings'
  ) => void;
  settings: CompanySettings;
  liveRate: LiveExchangeRate;
  openSettings: () => void;
  currencyView: 'DUAL' | 'SAR' | 'IDR';
  setCurrencyView: (view: 'DUAL' | 'SAR' | 'IDR') => void;
  darkMode: boolean;
  setDarkMode: (mode: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  settings,
  liveRate,
  openSettings,
  currencyView,
  setCurrencyView,
  darkMode,
  setDarkMode,
}) => {
  return (
    <header className="bg-slate-900 text-white shadow-xl border-b border-emerald-900/40 sticky top-0 z-40">
      {/* Top Bar for company branding & FX Rate status */}
      <div className="bg-slate-950 px-4 py-1.5 text-xs border-b border-slate-800 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center space-x-3 text-slate-300">
          <span className="flex items-center font-medium text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-1.5"></span>
            {settings.companyName}
          </span>
          <span className="hidden md:inline text-slate-600">|</span>
          <span className="hidden md:inline text-slate-400">CR: {settings.crNumber}</span>
          <span className="hidden md:inline text-slate-600">|</span>
          <span className="hidden md:inline text-slate-400">Lic: {settings.licenseNumber}</span>
        </div>

        <div className="flex items-center space-x-3 ml-auto">
          {/* Exchange Rate Badge */}
          <a
            href="https://www.bankmandiri.co.id/kurs"
            target="_blank"
            rel="noreferrer"
            className="flex items-center space-x-1.5 bg-emerald-950/80 text-emerald-300 hover:text-emerald-200 border border-emerald-800/60 px-2.5 py-0.5 rounded-full text-xs transition-colors hover:bg-emerald-900/80"
            title={`${liveRate.source} · updated ${liveRate.updatedAt}${liveRate.stale ? ' · cached/fallback' : ''}`}
          >
            <RefreshCw className={`w-3 h-3 text-emerald-400 ${liveRate.stale ? '' : 'animate-spin [animation-duration:4s]'}`} />
            <span>
              1 SAR = <strong>{liveRate.rate.toLocaleString('id-ID')} IDR</strong>
              <span className="hidden lg:inline text-[9px] text-emerald-500 ml-1">
                · Mandiri Bank Notes Jual{liveRate.stale ? ' (cached)' : ' · LIVE'}
              </span>
            </span>
          </a>

          {/* Currency Display Selector */}
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-[11px]">
            <button
              onClick={() => setCurrencyView('DUAL')}
              className={`px-2 py-0.5 rounded-md font-semibold transition-all ${
                currencyView === 'DUAL'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              DUAL
            </button>
            <button
              onClick={() => setCurrencyView('SAR')}
              className={`flex items-center space-x-1 px-2 py-0.5 rounded-md font-semibold transition-all ${
                currencyView === 'SAR'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <RiyalIcon className="w-3 h-3" />
              <span>SAR</span>
            </button>
            <button
              onClick={() => setCurrencyView('IDR')}
              className={`px-2 py-0.5 rounded-md font-semibold transition-all ${
                currencyView === 'IDR'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Rp IDR
            </button>
          </div>

          {/* Theme Toggle Sun/Moon */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 px-2.5 py-0.5 rounded-full text-xs transition-colors"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {darkMode ? <Sun className="w-3.5 h-3.5 text-amber-300" /> : <Moon className="w-3.5 h-3.5 text-slate-300" />}
            <span className="hidden sm:inline text-[11px] text-slate-200">{darkMode ? 'Light' : 'Dark'}</span>
          </button>

          {/* Offline/Local DB indicator */}
          <div className="hidden sm:flex items-center space-x-1 text-slate-400 bg-slate-800/70 px-2 py-0.5 rounded border border-slate-700">
            <Wifi className="w-3 h-3 text-emerald-400" />
            <span className="text-[10px]">Local DB Saved</span>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div 
            onClick={() => setActiveTab('dashboard')} 
            className="flex items-center space-x-3 cursor-pointer group"
          >
            {settings.logoUrl ? (
              <div className="h-10 max-w-[150px] flex items-center bg-white/10 p-1 rounded-xl border border-slate-700/50 group-hover:scale-105 transition-transform">
                <img
                  src={settings.logoUrl}
                  alt={settings.companyName}
                  className="max-h-full max-w-full object-contain rounded-lg"
                />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-amber-500 p-0.5 shadow-lg group-hover:scale-105 transition-transform">
                <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
            )}
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-xl font-black tracking-tight text-white font-sans">
                  {settings.companyName.split(' ')[0] || 'TAMIMA'}
                </span>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium leading-none">
                {settings.tagline || 'Hotel Booking & Profitability Engine'}
              </p>
            </div>
          </div>

          {/* Navigation Buttons */}
          <nav className="hidden xl:flex items-center space-x-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg font-medium text-sm transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('bookings')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg font-medium text-sm transition-all ${
                activeTab === 'bookings'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Bookings</span>
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg font-medium text-sm transition-all ${
                activeTab === 'reports'
                  ? 'bg-orange-500 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Reports</span>
            </button>

            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg font-medium text-sm transition-all ${
                activeTab === 'calendar'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              <span>Calendar</span>
            </button>

            <button
              onClick={() => setActiveTab('train')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg font-medium text-sm transition-all ${
                activeTab === 'train'
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <TrainFront className="w-4 h-4" />
              <span>Haramain Train</span>
            </button>

            <button
              onClick={() => setActiveTab('management')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg font-medium text-sm transition-all ${
                activeTab === 'management'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Boxes className="w-4 h-4" />
              <span>Management</span>
            </button>

            <button
              onClick={openSettings}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg font-medium text-sm transition-all ${
                activeTab === 'settings'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings & FX</span>
            </button>
          </nav>

          {/* CTA Button: New Booking */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('new-booking')}
              className="flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold px-4 py-2 rounded-xl shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 transition-all text-sm transform active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>New Booking</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Tab Bar */}
      <div className="xl:hidden flex border-t border-slate-800 bg-slate-950 px-2 py-1 justify-around text-xs">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center py-1 px-2 rounded ${
            activeTab === 'dashboard' ? 'text-emerald-400 font-bold' : 'text-slate-400'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 mb-0.5" />
          <span>Dashboard</span>
        </button>
        <button
          onClick={() => setActiveTab('bookings')}
          className={`flex flex-col items-center py-1 px-2 rounded ${
            activeTab === 'bookings' ? 'text-emerald-400 font-bold' : 'text-slate-400'
          }`}
        >
          <BookOpen className="w-4 h-4 mb-0.5" />
          <span>Bookings</span>
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex flex-col items-center py-1 px-2 rounded ${
            activeTab === 'reports' ? 'text-orange-400 font-bold' : 'text-slate-400'
          }`}
        >
          <BarChart3 className="w-4 h-4 mb-0.5" />
          <span>Reports</span>
        </button>
        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex flex-col items-center py-1 px-2 rounded ${
            activeTab === 'calendar' ? 'text-emerald-400 font-bold' : 'text-slate-400'
          }`}
        >
          <CalendarDays className="w-4 h-4 mb-0.5" />
          <span>Calendar</span>
        </button>
        <button
          onClick={() => setActiveTab('train')}
          className={`flex flex-col items-center py-1 px-2 rounded ${
            activeTab === 'train' ? 'text-sky-400 font-bold' : 'text-slate-400'
          }`}
        >
          <TrainFront className="w-4 h-4 mb-0.5" />
          <span>Train</span>
        </button>
        <button
          onClick={() => setActiveTab('management')}
          className={`flex flex-col items-center py-1 px-2 rounded ${
            activeTab === 'management' ? 'text-emerald-400 font-bold' : 'text-slate-400'
          }`}
        >
          <Boxes className="w-4 h-4 mb-0.5" />
          <span>Master</span>
        </button>
      </div>
    </header>
  );
};
