# PANDUAN PENCADANGAN & PEMULIHAN (BACKUP & RESTORE GUIDE)
**LOCAL PRODUCTION CONTROL — VERSI 1.0.0**

Dokumen ini menjelaskan prosedur pencadangan deterministik, validasi integritas checksum SHA-256, mekanisme pemulihan darurat (*disaster recovery*), ekspor-impor mandiri, dan migrasi direktori root proyek.

---

## 1. Strategi Pencadangan (Backup Strategy)

Aplikasi menyediakan dua jenis pencadangan yang disesuaikan dengan kebutuhan studio:

| Tipe Cadangan | Isi Cadangan | Waktu Eksekusi | Ukuran File | Rekomendasi Penggunaan |
|---|---|---|---|---|
| **METADATA_BACKUP** | Basis data SQLite, project.json, metadata naskah, prompt, relasi shot, QC log, dan audit trail. | < 1 detik | < 5 MB | Setiap kali ada pembaruan naskah, perubahan prompt, atau di akhir sesi kerja harian. |
| **FULL_PROJECT_BACKUP** | Seluruh metadata ditambah salinan fisik semua berkas aset (gambar keyframe, model sheets, video render, audio, dokumen naskah). | Tergantung ukuran disk (1-3 menit) | 500 MB – 50 GB+ | Setiap akhir minggu, sebelum pembaruan sistem operasi, atau setelah master konten disetujui (*Release*). |

---

## 2. Struktur Paket Cadangan

Setiap cadangan disimpan dalam folder bertanda waktu presisi yang **tidak pernah menimpa** cadangan lama:
```
D:\AI-PRODUCTION\LEMBAH-AWAN\backups\
└── LEMBAH-AWAN_BACKUP_2026-09-27T19-30-00_METADATA_BACKUP\
    ├── manifest.json            # Berkas identitas, statistik tabel, & hash SHA-256
    ├── project.json             # Konfigurasi dasar entitas proyek
    ├── metadata-dump.json       # Seluruh baris tabel SQLite terkait proyek
    ├── database-dump.json       # Draf cadangan skema relasional
    └── assets\                  # (Hanya ada pada FULL_PROJECT_BACKUP)
        ├── CONTENT\
        └── ASSETS\
```

### Anatomi `manifest.json`
```json
{
  "backupId": "d3b07384-d113-469b-8fd1-a3f295b9c02d",
  "projectId": "project-uuid-here",
  "projectCode": "LEMBAH-AWAN",
  "projectName": "Petualangan di Lembah Awan",
  "backupType": "METADATA_BACKUP",
  "appVersion": "1.0.0",
  "createdAt": "2026-09-27T12:30:00.000Z",
  "totalSizeBytes": 245760,
  "totalFiles": 3,
  "tables": {
    "shots": 91,
    "scenes": 7,
    "scriptDocuments": 1,
    "promptDocuments": 4,
    "qcReviews": 12
  },
  "checksums": {
    "metadata-dump.json": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "database-dump.json": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "project.json": "5d41402abc4b2a76b9719d911017c592..."
  },
  "sourceRootPath": "D:\\AI-PRODUCTION\\LEMBAH-AWAN"
}
```

---

## 3. Validasi Keutuhan Cadangan (Tamper & Corruption Detection)

Sebelum sebuah cadangan dipulihkan, sistem secara otomatis mengeksekusi fungsi `validateBackup(backupPath)`:
1. **Pemeriksaan Eksistensi Manifest**: Memastikan `manifest.json` ada dan dapat dibaca.
2. **Pemeriksaan Berkas Fisik**: Memastikan seluruh berkas yang terdaftar dalam manifest benar-benar ada di disk.
3. **Verifikasi Hash SHA-256**: Menghitung ulang hash SHA-256 dari setiap berkas di disk dan membandingkannya dengan hash yang tersimpan dalam manifest. Jika ada berkas yang diubah secara manual di luar aplikasi, sistem menolak pemulihan dengan galat:
   ```text
   Checksum tidak cocok untuk berkas metadata-dump.json. Kemungkinan data rusak atau dimanipulasi.
   ```

---

## 4. Prosedur Pemulihan (Restore) & Jaminan Safety Backup

Proses pemulihan data dirancang anti-gagal (*fail-safe*):

1. **Konfirmasi Eksplisit**:
   - Pemulihan tidak dapat dijalankan secara tidak sengaja.
   - Pengguna wajib memasukkan kode teks: `RESTORE`.
2. **Pencadangan Pengaman Otomatis (Automatic Safety Backup)**:
   - Sebelum satu pun data diubah atau dihapus, sistem **selalu membuat pencadangan metadata instan** dari kondisi proyek saat ini.
   - Nama folder cadangan pengaman diberi penanda khusus:
     `LEMBAH-AWAN_SAFETY_BACKUP_2026-09-27T19-35-00_METADATA_BACKUP`.
   - ID cadangan pengaman dicatat dalam audit trail.
3. **Pembersihan & Penulisan Transaksional**:
   - Seluruh baris tabel lama dibersihkan secara berjenjang mengikuti relasi *foreign key* (`continuityChecks` → `qcReviews` → `videoOutputs` → `flowQueue` → `shots` → `scenes` → `contentItems` → `seasons`).
   - Baris dari arsip cadangan disisipkan kembali di dalam blok transaksi SQLite (`db.transaction()`). Jika terjadi gangguan listrik di tengah proses, transaksi otomatis di-*rollback* ke kondisi semula.
4. **Pemulihan Berkas Fisik (Full Backup)**:
   - Jika cadangan bertipe `FULL_PROJECT_BACKUP`, berkas aset fisik disalin kembali ke folder proyek aktif tanpa menghapus berkas di luar daftar cadangan.

---

## 5. Ekspor & Impor Portabel Proyek (Portable Project Sharing)

Fitur ini digunakan untuk memindahkan satu judul proyek ke workstation lain tanpa memindahkan seluruh database studio:

### Mengekspor Proyek
1. Buka menu **Cadangan & Pemulihan → Ekspor Portabel**.
2. Pilih apakah ingin menyertakan aset fisik (`includeAssets: true/false`).
3. Klik **Ekspor Proyek**.
4. Folder ekspor mandiri dibuat di `exports/EXPORT_<KODE-PROYEK>_<TIMESTAMP>/`. Salin folder ini ke media penyimpanan eksternal.

### Mengimpor Proyek
1. Buka menu **Pengaturan Sistem → Impor Proyek** atau tab Impor di ruang kerja cadangan.
2. Masukkan path folder ekspor dan folder tujuan di komputer baru.
3. Tentukan opsi resolusi jika kode proyek sudah ada di sistem tujuan:
   - `RENAME` (Disarankan): Proyek diimpor sebagai entitas baru dengan kode unik (misal: `LEMBAH-AWAN_IMPORTED`).
   - `OVERWRITE`: Menimpa proyek yang sudah ada.
   - `FAIL`: Membatalkan impor jika terjadi duplikasi kode.
4. **ID Remapping Otomatis**: Semua entitas diberi UUID baru sehingga tidak ada benturan database.
5. **Indeks Aset Otomatis**: Setelah impor selesai, sistem otomatis memindai dan membangun ulang indeks aset proyek di disk.

---

## 6. Migrasi Direktori Root Proyek (Project Root Migration)

Jika kapasitas drive Anda penuh dan folder proyek harus dipindahkan (misal: dari `D:\AI-PRODUCTION\LEMBAH-AWAN` ke `E:\ANIMATION-DRIVE\LEMBAH-AWAN`):

1. **Pindahkan Folder Fisik Terlebih Dahulu**:
   - Salin/pindahkan seluruh isi folder `D:\AI-PRODUCTION\LEMBAH-AWAN` ke lokasi baru `E:\ANIMATION-DRIVE\LEMBAH-AWAN` menggunakan Windows Explorer.
2. **Perbarui Lokasi di Aplikasi**:
   - Buka menu **Cadangan & Pemulihan → Pengaturan Proyek & Migrasi Root**.
   - Masukkan path absolut baru: `E:\ANIMATION-DRIVE\LEMBAH-AWAN`.
   - Klik **Migrasi Project Root**.
3. **Verifikasi Otomatis**:
   - Sistem memvalidasi bahwa path baru adalah direktori valid dan dapat ditulis (*writable*).
   - Memperbarui kolom `root_path` pada tabel `projects`.
   - Menjalankan pemindaian ulang indeks aset untuk memastikan seluruh path relatif tetap terhubung dengan berkas fisik baru.
   - Melaporkan jika ada berkas yang tertinggal atau hilang saat pemindahan manual.
