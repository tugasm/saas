'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Camera, AlertCircle } from 'lucide-react';

// BarcodeDetector is available in Chrome/Edge and Android WebView (not in Safari)
interface BarcodeDetectorResult { rawValue: string; format: string; }
declare class BarcodeDetector {
    constructor(options?: { formats: string[] });
    detect(source: ImageBitmapSource): Promise<BarcodeDetectorResult[]>;
    static getSupportedFormats(): Promise<string[]>;
}

interface QrScannerModalProps {
    onScan: (value: string) => void;
    onClose: () => void;
}

export default function QrScannerModal({ onScan, onClose }: QrScannerModalProps) {
    const [error, setError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const rafRef = useRef<number | null>(null);
    const hasScanned = useRef(false);

    const stopCamera = useCallback(() => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }, []);

    useEffect(() => {
        let cancelled = false;

        const start = async () => {
            if (!('BarcodeDetector' in window)) {
                setError('Browser tidak mendukung fitur scan.\nGunakan Chrome terbaru di perangkat Android.');
                return;
            }

            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
                });
            } catch {
                setError('Tidak dapat mengakses kamera.\nPeriksa izin kamera di browser.');
                return;
            }

            if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

            streamRef.current = stream;
            const video = videoRef.current!;
            video.srcObject = stream;
            await video.play();

            const detector = new BarcodeDetector({
                formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'data_matrix'],
            });

            const tick = async () => {
                if (hasScanned.current || cancelled) return;
                try {
                    const results = await detector.detect(video);
                    if (results.length > 0 && !hasScanned.current) {
                        hasScanned.current = true;
                        stopCamera();
                        onScan(results[0].rawValue.trim().toUpperCase().replace(/\s+/g, ''));
                        return;
                    }
                } catch { /* frame not ready */ }
                rafRef.current = requestAnimationFrame(tick);
            };

            rafRef.current = requestAnimationFrame(tick);
        };

        start();
        return () => { cancelled = true; stopCamera(); };
    }, [onScan, stopCamera]);

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden w-full sm:max-w-sm shadow-soft-xl">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <Camera size={20} className="text-blue-600" />
                        <h3 className="font-bold text-gray-800">Scan QR / Barcode Member</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition"
                    >
                        <X size={18} className="text-gray-500" />
                    </button>
                </div>

                {/* Error state */}
                {error ? (
                    <div className="px-5 py-8 flex flex-col items-center gap-3 text-center">
                        <div className="p-3 bg-red-50 rounded-2xl">
                            <AlertCircle size={28} className="text-red-500" />
                        </div>
                        <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">{error}</p>
                        <button
                            onClick={onClose}
                            className="mt-2 px-6 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition text-sm"
                        >
                            Tutup
                        </button>
                    </div>
                ) : (
                    <div className="px-5 py-5">
                        {/* Camera viewport */}
                        <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black">
                            <video
                                ref={videoRef}
                                className="w-full h-full object-cover"
                                muted
                                playsInline
                                autoPlay
                            />
                            {/* Corner frame overlay */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="relative w-52 h-52">
                                    <span className="absolute top-0 left-0 w-9 h-9 border-t-[3px] border-l-[3px] border-white rounded-tl-xl" />
                                    <span className="absolute top-0 right-0 w-9 h-9 border-t-[3px] border-r-[3px] border-white rounded-tr-xl" />
                                    <span className="absolute bottom-0 left-0 w-9 h-9 border-b-[3px] border-l-[3px] border-white rounded-bl-xl" />
                                    <span className="absolute bottom-0 right-0 w-9 h-9 border-b-[3px] border-r-[3px] border-white rounded-br-xl" />
                                </div>
                            </div>
                        </div>
                        <p className="text-center text-xs text-gray-400 mt-3 leading-relaxed">
                            Arahkan kamera ke QR code atau barcode pada kartu member
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}