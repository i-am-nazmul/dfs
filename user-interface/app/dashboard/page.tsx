"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import axios from "axios";

interface File {
  fileId: string;
  filename: string;
  fileSize: number;
  fileType: string;
  uploadDate: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const [username, setUsername] = useState("User");

  // Fetch user files on mount
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await axios.get("/api/files", {
          withCredentials: true,
        });
        setUsername(response.data.username || "User");
        setFiles(response.data.files || []);
      } catch (error) {
        console.error("Failed to fetch files:", error);
        setFiles([]);
      } finally {
        setIsLoadingFiles(false);
      }
    };

    fetchFiles();
  }, []);

  const handleLogout = () => {
    toast.success("Logged out successfully!");
    router.push("/signup");
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const toastId = toast.loading("Uploading file...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await axios.post("/api/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        withCredentials: true,
      });

      toast.success(response.data.message || "File uploaded successfully!", { id: toastId });

      // Refresh file list
      const filesResponse = await axios.get("/api/files", {
        withCredentials: true,
      });
      setFiles(filesResponse.data.files || []);
    } catch (error) {
      const errorMessage = axios.isAxiosError(error)
        ? error.response?.data?.message ?? "File upload failed."
        : "Unable to reach server.";
      toast.error(errorMessage, { id: toastId });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <main className="min-h-screen w-screen bg-linear-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="flex justify-between items-center px-8 py-6 bg-white shadow-md">
        <h1 className="text-4xl font-bold text-gray-800 tracking-tight">
          DFS with <span className="text-emerald-700">Fault tolerance</span>
        </h1>
        <button
          onClick={handleLogout}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-semibold text-lg transition-colors duration-200"
        >
          Logout
        </button>
      </div>

      {/* Main Content */}
      <div className="flex gap-6 px-8 py-8 min-h-[calc(100vh-100px)]">
        {/* Left Side - Upload Section */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-center mb-8">
            <p className="text-3xl font-semibold text-gray-800 mb-2">Hello, {username}</p>
            <p className="text-gray-600 text-lg">Upload files to your Distributed File System</p>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            className="hidden"
            disabled={isUploading}
          />

          <button
            onClick={handleFileSelect}
            disabled={isUploading}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 disabled:cursor-not-allowed text-white px-8 py-4 rounded-lg font-semibold text-2xl transition-colors duration-200 shadow-lg hover:shadow-xl"
          >
            {isUploading ? "⏳ Uploading..." : "📤 Upload File"}
          </button>
        </div>

        {/* Right Side - Files List */}
        <div className="w-80 bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Your Files</h2>

          {isLoadingFiles ? (
            <p className="text-gray-500 text-center py-8">Loading files...</p>
          ) : files.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">📁 No files uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto">
              {files.map((file) => (
                <div
                  key={file.fileId}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
                >
                  <p className="font-semibold text-gray-800 text-sm truncate" title={file.filename}>
                    {file.filename}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatFileSize(file.fileSize)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDate(file.uploadDate)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}