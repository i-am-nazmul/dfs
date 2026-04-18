import React from 'react';

type ErrorAlertProps = {
  message: string;
  onClose: () => void;
}

const ErrorAlert = ({ message, onClose }: ErrorAlertProps) => {
  return (
    <div className='fixed inset-0 flex items-center justify-center bg-black/50 z-50'>
      <div className="bg-white flex flex-col items-center justify-center rounded-lg shadow-lg p-6 max-w-sm text-center">
        <h1 className='text-4xl font-bold tracking-tighter text-gray-800 text-center m-4'>{message}</h1>
        <button
          onClick={onClose}
          className="bg-emerald-900 px-6 py-2 text-white font-semibold tracking-tighter text-xl cursor-pointer hover:bg-emerald-950 rounded-lg"
        >
          Ok
        </button>
      </div>
    </div>
  )
}

export default ErrorAlert
