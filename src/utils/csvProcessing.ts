
import { toast } from 'sonner';
import { getDomainFromEmail, isGenericEmail } from './auth';

// Types for CSV processing
export type CSVRow = Record<string, string>;
export type CSVData = CSVRow[];

export type ProcessingTask = {
  id: string;
  fileName: string;
  uploadTime: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  progress: number;
  totalRows: number;
  processedRows: number;
  result?: CSVData;
  mappedColumns?: Record<string, string>;
  type?: 'domain-only' | 'single-email' | 'multi-email';
};

/**
 * Parse CSV string to array of objects
 */
export const parseCSV = (csvString: string): { headers: string[], data: CSVData } => {
  try {
    // Split by newline, filter out empty lines
    const lines = csvString.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length === 0) {
      return { headers: [], data: [] };
    }
    
    const headers = lines[0].split(',').map(header => header.trim());
    
    const data: CSVData = [];
    for (let i = 1; i < lines.length; i++) {
      // Handle case where fields might contain commas inside quotes
      const row: CSVRow = {};
      let fields = [];
      let inQuotes = false;
      let field = '';

      for (let j = 0; j < lines[i].length; j++) {
        const char = lines[i][j];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          fields.push(field);
          field = '';
        } else {
          field += char;
        }
      }
      
      fields.push(field); // Push the last field
      
      // If simple split works and matches headers, use it
      if (fields.length !== headers.length) {
        fields = lines[i].split(',');
      }

      headers.forEach((header, index) => {
        row[header] = fields[index]?.trim() || '';
      });
      
      data.push(row);
    }
    
    console.log(`Parsed CSV: ${headers.length} columns, ${data.length} rows`);
    return { headers, data };
  } catch (error) {
    console.error('Error parsing CSV:', error);
    toast.error('Error parsing CSV file');
    return { headers: [], data: [] };
  }
};

/**
 * Convert data back to CSV string
 */
export const dataToCSV = (headers: string[], data: CSVData): string => {
  const headerRow = headers.join(',');
  const dataRows = data.map(row => {
    return headers.map(header => {
      const value = row[header] || '';
      // Escape commas and quotes
      if (value.includes(',') || value.includes('"')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',');
  });
  
  return [headerRow, ...dataRows].join('\n');
};

/**
 * Infer the CSV type based on column headers
 */
export const inferCSVType = (headers: string[]): 'domain-only' | 'single-email' | 'multi-email' | 'unknown' => {
  // Check for multi-email pattern
  const emailColumns = headers.filter(h => h.match(/email_\d+$/i));
  if (emailColumns.length >= 2) {
    return 'multi-email';
  }
  
  // Check for single email
  if (headers.some(h => h.toLowerCase().includes('email'))) {
    return 'single-email';
  }
  
  // Check for website/domain columns
  if (headers.some(h => ['website', 'domain', 'url', 'site'].some(term => h.toLowerCase().includes(term)))) {
    return 'domain-only';
  }
  
  return 'unknown';
};

/**
 * Clean website URL to get just the domain
 */
export const cleanWebsiteUrl = (url: string): string => {
  if (!url) return '';
  
  try {
    // Handle URLs that don't start with http/https
    if (!url.match(/^https?:\/\//i)) {
      url = 'https://' + url;
    }
    
    const domain = new URL(url).hostname;
    return domain
      .replace(/^www\./i, '')  // Remove www.
      .replace(/\/$/, '');     // Remove trailing slash
  } catch (error) {
    // If URL parsing fails, try a simple regex approach
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/]+)/i);
    return match ? match[1].replace(/\/$/, '') : url;
  }
};

/**
 * Clean company name using regex patterns similar to the formula provided
 */
export const cleanCompanyName = (name: string): string => {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .replace(/ ltd$/i, '')
    .replace(/ llc$/i, '')
    .replace(/ gmbh$/i, '')
    .replace(/ pvt$/i, '')
    .replace(/ private$/i, '')
    .replace(/ limited$/i, '')
    .replace(/ inc$/i, '')
    .replace(/®/g, '')
    .replace(/™/g, '')
    .replace(/,/g, '')
    .replace(/ technologies$/i, '')
    .replace(/\bco$/i, '')
    .replace(/\.[a-z]+$/i, '')
    .replace(/\.$/g, '')
    .replace(/\&$/g, '')
    .replace(/[^ -~]/g, '')
    .replace(/s'/g, "'s")
    .replace(/\s*[\|:]\s*.*/g, '')
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Make a request to check the MX records for a domain
 */
export const getMXProvider = async (domain: string): Promise<'google' | 'microsoft' | 'other'> => {
  try {
    console.log(`Fetching MX records for domain: ${domain}`);
    const response = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`);
    const data = await response.json();
    
    if (data.Answer) {
      const mxRecords = data.Answer.map((record: any) => record.data.toLowerCase());
      console.log(`MX records for ${domain}:`, mxRecords);
      
      if (mxRecords.some((record: string) => record.includes('google'))) {
        return 'google';
      } else if (mxRecords.some((record: string) => record.includes('outlook') || record.includes('microsoft'))) {
        return 'microsoft';
      }
    }
    
    return 'other';
  } catch (error) {
    console.error('Error fetching MX records:', error);
    return 'other';
  }
};

/**
 * Process a batch of domains to get MX records
 * Processes in batches of 10 to avoid rate limiting
 */
export const processMXBatch = async (
  data: CSVData,
  emailField: string,
  updateProgress: (processed: number) => void
): Promise<CSVData> => {
  const result = [...data];
  const batchSize = 10;
  const domains = new Set<string>();
  
  // Extract unique domains first
  console.log(`Processing MX batch for ${data.length} rows, email field: ${emailField}`);
  data.forEach(row => {
    const email = row[emailField];
    if (email) {
      try {
        const domain = email.split('@')[1];
        if (domain) {
          domains.add(domain);
        }
      } catch (error) {
        // Skip invalid emails
      }
    }
  });
  
  console.log(`Found ${domains.size} unique domains to check`);
  const uniqueDomains = Array.from(domains);
  const mxCache: Record<string, 'google' | 'microsoft' | 'other'> = {};
  
  // Process in batches
  for (let i = 0; i < uniqueDomains.length; i += batchSize) {
    const batch = uniqueDomains.slice(i, i + batchSize);
    const promises = batch.map(domain => getMXProvider(domain));
    
    try {
      const results = await Promise.all(promises);
      
      batch.forEach((domain, index) => {
        mxCache[domain] = results[index];
      });
      
      updateProgress(Math.min(i + batchSize, uniqueDomains.length));
    } catch (error) {
      console.error('Error processing MX batch:', error);
    }
  }
  
  // Apply MX results to the data
  result.forEach(row => {
    const email = row[emailField];
    if (email) {
      try {
        const domain = email.split('@')[1];
        row['mx_provider'] = mxCache[domain] || 'other';
      } catch (error) {
        row['mx_provider'] = 'other';
      }
    } else {
      row['mx_provider'] = '';
    }
  });
  
  return result;
};

/**
 * Process CSV with domain only
 */
export const processDomainOnlyCSV = async (
  data: CSVData,
  websiteField: string,
  updateProgress: (processed: number, total: number) => void
): Promise<CSVData> => {
  const result: CSVData = [];
  console.log(`Processing domain-only CSV with ${data.length} rows`);
  
  for (let i = 0; i < data.length; i++) {
    const row = { ...data[i] };
    
    // Clean website URL
    const websiteUrl = row[websiteField] || '';
    row['cleaned_website'] = cleanWebsiteUrl(websiteUrl);
    
    // Remove whitespace
    Object.keys(row).forEach(key => {
      if (typeof row[key] === 'string') {
        row[key] = row[key].trim();
      }
    });
    
    result.push(row);
    updateProgress(i + 1, data.length);
  }
  
  console.log(`Domain-only processing complete: ${result.length} rows processed`);
  return result;
};

/**
 * Process single email CSV
 */
export const processSingleEmailCSV = async (
  data: CSVData,
  emailField: string,
  websiteField: string,
  companyField: string,
  updateProgress: (processed: number, total: number, stage: string) => void
): Promise<CSVData> => {
  console.log(`Processing single-email CSV with ${data.length} rows`);
  
  // Stage 1: Remove duplicate emails
  updateProgress(0, data.length, 'Removing duplicate emails');
  const uniqueEmails = new Set<string>();
  let uniqueEmailData: CSVData = [];
  
  // First pass: collect all unique emails and their rows
  data.forEach(row => {
    const email = row[emailField];
    if (email && !uniqueEmails.has(email.toLowerCase())) {
      uniqueEmails.add(email.toLowerCase());
      uniqueEmailData.push(row);
    }
  });
  
  console.log(`After deduplication: ${uniqueEmailData.length} unique emails (removed ${data.length - uniqueEmailData.length} duplicates)`);
  updateProgress(uniqueEmailData.length, data.length, 'Removed duplicate emails');
  
  // Stage 2: Process MX records
  updateProgress(0, uniqueEmailData.length, 'Processing MX records');
  let processedData = await processMXBatch(
    uniqueEmailData,
    emailField,
    (processed) => updateProgress(processed, uniqueEmailData.length, 'Processing MX records')
  );
  
  // Stage 3: Clean company names and websites
  updateProgress(0, processedData.length, 'Cleaning data');
  for (let i = 0; i < processedData.length; i++) {
    const row = processedData[i];
    
    // Clean company name
    if (companyField && row[companyField]) {
      row['cleaned_company_name'] = cleanCompanyName(row[companyField]);
    }
    
    // Clean website
    if (websiteField && row[websiteField]) {
      row['cleaned_website'] = cleanWebsiteUrl(row[websiteField]);
    } else if (row[emailField]) {
      // Extract domain from email if website field is not available
      try {
        const emailDomain = row[emailField].split('@')[1];
        row['cleaned_website'] = emailDomain;
      } catch (error) {
        row['cleaned_website'] = '';
      }
    }
    
    updateProgress(i + 1, processedData.length, 'Cleaning data');
  }
  
  // Stage 4: Count domain occurrences and filter out domains with more than 5 occurrences
  updateProgress(0, processedData.length, 'Analyzing domain frequencies');
  const domainCounts: Record<string, number> = {};
  
  // First count all domains
  processedData.forEach(row => {
    const domain = row['cleaned_website'];
    if (domain) {
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    }
  });
  
  // Then filter out domains with more than 5 occurrences
  const filteredData = processedData.filter(row => {
    const domain = row['cleaned_website'];
    return !domain || domainCounts[domain] <= 5;
  });
  
  console.log(`After domain frequency filtering: ${filteredData.length} rows (removed ${processedData.length - filteredData.length} rows)`);
  
  // Stage 5: Add alternative names for duplicate domains
  updateProgress(0, filteredData.length, 'Adding alternative contacts');
  const domainToNames: Record<string, string[]> = {};
  
  // First collect all names by domain
  filteredData.forEach(row => {
    const domain = row['cleaned_website'];
    const email = row[emailField];
    
    if (domain && domain in domainCounts && domainCounts[domain] > 1 && !isGenericEmail(email)) {
      const fullName = row['full_name'] || row['fullname'] || '';
      if (fullName) {
        if (!domainToNames[domain]) {
          domainToNames[domain] = [];
        }
        domainToNames[domain].push(fullName);
      }
    }
  });
  
  // Then distribute names using round-robin
  const domainNameIndex: Record<string, number> = {};
  
  filteredData.forEach(row => {
    const domain = row['cleaned_website'];
    const email = row[emailField];
    
    if (domain && domain in domainCounts && domainCounts[domain] > 1 && !isGenericEmail(email)) {
      const names = domainToNames[domain];
      if (names && names.length > 1) {
        if (domainNameIndex[domain] === undefined) {
          domainNameIndex[domain] = 0;
        } else {
          domainNameIndex[domain] = (domainNameIndex[domain] + 1) % names.length;
        }
        
        const currentIndex = domainNameIndex[domain];
        const fullName = row['full_name'] || row['fullname'] || '';
        
        // Assign a different name than the current one
        if (fullName !== names[currentIndex]) {
          row['other_dm_name'] = names[currentIndex];
        } else {
          // If same name, get next one
          const nextIndex = (currentIndex + 1) % names.length;
          row['other_dm_name'] = names[nextIndex];
        }
      }
    }
  });
  
  updateProgress(filteredData.length, filteredData.length, 'Complete');
  console.log(`Single-email processing complete: ${filteredData.length} rows in final output`);
  
  return filteredData;
};

/**
 * Process multi-email CSV
 */
export const processMultiEmailCSV = async (
  data: CSVData,
  mappedColumns: Record<string, string>,
  updateProgress: (processed: number, total: number, stage: string) => void
): Promise<CSVData> => {
  console.log(`Processing multi-email CSV with ${data.length} rows`);
  
  // Identify email columns and their associated metadata columns
  const emailColumns = Object.keys(mappedColumns).filter(col => col.startsWith('email_'));
  updateProgress(0, data.length, 'Organizing email data');
  
  // Reorganize data to ensure each email has associated metadata
  let expandedData: CSVData = [];
  let totalEmails = 0;
  
  // First expand the data to have one row per email
  data.forEach((row, idx) => {
    emailColumns.forEach(emailCol => {
      const email = row[mappedColumns[emailCol]];
      if (!email) return;
      totalEmails++;
      
      const prefix = emailCol.split('_')[0] + '_' + emailCol.split('_')[1];
      const newRow: CSVRow = { ...row };
      
      // Remove all email_X columns and their metadata
      Object.keys(row).forEach(key => {
        if (key.match(/^email_\d+/) || key.match(/^email_\d+_/)) {
          delete newRow[key];
        }
      });
      
      // Add back the current email and its metadata
      newRow['email'] = email;
      
      // Map related fields like full_name, first_name, etc.
      ['full_name', 'first_name', 'last_name', 'title', 'phone'].forEach(field => {
        const metadataKey = `${prefix}_${field}`;
        if (row[metadataKey]) {
          newRow[field] = row[metadataKey];
        }
      });
      
      expandedData.push(newRow);
    });
    
    updateProgress(idx + 1, data.length, 'Organizing email data');
  });
  
  console.log(`Expanded ${data.length} rows to ${expandedData.length} rows with individual emails`);
  
  // Stage 1: Remove duplicate emails
  updateProgress(0, expandedData.length, 'Removing duplicate emails');
  const uniqueEmails = new Set<string>();
  let uniqueEmailData: CSVData = [];
  
  // Collect unique emails
  expandedData.forEach(row => {
    const email = row['email'];
    if (email && !uniqueEmails.has(email.toLowerCase())) {
      uniqueEmails.add(email.toLowerCase());
      uniqueEmailData.push(row);
    }
  });
  
  console.log(`After deduplication: ${uniqueEmailData.length} unique emails (removed ${expandedData.length - uniqueEmailData.length} duplicates)`);
  
  // Now process as a single email CSV
  return processSingleEmailCSV(
    uniqueEmailData,
    'email',
    mappedColumns['website'] || '',
    mappedColumns['company'] || '',
    updateProgress
  );
};

/**
 * Save CSV data as a downloadable file
 */
export const downloadCSV = (data: CSVData, filename: string): void => {
  if (!data.length) {
    toast.error('No data to download');
    return;
  }
  
  const headers = Object.keys(data[0]);
  const csvContent = dataToCSV(headers, data);
  
  // Create a blob and download link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename || 'download.csv');
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  toast.success('CSV downloaded successfully');
};
