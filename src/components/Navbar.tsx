
import React from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { LogOut, RefreshCw, ExternalLink } from 'lucide-react';

interface NavbarProps {
  onReset: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onReset }) => {
  const { logout } = useAuth();
  
  const handleOpenSplitCSV = () => {
    window.open('https://splitcsv.netlify.app', '_blank', 'noopener,noreferrer');
  };
  
  return (
    <div className="w-full bg-white/80 backdrop-blur-md border-b border-gray-200 fixed top-0 z-50 py-3 px-6 shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-semibold bg-gradient-to-r from-hyperke-darkBlue to-hyperke-blue bg-clip-text text-transparent">
            Hyperke CSV Cleaner
          </h1>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="text-gray-600 hover:text-hyperke-blue hover:border-hyperke-blue transition-colors"
            onClick={onReset}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            className="text-gray-600 hover:text-hyperke-blue hover:border-hyperke-blue transition-colors"
            onClick={handleOpenSplitCSV}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Split CSV
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            className="text-gray-600 hover:text-hyperke-blue hover:border-hyperke-blue transition-colors"
            onClick={logout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
