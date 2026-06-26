# PROMPT KONSEP — Revamp 3D CarWashScene (untuk dieksekusi Sonnet)

> Target file: `ui-baxter-pos/src/app/dashboard/cashier/CarWashScene.tsx`
> Dipakai di: `ui-baxter-pos/src/app/dashboard/cashier/page.tsx` (baris 719, di dalam kartu "transaksi berjalan")
> Stack: Next.js (App Router, client component) + Three.js `^0.184.0` (procedural geometry, TANPA GLTF/asset loader). Pertahankan pendekatan procedural ini.

Kamu adalah senior graphics/frontend engineer. Kerjakan 4 hal di bawah pada komponen `CarWashScene`. Jaga API props yang sudah ada (`plate, model, brand, color, isMember, vehicleKind, className`) tetap kompatibel; hanya boleh **menambah** prop baru `phase` (lihat bagian 4). Pertahankan cleanup `useEffect` (dispose geometry/material/renderer) dan `ResizeObserver` yang sudah ada — jangan sampai memory leak.

---

## 1. FIX BUG: arah putaran roda salah (PRIORITAS UTAMA)

**Gejala:** roda mobil berputar 360° ke samping (yaw, seperti gasing/turntable). Seharusnya roda menggelinding ke depan/belakang (berputar terhadap poros/axle lateral).

**Akar masalah:** di animasi (`CarWashScene.tsx:449-451`) roda di-spin via `wheel.rotation.z += ...`. Karena mesh roda sudah di-`rotation.x = Math.PI/2`, pada urutan Euler intrinsic `XYZ` penambahan `rotation.z` justru memutar terhadap sumbu vertikal dunia → terlihat muter ke samping. Selain itu permukaan roda polos, jadi perputaran terhadap poros yang benar tidak kelihatan tanpa detail velg.

**Solusi yang diharapkan (rancangan, bukan harga mati — boleh diperbaiki):**

Bungkus tiap roda dengan struktur 2 grup supaya orientasi dan spin terpisah bersih:

```
wheelMount  (Group, di posisi roda, rotation.x = Math.PI/2 → poros searah sumbu Z lateral)
  └─ wheelSpin (Group, INI yang di-spin tiap frame: wheelSpin.rotation.y += rollSpeed)
       ├─ ban   (CylinderGeometry, axis lokal Y, TANPA rotasi tambahan)
       ├─ velg / hubcap
       └─ 5–6 jari-jari (spokes) ATAU brake disc kontras  ← WAJIB, biar putaran kebaca mata
```

- Spin yang benar = memutar `wheelSpin` terhadap poros lateralnya (local Y di dalam mount yang sudah di-tilt). Jangan pakai `rotateOnWorldAxis` (grup mobil ikut miring `rotation.y = -0.62` & ikut gerak pointer, world axis akan salah).
- `rollSpeed` harus **proporsional terhadap kecepatan maju mobil**: `rollSpeed = forwardVelocity / wheelRadius`. Saat idle (mobil cuma "goyang" dicuci) putaran roda kecil/0; saat fase "jalan" (bagian 4) putaran mengikuti kecepatan translasi. Pilih tanda (+/-) sehingga arah gelinding cocok dengan arah maju (nose mobil di +X).
- Simpan referensi grup `wheelSpin` ke `vehicle.userData.wheels` (ganti isi array lama) supaya loop animasi tinggal `w.rotation.y += rollSpeed`.

Terapkan logika yang sama untuk **motor** (`buildMotorcycle`) — motor sudah punya jari-jari, jadi tinggal pastikan spin terhadap poros yang benar, bukan yaw.

---

## 2. TIGA MODEL MOBIL BARU yang bagus (ganti `buildCar` yang sekarang)

Mobil sekarang terlihat kotak & "ngambang". Buat **3 model procedural** dengan siluet & proporsi berbeda, masing-masing sebagai builder terpisah, lalu sebuah dispatcher memilih model. Default pemilihan: deterministik dari `plate` (hash sederhana → 0..2) supaya tiap kendaraan konsisten tapi bervariasi; member tetap pakai warna `color`, non-member tetap gelap (logika `resolveColor` dipertahankan).

Tiga model:

1. **Executive Sedan** — rendah & panjang, kap mesin panjang, atap fastback melandai, garis karakter samping, velg medium. Elegan.
2. **Urban SUV / Crossover** — kabin lebih tinggi & tegak, ground clearance lebih, roof rails, velg lebih besar & gagah, bumper chunky.
3. **Sport Hatch / Coupe** — pendek, rake agresif, atap menurun cepat, velg besar, ada rear spoiler/diffuser, paling ceper.

Prinsip kualitas visual ("bagus"):
- Proporsi & grounding benar: roda menyentuh lantai, fender well rapi menutupi atas ban, bodi tidak melayang.
- Pakai bevel halus (`RoundedBoxGeometry` yang sudah ada) + beberapa segmen bodi (hood, fender, rocker/side skirt, greenhouse) untuk siluet yang lebih organik, bukan satu balok.
- Detail penegas: kaca depan/belakang miring, pilar A, grille, headlight & taillight tipis, side mirror, plat nomor (pertahankan `createPlateTexture`).
- **Upgrade material/lighting (efek paling besar ke kualitas):** tambahkan environment map via `RoomEnvironment` + `PMREMGenerator` lalu set `scene.environment` — supaya `MeshPhysicalMaterial` (clearcoat) memantulkan lingkungan dan cat terlihat premium/realistis. Pertahankan key/hemi/fill light yang ada, tuning seperlunya.
- Tambahkan **contact shadow** lembut di bawah mobil (mis. radial-gradient alpha plane atau blob shadow) agar mobil "menapak".

Jaga skala konsisten dengan scene & kamera saat ini (kamera `position (4.9,3.25,6.4)`, fov 36). Sesuaikan posisi foam/droplet/brush kalau dimensi bodi berubah.

---

## 3. ANIMASI SMOOTH (delta-time based)

- Ganti animasi berbasis hitungan frame (`frame += 1; Math.sin(frame*...)`) menjadi **berbasis waktu** pakai `THREE.Clock` (`elapsed` & `delta`). Ini bikin gerak konsisten di refresh-rate berapa pun (60/120Hz) dan smooth.
- Idle "sedang dicuci": bob naik-turun halus, sedikit sway, brush berputar, droplet jatuh, foam opacity berdenyut — semua pakai easing lembut (hindari gerak patah).
- Interpolasi kamera/group ke arah pointer pakai damp yang frame-rate independent (mis. `MathUtils.damp`) bukan faktor konstan `* 0.055`.
- Hormati `prefers-reduced-motion`: kalau aktif, kurangi/hentikan gerak idle (aksesibilitas).

---

## 4. KLIK "BAYAR" → MOBIL JALAN LALU PARKIR

Saat kasir menyelesaikan transaksi, mobil harus **melaju maju lalu pelan-pelan parkir** (animasi keluar yang memuaskan).

Integrasi:
- Tombol per-transaksi ada di `page.tsx:768` (`handleFinishTransaction(tx)`, label "Selesai"/"Bayar"). 
- Tambah prop baru ke `CarWashScene`: `phase?: 'washing' | 'paying'` (default `'washing'`). Saat tombol diklik, parent men-set state sehingga `CarWashScene` untuk transaksi itu menerima `phase='paying'`. (Implementasikan state minimal di `page.tsx`: tandai `localId` yang sedang "paying"; jangan ubah logika bisnis checkout yang sudah ada — cukup pemicu visual.)

Perilaku saat `phase` berubah ke `'paying'`:
1. Brush/foam/droplet fade-out (cuci selesai).
2. Mobil **akselerasi maju** sepanjang +X; `forwardVelocity` naik dari 0 → max dengan ease-in, roda menggelinding proporsional (pakai mekanisme bagian 1).
3. Lalu **deselerasi (ease-out)** dan berhenti pas di "slot parkir" (mis. target X tertentu di tepi frame, sedikit yaw membelok ke slot bila mau lebih keren), roda berhenti.
4. Setelah parkir, boleh tampilkan badge kecil "Selesai / Parked" (opsional, non-blocking).

Gunakan easing (`MathUtils.smoothstep`/kurva ease-in-out) berbasis waktu. Pastikan animasi tidak bergantung pada re-mount; transisi dipicu oleh perubahan nilai prop `phase`, dan `requestAnimationFrame` loop membaca state terbaru via ref (hindari stale closure — simpan `phase` di `useRef` yang di-update di `useEffect` terpisah).

---

## ACCEPTANCE CRITERIA
- [ ] Roda mobil & motor menggelinding ke depan/belakang (putar terhadap poros lateral), TIDAK lagi muter ke samping. Putaran kebaca mata (ada velg/jari-jari).
- [ ] Kecepatan putar roda proporsional dengan kecepatan maju mobil.
- [ ] Ada 3 model mobil procedural berbeda & lebih bagus; dipilih deterministik dari `plate`.
- [ ] Cat terlihat premium (env map/PMREM), mobil menapak (contact shadow), proporsi benar.
- [ ] Semua animasi delta-time based & smooth; hormati `prefers-reduced-motion`.
- [ ] Klik "Bayar/Selesai" → mobil akselerasi maju lalu ease-out parkir & berhenti.
- [ ] Tidak ada memory leak: dispose lengkap di cleanup (termasuk PMREM/env map & resource baru).
- [ ] `npm run build` / lint lolos; TypeScript strict, tanpa `any` baru (hindari pola `any` lama; tipekan mesh/group dengan benar).

## CATATAN
- Tetap procedural (tanpa GLTF) sesuai arsitektur sekarang. Jika nanti diinginkan model lebih realistis, GLTF + `GLTFLoader`/Draco adalah opsi terpisah — JANGAN dikerjakan sekarang kecuali diminta.
- Jangan menambah dependency baru selain modul yang sudah tersedia di paket `three` (`three/examples/jsm/...` boleh: `RoomEnvironment`, `PMREMGenerator` ada di core).
- Jangan ubah logika bisnis checkout (`handleCheckout`, `handleConfirmBillPayment`, Midtrans) — sentuhan di `page.tsx` hanya sebatas memicu `phase` visual.
