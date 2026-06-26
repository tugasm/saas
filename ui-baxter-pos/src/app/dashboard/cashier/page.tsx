'use client';

import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { transactions, services, members, memberships, categories as categoriesApi } from '@/lib/api';
import CarWashScene from './CarWashScene';
import {
    Search, Car, Banknote, CreditCard,
    Loader2, ShoppingCart, X, CheckCircle,
    ScanBarcode, ShieldCheck, Plus, Trash2,
    Bike, Crown, Coffee, LayoutGrid, Camera, ChevronDown, AlertCircle,
    Coins, Receipt, PlusCircle, ClipboardList, Tag,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const QrScannerModal = dynamic(() => import('./QrScannerModal'), { ssr: false });

interface Service {
    id: number;
    name: string;
    price: number;
    description?: string;
    category?: string;
    member_discount_pct?: number;
    points_price?: number;
}
interface CartItem extends Service {
    cartId: string;
    finalPrice: number;
    isDiscounted: boolean;
}
interface User { id: number; name: string; email: string; points?: number; }
interface Vehicle { id: number; model: string; plate_number?: string; license_plate?: string; brand?: string; color?: string; }
interface MembershipData {
    id: number;
    status: string;
    start_date: string;
    end_date: string;
    user: User;
    vehicle: Vehicle;
}
interface OpenBillItem {
    service: { name: string };
    quantity: number;
    subtotal: number;
}
interface OpenBill {
    id: number;
    transaction_code: string;
    total_amount: number;
    points_used: number;
    status: string;
    notes: string;
    created_at: string;
    user?: { id: number; name: string };
    items?: OpenBillItem[];
}
interface LocalTransaction {
    localId: string;
    customerType: 'guest' | 'member';
    plate: string;
    vehicleModel: string;
    customerName: string;
    email: string;
    userId?: number | null;
    vehicleId?: number | null;
    membershipData?: MembershipData | null;
    guestUserLookup?: { id: number; name: string; points: number } | null;
    items: CartItem[];
    usePoints: boolean;
    createdAt: Date;
}

const parseBillMeta = (notes: string) => {
    const memberMatch = notes.match(/^Member:\s*(.+)$/);
    if (memberMatch) return { plate: memberMatch[1].trim(), vehicle: '', isMember: true };
    const guestMatch = notes.match(/^Guest:\s*(\S+)\s*(.*)$/);
    if (guestMatch) return { plate: guestMatch[1].trim(), vehicle: guestMatch[2].trim(), isMember: false };
    return { plate: notes, vehicle: '', isMember: false };
};

const getServiceImage = (category: string = '', name: string = '') => {
    const lowerName = name.toLowerCase();

    if (category === 'membership') return "https://images.unsplash.com/photo-1633158829585-23ba8f7c8caf?auto=format&fit=crop&q=80&w=400";
    if (category === 'bikewash') return "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&q=80&w=400";

    if (category === 'food' || category === 'beverage' || category === 'cafe') {
        if (lowerName.includes('coffee') || lowerName.includes('kopi')) return "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&q=80&w=400";
        if (lowerName.includes('tea') || lowerName.includes('teh')) return "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&q=80&w=400";
        return "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=400";
    }

    if (lowerName.includes('wax') || lowerName.includes('detailing')) return "https://images.unsplash.com/photo-1601362840469-51e4d8d58785?auto=format&fit=crop&q=80&w=400";
    if (lowerName.includes('interior')) return "https://images.unsplash.com/photo-1507136566006-cfc505b114fc?auto=format&fit=crop&q=80&w=400";

    return "https://images.unsplash.com/photo-1520340356584-7db003b50228?auto=format&fit=crop&q=80&w=400";
};

const CATEGORY_ICON_MAP: Record<string, any> = {
    carwash: Car,
    bikewash: Bike,
    membership: Crown,
    food_beverage: Coffee,
};

interface ServiceCategory {
    id: number;
    slug: string;
    name: string;
    type: 'service' | 'membership';
    is_active: boolean;
}


export default function Cashier() {

    const [activeCategory, setActiveCategory] = useState('all');
    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    const [availableCategories, setAvailableCategories] = useState<ServiceCategory[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [loadingServices, setLoadingServices] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [customerType, setCustomerType] = useState<'guest' | 'member'>('guest');
    const [scanInput, setScanInput] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [validatedMember, setValidatedMember] = useState<MembershipData | null>(null);
    const [memberCardExpanded, setMemberCardExpanded] = useState(false);
    const [memberSearchError, setMemberSearchError] = useState<string | null>(null);
    const [showQrScanner, setShowQrScanner] = useState(false);

    const [guestName, setGuestName] = useState('');
    const [guestPlate, setGuestPlate] = useState('');
    const [guestVehicleModel, setGuestVehicleModel] = useState('');
    const [guestEmail, setGuestEmail] = useState('');
    const [emailSuggestions, setEmailSuggestions] = useState<{ id: number; email: string; name: string }[]>([]);
    const [showEmailDropdown, setShowEmailDropdown] = useState(false);
    // Points state
    const [guestUserLookup, setGuestUserLookup] = useState<{ id: number; name: string; points: number } | null>(null);
    const [isLookingUpEmail, setIsLookingUpEmail] = useState(false);
    const [usePoints, setUsePoints] = useState(false);
    const [showGuestQrScanner, setShowGuestQrScanner] = useState(false);

    // Local transactions state (no backend until Selesai/Bayar)
    const LOCAL_TX_KEY = 'baxter_local_transactions';
    const [activeTab, setActiveTab] = useState<'cart' | 'bills'>('cart');
    const [localTransactions, setLocalTransactions] = useState<LocalTransaction[]>(() => {
        try {
            const stored = localStorage.getItem('baxter_local_transactions');
            if (!stored) return [];
            const parsed = JSON.parse(stored) as LocalTransaction[];
            return parsed.map(tx => ({ ...tx, createdAt: new Date(tx.createdAt) }));
        } catch { return []; }
    });
    const [payBill, setPayBill] = useState<OpenBill | null>(null);
    const [payBillTx, setPayBillTx] = useState<LocalTransaction | null>(null);
    const [billPaymentMethodId, setBillPaymentMethodId] = useState('1');
    const [isConfirming, setIsConfirming] = useState(false);
    const [finishingTxId, setFinishingTxId] = useState<string | null>(null);
    const [payingPhaseId, setPayingPhaseId] = useState<string | null>(null);
    const [targetTransaction, setTargetTransaction] = useState<LocalTransaction | null>(null);

    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        localStorage.setItem(LOCAL_TX_KEY, JSON.stringify(localTransactions));
    }, [localTransactions]);

    useEffect(() => { loadServices(); }, []);

    const loadServices = async () => {
        try {
            const [svcRes, catRes] = await Promise.all([services.getAll(), categoriesApi.getAll()]);
            setAvailableServices(Array.isArray(svcRes.data) ? svcRes.data : []);
            setAvailableCategories(Array.isArray(catRes.data) ? catRes.data.filter((c: ServiceCategory) => c.is_active) : []);
            setLoadingServices(false);
        } catch { toast.error("Gagal memuat layanan"); }
    };


    useEffect(() => {
        if (guestEmail.trim().length < 2) { setEmailSuggestions([]); return; }
        const handle = setTimeout(async () => {
            try {
                const res = await members.autocompleteEmail(guestEmail.trim());
                setEmailSuggestions(res.data?.data ?? []);
            } catch { setEmailSuggestions([]); }
        }, 250);
        return () => clearTimeout(handle);
    }, [guestEmail]);

    // Lookup poin customer berdasarkan email (untuk guest)
    const lookupGuestByEmail = async (email: string) => {
        const trimmed = email.trim().toLowerCase();
        if (!trimmed || !trimmed.includes('@')) {
            setGuestUserLookup(null);
            return;
        }
        setIsLookingUpEmail(true);
        try {
            const res = await members.search('email', trimmed);
            const userData = res.data;
            if (userData?.id) {
                setGuestUserLookup({ id: userData.id, name: userData.name, points: userData.points ?? 0 });
            } else {
                setGuestUserLookup(null);
            }
        } catch {
            setGuestUserLookup(null);
        } finally {
            setIsLookingUpEmail(false);
        }
    };

    // Scan QR identity customer (dari mobile app) untuk guest mode
    // Selalu live lookup ke backend supaya poin tidak stale
    const handleGuestQrScan = async (decoded: string) => {
        setShowGuestQrScanner(false);
        try {
            const data = JSON.parse(decoded);
            if (!data.user_id) return;

            // Pre-fill form sementara sambil fetch live data
            if (!guestName && data.name) setGuestName(data.name);
            if (!guestEmail && data.email) setGuestEmail(data.email);

            setIsLookingUpEmail(true);
            try {
                const res = await members.search('user_id', String(data.user_id));
                const userData = res.data;
                if (userData?.id) {
                    setGuestUserLookup({ id: userData.id, name: userData.name, points: userData.points ?? 0 });
                    if (!guestName) setGuestName(userData.name);
                    if (!guestEmail) setGuestEmail(userData.email);
                }
            } catch {
                // Fallback ke data QR kalau backend gagal
                setGuestUserLookup({ id: data.user_id, name: data.name ?? '', points: data.points ?? 0 });
            } finally {
                setIsLookingUpEmail(false);
            }
        } catch { /* bukan JSON customer QR, abaikan */ }
    };

    const isEligibleForDiscount = () => {
        const isMemberActive = customerType === 'member' && validatedMember?.status === 'active';
        const isBuyingMembership = cart.some(item => item.category === 'membership');
        return isMemberActive || isBuyingMembership;
    };

    // Derived: poin customer saat ini
    const customerPoints = customerType === 'member'
        ? (validatedMember?.user?.points ?? 0)
        : (guestUserLookup?.points ?? 0);

    const customerId = customerType === 'member'
        ? validatedMember?.user?.id
        : guestUserLookup?.id;

    // Total poin yang dibutuhkan untuk semua item redeemable di keranjang
    const totalPointsNeeded = cart.reduce((sum, item) => {
        return sum + (item.points_price && item.points_price > 0 ? item.points_price : 0);
    }, 0);

    // Toggle tampil kalau ada customer + item redeemable; disabled kalau poin kurang
    const showPointsToggle = !!customerId && totalPointsNeeded > 0;
    const canPayWithPoints = showPointsToggle && customerPoints >= totalPointsNeeded;

    // Reset usePoints jika tidak lagi memenuhi syarat
    useEffect(() => {
        if (usePoints && !canPayWithPoints) {
            setUsePoints(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cart.length, validatedMember, guestUserLookup]);

    const addToCart = (service: Service) => {
        const newItem: CartItem = {
            ...service,
            cartId: Math.random().toString(36).substr(2, 9),
            finalPrice: service.price,
            isDiscounted: false
        };
        setCart([...cart, newItem]);
    };

    const removeFromCart = (cartId: string) => {
        setCart(cart.filter(item => item.cartId !== cartId));
    };

    useEffect(() => {
        const hasPrivilege = isEligibleForDiscount();
        const isBuyingMembership = cart.some(i => i.category === 'membership');
        setCart(prevCart => prevCart.map(item => {
            if (item.category === 'membership') return { ...item, finalPrice: item.price, isDiscounted: false };
            if (isBuyingMembership && (item.category === 'carwash' || item.category === 'bikewash')) {
                return { ...item, finalPrice: 0, isDiscounted: true };
            }
            if (hasPrivilege && item.member_discount_pct && item.member_discount_pct > 0) {
                const discountAmount = item.price * (item.member_discount_pct / 100);
                return { ...item, finalPrice: item.price - discountAmount, isDiscounted: true };
            }
            return { ...item, finalPrice: item.price, isDiscounted: false };
        }));
    }, [cart.length, validatedMember, customerType]);

    // Total uang tunai (item yang tidak dibayar poin)
    const totalCashAmount = cart.reduce((sum, item) => {
        if (usePoints && item.points_price && item.points_price > 0) return sum;
        return sum + item.finalPrice;
    }, 0);

    const totalPrice = usePoints ? totalCashAmount : cart.reduce((sum, item) => sum + item.finalPrice, 0);

    const handleScanOrSearchMember = async (plateInput?: string, e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const searchTerm = plateInput ?? scanInput;
        if (!searchTerm || searchTerm.length < 3) {
            setMemberSearchError("Min 3 karakter");
            return;
        }
        setMemberSearchError(null);
        setValidatedMember(null);
        setIsScanning(true);
        try {
            const res = await members.search('plate', searchTerm);
            const userData = res.data;
            if (userData && userData.id) {
                const normalizePlate = (p: string = '') => p.replace(/\s+/g, '').toUpperCase();
                const scannedPlate = normalizePlate(searchTerm);

                const userVehicles: any[] = Array.isArray(userData.vehicles) ? userData.vehicles : [];
                const matchedVehicle = userVehicles.find(v =>
                    normalizePlate(v.plate_number || v.license_plate || '') === scannedPlate
                );

                if (!matchedVehicle) {
                    setMemberSearchError("Plat nomor tidak terdaftar untuk member ini");
                    return;
                }

                const memRes = await memberships.getAll({ user_id: userData.id });
                const memItems = memRes.data?.data ?? memRes.data;
                const userMemberships = Array.isArray(memItems) ? memItems : [];

                const membershipData = userMemberships.find(
                    (m: any) => (m.vehicle_id ?? m.vehicle?.id) === matchedVehicle.id
                );

                if (!membershipData) {
                    setMemberSearchError("Membership untuk plat ini tidak ditemukan");
                    return;
                }

                const vehicle = {
                    id: matchedVehicle.id,
                    model: matchedVehicle.model,
                    license_plate: matchedVehicle.plate_number || matchedVehicle.license_plate,
                    brand: matchedVehicle.brand || '',
                    color: matchedVehicle.color || ''
                };

                setValidatedMember({
                    id: membershipData.id, status: membershipData.status.toLowerCase(),
                    start_date: membershipData.start_date, end_date: membershipData.end_date,
                    user: { id: userData.id, name: userData.name, email: userData.email, points: userData.points ?? 0 },
                    vehicle: vehicle
                });
                setMemberCardExpanded(false);
            } else {
                throw new Error();
            }
        } catch {
            setMemberSearchError("Member tidak ditemukan");
            setValidatedMember(null);
        } finally {
            setIsScanning(false);
        }
    };

    const handleQrScan = (decoded: string) => {
        setShowQrScanner(false);
        setScanInput(decoded);
        handleScanOrSearchMember(decoded);
    };

    const switchToGuest = () => {
        if (!validatedMember) return;
        setGuestPlate(validatedMember.vehicle.license_plate || '');
        setGuestName(validatedMember.user.name || '');
        setGuestVehicleModel(validatedMember.vehicle.model || '');
        setGuestEmail(validatedMember.user.email || '');
        setCustomerType('guest');
        setValidatedMember(null);
        setMemberSearchError(null);
    };

    const handleCheckout = async () => {
        if (cart.length === 0) return toast.error("Pilih layanan terlebih dahulu");
        if (customerType === 'guest' && !guestPlate) return toast.error("Plat nomor wajib diisi");

        const isBuyingMembership = cart.some(i => i.category === 'membership');
        const isGuestRegisteringMember = isBuyingMembership && customerType === 'guest';
        if (isGuestRegisteringMember) {
            if (!guestName) return toast.error("Nama wajib diisi untuk registrasi membership");
            const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim());
            if (!emailOk) return toast.error("Email valid wajib diisi untuk registrasi membership");
        }
        if (usePoints && !customerId) {
            return toast.error("Identifikasi customer terlebih dahulu untuk bayar dengan poin");
        }

        const newTx: LocalTransaction = {
            localId: Math.random().toString(36).substr(2, 9),
            customerType,
            plate: customerType === 'member'
                ? (validatedMember?.vehicle.license_plate ?? '')
                : guestPlate.toUpperCase(),
            vehicleModel: customerType === 'member'
                ? (validatedMember?.vehicle.model ?? '')
                : guestVehicleModel,
            customerName: customerType === 'member'
                ? (validatedMember?.user.name ?? '')
                : (guestName || 'Guest'),
            email: customerType === 'member'
                ? (validatedMember?.user.email ?? '')
                : guestEmail.trim().toLowerCase(),
            userId: customerType === 'member'
                ? validatedMember?.user.id
                : guestUserLookup?.id ?? null,
            vehicleId: customerType === 'member' ? validatedMember?.vehicle.id : null,
            membershipData: customerType === 'member' ? validatedMember : null,
            guestUserLookup: customerType === 'guest' ? guestUserLookup : null,
            items: [...cart],
            usePoints,
            createdAt: new Date(),
        };

        setLocalTransactions(prev => [...prev, newTx]);
        toast.success("Transaksi dimulai!");
        resetForm();
        setActiveTab('bills');
    };

    const handleRemoveItemFromLocalTx = (localId: string, cartId: string) => {
        setLocalTransactions(prev => prev.map(tx =>
            tx.localId !== localId ? tx : { ...tx, items: tx.items.filter(i => i.cartId !== cartId) }
        ).filter(tx => tx.items.length > 0));
    };

    const handleSelectTxForAddition = (tx: LocalTransaction) => {
        setTargetTransaction(tx);
        setActiveTab('cart');
    };

    const handleAddItemsToLocalTx = () => {
        if (!targetTransaction) return;
        if (cart.length === 0) return toast.error("Pilih produk terlebih dahulu");
        setLocalTransactions(prev => prev.map(tx =>
            tx.localId === targetTransaction.localId
                ? { ...tx, items: [...tx.items, ...cart] }
                : tx
        ));
        toast.success("Produk ditambahkan");
        setTargetTransaction(null);
        setCart([]);
        setActiveTab('bills');
    };

    const handleFinishTransaction = async (tx: LocalTransaction) => {
        setPayingPhaseId(tx.localId);
        setFinishingTxId(tx.localId);
        const isBuyingMembership = tx.items.some(i => i.category === 'membership');
        const note = tx.customerType === 'member'
            ? `Member: ${tx.plate}`
            : `Guest: ${tx.plate} ${tx.vehicleModel}`;

        const payload: any = {
            items: tx.items.map(item => ({ service_id: item.id, quantity: 1 })),
            user_id: tx.userId ?? null,
            customer_name: tx.customerName,
            notes: note,
            vehicle_id: tx.vehicleId ?? null,
            use_points: tx.usePoints,
            payment_method_id: 1,
        };
        if (tx.customerType === 'guest' && isBuyingMembership && tx.email) {
            payload.customer_email = tx.email;
            payload.guest_plate = tx.plate;
            payload.guest_vehicle_model = tx.vehicleModel;
        }

        try {
            const res = await transactions.manualCheckout(payload);
            const created = res.data;
            setLocalTransactions(prev => prev.filter(t => t.localId !== tx.localId));

            if (tx.customerType === 'member') {
                await transactions.updateStatus(created.id, 'completed');
                toast.success("Transaksi selesai!");
            } else {
                setPayBill({
                    id: created.id,
                    transaction_code: created.transaction_code,
                    total_amount: created.total_amount ?? tx.items.reduce((s, i) => s + i.finalPrice, 0),
                    points_used: created.points_used ?? 0,
                    status: created.status ?? '',
                    notes: created.notes ?? note,
                    created_at: created.created_at ?? new Date().toISOString(),
                    user: created.user,
                    items: created.items,
                });
                setPayBillTx(tx);
                setBillPaymentMethodId('1');
            }
        } catch (e: any) {
            setPayingPhaseId(null);
            toast.error(e?.response?.data?.error ?? "Gagal menyelesaikan transaksi");
        } finally {
            setFinishingTxId(null);
        }
    };

    const handleConfirmBillPayment = async () => {
        if (!payBill) return;
        setIsConfirming(true);
        try {
            if (billPaymentMethodId === '2') {
                // QRIS via Midtrans
                const midtransPayload = {
                    orderId: payBill.transaction_code,
                    amount: payBill.total_amount,
                    name: payBill.user?.name ?? "Guest",
                    email: "guest@example.com",
                    items: (payBill.items ?? []).map(i => ({
                        id: 0, price: i.subtotal / i.quantity, quantity: i.quantity, name: i.service.name,
                    })),
                    notes: payBill.notes,
                };
                const res = await fetch("/api/payment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(midtransPayload) });
                const data = await res.json();
                if (!data.token) throw new Error("Midtrans Error");
                (window as any).snap.pay(data.token, {
                    onSuccess: async () => {
                        await transactions.confirmPayment(payBill.id, { payment_method_id: 2 });
                        toast.success("Pembayaran QRIS berhasil!");
                        setPayBill(null); setPayBillTx(null);
                        // payment complete
                    },
                    onPending: () => toast("Menunggu pembayaran..."),
                    onError: () => toast.error("Pembayaran gagal"),
                });
            } else {
                await transactions.confirmPayment(payBill.id, { payment_method_id: Number(billPaymentMethodId) });
                toast.success("Pembayaran dikonfirmasi!");
                setPayBill(null); setPayBillTx(null);
                // payment complete
            }
        } catch (e: any) {
            const msg = e?.response?.data?.error ?? e?.response?.data?.message ?? e?.message ?? "Gagal konfirmasi pembayaran";
            console.error('[confirmPayment] error:', e?.response?.status, e?.response?.data);
            toast.error(msg);
        } finally {
            setIsConfirming(false);
        }
    };

    const resetForm = () => {
        setCart([]);
        setScanInput('');
        setValidatedMember(null);
        setMemberCardExpanded(false);
        setMemberSearchError(null);
        setShowQrScanner(false);
        setGuestName('');
        setGuestPlate('');
        setGuestVehicleModel('');
        setGuestEmail('');
        setEmailSuggestions([]);
        setShowEmailDropdown(false);
        setCustomerType('guest');
        setGuestUserLookup(null);
        setUsePoints(false);
        setShowGuestQrScanner(false);
        setTargetTransaction(null);
    };

    const filteredServices = availableServices.filter(service => {
        if (activeCategory === 'all') return true;
        return service.category === activeCategory;
    });

    const isActive = validatedMember?.status === 'active';

    return (
        <div className="flex flex-col md:flex-row h-[calc(100dvh-120px)] gap-4 md:gap-5 overflow-hidden relative">

            {/* LEFT: SERVICE CATALOG */}
            <div className="flex-1 flex flex-col gap-3 overflow-hidden min-w-0">

                {/* Category Filter */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide shrink-0">
                    {[{ slug: 'all', name: 'Semua' }, ...availableCategories].map(cat => {
                        const Icon = CATEGORY_ICON_MAP[cat.slug] ?? (cat.slug === 'all' ? LayoutGrid : Tag);
                        const isActiveTab = activeCategory === cat.slug;
                        return (
                            <button
                                key={cat.slug}
                                onClick={() => setActiveCategory(cat.slug)}
                                className={`
                                    flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold whitespace-nowrap transition-all
                                    ${isActiveTab
                                        ? 'bg-blue-600 text-white shadow-soft-md'
                                        : 'bg-white text-gray-400 shadow-soft hover:shadow-soft-md hover:text-gray-600 active:bg-gray-50'
                                    }
                                `}
                            >
                                <Icon size={18} />
                                {cat.name}
                            </button>
                        );
                    })}
                </div>

                {/* Service Grid */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loadingServices ? (
                        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
                    ) : filteredServices.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                            <Search size={48} className="mb-2 opacity-20" />
                            <p>Tidak ada layanan di kategori ini</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 pb-4">
                            {filteredServices.map(service => (
                                <button
                                    key={service.id}
                                    onClick={() => addToCart(service)}
                                    className="group relative h-36 md:h-44 rounded-2xl overflow-hidden text-left shadow-soft hover:shadow-soft-lg active:scale-[0.98] transition-all duration-200"
                                >
                                    <div className="absolute inset-0 bg-gray-200">
                                        <img
                                            src={getServiceImage(service.category, service.name)}
                                            alt={service.name}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                                    <div className="absolute top-2.5 right-2.5 bg-white/20 backdrop-blur-md p-2 rounded-xl">
                                        <Plus size={16} className="text-white" />
                                    </div>
                                    {service.points_price && service.points_price > 0 && (
                                        <div className="absolute top-2.5 left-2.5 bg-amber-400/90 backdrop-blur-md px-2 py-1 rounded-xl flex items-center gap-1">
                                            <Coins size={12} className="text-amber-900" />
                                            <span className="text-[10px] font-bold text-amber-900">{service.points_price.toLocaleString('id-ID')}</span>
                                        </div>
                                    )}
                                    <div className="absolute inset-x-0 bottom-0 p-3 md:p-4 text-white">
                                        <h3 className="font-bold text-base md:text-lg leading-tight mb-1 drop-shadow-md">{service.name}</h3>
                                        <div className="flex items-center justify-between">
                                            <p className="font-bold text-yellow-400 text-base md:text-lg">
                                                Rp {(service.price / 1000).toLocaleString('id-ID')}k
                                            </p>
                                            {service.member_discount_pct && service.member_discount_pct > 0 && (
                                                <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-lg font-bold">
                                                    -{service.member_discount_pct}%
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT: CART & CHECKOUT */}
            <div className={`w-full bg-white shadow-soft-lg rounded-3xl flex flex-col shrink-0 max-h-[50vh] md:max-h-full md:h-full transition-[width] duration-300 ${
                activeTab === 'bills'
                    ? 'md:w-[440px] lg:w-[560px] xl:w-[620px]'
                    : 'md:w-[380px] lg:w-[400px]'
            }`}>
                {/* Cart Header — Tabs */}
                <div className="px-3 pt-3 rounded-t-3xl shrink-0">
                    <div className="bg-gray-100 p-1 rounded-2xl flex">
                        <button
                            onClick={() => setActiveTab('cart')}
                            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${activeTab === 'cart' ? 'bg-white shadow-soft text-gray-900' : 'text-gray-400 active:bg-gray-200'}`}
                        >
                            <ShoppingCart size={16} /> Pesanan {cart.length > 0 && <span className="bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{cart.length}</span>}
                        </button>
                        <button
                            onClick={() => setActiveTab('bills')}
                            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${activeTab === 'bills' ? 'bg-white shadow-soft text-gray-900' : 'text-gray-400 active:bg-gray-200'}`}
                        >
                            <ClipboardList size={16} /> Berlangsung {localTransactions.length > 0 && <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{localTransactions.length}</span>}
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 custom-scrollbar">

                {activeTab === 'bills' ? (
                    /* ===== BERLANGSUNG TAB ===== */
                    <div className="space-y-3">
                        <p className="text-xs font-bold text-gray-400 uppercase">Transaksi Sedang Berjalan</p>
                        {localTransactions.length === 0 ? (
                            <div className="text-center py-10 text-gray-400 text-sm bg-gray-50 rounded-2xl">
                                <ClipboardList size={32} className="mx-auto mb-2 opacity-30" />
                                Tidak ada transaksi berlangsung
                            </div>
                        ) : localTransactions.map(tx => {
                            const total = tx.items.reduce((s, i) => s + i.finalPrice, 0);
                            const vehicleKind = tx.items.some(item => item.category === 'bikewash') ? 'motorcycle' : 'car';
                            return (
                            <div key={tx.localId} className="overflow-hidden rounded-2xl bg-gray-50 p-2.5">
                                <div className="grid gap-3 lg:grid-cols-[minmax(240px,1.05fr)_minmax(220px,0.95fr)] lg:items-stretch">
                                    <CarWashScene
                                        plate={tx.plate}
                                        brand={tx.membershipData?.vehicle.brand}
                                        model={tx.vehicleModel || tx.membershipData?.vehicle.model}
                                        color={tx.membershipData?.vehicle.color}
                                        isMember={tx.customerType === 'member'}
                                        vehicleKind={vehicleKind}
                                        phase={payingPhaseId === tx.localId ? 'paying' : 'washing'}
                                        className="h-[220px] lg:h-full lg:min-h-[260px]"
                                    />

                                    <div className="flex min-h-0 flex-col rounded-2xl bg-white p-3 shadow-soft">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="font-mono text-lg font-black leading-tight tracking-wide text-gray-900">{tx.plate || '—'}</p>
                                                {tx.vehicleModel && <p className="truncate text-xs text-gray-500">{tx.vehicleModel}</p>}
                                                <p className="mt-0.5 text-[10px] text-gray-300">{tx.createdAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <p className="text-sm font-bold text-blue-600">Rp {total.toLocaleString('id-ID')}</p>
                                                <p className="text-[10px] text-gray-400">{tx.items.length} item</p>
                                            </div>
                                        </div>

                                        <div className="my-3 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 custom-scrollbar">
                                            {tx.items.map((item, idx) => (
                                                <div key={idx} className="flex items-center justify-between rounded-xl bg-gray-50 px-2.5 py-2 text-xs text-gray-600">
                                                    <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
                                                    <span className="ml-2 shrink-0 font-bold text-gray-700">
                                                        {item.finalPrice === 0 ? 'Gratis' : `Rp ${item.finalPrice.toLocaleString('id-ID')}`}
                                                    </span>
                                                    <button
                                                        onClick={() => handleRemoveItemFromLocalTx(tx.localId, item.cartId)}
                                                        className="ml-2 rounded-lg p-1 text-red-400 transition hover:bg-red-50 hover:text-red-600"
                                                        title="Hapus item"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => handleSelectTxForAddition(tx)}
                                                className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-blue-50 px-2 py-2 text-xs font-bold text-blue-600 transition hover:bg-blue-100 active:bg-blue-200"
                                            >
                                                <PlusCircle size={12} /> Tambah
                                            </button>
                                            <button
                                                onClick={() => handleFinishTransaction(tx)}
                                                disabled={finishingTxId === tx.localId}
                                                className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-2 py-2 text-xs font-bold text-white transition hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-50"
                                            >
                                                {finishingTxId === tx.localId
                                                    ? <Loader2 size={12} className="animate-spin" />
                                                    : <CheckCircle size={12} />}
                                                {tx.customerType === 'member' ? 'Selesai' : 'Bayar'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )})}
                    </div>
                ) : (
                    /* ===== CART TAB ===== */
                    <>

                    {/* Customer Type Toggle */}
                    <div className="bg-gray-100 p-1 rounded-2xl flex">
                        <button
                            onClick={() => { setCustomerType('guest'); setValidatedMember(null); setMemberSearchError(null); setUsePoints(false); }}
                            className={`flex-1 py-3 text-sm font-bold rounded-xl transition flex items-center justify-center gap-2 ${customerType === 'guest' ? 'bg-white shadow-soft text-gray-900' : 'text-gray-400 active:bg-gray-200'}`}
                        >
                            <Car size={18} /> Tamu
                        </button>
                        <button
                            onClick={() => { setCustomerType('member'); setValidatedMember(null); setMemberSearchError(null); setUsePoints(false); setTimeout(() => searchInputRef.current?.focus(), 100); }}
                            className={`flex-1 py-3 text-sm font-bold rounded-xl transition flex items-center justify-center gap-2 ${customerType === 'member' ? 'bg-blue-600 shadow-soft text-white' : 'text-gray-400 active:bg-gray-200'}`}
                        >
                            <ScanBarcode size={18} /> Member
                        </button>
                    </div>

                    {/* Customer Form */}
                    {customerType === 'member' ? (
                        <div className="space-y-3">
                            {/* Search + Camera */}
                            <form
                                onSubmit={(e) => handleScanOrSearchMember(undefined, e)}
                                className="relative flex gap-2"
                            >
                                <div className="relative flex-1">
                                    <input
                                        ref={searchInputRef}
                                        value={scanInput}
                                        onChange={e => setScanInput(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3.5 bg-blue-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-200 focus:bg-white outline-none transition font-mono text-center uppercase font-bold"
                                        placeholder="SCAN / PLAT"
                                        autoFocus
                                    />
                                    <Search className="absolute left-3.5 top-4 text-blue-400" size={20} />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowQrScanner(true)}
                                    className="bg-blue-50 text-blue-500 p-3.5 rounded-2xl hover:bg-blue-100 active:bg-blue-200 transition shrink-0"
                                    title="Scan QR / Barcode"
                                >
                                    <Camera size={20} />
                                </button>
                                <button
                                    type="submit"
                                    disabled={isScanning}
                                    className="bg-blue-600 text-white p-3.5 rounded-2xl hover:bg-blue-700 active:bg-blue-800 transition shrink-0"
                                >
                                    {isScanning
                                        ? <Loader2 size={18} className="animate-spin" />
                                        : <CheckCircle size={18} />
                                    }
                                </button>
                            </form>

                            {memberSearchError && !validatedMember && (
                                <div className="flex items-center gap-3 p-3.5 bg-white border border-red-200 rounded-2xl">
                                    <div className="p-1.5 bg-red-50 rounded-xl shrink-0">
                                        <AlertCircle size={16} className="text-red-500" />
                                    </div>
                                    <p className="text-sm text-gray-700 flex-1">{memberSearchError}</p>
                                    <button
                                        onClick={() => setMemberSearchError(null)}
                                        className="text-gray-300 hover:text-gray-500 shrink-0"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            )}

                            {/* Member card dengan poin */}
                            {validatedMember && (
                                <div className={`rounded-2xl border overflow-hidden transition-all ${
                                    isActive
                                        ? 'border-emerald-200 bg-emerald-50/60'
                                        : 'border-amber-200 bg-amber-50/60'
                                }`}>
                                    <button
                                        type="button"
                                        onClick={() => setMemberCardExpanded(prev => !prev)}
                                        className="w-full p-3.5 flex items-center gap-3 text-left"
                                    >
                                        <div className={`p-2 rounded-xl shrink-0 ${
                                            isActive ? 'bg-emerald-100' : 'bg-amber-100'
                                        }`}>
                                            <ShieldCheck size={18} className={
                                                isActive ? 'text-emerald-600' : 'text-amber-600'
                                            } />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-gray-800 text-sm truncate">{validatedMember.user.name}</p>
                                            <p className="text-xs text-gray-500 font-mono">{validatedMember.vehicle.license_plate}</p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {/* Badge Poin */}
                                            <div className="flex items-center gap-1 bg-amber-100 px-2 py-1 rounded-xl">
                                                <Coins size={12} className="text-amber-600" />
                                                <span className="text-xs font-bold text-amber-700">
                                                    {(validatedMember.user.points ?? 0).toLocaleString('id-ID')}
                                                </span>
                                            </div>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                isActive
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : 'bg-amber-100 text-amber-700'
                                            }`}>
                                                {isActive ? 'AKTIF' : 'EXPIRED'}
                                            </span>
                                            <ChevronDown
                                                size={16}
                                                className={`text-gray-400 transition-transform ${memberCardExpanded ? 'rotate-180' : ''}`}
                                            />
                                        </div>
                                    </button>

                                    {memberCardExpanded && (
                                        <div className="px-3.5 pb-3.5 space-y-2 border-t border-white/60">
                                            <div className="grid grid-cols-2 gap-2 pt-3">
                                                <div className="bg-white/80 p-3 rounded-xl">
                                                    <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">Mulai</p>
                                                    <p className="text-xs font-bold text-gray-700">
                                                        {new Date(validatedMember.start_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </p>
                                                </div>
                                                <div className="bg-white/80 p-3 rounded-xl">
                                                    <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">Berakhir</p>
                                                    <p className={`text-xs font-bold ${isActive ? 'text-emerald-700' : 'text-red-500'}`}>
                                                        {new Date(validatedMember.end_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </p>
                                                </div>
                                                <div className="bg-white/80 p-3 rounded-xl col-span-2">
                                                    <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">Kendaraan</p>
                                                    <p className="text-xs font-bold text-gray-700">
                                                        {[validatedMember.vehicle.brand, validatedMember.vehicle.model].filter(Boolean).join(' ') || '-'}
                                                    </p>
                                                </div>
                                            </div>
                                            {!isActive && (
                                                <button
                                                    type="button"
                                                    onClick={switchToGuest}
                                                    className="w-full text-sm font-bold py-2.5 rounded-xl bg-white/80 text-gray-600 hover:bg-white active:bg-gray-100 transition border border-gray-200"
                                                >
                                                    Alihkan ke Tamu
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="relative">
                                <div className="absolute left-3 top-3 bg-gray-200 px-2 py-0.5 rounded-lg text-xs font-bold text-gray-600">RI</div>
                                <input
                                    className="w-full pl-14 pr-4 py-3 bg-gray-50 border-0 rounded-2xl font-mono font-bold uppercase focus:ring-2 focus:ring-blue-200 focus:bg-white outline-none transition"
                                    placeholder="B 1234 CD"
                                    value={guestPlate}
                                    onChange={e => setGuestPlate(e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <input className="w-full bg-gray-50 border-0 p-3 rounded-2xl text-sm focus:ring-2 focus:ring-blue-200 focus:bg-white outline-none transition" placeholder="Nama Tamu" value={guestName} onChange={e => setGuestName(e.target.value)} />
                                <input className="w-full bg-gray-50 border-0 p-3 rounded-2xl text-sm focus:ring-2 focus:ring-blue-200 focus:bg-white outline-none transition" placeholder="Model Mobil" value={guestVehicleModel} onChange={e => setGuestVehicleModel(e.target.value)} />
                            </div>

                            {/* Email + QR scan untuk lookup poin */}
                            <div className="relative flex gap-2">
                                <div className="relative flex-1">
                                    <input
                                        type="email"
                                        className={`w-full border-0 p-3 pr-10 rounded-2xl text-sm focus:ring-2 focus:ring-blue-200 focus:bg-white outline-none transition ${
                                            guestUserLookup ? 'bg-amber-50' : 'bg-gray-50'
                                        }`}
                                        placeholder="Email (opsional, untuk cek poin)"
                                        value={guestEmail}
                                        onChange={e => {
                                            setGuestEmail(e.target.value);
                                            setShowEmailDropdown(true);
                                            setGuestUserLookup(null);
                                            setUsePoints(false);
                                        }}
                                        onFocus={() => setShowEmailDropdown(true)}
                                        onBlur={() => {
                                            setTimeout(() => setShowEmailDropdown(false), 150);
                                            lookupGuestByEmail(guestEmail);
                                        }}
                                        autoComplete="off"
                                    />
                                    <div className="absolute right-3 top-3.5">
                                        {isLookingUpEmail
                                            ? <Loader2 size={16} className="animate-spin text-gray-400" />
                                            : guestUserLookup
                                                ? <Coins size={16} className="text-amber-500" />
                                                : null
                                        }
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowGuestQrScanner(true)}
                                    className="bg-gray-100 text-gray-500 p-3 rounded-2xl hover:bg-gray-200 active:bg-gray-300 transition shrink-0"
                                    title="Scan QR Customer"
                                >
                                    <Camera size={18} />
                                </button>
                                {showEmailDropdown && emailSuggestions.length > 0 && (
                                    <ul className="absolute z-10 left-0 right-0 mt-1 bg-white rounded-2xl shadow-soft-lg max-h-48 overflow-y-auto custom-scrollbar border border-gray-100">
                                        {emailSuggestions.map(s => (
                                            <li
                                                key={s.id}
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    setGuestEmail(s.email);
                                                    if (!guestName) setGuestName(s.name);
                                                    setShowEmailDropdown(false);
                                                    lookupGuestByEmail(s.email);
                                                }}
                                                className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-50 last:border-0"
                                            >
                                                <p className="font-bold text-gray-800">{s.email}</p>
                                                <p className="text-xs text-gray-500">{s.name}</p>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            {/* Poin badge untuk guest */}
                            {guestUserLookup && (
                                <div className="flex items-center gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-2xl">
                                    <div className="p-1.5 bg-amber-100 rounded-xl shrink-0">
                                        <Coins size={16} className="text-amber-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-gray-700 truncate">{guestUserLookup.name}</p>
                                        <p className="text-xs text-amber-700 font-bold">{guestUserLookup.points.toLocaleString('id-ID')} poin tersedia</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => { setGuestUserLookup(null); setUsePoints(false); }}
                                        className="text-gray-300 hover:text-gray-500 shrink-0"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Cart Items */}
                    <div className="pt-4">
                        <p className="text-xs font-bold text-gray-400 uppercase mb-2">Pilihan Layanan</p>
                        {cart.length === 0 ? (
                            <div className="text-center py-6 bg-gray-50 rounded-2xl text-gray-400 text-sm">
                                Keranjang kosong
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
                                {cart.map((item) => {
                                    const isIncluded = item.isDiscounted && item.finalPrice === 0;
                                    const isPaidWithPoints = usePoints && !!(item.points_price && item.points_price > 0);
                                    return (
                                        <div key={item.cartId} className={`flex justify-between items-center p-3 rounded-2xl ${isPaidWithPoints ? 'bg-amber-50' : 'bg-gray-50'}`}>
                                            <div className="flex-1 min-w-0">
                                                <p className={`font-bold text-sm text-gray-800 truncate ${isIncluded ? 'line-through opacity-60' : ''}`}>{item.name}</p>
                                                {isPaidWithPoints
                                                    ? <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 rounded-lg font-bold flex items-center gap-1 w-fit">
                                                        <Coins size={10} /> {item.points_price?.toLocaleString('id-ID')} poin
                                                      </span>
                                                    : isIncluded
                                                        ? <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 rounded-lg font-bold">Termasuk Member</span>
                                                        : item.isDiscounted && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 rounded-lg font-bold">Diskon Member</span>
                                                }
                                            </div>
                                            <div className="text-right mx-3 shrink-0">
                                                {isPaidWithPoints
                                                    ? <p className="font-bold text-sm text-amber-600">POIN</p>
                                                    : <p className={`font-bold text-sm ${isIncluded ? 'text-blue-600' : ''}`}>{isIncluded ? 'GRATIS' : `Rp ${item.finalPrice.toLocaleString('id-ID')}`}</p>
                                                }
                                                {item.isDiscounted && !isPaidWithPoints && <p className="text-[10px] text-gray-400 line-through">Rp {item.price.toLocaleString('id-ID')}</p>}
                                            </div>
                                            <button onClick={() => removeFromCart(item.cartId)} className="text-red-400 hover:text-red-600 p-1.5 rounded-xl hover:bg-red-50 active:bg-red-100 shrink-0">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Gunakan Poin toggle */}
                    {showPointsToggle && (
                        <div
                            onClick={() => canPayWithPoints && setUsePoints(prev => !prev)}
                            className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${
                                !canPayWithPoints
                                    ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                                    : usePoints
                                        ? 'bg-amber-50 border-amber-300 cursor-pointer'
                                        : 'bg-gray-50 border-gray-200 cursor-pointer hover:border-amber-200'
                            }`}
                        >
                            <div className={`p-2 rounded-xl shrink-0 ${usePoints && canPayWithPoints ? 'bg-amber-100' : 'bg-gray-100'}`}>
                                <Coins size={18} className={usePoints && canPayWithPoints ? 'text-amber-600' : 'text-gray-400'} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-bold ${usePoints && canPayWithPoints ? 'text-amber-800' : 'text-gray-600'}`}>
                                    Gunakan Poin
                                </p>
                                <p className="text-xs text-gray-500">
                                    Butuh <span className={`font-bold ${canPayWithPoints ? 'text-amber-600' : 'text-red-500'}`}>{totalPointsNeeded.toLocaleString('id-ID')} poin</span>
                                    {' · '}Punya <span className="font-bold text-gray-700">{customerPoints.toLocaleString('id-ID')}</span>
                                    {!canPayWithPoints && <span className="text-red-400"> · poin tidak cukup</span>}
                                </p>
                            </div>
                            <div className={`w-10 h-5 rounded-full transition-colors shrink-0 ${usePoints && canPayWithPoints ? 'bg-amber-400' : 'bg-gray-200'}`}>
                                <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mt-0.5 ${usePoints && canPayWithPoints ? 'translate-x-5' : 'translate-x-0.5'}`} />
                            </div>
                        </div>
                    )}

                    </>
                )}
                </div>

                {/* Footer */}
                {activeTab === 'cart' ? (
                    <div className="px-5 py-4 rounded-b-3xl shrink-0 space-y-3">
                        {targetTransaction && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-2xl">
                                <PlusCircle size={14} className="text-amber-600 shrink-0" />
                                <p className="text-xs text-amber-800 flex-1 min-w-0">
                                    Tambah ke <span className="font-bold font-mono">{targetTransaction.plate}</span>
                                </p>
                                <button
                                    onClick={() => setTargetTransaction(null)}
                                    className="text-amber-400 hover:text-amber-600 shrink-0"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                        {usePoints && totalPointsNeeded > 0 && (
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                                    <Coins size={12} /> Poin dipakai
                                </span>
                                <span className="text-sm font-bold text-amber-600">-{totalPointsNeeded.toLocaleString('id-ID')} poin</span>
                            </div>
                        )}
                        <div className="flex justify-between items-end">
                            <span className="text-gray-400 font-medium text-sm">Total</span>
                            <span className="text-2xl md:text-3xl font-bold text-blue-600">Rp {totalPrice.toLocaleString('id-ID')}</span>
                        </div>
                        {targetTransaction ? (
                            <button
                                onClick={handleAddItemsToLocalTx}
                                disabled={cart.length === 0}
                                className="w-full py-4 rounded-2xl font-bold text-base shadow-soft-md flex justify-center items-center gap-2 transition bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white disabled:opacity-50"
                            >
                                <PlusCircle size={18} /> Tambah ke Transaksi
                            </button>
                        ) : (
                            <button
                                onClick={handleCheckout}
                                disabled={cart.length === 0 || isSubmitting}
                                className="w-full py-4 rounded-2xl font-bold text-base shadow-soft-md flex justify-center items-center gap-2 transition bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white disabled:opacity-50"
                            >
                                {isSubmitting ? <Loader2 className="animate-spin" /> : <><Receipt size={18} /> Submit</>}
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="px-5 py-4 rounded-b-3xl shrink-0">
                        <p className="text-xs text-center text-gray-400">Pilih transaksi untuk diselesaikan</p>
                    </div>
                )}
            </div>

            {/* QR SCANNER MODAL — member */}
            {showQrScanner && (
                <QrScannerModal
                    onScan={handleQrScan}
                    onClose={() => setShowQrScanner(false)}
                />
            )}

            {/* QR SCANNER MODAL — guest (scan QR identity dari mobile app) */}
            {showGuestQrScanner && (
                <QrScannerModal
                    onScan={handleGuestQrScan}
                    onClose={() => setShowGuestQrScanner(false)}
                />
            )}

            {/* CONFIRM PAYMENT MODAL */}
            {payBill && (
                <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
                            <h3 className="font-bold text-gray-800 text-lg">Konfirmasi Pembayaran</h3>
                            <button onClick={() => { setPayBill(null); setPayBillTx(null); }} className="text-gray-400 hover:text-gray-600 p-1 rounded-xl hover:bg-gray-100">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 px-6 space-y-4 pb-2">
                            {/* Customer info */}
                            <div className="bg-gray-50 rounded-2xl p-4">
                                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Pelanggan</p>
                                <div className="flex items-center gap-3">
                                    <div className="bg-blue-100 rounded-xl p-2.5">
                                        <Car size={20} className="text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800 text-base">{payBillTx?.plate ?? '—'}</p>
                                        {payBillTx?.vehicleModel && (
                                            <p className="text-xs text-gray-500">{payBillTx.vehicleModel}</p>
                                        )}
                                        {payBillTx?.customerName && (
                                            <p className="text-xs text-gray-500">{payBillTx.customerName}</p>
                                        )}
                                    </div>
                                    <span className="ml-auto text-xs font-mono text-gray-400">{payBill.transaction_code}</span>
                                </div>
                            </div>

                            {/* Items list */}
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Produk</p>
                                <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100 overflow-hidden">
                                    {(payBillTx?.items ?? []).map((item, idx) => (
                                        <div key={item.cartId ?? idx} className="flex items-center gap-3 px-4 py-3 bg-white">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                                                {item.isDiscounted && (
                                                    <span className="text-xs text-emerald-600 font-medium">Diskon Member</span>
                                                )}
                                                {item.points_price && item.points_price > 0 && payBillTx?.usePoints && (
                                                    <span className="text-xs text-amber-600 font-medium flex items-center gap-0.5"><Coins size={10} /> Poin</span>
                                                )}
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-sm font-bold text-gray-800">
                                                    {item.points_price && item.points_price > 0 && payBillTx?.usePoints
                                                        ? `${item.points_price.toLocaleString('id-ID')} poin`
                                                        : `Rp ${item.finalPrice.toLocaleString('id-ID')}`
                                                    }
                                                </p>
                                                <p className="text-xs text-gray-400">x1</p>
                                            </div>
                                        </div>
                                    ))}
                                    {(!payBillTx?.items || payBillTx.items.length === 0) && (
                                        <div className="px-4 py-3 text-sm text-gray-400 text-center bg-white">Tidak ada item</div>
                                    )}
                                </div>
                            </div>

                            {/* Total */}
                            <div className="bg-blue-50 rounded-2xl px-4 py-3 flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-blue-400 uppercase">Total</p>
                                    {payBill.points_used > 0 && (
                                        <p className="text-xs text-amber-600 flex items-center gap-1 font-medium mt-0.5">
                                            <Coins size={11} /> {payBill.points_used.toLocaleString('id-ID')} poin digunakan
                                        </p>
                                    )}
                                </div>
                                <p className="text-2xl font-bold text-blue-600">Rp {payBill.total_amount.toLocaleString('id-ID')}</p>
                            </div>

                            {/* Payment method */}
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Metode Pembayaran</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setBillPaymentMethodId('1')}
                                        className={`flex items-center justify-center gap-2 p-3.5 rounded-2xl transition font-bold text-sm ${billPaymentMethodId === '1' ? 'bg-green-50 text-green-700 shadow-soft border border-green-200' : 'bg-gray-50 text-gray-400 active:bg-gray-100'}`}
                                    >
                                        <Banknote size={20} /> Tunai
                                    </button>
                                    <button
                                        onClick={() => setBillPaymentMethodId('2')}
                                        className={`flex items-center justify-center p-3 rounded-2xl transition ${billPaymentMethodId === '2' ? 'bg-blue-50 shadow-soft border border-blue-200' : 'bg-gray-50 active:bg-gray-100'}`}
                                    >
                                        <div className="grid grid-cols-3 gap-1.5 items-center">
                                            {[
                                                { src: 'https://snap-assets.al-pc-id-b.cdn.gtflabs.io/snap/v4/assets/qris-5ab65ea8ea12e00daee664042ed976a75c574fcd2fb1acd04e6cfc773d9bda54.svg',       alt: 'QRIS' },
                                                { src: 'https://snap-assets.al-pc-id-b.cdn.gtflabs.io/snap/v4/assets/gopay_text-dc3792bc8e707693e71dad3d2215258e7595f2143a7bba74070537d2eef1cdfe.svg',      alt: 'GoPay' },
                                                { src: 'https://snap-assets.al-pc-id-b.cdn.gtflabs.io/snap/v4/assets/shopeepay-befa05d168fe30229a3a68f8520595ceee165df888500c15502eb6f6ff26301c.svg',  alt: 'ShopeePay' },
                                                { src: 'https://snap-assets.al-pc-id-b.cdn.gtflabs.io/snap/v4/assets/dana-6abe773519fb933a350cf29b9221feb814e25618d7be02d290e8ff69505cac46.svg',       alt: 'DANA' },
                                                { src: 'https://snap-assets.al-pc-id-b.cdn.gtflabs.io/snap/v4/assets/visa-5e36b65d2243615099273be2fd269e201439dc0064105b2517bcc3cf85f0b06e.svg',       alt: 'Visa' },
                                                { src: 'https://snap-assets.al-pc-id-b.cdn.gtflabs.io/snap/v4/assets/mastercard-88522e14ce7d370c25d16071024fc87ba9256c5dca8bf5741fadb4948ff506d4.svg', alt: 'Mastercard' },
                                            ].map(logo => (
                                                <img
                                                    key={logo.alt}
                                                    src={logo.src}
                                                    alt={logo.alt}
                                                    className="h-5 w-auto object-contain"
                                                />
                                            ))}
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Confirm button */}
                        <div className="px-6 py-4 shrink-0">
                            <button
                                onClick={handleConfirmBillPayment}
                                disabled={isConfirming}
                                className="w-full py-4 rounded-2xl font-bold text-base bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white flex items-center justify-center gap-2 transition disabled:opacity-50"
                            >
                                {isConfirming ? <Loader2 className="animate-spin" /> : <><CheckCircle size={18} /> Konfirmasi Pembayaran</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
