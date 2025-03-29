
import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, ChevronDown, ChevronUp, ChevronsUpDown, Users, Trash2 } from 'lucide-react';
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
  const [showMarkedForDeletion, setShowMarkedForDeletion] = useState(true);
  
  // Return null early if no data to prevent unnecessary re-renders
  if (!data || data.length === 0) {
    return null;
  }
  
  // Create a stable copy of the data to prevent modification of props directly
  const stableData = useMemo(() => {
    return data.map(row => ({
      ...row,
      // Ensure other_dm_name and to_be_deleted exist in every row
      other_dm_name: row.other_dm_name !== undefined ? row.other_dm_name : '',
      to_be_deleted: row.to_be_deleted !== undefined ? row.to_be_deleted : 'false'
    }));
  }, [data]);
  
  // Count rows marked for deletion
  const markedForDeletionCount = useMemo(() => {
    return stableData.filter(row => row.to_be_deleted === 'true').length;
  }, [stableData]);
  
  // Get all headers from the data once
  const allHeaders = useMemo(() => {
    // Get all possible headers from all rows
    const headerSet = new Set<string>();
    stableData.forEach(row => {
      Object.keys(row).forEach(key => headerSet.add(key));
    });
    
    // Ensure important fields are in the headers even if not in any row
    headerSet.add('other_dm_name');
    headerSet.add('other_dm_email');
    headerSet.add('other_dm_title');
    headerSet.add('to_be_deleted');
    headerSet.add('deletion_reason');
    
    // Filter out excluded columns
    return Array.from(headerSet).filter(header => 
      !excludedColumns.includes(header.toLowerCase())
    );
  }, [stableData]);
  
  // Check if there are any rows with other_dm_name
  const hasAlternativeContacts = useMemo(() => {
    return stableData.some(row => row.other_dm_name && row.other_dm_name.trim() !== '');
  }, [stableData]);
  
  // Organize headers to show important columns first
  const priorityHeaders = [
    'to_be_deleted', 'deletion_reason', 'email', 'fullName', 'full_name', 'firstName', 'first_name', 
    'lastName', 'last_name', 'title', 'phone', 'company', 'cleaned_company_name', 
    'website', 'cleaned_website', 'other_dm_name', 'other_dm_email', 'other_dm_title', 'mx_provider'
  ];
  
  const prioritizedHeaders = useMemo(() => {
    // Make sure important headers are included
    const uniqueHeaders = new Set([...allHeaders]);
    
    // Sort the headers with priority headers first
    return [
      ...priorityHeaders.filter(h => uniqueHeaders.has(h)),
      ...Array.from(uniqueHeaders).filter(h => !priorityHeaders.includes(h))
    ];
  }, [allHeaders]);
  
  const handleDownload = useCallback(() => {
    // Make sure our updated data with to_be_deleted is downloaded
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
  
  // Toggle showing rows marked for deletion
  const toggleShowMarkedForDeletion = useCallback(() => {
    setShowMarkedForDeletion(prev => !prev);
  }, []);
  
  // Memoize filtered and sorted data
  const filteredAndSortedData = useMemo(() => {
    // Filter by to_be_deleted if needed
    let filteredData = stableData;
    if (!showMarkedForDeletion) {
      filteredData = stableData.filter(row => row.to_be_deleted !== 'true');
    }
    
    // Apply sorting if a column is selected
    if (!sortColumn) return filteredData;
    
    return [...filteredData].sort((a, b) => {
      // Safely access properties that might not exist
      const valueA = a[sortColumn] !== undefined ? a[sortColumn] : '';
      const valueB = b[sortColumn] !== undefined ? b[sortColumn] : '';
      
      const comparison = String(valueA).localeCompare(String(valueB), undefined, { sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [stableData, sortColumn, sortDirection, showMarkedForDeletion]);
  
  const handleHighlightDomain = useCallback((domain: string) => {
    setHighlightedDomain(highlightedDomain === domain ? null : domain);
  }, [highlightedDomain]);
  
  return (
    <Card className="w-full mt-8 shadow-sm animate-fade-in animate-delay-200">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-xl">Preview ({stableData.length} rows processed)</CardTitle>
          <div className="flex flex-wrap items-center gap-4 mt-1">
            {hasAlternativeContacts && (
              <p className="text-sm text-green-600 flex items-center">
                <Users className="h-4 w-4 mr-1" />
                Alternative contacts found and assigned
              </p>
            )}
            {markedForDeletionCount > 0 && (
              <p className="text-sm text-red-600 flex items-center">
                <Trash2 className="h-4 w-4 mr-1" />
                {markedForDeletionCount} rows marked for deletion
              </p>
            )}
          </div>
        </div>
        <div className="flex space-x-2">
          {markedForDeletionCount > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              className={showMarkedForDeletion ? "text-red-600 hover:bg-red-50" : "text-gray-600"}
              onClick={toggleShowMarkedForDeletion}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {showMarkedForDeletion ? "Hide Deleted" : "Show Deleted"}
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            className="text-hyperke-blue hover:bg-hyperke-blue/10"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4 mr-2" />
            Download CSV
          </Button>
        </div>
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
              {filteredAndSortedData.slice(0, visibleRows).map((row, rowIndex) => {
                // Determine if this row should be highlighted based on domain
                const rowDomain = row['cleaned_website'] || '';
                const isHighlighted = highlightedDomain && rowDomain === highlightedDomain;
                const hasAlternativeContact = row['other_dm_name'] && row['other_dm_name'].trim() !== '';
                const isMarkedForDeletion = row['to_be_deleted'] === 'true';
                
                return (
                  <tr 
                    key={rowIndex} 
                    className={`hover:bg-gray-50
                      ${isHighlighted ? 'bg-blue-50' : ''}
                      ${hasAlternativeContact ? 'border-l-2 border-green-300' : ''}
                      ${isMarkedForDeletion ? 'bg-red-50 opacity-70' : ''}`}
                  >
                    {prioritizedHeaders.map(header => {
                      // Handle to_be_deleted column
                      if (header === 'to_be_deleted') {
                        const value = row[header] || 'false';
                        return (
                          <td 
                            key={`${rowIndex}-${header}`} 
                            className={`px-3 py-2 text-xs ${value === 'true' ? 'text-red-600 font-medium' : 'text-green-600'}`}
                          >
                            {value === 'true' ? (
                              <span className="flex items-center">
                                <Trash2 className="h-3 w-3 mr-1" />
                                Yes
                              </span>
                            ) : 'No'}
                          </td>
                        );
                      }
                      
                      // Handle deletion reason
                      if (header === 'deletion_reason') {
                        const value = row[header] || '';
                        return (
                          <td 
                            key={`${rowIndex}-${header}`} 
                            className="px-3 py-2 text-xs text-red-600 italic"
                          >
                            {value}
                          </td>
                        );
                      }
                      
                      // Special handling for other_dm fields
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
        
        {visibleRows < filteredAndSortedData.length && (
          <div className="flex justify-center mt-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleLoadMore}
            >
              Load More ({Math.min(visibleRows + 10, filteredAndSortedData.length) - visibleRows} more rows)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DataPreview;
