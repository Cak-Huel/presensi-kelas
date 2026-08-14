# SIKAS (Sistem Kehadiran Siswa)

SIKAS adalah aplikasi presensi siswa berbasis web yang mengintegrasikan pemindaian kode QR (via webcam/kamera HP) dengan database real-time Firestore dan pengiriman laporan otomatis ke WhatsApp secara terjadwal.

---

## 🛠️ Stack Teknologi

- **Frontend**: Vanilla HTML5, CSS3 (Tailwind CSS CDN), Javascript (ES Modules)
- **Backend / Serverless**: Vercel Serverless Functions (Node.js API)
- **Database & Auth**: Cloud Firestore, Firebase Authentication
- **Service & Integration**: Vercel Cron Jobs, Fonnte API (WhatsApp Gateway)

---

## 📂 Struktur Proyek Utama

```text
├── api/                  # Serverless functions untuk Vercel (Rekap & WhatsApp)
├── assets/               # File static pendukung (CSS, JS, Gambar)
├── pages/                # Halaman fungsional aplikasi
├── shared/               # Modul javascript reusable/shared
├── firebase-config.js    # Konfigurasi client-side Firebase SDK
├── firebase.json         # Konfigurasi Firebase CLI (Hosting & Rules)
├── firestore.rules       # Security rules untuk Cloud Firestore
├── vercel.json           # Konfigurasi routing & cron jobs Vercel
└── package.json          # Dependencies & npm scripts
```

---

## 🚀 Persiapan Lokal & Development

### 1. Prasyarat
Pastikan Anda sudah menginstal:
- **Node.js** (v18+) & **npm**
- **Firebase CLI** (`npm install -g firebase-tools`)

### 2. Instalasi Dependensi
Clone repositori dan pasang dependensi Node.js:
```bash
npm install
```

### 3. Konfigurasi Firebase Client
Salin konfigurasi Firebase Web App Anda ke dalam file `firebase-config.js`:
```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};
```

### 4. Jalankan Server Lokal
Jalankan aplikasi di lingkungan lokal:
```bash
npm start
```
Aplikasi akan berjalan secara default di `http://localhost:8080`.

---

## 🗄️ Inisialisasi Database (Firestore)

Sebelum menjalankan aplikasi pertama kali, lakukan setup database pada Firebase Console:
1. Aktifkan **Authentication** dengan provider **Email/Password**.
2. Aktifkan **Cloud Firestore** (disarankan menggunakan lokasi terdekat, misal `asia-southeast2` untuk Jakarta).
3. Jalankan Firestore Rules ke Firebase Project:
   ```bash
   firebase use <YOUR_PROJECT_ID>
   firebase deploy --only firestore:rules
   ```

*(Catatan: Akun admin default serta data master dapat diinisialisasi melalui halaman utility seeder lokal pada lingkungan development sebelum dideploy ke produksi).*

---

## 📦 Deployment

### A. Frontend (Firebase Hosting)
Untuk meng-online-kan antarmuka web ke Firebase Hosting:
1. Login ke Firebase CLI:
   ```bash
   firebase login
   ```
2. Hubungkan ke project target:
   ```bash
   firebase use <YOUR_PROJECT_ID>
   ```
3. Lakukan deploy:
   ```bash
   firebase deploy --only hosting
   ```

### B. Backend & Cron Jobs (Vercel)
API Rekap Mingguan dan Integrasi WhatsApp dideploy melalui Vercel:
1. Import repositori ini ke **Vercel**.
2. Konfigurasikan **Environment Variables** berikut pada project Vercel Anda:
   - `FIREBASE_SERVICE_ACCOUNT`: Isi keseluruhan JSON dari Service Account Key Firebase (bisa didapatkan melalui *Firebase Console > Project Settings > Service accounts*).
   - `FONNTE_TOKEN`: Token API dari akun Fonnte Anda.
   - `CRON_SECRET`: Kunci keamanan acak untuk memverifikasi request cron job dari Vercel.
3. Vercel akan otomatis membaca file `vercel.json` dan menjadwalkan Cron Job rekap mingguan sesuai dengan parameter `"schedule"` yang ditentukan (default UTC).

---

## 🔒 Catatan Keamanan

> [!IMPORTANT]
> Jangan pernah melakukan commit atau mempublikasikan file kredensial berikut ke public repository:
> - `service-account.json` (Firebase Admin SDK Key)
> - `accounts.json` (Auth User Export)
> - File konfigurasi `.env` lokal.
>
> Pastikan file-file tersebut selalu terdaftar di dalam `.gitignore`.
