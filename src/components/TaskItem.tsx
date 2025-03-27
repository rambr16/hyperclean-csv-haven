
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, ChevronDown, ChevronUp } from 'lucide-react';
import { ProcessingTask } from '@/utils/csvProcessing';
import { downloadCSV } from '@/utils/csvProcessing';

interface TaskItemProps {
  task: ProcessingTask;
}

const TaskItem: React.FC<TaskItemProps> = ({ task }) => {
  const [expanded, setExpanded] = React.useState(false);
  
  const handleDownload = () => {
    if (task.result) {
      downloadCSV(task.result, `processed_${task.fileName}`);
    }
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: true,
    });
  };
  
  const renderCountInfo = () => {
    if (task.status === 'complete' && task.result) {
      return (
        <span className="text-sm text-gray-600">
          {task.result.length} rows in result 
          {task.originalRowCount && task.result.length !== task.originalRowCount && (
            <span className="text-xs text-gray-500 ml-2">(from {task.originalRowCount} original rows)</span>
          )}
        </span>
      );
    }
    
    return (
      <span className="text-sm text-gray-600">
        {task.processedRows} / {task.totalRows} rows
      </span>
    );
  };
  
  // Get information about available columns in the result
  const getResultInfo = () => {
    if (!task.result || task.result.length === 0) return null;
    
    const sample = task.result[0];
    const columns = Object.keys(sample);
    const totalRows = task.result.length;
    
    // Count how many rows have other_dm_name with values
    const otherDMCount = task.result.filter(row => row.other_dm_name && row.other_dm_name.trim() !== '').length;
    
    return (
      <div className="mt-3 text-xs text-gray-600 space-y-1">
        <p>Result contains {columns.length} columns including:</p>
        <ul className="list-disc pl-5 space-y-1">
          {columns.includes('cleaned_website') && (
            <li>Cleaned website domains</li>
          )}
          {columns.includes('mx_provider') && (
            <li>Email MX providers</li>
          )}
          {columns.includes('cleaned_company_name') && (
            <li>Cleaned company names</li>
          )}
          {columns.includes('other_dm_name') && (
            <li>{otherDMCount > 0 ? 
              `Alternative contacts (${otherDMCount} rows)` : 
              'Alternative contacts column (no alternatives found)'}</li>
          )}
        </ul>
        
        {otherDMCount > 0 && (
          <div className="mt-2 p-2 bg-green-50 rounded border border-green-100">
            <p className="font-medium text-green-700">Alternative Contact Example:</p>
            {task.result.find(row => row.other_dm_name && row.other_dm_name.trim() !== '') && (
              <div className="mt-1 text-xs text-green-800">
                <p>Contact with alternative: {
                  task.result.find(row => row.other_dm_name && row.other_dm_name.trim() !== '')?.other_dm_name
                }</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };
  
  return (
    <Card className={`w-full mb-4 overflow-hidden transition-all duration-300 ${
      task.status === 'complete' ? 'border-green-300 shadow-md' : 
      task.status === 'error' ? 'border-red-300' : 'border-gray-200'
    } animate-fade-in`}>
      <CardContent className="p-4">
        <div className="flex flex-col space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-800 truncate max-w-md">
              {task.fileName}
              <span className="text-xs text-gray-500 ml-2">({task.type || 'unknown'})</span>
            </h3>
            <span className="text-xs text-gray-500">Uploaded: {formatDate(task.uploadTime)}</span>
          </div>
          
          {task.status === 'processing' && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                {renderCountInfo()}
                <span className="text-gray-600">
                  {Math.round((task.progress || 0) * 100)}%
                </span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-hyperke-blue transition-all duration-300 rounded-full"
                  style={{ width: `${(task.progress || 0) * 100}%` }}
                ></div>
              </div>
            </div>
          )}
          
          {task.status === 'pending' && (
            <p className="text-sm text-gray-600">Waiting to start processing...</p>
          )}
          
          {task.status === 'error' && (
            <p className="text-sm text-red-500">Error processing file</p>
          )}
          
          {task.status === 'complete' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600">Processing complete</p>
                  {renderCountInfo()}
                </div>
                <div className="flex space-x-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setExpanded(!expanded)}
                    className="text-gray-500"
                  >
                    {expanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-hyperke-blue hover:bg-hyperke-blue/10 hover:text-hyperke-darkBlue"
                    onClick={handleDownload}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Result
                  </Button>
                </div>
              </div>
              
              {expanded && getResultInfo()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TaskItem;
