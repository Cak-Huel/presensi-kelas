const admin = require('firebase-admin');

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

module.exports = async (req, res) => {
    // 1. Setup CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    try {
        // 2. Autentikasi Admin
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Unauthorized: Missing or invalid token' });
        }

        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        
        // 3. Verifikasi Role Admin/Operator dari email
        if (!decodedToken.email || (!decodedToken.email.endsWith('@admin.absensi.id') && !decodedToken.email.endsWith('@operator.absensi.id'))) {
            return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
        }

        // 4. Proses Reset Sandi
        const { targetUid } = req.body;
        if (!targetUid) {
            return res.status(400).json({ success: false, message: 'Bad Request: targetUid is required' });
        }

        // Paksa ubah sandi ke default '123456'
        await admin.auth().updateUser(targetUid, {
            password: '123456'
        });

        return res.status(200).json({ success: true, message: 'Sandi berhasil direset ke 123456' });
    } catch (error) {
        console.error('Error Reset Password:', error);
        return res.status(500).json({ success: false, message: error.message || 'Internal Server Error' });
    }
};
