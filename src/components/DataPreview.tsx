
import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, ChevronDown, ChevronUp, ChevronsUpDown, Users } from 'lucide-react';
import { CSVData, downloadCSV } from '@/utils/csvProcessing';

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
  
  const allHeaders = Object.keys(data[0]);
  
  // Check if there are any rows with other_dm_name
  const hasAlternativeContacts = useMemo(() => {
    return data.some(row => row.other_dm_name && row.other_dm_name.trim() !== '');
  }, [data]);
  
  // Organize headers to show important columns first
  const priorityHeaders = [
    'email', 'fullName', 'full_name', 'firstName', 'first_name', 'lastName', 'last_name', 
    'title', 'phone', 'company', 'cleaned_company_name', 'website', 'cleaned_website',
    'other_dm_name', 'other_dm_email', 'other_dm_title', 'mx_provider'
  ];
  
  const prioritizedHeaders = useMemo(() => [
    ...priorityHeaders.filter(h => allHeaders.includes(h)),
    ...allHeaders.filter(h => !priorityHeaders.includes(h))
  ], [allHeaders]);
  
  const handleDownload = useCallback(() => {
    downloadCSV(data, `processed_${fileName}`);
  }, [data, fileName]);
  
  const handleLoadMore = useCallback(() => {
    setVisibleRows(prev => Math.min(prev + 10, data.length));
  }, [data.length]);
  
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
    if (!sortColumn) return data;
    
    return [...data].sort((a, b) => {
      const valueA = a[sortColumn] || '';
      const valueB = b[sortColumn] || '';
      
      const comparison = valueA.localeCompare(valueB, undefined, { sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, sortColumn, sortDirection]);
  
  const handleHighlightDomain = useCallback((domain: string) => {
    setHighlightedDomain(highlightedDomain === domain ? null : domain);
  }, [highlightedDomain]);
  
  return (
    <Card className="w-full mt-8 shadow-sm animate-fade-in animate-delay-200">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-xl">Preview ({data.length} rows processed)</CardTitle>
          {hasAlternativeContacts && (
            <p className="text-sm text-green-600 flex items-center mt-1">
              <Users className="h-4 w-4 mr-1" />
              Alternative contacts found and assigned
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
                      const value = row[header] || '';
                      
                      // Highlight domains with clickable behavior
                      if (header === 'cleaned_website' && value) {
                        return (
                          <td 
                            key={`${rowIndex}-${header}`} 
                            className="px-3 py-2 text-xs cursor-pointer text-blue-600 hover:underline"
                            onClick={() => handleHighlightDomain(value)}
                          >
                            {value}
                          </td>
                        );
                      }
                      
                      // Highlight other_dm_name relationships
                      if (header === 'other_dm_name' && value) {
                        return (
                          <td 
                            key={`${rowIndex}-${header}`} 
                            className="px-3 py-2 text-xs font-medium text-green-600 bg-green-50"
                          >
                            <span className="flex items-center">
                              <Users className="h-3 w-3 mr-1" />
                              {value}
                            </span>
                          </td>
                        );
                      }
                      
                      // Display all other values normally
                      return (
                        <td 
                          key={`${rowIndex}-${header}`} 
                          className="px-3 py-2 text-xs text-gray-800 whitespace-nowrap"
                        >
                          {value || '-'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {visibleRows < data.length && (
          <div className="flex justify-center mt-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleLoadMore}
            >
              Load More ({Math.min(visibleRows + 10, data.length) - visibleRows} more rows)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DataPreview;
