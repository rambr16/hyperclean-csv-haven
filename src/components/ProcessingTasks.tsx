
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import TaskItem from './TaskItem';
import { ProcessingTask } from '@/utils/csvProcessing';

interface ProcessingTasksProps {
  tasks: ProcessingTask[];
}

const ProcessingTasks: React.FC<ProcessingTasksProps> = ({ tasks }) => {
  if (tasks.length === 0) {
    return null;
  }
  
  return (
    <Card className="w-full mt-8 shadow-sm animate-fade-in animate-delay-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl">Processing Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProcessingTasks;
