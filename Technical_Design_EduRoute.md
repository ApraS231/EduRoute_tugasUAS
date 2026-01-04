# **Technical Design Document: EduRoute Bontang**

**Stack:** React.js (Vite), Express.js, Leaflet (Map), TailwindCSS

## **1\. Arsitektur Sistem & Alur Kerja (Workflow)**

Sistem ini menggunakan arsitektur **Client-Server**. Karena data spasial (A\*) cukup berat diproses di browser klien, kita akan menaruh logika algoritma A\* di server (Backend).

### **A. Diagram Alur Data**

\[Browser / User\]   
    |  
    | (1. Request Map Data)  
    v  
\[React Frontend\]  
    |  
    | (2. GET /api/layers)      (4. POST /api/find-path)  
    |-------------------------\> |  
    |                           |  
    | (3. Send GeoJSON)         | (5. Calculate A\*)  
    | \<------------------------ |  
                                v  
                        \[Express Backend\]  
                                |  
                        (Reads JSON Files)  
                        \[Data Storage\]  
                        \- schools.json  
                        \- zones.json  
                        \- graph\_bontang.json (Untuk A\*)

### **B. Cara Kerja Fitur Utama**

#### **1\. Visualisasi Peta (Load Awal)**

1. **Server Start:** Express membaca semua file GeoJSON (Sekolah, Zonasi, Rute Angkot) ke dalam memori.  
2. **Client Load:** Saat React dimuat, ia memanggil endpoint /api/static-data.  
3. **Rendering:** React menggunakan react-leaflet untuk merender:  
   * Marker untuk sekolah.  
   * Polygon untuk zonasi (dengan warna transparan).  
   * Polyline untuk rute statis (angkot/bus sekolah).

#### **2\. Pencarian Rute (Algoritma A\*)**

1. **Input:** User memilih lokasi awal (klik peta/GPS) dan tujuan (pilih sekolah).  
2. **Request:** Frontend mengirim koordinat {startLat, startLon, endLat, endLon} ke Backend.  
3. **Process (Server-Side):**  
   * Backend mencari **Node Terdekat** dari koordinat user di dalam graph\_bontang.json.  
   * Backend menjalankan algoritma \**A Star (A*)\*\* menggunakan data graph adjacency list.  
4. **Response:** Backend mengirimkan array koordinat \[\[lat, lon\], \[lat, lon\], ...\] yang membentuk jalur.  
5. **Rendering:** Frontend menggambar garis jalur dinamis (warna berbeda, misal: biru tebal).

## **2\. Struktur Project**

Kita akan menggunakan struktur **Monorepo** sederhana.

eduroute-bontang/  
├── data/                   \# Menyimpan file JSON/GeoJSON  
│   ├── schools.json  
│   ├── zones.json  
│   ├── routes\_static.json  
│   └── graph\_bontang.json  \# Hasil generate dari map\_processor.py  
├── server/                 \# Backend (Express)  
│   ├── index.js            \# Entry point & Routes  
│   ├── astar.js            \# Logika Algoritma A\*  
│   └── package.json  
└── client/                 \# Frontend (React \+ Vite)  
    ├── src/  
    │   ├── components/  
    │   │   ├── MapView.jsx      \# Peta Utama  
    │   │   └── Sidebar.jsx      \# Panel Kontrol  
    │   ├── App.jsx  
    │   └── main.jsx  
    └── package.json

## **3\. Rincian Pembangunan (Step-by-Step Implementation)**

### **Tahap 1: Persiapan Data**

Pastikan file graph\_bontang.json (yang dihasilkan script Python sebelumnya) sudah ada di folder data/. File ini krusial untuk fitur routing.

### **Tahap 2: Backend Development (Express.js)**

Backend bertugas melayani data statis dan memproses algoritma A\*.

**1\. Setup Project Server**

mkdir server && cd server  
npm init \-y  
npm install express cors body-parser

\*2. Implementasi Algoritma A (Convert Python to JS)\*\*  
Buat file server/astar.js. Kita perlu mengonversi logika Python sebelumnya ke JavaScript.  
// server/astar.js  
const fs \= require('fs');

class AStarPathfinder {  
    constructor(graphFilePath) {  
        console.log("Loading graph data...");  
        const rawData \= fs.readFileSync(graphFilePath);  
        const data \= JSON.parse(rawData);  
          
        // Convert array nodes ke Object Map untuk akses cepat  
        this.nodes \= {};  
        data.nodes.forEach(n \=\> {  
            this.nodes\[n.id\] \= n;  
        });

        // Adjacency list  
        this.adjacency \= data.adjacency;  
    }

    // Heuristic (Euclidean Distance)  
    heuristic(nodeAId, nodeBId) {  
        const nodeA \= this.nodes\[nodeAId\];  
        const nodeB \= this.nodes\[nodeBId\];  
        const dx \= nodeA.lon \- nodeB.lon;  
        const dy \= nodeA.lat \- nodeB.lat;  
        // Konversi kasar derajat ke meter (sekitar 111km per derajat)  
        return Math.sqrt(dx \* dx \+ dy \* dy) \* 111000;  
    }

    // Cari node terdekat dari koordinat klik user  
    findNearestNode(lat, lon) {  
        let minDist \= Infinity;  
        let nearestId \= \-1;

        for (const id in this.nodes) {  
            const node \= this.nodes\[id\];  
            const dist \= Math.sqrt(Math.pow(node.lat \- lat, 2\) \+ Math.pow(node.lon \- lon, 2));  
            if (dist \< minDist) {  
                minDist \= dist;  
                nearestId \= parseInt(id);  
            }  
        }  
        return nearestId;  
    }

    findPath(startLat, startLon, endLat, endLon) {  
        const startNodeId \= this.findNearestNode(startLat, startLon);  
        const endNodeId \= this.findNearestNode(endLat, endLon);

        // Priority Queue sederhana (Array sort)  
        // Format: { id, fScore }  
        let openSet \= \[{ id: startNodeId, f: 0 }\];  
        let cameFrom \= {};

        let gScore \= {}; // Cost from start  
        let fScore \= {}; // Estimated total cost

        // Initialize scores  
        Object.keys(this.nodes).forEach(k \=\> {  
            gScore\[k\] \= Infinity;  
            fScore\[k\] \= Infinity;  
        });

        gScore\[startNodeId\] \= 0;  
        fScore\[startNodeId\] \= this.heuristic(startNodeId, endNodeId);

        while (openSet.length \> 0\) {  
            // Sort ascending by fScore (simulasi priority queue)  
            openSet.sort((a, b) \=\> a.f \- b.f);  
            const current \= openSet.shift(); // Ambil yang terkecil  
            const currentId \= current.id;

            if (currentId \=== endNodeId) {  
                return this.reconstructPath(cameFrom, currentId);  
            }

            const neighbors \= this.adjacency\[currentId\] || \[\];  
              
            for (let neighbor of neighbors) {  
                const neighborId \= neighbor.target;  
                const weight \= neighbor.weight;

                const tentativeGScore \= gScore\[currentId\] \+ weight;

                if (tentativeGScore \< gScore\[neighborId\]) {  
                    cameFrom\[neighborId\] \= currentId;  
                    gScore\[neighborId\] \= tentativeGScore;  
                    fScore\[neighborId\] \= gScore\[neighborId\] \+ this.heuristic(neighborId, endNodeId);

                    // Jika belum ada di openSet, masukkan  
                    if (\!openSet.some(n \=\> n.id \=== neighborId)) {  
                        openSet.push({ id: neighborId, f: fScore\[neighborId\] });  
                    } else {  
                        // Update fScore di openSet  
                        const index \= openSet.findIndex(n \=\> n.id \=== neighborId);  
                        openSet\[index\].f \= fScore\[neighborId\];  
                    }  
                }  
            }  
        }  
        return null; // Tidak ada jalan  
    }

    reconstructPath(cameFrom, currentId) {  
        const path \= \[\];  
        while (currentId in cameFrom) {  
            const node \= this.nodes\[currentId\];  
            path.unshift(\[node.lat, node.lon\]); // Leaflet format: \[lat, lon\]  
            currentId \= cameFrom\[currentId\];  
        }  
        // Jangan lupa masukkan titik start  
        const startNode \= this.nodes\[currentId\];  
        path.unshift(\[startNode.lat, startNode.lon\]);  
        return path;  
    }  
}

module.exports \= AStarPathfinder;

**3\. Setup Express Routes (server/index.js)**

const express \= require('express');  
const cors \= require('cors');  
const path \= require('path');  
const AStarPathfinder \= require('./astar');

const app \= express();  
const PORT \= 5000;

app.use(cors());  
app.use(express.json());

// Load Graph Data saat server start  
const pathfinder \= new AStarPathfinder(path.join(\_\_dirname, '../data/graph\_bontang.json'));

// Endpoint 1: API Routing A\*  
app.post('/api/find-path', (req, res) \=\> {  
    const { startLat, startLon, endLat, endLon } \= req.body;  
      
    console.log(\`Mencari rute dari \[${startLat}, ${startLon}\] ke \[${endLat}, ${endLon}\]\`);  
      
    try {  
        const path \= pathfinder.findPath(startLat, startLon, endLat, endLon);  
        if (path) {  
            res.json({ success: true, path: path });  
        } else {  
            res.json({ success: false, message: "Rute tidak ditemukan" });  
        }  
    } catch (error) {  
        console.error(error);  
        res.status(500).json({ error: "Terjadi kesalahan server" });  
    }  
});

// Endpoint 2: Data GIS Static (GeoJSON)  
// Anda bisa meload file JSON lain dan mengirimnya di sini  
app.get('/api/gis-data', (req, res) \=\> {  
    // Contoh load data statis (bisa diganti fs.readFileSync)  
    const schools \= require('../data/schools.json');   
    const zones \= require('../data/zones.json');  
      
    res.json({ schools, zones });  
});

app.listen(PORT, () \=\> {  
    console.log(\`Server berjalan di http://localhost:${PORT}\`);  
});

### **Tahap 3: Frontend Development (React.js)**

Frontend bertugas menampilkan peta interaktif.

**1\. Setup React**

npm create vite@latest client \-- \--template react  
cd client  
npm install leaflet react-leaflet axios  
npm install \-D tailwindcss postcss autoprefixer  
npx tailwindcss init \-p

*Konfigurasi Tailwind di tailwind.config.js dan index.css sesuai dokumentasi standar.*

**2\. Komponen Peta (client/src/components/MapView.jsx)**

import React, { useState, useEffect } from 'react';  
import { MapContainer, TileLayer, Marker, Popup, Polygon, Polyline, useMapEvents } from 'react-leaflet';  
import axios from 'axios';  
import 'leaflet/dist/leaflet.css';

// Fix icon marker default Leaflet di React  
import L from 'leaflet';  
import icon from 'leaflet/dist/images/marker-icon.png';  
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon \= L.icon({  
    iconUrl: icon,  
    shadowUrl: iconShadow,  
    iconSize: \[25, 41\],  
    iconAnchor: \[12, 41\]  
});  
L.Marker.prototype.options.icon \= DefaultIcon;

// Komponen untuk menangani klik pada peta  
function ClickHandler({ setStartPoint }) {  
    useMapEvents({  
        click(e) {  
            setStartPoint({ lat: e.latlng.lat, lng: e.latlng.lng });  
            alert("Titik awal diset\! Sekarang pilih sekolah tujuan.");  
        },  
    });  
    return null;  
}

const MapView \= () \=\> {  
    const \[schools, setSchools\] \= useState(\[\]); // Data GeoJSON Sekolah  
    const \[zones, setZones\] \= useState(\[\]);     // Data GeoJSON Zonasi  
    const \[routePath, setRoutePath\] \= useState(\[\]); // Hasil A\* (Garis)  
    const \[startPoint, setStartPoint\] \= useState(null); // Koordinat User  
      
    // 1\. Fetch Data Awal (Sekolah & Zonasi)  
    useEffect(() \=\> {  
        // Asumsi endpoint ini mengembalikan GeoJSON yang kita buat sebelumnya  
        // Untuk demo, data bisa di-hardcode atau fetch dari backend  
        // axios.get('http://localhost:5000/api/gis-data').then(...)  
    }, \[\]);

    // 2\. Fungsi Mencari Rute  
    const handleFindRoute \= async (schoolLat, schoolLon) \=\> {  
        if (\!startPoint) {  
            alert("Klik peta terlebih dahulu untuk set lokasi Anda\!");  
            return;  
        }

        try {  
            const response \= await axios.post('http://localhost:5000/api/find-path', {  
                startLat: startPoint.lat,  
                startLon: startPoint.lng,  
                endLat: schoolLat,  
                endLon: schoolLon  
            });

            if (response.data.success) {  
                setRoutePath(response.data.path); // Set state untuk menggambar garis  
            } else {  
                alert("Rute tidak ditemukan.");  
            }  
        } catch (error) {  
            console.error("Error fetching path:", error);  
        }  
    };

    return (  
        \<div className="h-screen w-full relative"\>  
            \<div className="absolute top-4 left-4 z-\[9999\] bg-white p-4 rounded shadow-lg"\>  
                \<h1 className="font-bold text-xl"\>EduRoute Bontang\</h1\>  
                \<p className="text-sm text-gray-600"\>Klik peta untuk set lokasi awal,\</p\>  
                \<p className="text-sm text-gray-600"\>Lalu klik Marker Sekolah untuk rute.\</p\>  
                {startPoint && \<p className="text-green-600 text-xs mt-2"\>Lokasi Awal: {startPoint.lat.toFixed(4)}, {startPoint.lng.toFixed(4)}\</p\>}  
            \</div\>

            \<MapContainer center={\[0.1347, 117.4980\]} zoom={13} style={{ height: "100%", width: "100%" }}\>  
                \<TileLayer  
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"  
                    attribution='© OpenStreetMap contributors'  
                /\>  
                  
                \<ClickHandler setStartPoint={setStartPoint} /\>

                {/\* Render Titik Awal User \*/}  
                {startPoint && \<Marker position={\[startPoint.lat, startPoint.lng\]} /\>}

                {/\* Render Jalur A\* (Hasil Backend) \*/}  
                {routePath.length \> 0 && (  
                    \<Polyline positions={routePath} color="blue" weight={5} /\>  
                )}

                {/\* Contoh Render Marker Sekolah Manual (Nanti loop dari state schools) \*/}  
                \<Marker position={\[0.1347, 117.4980\]}\>  
                    \<Popup\>  
                        \<b\>SMAN 1 Bontang\</b\>\<br /\>  
                        \<button   
                            onClick={() \=\> handleFindRoute(0.1347, 117.4980)}  
                            className="bg-blue-500 text-white px-2 py-1 rounded text-xs mt-2"  
                        \>  
                            Cari Rute ke Sini  
                        \</button\>  
                    \</Popup\>  
                \</Marker\>

                {/\* Area Zonasi (Contoh Statis) \*/}  
                \<Polygon   
                    positions={\[  
                        \[0.1310, 117.4940\], \[0.1310, 117.5020\],   
                        \[0.1385, 117.5020\], \[0.1385, 117.4940\]  
                    \]}  
                    pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.2 }}   
                /\>

            \</MapContainer\>  
        \</div\>  
    );  
};

export default MapView;  
