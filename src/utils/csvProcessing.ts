
const logDomainFrequencyStats = (domainCounts: Record<string, number>, threshold: number) => {
  console.log(`----- DOMAIN FREQUENCY DEBUGGING -----`);
  
  // Count how many domains exceed the threshold
  const exceededDomains = Object.entries(domainCounts)
    .filter(([_, count]) => count > threshold)
    .sort((a, b) => b[1] - a[1]);  // Sort by count descending
  
  console.log(`Found ${exceededDomains.length} domains that exceed threshold of ${threshold}:`);
  
  // Log the top 10 most frequent domains
  exceededDomains.slice(0, 10).forEach(([domain, count]) => {
    console.log(`Domain: ${domain}, Count: ${count}`);
  });
  
  // Summary statistics
  if (exceededDomains.length > 0) {
    // Fix: Use explicit number type and initial value
    const totalExcessRows = exceededDomains.reduce((sum, [_, count]) => sum + count, 0);
    console.log(`Total rows with domains exceeding threshold: ${totalExcessRows}`);
  }
  
  console.log(`-----------------------------------`);
};
