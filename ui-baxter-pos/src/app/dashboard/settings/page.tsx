'use client';

import { useEffect, useState } from 'react';
import { logs, users, rbac } from '@/lib/api';
import {
  Settings as SettingsIcon,
  Activity,
  Users,
  Shield,
  CheckCircle2,
  Plus,
  Save,
  Trash2,
  Loader2,
  LayoutDashboard, ShoppingCart, Package, CreditCard, FileText, BarChart3, DollarSign, Briefcase
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const AVAILABLE_MENUS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/transactions', label: 'Transaksi', icon: ShoppingCart },
  { href: '/dashboard/services', label: 'Service', icon: Package },
  { href: '/dashboard/memberships', label: 'Membership', icon: Users },
  { href: '/dashboard/employees', label: 'Employees', icon: Briefcase },
  { href: '/dashboard/cashier', label: 'Kasir', icon: CreditCard },
  { href: '/dashboard/cashflow', label: 'Shift Management', icon: DollarSign },
  { href: '/dashboard/ledger', label: 'Ledger', icon: FileText },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3 },
  { href: '/dashboard/settings', label: 'Settings', icon: SettingsIcon },
];

const ROLES = ['admin', 'cashier', 'customer'];

const normalizeRoleConfig = (items: any[]) => {
  return ROLES.filter(role => role !== 'customer').map((role) => {
    const existing = items.find((item) => item.role === role);
    return {
      role,
      menus: Array.isArray(existing?.menus) ? existing.menus : [],
    };
  });
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(false);

  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [roleConfig, setRoleConfig] = useState<any[]>([]);

  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'cashier' });
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [savingRole, setSavingRole] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'users') {
        const res = await users.getAll();
        const items = res.data?.data ?? res.data;
        setUsersList(Array.isArray(items) ? items : []);
      }
      else if (activeTab === 'roles') {
        const res = await rbac.getRoles();
        setRoleConfig(normalizeRoleConfig(Array.isArray(res.data) ? res.data : []));
      }
      else if (activeTab === 'logs') {
        const res = await logs.getAll();
        setActivityLogs(Array.isArray(res.data) ? res.data : []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingUser(true);
    try {
      await users.create(newUser);
      toast.success('User berhasil dibuat!');
      setNewUser({ name: '', email: '', password: '', role: 'cashier' });
      setIsAddingUser(false);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal membuat user');
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
      if(!confirm("Yakin hapus user ini?")) return;
      setDeletingUserId(id);
      try {
          await users.delete(id);
          toast.success('User berhasil dihapus');
          loadData();
      } catch (error) {
          toast.error("Gagal menghapus user");
      } finally {
          setDeletingUserId(null);
      }
  };

  const handleToggleMenu = (roleName: string, menuHref: string) => {
    setRoleConfig(prev => {
      const existingRoleIndex = prev.findIndex(r => r.role === roleName);
      if (existingRoleIndex >= 0) {
        const newConfig = prev.map(role => ({
          ...role,
          menus: Array.isArray(role.menus) ? [...role.menus] : [],
        }));
        const currentMenus = newConfig[existingRoleIndex].menus;
        if (currentMenus.includes(menuHref)) {
          newConfig[existingRoleIndex].menus = currentMenus.filter((m: string) => m !== menuHref);
        } else {
          newConfig[existingRoleIndex].menus = [...currentMenus, menuHref];
        }
        return newConfig;
      } else {
        return [...prev, { role: roleName, menus: [menuHref] }];
      }
    });
  };

  const handleSaveRoleConfig = async (roleName: string) => {
    const roleData = roleConfig.find(r => r.role === roleName) || { role: roleName, menus: [] };
    setSavingRole(roleName);
    try {
      await rbac.updateRole(roleData);
      toast.success(`Akses untuk role ${roleName} berhasil disimpan!`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal menyimpan konfigurasi role');
    } finally {
      setSavingRole(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
            <p className="text-gray-500">Manage access control & system logs</p>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-500 bg-gray-50 px-4 py-2 rounded-lg border">
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span>System Online</span>
             </div>
             <div className="w-[1px] h-4 bg-gray-300"></div>
             <span>v1.2.0</span>
          </div>
        </div>

        <div className="flex overflow-x-auto">
          {[
            { id: 'users', label: 'User Management', icon: Users },
            { id: 'roles', label: 'Role Access', icon: Shield },
            { id: 'logs', label: 'Activity Logs', icon: Activity },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-6 py-4 font-medium text-sm transition-colors border-b-2 whitespace-nowrap
                ${activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}
              `}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin h-8 w-8 text-blue-600"/>
        </div>
      ) : (
        <>
          {/* TAB: USER MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
                <div
                  className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition"
                  onClick={() => setIsAddingUser(!isAddingUser)}
                >
                  <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                    <Plus size={18} className="text-blue-600"/> Add New User
                  </h3>
                </div>

                {isAddingUser && (
                  <form onSubmit={handleCreateUser} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                    <input
                      placeholder="Full Name" required
                      className="border p-2.5 rounded-lg"
                      value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})}
                    />
                    <input
                      type="email" placeholder="Email Address" required
                      className="border p-2.5 rounded-lg"
                      value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})}
                    />
                    <input
                      type="password" placeholder="Password" required
                      className="border p-2.5 rounded-lg"
                      value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})}
                    />
                    <select
                      className="border p-2.5 rounded-lg"
                      value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
                    </select>
                    <div className="md:col-span-2 flex justify-end gap-2">
                      <button type="button" disabled={isSubmittingUser} onClick={() => setIsAddingUser(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">Batal</button>
                      <button type="submit" disabled={isSubmittingUser} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 active:bg-blue-800 shadow-sm transition disabled:opacity-50 flex items-center gap-2">
                          {isSubmittingUser ? <><Loader2 size={16} className="animate-spin"/> Menyimpan...</> : 'Simpan User'}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 text-sm text-gray-500 font-semibold border-b">
                    <tr>
                      <th className="p-4">User</th>
                      <th className="p-4">Role</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {usersList.map((u) => {
                      const isDeleting = deletingUserId === u.id;
                      return (
                      <tr key={u.id} className={`hover:bg-gray-50 transition ${isDeleting ? 'opacity-50' : ''}`}>
                        <td className="p-4">
                          <p className="font-bold text-gray-800">{u.name}</p>
                          <p className="text-xs text-gray-500">{u.email}</p>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider
                            ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                              u.role === 'cashier' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}
                          `}>
                            {u.role}
                          </span>
                        </td>
                        <td className="p-4"><span className="text-green-600 font-medium flex items-center gap-1"><CheckCircle2 size={14}/> Active</span></td>
                        <td className="p-4 text-right">
                          <button onClick={() => handleDeleteUser(u.id)} disabled={isDeleting} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50">
                              {isDeleting ? <Loader2 size={18} className="animate-spin"/> : <Trash2 size={18} />}
                          </button>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: ROLE ACCESS (RBAC) */}
          {activeTab === 'roles' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {ROLES.filter(r => r !== 'customer').map((role) => {
                const config = roleConfig.find(c => c.role === role);
                const roleMenus = config?.menus || [];
                const isSaving = savingRole === role;

                return (
                  <div key={role} className="bg-white rounded-2xl shadow-soft overflow-hidden">
                    <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Shield className={role === 'admin' ? 'text-purple-600' : 'text-blue-600'} size={20} />
                        <h3 className="font-bold text-gray-700 capitalize">{role} Access</h3>
                      </div>
                      <button
                        onClick={() => handleSaveRoleConfig(role)}
                        disabled={isSaving}
                        className="flex items-center gap-1 text-xs font-bold bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition disabled:opacity-50"
                      >
                        {isSaving ? <><Loader2 size={14} className="animate-spin"/> SAVING...</> : <><Save size={14} /> SAVE CHANGES</>}
                      </button>
                    </div>

                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {AVAILABLE_MENUS.map((menu) => {
                        const isChecked = roleMenus.includes(menu.href);
                        return (
                          <button
                            type="button"
                            key={menu.href}
                            onClick={() => handleToggleMenu(role, menu.href)}
                            aria-pressed={isChecked}
                            className={`
                              flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all text-left
                              focus:outline-none focus:ring-2 focus:ring-blue-200
                              ${isChecked
                                ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500'
                                : 'border-gray-200 bg-white hover:border-blue-300 text-slate-700 hover:bg-blue-50/40'}
                            `}
                          >
                            <div className={`
                              w-5 h-5 rounded border flex items-center justify-center transition-colors
                              ${isChecked ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 bg-white'}
                            `}>
                              {isChecked && <CheckCircle2 size={14} />}
                            </div>
                            <div className="flex items-center gap-2">
                                <menu.icon size={16} className={isChecked ? 'text-blue-600' : 'text-gray-400'}/>
                                <span className="text-sm font-medium">{menu.label}</span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* TAB: LOGS */}
          {activeTab === 'logs' && (
             <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
               <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500 font-medium border-b sticky top-0">
                    <tr>
                      <th className="p-3">Time</th>
                      <th className="p-3">User</th>
                      <th className="p-3">Action</th>
                      <th className="p-3">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {activityLogs.length === 0 ? (
                        <tr><td colSpan={4} className="p-8 text-center text-gray-400">Belum ada log aktivitas.</td></tr>
                    ) : (
                        activityLogs.map((log: any) => (
                        <tr key={log.id} className="hover:bg-gray-50">
                            <td className="p-3 text-gray-500 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                            <td className="p-3 font-medium">{log.user?.name || 'System'}</td>
                            <td className="p-3"><span className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">{log.action}</span></td>
                            <td className="p-3 text-gray-600">{log.description}</td>
                        </tr>
                        ))
                    )}
                  </tbody>
               </table>
             </div>
          )}
        </>
      )}
    </div>
  );
}
