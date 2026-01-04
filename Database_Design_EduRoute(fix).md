# **Database Design Document: EduRoute Bontang (MySQL \+ Prisma)**

Dokumen ini merincikan struktur database, instalasi, dan alur data untuk menyimpan data spasial (GIS) sekolah, zonasi dari **map.geojson**, serta **Data Graph Jalan** untuk kebutuhan algoritma A\* di MySQL menggunakan Prisma ORM.

## **1\. Arsitektur Data & Pilihan Tipe Data**

Kita menggunakan pendekatan **Hybrid**:

1. **Entity Data (Sekolah, Node):** Disimpan dengan kolom Latitude/Longitude terpisah untuk indexing yang efisien.  
2. **Geometry Data (Zonasi, Bentuk Jalan):** Disimpan sebagai JSON agar kompatibel langsung dengan GeoJSON di Frontend (Leaflet).

## **2\. Struktur Schema Prisma (schema.prisma)**

Tidak ada perubahan struktur dari versi sebelumnya, namun kita pastikan model mengakomodasi data graph.

// prisma/schema.prisma

generator client {  
  provider \= "prisma-client-js"  
}

datasource db {  
  provider \= "mysql"  
  url      \= env("DATABASE\_URL")  
}

// \--- ENUMS \---  
enum SchoolType {  
  SMA  
  SMK  
  MA  
  SWASTA  
}

enum RouteType {  
  BUS\_SEKOLAH  
  ANGKOT  
  JALAN\_UTAMA  
}

// \--- GIS MODELS \---

// 1\. Sekolah (Marker)  
model School {  
  id          Int      @id @default(autoincrement())  
  name        String   @unique @db.VarChar(100) // Unique agar mudah dilookup saat seeding zonasi  
  type        SchoolType  
  address     String   @db.Text  
  latitude    Float  
  longitude   Float  
  photoUrl    String?  @map("photo\_url")  
  description String?  @db.Text  
    
  zones       Zone\[\]  
    
  createdAt   DateTime @default(now())  
  updatedAt   DateTime @updatedAt

  @@map("schools")  
}

// 2\. Zonasi (Polygon)  
model Zone {  
  id          Int      @id @default(autoincrement())  
  name        String  
  color       String   @db.VarChar(7)  
  coordinates Json     // GeoJSON Polygon \[\[lat,lng\], ...\] dari map.geojson  
    
  schoolId    Int      @map("school\_id")  
  school      School   @relation(fields: \[schoolId\], references: \[id\], onDelete: Cascade)

  @@map("zones")  
}

// 3\. Rute Visual (Untuk Layer Statis di Peta)  
model Route {  
  id          Int       @id @default(autoincrement())  
  name        String  
  type        RouteType  
  color       String    @db.VarChar(7)  
  pathData    Json      // GeoJSON LineString  
  description String?   @db.Text

  @@map("routes")  
}

// \--- PATHFINDING MODELS (Untuk Algoritma A\*) \---

// 4\. Node Graph (Titik Persimpangan)  
model GraphNode {  
  id          Int      @id // ID manual dari sample\_nodes.geojson  
  label       String?  
  latitude    Float  
  longitude   Float  
    
  edgesFrom   GraphEdge\[\] @relation("SourceNode")  
  edgesTo     GraphEdge\[\] @relation("TargetNode")

  @@map("graph\_nodes")  
}

// 5\. Edge Graph (Garis Jalan Antar Node)  
model GraphEdge {  
  id          Int      @id @default(autoincrement())  
    
  sourceId    Int  
  source      GraphNode @relation("SourceNode", fields: \[sourceId\], references: \[id\])  
    
  targetId    Int  
  target      GraphNode @relation("TargetNode", fields: \[targetId\], references: \[id\])  
    
  weight      Float    // Jarak dalam meter (Cost)  
  geometry    Json?    // Bentuk jalan (LineString)

  @@map("graph\_edges")  
}

## **3\. Setup & Instalasi**

Jika Anda mengubah schema.prisma (misal menambahkan @unique pada name School), jalankan migrasi ulang:

npx prisma migrate dev \--name update\_schema

## **4\. Alur Seeding (Import Data GeoJSON)**

Kita akan mengimpor **map.geojson** (Zonasi) dan data Graph (Nodes/Edges) ke database.

### **A. Persiapan File**

Simpan file yang Anda miliki ke struktur folder berikut:

server/  
├── prisma/  
│   ├── data/  
│   │   ├── map.geojson          \<-- File Zonasi Baru  
│   │   ├── sample\_nodes.geojson \<-- Data Node Graph  
│   │   ├── sample\_edges.geojson \<-- Data Edge Graph  
│   ├── seed.js

### **B. Script Seed (prisma/seed.js)**

Script ini akan membuat Sekolah terlebih dahulu, lalu membaca map.geojson dan menghubungkan Polygon zonasi ke sekolah yang sesuai berdasarkan properti school\_ref.

const { PrismaClient } \= require('@prisma/client');  
const fs \= require('fs');  
const path \= require('path');

const prisma \= new PrismaClient();

const loadGeoJSON \= (filename) \=\> {  
  const filePath \= path.join(\_\_dirname, 'data', filename);  
  try {  
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));  
  } catch (error) {  
    console.warn(\`Warning: File ${filename} tidak ditemukan. Skipping.\`);  
    return null;  
  }  
};

async function main() {  
  console.log('🚀 Start seeding...');

  // 1\. Clean Database  
  await prisma.graphEdge.deleteMany();  
  await prisma.graphNode.deleteMany();  
  await prisma.zone.deleteMany();  
  await prisma.school.deleteMany();  
  await prisma.route.deleteMany();

  // \------------------------------------------  
  // 2\. SEED SEKOLAH (Base Data)  
  // \------------------------------------------  
  // Kita buat sekolah dulu agar punya ID untuk relasi Zonasi  
  console.log('Creating Schools...');  
    
  const schools \= \[  
    {  
      name: 'SMAN 1 Bontang',  
      type: 'SMA',  
      address: 'Jl. Mayor Jenderal DI Panjaitan',  
      lat: 0.1347, lon: 117.4980,  
      desc: 'Sekolah Negeri tujuan utama zona Bontang Utara.'  
    },  
    {  
      name: 'SMAN 2 Bontang',  
      type: 'SMA',  
      address: 'Jl. HM Ardans, Tj. Laut',  
      lat: 0.1277, lon: 117.4800,  
      desc: 'Sekolah Negeri tujuan utama zona Bontang Selatan.'  
    },  
    {  
      name: 'Yayasan Pupuk Kaltim (YPK)', // Nama harus match dengan school\_ref di map.geojson  
      type: 'SWASTA',  
      address: 'Kawasan Perumahan PC VI PKT',  
      lat: 0.1485, lon: 117.4635,  
      desc: 'Sekolah Swasta Favorit di dalam area perumahan PKT.'  
    }  
  \];

  for (const s of schools) {  
    await prisma.school.create({  
      data: {  
        name: s.name,  
        type: s.type,  
        address: s.address,  
        latitude: s.lat,  
        longitude: s.lon,  
        description: s.desc  
      }  
    });  
  }

  // \------------------------------------------  
  // 3\. SEED ZONASI DARI map.geojson  
  // \------------------------------------------  
  const mapData \= loadGeoJSON('map.geojson');  
  if (mapData) {  
    console.log(\`Importing Zones from map.geojson (${mapData.features.length} features)...\`);  
      
    for (const feature of mapData.features) {  
      const props \= feature.properties;  
      const geometry \= feature.geometry;

      if (geometry.type \=== 'Polygon' || geometry.type \=== 'MultiPolygon') {  
        // Cari sekolah berdasarkan school\_ref  
        const schoolName \= props.school\_ref; // misal "SMAN 1 Bontang"  
          
        // Lookup Sekolah di DB  
        const school \= await prisma.school.findUnique({  
          where: { name: schoolName }  
        });

        if (school) {  
          await prisma.zone.create({  
            data: {  
              name: props.name || 'Zona Tanpa Nama',  
              color: props.fill || props.stroke || '\#888888', // Ambil warna dari GeoJSON  
              coordinates: geometry.coordinates, // Simpan array koordinat  
              schoolId: school.id  
            }  
          });  
          console.log(\`  \-\> Linked zone "${props.name}" to ${school.name}\`);  
        } else {  
          console.warn(\`  \[\!\] School ref "${schoolName}" not found in DB. Skipping zone.\`);  
        }  
      }  
    }  
  }

  // \------------------------------------------  
  // 4\. SEED GRAPH NODES (A\* Data)  
  // \------------------------------------------  
  const nodesData \= loadGeoJSON('sample\_nodes.geojson');  
  if (nodesData) {  
    console.log(\`Importing ${nodesData.features.length} graph nodes...\`);  
    for (const feature of nodesData.features) {  
      const props \= feature.properties;  
      const \[lon, lat\] \= feature.geometry.coordinates;

      await prisma.graphNode.create({  
        data: {  
          id: props.id,  
          label: props.label,  
          latitude: lat,  
          longitude: lon  
        }  
      });  
    }  
  }

  // \------------------------------------------  
  // 5\. SEED GRAPH EDGES (A\* Data)  
  // \------------------------------------------  
  const edgesData \= loadGeoJSON('sample\_edges.geojson');  
  if (edgesData) {  
    console.log(\`Importing ${edgesData.features.length} graph edges...\`);  
    for (const feature of edgesData.features) {  
      const props \= feature.properties;  
        
      if (props.source \!== undefined && props.target \!== undefined) {  
        await prisma.graphEdge.create({  
          data: {  
            sourceId: props.source,  
            targetId: props.target,  
            weight: props.weight,  
            geometry: feature.geometry.coordinates   
          }  
        });  
      }  
    }  
  }

  console.log('✅ Seeding finished.');  
}

main()  
  .catch((e) \=\> {  
    console.error(e);  
    process.exit(1);  
  })  
  .finally(async () \=\> {  
    await prisma.$disconnect();  
  });  
