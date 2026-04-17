"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
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

  const loadFiles = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

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
      await loadFiles();
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
      <div className="fixed right-8 top-6 z-20">
        <button
          onClick={handleLogout}
          className="cursor-pointer rounded-lg bg-red-600 px-6 py-2 text-lg font-semibold text-white transition-all duration-200 hover:bg-red-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
        >
          Logout
        </button>
      </div>

      <div className="min-h-screen px-8 py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="flex flex-col items-center justify-center">
            <h1 className="text-8xl font-bold font-sans text-gray-800">Distributed File System with Fault Tolerance</h1>
            <div className="mb-8 mt-20 text-center">
              <p className="mb-2 text-3xl mt-10 font-semibold text-gray-800">Hello, {username}</p>
              <p className="text-lg text-gray-600">Upload files to your Distributed File System</p>
            </div>

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
              className="cursor-pointer rounded-lg bg-emerald-600 px-8 py-4 text-2xl font-semibold text-white shadow-lg transition-all duration-200 hover:bg-emerald-700 hover:shadow-xl active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-emerald-400 disabled:active:scale-100"
            >
              {isUploading ? "Uploading..." : "Upload File"}
            </button>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-md">
            <h2 className="mb-4 text-3xl font-bold text-gray-800">Uploaded Files</h2>

            {isLoadingFiles ? (
              <p className="py-8 text-center text-lg text-gray-500">Loading files...</p>
            ) : files.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-xl text-gray-500">No files uploaded yet</p>
              </div>
            ) : (
              <div className="max-h-[calc(100vh-250px)] space-y-3 overflow-y-auto">
                {files.map((file) => (
                  <div
                    key={file.fileId}
                    className="cursor-pointer rounded-lg border border-gray-200 bg-gray-50 p-4 transition-colors hover:border-emerald-300 hover:bg-emerald-50"
                    onClick={() => handleOpenFileDetails(file)}
                  >
                    <p className="truncate text-lg font-semibold text-gray-800" title={file.filename}>
                      {file.filename}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">{formatFileSize(file.fileSize)}</p>
                    <p className="mt-1 text-sm text-gray-500">{formatDate(file.uploadDate)}</p>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDownloadFile(file);
                      }}
                      className="mt-3 mr-3 cursor-pointer rounded-md bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-800 transition-all duration-150 hover:bg-emerald-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
                    >
                      Download
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteFile(file);
                      }}
                      className="mt-3 cursor-pointer rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 transition-all duration-150 hover:bg-red-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
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
                className="cursor-pointer rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-700 transition-all duration-150 hover:bg-gray-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-1"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-1 gap-3 text-sm text-gray-700 md:grid-cols-3">
                <div>
                  <p className="font-semibold">Filename</p>
                  <p className="truncate" title={selectedFile.filename}>
                    {selectedFile.filename}
                  </p>
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
                      <span
                        className={`font-semibold ${fileChunkDetails.isComplete ? "text-emerald-700" : "text-amber-700"}`}
                      >
                        {fileChunkDetails.isComplete ? "Yes" : "No"}
                      </span>
                      {" "}| Fault-tolerant:{" "}
                      <span
                        className={`font-semibold ${fileChunkDetails.hasRequiredReplicas ? "text-emerald-700" : "text-red-600"}`}
                      >
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
