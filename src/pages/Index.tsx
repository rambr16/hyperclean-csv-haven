
import React, { useEffect } from 'react';
import LoginForm from '@/components/LoginForm';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Index: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-white to-hyperke-gray">
      <div className="mb-8 text-center animate-fade-in">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-hyperke-darkBlue to-hyperke-blue bg-clip-text text-transparent">
          Hyperke CSV Cleaner
        </h1>
        <p className="text-gray-600 mt-2">Clean, process, and enhance your CSV files</p>
      </div>
      
      <LoginForm />
      
      <div className="mt-8 text-center text-sm text-gray-500 max-w-md animate-fade-in animate-delay-300">
        <p>
          Securely process your CSV files with our advanced cleaning and enhancement tools.
        </p>
      </div>
    </div>
  );
};

export default Index;
