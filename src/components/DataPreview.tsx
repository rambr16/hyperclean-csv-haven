
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download } from 'lucide-react';
import { CSVData, downloadCSV } from '@/utils/csvProcessing';

interface DataPreviewProps {
  data: CSVData;
  fileName: string;
}

const DataPreview: React.FC<DataPreviewProps> = ({ data, fileName }) => {
  const [visibleRows, setVisibleRows] = useState(10);
  
  if (!data || data.length === 0) {
    return null;
  }
  
  const headers = Object.keys(data[0]);
  
  const handleDownload = () => {
    downloadCSV(data, `processed_${fileName}`);
  };
  
  const handleLoadMore = () => {
    setVisibleRows(prev => Math.min(prev + 10, data.length));
  };
  
  return (
    <Card className="w-full mt-8 shadow-sm animate-fade-in animate-delay-200">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xl">Preview ({data.length} rows processed)</CardTitle>
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
      <CardContent>
        <div className="table-container">
          <table className="table-data">
            <thead>
              <tr>
                {headers.map(header => (
                  <th key={header}>{header.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.slice(0, visibleRows).map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {headers.map(header => (
                    <td key={`${rowIndex}-${header}`}>{row[header] || '-'}</td>
                  ))}
                </tr>
              ))}
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
              Load More
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DataPreview;
