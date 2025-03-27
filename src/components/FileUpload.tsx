
import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import { parseCSV, inferCSVType } from '@/utils/csvProcessing';
import { Card, CardContent } from '@/components/ui/card';

interface FileUploadProps {
  onFileUploaded: (
    fileName: string, 
    headers: string[], 
    data: Record<string, string>[],
    fileType: 'domain-only' | 'single-email' | 'multi-email' | 'unknown'
  ) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileUploaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csvContent = event.target?.result as string;
        const { headers, data } = parseCSV(csvContent);
        
        if (headers.length === 0) {
          toast.error('The CSV file appears to be empty or invalid');
          return;
        }
        
        const fileType = inferCSVType(headers);
        
        if (fileType === 'unknown') {
          toast.warning('Could not determine CSV type. Please ensure it contains email or website columns.');
        } else {
          toast.success(`CSV file uploaded successfully: ${fileType === 'domain-only' ? 'Website domains' : fileType === 'single-email' ? 'Single email' : 'Multiple emails'}`);
        }
        
        onFileUploaded(file.name, headers, data, fileType);
      } catch (error) {
        console.error('Error reading CSV:', error);
        toast.error('Error reading the CSV file');
      }
    };

    reader.onerror = () => {
      toast.error('Error reading the file');
    };

    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      processFile(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card className="w-full shadow-sm">
      <CardContent className="p-6">
        <div
          className={`drop-zone ${isDragging ? 'drop-zone-active' : ''} flex flex-col items-center justify-center cursor-pointer transition-all duration-300 animate-fade-in`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          <div className="h-16 w-16 bg-hyperke-lightBlue/10 rounded-full flex items-center justify-center mb-4">
            <svg
              className="h-8 w-8 text-hyperke-blue"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              ></path>
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-700 mb-1">Drag & drop a CSV file here, or click to select</h3>
          <p className="text-sm text-gray-500">Supports CSV files only</p>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            accept=".csv"
            className="hidden"
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default FileUpload;
