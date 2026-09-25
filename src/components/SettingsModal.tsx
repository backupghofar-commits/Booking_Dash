import React, { useRef, useState } from 'react';
import {
  Settings,
  Building2,
  CreditCard,
  Download,
  Upload,
  Database,
  Check,
  Save,
  X,
  Image as ImageIcon,
  Users,
  Plus,
  Trash2,
  Sun,
  Moon,
  Sparkles,
  ChevronDown,
  ScrollText,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { CompanySettings, Booking } from '../types/booking';

interface SettingsModalProps {
  settings: CompanySettings;
  bookings: Booking[];
  darkMode: boolean;
  setDarkMode: (mode: boolean) => void;
  onSaveSettings: (newSettings: CompanySettings) => void;
  onRestoreBookings: (bookings: Booking[]) => void;
  onResetData: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  bookings,
  darkMode,
  setDarkMode,
  onSaveSettings,
  onRestoreBookings,
  onResetData,
  onClose,
}) => {
  const [formData, setFormData] = useState<CompanySettings>({
    ...settings,
    staffMembers: settings.staffMembers || ['Hafiz Rahmani', 'Amina Al-Mansoor', 'Staff Administrator'],
    defaultStaffName: settings.defaultStaffName || 'Hafiz Rahmani',
  });
  const [newStaffInput, setNewStaffInput] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Scroll state — signals hidden content below the visible window
  const bodyRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [atBottom, setAtBottom] = useState(false);

  const handleScroll = () => {
    const el = bodyRef.current;
    if (!el) return;
    setScrolled(el.scrollTop > 8);
    setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 8);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 900);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file (PNG, JPG, WebP).');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => setFormData((prev) => ({ ...prev, logoUrl: event.target?.result as string }));
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => setFormData((prev) => ({ ...prev, logoUrl: '' }));

  const handleAddStaff = () => {
    const trimmed = newStaffInput.trim();
    if (trimmed && !formData.staffMembers.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      setFormData((prev) => ({
        ...prev,
        staffMembers: [...prev.staffMembers, { id: `st-${Date.now()}`, name: trimmed, role: newStaffRole.trim() }],
      }));
    }
    setNewStaffInput('');
    setNewStaffRole('');
  };

  const handleUpdateStaff = (id: string, patch: Partial<{ name: string; role: string }>) => {
    setFormData((prev) => ({
      ...prev,
      staffMembers: prev.staffMembers.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  };

  const handleRemoveStaff = (id: string) => {
    setFormData((prev) => {
      const remaining = prev.staffMembers.filter((s) => s.id !== id);
      const removed = prev.staffMembers.find((s) => s.id === id);
      return {
        ...prev,
        staffMembers: remaining,
        defaultStaffName:
          removed && prev.defaultStaffName === removed.name ? remaining[0]?.name || 'Staff Officer' : prev.defaultStaffName,
      };
    });
  };

  const handleExportJSON = () => {
    const backupData = { settings: formData, bookings, exportDate: new Date().toISOString() };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `TAMIMA_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], 'UTF-8');
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed.settings) onSaveSettings(parsed.settings);
          if (parsed.bookings && Array.isArray(parsed.bookings)) onRestoreBookings(parsed.bookings);
          alert('Database restored successfully!');
          onClose();
        } catch {
          alert('Invalid backup JSON file.');
        }
      };
    }
  };

  const labelCls = 'block font-semibold text-slate-700 dark:text-slate-300 mb-1';
  const inputCls =
    'w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs';
  const sectionTitle =
    'font-bold uppercase text-[11px] border-b border-slate-100 dark:border-slate-800 pb-1 flex items-center space-x-1.5';

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 relative">
        {/* ===== Sticky header ===== */}
        <div className="flex justify-between items-center px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 rounded-xl">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold">Company Settings & Branding</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Logo, registration, issuing staff, FX rate & theme
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ===== Scrollable body ===== */}
        <div
          ref={bodyRef}
          onScroll={handleScroll}
          className={`overflow-y-auto px-6 py-5 space-y-6 text-xs relative transition-all ${scrolled ? 'shadow-[inset_0_10px_12px_-10px_rgba(15,23,42,0.25)]' : ''}`}
        >
          <form id="settings-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Theme switch */}
            <div className="bg-slate-100 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <div>
                  <span className="font-bold block text-slate-900 dark:text-white">App Display Theme Mode</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Switch Light / Dark for eye comfort</span>
                </div>
              </div>
              <div className="flex items-center bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-300 dark:border-slate-700 font-bold">
                <button
                  type="button"
                  onClick={() => setDarkMode(false)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${!darkMode ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-500'}`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>Light</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDarkMode(true)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${darkMode ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500'}`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>Dark</span>
                </button>
              </div>
            </div>

            {/* ===== Application Branding (PWA) ===== */}
            <div className="space-y-3">
              <h3 className={`${sectionTitle} text-indigo-700 dark:text-indigo-400`}>
                <Smartphone className="w-4 h-4" />
                <span>Application Branding — PWA Install & Icon</span>
              </h3>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Application Name</label>
                    <input
                      type="text"
                      value={formData.appName || 'TAMIMA Hotel Booking'}
                      onChange={(e) => setFormData({ ...formData, appName: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Short Application Name</label>
                    <input
                      type="text"
                      value={formData.shortName || 'TAMIMA Hotel'}
                      onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Application Description</label>
                    <input
                      type="text"
                      value={formData.appDescription || 'TAMIMA Hotel Booking Management System'}
                      onChange={(e) => setFormData({ ...formData, appDescription: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Theme Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.themeColor || '#0B1F3A'}
                        onChange={(e) => setFormData({ ...formData, themeColor: e.target.value })}
                        className="h-9 w-12 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.themeColor || '#0B1F3A'}
                        onChange={(e) => setFormData({ ...formData, themeColor: e.target.value })}
                        className={`${inputCls} font-mono`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Background Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.backgroundColor || '#ffffff'}
                        onChange={(e) => setFormData({ ...formData, backgroundColor: e.target.value })}
                        className="h-9 w-12 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.backgroundColor || '#ffffff'}
                        onChange={(e) => setFormData({ ...formData, backgroundColor: e.target.value })}
                        className={`${inputCls} font-mono`}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Import Audit Tolerance (SAR)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.importToleranceSAR ?? 0.01}
                      onChange={(e) => setFormData({ ...formData, importToleranceSAR: Number(e.target.value) })}
                      className={`${inputCls} font-mono`}
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Selisih Source vs Calculated yang masih dianggap VALID pada audit import.
                    </p>
                  </div>
                </div>

                {/* App icon upload */}
                <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
                  <div className="relative flex-shrink-0">
                    <img
                      src={formData.appIconUrl || '/icons/icon-512.png'}
                      alt="App icon"
                      className="w-16 h-16 object-cover rounded-2xl border border-slate-300 dark:border-slate-700 shadow"
                    />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <span className="font-bold text-slate-900 dark:text-white block">Application Icon / Favicon (PNG)</span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Rekomendasi 512×512 PNG persegi. Otomatis dipakai sebagai favicon browser, ikon home-screen Android, ikon aplikasi PWA, dan shortcut desktop — seluruh ukuran (16–512) digenerate otomatis.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <label className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg cursor-pointer text-xs transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Icon PNG</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            const reader = new FileReader();
                            reader.onload = (ev) => setFormData({ ...formData, appIconUrl: ev.target?.result as string });
                            reader.readAsDataURL(f);
                          }}
                          className="hidden"
                        />
                      </label>
                      {formData.appIconUrl && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, appIconUrl: '' })}
                          className="text-rose-600 hover:underline font-semibold text-xs"
                        >
                          Hapus
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            appName: 'TAMIMA Hotel Booking',
                            shortName: 'TAMIMA Hotel',
                            appDescription: 'TAMIMA Hotel Booking Management System',
                            themeColor: '#0B1F3A',
                            backgroundColor: '#ffffff',
                            appIconUrl: '',
                          })
                        }
                        className="ml-auto text-slate-500 hover:text-slate-800 dark:hover:text-white font-semibold text-xs"
                      >
                        Reset to Default
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Logo upload */}
            <div className="space-y-3">
              <h3 className={`${sectionTitle} text-emerald-700 dark:text-emerald-400`}>
                <ImageIcon className="w-4 h-4" />
                <span>Company Logo (PNG) — for Navbar, Vouchers & Exports</span>
              </h3>
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                {formData.logoUrl ? (
                  <div className="relative flex-shrink-0">
                    <img
                      src={formData.logoUrl}
                      alt="Logo"
                      className="w-24 h-16 object-contain bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2 shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="absolute -top-2 -right-2 bg-rose-600 text-white p-1 rounded-full shadow hover:bg-rose-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-24 h-16 bg-slate-200 dark:bg-slate-700 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl flex items-center justify-center text-slate-400 flex-shrink-0">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                )}
                <div className="space-y-1.5 flex-1">
                  <span className="font-bold text-slate-900 dark:text-white block">Upload Company Logo (.png recommended)</span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Auto appears on header navbar, printable confirmation letter, PDF & Word exports.
                  </p>
                  <div className="flex items-center space-x-2 pt-1">
                    <label className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg cursor-pointer text-xs">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Select Image File</span>
                      <input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleLogoUpload} className="hidden" />
                    </label>
                    {formData.logoUrl && (
                      <button type="button" onClick={handleRemoveLogo} className="text-rose-600 hover:underline font-semibold text-xs">
                        Remove Logo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Authorized Stamp upload */}
            <div className="space-y-3">
              <h3 className={`${sectionTitle} text-orange-600 dark:text-orange-400`}>
                <ShieldCheck className="w-4 h-4" />
                <span>Authorized Company Stamp (PNG) — for Voucher & Report Signature</span>
              </h3>
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                {formData.stampUrl ? (
                  <div className="relative flex-shrink-0">
                    <img
                      src={formData.stampUrl}
                      alt="Stamp"
                      className="w-20 h-20 object-contain bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-full p-1.5 shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, stampUrl: '' }))}
                      className="absolute -top-2 -right-2 bg-rose-600 text-white p-1 rounded-full shadow hover:bg-rose-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-20 h-20 bg-slate-200 dark:bg-slate-700 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-full flex items-center justify-center text-slate-400 flex-shrink-0">
                    <ShieldCheck className="w-7 h-7" />
                  </div>
                )}
                <div className="space-y-1.5 flex-1">
                  <span className="font-bold text-slate-900 dark:text-white block">Upload Stempel Resmi Perusahaan</span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    PNG transparan disarankan. Otomatis tampil sebagai stempel otorisasi pada Confirmation Letter, PDF & Finance Report menggantikan placeholder.
                  </p>
                  <div className="flex items-center space-x-2 pt-1">
                    <label className="flex items-center space-x-1.5 bg-orange-500 hover:bg-orange-600 text-white font-bold px-3 py-1.5 rounded-lg cursor-pointer text-xs transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Select Stamp Image</span>
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => setFormData((prev) => ({ ...prev, stampUrl: ev.target?.result as string }));
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                    {formData.stampUrl && (
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, stampUrl: '' }))}
                        className="text-rose-600 hover:underline font-semibold text-xs"
                      >
                        Remove Stamp
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ===== Company Information & Registration (now includes CL branding) ===== */}
            <div className="space-y-3">
              <h3 className={`${sectionTitle} text-emerald-700 dark:text-emerald-400`}>
                <Building2 className="w-4 h-4" />
                <span>Company Information, Registration & Confirmation Letter Branding</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Legal Entity Name (PT) *</label>
                  <input
                    type="text"
                    value={formData.legalEntityName || ''}
                    onChange={(e) => setFormData({ ...formData, legalEntityName: e.target.value })}
                    placeholder="PT. TAMIMA JAYA WISATA"
                    className={`${inputCls} font-bold`}
                  />
                </div>
                <div>
                  <label className={labelCls}>Company Name</label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className={`${inputCls} font-bold`}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Tagline / Motto</label>
                  <input
                    type="text"
                    value={formData.tagline}
                    onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>CR Number (Saudi Arabia)</label>
                  <input
                    type="text"
                    value={formData.crNumber}
                    onChange={(e) => setFormData({ ...formData, crNumber: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>License Number</label>
                  <input
                    type="text"
                    value={formData.licenseNumber}
                    onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Saudi Office Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Indonesia Office Address (Confirmation Letter)</label>
                  <input
                    type="text"
                    value={formData.indonesiaAddress || ''}
                    onChange={(e) => setFormData({ ...formData, indonesiaAddress: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>WhatsApp Numbers (CL header)</label>
                  <input
                    type="text"
                    value={formData.waPhone || ''}
                    onChange={(e) => setFormData({ ...formData, waPhone: e.target.value })}
                    placeholder="+62 813-... | +62 852-..."
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Website</label>
                  <input
                    type="text"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>
            </div>

            {/* ===== Staff Officers + Authorized Signatory ===== */}
            <div className="space-y-3">
              <h3 className={`${sectionTitle} text-emerald-700 dark:text-emerald-400`}>
                <Users className="w-4 h-4" />
                <span>Editable Issuing Staff Officers & Authorized Signatory</span>
              </h3>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                {/* Column headers */}
                <div className="grid grid-cols-12 gap-2 text-[9px] font-black uppercase tracking-wider text-slate-400 px-0.5">
                  <span className="col-span-5">Nama Officer</span>
                  <span className="col-span-5">Role / Jabatan</span>
                  <span className="col-span-2 text-right">Aksi</span>
                </div>

                {/* Editable rows: manual Name & Role */}
                <div className="space-y-2">
                  {formData.staffMembers.map((staff) => (
                    <div key={staff.id} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5 relative">
                        <input
                          type="text"
                          value={staff.name}
                          onChange={(e) => handleUpdateStaff(staff.id, { name: e.target.value })}
                          placeholder="Nama lengkap..."
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold pr-14"
                        />
                        {formData.defaultStaffName === staff.name && (
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300 text-[8px] font-black px-1.5 py-0.5 rounded">
                            DEFAULT
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={staff.role}
                        onChange={(e) => handleUpdateStaff(staff.id, { role: e.target.value })}
                        placeholder="e.g. Sales Executive"
                        className="col-span-5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                      />
                      <div className="col-span-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveStaff(staff.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-colors"
                          title="Hapus officer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add new officer */}
                <div className="grid grid-cols-12 gap-2 items-center pt-1 border-t border-dashed border-slate-300 dark:border-slate-700">
                  <input
                    type="text"
                    value={newStaffInput}
                    onChange={(e) => setNewStaffInput(e.target.value)}
                    placeholder="Nama officer baru..."
                    className="col-span-5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium"
                  />
                  <input
                    type="text"
                    value={newStaffRole}
                    onChange={(e) => setNewStaffRole(e.target.value)}
                    placeholder="Role..."
                    className="col-span-5 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium"
                  />
                  <button
                    type="button"
                    onClick={handleAddStaff}
                    className="col-span-2 flex items-center justify-center space-x-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-1.5 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="text-[10px]">Add</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <div>
                    <label className={labelCls}>Default Issuing Officer</label>
                    <select
                      value={formData.defaultStaffName}
                      onChange={(e) => setFormData({ ...formData, defaultStaffName: e.target.value })}
                      className={inputCls}
                    >
                      {formData.staffMembers.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name} {s.role ? `— ${s.role}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Authorized Manager (Signature)</label>
                    <input
                      type="text"
                      value={formData.bookingManagerName || ''}
                      onChange={(e) => setFormData({ ...formData, bookingManagerName: e.target.value })}
                      placeholder="GHOFAR"
                      className={`${inputCls} font-bold`}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Manager Role</label>
                    <input
                      type="text"
                      value={formData.bookingManagerRole || ''}
                      onChange={(e) => setFormData({ ...formData, bookingManagerRole: e.target.value })}
                      placeholder="Booking Manager"
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bank accounts */}
            <div className="space-y-3">
              <h3 className={`${sectionTitle} text-emerald-700 dark:text-emerald-400`}>
                <CreditCard className="w-4 h-4" />
                <span>Official Bank Accounts (Voucher Payment Note)</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <label className={labelCls}>Saudi Bank & IBAN</label>
                  <input
                    type="text"
                    value={formData.bankDetails.saudiBank}
                    onChange={(e) => setFormData({ ...formData, bankDetails: { ...formData.bankDetails, saudiBank: e.target.value } })}
                    className={`${inputCls} mb-1`}
                  />
                  <input
                    type="text"
                    value={formData.bankDetails.saudiIban}
                    onChange={(e) => setFormData({ ...formData, bankDetails: { ...formData.bankDetails, saudiIban: e.target.value } })}
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <div>
                  <label className={labelCls}>Bank Mandiri (a/n & No. Rek)</label>
                  <input
                    type="text"
                    value={formData.bankDetails.mandiriAccountName || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, bankDetails: { ...formData.bankDetails, mandiriAccountName: e.target.value } })
                    }
                    placeholder="PT. TAMIMA JAYA WISATA"
                    className={`${inputCls} mb-1`}
                  />
                  <input
                    type="text"
                    value={formData.bankDetails.mandiriAccountNumber || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, bankDetails: { ...formData.bankDetails, mandiriAccountNumber: e.target.value } })
                    }
                    placeholder="1370080001686"
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Indonesia Bank (BCA/Mandiri alt)</label>
                  <input
                    type="text"
                    value={formData.bankDetails.indonesiaBank}
                    onChange={(e) =>
                      setFormData({ ...formData, bankDetails: { ...formData.bankDetails, indonesiaBank: e.target.value } })
                    }
                    className={`${inputCls} mb-1`}
                  />
                  <input
                    type="text"
                    value={formData.bankDetails.indonesiaAccount}
                    onChange={(e) =>
                      setFormData({ ...formData, bankDetails: { ...formData.bankDetails, indonesiaAccount: e.target.value } })
                    }
                    className={`${inputCls} font-mono`}
                  />
                </div>
              </div>
            </div>

            {/* Terms */}
            <div>
              <label className="block font-bold uppercase text-[11px] mb-1">Voucher Terms & Conditions</label>
              <textarea
                value={formData.termsAndConditions}
                onChange={(e) => setFormData({ ...formData, termsAndConditions: e.target.value })}
                rows={3}
                className={`${inputCls} font-mono text-[11px]`}
              />
            </div>

            {/* Database */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <h4 className="font-bold uppercase text-[11px] flex items-center space-x-1.5">
                <Database className="w-4 h-4 text-emerald-600" />
                <span>Database Tools & Data Backup</span>
              </h4>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Export Backup (JSON)</span>
                </button>
                <label className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Restore Backup (JSON)</span>
                  <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Reset database to default sample records?')) {
                      onResetData();
                      onClose();
                    }
                  }}
                  className="text-rose-600 hover:underline font-semibold ml-auto"
                >
                  Reset Sample Data
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Hidden-content indicator */}
        {!atBottom && (
          <button
            onClick={() => bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })}
            className="absolute left-1/2 -translate-x-1/2 bottom-[68px] flex items-center space-x-1 bg-slate-900/90 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg border border-slate-700 animate-bounce"
          >
            <ScrollText className="w-3 h-3 text-amber-400" />
            <span>More settings below</span>
            <ChevronDown className="w-3 h-3" />
          </button>
        )}

        {/* ===== Sticky footer ===== */}
        <div className="flex justify-end space-x-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex-shrink-0 bg-white dark:bg-slate-900 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="settings-form"
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-xl shadow"
          >
            {savedSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{savedSuccess ? 'Saved!' : 'Save Settings'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
