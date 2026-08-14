import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged, signOut, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, addDoc, updateDoc, collection, query, where, getDocs, Timestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";

let _guruData = null;
let _guruUid = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = '../index.html'; return; }
    if (!user.email.endsWith('@guru.absensi.id')) { window.location.href = '../index.html'; return; }

    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) return;
    _guruData = userDoc.data();
    _guruUid = user.uid;
    localStorage.setItem('user_name', _guruData.nama);

    const waliKelas = _guruData.wali_kelas || '';
    let siswaList = [];
    if (waliKelas) {
        const qSiswa = query(collection(db, 'siswa'), where('kelas', '==', waliKelas));
        const siswaSnap = await getDocs(qSiswa);
        siswaSnap.forEach(d => siswaList.push({ id: d.id, ...d.data() }));
    }

    const today = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
    const qPresensi = query(collection(db, 'presensi_siswa'), where('tanggal', '==', today));
    const presensiSnap = await getDocs(qPresensi);
    const presensiMap = {};
    presensiSnap.forEach(d => { const p = d.data(); presensiMap[p.nama] = p; });

    const studentList = siswaList.map(s => {
        const p = presensiMap[s.nama_lengkap];
        let waktu = '-';
        if (p && p.waktu_masuk && p.waktu_masuk.toDate) {
            waktu = p.waktu_masuk.toDate().toLocaleTimeString('id-ID', {hour:'2-digit',minute:'2-digit'}) + ' WIB';
        }
        return { id: s.id, nama: s.nama_lengkap, nama_panggilan: s.nama_panggilan, status: p ? p.status : null, waktu };
    }).sort((a, b) => a.nama.localeCompare(b.nama));

    const stats = { total: siswaList.length, hadir: 0, izinSakit: 0, alfa: 0, belum: 0 };
    studentList.forEach(s => {
        if (s.status === 'hadir') stats.hadir++;
        else if (s.status === 'sakit' || s.status === 'izin') stats.izinSakit++;
        else if (s.status === 'alfa') stats.alfa++;
        else stats.belum++;
    });

    window.dispatchEvent(new CustomEvent('firebase-guru-ready', {
        detail: { ..._guruData, studentList, classStats: stats }
    }));
});

window.firebaseLogout = async function() {
    await signOut(auth);
    localStorage.clear();
    window.location.href = '../index.html';
};

window.firebaseUbahSandi = async function(oldPassword, newPassword) {
    const user = auth.currentUser;
    if (!user) throw new Error("Anda belum login.");
    
    // 1. Re-authenticate
    const credential = EmailAuthProvider.credential(user.email, oldPassword);
    await reauthenticateWithCredential(user, credential);
    
    // 2. Update Password
    await updatePassword(user, newPassword);
};

// Create QR session in Firestore
window.firebaseCreateSession = async function(sessionId, mapel, kelas, jurusan, currentToken) {
    const today = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
    await setDoc(doc(db, 'qr_sessions', sessionId), {
        sessionId, mapel, kelas, jurusan, tanggal: today,
        guru_uid: _guruUid, guru_nama: _guruData?.nama || '',
        currentToken: currentToken || '',
        created_at: Timestamp.fromDate(new Date()), active: true
    });
};

// Update session token for dynamic QR
window.firebaseUpdateSessionToken = async function(sessionId, currentToken) {
    if (!sessionId) return;
    try { await updateDoc(doc(db, 'qr_sessions', sessionId), { currentToken }); } catch(e) { console.error(e); }
};

// Deactivate QR session
window.firebaseDeactivateSession = async function(sessionId) {
    if (!sessionId) return;
    try { await updateDoc(doc(db, 'qr_sessions', sessionId), { active: false }); } catch(e) { console.error(e); }
};

let _unsubscribePresensi = null;

// Listen to attendance data for a specific kelas, jurusan, and mapel in realtime
window.firebaseListenAttendance = async function(kelas, jurusan, mapel, callback) {
    if (_unsubscribePresensi) {
        _unsubscribePresensi();
        _unsubscribePresensi = null;
    }
    if (!kelas) return;

    // Simpan sesi aktif guru agar tidak hilang saat direfresh (berlaku 1 jam)
    localStorage.setItem('guru_active_session', JSON.stringify({
        kelas,
        jurusan,
        mapel,
        timestamp: Date.now()
    }));

    const today = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
    
    // Fetch base siswa list once
    let qSiswa;
    if (jurusan) {
        qSiswa = query(collection(db, 'siswa'), where('kelas', '==', kelas), where('jurusan', '==', jurusan));
    } else {
        qSiswa = query(collection(db, 'siswa'), where('kelas', '==', kelas));
    }
    const siswaSnap = await getDocs(qSiswa);
    const siswaList = [];
    siswaSnap.forEach(d => siswaList.push({ id: d.id, ...d.data() }));

    // Listen to presensi
    let qPresensi;
    if (jurusan) {
        qPresensi = query(collection(db, 'presensi_siswa'), where('tanggal', '==', today), where('kelas', '==', kelas), where('jurusan', '==', jurusan), where('mapel', '==', mapel));
    } else {
        qPresensi = query(collection(db, 'presensi_siswa'), where('tanggal', '==', today), where('kelas', '==', kelas), where('mapel', '==', mapel));
    }

    _unsubscribePresensi = onSnapshot(qPresensi, (presensiSnap) => {
        const presensiMap = {};
        presensiSnap.forEach(d => { const p = d.data(); presensiMap[p.nama] = p; });

        const studentList = siswaList.map(s => {
            const p = presensiMap[s.nama_lengkap];
            let waktu = '-';
            if (p && p.waktu_masuk && p.waktu_masuk.toDate) {
                waktu = p.waktu_masuk.toDate().toLocaleTimeString('id-ID', {hour:'2-digit',minute:'2-digit'}) + ' WIB';
            }
            return { id: s.id, nama: s.nama_lengkap, nama_panggilan: s.nama_panggilan, status: p ? p.status : null, waktu };
        }).sort((a, b) => a.nama.localeCompare(b.nama));
        
        const stats = { total: siswaList.length, hadir: 0, izinSakit: 0, alfa: 0, belum: 0 };
        studentList.forEach(s => {
            if (s.status === 'hadir') stats.hadir++;
            else if (s.status === 'sakit' || s.status === 'izin') stats.izinSakit++;
            else if (s.status === 'alfa') stats.alfa++;
            else stats.belum++;
        });
        
        if (callback) callback({ studentList, classStats: stats });
    });
};

// Load kelas list (Fixed list for SMK)
window.firebaseLoadKelas = async function() {
    return [
        { id: '10', nama: '10' },
        { id: '11', nama: '11' },
        { id: '12', nama: '12' }
    ];
};

// Load jurusan list
window.firebaseLoadJurusan = async function() {
    try {
        const snap = await getDocs(collection(db, 'jurusan'));
        if (snap.empty) {
            return [
                { id: 'RPL', nama: 'RPL' },
                { id: 'TKJ', nama: 'TKJ' },
                { id: 'TKR', nama: 'TKR' },
                { id: 'TSM', nama: 'TSM' }
            ];
        }
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        return list.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
    } catch(e) {
        return [];
    }
};

// Load all mapels (not filtered by kelas/jurusan)
window.firebaseLoadAllMapel = async function() {
    try {
        const snap = await getDocs(collection(db, 'mapel'));
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        return list.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
    } catch(e) {
        return [];
    }
};

// Load siswa filtered by kelas (and optionally jurusan)
window.firebaseLoadSiswa = async function(kelas, jurusan) {
    let q;
    if (jurusan) {
        q = query(collection(db, 'siswa'), where('kelas', '==', kelas), where('jurusan', '==', jurusan));
    } else {
        q = query(collection(db, 'siswa'), where('kelas', '==', kelas));
    }
    const snap = await getDocs(q);
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    return list.sort((a, b) => (a.nama_lengkap || '').localeCompare(b.nama_lengkap || ''));
};

// Save manual attendance
window.firebaseSaveManualAttendance = async function(siswaData, status, mapel) {
    const today = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
    const now = new Date();
    // Check duplicate
    const q = query(collection(db, 'presensi_siswa'),
        where('nama', '==', siswaData.nama_lengkap),
        where('tanggal', '==', today)
    );
    const existing = await getDocs(q);
    if (!existing.empty) {
        return { duplicate: true, message: 'Siswa sudah diabsen hari ini' };
    }
    await addDoc(collection(db, 'presensi_siswa'), {
        nama_panggilan: siswaData.nama_panggilan || '',
        nama: siswaData.nama_lengkap,
        kelas: siswaData.kelas,
        jurusan: siswaData.jurusan || '',
        status: status,
        tanggal: today,
        waktu_masuk: Timestamp.fromDate(now),
        scan_method: 'manual',
        mapel: mapel || ''
    });
    return { duplicate: false };
};

// Save scan attendance (Continuous / Kasir Mode)
window.firebaseSaveScanAttendanceGuru = async function(code, mapel) {
    // 1. Lookup siswa (By NISN or Document ID)
    let siswaData = null;
    let q = query(collection(db, 'siswa'), where('nisn', '==', parseInt(code) || code));
    let snap = await getDocs(q);
    
    if (!snap.empty) {
        siswaData = snap.docs[0].data();
    } else {
        q = query(collection(db, 'siswa'), where('nisn', '==', code));
        snap = await getDocs(q);
        if (!snap.empty) {
            siswaData = snap.docs[0].data();
        } else {
            // Try Document ID (since QR Generator uses Document ID)
            const docRef = doc(db, 'siswa', code);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                siswaData = docSnap.data();
            }
        }
    }

    if (!siswaData) return { success: false, message: 'ID Siswa tidak dikenali: ' + code };

    const today = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
    const now = new Date();
    
    // Check duplicate
    const qCheck = query(collection(db, 'presensi_siswa'),
        where('nama', '==', siswaData.nama_lengkap),
        where('tanggal', '==', today),
        where('mapel', '==', mapel)
    );
    const existing = await getDocs(qCheck);
    
    if (!existing.empty) {
        return { success: true, duplicate: true, siswa: siswaData, message: 'Sudah Hadir' };
    }

    // Save to Firestore
    await addDoc(collection(db, 'presensi_siswa'), {
        nisn: siswaData.nisn || code,
        nama_panggilan: siswaData.nama_panggilan || '',
        nama: siswaData.nama_lengkap,
        kelas: siswaData.kelas,
        jurusan: siswaData.jurusan || '',
        status: 'hadir',
        tanggal: today,
        waktu_masuk: Timestamp.fromDate(now),
        scan_method: 'qr_guru',
        mapel: mapel || '',
        scanned_by: _guruUid
    });

    return { success: true, duplicate: false, siswa: siswaData, message: 'Hadir' };
};
