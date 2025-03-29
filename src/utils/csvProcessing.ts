
// Define the types that are being imported by other files
export type CSVRow = Record<string, string>;
export type CSVData = CSVRow[];

export interface ProcessingTask {
  id: string;
  fileName: string;
  uploadTime: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  progress?: number;
  totalRows: number;
  processedRows: number;
  type?: 'domain-only' | 'single-email' | 'multi-email';
  result?: CSVData;
  mappedColumns?: Record<string, string>;
  originalRowCount?: number;
}

// Define the excluded columns
export const excludedColumns = [
  'domain_score', 
  'email_score', 
  'internal_id', 
  'source',
  'processed_date',
  'processed_by'
];

// Parsing and file handling functions
export const parseCSV = (content: string): { headers: string[], data: CSVData } => {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  
  if (lines.length === 0) {
    return { headers: [], data: [] };
  }
  
  // Extract headers from the first line
  const headers = lines[0].split(',').map(header => header.trim());
  
  // Parse the rest of the lines into data rows
  const data: CSVData = lines.slice(1).map(line => {
    const values = line.split(',').map(value => value.trim());
    const row: CSVRow = {};
    
    // Create an object where keys are headers and values are corresponding values
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    return row;
  });
  
  return { headers, data };
};

export const inferCSVType = (headers: string[]): 'domain-only' | 'single-email' | 'multi-email' | 'unknown' => {
  const lowercaseHeaders = headers.map(h => h.toLowerCase());
  
  // Check if it has email column but no multiple email columns
  if (lowercaseHeaders.includes('email') && !lowercaseHeaders.some(h => h.includes('email_'))) {
    return 'single-email';
  }
  
  // Check if it has website/domain column but no email column
  if (
    (lowercaseHeaders.includes('website') || lowercaseHeaders.includes('domain')) && 
    !lowercaseHeaders.includes('email')
  ) {
    return 'domain-only';
  }
  
  // Check if it has multiple email columns (email_1, email_2, etc.)
  if (lowercaseHeaders.some(h => h.includes('email_'))) {
    return 'multi-email';
  }
  
  return 'unknown';
};

export const downloadCSV = (data: CSVData, filename: string) => {
  if (!data || data.length === 0) {
    console.error('No data to download');
    return;
  }
  
  // Get all headers from the data
  const headers = Array.from(
    new Set(
      data.flatMap(row => Object.keys(row))
    )
  );
  
  // Create CSV content with headers
  let csvContent = headers.join(',') + '\n';
  
  // Add each row
  data.forEach(row => {
    const rowValues = headers.map(header => {
      const value = row[header] !== undefined ? row[header] : '';
      // Escape commas and quotes
      return `"${value.replace(/"/g, '""')}"`;
    });
    csvContent += rowValues.join(',') + '\n';
  });
  
  // Create download link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}`);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const processDomainOnlyCSV = async (
  data: CSVData,
  websiteColumn: string,
  onProgress: (processed: number) => void
): Promise<CSVData> => {
  // Create a copy of the data to avoid modifying the original
  const result: CSVData = [...data];
  const totalRows = data.length;
  
  // Process each row
  for (let i = 0; i < totalRows; i++) {
    const row = result[i];
    
    // Clean website domain if present
    if (row[websiteColumn]) {
      row['cleaned_website'] = cleanDomain(row[websiteColumn]);
    }
    
    // Add empty fields for other_dm fields to maintain consistency
    row['other_dm_name'] = '';
    row['other_dm_email'] = '';
    row['other_dm_title'] = '';
    
    // Update progress
    onProgress(i + 1);
  }
  
  return result;
};

export const processSingleEmailCSV = async (
  data: CSVData,
  emailColumn: string,
  websiteColumn: string,
  companyColumn: string,
  onProgress: (processed: number, total: number, stage: string) => void
): Promise<CSVData> => {
  // Create a copy of the data to avoid modifying the original
  let result: CSVData = [...data];
  const totalRows = data.length;
  
  // Stage 1: Extract domains and clean data
  onProgress(0, totalRows, 'Cleaning data');
  
  for (let i = 0; i < totalRows; i++) {
    const row = result[i];
    
    // Extract domain from email if website column is not provided
    if (row[emailColumn] && (!websiteColumn || !row[websiteColumn])) {
      const emailParts = row[emailColumn].split('@');
      if (emailParts.length === 2) {
        row['extracted_domain'] = emailParts[1];
      }
    }
    
    // Clean website domain if present
    if (websiteColumn && row[websiteColumn]) {
      row['cleaned_website'] = cleanDomain(row[websiteColumn]);
    } else if (row['extracted_domain']) {
      row['cleaned_website'] = cleanDomain(row['extracted_domain']);
    }
    
    // Clean company name if present
    if (companyColumn && row[companyColumn]) {
      row['cleaned_company_name'] = row[companyColumn].trim();
    }
    
    // Add MX provider information if available from email
    if (row[emailColumn]) {
      row['mx_provider'] = getMxProviderFromEmail(row[emailColumn]);
    }
    
    // Update progress
    onProgress(i + 1, totalRows, 'Cleaning data');
  }
  
  // Stage 2: Group by domains and assign alternative contacts
  onProgress(0, totalRows, 'Assigning alternative contacts');
  
  // Group rows by cleaned domain
  const domainGroups: Record<string, CSVRow[]> = {};
  
  result.forEach(row => {
    const domain = row['cleaned_website'];
    if (domain) {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(row);
    }
  });
  
  // Process each domain group to assign alternative contacts
  let processedCount = 0;
  
  Object.entries(domainGroups).forEach(([domain, rows]) => {
    if (rows.length > 1) {
      // If there are multiple contacts for the same domain,
      // assign them as alternative contacts to each other in a round-robin fashion
      for (let i = 0; i < rows.length; i++) {
        const currentRow = rows[i];
        const alternativeRow = rows[(i + 1) % rows.length];  // Next person, wrapping around
        
        // Get names from either fullName or firstName + lastName fields
        const altFullName = 
          alternativeRow['fullName'] || 
          alternativeRow['full_name'] || 
          (alternativeRow['firstName'] && alternativeRow['lastName'] ? 
            `${alternativeRow['firstName']} ${alternativeRow['lastName']}` : 
            (alternativeRow['first_name'] && alternativeRow['last_name'] ? 
              `${alternativeRow['first_name']} ${alternativeRow['last_name']}` : ''));
        
        // Assign alternative contact info
        currentRow['other_dm_name'] = altFullName;
        currentRow['other_dm_email'] = alternativeRow[emailColumn] || '';
        currentRow['other_dm_title'] = alternativeRow['title'] || '';
      }
    } else {
      // No alternative contacts for sole domain representatives
      rows[0]['other_dm_name'] = '';
      rows[0]['other_dm_email'] = '';
      rows[0]['other_dm_title'] = '';
    }
    
    processedCount += rows.length;
    onProgress(processedCount, totalRows, 'Assigning alternative contacts');
  });
  
  return result;
};

export const processMultiEmailCSV = async (
  data: CSVData,
  mappedColumns: Record<string, string>,
  onProgress: (processed: number, total: number, stage: string) => void
): Promise<CSVData> => {
  // Similar to processSingleEmailCSV but handling multiple email columns
  // Implementation would depend on the specific requirements
  
  // Placeholder implementation
  return processSingleEmailCSV(
    data, 
    mappedColumns['email'] || 'email', 
    mappedColumns['website'] || 'website',
    mappedColumns['company'] || 'company',
    onProgress
  );
};

// Helper functions
const cleanDomain = (url: string): string => {
  try {
    // Remove http://, https://, www., and trailing paths
    let domain = url.toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .split('?')[0];
    
    // Further cleaning if needed
    return domain;
  } catch (error) {
    console.error('Error cleaning domain:', error);
    return url;
  }
};

const getMxProviderFromEmail = (email: string): string => {
  try {
    const domain = email.split('@')[1].toLowerCase();
    
    // Check for common email providers
    if (domain.includes('gmail')) return 'Gmail';
    if (domain.includes('outlook') || domain.includes('hotmail') || domain.includes('live')) return 'Microsoft';
    if (domain.includes('yahoo')) return 'Yahoo';
    if (domain.includes('aol')) return 'AOL';
    if (domain.includes('icloud') || domain.includes('me.com')) return 'Apple';
    if (domain.includes('proton')) return 'ProtonMail';
    
    // If no common provider is detected, return the domain
    return 'Custom';
  } catch (error) {
    return 'Unknown';
  }
};

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
    // Fix: Use explicit number type and initial value 0
    const totalExcessRows = exceededDomains.reduce((sum, [_, count]) => sum + count, 0);
    console.log(`Total rows with domains exceeding threshold: ${totalExcessRows}`);
  }
  
  console.log(`-----------------------------------`);
};
