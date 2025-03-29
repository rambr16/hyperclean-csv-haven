
import React from 'react';
import { ProcessingTask } from '@/utils/csvProcessing';
import { Progress } from '@/components/ui/progress';
import { Clock, RefreshCw, CheckCircle, XCircle, Users, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface TaskItemProps {
  task: ProcessingTask;
}

const TaskItem: React.FC<TaskItemProps> = ({ task }) => {
  const formatTimestamp = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (error) {
      return 'unknown time';
    }
  };
  
  // Calculate stats for marked for deletion rows
  const markedForDeletionCount = task.result 
    ? task.result.filter(row => row.to_be_deleted === 'true').length 
    : 0;
  
  // Calculate stats for alternative contacts
  const alternativeContactsCount = task.result 
    ? task.result.filter(row => row.other_dm_name && row.other_dm_name.trim() !== '').length 
    : 0;
  
  const validRowsCount = task.result 
    ? task.result.filter(row => row.to_be_deleted !== 'true').length 
    : 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-medium text-gray-900">{task.fileName}</h3>
          <p className="text-sm text-gray-500">
            Uploaded {formatTimestamp(task.uploadTime)}
          </p>
        </div>
        
        <div className="flex items-center space-x-1">
          {task.status === 'pending' && <Clock className="h-5 w-5 text-gray-400" />}
          {task.status === 'processing' && <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />}
          {task.status === 'complete' && <CheckCircle className="h-5 w-5 text-green-500" />}
          {task.status === 'error' && <XCircle className="h-5 w-5 text-red-500" />}
          <span className="text-sm capitalize">
            {task.status === 'complete' ? 'Completed' : task.status}
          </span>
        </div>
      </div>
      
      <Progress value={task.progress * 100} className="h-2 mb-2" />
      
      <div className="text-xs text-gray-600 flex items-center justify-between">
        <span>{task.processedRows} of {task.totalRows} rows processed</span>
        <span>{Math.round(task.progress * 100)}%</span>
      </div>
      
      {task.status === 'complete' && task.result && (
        <div className="mt-3 text-xs">
          <div className="flex flex-wrap gap-2">
            {markedForDeletionCount > 0 && (
              <span className="flex items-center text-red-600 bg-red-50 px-2 py-1 rounded">
                <Trash2 className="h-3 w-3 mr-1" />
                {markedForDeletionCount} rows marked for deletion
              </span>
            )}
            
            {alternativeContactsCount > 0 && (
              <span className="flex items-center text-green-600 bg-green-50 px-2 py-1 rounded">
                <Users className="h-3 w-3 mr-1" />
                {alternativeContactsCount} with alternative contacts
              </span>
            )}
            
            <span className="text-gray-600 bg-gray-100 px-2 py-1 rounded">
              {validRowsCount} valid rows from {task.originalRowCount || task.totalRows} original
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskItem;
