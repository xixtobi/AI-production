# ARSITEKTUR SISTEM (SYSTEM ARCHITECTURE)
**LOCAL PRODUCTION CONTROL — VERSI 1.0.0**

Dokumen ini menjelaskan arsitektur perangkat lunak, batas-batas subsistem (*system boundaries*), model persistensi data lokal, serta prinsip keamanan dan privasi yang diterapkan pada **Local Production Control**.

---

## 1. Prinsip Desain Utama

1. **Local-First & Zero Cloud Dependency**:
   - Seluruh status produksi dan metadata disimpan dalam basis data SQLite lokal.
   - Tidak ada kebutuhan akun pengguna, server autentikasi terpusat, atau database cloud (seperti Firebase/Supabase) agar aplikasi dapat berfungsi normal.
2. **Kedaulatan Data & Privasi Studio**:
   - Berkas naskah, aset visual rahasia, prompt komersial, dan hasil render tetap berada di dalam drive workstation fisik pengguna.
   - Tidak ada telemetri diam-diam atau pengunggahan data otomatis ke server pihak ketiga.
3. **Penyedia AI Tunggal (Google Gemini API)**:
   - Integrasi model AI secara eksklusif menggunakan **Google Gemini API** (`gemini-3.8-flash`) via SDK resmi `@google/genai`.
   - Tidak ada arsitektur hybrid multi-vendor yang membingungkan atau membocorkan data ke provider lain.
4. **Human-in-the-Loop Gatekeeping**:
   - AI hanya bertindak sebagai asisten pembuat draf, penasihat kontinuitas, dan pengurang friksi.
   - Tidak ada aksi AI yang secara sepihak mengubah atau menimpa rekaman produksi tanpa persetujuan eksplisit manusia (*Explicit Accept/Apply*).

---

## 2. Diagram Arsitektur Tingkat Tinggi

```
+-------------------------------------------------------------------------+
|                         PENGGUNA / OPERATOR                             |
|             (Peramban Web Lokal: http://127.0.0.1:3000)                 |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                  APLIKASI NEXT.JS 16 (APP ROUTER)                       |
|                                                                         |
|  +-----------------------+  +-----------------------+  +-------------+  |
|  |     Script Studio     |  |     Prompt Studio     |  | Flow Queue  |  |
|  +-----------------------+  +-----------------------+  +-------------+  |
|  | QC & Continuity Board |  | Storage & System Card |  | Backup & Exp|  |
|  +-----------------------+  +-----------------------+  +-------------+  |
|                                                                         |
|  [ Server Components & API Handlers (Node.js React-Server Environment) ]|
+---------------------+-------------------+-------------------------------+
                      |                   |
        +-------------+                   +---------------+
        |                                                 |
        v                                                 v
+-----------------------+                     +-----------------------+
|  BETTER-SQLITE3 +     |                     | GOOGLE GEMINI API     |
|  DRIZZLE ORM          |                     | Provider: Google      |
|                       |                     | Model: gemini-3.8-    |
| - production-control  |                     |        flash          |
|   .sqlite (WAL Mode)  |                     | Output: Structured    |
| - Foreign Keys On     |                     |         JSON Schema   |
| - PRAGMA Integrity    |                     +-----------------------+
+-----------+-----------+
            |
            v
+-------------------------------------------------------------------------+
|                  SISTEM BERKAS WORKSTATION (WINDOWS)                    |
|                                                                         |
|  D:\AI-PRODUCTION\<KODE-PROYEK>\                                        |
|  ├── CONTENT\<EPISODE>\<SHOT>\                                          |
|  │   ├── PROMPTS\                                                       |
|  │   ├── REFERENCES\                                                    |
|  │   ├── GENERATIONS\ (Paket Flow terisolasi)                           |
|  │   └── OUTPUTS\ (Render video terverifikasi SHA-256)                  |
|  ├── ASSETS\ (Karakter, Lingkungan, Model Sheets)                       |
|  └── BACKUPS\ (Snapshot non-overwriting & Safety Backups)               |
+-------------------------------------------------------------------------+
```

---

## 3. Komponen Inti Subsistem

### A. Persistensi Data (SQLite + Drizzle ORM)
- **Engine**: `better-sqlite3` dijalankan dalam mode sinkron langsung pada runtime Node.js.
- **Integritas**:
  - `PRAGMA foreign_keys = ON;` ditegakkan di setiap sesi koneksi untuk mencegah data yatim (*orphaned records*).
  - Mode **WAL (Write-Ahead Logging)** aktif secara default untuk menjamin konkurensi baca-tulis tinggi tanpa deadlock.
  - Relasi berjenjang: `projects` → `seasons` → `content_items` → `scenes` → `shots` → `flow_queue_items` → `video_outputs` → `qc_reviews`.

### B. Lapisan AI: Google Gemini Service (`gemini-3.8-flash`)
- **SDK**: `@google/genai` (Google Gen AI SDK terbaru).
- **Rute Permintaan**:
  - Script Assistance (Dialog, perbaikan adegan, proposal breakdown).
  - Prompt Translation & Enrichment (Menghasilkan prompt sinematik Bahasa Inggris dan prompt negatif).
  - Continuity Auditing (Menganalisis anomali visual antar-keyframe).
- **Skema Terstruktur**: Seluruh respons AI diwajibkan menggunakan mode `responseSchema` bertipe JSON murni. Jika AI mengembalikan struktur tidak valid, sistem menangani galat secara anggun tanpa merusak antarmuka.
- **Audit Penggunaan Token**: Setiap panggilan AI dicatat dalam tabel `ai_requests` lengkap dengan jumlah token masukan/keluaran, parameter temperatur, dan waktu respons.

### C. Batasan Google Flow (Video Production Boundary)
- **Kepatuhan Kebijakan**: Sistem **TIDAK PERNAH**:
  - Melakukan otomasi peramban tanpa kepala (*headless browser automation* seperti Puppeteer/Selenium) ke situs Google Flow.
  - Mengambil/menyalin cookie atau kredensial akun Google pengguna.
  - Melakukan *web scraping* atau mencoba menembus mekanisme autentikasi Google.
- **Pola Kontrol Produksi**:
  - Sistem bertindak sebagai *preparation & registry layer*.
  - Menyusun bundel siap pakai di direktori lokal (`prompt.txt`, `manifest.json`, aset referensi).
  - Membuka peramban default pengguna ke URL resmi Google Flow melalui tautan eksternal standar.
  - Mengimpor kembali video hasil render yang telah diunduh oleh pengguna ke dalam folder shot resmi dengan pencatatan hash kriptografi SHA-256.

### D. Sistem Cadangan & Disaster Recovery
- **Non-Overwriting Directories**: Setiap operasi pencadangan membuat folder bertanda waktu presisi detik (misal: `_BACKUP_2026-09-27T19-30-00_METADATA_BACKUP`). Sistem membatalkan operasi jika terjadi tabrakan nama untuk mencegah kehilangan data.
- **Manifest Checksum SHA-256**: Setiap berkas dalam cadangan dicatat hash SHA-256 nya di dalam `manifest.json`. Validasi cadangan memverifikasi setiap berkas untuk mendeteksi korupsi atau manipulasi eksternal.
- **Safety Backup Mechanism**: Saat perintah pemulihan (*Restore*) dijalankan, sistem secara otomatis mengeksekusi pencadangan pengaman (*Safety Backup*) terlebih dahulu sebelum menghapus atau memperbarui tabel database.

### E. Ekspor-Impor Mandiri & Portabilitas
- **Isolasi Proyek**: Data proyek diekspor ke dalam folder mandiri portabel yang memuat `project.json`, `manifest.json`, dan `database-export.json`.
- **ID Remapping**: Saat diimpor ke komputer lain (atau mesin yang sama), seluruh ID entitas (`projectId`, `shotId`, `assetId`, dll.) otomatis dipetakan ulang ke UUID baru untuk mencegah tabrakan primary key.
- **Resolusi Konflik Kode**: Jika kode proyek sudah ada, pengguna dapat memilih `RENAME` (menambah sufiks unik), `OVERWRITE` (menimpa bersih), atau `FAIL` (membatalkan impor).

---

## 4. Keamanan & Sanitasi

1. **Loopback Binding**:
   - Skrip peluncur Windows (`start-production-control.bat` dan `launch.cmd`) secara ketat mengikat server ke `127.0.0.1:3000`.
   - Server tidak membuka port ke jaringan publik (*0.0.0.0* dilarang secara default).
2. **Sanitasi Kunci API (Redaction)**:
   - Kunci `GEMINI_API_KEY` tidak pernah dikirimkan ke peramban klien.
   - Logger sistem internal secara otomatis mendeteksi pola `AIzaSy...` atau kunci rahasia lainnya dan menyamarkannya menjadi `[REDACTED_KEY]` sebelum ditulis ke berkas log disk (`production-control.log`).
3. **Pencegahan Path Traversal**:
   - Seluruh akses berkas diverifikasi berada di dalam `project.rootPath`.
   - Pola traversal seperti `../` atau karakter pemisah ganda langsung ditolak dengan `DomainError (400)`.

---
**Status Arsitektur**: Final v1.0.0. Arsitektur telah dibekukan dan terverifikasi penuh melalui 98 acceptance dan unit tests.
