
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
  originalRowCount?: number; // To keep track of the original row count
};

/**
 * Parse CSV string to array of objects - optimized version
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
    // Process in chunks for better performance with large files
    const chunkSize = 2000; // Increased chunk size for faster processing
    
    for (let i = 0; i < Math.ceil((lines.length - 1) / chunkSize); i++) {
      const start = i * chunkSize + 1;
      const end = Math.min(start + chunkSize, lines.length);
      
      for (let j = start; j < end; j++) {
        // Handle case where fields might contain commas inside quotes
        const row: CSVRow = {};
        let fields = [];
        let inQuotes = false;
        let field = '';
        const line = lines[j];

        for (let k = 0; k < line.length; k++) {
          const char = line[k];
          
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
          fields = line.split(',');
        }

        headers.forEach((header, index) => {
          row[header] = fields[index]?.trim() || '';
        });
        
        data.push(row);
      }
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
 * Clean website URL to get just the domain - optimized
 */
export const cleanWebsiteUrl = (url: string): string => {
  if (!url) return '';
  
  try {
    // Optimize by checking common patterns first
    const domainMatch = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/]+\.[a-z]+)(?:\/|$)/i);
    if (domainMatch) {
      return domainMatch[1].toLowerCase();
    }
    
    // Handle URLs that don't start with http/https
    if (!url.match(/^https?:\/\//i)) {
      url = 'https://' + url;
    }
    
    const domain = new URL(url).hostname;
    return domain
      .replace(/^www\./i, '')  // Remove www.
      .replace(/\/$/, '')      // Remove trailing slash
      .toLowerCase();          // Ensure lowercase
  } catch (error) {
    // If URL parsing fails, try a simple regex approach
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/]+)/i);
    return match ? match[1].replace(/\/$/, '').toLowerCase() : url.toLowerCase();
  }
};

/**
 * Clean company name using regex patterns similar to the formula provided
 */
export const cleanCompanyName = (name: string): string => {
  if (!name) return '';
  
  return name
    .toLowerCase()
    // Remove text in brackets (including brackets), e.g. (Inc), (LLC), (sbi)
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/ ltd\.?$/i, '')
    .replace(/ llc\.?$/i, '')
    .replace(/ inc\.?$/i, '')
    .replace(/ gmbh$/i, '')
    .replace(/ pvt$/i, '')
    .replace(/ private$/i, '')
    .replace(/ limited$/i, '')
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

// Cache for MX results to avoid repeated lookups - SINGLE declaration
const mxCache: Record<string, 'google' | 'microsoft' | 'other'> = {};

/**
 * Make a request to check the MX records for a domain
 */
export const getMXProvider = async (domain: string): Promise<'google' | 'microsoft' | 'other'> => {
  // Check cache first
  if (mxCache[domain]) {
    return mxCache[domain];
  }
  
  try {
    console.log(`Fetching MX records for domain: ${domain}`);
    const response = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`);
    const data = await response.json();
    
    if (data.Answer) {
      const mxRecords = data.Answer.map((record: any) => record.data.toLowerCase());
      console.log(`MX records for ${domain}:`, mxRecords);
      
      let result: 'google' | 'microsoft' | 'other';
      if (mxRecords.some((record: string) => record.includes('google'))) {
        result = 'google';
      } else if (mxRecords.some((record: string) => record.includes('outlook') || record.includes('microsoft'))) {
        result = 'microsoft';
      } else {
        result = 'other';
      }
      
      // Cache the result
      mxCache[domain] = result;
      return result;
    }
    
    mxCache[domain] = 'other';
    return 'other';
  } catch (error) {
    console.error('Error fetching MX records:', error);
    mxCache[domain] = 'other';
    return 'other';
  }
};

/**
 * Process a batch of domains to get MX records
 * Processes in batches of 20 to optimize speed
 */
export const processMXBatch = async (
  data: CSVData,
  emailField: string,
  updateProgress: (processed: number) => void
): Promise<CSVData> => {
  const result = [...data];
  const batchSize = 20; // Increased from 10 for faster processing
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
  
  // Process in batches with parallel requests for better performance
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
  
  // Process in chunks for better performance
  const chunkSize = 1000; // Increased chunk size for better performance
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunkEnd = Math.min(i + chunkSize, data.length);
    for (let j = i; j < chunkEnd; j++) {
      const row = { ...data[j] };
      
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
    }
    updateProgress(chunkEnd, data.length);
  }
  
  console.log(`Domain-only processing complete: ${result.length} rows processed`);
  return result;
};

/**
 * Process single email CSV - with improved other_dm_name enrichment and data loss fixes
 */
export const processSingleEmailCSV = async (
  data: CSVData,
  emailField: string,
  websiteField: string,
  companyField: string,
  updateProgress: (processed: number, total: number, stage: string) => void
): Promise<CSVData> => {
  console.log(`Processing single-email CSV with ${data.length} rows`);
  const originalRowCount = data.length;
  
  // Store original data for reference before filtering
  const originalData = [...data];
  
  // Stage 1: Filter out rows with empty emails and remove duplicates
  updateProgress(0, originalRowCount, 'Filtering email data');
  
  // First filter out rows with empty or invalid emails
  let filteredData = data.filter(row => {
    const email = (row[emailField] || '').trim();
    return email !== '' && email.includes('@'); // Basic validation
  });
  
  console.log(`After removing empty emails: ${filteredData.length} rows (removed ${data.length - filteredData.length} rows)`);
  
  // Then deduplicate emails - with improved logic to keep more data
  const uniqueEmails = new Map<string, CSVRow>();
  
  filteredData.forEach((row, index) => {
    const email = row[emailField].toLowerCase().trim();
    
    // Keep the row with more data when duplicates are found
    if (!uniqueEmails.has(email) || 
        // Count non-empty values to determine which row has more data
        Object.values(row).filter(v => v && v.trim() !== '').length > 
        Object.values(uniqueEmails.get(email) || {}).filter(v => v && v.trim() !== '').length) {
      uniqueEmails.set(email, row);
    }
    
    if (index % 100 === 0) {
      updateProgress(index + 1, originalRowCount, 'Removing duplicate emails');
    }
  });
  
  let uniqueEmailData: CSVData = Array.from(uniqueEmails.values());
  console.log(`After deduplication: ${uniqueEmailData.length} unique emails (removed ${filteredData.length - uniqueEmailData.length} duplicates)`);
  updateProgress(uniqueEmailData.length, originalRowCount, 'Removed duplicate emails');
  
  // Stage 2: Process MX records
  updateProgress(0, uniqueEmailData.length, 'Processing MX records');
  let processedData = await processMXBatch(
    uniqueEmailData,
    emailField,
    (processed) => updateProgress(processed, uniqueEmailData.length, 'Processing MX records')
  );
  
  // Stage 3: Clean company names and websites
  updateProgress(0, processedData.length, 'Cleaning data');
  const chunkSize = 500; // Increased for faster processing
  for (let i = 0; i < processedData.length; i += chunkSize) {
    const chunkEnd = Math.min(i + chunkSize, processedData.length);
    
    for (let j = i; j < chunkEnd; j++) {
      const row = processedData[j];
      
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
    }
    
    updateProgress(chunkEnd, processedData.length, 'Cleaning data');
  }
  
  // Stage 4: Count domain occurrences - change threshold back to 6 from 10
  updateProgress(0, processedData.length, 'Analyzing domain frequencies');
  const domainCounts: Record<string, number> = {};
  
  // First count all domains
  processedData.forEach(row => {
    const domain = row['cleaned_website'];
    if (domain) {
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    }
  });
  
  // Then filter out domains with more than 6 occurrences (changed from 10 back to 6)
  const filteredByDomain = processedData.filter(row => {
    const domain = row['cleaned_website'];
    return !domain || domainCounts[domain] <= 6; // Changed threshold from 10 to 6
  });
  
  console.log(`After domain frequency filtering: ${filteredByDomain.length} rows (removed ${processedData.length - filteredByDomain.length} rows)`);
  
  // Stage 5: Add alternative names for duplicate domains - Fixed other_dm_name implementation
  updateProgress(0, filteredByDomain.length, 'Adding alternative contacts');
  
  // Group rows by domain more effectively
  const domainMap: Record<string, CSVRow[]> = {};
  
  filteredByDomain.forEach(row => {
    const domain = row['cleaned_website'];
    if (domain && domain.trim() !== '') {
      if (!domainMap[domain]) {
        domainMap[domain] = [];
      }
      domainMap[domain].push(row);
    }
  });
  
  // Process domains with multiple contacts - improved to ensure other_dm_name gets populated
  let enrichedCount = 0;
  
  Object.entries(domainMap).forEach(([domain, rows]) => {
    if (rows.length > 1) {
      // Extract name details from rows with better field detection
      const contactDetails = rows.map(row => {
        let fullName = '';
        let firstName = '';
        let lastName = '';
        let title = '';
        
        // Try to find name from various possible fields with more thorough checking
        for (const key of Object.keys(row)) {
          const lowerKey = key.toLowerCase();
          if ((lowerKey === 'full_name' || lowerKey === 'fullname' || lowerKey === 'name') && row[key]) {
            fullName = row[key].trim();
            break;
          }
        }
        
        if (!fullName) {
          // Try to combine first_name and last_name
          let firstNameVal = '';
          let lastNameVal = '';
          
          for (const key of Object.keys(row)) {
            const lowerKey = key.toLowerCase();
            if ((lowerKey === 'first_name' || lowerKey === 'firstname') && row[key]) {
              firstNameVal = row[key].trim();
            }
            if ((lowerKey === 'last_name' || lowerKey === 'lastname') && row[key]) {
              lastNameVal = row[key].trim();
            }
          }
          
          if (firstNameVal && lastNameVal) {
            fullName = `${firstNameVal} ${lastNameVal}`;
            firstName = firstNameVal;
            lastName = lastNameVal;
          }
        }
        
        // Get title
        for (const key of Object.keys(row)) {
          const lowerKey = key.toLowerCase();
          if ((lowerKey === 'title' || lowerKey === 'job_title' || lowerKey === 'jobtitle') && row[key]) {
            title = row[key].trim();
            break;
          }
        }
        
        return {
          row,
          fullName: fullName.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          title: title.trim(),
          email: row[emailField]
        };
      });
      
      // Filter out entries with no name or generic emails more efficiently
      const validContacts = contactDetails.filter(contact => 
        contact.fullName && contact.fullName.length > 0 && !isGenericEmail(contact.email)
      );
      
      console.log(`Domain ${domain} has ${validContacts.length} valid contacts with names`);
      
      // Skip if there aren't at least 2 valid contacts
      if (validContacts.length > 1) {
        // Create a mapping of emails to their indices for easier reference
        const emailToIndex = new Map<string, number>();
        validContacts.forEach((contact, idx) => {
          emailToIndex.set(contact.email.toLowerCase(), idx);
        });
        
        // Assign other_dm_name to each row in a round-robin fashion
        validContacts.forEach((contact, index) => {
          // Get the next contact in the array (round-robin style)
          const otherIndex = (index + 1) % validContacts.length;
          const otherContact = validContacts[otherIndex];
          
          // Add other contact's information to the row
          contact.row['other_dm_name'] = otherContact.fullName;
          
          // Optionally add more details about the alternative contact
          if (otherContact.title) {
            contact.row['other_dm_title'] = otherContact.title;
          }
          
          // Add the other contact's email for debugging/verification
          contact.row['other_dm_email'] = otherContact.email;
          
          console.log(`Assigned other_dm_name: ${otherContact.fullName} to row with email ${contact.email}`);
          enrichedCount++;
        });
      }
    }
  });
  
  console.log(`Successfully enriched ${enrichedCount} rows with other_dm_name`);
  
  updateProgress(filteredByDomain.length, filteredByDomain.length, 'Complete');
  console.log(`Single-email processing complete: ${filteredByDomain.length} rows in final output (from ${originalRowCount} original rows)`);
  
  return filteredByDomain;
};

/**
 * Process multi-email CSV - improved to handle data better and ensure other_dm_name is added
 */
export const processMultiEmailCSV = async (
  data: CSVData,
  mappedColumns: Record<string, string>,
  updateProgress: (processed: number, total: number, stage: string) => void
): Promise<CSVData> => {
  console.log(`Processing multi-email CSV with ${data.length} rows`);
  const originalRowCount = data.length;
  
  // Identify email columns
  const emailColumns = Object.keys(mappedColumns).filter(col => col.startsWith('email_'));
  updateProgress(0, originalRowCount, 'Organizing email data');
  
  // Reorganize data to ensure each email has associated metadata
  let expandedData: CSVData = [];
  let totalEmailsFound = 0;
  
  // First expand the data to have one row per email
  data.forEach((row, idx) => {
    emailColumns.forEach(emailCol => {
      const email = (row[mappedColumns[emailCol]] || '').trim();
      if (!email || !email.includes('@')) return; // Skip invalid emails
      
      totalEmailsFound++;
      
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
    
    if (idx % 20 === 0 || idx === data.length - 1) {
      updateProgress(idx + 1, originalRowCount, 'Organizing email data');
    }
  });
  
  console.log(`Expanded to ${expandedData.length} email rows (total emails found: ${totalEmailsFound})`);
  
  // Process the expanded data through the single email flow
  return processSingleEmailCSV(
    expandedData,
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
