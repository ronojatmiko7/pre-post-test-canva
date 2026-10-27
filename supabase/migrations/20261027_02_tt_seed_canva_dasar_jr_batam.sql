-- Seed: "Canva Dasar untuk Profesional" for PT Jasa Raharja Kantor Batam.
-- Pre-test = the facilitator's own 10 questions and key.
-- Post-test = a parallel form: same 10 topics and slide references, new wording, answers in different positions.
-- The post-test items were written from the pre-test topics: check them against the slides before the session.

insert into tt.sessions (slug, title, client, trainer, pre_open, post_open, eval_open)
values ('canva-dasar-jr-batam', 'Canva Dasar untuk Profesional', 'PT Jasa Raharja Kantor Batam', null, true, false, false);

insert into tt.questions (session_id, form, no, topic, body, options, correct, slide_ref)
select s.id, v.form, v.no, v.topic, v.body, v.options::jsonb, v.correct, v.slide_ref
from (select id from tt.sessions where slug = 'canva-dasar-jr-batam') s,
(values
  -- PRE-TEST
  ('pre', 1, 'Kemudahan Canva', 'Apa yang membuat Canva mudah digunakan oleh pemula?',
   $o$[{"key":"A","text":"Semua desain harus dibuat dengan kode pemrograman"},{"key":"B","text":"Tersedia banyak template dan fitur yang intuitif"},{"key":"C","text":"Hanya dapat digunakan oleh desainer profesional"},{"key":"D","text":"Harus memasang perangkat lunak desain yang rumit"}]$o$, 'B', 'Slide 14'),
  ('pre', 2, 'Akses Canva', 'Alamat situs yang digunakan untuk membuka Canva melalui browser adalah ...',
   $o$[{"key":"A","text":"canva.com"},{"key":"B","text":"designcanva.net"},{"key":"C","text":"slides.google.com"},{"key":"D","text":"photoshop.com"}]$o$, 'A', 'Slide 9'),
  ('pre', 3, 'Membuat presentasi', 'Jika ingin membuat presentasi baru di Canva, pilihan yang dapat digunakan adalah ...',
   $o$[{"key":"A","text":"Unggahan → Audio"},{"key":"B","text":"Elemen → Bagan"},{"key":"C","text":"Beranda → Presentasi"},{"key":"D","text":"Proyek → Hapus"}]$o$, 'C', 'Slide 18'),
  ('pre', 4, 'Impor PowerPoint', 'Jika sudah memiliki file PowerPoint dan ingin melanjutkan pengeditannya di Canva, apa yang perlu dilakukan?',
   $o$[{"key":"A","text":"Mengubah semua slide menjadi gambar terlebih dahulu"},{"key":"B","text":"Mengetik ulang seluruh isi presentasi"},{"key":"C","text":"Menghapus file PowerPoint lama"},{"key":"D","text":"Mengunggah file presentasi (PPTX) ke Canva"}]$o$, 'D', 'Slide 22–25'),
  ('pre', 5, 'Tabel', 'Menu apa yang digunakan untuk menambahkan tabel ke slide Canva?',
   $o$[{"key":"A","text":"Teks → Judul"},{"key":"B","text":"Elemen → Tabel"},{"key":"C","text":"Unggahan → Video"},{"key":"D","text":"Aplikasi → Musik"}]$o$, 'B', 'Slide 31'),
  ('pre', 6, 'Grafik dan bagan', 'Untuk menambahkan grafik atau bagan ke presentasi Canva, kita dapat memilih ...',
   $o$[{"key":"A","text":"Teks → Subjudul"},{"key":"B","text":"Proyek → Folder"},{"key":"C","text":"Elemen → Bagan"},{"key":"D","text":"Unggahan → Foto"}]$o$, 'C', 'Slide 34–35'),
  ('pre', 7, 'Konten media sosial', 'Apa langkah awal yang disarankan saat membuat konten media sosial menggunakan Canva Free?',
   $o$[{"key":"A","text":"Memilih template yang sesuai tujuan konten"},{"key":"B","text":"Langsung mengunduh desain kosong"},{"key":"C","text":"Menghapus seluruh elemen desain"},{"key":"D","text":"Membuat semua ilustrasi dengan tangan"}]$o$, 'A', 'Slide 40'),
  ('pre', 8, 'Unggah foto', 'Bagaimana cara memasukkan foto dari komputer sendiri ke desain Canva?',
   $o$[{"key":"A","text":"Memilih menu Bantuan"},{"key":"B","text":"Ubah warna latar belakang"},{"key":"C","text":"Membuka menu Presentasi"},{"key":"D","text":"Memilih Unggahan → Unggah file"}]$o$, 'D', 'Slide 44'),
  ('pre', 9, 'Instruksi untuk AI Canva', 'Informasi apa yang sebaiknya dicantumkan saat meminta AI Canva membuat desain?',
   $o$[{"key":"A","text":"Topik, target audiens, dan gaya desain yang diinginkan"},{"key":"B","text":"Hanya kata ‘buatkan desain’ tanpa penjelasan"},{"key":"C","text":"Nama komputer yang digunakan"},{"key":"D","text":"Jumlah aplikasi yang sedang terbuka"}]$o$, 'A', 'Slide 54, 57'),
  ('pre', 10, 'Memakai hasil AI', 'Bagaimana cara menggunakan hasil desain dari AI Canva secara efektif?',
   $o$[{"key":"A","text":"Selalu menggunakannya tanpa pemeriksaan"},{"key":"B","text":"Menganggap AI menggantikan seluruh proses berpikir"},{"key":"C","text":"Menjadikannya rancangan awal lalu menyempurnakannya secara manual"},{"key":"D","text":"Menghapus hasilnya sebelum melihat desain"}]$o$, 'C', 'Slide 53'),
  -- POST-TEST (parallel form)
  ('post', 1, 'Kemudahan Canva', 'Mengapa Canva cocok dipakai oleh profesional yang bukan desainer?',
   $o$[{"key":"A","text":"Karena wajib memahami teori warna tingkat lanjut"},{"key":"B","text":"Karena hanya menyediakan satu jenis desain"},{"key":"C","text":"Karena desain bisa disusun cepat dari template dan elemen tanpa keahlian desain khusus"},{"key":"D","text":"Karena hanya bisa dipakai setelah mengikuti kursus desain"}]$o$, 'C', 'Slide 14'),
  ('post', 2, 'Akses Canva', 'Langkah pertama yang benar untuk memakai Canva lewat browser adalah ...',
   $o$[{"key":"A","text":"Membeli lisensi perangkat lunak desain"},{"key":"B","text":"Mengirim permintaan desain ke tim IT"},{"key":"C","text":"Mengetik ‘Canva’ di dokumen Word"},{"key":"D","text":"Membuka canva.com lalu masuk ke akun Canva"}]$o$, 'D', 'Slide 9'),
  ('post', 3, 'Membuat presentasi', 'Dari halaman Beranda, kategori apa yang dipilih untuk mulai membuat slide presentasi baru?',
   $o$[{"key":"A","text":"Media Sosial"},{"key":"B","text":"Presentasi"},{"key":"C","text":"Cetak"},{"key":"D","text":"Situs Web"}]$o$, 'B', 'Slide 18'),
  ('post', 4, 'Impor PowerPoint', 'Anda memiliki file presentasi PowerPoint dan ingin merapikannya di Canva. Langkah yang paling efisien adalah ...',
   $o$[{"key":"A","text":"Menyalin teks tiap slide satu per satu ke desain kosong"},{"key":"B","text":"Mengunggah file PPTX ke Canva, lalu mengedit hasilnya"},{"key":"C","text":"Memotret tiap slide dan memasukkannya sebagai gambar"},{"key":"D","text":"Mengubah file menjadi audio terlebih dahulu"}]$o$, 'B', 'Slide 22–25'),
  ('post', 5, 'Tabel', 'Anda ingin menampilkan jadwal kegiatan dalam baris dan kolom di sebuah slide. Menu yang paling tepat adalah ...',
   $o$[{"key":"A","text":"Elemen → Tabel"},{"key":"B","text":"Elemen → Stiker"},{"key":"C","text":"Elemen → Audio"},{"key":"D","text":"Elemen → Bingkai"}]$o$, 'A', 'Slide 31'),
  ('post', 6, 'Grafik dan bagan', 'Data penjualan per bulan akan ditampilkan sebagai grafik batang di slide. Menu yang dipakai adalah ...',
   $o$[{"key":"A","text":"Unggahan → Foto"},{"key":"B","text":"Teks → Subjudul"},{"key":"C","text":"Proyek → Folder"},{"key":"D","text":"Elemen → Bagan"}]$o$, 'D', 'Slide 34–35'),
  ('post', 7, 'Konten media sosial', 'Anda ingin membuat poster edukasi keselamatan berkendara untuk Instagram dengan Canva Free. Langkah awal yang paling tepat adalah ...',
   $o$[{"key":"A","text":"Menghapus semua elemen lalu memulai dari kanvas kosong tanpa arah"},{"key":"B","text":"Mengunduh desain tanpa mengubah isinya"},{"key":"C","text":"Memilih template media sosial yang sesuai tujuan, lalu menyesuaikan isi dan warnanya"},{"key":"D","text":"Menunggu sampai ada desainer yang membuatkannya"}]$o$, 'C', 'Slide 40'),
  ('post', 8, 'Unggah foto', 'Logo kantor tersimpan di laptop Anda dan ingin dipakai dalam desain. Caranya adalah ...',
   $o$[{"key":"A","text":"Elemen → Bagan"},{"key":"B","text":"Unggahan → Unggah file"},{"key":"C","text":"Teks → Judul"},{"key":"D","text":"Proyek → Hapus"}]$o$, 'B', 'Slide 44'),
  ('post', 9, 'Instruksi untuk AI Canva', 'Anda meminta AI Canva membuat poster internal kantor. Instruksi (prompt) mana yang paling baik?',
   $o$[{"key":"A","text":"Buatkan poster yang bagus dan menarik, terserah desainnya."},{"key":"B","text":"Buatkan desain apa saja, yang penting cepat selesai hari ini."},{"key":"C","text":"Buatkan poster keselamatan lalu lintas untuk karyawan, gaya minimalis, warna biru dan putih."},{"key":"D","text":"Buatkan sesuatu seperti yang pernah dibuat orang lain di internet."}]$o$, 'C', 'Slide 54, 57'),
  ('post', 10, 'Memakai hasil AI', 'Setelah AI Canva menghasilkan sebuah desain, tindakan terbaik berikutnya adalah ...',
   $o$[{"key":"A","text":"Memeriksa isi dan tampilannya, lalu menyempurnakannya sesuai kebutuhan"},{"key":"B","text":"Langsung mempublikasikannya karena AI pasti benar"},{"key":"C","text":"Menghapusnya karena desain AI tidak boleh dipakai"},{"key":"D","text":"Meminta AI mengulang terus tanpa mengubah instruksi"}]$o$, 'A', 'Slide 53')
) as v(form, no, topic, body, options, correct, slide_ref);

insert into tt.eval_items (session_id, no, section, kind, body, required)
select s.id, v.no, v.section, v.kind, v.body, v.required
from (select id from tt.sessions where slug = 'canva-dasar-jr-batam') s,
(values
  (1,  'Materi',                'scale', 'Materi pelatihan sesuai dengan kebutuhan pekerjaan saya.', true),
  (2,  'Materi',                'scale', 'Materi disampaikan runtut dan mudah dipahami.', true),
  (3,  'Materi',                'scale', 'Tingkat kesulitan materi sesuai dengan kemampuan saya.', true),
  (4,  'Materi',                'scale', 'Latihan praktik membantu saya memahami cara memakai Canva.', true),
  (5,  'Instruktur',            'scale', 'Instruktur menguasai materi.', true),
  (6,  'Instruktur',            'scale', 'Instruktur menjelaskan dengan jelas dan mudah diikuti.', true),
  (7,  'Instruktur',            'scale', 'Contoh yang diberikan relevan dengan pekerjaan saya.', true),
  (8,  'Instruktur',            'scale', 'Instruktur menanggapi pertanyaan peserta dengan baik.', true),
  (9,  'Penyelenggaraan',       'scale', 'Durasi 4 jam cukup untuk materi yang dibahas.', true),
  (10, 'Penyelenggaraan',       'scale', 'Jalannya pelatihan online (suara, layar, koneksi) lancar.', true),
  (11, 'Penyelenggaraan',       'scale', 'Pengaturan waktu dan jeda istirahat sudah tepat.', true),
  (12, 'Dampak',                'scale', 'Saya sudah bisa membuat desain dasar (slide, grafik, konten media sosial) sendiri di Canva.', true),
  (13, 'Dampak',                'scale', 'Saya tahu cara memberi instruksi (prompt) yang baik kepada AI Canva.', true),
  (14, 'Dampak',                'scale', 'Saya akan memakai Canva dalam pekerjaan saya dalam waktu dekat.', true),
  (15, 'Penilaian keseluruhan', 'nps',   'Seberapa besar kemungkinan Anda merekomendasikan pelatihan ini kepada rekan kerja?', true),
  (16, 'Masukan',               'text',  'Bagian pelatihan mana yang paling bermanfaat bagi Anda?', false),
  (17, 'Masukan',               'text',  'Apa yang perlu diperbaiki dari pelatihan ini?', false),
  (18, 'Masukan',               'text',  'Topik lanjutan apa yang ingin Anda pelajari?', false)
) as v(no, section, kind, body, required);
