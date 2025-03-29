
import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, ChevronDown, ChevronUp, ChevronsUpDown, Users } from 'lucide-react';
import { CSVData, downloadCSV, excludedColumns } from '@/utils/csvProcessing';

interface DataPreviewProps {
  data: CSVData;
  fileName: string;
}

const DataPreview: React.FC<DataPreviewProps> = ({ data, fileName }) => {
  const [visibleRows, setVisibleRows] = useState(10);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [highlightedDomain, setHighlightedDomain] = useState<string | null>(null);
  
  // Return null early if no data to prevent unnecessary re-renders
  if (!data || data.length === 0) {
    return null;
  }
  
  // Create a stable copy of the data to prevent modification of props directly
  const stableData = useMemo(() => {
    return data.map(row => ({
      ...row,
      // Ensure other_dm fields exist in every row
      other_dm_name: row.other_dm_name !== undefined ? row.other_dm_name : '',
      other_dm_email: row.other_dm_email !== undefined ? row.other_dm_email : '',
      other_dm_title: row.other_dm_title !== undefined ? row.other_dm_title : '',
    }));
  }, [data]);
  
  // Get all headers from the data once
  const allHeaders = useMemo(() => {
    // Get all possible headers from all rows
    const headerSet = new Set<string>();
    stableData.forEach(row => {
      Object.keys(row).forEach(key => headerSet.add(key));
    });
    
    // Ensure other_dm fields are in the headers even if they're not in any row
    headerSet.add('other_dm_name');
    headerSet.add('other_dm_email');
    headerSet.add('other_dm_title');
    
    // Filter out excluded columns
    return Array.from(headerSet).filter(header => 
      !excludedColumns.includes(header.toLowerCase())
    );
  }, [stableData]);
  
  // Check if there are any rows with other_dm_name
  const hasAlternativeContacts = useMemo(() => {
    return stableData.some(row => row.other_dm_name && row.other_dm_name.trim() !== '');
  }, [stableData]);
  
  // Count how many rows have alternative contacts
  const alternativeContactCount = useMemo(() => {
    return stableData.filter(row => row.other_dm_name && row.other_dm_name.trim() !== '').length;
  }, [stableData]);
  
  // Organize headers to show important columns first
  const priorityHeaders = [
    'email', 'fullName', 'full_name', 'firstName', 'first_name', 'lastName', 'last_name', 
    'title', 'phone', 'company', 'cleaned_company_name', 'website', 'cleaned_website',
    'other_dm_name', 'other_dm_email', 'other_dm_title', 'mx_provider'
  ];
  
  const prioritizedHeaders = useMemo(() => {
    // Make sure other_dm fields are included in headers
    const uniqueHeaders = new Set([...allHeaders]);
    
    // Sort the headers with priority headers first
    return [
      ...priorityHeaders.filter(h => uniqueHeaders.has(h)),
      ...Array.from(uniqueHeaders).filter(h => !priorityHeaders.includes(h))
    ];
  }, [allHeaders]);
  
  const handleDownload = useCallback(() => {
    // Make sure our updated data with other_dm fields is downloaded
    downloadCSV(stableData, `processed_${fileName}`);
  }, [stableData, fileName]);
  
  const handleLoadMore = useCallback(() => {
    setVisibleRows(prev => Math.min(prev + 10, stableData.length));
  }, [stableData.length]);
  
  const handleSortByColumn = useCallback((header: string) => {
    if (sortColumn === header) {
      // Toggle direction if clicking the same column
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      // Set new column and default to ascending
      setSortColumn(header);
      setSortDirection('asc');
    }
  }, [sortColumn]);
  
  // Memoize sorted data to avoid unnecessary recalculations
  const sortedData = useMemo(() => {
    if (!sortColumn) return stableData;
    
    return [...stableData].sort((a, b) => {
      // Safely access properties that might not exist
      const valueA = a[sortColumn] !== undefined ? a[sortColumn] : '';
      const valueB = b[sortColumn] !== undefined ? b[sortColumn] : '';
      
      const comparison = String(valueA).localeCompare(String(valueB), undefined, { sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [stableData, sortColumn, sortDirection]);
  
  const handleHighlightDomain = useCallback((domain: string) => {
    setHighlightedDomain(highlightedDomain === domain ? null : domain);
  }, [highlightedDomain]);
  
  // Helper function to get the appropriate style for MX provider
  const getMxProviderStyle = (provider: string) => {
    if (!provider || provider === 'Unknown' || provider === '-') {
      return 'text-gray-500';
    }
    
    const knownProviders = ['Gmail', 'Microsoft', 'Yahoo', 'Apple', 'ProtonMail', 'Zoho', 'AOL', 'FastMail'];
    if (knownProviders.includes(provider)) {
      return 'text-purple-600 font-medium';
    }
    
    if (provider === 'Company Email') {
      return 'text-blue-600 font-medium';
    }
    
    return 'text-green-600';
  };
  
  return (
    <Card className="w-full mt-8 shadow-sm animate-fade-in animate-delay-200">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-xl">Preview ({stableData.length} rows processed)</CardTitle>
          {hasAlternativeContacts && (
            <p className="text-sm text-green-600 flex items-center mt-1">
              <Users className="h-4 w-4 mr-1" />
              Found {alternativeContactCount} alternative contacts
            </p>
          )}
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="text-hyperke-blue hover:bg-hyperke-blue/10"
          onClick={handleDownload}
        >
          <Download className="h-4 w-4 mr-2" />
          Download CSV
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="table-container rounded border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {prioritizedHeaders.map(header => (
                  <th 
                    key={header} 
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSortByColumn(header)}
                  >
                    <div className="flex items-center">
                      {header}
                      {sortColumn === header ? (
                        sortDirection === 'asc' ? 
                          <ChevronUp className="h-3 w-3 ml-1" /> : 
                          <ChevronDown className="h-3 w-3 ml-1" />
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 ml-1 opacity-30" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedData.slice(0, visibleRows).map((row, rowIndex) => {
                // Determine if this row should be highlighted based on domain
                const rowDomain = row['cleaned_website'] || '';
                const isHighlighted = highlightedDomain && rowDomain === highlightedDomain;
                const hasAlternativeContact = row['other_dm_name'] && row['other_dm_name'].trim() !== '';
                
                return (
                  <tr 
                    key={rowIndex} 
                    className={`hover:bg-gray-50 ${isHighlighted ? 'bg-blue-50' : ''} ${hasAlternativeContact ? 'border-l-2 border-green-300' : ''}`}
                  >
                    {prioritizedHeaders.map(header => {
                      // Special handling for other_dm fields to always display them
                      if (header === 'other_dm_name' || header === 'other_dm_email' || header === 'other_dm_title') {
                        const value = row[header] || '';
                        
                        return (
                          <td 
                            key={`${rowIndex}-${header}`} 
                            className={`px-3 py-2 text-xs ${value ? 'font-medium text-green-600 bg-green-50' : 'text-gray-400'}`}
                          >
                            {value ? (
                              <span className="flex items-center">
                                {header === 'other_dm_name' && <Users className="h-3 w-3 mr-1" />}
                                {value}
                              </span>
                            ) : (
                              'null'
                            )}
                          </td>
                        );
                      }
                      
                      // Highlight domains with clickable behavior
                      if (header === 'cleaned_website' && row[header]) {
                        return (
                          <td 
                            key={`${rowIndex}-${header}`} 
                            className="px-3 py-2 text-xs cursor-pointer text-blue-600 hover:underline"
                            onClick={() => handleHighlightDomain(row[header])}
                          >
                            {row[header]}
                          </td>
                        );
                      }
                      
                      // Special highlighting for MX provider
                      if (header === 'mx_provider') {
                        return (
                          <td 
                            key={`${rowIndex}-${header}`} 
                            className={`px-3 py-2 text-xs ${getMxProviderStyle(row[header])}`}
                          >
                            {row[header] || '-'}
                          </td>
                        );
                      }
                      
                      // Display all other values normally
                      return (
                        <td 
                          key={`${rowIndex}-${header}`} 
                          className="px-3 py-2 text-xs text-gray-800 whitespace-nowrap"
                        >
                          {row[header] !== undefined ? row[header] : '-'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {visibleRows < stableData.length && (
          <div className="flex justify-center mt-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleLoadMore}
            >
              Load More ({Math.min(visibleRows + 10, stableData.length) - visibleRows} more rows)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DataPreview;
