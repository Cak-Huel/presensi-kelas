function teacherDashboard() {
    return {
        isDark: false,
        currentDate: '',
        currentTime: '',
        guruNama: '',
        guruUsername: '',
        guruWaliKelas: '',
        classStats: { total: 0, hadir: 0, izinSakit: 0, alfa: 0, belum: 0 },
        studentList: [],
        currentPage: 1,
        itemsPerPage: 10,

        paginatedStudents() {
            const start = (this.currentPage - 1) * this.itemsPerPage;
            return this.studentList.slice(start, start + this.itemsPerPage);
        },
        totalPages() {
            return Math.ceil(this.studentList.length / this.itemsPerPage) || 1;
        },
        nextPage() {
            if (this.currentPage < this.totalPages()) this.currentPage++;
        },
        prevPage() {
            if (this.currentPage > 1) this.currentPage--;
        },

        // QR Setup
        showQRSetup: false,
        qrStep: 1,
        qrKelasList: [],
        qrJurusanList: [],
        qrMapelList: [],
        qrSelectedKelas: '',
        qrSelectedJurusan: '',
        qrSelectedMapel: '',
        qrNeedsJurusan: false,

        // Scanner Display
        showScanner: false,
        codeReader: null,
        selectedCamera: null,
        scanSuccessResult: false,
        scannedName: '',
        scannedNisn: '',
        scannedMessage: '',
        isScanning: false,

        // Manual Attendance
        showManual: false,
        manualKelasList: [],
        manualJurusanList: [],
        manualMapelList: [],
        manualSiswaList: [],
        manualSelectedKelas: '',
        manualSelectedJurusan: '',
        manualSelectedMapel: '',
        manualSelectedSiswa: '',
        manualStatus: 'hadir',
        manualNeedsJurusan: false,
        manualLoading: false,

        // Utils
        isDark: false,
        toast: { show: false, message: '', type: 'success', timeoutId: null },
        
        showUbahSandiModal: false,
        showPasswordFields: false,
        isSavingSandi: false,
        ubahSandiForm: { oldPassword: '', newPassword: '', confirmPassword: '' },
        showToast(message, type = 'success') {
            this.toast.message = message;
            this.toast.type = type;
            this.toast.show = true;
            if (this.toast.timeoutId) clearTimeout(this.toast.timeoutId);
            this.toast.timeoutId = setTimeout(() => { this.toast.show = false; }, 5000);
        },

        initDashboard() {
            ThemeUtil.init(this);
            const now = new Date();
            this.currentDate = now.toLocaleDateString('id-ID', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
            this.updateClock();
            setInterval(() => this.updateClock(), 1000);

            window.addEventListener('firebase-guru-ready', (e) => {
                this.guruNama = e.detail.nama || 'Guru';
                this.guruUsername = e.detail.username || '-';
                
                let hasActiveSession = false;
                const savedSession = localStorage.getItem('guru_active_session');
                
                if (savedSession) {
                    try {
                        const data = JSON.parse(savedSession);
                        // Cek apakah kurang dari 1 jam (3600000 ms)
                        if (Date.now() - data.timestamp < 3600000) {
                            hasActiveSession = true;
                            if (window.firebaseListenAttendance) {
                                window.firebaseListenAttendance(data.kelas, data.jurusan, data.mapel, (res) => {
                                    this.studentList = res.studentList;
                                    this.classStats = res.classStats;
                                    this.currentPage = 1;
                                    this.guruWaliKelas = data.kelas + (data.jurusan ? ' ' + data.jurusan : '') + ' - ' + data.mapel;
                                });
                            }
                        } else {
                            // Hapus jika sudah lebih dari 1 jam
                            localStorage.removeItem('guru_active_session');
                        }
                    } catch(err) {}
                }

                if (!hasActiveSession) {
                    this.guruWaliKelas = e.detail.wali_kelas || '-';
                    if (e.detail.studentList) this.studentList = e.detail.studentList;
                    if (e.detail.classStats) this.classStats = e.detail.classStats;
                }
            });
        },

        updateClock() {
            const now = new Date();
            this.currentTime = now.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
        },

        formatTimeStr(ts) {
            if (!ts) return '-';
            const date = ts.toDate ? ts.toDate() : new Date(ts);
            return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
        },

        openUbahSandiModal() {
            this.ubahSandiForm = { oldPassword: '', newPassword: '', confirmPassword: '' };
            this.showPasswordFields = false;
            this.showUbahSandiModal = true;
        },

        async submitUbahSandi() {
            if (this.ubahSandiForm.newPassword !== this.ubahSandiForm.confirmPassword) {
                this.showToast("Sandi baru dan konfirmasi tidak cocok!", "error");
                return;
            }
            this.isSavingSandi = true;
            try {
                if (window.firebaseUbahSandi) {
                    await window.firebaseUbahSandi(this.ubahSandiForm.oldPassword, this.ubahSandiForm.newPassword);
                    this.showToast("Sandi berhasil diubah!", "success");
                    this.showUbahSandiModal = false;
                }
            } catch (e) {
                this.showToast("Gagal mengubah sandi: " + e.message, "error");
            }
            this.isSavingSandi = false;
        },

        // === QR SETUP FLOW ===
        async openQRSetup() {
            this.showQRSetup = true;
            this.qrStep = 1;
            this.qrSelectedKelas = '';
            this.qrSelectedJurusan = '';
            this.qrSelectedMapel = '';
            this.qrNeedsJurusan = false;
            this.qrKelasList = [];
            this.qrJurusanList = [];
            this.qrMapelList = [];
            if (window.firebaseLoadKelas) {
                this.qrKelasList = await window.firebaseLoadKelas();
            }
        },

        async qrSelectKelas(kelas) {
            this.qrSelectedKelas = kelas;
            this.qrStep = 2;
            if (window.firebaseLoadJurusan) {
                this.qrJurusanList = await window.firebaseLoadJurusan();
            }
        },

        async qrSelectJurusan(jurusan) {
            this.qrSelectedJurusan = jurusan;
            this.qrStep = 3;
            if (window.firebaseLoadAllMapel) {
                this.qrMapelList = await window.firebaseLoadAllMapel();
            }
        },

        async qrSelectMapelAndGenerate(mapel) {
            this.qrSelectedMapel = mapel;
            this.showQRSetup = false;
            
            // Start realtime listener for this class dashboard
            if (window.firebaseListenAttendance) {
                window.firebaseListenAttendance(this.qrSelectedKelas, this.qrSelectedJurusan, mapel, (data) => {
                    this.studentList = data.studentList;
                    this.classStats = data.classStats;
                    this.currentPage = 1;
                    this.guruWaliKelas = this.qrSelectedKelas + (this.qrSelectedJurusan ? ' ' + this.qrSelectedJurusan : '') + ' - ' + mapel;
                });
            }

            this.showScanner = true;
            this.startScannerFlow();
        },

        async startScannerFlow() {
            if (!this.codeReader) {
                this.codeReader = new ZXing.BrowserMultiFormatReader();
            }
            try {
                const devices = await this.codeReader.listVideoInputDevices();
                if(devices.length > 0) {
                    if(!this.selectedCamera) {
                        const backCam = devices.find(d => d.label.toLowerCase().includes('back'));
                        this.selectedCamera = backCam ? backCam.deviceId : devices[0].deviceId;
                    }
                    this.isScanning = true;
                    this.decodeVideo();
                } else {
                    this.showToast("Kamera tidak ditemukan", "error");
                }
            } catch (err) {
                this.showToast("Gagal mengakses kamera: " + err.message, "error");
            }
        },

        decodeVideo() {
            if (!this.isScanning) return;
            this.codeReader.decodeFromVideoDevice(this.selectedCamera, 'videoElement', (result, err) => {
                if (result && !this.scanSuccessResult) {
                    this.processScan(result.text);
                }
            });
        },

        changeCamera() {
            if (this.codeReader) {
                this.codeReader.reset();
            }
            setTimeout(() => {
                this.codeReader.listVideoInputDevices().then(devices => {
                    if (devices.length > 1) {
                        let idx = devices.findIndex(d => d.deviceId === this.selectedCamera);
                        idx = (idx + 1) % devices.length;
                        this.selectedCamera = devices[idx].deviceId;
                    }
                    this.decodeVideo();
                });
            }, 300);
        },

        async processScan(code) {
            if(!code || code.trim() === '') return;
            
            // Play Beep Sound
            const audio = document.getElementById('beepAudio');
            if (audio) {
                audio.currentTime = 0;
                audio.play().catch(e => console.log('Audio error', e));
            }

            // Lock scanner UI briefly
            this.scanSuccessResult = true;
            this.scannedNisn = code;
            this.scannedName = 'Memproses...';
            this.scannedMessage = 'Mohon tunggu';

            try {
                const res = await window.firebaseSaveScanAttendanceGuru(code, this.qrSelectedMapel);
                if (res.success) {
                    this.scannedName = res.siswa.nama_lengkap;
                    this.scannedNisn = res.siswa.kelas + (res.siswa.jurusan ? ' ' + res.siswa.jurusan : '');
                    this.scannedMessage = res.message;
                    if (res.duplicate) {
                        // Play alert beep if duplicate?
                    }
                } else {
                    this.scannedName = 'Gagal';
                    this.scannedNisn = code;
                    this.scannedMessage = res.message;
                }
            } catch (e) {
                this.scannedName = 'Error Server';
                this.scannedMessage = e.message;
            }

            // Continue scanning without breaking camera connection (Cashier mode)
            setTimeout(() => {
                this.scanSuccessResult = false;
                // Wait 1 second before decoding again to avoid spamming the same QR
                setTimeout(() => {
                    if (this.showScanner) this.decodeVideo();
                }, 500);
            }, 2500); // Popup shown for 2.5 seconds
        },

        closeScanner() {
            this.showScanner = false;
            this.isScanning = false;
            if (this.codeReader) {
                this.codeReader.reset();
            }
        },

        // === MANUAL ATTENDANCE ===
        async loadManualData() {
            this.manualSelectedKelas = '';
            this.manualSelectedJurusan = '';
            this.manualSelectedSiswa = '';
            this.manualStatus = 'hadir';
            this.manualNeedsJurusan = false;
            this.manualSiswaList = [];
            this.manualJurusanList = [];
            if (window.firebaseLoadKelas) {
                this.manualKelasList = await window.firebaseLoadKelas();
            }
        },

        async manualKelasChanged() {
            this.manualSelectedJurusan = '';
            this.manualSelectedMapel = '';
            this.manualSelectedSiswa = '';
            this.manualSiswaList = [];
            this.manualMapelList = [];
            const kelas = this.manualSelectedKelas;
            if (kelas) {
                if (window.firebaseLoadJurusan) {
                    this.manualJurusanList = await window.firebaseLoadJurusan();
                }
            }
        },

        async manualJurusanChanged() {
            this.manualSelectedMapel = '';
            this.manualSelectedSiswa = '';
            this.manualSiswaList = [];
            this.manualMapelList = [];
            if (this.manualSelectedJurusan) {
                if (window.firebaseLoadAllMapel) {
                    this.manualMapelList = await window.firebaseLoadAllMapel();
                }
            }
        },

        async manualMapelChanged() {
            this.manualSelectedSiswa = '';
            if (this.manualSelectedMapel) {
                if (window.firebaseLoadSiswa) {
                    this.manualSiswaList = await window.firebaseLoadSiswa(this.manualSelectedKelas, this.manualSelectedJurusan);
                }
            }
        },

        async submitManualAttendance() {
            if (!this.manualSelectedSiswa || !this.manualSelectedKelas || !this.manualSelectedMapel) return;
            this.manualLoading = true;
            const siswa = this.manualSiswaList.find(s => s.id === this.manualSelectedSiswa);
            if (!siswa) { this.showToast('Siswa tidak ditemukan', 'error'); this.manualLoading = false; return; }
            try {
                const result = await window.firebaseSaveManualAttendance(siswa, this.manualStatus, this.manualSelectedMapel);
                if (result.duplicate) {
                    this.showToast(result.message, 'error');
                } else {
                    this.showToast('Presensi berhasil disimpan!', 'success');
                    this.manualSelectedSiswa = '';
                    
                    // Update dashboard background after saving successfully
                    if (window.firebaseListenAttendance) {
                        window.firebaseListenAttendance(this.manualSelectedKelas, this.manualSelectedJurusan, this.manualSelectedMapel, (data) => {
                            this.studentList = data.studentList;
                            this.classStats = data.classStats;
                            this.currentPage = 1;
                            this.guruWaliKelas = this.manualSelectedKelas + (this.manualSelectedJurusan ? ' ' + this.manualSelectedJurusan : '') + ' - ' + this.manualSelectedMapel;
                        });
                    }
                }
            } catch(e) {
                this.showToast('Error: ' + e.message, 'error');
            }
            this.manualLoading = false;
        },

        toggleTheme() { ThemeUtil.toggle(this); },

        logout() {
            if (this.qrCountdown) clearInterval(this.qrCountdown);
            if (window.firebaseLogout) window.firebaseLogout();
        },

        formatTimer() {
            const m = Math.floor(this.qrTimer / 60);
            const s = this.qrTimer % 60;
            return m + ':' + (s < 10 ? '0' : '') + s;
        }
    }
}
