"use client"
import React from "react";
// import axios from "axios";
import { useRouter } from "next/navigation";
// import { useIsLoading } from "@/store/store";
import Loader from "@/components/Loader";
import toast from "react-hot-toast";



export default function SignupPage(){
      const [username,setUsername]=React.useState('');
      const [email,setEmail]=React.useState('');
      const [password,setPassword]=React.useState('');
      // const {isLoading,setIsLoading}=useIsLoading();
      const router = useRouter();

      // const Signup = async () => {
      //       if(!username || !email || !password){
      //             toast.error("Please enter all the fields!");
      //             return ;

      //       }
      //       setIsLoading(true);
      //       try {
      //       const request = await axios.post('/api/signup', {
      //             username,
      //             email,
      //             password
      //       });
      //       if(request.status === 201){
      //             router.push("/dashboard");
      //       }
      
      //       } catch (error:unknown) {
      //             console.error("Signup error",error);
      //       }
                  
      // };
      // const Login = () =>{
      //       router.push('/login');
            
      // }



      return(
            <div className="h-screen w-screen p-1">
                  {<div className="w-full h-full rounded-sm border border-gray-400 flex flex-col px-4 py-2 items-center">
                        <div className="w-full">
                              <h1 className="text-7xl font-bold text-gray-700 tracking-tighter ">
                                    SignUp
                              </h1>
                        </div>
                        <div className="flex flex-col gap-2 font-mono justify-center items-center w-full h-full ">

                              <input type="text" 
                              placeholder="Enter the username" 
                              className="outline-none text-2xl px-4 py-2 bg-amber-200 rounded-sm text-black border border-gray-400 tracking-tighter"
                              onChange={(e)=>{setUsername(e.target.value)}} />

                              <input type="text" placeholder="Enter the email" className="outline-none text-2xl px-4 py-2 bg-amber-200 rounded-sm text-black border tracking-tighter border-gray-400"
                              onChange={(e)=>{setEmail(e.target.value)}}/>


                              <input type="password" 
                              placeholder="Enter the password" className="outline-none tracking-tighter text-2xl px-4 py-2 bg-amber-200 rounded-sm text-black border border-gray-400"
                              onChange={(e)=>{setPassword(e.target.value)}}/>

                              <button className="bg-emerald-900 px-4 py-1 text-white font-semibold tracking-tighter text-2xl cursor-pointer hover:bg-emerald-950 rounded-lg sm:font-normal
                              sm:text-4xl
                              sm:py-2"
                              >Signup</button>

                              <button className="bg-emerald-900 text-white px-3 py-1 mt-2 cursor-pointer 
                              font-medium hover:bg-emerald-950 rounded-lg 
                              sm:py-2 sm:font-medium sm:text-2xl" >Already have an account ? Login Instead</button>
                        </div>
                  </div>}
            </div>
      )

}