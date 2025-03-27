
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download } from 'lucide-react';
import { ProcessingTask } from '@/utils/csvProcessing';
import { downloadCSV } from '@/utils/csvProcessing';

interface TaskItemProps {
  task: ProcessingTask;
}

const TaskItem: React.FC<TaskItemProps> = ({ task }) => {
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
  
  return (
    <Card className={`w-full mb-4 overflow-hidden transition-all duration-300 ${
      task.status === 'complete' ? 'border-green-300 shadow-md' : 
      task.status === 'error' ? 'border-red-300' : 'border-gray-200'
    } animate-fade-in`}>
      <CardContent className="p-4">
        <div className="flex flex-col space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-800 truncate max-w-md">{task.fileName}</h3>
            <span className="text-xs text-gray-500">Uploaded: {formatDate(task.uploadTime)}</span>
          </div>
          
          {task.status === 'processing' && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {task.processedRows} / {task.totalRows} rows
                </span>
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
            <div className="flex items-center justify-between">
              <p className="text-sm text-green-600">Processing complete</p>
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
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TaskItem;
