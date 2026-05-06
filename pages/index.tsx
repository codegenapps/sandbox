import React from 'react';
import Head from 'next/head';

export default function Home() {
  return (
    <div className='flex flex-col items-center justify-center min-h-[80vh]'>
      <div className='text-center space-y-4'>
        <div className='w-16 h-16 bg-blue-600/20 border border-blue-500 rounded-2xl mx-auto flex items-center justify-center animate-pulse'>
          <span className='font-black italic text-blue-500'>CGA</span>
        </div>
        <h1 className='text-xl font-bold uppercase opacity-50'>Shadow Node Ready</h1>
      </div>
    </div>
  );
}