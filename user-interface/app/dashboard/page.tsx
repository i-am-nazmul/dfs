"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import axios from "axios";

interface File {
  fileId: string;
  storedFilename?: string;
  filename: string;
  fileSize: number;
  fileType: string;
  uploadDate: string;
}

interface ChunkInfo {
  chunkIndex: number;
  chunkSize: number;
  workers: string[];
}

interface FileChunkDetails {
  file: {
    fileId: string;
    filename: string;
    storedFilename: string;
    fileSize: number;
    totalChunks: number;
    uploadDate: string;
  };
  replicationFactor: number;
  chunkCount: number;
  isComplete: boolean;
  hasRequiredReplicas: boolean;
  chunks: ChunkInfo[];
}

export default function DashboardPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const [username, setUsername] = useState("User");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileChunkDetails, setFileChunkDetails] = useState<FileChunkDetails | null>(null);
  const [isLoadingChunkInfo, setIsLoadingChunkInfo] = useState(false);

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

  const handleDeleteFile = async (file: File) => {
    const toastId = toast.loading("Deleting file...");

    try {
      const response = await axios.delete("/api/files", {
        data: { storedFilename: file.storedFilename, filename: file.filename },
        withCredentials: true,
      });

      setFiles(response.data.files || []);
      toast.success(response.data.message || "File deleted successfully.", { id: toastId });
    } catch (error) {
      const errorMessage = axios.isAxiosError(error)
        ? error.response?.data?.message ?? "File deletion failed."
        : "Unable to reach server.";
      toast.error(errorMessage, { id: toastId });
    }
  };

  const handleOpenFileDetails = async (file: File) => {
    setSelectedFile(file);
    setFileChunkDetails(null);
    setIsLoadingChunkInfo(true);

    try {
      const response = await axios.get("/api/files/chunk-info", {
        params: {
          storedFilename: file.storedFilename,
          filename: file.filename,
        },
        withCredentials: true,
      });

      setFileChunkDetails(response.data);
    } catch (error) {
      const errorMessage = axios.isAxiosError(error)
        ? error.response?.data?.message ?? "Failed to load chunk information."
        : "Unable to reach server.";
      toast.error(errorMessage);
    } finally {
      setIsLoadingChunkInfo(false);
    }
  };

  const handleCloseFileDetails = () => {
    setSelectedFile(null);
    setFileChunkDetails(null);
    setIsLoadingChunkInfo(false);
  };

  const handleDownloadFile = async (file: File) => {
    const toastId = toast.loading("Preparing download...");

    try {
      const response = await axios.get("/api/files/download", {
        params: {
          storedFilename: file.storedFilename,
          filename: file.filename,
        },
        responseType: "blob",
        withCredentials: true,
      });

      const contentDisposition = response.headers["content-disposition"] as string | undefined;
      let downloadName = file.filename;
      if (contentDisposition) {
        const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
        const asciiMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
        if (utf8Match?.[1]) {
          downloadName = decodeURIComponent(utf8Match[1]);
        } else if (asciiMatch?.[1]) {
          downloadName = asciiMatch[1];
        }
      }

      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute("download", downloadName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);

      toast.success(`Downloaded ${downloadName}`, { id: toastId });
    } catch (error) {
      const errorMessage = axios.isAxiosError(error)
        ? error.response?.data?.message ?? "File download failed."
        : "Unable to reach server.";
      toast.error(errorMessage, { id: toastId });
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
                  className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors cursor-pointer"
                  onClick={() => handleOpenFileDetails(file)}
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
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDownloadFile(file);
                    }}
                    className="mt-2 mr-3 text-xs font-medium text-emerald-700 hover:text-emerald-800"
                  >
                    Download
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteFile(file);
                    }}
                    className="mt-2 text-xs font-medium text-red-600 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={handleCloseFileDetails}
        >
          <div
            className="w-full max-w-4xl rounded-xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-xl font-bold text-gray-800">File Chunk Details</h3>
              <button
                onClick={handleCloseFileDetails}
                className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-100"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-1 gap-3 text-sm text-gray-700 md:grid-cols-3">
                <div>
                  <p className="font-semibold">Filename</p>
                  <p className="truncate" title={selectedFile.filename}>{selectedFile.filename}</p>
                </div>
                <div>
                  <p className="font-semibold">Size</p>
                  <p>{formatFileSize(selectedFile.fileSize)}</p>
                </div>
                <div>
                  <p className="font-semibold">Uploaded</p>
                  <p>{formatDate(selectedFile.uploadDate)}</p>
                </div>
              </div>

              {isLoadingChunkInfo ? (
                <p className="py-10 text-center text-gray-500">Loading chunk metadata...</p>
              ) : !fileChunkDetails ? (
                <p className="py-10 text-center text-red-600">Unable to load chunk details.</p>
              ) : (
                <>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                    <p>
                      Chunks: <span className="font-semibold">{fileChunkDetails.chunkCount}</span> | Replication factor:{" "}
                      <span className="font-semibold">{fileChunkDetails.replicationFactor}</span> | Complete:{" "}
                      <span className={`font-semibold ${fileChunkDetails.isComplete ? "text-emerald-700" : "text-amber-700"}`}>
                        {fileChunkDetails.isComplete ? "Yes" : "No"}
                      </span> | Fault-tolerant:{" "}
                      <span className={`font-semibold ${fileChunkDetails.hasRequiredReplicas ? "text-emerald-700" : "text-red-600"}`}>
                        {fileChunkDetails.hasRequiredReplicas ? "Yes" : "No"}
                      </span>
                    </p>
                  </div>

                  <div className="max-h-96 overflow-auto rounded-lg border border-gray-200">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 bg-gray-100 text-gray-700">
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold">Chunk #</th>
                          <th className="px-4 py-2 text-left font-semibold">Chunk Size</th>
                          <th className="px-4 py-2 text-left font-semibold">Stored Workers</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fileChunkDetails.chunks.map((chunk) => (
                          <tr key={chunk.chunkIndex} className="border-t border-gray-200 hover:bg-gray-50">
                            <td className="px-4 py-2">{chunk.chunkIndex}</td>
                            <td className="px-4 py-2">{formatFileSize(chunk.chunkSize)}</td>
                            <td className="px-4 py-2">{chunk.workers.join(", ")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
