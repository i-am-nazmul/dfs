"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";
import Loader from "@/components/Loader";
import ErrorAlert from "@/components/ErrorAlert";

export default function SignupPage() {
      const [username, setUsername] = useState("");
      const [email, setEmail] = useState("");
      const [password, setPassword] = useState("");
      const [isSubmitting, setIsSubmitting] = useState(false);
      const [errorMessage, setErrorMessage] = useState<string | null>(null);
      const router = useRouter();

      const handleSignup = async () => {
            if (!username.trim() || !email.trim() || !password.trim()) {
                  setErrorMessage("Please enter all fields.");
                  return;
            }

            setIsSubmitting(true);
            try {
                  const response = await axios.post("/api/signup", {
                        username,
                        email,
                        password,
                  });

                  toast.success(response.data.message || "Signup successful!");
                  router.push("/dashboard");
            } catch (error) {
                  const errorMessage = axios.isAxiosError(error)
                        ? error.response?.data?.message ?? "Server is sleeping"
                        : "Server is sleeping";
                  setErrorMessage(errorMessage);
            } finally {
                  setIsSubmitting(false);
            }
      };

      return (
            <div className="h-screen w-screen p-1">
                  {isSubmitting && <Loader message="Signing up..." />}
                  {errorMessage && <ErrorAlert message={errorMessage} onClose={() => setErrorMessage(null)} />}
                  <div className="w-full h-full rounded-sm border border-gray-400 flex flex-col px-4 py-2 items-center">
                        <div className="w-full">
                              <h1 className="text-7xl font-bold text-gray-700 tracking-tighter ">SignUp</h1>
                        </div>

                        <div className="flex flex-col gap-2 font-mono justify-center items-center w-full h-full ">
                              <input
                                    type="text"
                                    placeholder="Enter the username"
                                    className="outline-none text-2xl px-4 py-2 bg-amber-200 rounded-sm text-black border border-gray-400 tracking-tighter"
                                    onChange={(event) => {
                                          setUsername(event.target.value);
                                    }}
                              />

                              <input
                                    type="text"
                                    placeholder="Enter the email"
                                    className="outline-none text-2xl px-4 py-2 bg-amber-200 rounded-sm text-black border tracking-tighter border-gray-400"
                                    onChange={(event) => {
                                          setEmail(event.target.value);
                                    }}
                              />

                              <input
                                    type="password"
                                    placeholder="Enter the password"
                                    className="outline-none tracking-tighter text-2xl px-4 py-2 bg-amber-200 rounded-sm text-black border border-gray-400"
                                    onChange={(event) => {
                                          setPassword(event.target.value);
                                    }}
                              />

                              <button
                                    className="bg-emerald-900 px-4 py-1 text-white font-semibold tracking-tighter text-2xl cursor-pointer hover:bg-emerald-950 rounded-lg sm:font-normal sm:text-4xl sm:py-2 disabled:opacity-70"
                                    onClick={handleSignup}
                                    disabled={isSubmitting}
                              >
                                    {isSubmitting ? "Signing up..." : "Signup"}
                              </button>

                              <button
                                    className="bg-emerald-900 text-white px-3 py-1 mt-2 cursor-pointer font-medium hover:bg-emerald-950 rounded-lg sm:py-2 sm:font-medium sm:text-2xl"
                                    onClick={() => {
                                          router.push("/login");
                                    }}
                              >
                                    Already have an account ? Login Instead
                              </button>
                        </div>
                  </div>
            </div>
      );
}