'use client';

import { useEffect, useState } from 'react';
import { services as servicesApi, categories as categoriesApi } from '@/lib/api';
import { Plus, Edit, Trash2, Award, Crown, Percent, Loader2, Tag } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Category {
  id: number;
  slug: string;
  name: string;
  type: 'service' | 'membership';
  sort_order: number;
  is_active: boolean;
}

export default function Services() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'service' | 'membership' | 'category'>('service');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(null);
  const [catFormData, setCatFormData] = useState({
    slug: '',
    name: '',
    type: 'service' as 'service' | 'membership',
    sort_order: 0,
    is_active: true,
  });

  const [formData, setFormData] = useState({
    name: '',
    category: 'carwash',
    description: '',
    price: 0,
    duration: 30,
    duration_months: 1,
    points_awarded: 0,
    member_discount_pct: 0,
    is_active: true,
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [svcRes, catRes] = await Promise.all([servicesApi.getAll(), categoriesApi.getAll()]);
      setData(Array.isArray(svcRes.data) ? svcRes.data : []);
      setAllCategories(Array.isArray(catRes.data) ? catRes.data : []);
    } catch {
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = { ...formData };
      const selectedCat = allCategories.find(c => c.slug === payload.category);
      if (selectedCat?.type === 'membership') {
        payload.duration = 0;
        payload.member_discount_pct = 0;
      } else {
        payload.duration_months = 0;
      }
      if (editingId) {
        await servicesApi.update(editingId, payload);
        toast.success('Data berhasil diupdate!');
      } else {
        await servicesApi.create(payload);
        toast.success('Data berhasil ditambahkan!');
      }
      setShowServiceForm(false);
      setEditingId(null);
      resetServiceForm();
      loadAll();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (item: any) => {
    setFormData({
      name: item.name,
      category: item.category,
      description: item.description || '',
      price: item.price,
      duration: item.duration || 0,
      duration_months: item.duration_months || 1,
      points_awarded: item.points_awarded || 0,
      member_discount_pct: item.member_discount_pct || 0,
      is_active: item.is_active,
    });
    setEditingId(item.id);
    setShowServiceForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus item ini?')) return;
    setDeletingId(id);
    try {
      await servicesApi.delete(id);
      toast.success('Berhasil dihapus');
      loadAll();
    } catch {
      toast.error('Gagal menghapus');
    } finally {
      setDeletingId(null);
    }
  };

  const resetServiceForm = () => {
    const defaultCat = allCategories.find(c => c.type === 'service' && c.is_active);
    setFormData({
      name: '',
      category: activeTab === 'membership' ? 'membership' : (defaultCat?.slug || 'carwash'),
      description: '',
      price: 0,
      duration: 30,
      duration_months: 1,
      points_awarded: 0,
      member_discount_pct: 0,
      is_active: true,
    });
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingCategoryId) {
        await categoriesApi.update(editingCategoryId, catFormData);
        toast.success('Kategori berhasil diupdate!');
      } else {
        await categoriesApi.create(catFormData);
        toast.success('Kategori berhasil ditambahkan!');
      }
      setShowCategoryForm(false);
      setEditingCategoryId(null);
      resetCategoryForm();
      loadAll();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal menyimpan kategori');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditCategory = (cat: Category) => {
    setCatFormData({
      slug: cat.slug,
      name: cat.name,
      type: cat.type,
      sort_order: cat.sort_order,
      is_active: cat.is_active,
    });
    setEditingCategoryId(cat.id);
    setShowCategoryForm(true);
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm('Hapus kategori ini? Pastikan tidak ada produk yang menggunakan kategori ini.')) return;
    setDeletingCategoryId(id);
    try {
      await categoriesApi.delete(id);
      toast.success('Kategori berhasil dihapus');
      loadAll();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal menghapus kategori');
    } finally {
      setDeletingCategoryId(null);
    }
  };

  const resetCategoryForm = () => {
    setCatFormData({ slug: '', name: '', type: 'service', sort_order: 0, is_active: true });
  };

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

  const formatRupiah = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  const serviceCategories = allCategories.filter(c => c.type === 'service' && c.is_active);
  const membershipItems = data.filter(s => {
    const cat = allCategories.find(c => c.slug === s.category);
    return cat?.type === 'membership';
  });
  const selectedCatType = allCategories.find(c => c.slug === formData.category)?.type;

  const COLOR_VARIANTS = [
    'text-blue-600', 'text-green-600', 'text-orange-600',
    'text-teal-600', 'text-indigo-600', 'text-pink-600',
  ];

  if (loading) {
    return <div className="flex justify-center h-64 items-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  }

  const ItemCard = ({ item, colorIdx }: { item: any; colorIdx: number }) => {
    const catType = allCategories.find(c => c.slug === item.category)?.type;
    const isMemberProduct = catType === 'membership';
    const themeColor = isMemberProduct ? 'text-purple-600' : (COLOR_VARIANTS[colorIdx % COLOR_VARIANTS.length]);
    const bgTheme = isMemberProduct ? 'bg-purple-50' : 'bg-white';
    const isDeleting = deletingId === item.id;

    return (
      <div className={`rounded-2xl p-5 shadow-soft hover:shadow-soft-md transition ${bgTheme} relative overflow-hidden ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex justify-between items-start mb-2">
          <h4 className="font-bold text-lg text-gray-800">{item.name}</h4>
          <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
            {item.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <p className="text-gray-500 text-xs mb-4 min-h-[32px] line-clamp-2">{item.description}</p>
        <div className="space-y-2 mb-4">
          <div className="flex justify-between items-center">
            <span className={`text-xl font-bold ${themeColor}`}>{formatRupiah(item.price)}</span>
            <span className="text-xs font-medium text-gray-500 bg-white px-2 py-1 rounded border">
              {isMemberProduct ? `${item.duration_months} Bulan` : `${item.duration} Menit`}
            </span>
          </div>
          <div className="flex gap-2 text-xs flex-wrap">
            <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded text-yellow-700 border border-yellow-100">
              <Award size={12}/> +{item.points_awarded} Pts
            </div>
            {!isMemberProduct && item.member_discount_pct > 0 && (
              <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded text-blue-700 border border-blue-100 font-bold">
                <Percent size={12}/> Member Disc {item.member_discount_pct}%
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2 pt-2 border-t border-gray-200/50">
          <button onClick={() => handleEdit(item)} className="flex-1 bg-white hover:bg-gray-50 border text-gray-600 py-2 rounded-lg text-sm flex justify-center items-center gap-2 transition">
            <Edit size={14}/> Edit
          </button>
          <button onClick={() => handleDelete(item.id)} disabled={isDeleting} className="flex-1 bg-white hover:bg-red-50 border border-red-100 text-red-500 py-2 rounded-lg text-sm flex justify-center items-center gap-2 transition disabled:opacity-50">
            {isDeleting ? <Loader2 size={14} className="animate-spin"/> : <Trash2 size={14}/>}
            {isDeleting ? 'Menghapus...' : 'Hapus'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-800">Layanan & Produk</h2>
          <p className="text-gray-500 text-sm">Atur harga service, paket membership, dan kategori</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex bg-gray-100 p-1 rounded-2xl flex-1 md:flex-none">
            <button onClick={() => setActiveTab('service')} className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl text-sm font-bold transition ${activeTab === 'service' ? 'bg-white shadow-soft text-blue-600' : 'text-gray-400'}`}>
              Service
            </button>
            <button onClick={() => setActiveTab('membership')} className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl text-sm font-bold transition ${activeTab === 'membership' ? 'bg-white shadow-soft text-purple-600' : 'text-gray-400'}`}>
              Member
            </button>
            <button onClick={() => setActiveTab('category')} className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl text-sm font-bold transition ${activeTab === 'category' ? 'bg-white shadow-soft text-teal-600' : 'text-gray-400'}`}>
              Kategori
            </button>
          </div>
          {activeTab !== 'category' && (
            <button
              onClick={() => { resetServiceForm(); setEditingId(null); setShowServiceForm(true); }}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-2xl flex items-center gap-2 hover:bg-blue-700 transition shadow-soft-md shrink-0"
            >
              <Plus size={20}/> Tambah
            </button>
          )}
        </div>
      </div>

      {/* SERVICE TAB */}
      {activeTab === 'service' && (
        <div className="space-y-8 animate-in fade-in">
          {serviceCategories.length === 0 && (
            <p className="text-gray-400 italic text-center py-10">Belum ada kategori service. Tambahkan di tab Kategori terlebih dahulu.</p>
          )}
          {serviceCategories.map((cat, idx) => {
            const catServices = data.filter(s => s.category === cat.slug);
            return (
              <div key={cat.id}>
                <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <Tag size={18} className="text-blue-500"/> {cat.name}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
                  {catServices.map(s => <ItemCard key={s.id} item={s} colorIdx={idx}/>)}
                  {catServices.length === 0 && (
                    <p className="text-gray-400 italic text-sm py-4">Belum ada produk di kategori ini.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MEMBERSHIP TAB */}
      {activeTab === 'membership' && (
        <div className="animate-in fade-in">
          <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
            <Crown className="text-purple-500"/> Paket Membership
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
            {membershipItems.map(s => <ItemCard key={s.id} item={s} colorIdx={5}/>)}
            {membershipItems.length === 0 && (
              <p className="text-gray-400 italic col-span-3 text-center py-10">Belum ada paket membership.</p>
            )}
          </div>
        </div>
      )}

      {/* CATEGORY MANAGEMENT TAB */}
      {activeTab === 'category' && (
        <div className="animate-in fade-in space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-gray-500 text-sm">Kelola kategori untuk mengelompokkan produk dan layanan.</p>
            <button
              onClick={() => { resetCategoryForm(); setEditingCategoryId(null); setShowCategoryForm(true); }}
              className="bg-teal-600 text-white px-5 py-2.5 rounded-2xl flex items-center gap-2 hover:bg-teal-700 transition shadow-soft-md"
            >
              <Plus size={18}/> Tambah Kategori
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {allCategories.map((cat) => {
              const productCount = data.filter(s => s.category === cat.slug).length;
              const isDeleting = deletingCategoryId === cat.id;
              return (
                <div key={cat.id} className={`bg-white rounded-2xl p-5 shadow-soft border border-gray-100 ${isDeleting ? 'opacity-50' : ''}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-bold text-gray-800">{cat.name}</h4>
                      <code className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded mt-1 inline-block">{cat.slug}</code>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${cat.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                        {cat.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                      <span className={`text-[10px] px-2 py-1 rounded font-bold ${cat.type === 'membership' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {cat.type === 'membership' ? 'Membership' : 'Service'}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">{productCount} produk</p>
                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <button onClick={() => handleEditCategory(cat)} className="flex-1 bg-white hover:bg-gray-50 border text-gray-600 py-2 rounded-lg text-sm flex justify-center items-center gap-1.5 transition">
                      <Edit size={13}/> Edit
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      disabled={isDeleting || productCount > 0}
                      title={productCount > 0 ? `Masih ada ${productCount} produk` : ''}
                      className="flex-1 bg-white hover:bg-red-50 border border-red-100 text-red-500 py-2 rounded-lg text-sm flex justify-center items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isDeleting ? <Loader2 size={13} className="animate-spin"/> : <Trash2 size={13}/>}
                      Hapus
                    </button>
                  </div>
                </div>
              );
            })}
            {allCategories.length === 0 && (
              <p className="text-gray-400 italic col-span-3 text-center py-10">Belum ada kategori.</p>
            )}
          </div>
        </div>
      )}

      {/* SERVICE FORM MODAL */}
      {showServiceForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-soft-xl">
            <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-4">
              {editingId ? 'Edit Data' : 'Tambah Baru'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Kategori</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                >
                  {allCategories.filter(c => c.is_active).map(cat => (
                    <option key={cat.id} value={cat.slug}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Layanan</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Contoh: Paket 1 Bulan"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Harga (Rp)</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    min="0"
                    required
                  />
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
                {selectedCatType === 'membership' ? (
                  <div>
                    <label className="block text-xs font-bold text-purple-600 uppercase mb-1">Durasi Aktif (Bulan)</label>
                    <input
                      type="number"
                      value={formData.duration_months}
                      onChange={(e) => setFormData({ ...formData, duration_months: Number(e.target.value) })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                      min="1"
                      placeholder="1, 3, 6, 12"
                      required
                    />
                    <p className="text-[10px] text-gray-500 mt-1">Berapa bulan member ini berlaku sejak pembelian.</p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-blue-600 uppercase mb-1">Diskon Member (%)</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={formData.member_discount_pct}
                        onChange={(e) => setFormData({ ...formData, member_discount_pct: Number(e.target.value) })}
                        className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        min="0"
                        max="100"
                        required
                      />
                      <Percent size={16} className="absolute right-3 top-2.5 text-blue-400"/>
                    </div>
                    <p className="text-[10px] text-blue-500 mt-1">100 = Gratis, 0 = Bayar Full</p>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-yellow-600 uppercase mb-1">Poin Reward</label>
                  <input
                    type="number"
                    value={formData.points_awarded}
                    onChange={(e) => setFormData({ ...formData, points_awarded: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-yellow-200 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none"
                    min="0"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Deskripsi</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={2}
                  required
                />
              </div>
              <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg w-fit">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700 cursor-pointer">Status Aktif</label>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="submit" disabled={isSubmitting} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition disabled:opacity-50 flex justify-center items-center gap-2">
                  {isSubmitting ? <><Loader2 size={18} className="animate-spin"/> Menyimpan...</> : (editingId ? 'Update Data' : 'Simpan Data')}
                </button>
                <button type="button" disabled={isSubmitting} onClick={() => { setShowServiceForm(false); setEditingId(null); resetServiceForm(); }} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition disabled:opacity-50">
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CATEGORY FORM MODAL */}
      {showCategoryForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-soft-xl">
            <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-4">
              {editingCategoryId ? 'Edit Kategori' : 'Tambah Kategori Baru'}
            </h3>
            <form onSubmit={handleCategorySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Kategori</label>
                <input
                  type="text"
                  value={catFormData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setCatFormData(prev => ({
                      ...prev,
                      name,
                      slug: editingCategoryId ? prev.slug : generateSlug(name),
                    }));
                  }}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="Contoh: Car Wash"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Slug (ID Sistem)</label>
                <input
                  type="text"
                  value={catFormData.slug}
                  onChange={(e) => setCatFormData({ ...catFormData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none font-mono text-sm bg-gray-50"
                  placeholder="carwash"
                  required
                  disabled={!!editingCategoryId}
                />
                <p className="text-[10px] text-gray-400 mt-1">ID unik sistem. Otomatis terisi dari nama. Tidak bisa diubah setelah disimpan.</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipe</label>
                <select
                  value={catFormData.type}
                  onChange={(e) => setCatFormData({ ...catFormData, type: e.target.value as 'service' | 'membership' })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  <option value="service">Service (Cuci, F&B, dll)</option>
                  <option value="membership">Membership (Paket berlangganan)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Urutan Tampilan</label>
                <input
                  type="number"
                  value={catFormData.sort_order}
                  onChange={(e) => setCatFormData({ ...catFormData, sort_order: Number(e.target.value) })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                  min="0"
                />
                <p className="text-[10px] text-gray-400 mt-1">Angka lebih kecil muncul lebih dulu (0 = paling atas).</p>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg w-fit">
                <input
                  type="checkbox"
                  id="cat_is_active"
                  checked={catFormData.is_active}
                  onChange={(e) => setCatFormData({ ...catFormData, is_active: e.target.checked })}
                  className="w-4 h-4 text-teal-600 rounded"
                />
                <label htmlFor="cat_is_active" className="text-sm font-medium text-gray-700 cursor-pointer">Status Aktif</label>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="submit" disabled={isSubmitting} className="flex-1 bg-teal-600 text-white py-3 rounded-xl font-bold hover:bg-teal-700 transition disabled:opacity-50 flex justify-center items-center gap-2">
                  {isSubmitting ? <><Loader2 size={18} className="animate-spin"/> Menyimpan...</> : (editingCategoryId ? 'Update Kategori' : 'Simpan Kategori')}
                </button>
                <button type="button" disabled={isSubmitting} onClick={() => { setShowCategoryForm(false); setEditingCategoryId(null); resetCategoryForm(); }} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition disabled:opacity-50">
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
