
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import FileUpload from '@/components/FileUpload';
import ColumnMapping from '@/components/ColumnMapping';
import ProcessingTasks from '@/components/ProcessingTasks';
import DataPreview from '@/components/DataPreview';
import { CSVData, ProcessingTask, processDomainOnlyCSV, processSingleEmailCSV, processMultiEmailCSV, inferCSVType } from '@/utils/csvProcessing';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

const Dashboard: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  const [tasks, setTasks] = useState<ProcessingTask[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<CSVData>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvFileType, setCsvFileType] = useState<'domain-only' | 'single-email' | 'multi-email' | 'unknown'>('unknown');
  const [mappedColumns, setMappedColumns] = useState<Record<string, string>>({});
  const [showMapping, setShowMapping] = useState(false);
  const [previewData, setPreviewData] = useState<CSVData | null>(null);
  
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);
  
  const handleReset = () => {
    setTasks([]);
    setCsvHeaders([]);
    setCsvData([]);
    setCsvFileName('');
    setCsvFileType('unknown');
    setMappedColumns({});
    setShowMapping(false);
    setPreviewData(null);
    toast.info('Application state has been reset');
  };
  
  const handleFileUploaded = (
    fileName: string, 
    headers: string[], 
    data: CSVData,
    fileType: 'domain-only' | 'single-email' | 'multi-email' | 'unknown'
  ) => {
    console.log(`File uploaded: ${fileName}, type: ${fileType}, rows: ${data.length}`);
    setCsvHeaders(headers);
    setCsvData(data);
    setCsvFileName(fileName);
    setCsvFileType(fileType);
    setShowMapping(true);
    setPreviewData(null);
  };
  
  const handleColumnsMapped = (mappedColumns: Record<string, string>) => {
    console.log('Columns mapped:', mappedColumns);
    setMappedColumns(mappedColumns);
    setShowMapping(false);
    
    // Start processing after mapping
    const taskId = uuidv4();
    const newTask: ProcessingTask = {
      id: taskId,
      fileName: csvFileName,
      uploadTime: new Date().toISOString(),
      status: 'pending',
      progress: 0,
      totalRows: csvData.length,
      processedRows: 0,
      type: csvFileType as 'domain-only' | 'single-email' | 'multi-email' // Fix the type error
    };
    
    setTasks(prev => [...prev, newTask]);
    
    setTimeout(() => {
      processCSV(taskId, mappedColumns);
    }, 500);
  };
  
  const updateTaskProgress = (taskId: string, progressData: Partial<ProcessingTask>) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, ...progressData } : task
    ));
  };
  
  const processCSV = async (taskId: string, mappedColumns: Record<string, string>) => {
    // Update task to processing
    updateTaskProgress(taskId, { 
      status: 'processing',
      progress: 0,
      processedRows: 0
    });
    
    try {
      let result: CSVData = [];
      
      if (csvFileType === 'domain-only') {
        result = await processDomainOnlyCSV(
          csvData,
          mappedColumns['website'],
          (processed, total) => {
            const progress = processed / total;
            updateTaskProgress(taskId, { 
              progress, 
              processedRows: processed,
              totalRows: total
            });
          }
        );
      } else if (csvFileType === 'single-email') {
        result = await processSingleEmailCSV(
          csvData,
          mappedColumns['email'],
          mappedColumns['website'] || '',
          mappedColumns['company'] || '',
          (processed, total, stage) => {
            console.log(`Processing stage: ${stage}, ${processed}/${total}`);
            const progress = processed / total;
            updateTaskProgress(taskId, { 
              progress, 
              processedRows: processed,
              totalRows: total
            });
          }
        );
      } else if (csvFileType === 'multi-email') {
        result = await processMultiEmailCSV(
          csvData,
          mappedColumns,
          (processed, total, stage) => {
            console.log(`Processing stage: ${stage}, ${processed}/${total}`);
            const progress = processed / total;
            updateTaskProgress(taskId, { 
              progress, 
              processedRows: processed,
              totalRows: total
            });
          }
        );
      }
      
      console.log(`Processing complete: ${result.length} rows in final result`);
      
      // Update task to complete
      updateTaskProgress(taskId, { 
        status: 'complete',
        progress: 1,
        processedRows: result.length,
        totalRows: csvData.length,  // Keep the original total for reference
        result,
        mappedColumns
      });
      
      // Show preview of the latest processed task
      setPreviewData(result);
      
      toast.success(`CSV processing completed. Processed ${csvData.length} rows, resulted in ${result.length} rows after cleaning.`);
    } catch (error) {
      console.error('Error processing CSV:', error);
      updateTaskProgress(taskId, { status: 'error' });
      toast.error('An error occurred while processing the CSV');
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-hyperke-gray pb-16">
      <Navbar onReset={handleReset} />
      
      <div className="max-w-7xl mx-auto px-4 pt-24">
        <div className="grid grid-cols-1 gap-8">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">CSV Upload</h2>
            <FileUpload onFileUploaded={handleFileUploaded} />
          </div>
          
          {showMapping && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Column Mapping</h2>
              <ColumnMapping 
                headers={csvHeaders} 
                fileType={csvFileType} 
                onColumnsMapped={handleColumnsMapped} 
              />
            </div>
          )}
          
          <ProcessingTasks tasks={tasks} />
          
          {previewData && (
            <DataPreview data={previewData} fileName={csvFileName} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
