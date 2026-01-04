const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const nodeCount = await prisma.graphNode.count();
    const edgeCount = await prisma.graphEdge.count();
    console.log(`DB Counts -> Nodes: ${nodeCount}, Edges: ${edgeCount}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
