import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Modal } from './Modal';
import { ZoomIn, ZoomOut, RotateCw, RefreshCw, Check, Move } from 'lucide-react';

interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onCropComplete: (croppedDataUrl: string) => Promise<void> | void;
  isSaving?: boolean;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  imageSrc,
  onClose,
  onCropComplete,
  isSaving = false,
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionStartRef = useRef({ x: 0, y: 0 });

  const imageRef = useRef<HTMLImageElement | null>(null);

  // Reset state when a new image is loaded
  useEffect(() => {
    if (imageSrc) {
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imageRef.current = img;
      };
      img.src = imageSrc;
    }
  }, [imageSrc, isOpen]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    positionStartRef.current = { ...position };
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPosition({
        x: positionStartRef.current.x + dx,
        y: positionStartRef.current.y + dy,
      });
    },
    [isDragging],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => Math.min(Math.max(0.6, prev + delta), 3.5));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleApplyCrop = async () => {
    if (!imageRef.current) return;

    const canvas = document.createElement('canvas');
    const size = 512; // High-resolution square output
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Smooth rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const img = imageRef.current;
    const cropBoxSize = 260; // Size of circular viewport in modal
    const scaleFactor = size / cropBoxSize;

    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom * scaleFactor, zoom * scaleFactor);

    // Compute relative aspect ratio
    const imgAspect = img.naturalWidth / img.naturalHeight;
    let drawWidth = cropBoxSize;
    let drawHeight = cropBoxSize;

    if (imgAspect > 1) {
      drawWidth = cropBoxSize * imgAspect;
      drawHeight = cropBoxSize;
    } else {
      drawWidth = cropBoxSize;
      drawHeight = cropBoxSize / imgAspect;
    }

    // Offset translation
    const drawX = position.x * (1 / zoom) - drawWidth / 2;
    const drawY = position.y * (1 / zoom) - drawHeight / 2;

    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();

    // Export as optimized JPEG
    const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    await onCropComplete(croppedDataUrl);
  };

  if (!isOpen || !imageSrc) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Adjust Profile Photo" maxWidth="440px">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '6px 0' }}>
        {/* Instruction hint */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: 'var(--text-muted, #64748b)',
            backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
            padding: '6px 12px',
            borderRadius: '16px',
            border: '1px solid var(--border-subtle, #e2e8f0)',
          }}
        >
          <Move size={13} style={{ color: 'var(--primary, #2563eb)' }} />
          <span>Drag to reposition • Scroll or use slider to zoom</span>
        </div>

        {/* Viewport Box */}
        <div
          onMouseDown={handleMouseDown}
          onWheel={handleWheel}
          style={{
            position: 'relative',
            width: '260px',
            height: '260px',
            borderRadius: '12px',
            overflow: 'hidden',
            backgroundColor: '#0f172a',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.4), 0 4px 14px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Transforming Image */}
          <div
            style={{
              position: 'absolute',
              transform: `translate(${position.x}px, ${position.y}px) rotate(${rotation}deg) scale(${zoom})`,
              transition: isDragging ? 'none' : 'transform 0.08s ease-out',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <img
              src={imageSrc}
              alt="Crop target"
              style={{
                maxWidth: '260px',
                maxHeight: '260px',
                objectFit: 'contain',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            />
          </div>

          {/* Circular mask overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.65)',
              borderRadius: '50%',
              border: '2px solid rgba(255, 255, 255, 0.85)',
            }}
          />

          {/* Grid lines overlay for precise centering */}
          <div
            style={{
              position: 'absolute',
              width: '200px',
              height: '200px',
              borderRadius: '50%',
              border: '1px dashed rgba(255, 255, 255, 0.25)',
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* Controls: Zoom Slider */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setZoom((prev) => Math.max(0.6, prev - 0.2))}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary, #64748b)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Zoom out"
            >
              <ZoomOut size={16} />
            </button>

            <input
              type="range"
              min="0.6"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              style={{
                flex: 1,
                cursor: 'pointer',
                accentColor: 'var(--primary, #2563eb)',
              }}
            />

            <button
              type="button"
              onClick={() => setZoom((prev) => Math.min(3, prev + 0.2))}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary, #64748b)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Zoom in"
            >
              <ZoomIn size={16} />
            </button>

            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-muted, #64748b)',
                width: '36px',
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Rotate & Reset Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '2px' }}>
            <button
              type="button"
              onClick={handleRotate}
              className="btn btn-secondary"
              style={{
                padding: '5px 12px',
                fontSize: '12px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '8px',
              }}
            >
              <RotateCw size={13} />
              Rotate 90°
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="btn btn-secondary"
              style={{
                padding: '5px 12px',
                fontSize: '12px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '8px',
              }}
            >
              <RefreshCw size={13} />
              Reset
            </button>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '6px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="btn btn-secondary"
            style={{ flex: 1, height: '40px', fontWeight: 600, borderRadius: '8px' }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleApplyCrop}
            disabled={isSaving}
            className="btn btn-primary"
            style={{
              flex: 1,
              height: '40px',
              fontWeight: 600,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            {isSaving ? (
              <span>Saving...</span>
            ) : (
              <>
                <Check size={16} />
                <span>Crop & Save Photo</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
