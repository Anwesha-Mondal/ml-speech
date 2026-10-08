import { useState, useRef, useEffect } from 'react';
import { Plus, Mic, Square, ArrowUp, Paperclip, X, FileAudio } from 'lucide-react';

interface ChatInputProps {
  onAnalyze: (transcript: string, file: File) => void;
  disabled: boolean;
  placeholder?: string;
}

export default function ChatInput({ onAnalyze, disabled, placeholder = "Enter reference transcript... (Leave blank to auto-transcribe)" }: ChatInputProps) {
  const [transcript, setTranscript] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const recordedFile = new File([blob], "live-recording.webm", { type: 'audio/webm' });
        setFile(recordedFile);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access denied or unavailable.");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSubmit = () => {
    if (file) {
      onAnalyze(transcript, file);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="flex flex-col w-full bg-surface-container-low border border-outline-variant rounded-2xl shadow-sm focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all relative">
      {file && (
        <div className="px-4 pt-4 pb-2">
          <div className="inline-flex items-center gap-2 bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2">
            <FileAudio size={16} className="text-primary" />
            <span className="text-sm font-medium text-on-surface truncate max-w-[200px]">{file.name}</span>
            <button 
              onClick={() => setFile(null)}
              className="text-secondary hover:text-error transition-colors ml-1"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
      
      <div className="flex items-end gap-2 p-2 relative">
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileSelect} 
          className="hidden" 
          accept="audio/*" 
        />
        
        <button 
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isRecording}
          className="p-2.5 text-secondary hover:text-primary hover:bg-surface-container-high rounded-full transition-colors disabled:opacity-50"
          title="Attach audio file"
        >
          <Plus size={20} />
        </button>

        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder={isRecording ? `Recording... ${formatTime(recordingTime)}` : placeholder}
          disabled={disabled || isRecording}
          rows={1}
          className="w-full max-h-48 min-h-[44px] py-3 px-2 bg-transparent text-sm text-on-surface placeholder-secondary/60 resize-none focus:outline-none scrollbar-thin"
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = `${Math.min(target.scrollHeight, 192)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (file) handleSubmit();
            }
          }}
        />

        {isRecording ? (
          <button 
            type="button"
            onClick={handleStopRecording}
            className="p-2.5 text-error hover:bg-error/10 rounded-full transition-colors animate-pulse mb-1 mr-1"
            title="Stop recording"
          >
            <Square size={20} className="fill-current" />
          </button>
        ) : (
          <button 
            type="button"
            onClick={handleStartRecording}
            disabled={disabled}
            className="p-2.5 text-secondary hover:text-primary hover:bg-surface-container-high rounded-full transition-colors disabled:opacity-50 mb-1 mr-1"
            title="Record live audio"
          >
            <Mic size={20} />
          </button>
        )}

        <button 
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !file || isRecording}
          className={`p-2.5 rounded-full transition-colors mb-1 mr-1 ${file && !disabled ? 'bg-primary text-on-primary hover:bg-neutral-800' : 'bg-surface-container-high text-secondary cursor-not-allowed'}`}
          title={file ? "Submit Analysis" : "Attach an audio file first"}
        >
          <ArrowUp size={20} />
        </button>
      </div>
    </div>
  );
}
