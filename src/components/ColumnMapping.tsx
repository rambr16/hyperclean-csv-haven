
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface ColumnMappingProps {
  headers: string[];
  fileType: 'domain-only' | 'single-email' | 'multi-email' | 'unknown';
  onColumnsMapped: (mappedColumns: Record<string, string>) => void;
}

const ColumnMapping: React.FC<ColumnMappingProps> = ({ headers, fileType, onColumnsMapped }) => {
  const [mappedColumns, setMappedColumns] = useState<Record<string, string>>({});
  
  // Auto-map columns based on headers and file type
  useEffect(() => {
    const autoMap: Record<string, string> = {};
    
    // Common patterns to look for in headers
    const patterns = {
      email: /^email$|mail|e-mail|e_mail/i,
      website: /^website$|^domain$|^url$|^site$/i,
      company: /^company$|^organization$|^org$|^company.?name$/i,
      fullname: /^fullname$|^full.?name$|^name$/i,
      firstname: /^firstname$|^first.?name$/i,
      lastname: /^lastname$|^last.?name$/i,
      title: /^title$|^job.?title$/i,
      phone: /^phone$|^telephone$|^mobile$/i,
    };
    
    if (fileType === 'domain-only') {
      // Find domain/website column
      const websiteColumn = headers.find(h => patterns.website.test(h));
      if (websiteColumn) {
        autoMap['website'] = websiteColumn;
      }
    } 
    else if (fileType === 'single-email') {
      // Find email column
      const emailColumn = headers.find(h => patterns.email.test(h));
      if (emailColumn) {
        autoMap['email'] = emailColumn;
      }
      
      // Find website column
      const websiteColumn = headers.find(h => patterns.website.test(h));
      if (websiteColumn) {
        autoMap['website'] = websiteColumn;
      }
      
      // Find company column
      const companyColumn = headers.find(h => patterns.company.test(h));
      if (companyColumn) {
        autoMap['company'] = companyColumn;
      }
      
      // Find fullname column
      const fullnameColumn = headers.find(h => patterns.fullname.test(h));
      if (fullnameColumn) {
        autoMap['fullname'] = fullnameColumn;
      }
      
      // Find first name column
      const firstnameColumn = headers.find(h => patterns.firstname.test(h));
      if (firstnameColumn) {
        autoMap['firstname'] = firstnameColumn;
      }
      
      // Find last name column
      const lastnameColumn = headers.find(h => patterns.lastname.test(h));
      if (lastnameColumn) {
        autoMap['lastname'] = lastnameColumn;
      }
      
      // Find title column
      const titleColumn = headers.find(h => patterns.title.test(h));
      if (titleColumn) {
        autoMap['title'] = titleColumn;
      }
      
      // Find phone column
      const phoneColumn = headers.find(h => patterns.phone.test(h));
      if (phoneColumn) {
        autoMap['phone'] = phoneColumn;
      }
    } 
    else if (fileType === 'multi-email') {
      // Try to detect email columns in patterns like email_1, email_2, etc.
      const emailColumns = headers.filter(h => /^email_\d+$/i.test(h));
      
      // If regular email_X columns are found
      if (emailColumns.length > 0) {
        emailColumns.forEach(col => {
          autoMap[col] = col;
          
          // Look for associated metadata columns like email_1_full_name, email_1_title, etc.
          const prefix = col.replace(/_?$/, '_');
          
          // Try to map metadata columns for each email
          headers.forEach(header => {
            if (header.startsWith(prefix)) {
              const suffix = header.substring(prefix.length);
              if (/full_?name/i.test(suffix)) {
                autoMap[`${col}_full_name`] = header;
              } else if (/first_?name/i.test(suffix)) {
                autoMap[`${col}_first_name`] = header;
              } else if (/last_?name/i.test(suffix)) {
                autoMap[`${col}_last_name`] = header;
              } else if (/title/i.test(suffix)) {
                autoMap[`${col}_title`] = header;
              } else if (/phone/i.test(suffix)) {
                autoMap[`${col}_phone`] = header;
              }
            }
          });
        });
      } else {
        // If no email_X pattern found, look for regular email columns
        let emailIndex = 1;
        headers.forEach(header => {
          if (patterns.email.test(header)) {
            autoMap[`email_${emailIndex}`] = header;
            emailIndex++;
          }
        });
      }
      
      // Find website column
      const websiteColumn = headers.find(h => patterns.website.test(h));
      if (websiteColumn) {
        autoMap['website'] = websiteColumn;
      }
      
      // Find company column
      const companyColumn = headers.find(h => patterns.company.test(h));
      if (companyColumn) {
        autoMap['company'] = companyColumn;
      }
    }
    
    console.log('Auto-mapped columns:', autoMap);
    setMappedColumns(autoMap);
  }, [headers, fileType]);
  
  const handleColumnSelect = (columnType: string, value: string) => {
    setMappedColumns(prev => ({
      ...prev,
      [columnType]: value,
    }));
  };
  
  const handleSubmit = () => {
    // Validate required fields based on file type
    if (fileType === 'domain-only' && !mappedColumns['website']) {
      toast.error('Please map the website column');
      return;
    }
    
    if (fileType === 'single-email' && !mappedColumns['email']) {
      toast.error('Please map the email column');
      return;
    }
    
    if (fileType === 'multi-email') {
      const emailColumns = Object.keys(mappedColumns).filter(key => key.startsWith('email_'));
      if (emailColumns.length === 0) {
        toast.error('Please map at least one email column');
        return;
      }
    }
    
    onColumnsMapped(mappedColumns);
    toast.success('Columns mapped successfully');
  };
  
  const getRequiredFields = () => {
    switch (fileType) {
      case 'domain-only':
        return [
          { id: 'website', label: 'Website URL', required: true },
        ];
      case 'single-email':
        return [
          { id: 'email', label: 'Email', required: true },
          { id: 'website', label: 'Website URL', required: false },
          { id: 'company', label: 'Company Name', required: false },
          { id: 'fullname', label: 'Full Name', required: false },
          { id: 'firstname', label: 'First Name', required: false },
          { id: 'lastname', label: 'Last Name', required: false },
          { id: 'title', label: 'Job Title', required: false },
          { id: 'phone', label: 'Phone', required: false },
        ];
      case 'multi-email':
        // First find all email columns in the format email_1, email_2, etc.
        let emailColumns = headers.filter(h => /^email_\d+$/i.test(h));
        
        // If no email_X columns found, create default email_1, email_2, etc fields
        if (emailColumns.length === 0) {
          const emailCount = Math.min(
            headers.filter(h => /email|mail/i.test(h)).length, 
            5  // Limit to max 5 email columns
          );
          
          for (let i = 1; i <= Math.max(1, emailCount); i++) {
            emailColumns.push(`email_${i}`);
          }
        }
        
        let fields = [];
        
        // Add email columns
        for (const emailCol of emailColumns) {
          fields.push({ 
            id: emailCol, 
            label: `${emailCol.charAt(0).toUpperCase() + emailCol.slice(1).replace('_', ' ')}`, 
            required: true 
          });
          
          // Add associated metadata fields
          fields.push(
            { id: `${emailCol}_full_name`, label: `${emailCol} Full Name`, required: false },
            { id: `${emailCol}_first_name`, label: `${emailCol} First Name`, required: false },
            { id: `${emailCol}_last_name`, label: `${emailCol} Last Name`, required: false },
            { id: `${emailCol}_title`, label: `${emailCol} Title`, required: false },
            { id: `${emailCol}_phone`, label: `${emailCol} Phone`, required: false }
          );
        }
        
        // Add website and company fields
        return [
          ...fields,
          { id: 'website', label: 'Website URL', required: false },
          { id: 'company', label: 'Company Name', required: false },
        ];
      default:
        return [
          { id: 'email', label: 'Email', required: false },
          { id: 'website', label: 'Website URL', required: false },
          { id: 'company', label: 'Company Name', required: false },
        ];
    }
  };
  
  return (
    <Card className="w-full shadow-sm animate-fade-in animate-delay-100">
      <CardHeader>
        <CardTitle className="text-xl">Map Your CSV Columns</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {getRequiredFields().map((field) => (
            <div key={field.id} className="space-y-2">
              <label className="text-sm font-medium flex items-center">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <Select
                value={mappedColumns[field.id] || ''}
                onValueChange={(value) => handleColumnSelect(field.id, value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={`Select ${field.label}`} />
                </SelectTrigger>
                <SelectContent>
                  {/* Use a non-empty placeholder value */}
                  <SelectItem value="_none" disabled>-- Select Column --</SelectItem>
                  {headers.map((header) => (
                    <SelectItem key={header} value={header}>
                      {header}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          
          <Button
            onClick={handleSubmit}
            className="w-full mt-4 bg-hyperke-blue hover:bg-hyperke-darkBlue transition-colors"
          >
            Confirm Mapping
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ColumnMapping;
