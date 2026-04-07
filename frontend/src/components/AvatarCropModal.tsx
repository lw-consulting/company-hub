import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { ZoomIn, ZoomOut, X, Check } from 'lucide-react';

interface AvatarCropModalProps {
  imageSrc: string;
  onCrop: (blob: Blob) => void;
  onClose: () => void;
}

export default function AvatarCropModal({ imageSrc, onCrop, onClose }: AvatarCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);

    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
      onCrop(blob);
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="font-semibold text-neutral-800 dark:text-neutral-100">Bildausschnitt wählen</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
            <X size={20} />
          </button>
        </div>

        {/* Crop Area */}
        <div className="relative w-full" style={{ height: 320 }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Zoom Control */}
        <div className="px-5 py-3 flex items-center gap-3">
          <ZoomOut size={16} className="text-neutral-400 flex-shrink-0" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 h-1.5 rounded-full appearance-none bg-neutral-200 dark:bg-neutral-700
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-neutral-800 [&::-webkit-slider-thumb]:dark:bg-neutral-100
              [&::-webkit-slider-thumb]:cursor-pointer"
          />
          <ZoomIn size={16} className="text-neutral-400 flex-shrink-0" />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-neutral-100 dark:border-neutral-800">
          <button onClick={onClose} className="btn-secondary">Abbrechen</button>
          <button onClick={handleSave} className="btn-primary" disabled={saving}>
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <><Check size={16} /> Zuschneiden</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  const size = Math.min(pixelCrop.width, pixelCrop.height);
  canvas.width = size;
  canvas.height = size;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    size,
    size,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas crop failed'));
    }, 'image/jpeg', 0.92);
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', reject);
    img.src = url;
  });
}
