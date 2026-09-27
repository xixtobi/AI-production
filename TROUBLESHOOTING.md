# PANDUAN PEMECAHAN MASALAH (TROUBLESHOOTING)
**LOCAL PRODUCTION CONTROL — VERSI 1.0.0**

Dokumen ini memuat solusi praktis dan langkah-langkah diagnostik untuk mengatasi masalah teknis yang mungkin terjadi saat menjalankan **Local Production Control**.

---

## 1. Masalah Koneksi & Kunci API Google Gemini

### Gejala:
- Muncul pesan: *"Kunci API Gemini belum dikonfigurasi (fitur AI dalam mode offline)"*.
- Tombol AI menghasilkan galat: *"Kunci API Gemini tidak valid atau kuota terlampaui"*.

### Penyebab & Solusi:
1. **Kunci API Belum Didaftarkan**:
   - Pastikan berkas `.env.local` ada di direktori root aplikasi.
   - Periksa baris `GEMINI_API_KEY=AIzaSy...`. Pastikan tidak ada spasi di awal atau akhir nilai kunci.
2. **Kunci API Disimpan di Pengaturan**:
   - Anda juga dapat memasukkan kunci langsung melalui antarmuka: **Pengaturan Sistem → Konfigurasi Gemini AI**.
   - Klik **Uji Koneksi AI**. Jika berhasil, indikator akan berubah menjadi hijau (*TERHUBUNG*).
3. **Mode Luring Tetap Berfungsi**:
   - Aplikasi dirancang untuk bertahan tanpa koneksi AI. Penulisan naskah manual, kompilasi prompt terstruktur, pengelolaan Flow Queue, pendaftaran video, dan penguncian QC tetap berjalan 100% normal.

---

## 2. Port 3000 Sedang Digunakan (Port Conflict)

### Gejala:
- Terminal menampilkan pesan galat: `Error: listen EADDRINUSE: address already in use 127.0.0.1:3000`.

### Penyebab & Solusi:
Proses Node.js lain atau aplikasi web lain sedang menggunakan port 3000.
1. Buka PowerShell sebagai Administrator dan cari PID proses yang menggunakan port 3000:
   ```powershell
   Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess
   ```
2. Hentikan proses tersebut:
   ```powershell
   Stop-Process -Id <PID> -Force
   ```
3. Atau jalankan aplikasi di port alternatif:
   ```powershell
   npx next start -p 3005 -H 127.0.0.1
   ```

---

## 3. Peringatan Ruang Penyimpanan Rendah (Low Storage Warning)

### Gejala:
- Kartu **Kesehatan Sistem** menampilkan peringatan berwarna kuning/oranye:
  *"Penyimpanan lokal hampir penuh (tersisa kurang dari 5GB / >90% terpakai)"*.

### Solusi:
1. **Bersihkan Cache Thumbnail Pratinjau**:
   - Buka **Pengaturan Sistem → Pemeliharaan & Integritas**.
   - Klik **Bersihkan Cache Thumbnail**.
   - Berkas cache pratinjau yang aman akan dihapus tanpa menyentuh master aset produksi.
2. **Pindahkan Folder Cadangan Lama**:
   - Buka folder `backups/` di direktori proyek Anda.
   - Pindahkan cadangan `FULL_PROJECT_BACKUP` yang sudah berusia lebih dari 30 hari ke drive penyimpanan eksternal atau NAS studio.
3. **Migrasi Project Root ke Drive Berkapasitas Lebih Besar**:
   - Ikuti prosedur di [BACKUP-GUIDE.md](./BACKUP-GUIDE.md#6-migrasi-direktori-root-proyek-project-root-migration).

---

## 4. Berkas Aset Fisik Dilaporkan Hilang (Missing Files)

### Gejala:
- Audit Kesehatan Proyek menampilkan: *"Terdapat X file aset terdaftar yang hilang dari disk"*.
- Kartu keyframe atau video menampilkan ikon peringatan berkas tidak ditemukan.

### Penyebab & Solusi:
1. **Nama Berkas atau Folder Diubah Manual di Luar Aplikasi**:
   - Jika Anda mengubah nama folder secara manual di Windows Explorer, sistem tidak dapat menemukan path yang sebelumnya terdaftar.
   - Kembalikan nama berkas/folder sesuai nama aslinya di folder proyek.
2. **Jalankan Pembangunan Ulang Indeks (Rebuild Asset Index)**:
   - Buka **Pengaturan Sistem → Pemeliharaan & Integritas**.
   - Klik tombol **Bangun Ulang Indeks Aset (Rebuild Index)**.
   - Sistem akan memindai seluruh direktori proyek, mendaftarkan berkas fisik yang belum terhubung (*unlinked files*), dan memperbarui status berkas yang hilang.

---

## 5. Pemeriksaan Integritas Database SQLite (PRAGMA Check)

### Gejala:
- Aplikasi mengalami kelambatan mendadak atau melaporkan galat query SQLite.

### Solusi:
1. Buka **Pengaturan Sistem → Pemeliharaan & Integritas**.
2. Klik tombol **Jalankan Uji Integritas SQLite (PRAGMA integrity_check)**.
3. Jika status menyatakan `passed (ok)`, struktur B-tree dan indeks database dalam kondisi prima.
4. Jika ditemukan galat:
   - Cadangan terakhir masih dapat diakses.
   - Buka menu **Cadangan & Pemulihan** lalu pulihkan dari cadangan terverifikasi terakhir menggunakan kode `RESTORE`.

---

## 6. Kegagalan Memulihkan Cadangan (Restore Validation Failed)

### Gejala:
- Muncul pesan: *"Cadangan tidak valid: Checksum tidak cocok untuk berkas metadata-dump.json"*.

### Penyebab:
- Berkas di dalam folder cadangan telah diedit atau terkorupsi oleh kegagalan disk/antivirus pihak ketiga.

### Solusi:
1. Jangan memaksakan pemulihan dari folder cadangan yang rusak.
2. Pilih folder cadangan bertanda waktu sebelumnya dari daftar cadangan yang tersedia.
3. Lakukan pengujian validasi terlebih dahulu dengan mengklik **Validasi Cadangan**.

---

## 7. Masalah Izin Berkas Windows (EACCES / Read-Only Drive)

### Gejala:
- Galat: `EACCES: permission denied, mkdir 'D:\AI-PRODUCTION\...'`

### Penyebab & Solusi:
- Drive eksternal memiliki atribut *Read-Only* atau akun Windows Anda tidak memiliki hak tulis pada drive tujuan.
- Klik kanan folder `D:\AI-PRODUCTION` di Windows Explorer → **Properties** → hilangkan centang pada atribut **Read-only** → klik **Apply to this folder, subfolders and files**.
