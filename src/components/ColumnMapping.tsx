
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
    };
    
    // Handle multi-email columns
    const emailColumns = headers.filter(h => h.match(/^email_\d+$/i));
    
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
    } 
    else if (fileType === 'multi-email') {
      // Map all email_X columns
      emailColumns.forEach(col => {
        autoMap[col] = col;
      });
      
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
        ];
      case 'multi-email':
        // First find all email columns
        const emailColumns = headers.filter(h => h.match(/email_\d+$/i));
        const fields = emailColumns.map(col => ({ 
          id: col, 
          label: `${col.charAt(0).toUpperCase() + col.slice(1)} Column`, 
          required: true 
        }));
        
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
