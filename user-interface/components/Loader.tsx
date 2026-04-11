import React from 'react';
import { BarLoader } from 'react-spinners';

type Message ={
      message:string 
} 

const Loader = ({message}:Message) => {
  return (
    <div className='fixed inset-0 flex items-center justify-center bg-black/50 z-50'>

      <div className="bg-white flex flex-col items-center justify-center rounded-lg shadow-lg p-6 max-w-sm text-center">

        <h1 className='text-4xl font-bold tracking-tighter text-gray-600 text-center m-4'>{message}</h1>
          <BarLoader/>
      </div>


    </div>
  )
}

export default Loader