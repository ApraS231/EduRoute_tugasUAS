// prisma/seed.js

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Helper: Load GeoJSON
const loadGeoJSON = (filename) => {
  const filePath = path.join(__dirname, 'data', filename);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    console.warn(`Warning: File ${filename} tidak ditemukan. Skipping.`);
    return null;
  }
};

// Helper: Dist (Haversine)
const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
    Math.cos(phi2) *
    Math.sin(deltaLambda / 2) *
    Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const calculateLength = (coordinates) => {
  let totalDist = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    const [lon1, lat1] = coordinates[i];
    const [lon2, lat2] = coordinates[i + 1];
    totalDist += haversine(lat1, lon1, lat2, lon2);
  }
  return totalDist;
};

// Spatial Index helper
const generateCoordKey = (lat, lon) => {
  return `${lat.toFixed(5)},${lon.toFixed(5)}`;
};

async function main() {
  console.log('🚀 Start seeding V2 (Full Topology with Soft Snap)...');

  // 1. Clean Database
  console.log('Cleaning database...');
  await prisma.graphEdge.deleteMany();
  await prisma.graphNode.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.school.deleteMany();
  await prisma.route.deleteMany();

  // 2. Base Data Schools & Zones (Standard)
  console.log('Creating Schools...');
  const schools = [
    { name: 'SMAN 1 Bontang', type: 'SMA', address: 'Jl. PDIP', lat: 0.1347, lon: 117.498, desc: 'Sekolah Negeri Utama' },
    { name: 'SMAN 2 Bontang', type: 'SMA', address: 'Jl. HM Ardans', lat: 0.1277, lon: 117.48, desc: 'Sekolah Negeri Selatan' },
    { name: 'Yayasan Pupuk Kaltim (YPK)', type: 'SWASTA', address: 'PC VI PKT', lat: 0.1485, lon: 117.4635, desc: 'Sekolah Swasta Favorit' },
  ];

  for (const s of schools) {
    await prisma.school.create({
      data: { name: s.name, type: s.type, address: s.address, latitude: s.lat, longitude: s.lon, description: s.desc },
    });
  }

  const mapData = loadGeoJSON('map.geojson');
  if (mapData) {
    console.log('Importing Zones...');
    for (const feature of mapData.features) {
      const props = feature.properties;
      const geometry = feature.geometry;
      if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
        const school = await prisma.school.findFirst({ where: { name: props.school_ref } });
        if (school) {
          await prisma.zone.create({
            data: { name: props.name || 'Zona', color: props.fill || '#888', coordinates: geometry.coordinates, schoolId: school.id },
          });
        }
      }
    }
  }

  // ------------------------------------------
  // 3. BUILD GRAPH FROM NODES + ROADS
  // ------------------------------------------

  // Coordinate Map to avoid duplicate nodes
  // Key: "lat,lon" -> Value: Node ID
  const coordMap = new Map();
  // We also keep a secondary structure for simple radius search of Sample Nodes
  const sampleNodesList = [];

  // Existing Node IDs reservation
  let nextNodeId = 1000;

  // 3.1. Insert Sample Nodes (Primary Nodes)
  const nodesData = loadGeoJSON('sample_nodes.geojson');
  if (nodesData) {
    console.log(`Importing ${nodesData.features.length} primary nodes...`);
    for (const feature of nodesData.features) {
      const props = feature.properties;
      const [lon, lat] = feature.geometry.coordinates;

      const key = generateCoordKey(lat, lon);
      coordMap.set(key, props.id);

      sampleNodesList.push({ id: props.id, lat, lon });

      if (props.id >= nextNodeId) nextNodeId = props.id + 1;

      await prisma.graphNode.create({
        data: {
          id: props.id,
          label: props.label,
          latitude: lat,
          longitude: lon,
        },
      });
    }
  }

  // 3.2. Process Roads & Generate Topology
  const roadData = loadGeoJSON('jalan_bontang.geojson');
  let edgesCreated = 0;

  if (roadData) {
    console.log(`Processing road network with Soft Snap (30m)...`);

    // Helper: Find nearest existing node within radius
    const findNearestNode = (lat, lon, maxDistMeters = 30) => {
      let bestId = null;
      let minD = Infinity;

      // 1. Check strict match first (fastest)
      const key = generateCoordKey(lat, lon);
      if (coordMap.has(key)) return coordMap.get(key);

      // 2. Check Sample Nodes (ID < 1000) for "close enough" snap
      // We iterate the initial sample nodes list.
      for (const sNode of sampleNodesList) {
        const dist = haversine(lat, lon, sNode.lat, sNode.lon);
        if (dist <= maxDistMeters && dist < minD) {
          minD = dist;
          bestId = sNode.id;
        }
      }

      return bestId;
    };

    // Helper to get or create node ID
    const getOrCreateNodeId = async (lat, lon) => {
      // Try strict or soft snap
      const existingId = findNearestNode(lat, lon, 30); // 30 meter tolerance
      if (existingId !== null) {
        // If soft snapped, we should register this location as an alias for that ID
        // so we don't create a duplicate "Auto Node" right next to it later for the same coordinate
        const key = generateCoordKey(lat, lon);
        coordMap.set(key, existingId);
        return existingId;
      }

      // Create new
      const key = generateCoordKey(lat, lon);
      const newId = nextNodeId++;
      coordMap.set(key, newId);

      await prisma.graphNode.create({
        data: {
          id: newId,
          label: null, // Auto node
          latitude: lat,
          longitude: lon
        }
      });
      return newId;
    };

    for (const feature of roadData.features) {
      const geom = feature.geometry;
      let segments = [];

      if (geom.type === 'LineString') {
        segments.push(geom.coordinates);
      } else if (geom.type === 'MultiLineString') {
        segments = geom.coordinates;
      }

      for (const coords of segments) {
        if (coords.length < 2) continue;

        const startPt = coords[0];
        const endPt = coords[coords.length - 1];

        const startId = await getOrCreateNodeId(startPt[1], startPt[0]);
        const endId = await getOrCreateNodeId(endPt[1], endPt[0]);

        if (startId !== endId) {
          const length = calculateLength(coords);
          await prisma.graphEdge.create({
            data: {
              sourceId: startId,
              targetId: endId,
              weight: length,
              geometry: coords
            }
          });
          edgesCreated++;
        }
      }
      if (edgesCreated % 50 === 0) process.stdout.write('.');
    }
    console.log(`\nGenerated ${nextNodeId - 1000} new nodes.`);
    console.log(`Created ${edgesCreated} edges from road network.`);
  }

  console.log('✅ Seeding V2 finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
