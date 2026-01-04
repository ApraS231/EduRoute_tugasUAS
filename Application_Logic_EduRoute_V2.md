# **Application Logic & Workflow Architecture V2: Node-Based Routing**

Dokumen ini adalah revisi dari arsitektur sebelumnya, disesuaikan untuk menggunakan **sample\_nodes.geojson** sebagai **satu-satunya referensi titik (Vertex)** dalam graf navigasi, dan **jalan\_bontang.geojson** sebagai geometri penghubung (Edge).

## **1\. Konsep Utama: Node-Centric Navigation**

Dalam desain baru ini, peta dianggap sebagai sekumpulan titik penting (Halte, Simpang, Sekolah) yang terhubung oleh garis jalan.

* **Nodes (Titik Henti):** Hanya titik yang ada di sample\_nodes.geojson.  
* **Edges (Jalur):** Garis dari jalan\_bontang.geojson yang menghubungkan dua Node tersebut.  
* **Marking:** Semua Node akan dimunculkan di peta sebagai marker interaktif.

## **2\. Alur Penggabungan Data (Data Pipeline)**

Sebelum aplikasi bisa berjalan, kita perlu memproses (Pre-processing) kedua file GeoJSON tersebut agar menjadi **Graph** yang valid di database.

### **Langkah 1: Mapping & Snapping (Server-Side Script)**

Karena jalan\_bontang.geojson berisi garis mentah dan sample\_nodes.geojson berisi titik, kita perlu "menempelkan" ujung-ujung garis jalan ke titik node terdekat.

**Logika Script Import (import\_graph.js):**

1. **Load Nodes:** Baca sample\_nodes.geojson. Simpan semua koordinat & ID ke dalam memori (atau Spatial Index/KD-Tree).  
2. **Load Roads:** Baca jalan\_bontang.geojson.  
3. **Iterasi Garis Jalan:** Untuk setiap fitur *LineString* di data jalan:  
   * Ambil koordinat **Awal** garis. Cari Node terdekat di sample\_nodes (Radius max 20m).  
   * Ambil koordinat **Akhir** garis. Cari Node terdekat di sample\_nodes.  
   * **Validasi:** Jika *kedua* ujung berhasil menemukan Node terdekat (misal Node A dan Node B), maka garis ini dianggap sebagai **Valid Edge** yang menghubungkan A dan B.  
   * **Simpan ke DB:** Masukkan ke tabel GraphEdge dengan:  
     * sourceId: ID Node A  
     * targetId: ID Node B  
     * weight: Panjang garis (meter)  
     * geometry: JSON koordinat garis (untuk digambar di peta).

## **3\. Visualisasi Frontend (Marking & Map)**

Di sisi website (React), kita akan menampilkan semua elemen.

### **A. Menampilkan Semua Marking**

Frontend akan mengambil data dari endpoint /api/nodes (yang bersumber dari sample\_nodes.geojson di DB).

* **Render:** Loop semua data nodes.  
* **Component:** Gunakan \<CircleMarker\> atau custom Icon.  
* **Style:**  
  * Node Sekolah: Icon Topi Toga (Besar).  
  * Node Simpang/Jalan: Titik kecil (Dot) warna abu-abu (agar peta tidak penuh sesak, tapi user tahu itu titik jalur).  
* **Interaksi:** Marker bisa diklik untuk dijadikan "Titik Awal" manual atau "Tujuan".

### **B. Menampilkan Jalur Jalan**

Frontend mengambil data /api/edges (dari jalan\_bontang.geojson yang valid).

* **Render:** \<Polyline\> warna abu-abu tipis sebagai *background* jalan raya.

## **4\. Logika Algoritma A\* (Revisi)**

Logika pencarian jalan diubah total agar bergantung pada Marker/Point yang tersedia.

### **Skenario: User mencari rute ke SMAN 1**

**1\. Input Data:**

* **Lokasi User (GPS):** Misal \[0.145, 117.462\] (Koordinat sembarang).  
* **Tujuan:** ID Node SMAN 1 (Misal Node ID: 8).

**2\. Langkah 1: Snap to Nearest Marker (Logika Baru)**

* Sistem **tidak** mencari jalan terdekat.  
* Sistem mencari **Node (Marking) Terdekat** dari lokasi GPS user di database.  
* *Contoh:* GPS user dekat dengan "Simpang Telihan" (Node ID: 2).  
* **Start Node:** Node ID: 2\.

*3\. Langkah 2: Eksekusi A Graph Traversal*\*

* Jalankan A\* standar:  
  * OPEN SET: Masukkan Start Node (2).  
  * GOAL: Node SMAN 1 (8).  
  * HEURISTIC: Jarak lurus dari Node sekarang ke Node 8\.  
* Sistem akan melompat dari Marking ke Marking (2 \-\> 3 \-\> 4 ...) melalui Edge yang sudah disimpan.

**4\. Langkah 3: Construct Result**

* Hasil A\* adalah urutan ID Node: \[2, 3, 4, 5, 6, 7, 8\].  
* Backend mengambil **Geometry Edge** yang menghubungkan urutan tersebut (Garis melengkung jalan asli dari jalan\_bontang.geojson).  
* Gabungkan semua garis menjadi satu Array Polyline panjang.

## **5\. Implementasi Kode (Backend Logic)**

Berikut adalah *pseudocode* untuk logic pencarian Node terdekat yang baru di Backend (server/astar.js).

// Fungsi Mencari Titik Mulai (Start Node)  
// Menggantikan logika lama yang mencari "Nearest Point on Line"  
function findNearestGraphNode(userLat, userLon) {  
    const allNodes \= getAllNodesFromMemory(); // Load sample\_nodes  
    let nearestNode \= null;  
    let minDistance \= Infinity;

    for (const node of allNodes) {  
        const dist \= calculateHaversine(userLat, userLon, node.lat, node.lon);  
          
        // Simpan node dengan jarak terpendek  
        if (dist \< minDistance) {  
            minDistance \= dist;  
            nearestNode \= node;  
        }  
    }

    // Return ID dari sample\_nodes yang paling dekat dengan user  
    return nearestNode.id;   
}

## **6\. User Experience (UX) Flow di Website**

1. **Buka Peta:**  
   * Muncul garis-garis jalan (jalan\_bontang.geojson).  
   * Muncul titik-titik marking (sample\_nodes.geojson).  
2. **User Klik "Cari Rute":**  
   * Browser minta lokasi GPS.  
   * Sistem otomatis mendeteksi: *"Posisi Anda dekat dengan Marking: **Simpang Telihan**"*.  
   * Sistem menggambar garis rute dari **Simpang Telihan** menuju Sekolah tujuan.  
3. **Visualisasi Rute:**  
   * Rute yang dihasilkan akan terlihat "melompat" antar titik marking, tapi mengikuti lekukan jalan raya yang sesungguhnya (karena kita menyimpan geometri jalan\_bontang di Edge).

### **Kelebihan Logika Baru Ini:**

* **Lebih Stabil:** Rute pasti tersambung karena hanya menggunakan titik yang sudah didefinisikan di sample\_nodes.  
* **Lebih Cepat:** Algoritma A\* hanya perlu mengevaluasi jumlah node yang sedikit (sesuai jumlah marker), tidak perlu mengevaluasi ribuan titik koordinat jalan mentah.  
* **Debugging Mudah:** Jika rute salah, kita cukup cek apakah sample\_nodes terhubung di visualisasi peta.