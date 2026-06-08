import { getAllOrders, getOffer, createInfrastructureMetrics } from "./db";

// Configuration for simulation
const INTERVAL_MS = 5000; // 5 seconds
const DAEMON_MODE = process.argv.includes("--daemon");

// Random helpers
const randomFloat = (min: number, max: number) => (Math.random() * (max - min) + min).toFixed(2);
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

async function simulate() {
  console.log(`[Telemetry] Running simulation cycle at ${new Date().toISOString()}`);
  
  try {
    const orders = await getAllOrders();
    const activeOrders = orders.filter(o => o.status === "active");
    
    if (activeOrders.length === 0) {
      console.log("[Telemetry] No active orders found. Waiting...");
      return;
    }

    for (const order of activeOrders) {
      const offer = await getOffer(order.offerId);
      if (!offer) continue;

      // Calculate total GPU Memory based on GPU Type (rough estimates)
      let gpuMemPerCard = 24; // Default to 24GB
      if (offer.gpuType.includes("A100")) gpuMemPerCard = 80;
      if (offer.gpuType.includes("H100")) gpuMemPerCard = 80;
      if (offer.gpuType.includes("V100")) gpuMemPerCard = 32;
      
      const gpuMemoryTotalGb = gpuMemPerCard * offer.gpuCount;
      const ramTotalGb = offer.ramGb;

      // Generate random metrics
      // High GPU usage for active compute instances
      const gpuUsagePercent = randomFloat(65, 99);
      // High VRAM usage
      const gpuMemoryUsedGb = randomFloat(gpuMemoryTotalGb * 0.5, gpuMemoryTotalGb * 0.95);
      
      // Moderate CPU usage
      const cpuUsagePercent = randomFloat(20, 85);
      const ramUsedGb = randomFloat(ramTotalGb * 0.3, ramTotalGb * 0.85);

      // Simple cost projections based on monthly recurring
      const monthlyCost = Number(order.monthlyRecurring);
      const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
      const currentDay = new Date().getDate();
      const costThisMonth = ((monthlyCost / daysInMonth) * currentDay).toFixed(2);
      const costProjected = monthlyCost.toFixed(2);

      await createInfrastructureMetrics({
        orderId: order.id,
        gpuUsagePercent,
        gpuMemoryUsedGb,
        gpuMemoryTotalGb,
        cpuUsagePercent,
        ramUsedGb,
        ramTotalGb,
        costThisMonth,
        costProjected
      });

      console.log(`[Telemetry] Recorded metrics for Order ORD-${String(order.id).padStart(6, "0")} (GPU: ${gpuUsagePercent}%)`);
    }
  } catch (error) {
    console.error("[Telemetry] Error during simulation cycle:", error);
  }
}

async function main() {
  console.log("[Telemetry] Starting telemetry simulation script...");
  if (DAEMON_MODE) {
    console.log(`[Telemetry] Running in daemon mode (interval: ${INTERVAL_MS}ms)`);
    // Run immediately, then interval
    await simulate();
    setInterval(simulate, INTERVAL_MS);
  } else {
    console.log("[Telemetry] Running single cycle (use --daemon for continuous mode)");
    await simulate();
    process.exit(0);
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
