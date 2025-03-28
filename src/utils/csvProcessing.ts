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
 * List of columns to exclude from the output CSV
 */
export const excludedColumns = [
  'reviews_link', 'reviews_tags', 'reviews_per_score', 'reviews_per_score_1',
  'reviews_per_score_2', 'reviews_per_score_3', 'reviews_per_score_4', 'reviews_per_score_5',
  'photos_count', 'photo', 'street_view', 'located_in', 'working_hours',
  'working_hours_old_format', 'other_hours', 'popular_times', 'business_status',
  'about', 'range', 'posts', 'logo', 'description', 'typical_time_spent',
  'verified', 'owner_id', 'owner_title', 'owner_link', 'reservation_links',
  'booking_appointment_link', 'menu_link', 'order_links', 'location_link',
  'location_reviews_link', 'place_id', 'google_id', 'cid', 'kgmid', 'reviews_id',
  'located_google_id', 'website_title', 'website_generator', 'website_description',
  'website_keywords', 'website_has_fb_pixel', 'website_has_google_tag', 'tiktok',
  'medium', 'reddit', 'skype', 'snapchat', 'telegram', 'whatsapp', 'twitter',
  'vimeo', 'youtube', 'github', 'crunchbase', 'instagram', 'facebook',
  'latitude', 'longitude', 'h3', 'time_zone', 'plus_code', 'area_service',
  'seniority', 'function', 'key', 'id', 'company id', 'headline', 
  'company twitter', 'company facebook', 'alexa ranking', 'keywords',
  'industries', 'secondary industries', 'company postal code', 'company founded year'
];

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
  // Make sure to include other_dm fields in headers if not already present
  const ensuredHeaders = [...headers];
  const importantFields = ['other_dm_name', 'other_dm_email', 'other_dm_title'];
  
  for (const field of importantFields) {
    if (!ensuredHeaders.includes(field)) {
      ensuredHeaders.push(field);
    }
  }
  
  const headerRow = ensuredHeaders.join(',');
  const dataRows = data.map(row => {
    return ensuredHeaders.map(header => {
      // Ensure all rows have values for important fields
      if (importantFields.includes(header) && (row[header] === undefined)) {
        row[header] = '';
      }
      
      const value = row[header] !== undefined ? row[header] : '';
      // Escape commas and quotes
      if (value.toString().includes(',') || value.toString().includes('"')) {
        return `"${value.toString().replace(/"/g, '""')}"`;
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
      
      // Check for Google MX patterns
      if (mxRecords.some((record: string) => 
        record.includes('google') || 
        record.includes('gmail') || 
        record.includes('aspmx.l.google.com')
      )) {
        result = 'google';
      } 
      // Check for Microsoft MX patterns
      else if (mxRecords.some((record: string) => 
        record.includes('outlook') || 
        record.includes('microsoft') || 
        record.includes('hotmail') ||
        record.includes('protection.outlook.com')
      )) {
        result = 'microsoft';
      } 
      // Default to other
      else {
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
 * Process domain only
 */
export const processDomainOnlyCSV = async (
  data: CSVData,
  websiteField: string,
  updateProgress: (processed: number) => void
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
      
      // Ensure other_dm fields exist but are empty
      row['other_dm_name'] = '';
      row['other_dm_email'] = '';
      row['other_dm_title'] = '';
      
      // Mark as not to be deleted
      row['to_be_deleted'] = 'false';
      
      // Remove whitespace
      Object.keys(row).forEach(key => {
        if (typeof row[key] === 'string') {
          row[key] = row[key].trim();
        }
      });
      
      result.push(row);
    }
    // Fix: Pass only the processed count
    updateProgress(chunkEnd);
  }
  
  console.log(`Domain-only processing complete: ${result.length} rows processed`);
  return result;
};

/**
 * Process single email CSV - with improved filtering and domain handling
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
  
  // Stage 1: Mark rows with empty emails and duplicates for deletion
  updateProgress(0, originalRowCount, 'Filtering email data');
  
  // First mark rows with empty or invalid emails
  let processedData = data.map(row => {
    const newRow = { ...row };
    const email = (newRow[emailField] || '').trim().toLowerCase();
    
    // Mark rows with empty emails as to be deleted
    if (email === '' || !email.includes('@')) {
      newRow['to_be_deleted'] = 'true';
      newRow['deletion_reason'] = 'Empty or invalid email';
    } else {
      newRow['to_be_deleted'] = 'false';
    }
    
    return newRow;
  });
  
  console.log(`After marking empty emails: ${processedData.filter(r => r['to_be_deleted'] === 'false').length} valid rows (marked ${processedData.filter(r => r['to_be_deleted'] === 'true').length} rows for deletion)`);
  
  // Then mark duplicate emails - keep the row with more data
  const uniqueEmails = new Map<string, number>();
  const duplicateEmails = new Set<string>();
  
  // First pass: identify duplicates
  processedData.forEach((row, index) => {
    if (row['to_be_deleted'] === 'true') return;
    
    const email = row[emailField].toLowerCase().trim();
    if (uniqueEmails.has(email)) {
      duplicateEmails.add(email);
    } else {
      uniqueEmails.set(email, index);
    }
    
    if (index % 100 === 0) {
      updateProgress(index + 1, originalRowCount, 'Identifying duplicate emails');
    }
  });
  
  // Second pass: for duplicates, find the row with the most data
  if (duplicateEmails.size > 0) {
    console.log(`Found ${duplicateEmails.size} duplicate emails to process`);
    
    // For each duplicate email, find the row with the most data
    duplicateEmails.forEach(email => {
      const duplicateRows = processedData
        .map((row, index) => ({ row, index }))
        .filter(item => 
          item.row['to_be_deleted'] === 'false' && 
          item.row[emailField].toLowerCase().trim() === email
        );
      
      if (duplicateRows.length <= 1) return;
      
      // Find the row with the most non-empty values
      let bestRowIndex = duplicateRows[0].index;
      let maxNonEmptyValues = Object.values(duplicateRows[0].row)
        .filter(v => v && v.trim() !== '').length;
      
      for (let i = 1; i < duplicateRows.length; i++) {
        const nonEmptyValues = Object.values(duplicateRows[i].row)
          .filter(v => v && v.trim() !== '').length;
        
        if (nonEmptyValues > maxNonEmptyValues) {
          maxNonEmptyValues = nonEmptyValues;
          bestRowIndex = duplicateRows[i].index;
        }
      }
      
      // Mark all duplicate rows except the best one for deletion
      duplicateRows.forEach(item => {
        if (item.index !== bestRowIndex) {
          processedData[item.index]['to_be_deleted'] = 'true';
          processedData[item.index]['deletion_reason'] = 'Duplicate email (keeping row with more data)';
        }
      });
    });
  }
  
  console.log(`After marking duplicates: ${processedData.filter(r => r['to_be_deleted'] === 'false').length} unique rows (marked ${processedData.filter(r => r['to_be_deleted'] === 'true' && r['deletion_reason']?.includes('Duplicate')).length} duplicate rows for deletion)`);
  updateProgress(processedData.length, originalRowCount, 'Marked duplicate emails');
  
  // Stage 2: Process MX records
  updateProgress(0, processedData.length, 'Processing MX records');
  processedData = await processMXBatch(
    processedData,
    emailField,
    (processed) => updateProgress(processed, processedData.length, 'Processing MX records')
  );
  
  // Stage 3: Clean company names and websites
  updateProgress(0, processedData.length, 'Cleaning data');
  const chunkSize = 500;
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
      
      // Ensure other_dm fields always exist
      row['other_dm_name'] = '';
      row['other_dm_email'] = '';
      row['other_dm_title'] = '';
    }
    
    updateProgress(chunkEnd, processedData.length, 'Cleaning data');
  }
  
  // Stage 4: Count domain occurrences and mark domains with more than 6 occurrences for deletion
  updateProgress(0, processedData.length, 'Analyzing domain frequencies');
  const domainCounts: Record<string, number> = {};
  
  // First count all domains (only for rows not already marked for deletion)
  processedData.forEach(row => {
    if (row['to_be_deleted'] === 'true') return;
    
    const domain = row['cleaned_website'];
    if (domain && domain.trim() !== '') {
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    }
  });
  
  // Then mark domains with more than 6 occurrences for deletion
  processedData.forEach(row => {
    if (row['to_be_deleted'] === 'true') return;
    
    const domain = row['cleaned_website'];
    if (domain && domain.trim() !== '' && domainCounts[domain] > 6) {
      row['to_be_deleted'] = 'true';
      row['deletion_reason'] = `Domain ${domain} appears ${domainCounts[domain]} times (>6)`;
    }
  });
  
  console.log(`After marking high-frequency domains: ${processedData.filter(r => r['to_be_deleted'] === 'false').length} rows remain (marked ${processedData.filter(r => r['to_be_deleted'] === 'true' && r['deletion_reason']?.includes('Domain')).length} rows for deletion due to domain frequency)`);
  
  // Stage 5: Round-robin assignment for other_dm_name with improved blank domain handling
  updateProgress(0, processedData.length, 'Adding alternative contacts');
  
  // Group rows by domain, skipping blank websites and rows marked for deletion
  const domainMap: Record<string, CSVRow[]> = {};
  
  processedData.forEach(row => {
    if (row['to_be_deleted'] === 'true') return;
    
    const domain = row['cleaned_website'];
    if (domain && domain.trim() !== '') {
      if (!domainMap[domain]) {
        domainMap[domain] = [];
      }
      domainMap[domain].push(row);
    }
  });
  
  // Debug domain grouping
  console.log(`Found ${Object.keys(domainMap).length} unique domains for processing`);
  
  // Process domains with multiple contacts for round-robin assignment
  let enrichedCount = 0;
  
  Object.entries(domainMap).forEach(([domain, rows]) => {
    // Skip if domain is blank or has only one contact
    if (domain.trim() === '' || rows.length <= 1) {
      console.log(`Domain ${domain || 'BLANK'} has ${rows.length} contacts. Skipping round-robin...`);
      return;
    }
    
    console.log(`Domain ${domain} has ${rows.length} contacts. Processing for round-robin...`);
    
    // For domains with multiple rows, assign other_dm_name to each row
    // by referring to other rows in the same domain
    for (let i = 0; i < rows.length; i++) {
      const currentRow = rows[i];
      // Next person in the same domain (with wraparound)
      const nextIndex = (i + 1) % rows.length;
      const nextRow = rows[nextIndex];
      
      // Get all possible name fields from the next row
      let otherDmName = '';
      let otherDmEmail = '';
      let otherDmTitle = '';
      
      // Try to find the name in various fields
      if (nextRow['full_name'] && nextRow['full_name'].trim()) {
        otherDmName = nextRow['full_name'].trim();
      } else if (nextRow['fullName'] && nextRow['fullName'].trim()) {
        otherDmName = nextRow['fullName'].trim();
      } else {
        // Try combination of first and last name
        let firstName = '';
        let lastName = '';
        
        if (nextRow['first_name']) firstName = nextRow['first_name'].trim();
        else if (nextRow['firstName']) firstName = nextRow['firstName'].trim();
        
        if (nextRow['last_name']) lastName = nextRow['last_name'].trim();
        else if (nextRow['lastName']) lastName = nextRow['lastName'].trim();
        
        if (firstName && lastName) {
          otherDmName = `${firstName} ${lastName}`;
        }
      }
      
      // If we couldn't find a name, try extracting from Full Name
      if (!otherDmName && nextRow['Full Name']) {
        otherDmName = nextRow['Full Name'].trim();
      }
      
      // Get email and title
      otherDmEmail = nextRow[emailField] || '';
      
      if (nextRow['title']) {
        otherDmTitle = nextRow['title'].trim();
      } else if (nextRow['Title']) {
        otherDmTitle = nextRow['Title'].trim();
      }
      
      // Only assign if we found a valid name
      if (otherDmName) {
        console.log(`Assigning other_dm_name "${otherDmName}" to row with email "${currentRow[emailField]}"`);
        currentRow['other_dm_name'] = otherDmName;
        currentRow['other_dm_email'] = otherDmEmail;
        currentRow['other_dm_title'] = otherDmTitle;
        enrichedCount++;
      } else {
        console.log(`Could not find a valid name for domain ${domain} in row ${nextIndex}`);
      }
    }
  });
  
  console.log(`Successfully enriched ${enrichedCount} rows with other_dm_name`);
  
  updateProgress(processedData.length, processedData.length, 'Complete');
  console.log(`Single-email processing complete: ${processedData.filter(r => r['to_be_deleted'] === 'false').length} valid rows from ${originalRowCount} original rows`);
  
  return processedData;
};

/**
 * Process multi-email CSV - with improved filtering and domain handling
 */
export const processMultiEmailCSV = async (
  data: CSVData,
  mappedColumns: Record<string, string>,
  updateProgress: (processed: number, total: number, stage: string) => void
): Promise<CSVData> => {
  console.log(`Processing multi-email CSV with ${data.length} rows`);
  const originalRowCount = data.length;
  
  // Identify all email columns that start with email_
  const emailColumns = Object.keys(mappedColumns).filter(col => col.startsWith('email_'));
  updateProgress(0, originalRowCount, 'Organizing email data');
  
  // Reorganize data to ensure each email has associated metadata
  let expandedData: CSVData = [];
  let totalEmailsFound = 0;
  
  // First expand the data to have one row per email, preserving all metadata
  data.forEach((row, idx) => {
    // For each row, create separate rows for each email column
    const emailsWithData: Array<{
      emailColumn: string,
      email: string,
      fullName?: string,
      firstName?: string,
      lastName?: string,
      title?: string,
      phone?: string,
      originalRow: CSVRow
    }> = [];
    
    // Gather all valid emails and their associated data
    emailColumns.forEach(emailCol => {
      const email = (row[mappedColumns[emailCol]] || '').trim().toLowerCase();
      if (!email || !email.includes('@')) return; // Skip invalid emails
      
      // Extract the prefix (e.g., "email_1" from "email_1")
      const prefix = emailCol;
      
      // Look for all associated fields with the same prefix
      const rowData: Record<string, string> = {};
      for (const [key, columnName] of Object.entries(mappedColumns)) {
        // Only copy values if the key starts with the same prefix or is a common field
        if (key.startsWith(prefix) || !key.startsWith('email_')) {
          rowData[key] = row[columnName] || '';
        }
      }
      
      // Try to find full name, first name, last name, etc.
      const fullNameField = `${prefix}_full_name`;
      const firstNameField = `${prefix}_first_name`;
      const lastNameField = `${prefix}_last_name`;
      const titleField = `${prefix}_title`;
      const phoneField = `${prefix}_phone`;
      
      emailsWithData.push({
        emailColumn: emailCol,
        email: email,
        fullName: row[mappedColumns[fullNameField] || ''] || '',
        firstName: row[mappedColumns[firstNameField] || ''] || '',
        lastName: row[mappedColumns[lastNameField] || ''] || '',
        title: row[mappedColumns[titleField] || ''] || '',
        phone: row[mappedColumns[phoneField] || ''] || '',
        originalRow: row
      });
    });
    
    // If we found valid emails, create a row for each one
    if (emailsWithData.length > 0) {
      totalEmailsFound += emailsWithData.length;
      
      // For each email, create a new row with all data
      emailsWithData.forEach(emailData => {
        const newRow: CSVRow = {};
        
        // Add original row data first
        for (const [key, value] of Object.entries(emailData.originalRow)) {
          newRow[key] = value;
        }
        
        // Then add normalized fields for standard processing
        newRow['email'] = emailData.email;
        newRow['fullName'] = emailData.fullName || '';
        newRow['firstName'] = emailData.firstName || '';
        newRow['lastName'] = emailData.lastName || '';
        newRow['title'] = emailData.title || '';
        newRow['phone'] = emailData.phone || '';
        
        // Set to_be_deleted flag (default to false)
        newRow['to_be_deleted'] = 'false';
        
        // For debugging
        newRow['_source_column'] = emailData.emailColumn;
        
        // For website domain
        if (mappedColumns['website'] && emailData.originalRow[mappedColumns['website']]) {
          newRow['website'] = emailData.originalRow[mappedColumns['website']];
        }
        
        // For company
        if (mappedColumns['company'] && emailData.originalRow[mappedColumns['company']]) {
          newRow['company'] = emailData.originalRow[mappedColumns['company']];
        }
        
        // Initialize alternative contact fields
        newRow['other_dm_name'] = '';
        newRow['other_dm_email'] = '';
        newRow['other_dm_title'] = '';
        
        expandedData.push(newRow);
      });
    }
    
    if (idx % 20 === 0 || idx === data.length - 1) {
      updateProgress(idx + 1, originalRowCount, 'Organizing email data');
    }
  });
  
  console.log(`Expanded to ${expandedData.length} email rows (total emails found: ${totalEmailsFound})`);
  
  if (expandedData.length === 0) {
    console.log("No valid emails found in the multi-email CSV");
    return [];
  }
  
  // Identify duplicate emails and mark them for deletion
  const uniqueEmails = new Map<string, number>();
  const duplicateEmails = new Set<string>();
  
  // First pass: identify duplicates
  expandedData.forEach((row, index) => {
    const email = row['email'].toLowerCase().trim();
    if (uniqueEmails.has(email)) {
      duplicateEmails.add(email);
    } else {
      uniqueEmails.set(email, index);
    }
  });
  
  // Second pass: mark duplicates for deletion, keeping the row with most data
  if (duplicateEmails.size > 0) {
    console.log(`Found ${duplicateEmails.size} duplicate emails to process`);
    
    duplicateEmails.forEach(email => {
      const duplicateRows = expandedData
        .map((row, index) => ({ row, index }))
        .filter(item => item.row['email'].toLowerCase().trim() === email);
      
      if (duplicateRows.length <= 1) return;
      
      // Find the row with the most non-empty values
      let bestRowIndex = duplicateRows[0].index;
      let maxNonEmptyValues = Object.values(duplicateRows[0].row)
        .filter(v => v && v.trim() !== '').length;
      
      for (let i = 1; i < duplicateRows.length; i++) {
        const nonEmptyValues = Object.values(duplicateRows[i].row)
          .filter(v => v && v.trim() !== '').length;
        
        if (nonEmptyValues > maxNonEmptyValues) {
          maxNonEmptyValues = nonEmptyValues;
          bestRowIndex = duplicateRows[i].index;
        }
      }
      
      // Mark all duplicate rows except the best one for deletion
      duplicateRows.forEach(item => {
        if (item.index !== bestRowIndex) {
          expandedData[item.index]['to_be_deleted'] = 'true';
          expandedData[item.index]['deletion_reason'] = 'Duplicate email (keeping row with more data)';
        }
      });
    });
  }
  
  console.log(`After marking duplicates: ${expandedData.filter(r => r['to_be_deleted'] === 'false').length} unique rows (marked ${expandedData.filter(r => r['to_be_deleted'] === 'true').length} duplicate rows for deletion)`);
  
  // Now perform MX lookup and cleaning on expanded data
  updateProgress(0, expandedData.length, 'Processing MX records');
  let processedData = await processMXBatch(
    expandedData,
    'email',
    (processed) => updateProgress(processed, expandedData.length, 'Processing MX records')
  );
  
  // Clean company names and websites
  updateProgress(0, processedData.length, 'Cleaning data');
  const chunkSize = 500;
  for (let i = 0; i < processedData.length; i += chunkSize) {
    const chunkEnd = Math.min(i + chunkSize, processedData.length);
    
    for (let j = i; j < chunkEnd; j++) {
      const row = processedData[j];
      
      // Clean company name if present
      if (row['company']) {
        row['cleaned_company_name'] = cleanCompanyName(row['company']);
      }
      
      // Clean website from explicit website field or extract from email
      if (row['website']) {
        row['cleaned_website'] = cleanWebsiteUrl(row['website']);
      } else if (row['email']) {
        try {
          const emailDomain = row['email'].split('@')[1];
          row['cleaned_website'] = emailDomain;
        } catch (error) {
          row['cleaned_website'] = '';
        }
      }
      
      // Ensure all other_dm fields exist
      if (row['other_dm_name'] === undefined) row['other_dm_name'] = '';
      if (row['other_dm_email'] === undefined) row['other_dm_email'] = '';
      if (row['other_dm_title'] === undefined) row['other_dm_title'] = '';
    }
    
    updateProgress(chunkEnd, processedData.length, 'Cleaning data');
  }
  
  // Count domain occurrences and mark domains with more than 6 occurrences for deletion
  updateProgress(0, processedData.length, 'Analyzing domain frequencies');
  const domainCounts: Record<string, number> = {};
  
  // First count all domains (only for rows not already marked for deletion)
  processedData.forEach(row => {
    if (row['to_be_deleted'] === 'true') return;
    
    const domain = row['cleaned_website'];
    if (domain && domain.trim() !== '') {
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    }
  });
  
  // Then mark domains with more than 6 occurrences for deletion
  processedData.forEach(row => {
    if (row['to_be_deleted'] === 'true') return;
    
    const domain = row['cleaned_website'];
    if (domain && domain.trim() !== '' && domainCounts[domain] > 6) {
      row['to_be_deleted'] = 'true';
      row['deletion_reason'] = `Domain ${domain} appears ${domainCounts[domain]} times (>6)`;
    }
  });
  
  console.log(`After marking high-frequency domains: ${processedData.filter(r => r['to_be_deleted'] === 'false').length} rows remain (marked ${processedData.filter(r => r['to_be_deleted'] === 'true' && r['deletion_reason']?.includes('Domain')).length} rows for deletion due to domain frequency)`);
  
  // Round-robin assignment for other_dm_name - skip blank domains
  updateProgress(0, processedData.length, 'Adding alternative contacts');
  
  // Group rows by domain for round-robin assignment, skipping blank domains and rows marked for deletion
  const domainMap: Record<string, CSVRow[]> = {};
  
  processedData.forEach(row => {
    if (row['to_be_deleted'] === 'true') return;
    
    const domain = row['cleaned_website'];
    if (domain && domain.trim() !== '') {
      if (!domainMap[domain]) {
        domainMap[domain] = [];
      }
      domainMap[domain].push(row);
    }
  });
  
  // Process domains with multiple contacts using round-robin assignment
  let enrichedCount = 0;
  
  Object.entries(domainMap).forEach(([domain, rows]) => {
    // Skip if domain has only one contact
    if (domain.trim() === '' || rows.length <= 1) {
      console.log(`Domain ${domain || 'BLANK'} has ${rows.length} contacts. Skipping round-robin...`);
      return;
    }
    
    // Filter valid contacts (have name and non-generic email)
    const validContacts = rows.filter(row => {
      const email = row['email'] || '';
      const fullName = row['fullName'] || row['full_name'] || '';
      const firstName = row['firstName'] || row['first_name'] || '';
      const lastName = row['lastName'] || row['last_name'] || '';
      const hasFullName = fullName && fullName.trim() !== '';
      const hasFirstAndLastName = (firstName && firstName.trim() !== '') && 
                                 (lastName && lastName.trim() !== '');
      
      // Contact must have a name and non-generic email
      return (hasFullName || hasFirstAndLastName) && !isGenericEmail(email);
    });
    
    if (validContacts.length > 1) {
      console.log(`Domain ${domain}: ${validContacts.length} valid contacts found for round-robin assignment`);
      
      // Assign other_dm_name in round-robin fashion
      validContacts.forEach((currentContact, index) => {
        // Get the next contact in the array (round-robin style)
        const nextIndex = (index + 1) % validContacts.length;
        const nextContact = validContacts[nextIndex];
        
        // Get the person's full name from nextContact
        let otherDmName = '';
        
        // First try to get the full name directly
        if (nextContact['fullName'] && nextContact['fullName'].trim() !== '') {
          otherDmName = nextContact['fullName'].trim();
        } 
        else if (nextContact['full_name'] && nextContact['full_name'].trim() !== '') {
          otherDmName = nextContact['full_name'].trim();
        }
        // If no fullName, try concatenating first and last name
        else if (nextContact['firstName'] && nextContact['lastName']) {
          otherDmName = `${nextContact['firstName'].trim()} ${nextContact['lastName'].trim()}`;
        }
        else if (nextContact['first_name'] && nextContact['last_name']) {
          otherDmName = `${nextContact['first_name'].trim()} ${nextContact['last_name'].trim()}`;
        }
        
        // Get title if available
        let otherDmTitle = nextContact['title'] || '';
        
        // Only set other_dm_name if we have a valid person name
        if (otherDmName && otherDmName.trim() !== '') {
          // Check if name equals company name (to avoid using company name as person name)
          const companyName = nextContact['company'] || '';
          const cleanedCompanyName = nextContact['cleaned_company_name'] || '';
          
          // Skip if name and company match (case insensitive comparison)
          const isCompanyName = 
            (companyName && otherDmName.toLowerCase() === companyName.toLowerCase()) ||
            (cleanedCompanyName && otherDmName.toLowerCase() === cleanedCompanyName.toLowerCase());
          
          if (isCompanyName) {
            console.log(`Warning: Skipping assignment because name "${otherDmName}" matches company name`);
          } else {
            currentContact['other_dm_name'] = otherDmName;
            currentContact['other_dm_title'] = otherDmTitle;
            currentContact['other_dm_email'] = nextContact['email'] || '';
            
            console.log(`Assigned other_dm_name: ${otherDmName} to row with email ${currentContact['email']}`);
            enrichedCount++;
          }
        } else {
          console.log(`Unable to find a valid name for contact with email ${nextContact['email']}`);
        }
      });
    } else {
      console.log(`Domain ${domain}: Only ${validContacts.length} valid contacts found, skipping round-robin`);
    }
  });
  
  console.log(`Successfully enriched ${enrichedCount} rows with other_dm_name`);
  
  // Final verification - ensure all rows have other_dm fields
  processedData.forEach(row => {
    if (row['other_dm_name'] === undefined) row['other_dm_name'] = '';
    if (row['other_dm_email'] === undefined) row['other_dm_email'] = '';
    if (row['other_dm_title'] === undefined) row['other_dm_title'] = '';
  });
  
  updateProgress(processedData.length, processedData.length, 'Complete');
  console.log(`Multi-email processing complete: ${processedData.filter(r => r['to_be_deleted'] === 'false').length} valid rows from ${originalRowCount} original rows`);
  
  return processedData;
};

/**
 * Save CSV data as a downloadable file - modified to handle to_be_deleted column
 */
export const downloadCSV = (data: CSVData, filename: string): void => {
  if (!data.length) {
    toast.error('No data to download');
    return;
  }
  
  // Get all headers from the data
  const allHeaders = new Set<string>();
  
  // First collect all unique headers across all rows
  data.forEach(row => {
    Object.keys(row).forEach(key => allHeaders.add(key));
  });
  
  // Add critical fields if they don't exist
  ['other_dm_name', 'other_dm_email', 'other_dm_title', 'to_be_deleted', 'deletion_reason'].forEach(field => {
    allHeaders.add(field);
  });
  
  // Filter out excluded columns
  const filteredHeaders = Array.from(allHeaders).filter(header => 
    !excludedColumns.includes(header.toLowerCase())
  );
  
  // Convert to array and ensure each row has all fields
  const processedData = data.map(row => {
    const newRow: CSVRow = {};
    // Only include non-excluded headers in each row
    filteredHeaders.forEach(header => {
      newRow[header] = row[header] !== undefined ? row[header] : '';
    });
    return newRow;
  });
  
  const csvContent = dataToCSV(filteredHeaders, processedData);
  
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
