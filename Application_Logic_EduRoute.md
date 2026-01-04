# **Application Logic & Workflow Architecture: EduRoute Bontang**

Dokumen ini menjelaskan "Otak" dari aplikasi: bagaimana data diproses, algoritma dijalankan, dan bagaimana fitur bekerja dari hulu ke hilir.

## **1\. Arsitektur Global (High-Level Workflow)**

Aplikasi ini menggunakan pola **Client-Server** dengan pembagian tanggung jawab sebagai berikut:

* **Frontend (React \+ Leaflet \+ GSAP):** Bertanggung jawab atas visualisasi, interaksi pengguna, dan meminta data. **Tidak melakukan perhitungan berat.**  
* **Backend (Express \+ Prisma):** Bertanggung jawab memuat Graph jalan ke memori (RAM), menjalankan algoritma A\*, dan mengambil data dari Database MySQL.  
* **Database (MySQL):** Penyimpanan persisten untuk data sekolah, zonasi, dan struktur graph jalan.

### **Diagram Alur Data**

1. **Initial Load:** Frontend meminta data statis (Sekolah & Zonasi) \-\> Backend query DB \-\> Frontend render Marker & Polygon.  
2. **User Interaction:** User klik "Cari Rute" \-\> Frontend kirim koordinat (Start & End) \-\> Backend hitung A\* \-\> Backend kirim Array Jalur \-\> Frontend gambar Garis.

## **2\. Logika Utama: Algoritma Pencarian Rute (A\*)**

Ini adalah fitur paling kompleks. Kita tidak menggunakan Google Maps API untuk routing, melainkan menghitung sendiri berdasarkan data sample\_nodes.geojson dan sample\_edges.geojson yang tersimpan di DB.

### **A. Persiapan Data (Server-Side In-Memory)**

Karena query database berulang-ulang saat algoritma berjalan itu lambat, Backend akan memuat seluruh Graph ke RAM saat server dinyalakan.

1. **Fetch Nodes:** SELECT \* FROM graph\_nodes \-\> Simpan ke Map\<NodeID, {lat, lon}\>.  
2. **Fetch Edges:** SELECT \* FROM graph\_edges \-\> Simpan ke Map\<SourceID, Array\<{TargetID, Weight}\>\> (Adjacency List).

### **B. Tahapan Logika A\* (Request Cycle)**

Saat user meminta rute dari Koordinat A (GPS User) ke Koordinat B (Sekolah):

1. **Snap to Road (Mencari Node Terdekat):**  
   * Koordinat user mungkin tidak pas di tengah jalan (misal: di dalam rumah).  
   * **Logika:** Loop semua Node di graph, hitung jarak Euclidean/Haversine. Node dengan jarak terpendek menjadi StartNode.  
   * Lakukan hal yang sama untuk lokasi sekolah \-\> EndNode.  
2. \**Eksekusi Algoritma A*:\*\*  
   * **OpenSet (Antrian Prioritas):** Masukkan StartNode.  
   * **G-Score (Biaya Nyata):** Jarak dari Start ke Node saat ini.  
   * **H-Score (Heuristik):** Estimasi jarak lurus (burung terbang) dari Node saat ini ke EndNode.  
   * **F-Score:** G \+ H.  
   * **Loop:**  
     * Ambil node dengan F-Score terendah dari OpenSet.  
     * Jika node \== EndNode, selesai (Path Found).  
     * Cek semua tetangga (Neighbor) dari Adjacency List.  
     * Jika jalur baru ke tetangga lebih pendek dari yang sudah ada, update G-Score dan parent node-nya.  
3. **Reconstruct Path:**  
   * Telusuri balik dari EndNode ke parent-nya terus menerus sampai StartNode.  
   * Kumpulkan koordinat Lat/Lng-nya.  
4. **Response:**  
   * Kirim array koordinat \[\[lat, lng\], \[lat, lng\], ...\] ke Frontend.

## **3\. Rincian Fitur & Fungsi (Functional Spec)**

Berikut adalah logika spesifik untuk setiap fitur di Frontend.

### **Fitur 1: Visualisasi Zonasi (Smart Layering)**

* **Tujuan:** Melihat area penerimaan siswa baru.  
* **Logika Default:** Semua layer zonasi (Merah, Biru, Hijau) tampil transparan (opacity: 0.2).  
* **Logika Interaksi (Focus Mode):**  
  * **Event:** User klik Marker "SMAN 1 Bontang".  
  * **Action:**  
    1. Set opacity zonasi SMAN 1 menjadi 0.6 (lebih tebal).  
    2. Set opacity zonasi sekolah LAIN menjadi 0 (sembunyi).  
    3. FlyTo (Zoom animasi) ke koordinat SMAN 1\.  
  * **Reset:** Klik tombol "Reset Peta" atau klik area kosong peta untuk mengembalikan opacity semua layer ke 0.2.

### **Fitur 2: Geolocation & Routing**

* **Tujuan:** Mengetahui posisi user dan rute ke sekolah.  
* **Logika:**  
  1. **Get Location:** Panggil navigator.geolocation.getCurrentPosition().  
  2. **Validasi:** Jika user menolak izin lokasi, gunakan lokasi default (misal: Pusat Kota Bontang) dan beri notifikasi Toast Warning.  
  3. **Find Route:**  
     * Ambil koordinat GPS user.  
     * Ambil koordinat Sekolah yang sedang dipilih.  
     * Panggil API POST /api/find-path.  
  4. **Render:**  
     * Terima respons JSON.  
     * Gunakan komponen \<Polyline /\> Leaflet dengan warna blue dan dashArray: null (garis solid).  
     * Tambahkan animasi "Snake" (garis tergambar perlahan) menggunakan CSS/SVG stroke-dashoffset jika memungkinkan (opsional GSAP).

### **Fitur 3: Filter Kategori (Toggle Layers)**

* **Tujuan:** Menyaring informasi agar peta tidak semrawut.  
* **State Management (React useState):**  
  const \[layers, setLayers\] \= useState({  
    zonasi: true,  
    bus: true,  
    angkot: true  
  });

* **Logika Render:**  
  * Di dalam JSX MapContainer: {layers.zonasi && \<ZonasiLayer data={zones} /\>}.  
  * Jika toggle dimatikan, komponen React dihapus dari DOM map, sehingga layer hilang instan.

### **Fitur 4: Search & Autocomplete**

* **Tujuan:** Mencari sekolah tanpa scrolling peta.  
* **Logika:**  
  1. **Input:** User mengetik "YPK".  
  2. **Filter:** Filter array schools di memori client (karena data sekolah sedikit \< 100, tidak perlu request server search).  
  3. **Select:** Saat user memilih hasil:  
     * Trigger event klik marker sekolah tersebut secara programatik.  
     * Peta zoom ke lokasi sekolah.  
     * Panel detail sekolah terbuka.

## **4\. Struktur Data API (Request/Response Contract)**

### **A. GET /api/gis-data**

Mengambil data statis awal.

**Response:**

{  
  "schools": {  
    "type": "FeatureCollection",  
    "features": \[  
      {  
        "type": "Feature",  
        "properties": { "id": 1, "name": "SMAN 1", "zones": \[...\] },  
        "geometry": { "type": "Point", "coordinates": \[...\] }  
      }  
    \]  
  },  
  "routes\_static": { ... } // Rute angkot/bus statis (bukan hasil A\*)  
}

### **B. POST /api/find-path**

Meminta perhitungan A\*.

**Request:**

{  
  "startLat": 0.1500,  
  "startLon": 117.4600,  
  "endLat": 0.1347,  
  "endLon": 117.4980  
}

**Response (Success):**

{  
  "success": true,  
  "distance\_meters": 4500, // Total jarak (akumulasi weight edge)  
  "path": \[  
    \[0.1500, 117.4600\],  
    \[0.1480, 117.4655\],  
    ...  
  \]  
}

## **5\. Penanganan Error (Edge Cases)**

1. **"No Path Found":**  
   * *Sebab:* User berada di pulau terpisah atau data graph tidak terhubung.  
   * *Action:* Backend return success: false. Frontend tampilkan Toast Error: "Jalur tidak ditemukan dari lokasi Anda."  
2. **"Out of Bounds":**  
   * *Sebab:* User membuka aplikasi saat berada di Jakarta (bukan Bontang).  
   * *Action:* Algoritma findNearestNode akan mencari node di Bontang yang jaraknya ribuan KM.  
   * *Mitigasi:* Backend cek jika jarak User \-\> NearestNode \> 10 KM, tolak request. Return error: "Anda berada di luar jangkauan layanan EduRoute Bontang."

## **6\. Stack & Tools Tambahan**

* **Turf.js (Opsional di Frontend):** Jika ingin menghitung jarak garis lurus (Euclidean) atau mengecek apakah titik user berada DI DALAM polygon zonasi secara client-side, library ini sangat berguna.  
* **Zustand (State Management):** Jika state layers, selectedSchool, userLocation menjadi terlalu rumit untuk useState biasa, gunakan Zustand agar state global lebih rapi.