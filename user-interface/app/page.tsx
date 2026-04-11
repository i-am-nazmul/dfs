"use client";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function Home() {
  const router = useRouter();

  const handleGetStarted = function(){
    router.push('/signup');
  }
  const handleLogin = function(){
    router.push('/login');
  }
  return (
  <div className="h-screen w-screen overflow-hidden">
    <div className="w-full h-screen rounded-sm flex flex-col items-center justify-center text-center px-4 py-6 sm:px-8 sm:py-10">

      {/* Heading */}
      <h1 className="font-bold text-gray-700 tracking-tighter text-3xl sm:text-5xl lg:text-9xl mt-6 sm:mt-12">
        DFS with Fault Tolerance
      </h1>


      {/* Buttons */}
      <div className="flex gap-4 sm:gap-10 mt-6 sm:mt-10">
        <button className="cursor-pointer bg-purple-800 rounded font-semibold text-white px-4 py-2 text-lg sm:px-6 sm:py-3 sm:text-2xl hover:bg-purple-700"
          onClick={handleGetStarted}
        >
          Get Started
        </button>

        <button
          className="cursor-pointer bg-purple-800 rounded font-semibold text-white 
                     px-4 py-2 text-lg 
                     sm:px-6 sm:py-3 sm:text-2xl 
                     hover:bg-purple-700"
          onClick={handleLogin}
        >
          Login
        </button>

      </div>

    </div>
  </div>
);

}