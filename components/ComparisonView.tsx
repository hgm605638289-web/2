import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeftRight } from 'lucide-react';

interface ComparisonViewProps {
  original: string;
  result: string;
}

const ComparisonView: React.FC<ComparisonViewProps> = ({ original, result }) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);

  const handleMouseMove = (e: React.MouseEvent | MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e as unknown as MouseEvent).clientX - rect.left) / rect.width;
    const clampedX = Math.max(0, Math.min(1, x));
    setSliderPosition(clampedX * 100);
  };

  const handleTouchMove = (e: React.TouchEvent | TouchEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const touch = (e as unknown as TouchEvent).touches[0];
    const x = (touch.clientX - rect.left) / rect.width;
    const clampedX = Math.max(0, Math.min(1, x));
    setSliderPosition(clampedX * 100);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove as any);
      window.addEventListener('touchend', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove as any);
      window.removeEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove as any);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div 
        ref={containerRef}
        className="relative w-full max-w-2xl aspect-video bg-gray-900 rounded-xl overflow-hidden border border-gray-700 shadow-2xl select-none cursor-ew-resize group"
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
      >
        {/* Result Image (Background) */}
        <img 
          src={result} 
          alt="Clean" 
          className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none"
        />

        {/* Original Image (Foreground, clipped) */}
        <div 
          className="absolute top-0 left-0 h-full overflow-hidden border-r-2 border-white/80 box-border pointer-events-none"
          style={{ width: `${sliderPosition}%` }}
        >
          <img 
            src={original} 
            alt="Original" 
            className="absolute top-0 left-0 max-w-none h-full object-contain"
            style={{ width: containerRef.current ? `${containerRef.current.offsetWidth}px` : '100%' }}
          />
        </div>

        {/* Slider Handle */}
        <div 
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-800 z-10 transition-transform hover:scale-110"
          style={{ left: `${sliderPosition}%` }}
        >
          <ArrowLeftRight size={20} />
        </div>
        
        <div className="absolute top-4 left-4 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm pointer-events-none">Original</div>
        <div className="absolute top-4 right-4 bg-primary/80 text-white text-xs px-2 py-1 rounded backdrop-blur-sm pointer-events-none">Result</div>
      </div>
      <p className="text-gray-400 text-sm">Drag slider to compare</p>
    </div>
  );
};

export default ComparisonView;