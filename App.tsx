import React, { useState, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon, Video as VideoIcon, Loader2, Download, AlertCircle, Wand2, X } from 'lucide-react';
import { MediaType, ProcessingState } from './types';
import { fileToBase64, removeImageWatermark, reconstructVideoFromImage } from './services/geminiService';
import ComparisonView from './components/ComparisonView';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MediaType>(MediaType.IMAGE);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<ProcessingState>({ status: 'idle' });
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state on tab change
  useEffect(() => {
    setFile(null);
    setPreviewUrl(null);
    setResultUrl(null);
    setStatus({ status: 'idle' });
  }, [activeTab]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const validateFile = (file: File) => {
    if (activeTab === MediaType.IMAGE) {
      return file.type.startsWith('image/');
    } else {
      return file.type.startsWith('video/');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (validateFile(droppedFile)) {
        handleFileSelect(droppedFile);
      } else {
        setStatus({ status: 'error', message: `Please upload a valid ${activeTab.toLowerCase()} file.` });
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setResultUrl(null);
    setStatus({ status: 'idle' });

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
  };

  const handleRemoveWatermark = async () => {
    if (!file) return;

    setStatus({ status: 'processing', progress: 10 });
    
    try {
      const base64 = await fileToBase64(file);
      
      if (activeTab === MediaType.IMAGE) {
        setStatus({ status: 'processing', message: 'Analyzing image structure...', progress: 30 });
        // Artificial delay for UX
        await new Promise(r => setTimeout(r, 500));
        setStatus({ status: 'processing', message: 'Removing watermark patterns...', progress: 60 });
        
        const cleanBase64 = await removeImageWatermark(base64, file.type);
        setResultUrl(`data:${file.type};base64,${cleanBase64}`);
        setStatus({ status: 'success' });

      } else {
        // VIDEO HANDLING
        setStatus({ status: 'processing', message: 'Video processing requires a paid API key. Checking...', progress: 20 });
        
        // Check for paid key for Veo
        if (window.aistudio && window.aistudio.hasSelectedApiKey) {
           const hasKey = await window.aistudio.hasSelectedApiKey();
           if (!hasKey) {
             setStatus({ status: 'idle' }); // Reset so they can try again
             await window.aistudio.openSelectKey();
             return;
           }
        }

        setStatus({ status: 'processing', message: 'Extracting reference frame...', progress: 30 });
        
        // Since we can't easily extract frame in browser without heavy libs, 
        // we'll assume the user might have uploaded an image reference for the video, 
        // OR we warn them this uses the file as an image source if it's small enough.
        // BUT, `fileToBase64` loads the whole video into memory which is bad for large files.
        // Limitation: For this demo, we will simulate "reconstruction" by taking a snapshot if possible,
        // or actually, let's just attempt to send the video bytes if small, or fail gracefully.
        
        // Actually, Veo `image` input expects an image mimeType. 
        // We need to capture a frame from the video.
        
        const videoElement = document.createElement('video');
        videoElement.src = previewUrl!;
        await new Promise((r) => { videoElement.onloadeddata = r; videoElement.load(); });
        videoElement.currentTime = 0;
        
        // Wait for seek
        await new Promise(r => setTimeout(r, 200));

        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(videoElement, 0, 0);
        
        const frameBase64 = canvas.toDataURL('image/jpeg').split(',')[1];
        
        setStatus({ status: 'processing', message: 'Cleaning reference frame...', progress: 50 });
        const cleanFrame = await removeImageWatermark(frameBase64, 'image/jpeg');
        
        setStatus({ status: 'processing', message: 'Reconstructing video stream (this may take a minute)...', progress: 70 });
        const newVideoUrl = await reconstructVideoFromImage(cleanFrame, 'image/jpeg');
        
        setResultUrl(newVideoUrl);
        setStatus({ status: 'success' });
      }
    } catch (error: any) {
      setStatus({ status: 'error', message: error.message || "Failed to process file." });
    }
  };

  const downloadResult = () => {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `clean_${activeTab.toLowerCase()}_${Date.now()}.${activeTab === MediaType.IMAGE ? 'png' : 'mp4'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-dark text-gray-100 flex flex-col items-center py-10 px-4">
      {/* Header */}
      <div className="text-center mb-10 max-w-2xl">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="bg-gradient-to-br from-primary to-secondary p-3 rounded-xl shadow-lg shadow-purple-900/50">
            <Wand2 size={32} className="text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            Magic Eraser AI
          </h1>
        </div>
        <p className="text-gray-400 text-lg">
          Remove watermarks instantly using Gemini 2.5 Flash & Veo.
        </p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-4xl bg-card rounded-2xl border border-gray-800 shadow-2xl overflow-hidden flex flex-col">
        
        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          <button
            onClick={() => setActiveTab(MediaType.IMAGE)}
            className={`flex-1 py-4 flex items-center justify-center gap-2 font-medium transition-colors ${
              activeTab === MediaType.IMAGE ? 'bg-gray-800 text-white border-b-2 border-primary' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
          >
            <ImageIcon size={20} /> Image Remover
          </button>
          <button
            onClick={() => setActiveTab(MediaType.VIDEO)}
            className={`flex-1 py-4 flex items-center justify-center gap-2 font-medium transition-colors ${
              activeTab === MediaType.VIDEO ? 'bg-gray-800 text-white border-b-2 border-primary' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
          >
            <VideoIcon size={20} /> Video Reconstructor <span className="text-[10px] bg-primary px-1.5 py-0.5 rounded ml-1">BETA</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 md:p-8 min-h-[400px] flex flex-col items-center justify-center">
          
          {/* Error Message */}
          {status.status === 'error' && (
            <div className="w-full bg-red-900/20 border border-red-500/50 text-red-200 p-4 rounded-lg mb-6 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={20} className="shrink-0" />
              <span>{status.message}</span>
              <button onClick={() => setStatus({ status: 'idle' })} className="ml-auto hover:bg-red-900/40 p-1 rounded">
                <X size={16} />
              </button>
            </div>
          )}

          {/* Upload State */}
          {!file && (
            <div 
              className={`w-full max-w-2xl h-80 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all ${
                dragActive ? 'border-primary bg-primary/10 scale-105' : 'border-gray-700 bg-gray-800/30 hover:bg-gray-800/50 hover:border-gray-600'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="bg-gray-800 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform duration-300">
                <Upload size={32} className="text-primary" />
              </div>
              <p className="text-xl font-medium mb-2 text-gray-200">
                Click or Drag {activeTab === MediaType.IMAGE ? 'Image' : 'Video'} Here
              </p>
              <p className="text-gray-500 text-sm">
                Supported: {activeTab === MediaType.IMAGE ? 'JPG, PNG, WEBP' : 'MP4, MOV (Max 50MB)'}
              </p>
              <input 
                ref={fileInputRef}
                type="file" 
                className="hidden" 
                accept={activeTab === MediaType.IMAGE ? "image/*" : "video/*"}
                onChange={handleFileChange}
              />
            </div>
          )}

          {/* Preview / Result State */}
          {file && (
            <div className="w-full flex flex-col items-center">
              
              {status.status === 'processing' ? (
                 <div className="flex flex-col items-center justify-center py-20">
                   <div className="relative">
                     <div className="absolute inset-0 bg-primary/30 blur-xl rounded-full"></div>
                     <Loader2 size={64} className="text-primary animate-spin relative z-10" />
                   </div>
                   <h3 className="text-2xl font-semibold mt-8 animate-pulse">Removing Watermark...</h3>
                   <p className="text-gray-400 mt-2">{status.message}</p>
                   {status.progress && (
                      <div className="w-64 h-2 bg-gray-800 rounded-full mt-4 overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-500 ease-out" 
                          style={{ width: `${status.progress}%` }}
                        />
                      </div>
                   )}
                 </div>
              ) : resultUrl ? (
                // SUCCESS STATE
                <div className="w-full flex flex-col items-center gap-6 animate-in zoom-in-95 duration-500">
                   <div className="flex items-center gap-2 mb-2">
                     <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                     <span className="text-green-400 font-medium tracking-wide text-sm uppercase">Processing Complete</span>
                   </div>
                   
                   {activeTab === MediaType.IMAGE ? (
                     <ComparisonView original={previewUrl!} result={resultUrl} />
                   ) : (
                     <div className="w-full max-w-3xl aspect-video bg-black rounded-lg overflow-hidden border border-gray-700">
                       <video src={resultUrl} controls className="w-full h-full" />
                     </div>
                   )}

                   <div className="flex gap-4 mt-4">
                     <button 
                       onClick={() => {
                         setFile(null);
                         setResultUrl(null);
                         setPreviewUrl(null);
                         setStatus({ status: 'idle' });
                       }}
                       className="px-6 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors"
                     >
                       Start Over
                     </button>
                     <button 
                       onClick={downloadResult}
                       className="px-6 py-2 rounded-lg bg-gradient-to-r from-primary to-secondary text-white font-medium hover:shadow-lg hover:shadow-primary/25 transition-all flex items-center gap-2"
                     >
                       <Download size={18} /> Download Result
                     </button>
                   </div>
                </div>
              ) : (
                // PREVIEW STATE
                <div className="w-full flex flex-col items-center gap-6 animate-in slide-in-from-bottom-4">
                  <div className="relative w-full max-w-2xl bg-gray-900 rounded-xl overflow-hidden border border-gray-700 shadow-xl group">
                    {activeTab === MediaType.IMAGE ? (
                      <img src={previewUrl!} alt="Preview" className="w-full h-auto max-h-[500px] object-contain" />
                    ) : (
                      <video src={previewUrl!} controls className="w-full h-auto max-h-[500px]" />
                    )}
                    
                    <button 
                      onClick={() => {
                        setFile(null);
                        setPreviewUrl(null);
                      }}
                      className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-red-500/80 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="flex flex-col items-center gap-3">
                    <button 
                      onClick={handleRemoveWatermark}
                      className="group relative px-8 py-3 bg-white text-black font-bold text-lg rounded-full shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] transition-all overflow-hidden"
                    >
                      <span className="relative z-10 flex items-center gap-2">
                        <Wand2 size={20} className="group-hover:rotate-12 transition-transform" />
                        Remove Watermark
                      </span>
                      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                      <span className="absolute z-10 inset-0 flex items-center justify-center gap-2 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                         <Wand2 size={20} className="group-hover:rotate-12 transition-transform" />
                        Magic Erase
                      </span>
                    </button>
                    {activeTab === MediaType.VIDEO && (
                      <p className="text-xs text-gray-500 max-w-md text-center">
                        Note: Video removal uses AI reconstruction (Veo). It generates a new video based on a cleaned reference frame. Requires a paid API key.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Footer */}
      <footer className="mt-12 text-gray-600 text-sm">
        Powered by Gemini 2.5 & Veo • {new Date().getFullYear()} Magic Eraser AI
      </footer>
    </div>
  );
};

export default App;