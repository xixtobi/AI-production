# PANDUAN PENGGUNA (USER GUIDE)
**LOCAL PRODUCTION CONTROL — VERSI 1.0.0**

Dokumen ini adalah panduan operasional komprehensif bagi produser, penulis skenario, prompt engineer, desainer aset, dan operator kendali mutu (QC) dalam menjalankan alur produksi video harian menggunakan **Local Production Control**.

---

## DAFTAR ISI
1. [Memulai dan Navigasi Antarmuka](#1-memulai-dan-navigasi-antarmuka)
2. [Navigasi Cepat: Palet Perintah (Ctrl+K)](#2-navigasi-cepat-palet-perintah-ctrlk)
3. [Manajemen Proyek dan Konten](#3-manajemen-proyek-dan-konten)
4. [Script Studio: Dari Ide Menjadi Naskah Matang](#4-script-studio-dari-ide-menjadi-naskah-matang)
5. [Story Bible: Karakter, Lingkungan, dan Gaya Visual](#5-story-bible-karakter-lingkungan-dan-gaya-visual)
6. [Prompt Studio: Perumusan dan Versioning Prompt](#6-prompt-studio-perumusan-dan-versioning-prompt)
7. [Flow Queue: Pengelolaan Generasi Video](#7-flow-queue-pengelolaan-generasi-video)
8. [QC, Kontinuitas, dan Final Review](#8-qc-kontinuitas-dan-final-review)
9. [Pencadangan, Pemulihan, dan Migrasi](#9-pencadangan-pemulihan-dan-migrasi)
10. [Audit Aktivitas dan Log Sistem](#10-audit-aktivitas-dan-log-sistem)

---

## 1. Memulai dan Navigasi Antarmuka

### Menjalankan Aplikasi
1. Buka folder instalasi di Windows Explorer.
2. Klik ganda pada `start-production-control.bat` atau `launch.cmd`.
3. Jendela peramban akan otomatis terbuka di `http://127.0.0.1:3000`.

### Struktur Tata Letak (Layout)
- **Bilah Sisi Kiri (Sidebar)**:
  - **Daftar Proyek Utama (`Proyek`)**: Menampilkan seluruh judul proyek yang terdaftar di studio.
  - **AI Riwayat (`AI Riwayat`)**: Rekam jejak seluruh permintaan asistensi kecerdasan buatan Gemini beserta penggunaan token.
  - **Pengaturan Sistem (`Pengaturan Sistem`)**: Pusat kendali konfigurasi, cadangan, audit, dan integritas.
- **Navigasi Konteks Proyek (Muncul saat proyek dipilih)**:
  - *Dashboard*: Ringkasan statistik objektif proyek (jumlah shot, aset, status QC).
  - *Konten*: Daftar episode atau video pendek.
  - *Script Studio*: Lingkungan penyusunan cerita dan naskah.
  - *Story Bible*: Basis data karakter, lingkungan, dan aturan gaya.
  - *Aset*: Galeri aset visual, model sheet, dan referensi kanon.
  - *Shot*: Rincian seluruh shot produksi beserta navigasi urutan.
  - *Prompt Studio*: Ruang perumusan prompt gambar/video.
  - *Flow Queue*: Manajemen antrean generasi video.
  - *Production Board*: Papan status produksi shot (Kanban board).
  - *Cadangan & Pemulihan*: Manajemen snapshot dan ekspor/impor mandiri proyek.

---

## 2. Navigasi Cepat: Palet Perintah (Ctrl+K)

Fitur **Global Search & Command Palette** dirancang untuk mempercepat pencarian data produksi tanpa harus mengklik menu bertingkat:

1. Tekan `Ctrl + K` di mana saja dalam aplikasi.
2. Ketikkan kata kunci yang diinginkan:
   - **Kode Shot**: Ketik `SH016` untuk langsung membuka shot 16.
   - **Kode Aset**: Ketik `KF-B08` untuk menemukan referensi keyframe kakek Arga.
   - **Kutipan Dialog**: Ketik `kabut berbisik` untuk menemukan shot yang memuat dialog tersebut.
   - **Dokumen Naskah**: Ketik `EP01` atau `Lonceng di Puncak`.
   - **Perintah Cepat**: Beralih ke tab **Perintah** untuk mengeksekusi aksi instan seperti *Buat Cadangan*, *Buka Pengaturan*, *Periksa Integritas Database*, atau *Bersihkan Cache*.
3. Gunakan panah `↑` / `↓` lalu tekan `Enter` untuk langsung menuju halaman target.

---

## 3. Manajemen Proyek dan Konten

### Membuat Proyek Baru
1. Di halaman utama, klik tombol **+ Proyek Baru**.
2. Masukkan parameter proyek:
   - **Nama Proyek**: Nama lengkap (misal: *Petualangan di Lembah Awan*).
   - **Kode Proyek**: Kode unik alfanumerik (misal: `LEMBAH-AWAN` atau `UGC-TIKTOK-01`).
   - **Tipe Proyek**: Pilih `ANIMATION_SERIES`, `UGC_SERIES`, atau `COMMERCIAL`.
   - **Aspek Rasio Default**: Pilih `16:9` (horizontal) atau `9:16` (vertikal).
3. Simpan. Sistem akan otomatis menyiapkan struktur folder di `D:\AI-PRODUCTION\<KODE-PROYEK>\`.

### Menambahkan Konten (Episode / Video)
1. Di dalam proyek, buka tab **Konten** lalu klik **+ Tambah Konten**.
2. Masukkan nomor urut, judul konten, dan target durasi.
3. Konten dapat dikelompokkan ke dalam **Season** untuk serial animasi berdurasi panjang.

---

## 4. Script Studio: Dari Ide Menjadi Naskah Matang

Script Studio membagi proses penulisan menjadi struktur data produksi bertahap:

### A. Dokumen Cerita (Story Documents)
Kelola dokumen fondasi cerita yang tidak pernah menimpa draf lama:
- **CONCEPT**: Inti gagasan cerita.
- **LOGLINE**: Rangkuman satu kalimat premis dramatis.
- **SYNOPSIS**: Ringkasan alur cerita lengkap.
- **OUTLINE**: Babak demi babak adegan.
- **STORY_BIBLE**: Panduan kanon semesta cerita.

### B. Dokumen Naskah & Penguncian Versi (Script Documents)
1. Buka naskah episode di Script Studio.
2. Setiap naskah diawali dengan versi draf pertama (**V01**).
3. Anda dapat menambah adegan (*Scene*) dan blok naskah (*Action*, *Dialogue*, *Scene Header*, *Character Note*).
4. **Bantuan Gemini AI**:
   - Klik **Bantuan AI** untuk meminta saran pengembangan dialog, pemotongan adegan, atau pengayaan deskripsi aksi.
   - AI hanya memberikan rekomendasi proposal; naskah produksi tidak akan berubah sampai Anda mengklik **Terapkan**.
5. **Kunci Versi (Lock Version)**:
   - Setelah naskah disetujui, klik **Kunci Versi Ini**.
   - Versi tersebut menjadi *immutable* (tidak dapat diubah lagi secara permanen) untuk menjaga stabilitas tim storyboard dan animator.
   - Untuk melakukan revisi berikutnya, klik **Buat Versi Baru (V02)** yang akan menduplikasi naskah terkunci ke dalam draf revisi baru.
6. **Analisis Dampak Perubahan (Change Impact)**:
   - Saat beralih antarversi naskah, sistem membandingkan shot mana saja yang terdampak perubahan dialog atau aksi, sehingga kru visual langsung mengetahui shot yang perlu digambar ulang.

---

## 5. Story Bible: Karakter, Lingkungan, dan Gaya Visual

Story Bible memastikan konsistensi visual di seluruh generasi AI:
- **Karakter**: Catat usia, kostum kanon, ciri khas fisik, aksesoris utama (misal: rompi kargo Raka, kompas tua Pak Arga), dan pantangan visual.
- **Lingkungan**: Catat pencahayaan kanon, palet warna, suasana waktu, dan aturan ruang (misal: kabut tipis keemasan di Hutan Bisikan).
- **Style Bible**: Definisikan estetika global studio (misal: 3D Pixar-style feature animation, tekstur kayu organik, pencahayaan volumetrik hangat).

---

## 6. Prompt Studio: Perumusan dan Versioning Prompt

Prompt Studio menjembatani shot naskah dengan mesin generasi gambar/video:

1. Pilih Shot yang ingin dibuatkan prompt (misal: `SH016`).
2. **Terapkan Template Standar**:
   - Pilih dari template bawaan: `VIDEO_I2V_FAMILY_ADVENTURE`, `IMAGE_CHARACTER`, `UGC_HOOK`, dll.
   - Sistem otomatis mengisi placeholder seperti `{{character}}`, `{{environment}}`, dan `{{dialogue}}` berdasarkan data shot dan Story Bible.
3. **Kompilasi Luring (Offline Compiler)**:
   - Prompt terstruktur dapat dikompilasi secara instan tanpa memanggil internet atau kuota API.
4. **Bantuan Gemini Prompt Assistant**:
   - Jika kunci API Gemini aktif, klik **Perbaiki Prompt** atau **Terjemahkan ke Bahasa Inggris** untuk mendapatkan deskripsi sinematik yang kaya dan prompt negatif anti-cacat anatomi.
5. **Versioning & Perbandingan (Side-by-Side)**:
   - Setiap modifikasi disimpan sebagai versi berurutan (**V01, V02, V03**).
   - Gunakan fitur **Bandingkan Versi** untuk melihat perbedaan teks prompt sebelum mengunci prompt kanon.
6. **Kirim ke Flow Queue**:
   - Klik **Kirim ke Antrean Flow** untuk menyiapkan shot tersebut ke tahap produksi video.

---

## 7. Flow Queue: Pengelolaan Generasi Video

Aplikasi bertindak sebagai lapisan kontrol produksi di sekitar **Google Flow**:

1. Buka menu **Flow Queue**.
2. **Siapkan Paket Generasi (Prepare Package)**:
   - Klik **Siapkan Paket** pada item antrean.
   - Sistem akan menyusun folder mandiri di disk lokal berisi:
     - `manifest.json`: Metadata generasi, target aspek rasio, durasi, dan model.
     - `prompt.txt`: Teks prompt bersih siap disalin.
     - `generation-settings.json`: Pengaturan kamera, benih (seed), dan resolusi.
     - `references/`: Salinan fisik keyframe awal/akhir yang dibutuhkan.
3. **Buka Folder di Windows Explorer**:
   - Klik **Buka Folder Paket** untuk memeriksa berkas langsung di Windows.
4. **Salin Prompt Satu-Klik**:
   - Klik tombol **Salin Prompt** lalu tempelkan ke antarmuka Google Flow.
5. **Daftarkan Hasil Video (Register Video Output)**:
   - Setelah video selesai dibuat di Google Flow dan diunduh ke komputer Anda, letakkan video di folder output shot.
   - Klik **Daftarkan Video**, pilih berkas `.mp4` atau `.mov`.
   - Sistem akan membaca metadata berkas, menghitung hash SHA-256 untuk memastikan keaslian berkas, dan menyimpannya sebagai keluaran resmi shot (misal: `SH016_V01.mp4`).

---

## 8. QC, Kontinuitas, dan Final Review

### Ulasan Kendali Mutu (QC Reviews)
Setiap video yang didaftarkan wajib melalui proses pemeriksaan QC:
1. Buka shot di menu QC.
2. Buat ulasan baru dengan kategori relevan (misal: *Anatomy & Deformity*, *Lighting Consistency*, *Artifacts*).
3. Tentukan tingkat keparahan (*Severity*):
   - **MINOR**: Kesalahan kecil estetika (misal: bayangan sedikit redup). **Tidak memblokir** rilis final.
   - **MAJOR**: Kesalahan terlihat jelas (misal: warna pakaian berubah). **Memblokir rilis**, kecuali diberikan dispensasi tertulis (*waived*).
   - **CRITICAL**: Kesalahan fatal (misal: anggota tubuh terdistorsi, wajah glitch). **Memblokir rilis secara mutlak**.

### Pemeriksaan Kontinuitas (Continuity Checks)
- Bandingkan frame akhir dari shot sebelumnya (misal: `SH015`) dengan frame awal dari shot berikutnya (misal: `SH016`).
- Gunakan checklist kontinuitas untuk memvalidasi posisi properti, arah tatapan mata (*eye-line*), dan kostum karakter.

### Persetujuan Akhir (Final Review Gate)
- Status akhir suatu konten (*READY_FOR_RELEASE*) hanya dapat disetujui jika:
  1. Seluruh shot telah memiliki video output berstatus *APPROVED*.
  2. Tidak ada isu QC berstatus *OPEN* dengan severity **CRITICAL** atau **MAJOR**.
  3. Tonggak akhir (*Audio Milestone* dan *Edit Milestone*) telah disetujui produser.

---

## 9. Pencadangan, Pemulihan, dan Migrasi

### Membuat Cadangan Proyek
1. Buka menu **Cadangan & Pemulihan** di dalam proyek.
2. Pilih tipe cadangan:
   - **METADATA_BACKUP**: Mencadangkan basis data SQLite, riwayat naskah, prompt, pengaturan proyek, dan log produksi (sangat cepat, ukuran berkas kecil).
   - **FULL_PROJECT_BACKUP**: Mencadangkan seluruh metadata ditambah semua berkas fisik (gambar keyframe, aset referensi, video render, dan audio).
3. Klik **Buat Cadangan Sekarang**. Sistem membuat folder bertanda waktu unik yang tidak pernah menimpa cadangan lama (misal: `LEMBAH-AWAN_BACKUP_2026-09-27T19-30-00_METADATA_BACKUP/`).

### Memulihkan Proyek dari Cadangan
1. Buka tab **Riwayat Cadangan**.
2. Klik tombol **Pulihkan** pada cadangan yang diinginkan.
3. Masukkan kode konfirmasi `RESTORE`.
4. **Jaminan Keselamatan (Safety Backup Guarantee)**: Sebelum data lama ditimpa, sistem akan secara otomatis membuat *Safety Backup* instan dari kondisi proyek saat ini. Jika terjadi kesalahan, kondisi sebelum pemulihan tetap tersimpan aman.

### Ekspor & Impor Portabel
- **Ekspor**: Menghasilkan arsip mandiri berisi `manifest.json`, `project.json`, `database-export.json`, dan aset fisik yang dapat dipindahkan ke komputer lain via flashdisk atau SSD eksternal.
- **Impor**: Mengimpor proyek dari folder ekspor dengan tiga opsi resolusi jika kode proyek sudah ada:
  - `RENAME`: Mengimpor sebagai salinan baru dengan kode unik (misal: `LEMBAH-AWAN_IMPORTED`).
  - `OVERWRITE`: Menimpa proyek lama yang ada.
  - `FAIL`: Membatalkan impor jika terjadi duplikasi kode.

### Migrasi Root Folder Proyek
Jika Anda memindahkan folder proyek ke drive lain (misal dari `D:\AI-PRODUCTION\LEMBAH-AWAN` ke `E:\STUDIO-PROJECTS\LEMBAH-AWAN`):
1. Buka tab **Pengaturan Proyek & Migrasi Root**.
2. Masukkan path absolut folder baru.
3. Klik **Migrasi Project Root**.
4. Sistem otomatis memvalidasi path, memperbarui basis data, dan memindai ulang keberadaan seluruh aset fisik tanpa merusak relasi data.

---

## 10. Audit Aktivitas dan Log Sistem

### Audit Aktivitas Pengguna (User Activity Audit)
- Seluruh tindakan produksi (pembuatan naskah, penguncian versi, persetujuan QC, ekspor, dan pencadangan) dicatat ke dalam audit trail yang tidak dapat dimanipulasi.
- Akses melalui **Pengaturan Sistem → Log Aktivitas**.

### Log Teknis Tersanitasi (Technical System Logs)
- Log teknis disimpan di file lokal `.local-production-control/logs/production-control.log`.
- **Sanitasi Otomatis**: Kunci API Google Gemini (`AIzaSy...`) atau token otentikasi otomatis disensor menjadi `[REDACTED_KEY]` sebelum ditulis ke disk, menjaga kerahasiaan saat log dibagikan untuk troubleshooting.
