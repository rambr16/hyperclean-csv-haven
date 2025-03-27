
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, ChevronDown, ChevronUp, Users } from 'lucide-react';
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
    
    // Count how many rows have other_dm_name with values
    const otherDMCount = task.result.filter(row => 
      row.other_dm_name && 
      row.other_dm_name.trim() !== '' && 
      row.other_dm_name !== undefined
    ).length;
    
    // Find a good example of other_dm_name to display
    const exampleRow = task.result.find(row => 
      row.other_dm_name && 
      row.other_dm_name.trim() !== '' && 
      row.other_dm_name !== undefined
    );
    
    // Find an example pair to visualize round-robin assignment
    let roundRobinExample = null;
    if (exampleRow && task.result.length > 1) {
      // Find the row that has the current example's name as other_dm_name
      const matchingRow = task.result.find(row => 
        row.other_dm_name === exampleRow.fullName || 
        row.other_dm_name === exampleRow.full_name || 
        (exampleRow.firstName && exampleRow.lastName && 
          row.other_dm_name === `${exampleRow.firstName} ${exampleRow.lastName}`) ||
        (exampleRow.first_name && exampleRow.last_name && 
          row.other_dm_name === `${exampleRow.first_name} ${exampleRow.last_name}`)
      );
      
      if (matchingRow) {
        roundRobinExample = {
          person1: {
            name: exampleRow.fullName || exampleRow.full_name || 
                `${exampleRow.firstName || exampleRow.first_name || ''} ${exampleRow.lastName || exampleRow.last_name || ''}`.trim(),
            email: exampleRow.email,
            title: exampleRow.title || '',
            altContact: exampleRow.other_dm_name
          },
          person2: {
            name: matchingRow.fullName || matchingRow.full_name || 
                `${matchingRow.firstName || matchingRow.first_name || ''} ${matchingRow.lastName || matchingRow.last_name || ''}`.trim(),
            email: matchingRow.email,
            title: matchingRow.title || '',
            altContact: matchingRow.other_dm_name
          }
        };
      }
    }
    
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
            <li className="flex items-center">
              <Users className="h-3 w-3 mr-1 text-hyperke-blue" />
              <span className="font-medium text-hyperke-blue">
                Alternative contacts 
                {otherDMCount > 0 ? ` (${otherDMCount} contacts found)` : ' (none found)'}
              </span>
            </li>
          )}
        </ul>
        
        {otherDMCount > 0 && exampleRow && (
          <div className="mt-2 p-2 bg-green-50 rounded border border-green-100">
            <p className="font-medium text-green-700">Alternative Contact Example:</p>
            <div className="mt-1 text-xs text-green-800 space-y-1">
              <p><b>Email:</b> {exampleRow.email}</p>
              <p><b>Name:</b> {exampleRow.fullName || exampleRow.full_name || 
                `${exampleRow.firstName || exampleRow.first_name || ''} ${exampleRow.lastName || exampleRow.last_name || ''}`.trim()}</p>
              <p><b>Alternative Contact:</b> {exampleRow.other_dm_name}</p>
              {exampleRow.other_dm_title && <p><b>Alt. Title:</b> {exampleRow.other_dm_title}</p>}
              {exampleRow.other_dm_email && <p><b>Alt. Email:</b> {exampleRow.other_dm_email}</p>}
            </div>
          </div>
        )}
        
        {roundRobinExample && (
          <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-100">
            <p className="font-medium text-blue-700">Round-Robin Assignment Example:</p>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="text-xs text-blue-800 space-y-1 p-2 bg-white rounded">
                <p><b>Person 1:</b> {roundRobinExample.person1.name}</p>
                <p><b>Email:</b> {roundRobinExample.person1.email}</p>
                {roundRobinExample.person1.title && <p><b>Title:</b> {roundRobinExample.person1.title}</p>}
                <p className="border-t border-blue-100 pt-1 mt-1">
                  <b>Alt Contact:</b> {roundRobinExample.person1.altContact}
                </p>
              </div>
              <div className="text-xs text-blue-800 space-y-1 p-2 bg-white rounded">
                <p><b>Person 2:</b> {roundRobinExample.person2.name}</p>
                <p><b>Email:</b> {roundRobinExample.person2.email}</p>
                {roundRobinExample.person2.title && <p><b>Title:</b> {roundRobinExample.person2.title}</p>}
                <p className="border-t border-blue-100 pt-1 mt-1">
                  <b>Alt Contact:</b> {roundRobinExample.person2.altContact}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {columns.includes('other_dm_name') && otherDMCount === 0 && (
          <div className="mt-2 p-2 bg-yellow-50 rounded border border-yellow-100">
            <p className="text-yellow-700">
              No alternative contacts were found. This can happen when:
            </p>
            <ul className="list-disc pl-5 mt-1 text-yellow-800">
              <li>There's only one contact per domain</li>
              <li>Contact names are missing</li>
              <li>Generic emails like info@, sales@, etc.</li>
            </ul>
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
