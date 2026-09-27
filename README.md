# LOCAL PRODUCTION CONTROL

**Versi 1.0.0 (Production Release)**  
*Sistem Kontrol dan Manajemen Produksi Video Lokal-Pertama Berbasis AI (Google Gemini API & Google Flow).*

---

## 📌 Ringkasan Sistem

**Local Production Control** adalah platform kontrol produksi terintegrasi untuk studio animasi dan kreator konten (UGC/video komersial). Aplikasi ini didesain dengan prinsip **Local-First**, **Privasi Total**, dan **Kontrol Manusia Mutlak** (*Human-in-the-Loop*). 

Semua berkas produksi, naskah, aset visual, audio, dan riwayat revisi disimpan langsung di media penyimpanan lokal workstation Windows Anda, tanpa ketergantungan pada server cloud eksternal atau database pihak ketiga.

---

## 🚀 Fitur Utama (Fase 1 – 9 Lengkap)

### 1. **Local-First Architecture & Windows Native**
- Berbasis **SQLite** lokal berperforma tinggi (`better-sqlite3` + `Drizzle ORM`) dengan mode WAL.
- Pengelola direktori lokal otomatis di `D:\AI-PRODUCTION\<KODE-PROYEK>\`.
- Runner satu-klik untuk Windows: `start-production-control.bat` dan `launch.cmd` (terisolasi ketat pada `127.0.0.1:3000`).
- Terintegrasi langsung dengan Windows Explorer (*Reveal in Explorer*).

### 2. **Script Studio (Fase 5)**
- Alur bertahap: **Idea → Story Documents → Outlines → Script → Scenes → Shot Breakdown**.
- Sistem versioning naskah non-destruktif (**V01, V02, dst.**) dengan fitur snapshot penguncian (*Locking*).
- Bantuan AI Naskah via Google Gemini (`gemini-3.8-flash`) dengan deteksi dampak perubahan naskah (*Change Impact Analysis*).

### 3. **Prompt Studio (Fase 6)**
- Jembatan penulisan prompt visual dari naskah, karakter, lingkungan, dan aset referensi ke generator AI (Google Flow, Veo, Midjourney, Kling).
- Kompilasi prompt terstruktur luring (*Offline Structured Prompt Compiler*) dan bantuan Gemini Prompt Assistant.
- Pelacakan revisi prompt, perbandingan versi berdampingan (*Side-by-Side Diff*), dan penguncian prompt kanon.

### 4. **Flow Queue & Video Production (Fase 7)**
- Manajemen antrean generasi video untuk Google Flow tanpa otomatisasi UI/scraping terlarang.
- Penyiapan paket generasi mandiri (`manifest.json`, `prompt.txt`, `generation-settings.json`, folder `references/`).
- Pendaftaran video output terverifikasi (*SHA-256*, resolusi, durasi, status QC) dengan pemetaan generasi (*Generation Attempts*).

### 5. **QC, Continuity & Production Dashboard (Fase 8)**
- Manajemen ulasan Quality Control dengan checklist 17-poin standar industri.
- Penegakan kontinuitas visual, karakter, dan kostum antar-shot.
- *Strict Gatekeeping*: Masalah QC tingkat **CRITICAL** dan **MAJOR** secara tegas memblokir persetujuan akhir (*Final Review*), sedangkan **MINOR** tidak memblokir.
- Audit readiness produksi objektif tanpa skor buatan atau angka rekaan.

### 6. **Production Hardening, Backup & Release (Fase 9)**
- **Deterministic Backup & Restore**: Pilihan *Metadata Backup* atau *Full Project Backup* dengan checksum manifest SHA-256, folder berstempel waktu anti-timpa, dan pencadangan pengaman otomatis (*Safety Backup*) sebelum pemulihan.
- **Portable Export & Import**: Ekspor proyek portabel mandiri untuk kolaborasi antar-mesin dengan resolusi konflik kode (`RENAME`, `OVERWRITE`, `FAIL`) dan pemetaan ulang ID.
- **Global Search (`Ctrl+K`)**: Modal navigasi cepat lintas kode shot (`SH016`), aset (`KF-B08`), dialog, dan catatan produksi dengan prioritas bobot.
- **Project & System Health**: Audit faktual berbasis PRAGMA integrity SQLite, pemantauan kapasitas penyimpanan disk, dan pembersih cache.
- **Audit & Technical Logging**: Audit aktivitas produksi pengguna dan log teknis tersanitasi yang otomatis menyamarkan token/kunci API sensitif.

---

## 💻 Kebutuhan Sistem

- **Sistem Operasi**: Windows 10 atau Windows 11 (64-bit)
- **Node.js**: v20.9.0 atau yang lebih baru (disarankan v22+ / v24)
- **NPM**: Terpasang bersama Node.js
- **Penyimpanan**: Minimal 10 GB ruang kosong pada drive lokal (misal `D:\` atau `C:\`)
- **Akses Internet**: Hanya diperlukan saat instalasi awal paket `npm` dan saat memanggil Google Gemini API (fitur offline tetap berfungsi 100% tanpa internet).

---

## ⚡ Panduan Memulai Cepat (Quick Start)

### 1. Instalasi Dependensi
Buka terminal PowerShell di folder repositori ini:
```powershell
npm install
```

### 2. Konfigurasi Lingkungan
Buat berkas `.env.local` di root proyek:
```env
# Kunci API Google Gemini (Wajib untuk fitur AI assist)
GEMINI_API_KEY=AIzaSy...kunci-anda-disini

# Opsional: Direktori basis data & cache (default: .local-production-control)
# PRODUCTION_CONTROL_DATA_DIR=C:\Users\Username\.local-production-control
```

### 3. Menjalankan Server Pengembangan
```powershell
npm run dev
```
Buka peramban Anda di [http://127.0.0.1:3000](http://127.0.0.1:3000).

### 4. Menjalankan di Lingkungan Produksi
Untuk kompilasi produksi yang dioptimalkan:
```powershell
npm run build
npm run start
```
Atau cukup klik dua kali pada skrip Windows Portable:
- `start-production-control.bat`
- atau `launch.cmd`

Aplikasi akan otomatis mengompilasi jika diperlukan dan membuka peramban di `http://127.0.0.1:3000`.

---

## ⌨️ Pintasan Papan Ketik (Keyboard Shortcuts)

| Pintasan | Fungsi |
|---|---|
| `Ctrl + K` | Membuka Modal Pencarian Global & Palet Perintah |
| `Esc` | Menutup Modal Pencarian / Dialog Aktif |
| `↑` / `↓` | Navigasi hasil pencarian |
| `Enter` | Memilih dan membuka item hasil pencarian |

---

## 📁 Struktur Direktori Standar Produksi

Saat proyek dibuat (contoh: `LEMBAH-AWAN`), aplikasi menstrukturkan folder di `D:\AI-PRODUCTION\LEMBAH-AWAN\`:
```
D:\AI-PRODUCTION\LEMBAH-AWAN\
├── CONTENT\
│   └── EP01\
│       ├── SH001\
│       │   ├── PROMPTS\
│       │   ├── REFERENCES\
│       │   ├── GENERATIONS\
│       │   └── OUTPUTS\
│       ├── SH016\
│       └── ...
├── ASSETS\
│   ├── CHARACTERS\
│   ├── ENVIRONMENTS\
│   ├── PROPS\
│   └── STYLE\
├── BACKUPS\
├── EXPORTS\
├── SCRIPTS\
└── .cache\
```

---

## 🧪 Pengujian & Verifikasi Kualitas

Aplikasi dilengkapi dengan rangkaian pengujian unit, integrasi, dan acceptance test 29-langkah:
```powershell
# Pemeriksaan tipe data TypeScript
npm run typecheck

# Audit kode ESLint
npm run lint

# Menjalankan seluruh test suite (98/98 tests)
npm test

# Membangun bundle produksi Next.js
npm run build
```

---

## 📚 Dokumentasi Lengkap

Untuk panduan mendalam, silakan baca dokumentasi pendukung berikut:
- 📖 [Panduan Pengguna (USER-GUIDE.md)](./USER-GUIDE.md) — Manual lengkap produser, penulis, prompt engineer, dan operator QC.
- 🏗️ [Arsitektur Sistem (ARCHITECTURE.md)](./ARCHITECTURE.md) — Desain teknis SQLite, Next.js, Gemini API, dan proteksi integritas data.
- 🎬 [Alur Kerja Produksi (PRODUCTION-WORKFLOW.md)](./PRODUCTION-WORKFLOW.md) — Panduan langkah-demi-langkah dari ide hingga final review master.
- 💾 [Panduan Cadangan & Pemulihan (BACKUP-GUIDE.md)](./BACKUP-GUIDE.md) — Prosedur pencadangan, validasi SHA-256, ekspor-impor, dan disaster recovery.
- 🔧 [Solusi Masalah (TROUBLESHOOTING.md)](./TROUBLESHOOTING.md) — Penyelesaian galat umum, perbaikan direktori, dan PRAGMA integrity check.

---

## 🛡️ Kebijakan Batasan & Privasi

1. **AI Provider Tunggal**: Hanya menggunakan **Google Gemini API** (`gemini-3.8-flash`). Tidak ada data naskah atau rahasia yang dikirimkan ke model/penyedia AI pihak ketiga lainnya.
2. **Kerahasiaan Kunci API**: Kunci `GEMINI_API_KEY` tidak pernah terekspos ke sisi klien (browser) dan seluruh log teknis secara otomatis menyamarkan token sensitif (`[REDACTED_KEY]`).
3. **Batas Generasi Video**: Sistem ini adalah kontrol produksi di sekitar **Google Flow**, bukan robot peramban otomatis. Aplikasi tidak menyusup atau memanipulasi cookie Google Flow demi menjaga keamanan akun dan kepatuhan terhadap ketentuan layanan.

---
**Status Rilis**: Rilis Final v1.0.0 (Fase 1–9 Selesai). Pengembangan arsitektur baru dihentikan sesuai instruksi Phase 9.
