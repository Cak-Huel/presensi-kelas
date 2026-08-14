const admin = require('firebase-admin');
const axios = require('axios');
const crypto = require('crypto');

// Inisialisasi Firebase Admin
if (!admin.apps.length) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountJson) {
        try {
            const serviceAccount = JSON.parse(serviceAccountJson);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        } catch (e) {
            console.error("Gagal parse FIREBASE_SERVICE_ACCOUNT", e);
        }
    } else {
        console.warn("FIREBASE_SERVICE_ACCOUNT tidak ditemukan di env.");
    }
}

const db = admin.firestore();
const FONNTE_TOKEN = process.env.FONNTE_TOKEN;

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function sendFonnte(target, message) {
    if (!FONNTE_TOKEN) {
        console.warn(`[Fonnte Skip] Token tidak ada. Target: ${target}`);
        return;
    }
    try {
        await axios.post('https://api.fonnte.com/send', {
            target: target,
            message: message,
            countryCode: '62'
        }, {
            headers: {
                'Authorization': FONNTE_TOKEN
            }
        });
        console.log(`[Fonnte Success] Terkirim ke ${target}`);
    } catch (e) {
        console.error(`[Fonnte Error] Gagal kirim ke ${target}:`, e.response?.data || e.message);
    }
    // Delay 8 detik untuk mencegah indikasi spam
    await delay(8000);
}

module.exports = async (req, res) => {
    // Validasi Vercel Cron
    if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
        console.warn("Unauthorized cron attempt.");
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
        console.log("=== Memulai Cron Rekap Mingguan ===");

        // Langkah 1: Ambil data nomor WA settings
        const waDoc = await db.collection('settings').doc('whatsapp_numbers').get();
        const waNumbers = waDoc.exists ? waDoc.data().numbers || [] : [];

        // Identifikasi BK dan Kakomli
        const bkEntries = waNumbers.filter(n => n.jabatan && n.jabatan.toLowerCase().includes('bk'));
        const kakomliEntries = waNumbers.filter(n => n.jabatan && n.jabatan.toLowerCase().includes('kakomli'));

        // Langkah 2: Pengecekan Kondisi dihapus agar script tidak berhenti secara keseluruhan.
        // Script akan berjalan seperti Wali Kelas: jika BK/Kakomli per jurusan tidak ada, maka akan di-skip.

        // Langkah 3: Kalkulasi Data
        // Dapatkan 7 hari ke belakang
        const now = new Date();
        const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const startStr = lastWeek.toISOString().split('T')[0];
        const endStr = now.toISOString().split('T')[0];

        // Ambil semua data presensi dalam rentang waktu
        const presensiSnap = await db.collection('presensi_siswa')
            .where('tanggal', '>=', startStr)
            .where('tanggal', '<=', endStr)
            .get();

        const allRecords = [];
        presensiSnap.forEach(doc => allRecords.push(doc.data()));

        // Ambil semua data siswa untuk info orang tua
        const siswaSnap = await db.collection('siswa').get();
        const siswaMap = {};
        siswaSnap.forEach(doc => {
            const data = doc.data();
            if (data.nama_panggilan) siswaMap[data.nama_panggilan.toLowerCase()] = data;
            if (data.nama_lengkap) siswaMap[data.nama_lengkap.toLowerCase()] = data;
        });

        // Kelompokkan data per kelas
        const classRecords = {};
        const jurusanRecords = {};

        allRecords.forEach(r => {
            const kelas = r.kelas || '-';
            const jurusan = r.jurusan || '-';
            const classKey = `${kelas}_${jurusan}`;

            if (!classRecords[classKey]) classRecords[classKey] = { kelas, jurusan, records: [] };
            classRecords[classKey].records.push(r);

            if (!jurusanRecords[jurusan]) jurusanRecords[jurusan] = [];
            jurusanRecords[jurusan].push(r);
        });

        // Hitung alfa per siswa untuk notif orang tua
        const alfaList = allRecords.filter(r => r.status && r.status.toLowerCase() === 'alfa');
        const alfaCounts = {};
        alfaList.forEach(r => {
            const key = (r.nama_panggilan || r.nama || '').toLowerCase();
            if (!alfaCounts[key]) {
                alfaCounts[key] = { count: 0, r: r, entries: [] };
            }
            alfaCounts[key].count++;
            alfaCounts[key].lastAlfa = r;
            alfaCounts[key].entries.push(r);
        });

        // URL Web App
        const urlBase = 'https://sikas-smknessa.web.app';

        // Proses Notifikasi Wali Kelas
        for (const [key, dataObj] of Object.entries(classRecords)) {
            const kelas = dataObj.kelas;
            const jurusan = dataObj.jurusan;
            const records = dataObj.records;

            // Cari nomor wali kelas untuk kelas ini
            const waliKelas = waNumbers.find(n =>
                n.jabatan &&
                n.jabatan.toLowerCase().includes('wali kelas') &&
                n.jabatan.toLowerCase().includes(kelas.toLowerCase()) &&
                n.jabatan.toLowerCase().includes(jurusan.toLowerCase())
            );

            if (!waliKelas || !waliKelas.no_hp) {
                console.log(`[Skip] Wali kelas untuk ${kelas} ${jurusan} tidak ditemukan.`);
                continue;
            }

            // Generate token dan simpan shared_reports
            const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
            await db.collection('shared_reports').doc(token).set({
                records: records,
                filter_info: `Rekap Absensi Mingguan - Kelas ${kelas} ${jurusan} (${startStr} s/d ${endStr})`,
                created_at: new Date()
            });

            const link = `${urlBase}/public-report.html?token=${token}`;
            const msg = `Selamat sore Bapak/Ibu Wali Kelas ${kelas} ${jurusan}. Berikut adalah link rekap absensi mingguan siswa kelas Anda untuk pekan ini: ${link}. Terimakasih.`;
            await sendFonnte(waliKelas.no_hp, msg);
        }

        // Proses Notifikasi Kakomli
        for (const [jurusan, records] of Object.entries(jurusanRecords)) {
            const targetKakomli = kakomliEntries.find(n => n.jabatan.toLowerCase().includes(jurusan.toLowerCase()));

            if (!targetKakomli || !targetKakomli.no_hp) {
                console.log(`[Skip] Kakomli untuk jurusan ${jurusan} tidak ditemukan.`);
                continue;
            }

            const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
            await db.collection('shared_reports').doc(token).set({
                records: records,
                filter_info: `Laporan Performa Kehadiran - Jurusan ${jurusan} (${startStr} s/d ${endStr})`,
                created_at: new Date()
            });

            const link = `${urlBase}/public-report.html?token=${token}`;
            const msg = `Selamat sore Pak/Bu Kakomli ${jurusan}. Berikut adalah laporan performa kehadiran siswa jurusan ${jurusan} (Kelas 10, 11, 12) untuk minggu ini: ${link}. Terima kasih.`;
            await sendFonnte(targetKakomli.no_hp, msg);
        }

        // Proses Notifikasi BK (Semua data)
        if (bkEntries.length > 0) {
            const tokenBk = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
            await db.collection('shared_reports').doc(tokenBk).set({
                records: allRecords,
                filter_info: `Rekapitulasi Seluruh Kelas (${startStr} s/d ${endStr})`,
                created_at: new Date()
            });

            for (const bk of bkEntries) {
                if (!bk.no_hp) continue;
                const linkBk = `${urlBase}/public-report.html?token=${tokenBk}`;
                const msgBk = `Selamat sore Tim BK. Berikut adalah rekapitulasi data ketidakhadiran seluruh kelas minggu ini: ${linkBk}. Mohon ditinjau untuk tindak lanjut.`;
                await sendFonnte(bk.no_hp, msgBk);
            }
        } else {
            console.log(`[Skip] Nomor Tim BK tidak ditemukan.`);
        }

        // Proses Notifikasi Orang Tua (Alfa)
        for (const [key, data] of Object.entries(alfaCounts)) {
            const r = data.lastAlfa;
            const siswa = siswaMap[key];

            if (!siswa || !siswa.no_hp_ortu || siswa.no_hp_ortu === '-' || siswa.no_hp_ortu.trim().length < 5) {
                console.log(`[Warning] Siswa bernama ${r.nama || key} memiliki Alfa, tetapi nomor orang tua kosong. Gagal mengirim notifikasi.`);
                continue;
            }

            const noHpOrtu = siswa.no_hp_ortu;
            
            // Kelompokkan mapel berdasarkan tanggal
            const dateMap = {};
            data.entries.forEach(entry => {
                const date = entry.tanggal || 'Tidak diketahui';
                if (!dateMap[date]) dateMap[date] = [];
                if (entry.mapel) dateMap[date].push(entry.mapel);
            });
            
            let detailLines = [];
            for (const [date, mapels] of Object.entries(dateMap)) {
                const mapelStr = mapels.length > 0 ? mapels.join(', ') : '-';
                detailLines.push(`tanggal ${date} mapel ${mapelStr}.`);
            }

            const msg = `Assalamualaikum Bapak/Ibu, menginfokan bahwa minggu ini Ananda ${r.nama || r.nama_panggilan} (Kelas: ${r.kelas}) tercatat tidak hadir (Alfa) sebanyak ${data.count} kali. pada:\n${detailLines.join('\n')}\nTerima kasih.`;

            await sendFonnte(noHpOrtu, msg);
        }

        console.log("=== Cron Rekap Selesai ===");
        res.status(200).json({ success: true, message: 'Cron job berhasil dieksekusi.' });

    } catch (error) {
        console.error("Gagal mengeksekusi cron rekap:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};
