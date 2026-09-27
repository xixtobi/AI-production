# ALUR KERJA PRODUKSI LENGKAP (PRODUCTION WORKFLOW)
**STUDIO STANDAR: PETUALANGAN DI LEMBAH AWAN (EPISODE 01)**

Dokumen ini mendemonstrasikan panduan alur kerja end-to-end produksi video animasi dari gagasan cerita hingga hasil master video yang disetujui, menggunakan contoh kanon **Petualangan di Lembah Awan (EP01 / SH016)**.

---

## 🗺️ Peta Alur Produksi

```
[ IDEA & CONCEPT ]
       │
       ▼
[ STORY BIBLE & CHARACTERS ] ──▶ (Raka, Lila, Pak Arga, Hutan Bisikan)
       │
       ▼
[ SCRIPT STUDIO ] ─────────────▶ (Naskah V01 ──▶ Revisi ──▶ Kunci Versi V02)
       │
       ▼
[ SCENE & SHOT BREAKDOWN ] ────▶ (Scene ANCHOR_B ──▶ SH016: Raka & Kompas Kakek)
       │
       ▼
[ PROMPT STUDIO ] ─────────────▶ (Template VIDEO_I2V ──▶ Prompt V01/V02 ──▶ Lock)
       │
       ▼
[ FLOW QUEUE ] ────────────────▶ (Siapkan Paket ──▶ Salin Prompt ──▶ Generate di Flow)
       │
       ▼
[ VIDEO REGISTRATION ] ────────▶ (Impor SH016_V01.mp4 ──▶ Ekstraksi SHA-256)
       │
       ▼
[ QUALITY CONTROL (QC) ] ──────▶ (Pemeriksaan Anatomi & Kontinuitas ──▶ Resolve/Waive)
       │
       ▼
[ FINAL REVIEW & RELEASE ] ────▶ (Checklist Lengkap ──▶ Status: READY_FOR_RELEASE)
```

---

## TAHAP 1: Pembentukan Cerita & Story Bible

1. **Definisikan Karakter Kanon**:
   - Di menu **Story Bible → Karakter**, pastikan detail karakter utama terdaftar:
     - **Raka**: Anak usia 10 tahun, pemberani, kostum rompi kargo cokelat dengan banyak saku, kaos hijau zaitun, memegang kompas tua peninggalan kakek Arga.
     - **Pak Arga**: Kakek penjelajah bijak, berkacamata bulat tua, janggut putih rapi.
2. **Definisikan Lingkungan Kanon**:
   - Di menu **Story Bible → Lingkungan**, konfigurasikan:
     - **Rumah Pak Arga**: Interior kayu tua hangat di tepi bukit, rak buku usang, cahaya matahari sore keemasan menerobos celah jendela kayu.
3. **Dokumen Cerita (Story Documents)**:
   - Buat dokumen **CONCEPT** dan **SYNOPSIS** untuk Season 1. Dokumen ini tersimpan dengan sistem penomoran versi yang aman dari penimpaan.

---

## TAHAP 2: Penulisan Naskah di Script Studio

1. **Buka Script Studio** untuk Episode 01: *Lonceng di Puncak Gunung*.
2. **Strukturisasi Adegan (Scene)**:
   - Episode 01 memuat 7 anchor adegan utama:
     - `ANCHOR_A`: Gunung Awan / Lonceng Mistis (SH001–SH008)
     - `ANCHOR_B`: Rumah Pak Arga / Kompas Misterius (SH009–SH031)
     - `ANCHOR_C`: Hutan Bisikan (SH032–SH041)
     - `ANCHOR_D`: Sungai & Jembatan Tua (SH042–SH054)
     - `ANCHOR_E`: Pintu Rahasia & Lorong Masuk (SH055–SH064)
     - `ANCHOR_F`: Lorong Kuno & Gambar Tiga Anak (SH065–SH081)
     - `ANCHOR_G`: Cliffhanger Puncak (SH082–SH091)
3. **Fokus pada SH016 (Adegan Penemuan Kompas)**:
   - Di adegan `ANCHOR_B`, tuliskan blok aksi dan dialog:
     - *Action*: Raka membuka laci meja kerja kayu tua Pak Arga yang berdebu. Matanya terbelalak melihat kompas kuno berukir lambang awan yang berputar sendiri.
     - *Dialogue (Raka)*: *"Kompas ini... jarumnya tidak menunjuk ke utara, tapi ke puncak Gunung Awan!"*
4. **Kunci Naskah (Lock Version V01)**:
   - Setelah naskah disetujui sutradara, klik **Kunci Versi Ini**. Naskah V01 menjadi kanon acuan shot breakdown.

---

## TAHAP 3: Pengaitan Aset & Keyframe Referensi

1. Buka halaman detail **Shot SH016**.
2. **Tautkan Aset Referensi**:
   - Di tab **Aset Referensi**, tautkan:
     - Karakter: `Raka` (model sheet kanon).
     - Lingkungan: `Rumah Pak Arga` (latar interior sore).
     - Keyframe Visual: `KF-B08` (*Keyframe Raka memegang kompas berdebu dengan ekspresi takjub*).
3. Status keterkaitan aset diverifikasi secara lokal tanpa memindahkan berkas master asli.

---

## TAHAP 4: Perumusan Prompt di Prompt Studio

1. Buka **Prompt Studio** untuk shot `SH016`.
2. **Pilih Template Produksi**:
   - Pilih template `VIDEO_I2V_FAMILY_ADVENTURE`.
   - Sistem otomatis menggabungkan keyframe `KF-B08`, deskripsi karakter Raka, dan lingkungan Rumah Pak Arga.
3. **Bantuan Gemini AI**:
   - Klik **Perbaiki Prompt dengan AI**.
   - Gemini menghasilkan prompt sinematik Bahasa Inggris yang kaya:
     ```text
     Starting from keyframe image KF-B08: Raka, a 10-year-old adventurous Indonesian boy with an expressive curious face, slowly lifts the mysterious antique brass compass from the dusty drawer. The needle inside spins erratically with a faint magical golden glow. Camera slowly pushes in from medium shot to close-up on the compass. Warm afternoon volumetric sunlight streaming through weathered timber window slates. Dust motes dancing in the golden beams. High-end 3D feature animation aesthetic, fluid natural movement, emotional cinematic pacing --duration 4s --ar 16:9
     ```
   - Prompt negatif: `deformed fingers, robotic motion, unnatural face morphing, flickering light, modern gadgets, text, watermark`.
4. **Simpan sebagai Versi V01 & Kunci Prompt**:
   - Klik **Simpan Versi**. Prompt tercatat sebagai `V01`.
   - Kunci prompt untuk memastikan operator produksi di Flow menggunakan instruksi yang persis sama.
5. **Kirim ke Flow Queue**:
   - Klik tombol **Kirim ke Antrean Flow**.

---

## TAHAP 5: Eksekusi Generasi di Google Flow

1. Buka menu **Flow Queue** proyek.
2. Cari baris shot `SH016`.
3. Klik **Siapkan Paket Generasi (Prepare Package)**:
   - Aplikasi membuat folder di `D:\AI-PRODUCTION\LEMBAH-AWAN\CONTENT\EP01\SH016\GENERATIONS\GEN_01\`.
   - Di dalamnya tersusun berkas `prompt.txt`, `generation-settings.json`, dan folder `references/` yang berisi berkas fisik `KF-B08_v01.png`.
4. Klik **Salin Prompt**.
5. Klik **Buka Google Flow** untuk membuka antarmuka web Flow di peramban Anda.
6. Di Google Flow:
   - Unggah keyframe awal dari folder `references/`.
   - Tempel prompt yang telah disalin.
   - Atur rasio aspek `16:9` dan durasi `4s`.
   - Jalankan generasi video.
7. Setelah selesai, unduh video hasil generasi (`.mp4`) ke komputer Anda.

---

## TAHAP 6: Pendaftaran Video Output

1. Buka kembali aplikasi pada detail shot `SH016`.
2. Di bagian **Video Outputs**, klik **Daftarkan Video Baru**.
3. Pilih berkas video yang baru saja diunduh (misal disimpan di `D:\AI-PRODUCTION\LEMBAH-AWAN\CONTENT\EP01\SH016\OUTPUTS\SH016_V01.mp4`).
4. Sistem secara otomatis:
   - Membaca ukuran berkas dan dimensi resolusi (misal: 1920x1080).
   - Menghitung checksum SHA-256 untuk memastikan keutuhan berkas.
   - Menghubungkan output video dengan riwayat generasi (*Generation Attempt*).
   - Menampilkan pemutar video (*Video Player*) untuk peninjauan langsung.

---

## TAHAP 7: Ulasan Kendali Mutu (QC) & Kontinuitas

1. Di pemutar video shot `SH016`:
   - Amati gerakan tangan Raka saat mengangkat kompas (apakah ada distorsi jari?).
   - Amati pencahayaan ruangan (apakah konsisten dengan shot `SH015` sebelumnya?).
2. **Pencatatan QC**:
   - Jika ditemukan masalah kecil (misal: bayangan di lantai sedikit goyang), catat sebagai **MINOR** issue (*Lighting Jitter*).
   - Masalah MINOR **tidak memblokir** rilis.
   - Jika ditemukan cacat berat (misal: jari Raka berubah menjadi enam), catat sebagai **CRITICAL** issue. Shot ini wajib di-generate ulang di Flow Queue.
3. **Pemeriksaan Kontinuitas**:
   - Jalankan **Continuity Check** otomatis dengan bantuan Gemini untuk memvalidasi kostum rompi kargo dan warna syal Raka antara shot 15 dan shot 16.
4. Setelah perbaikan selesai, tandai status QC Review menjadi **RESOLVED** atau **APPROVED**.

---

## TAHAP 8: Final Review & Persetujuan Rilis Master

1. Buka menu **Konten → EP01 → Final Review**.
2. **Audit Kesiapan Otomatis (Readiness Audit)**:
   - Sistem memeriksa kondisi faktual:
     - [x] Seluruh 91 shot memiliki output video terdaftar.
     - [x] Tidak ada isu QC berstatus *OPEN* dengan severity **CRITICAL** atau **MAJOR**.
     - [x] Seluruh cek kontinuitas adegan telah ditinjau.
     - [x] Tonggak audio (*Dialogue / Music Score / SFX*) berstatus *COMPLETED*.
     - [x] Tonggak editing (*Color Grading / Final Cut*) berstatus *COMPLETED*.
3. **Persetujuan Sutradara / Produser**:
   - Jika seluruh indikator berwarna hijau, tombol **Setujui untuk Rilis Final** menjadi aktif.
   - Klik tombol persetujuan. Status Episode 01 resmi berubah menjadi **READY_FOR_RELEASE**.
4. **Pencadangan Final**:
   - Buka menu **Cadangan & Pemulihan**, buat **FULL_PROJECT_BACKUP** sebagai master arsip produksi yang aman dan dapat dipulihkan kapan saja di masa depan.
