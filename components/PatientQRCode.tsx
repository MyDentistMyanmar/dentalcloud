import React, { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

export const QR_PATIENT_PREFIX = 'PATIENT:';

/**
 * Encodes a patient identifier into a scannable QR string.
 */
export const encodePatientQR = (patientUniqueId: string): string => {
  return `${QR_PATIENT_PREFIX}${patientUniqueId}`;
};

/**
 * Decodes a scanned QR string back to the raw patient unique ID.
 * Returns null if the format doesn't match.
 */
export const decodePatientQR = (scannedText: string): string | null => {
  if (!scannedText.startsWith(QR_PATIENT_PREFIX)) return null;
  return scannedText.slice(QR_PATIENT_PREFIX.length).trim();
};

interface PatientQRCodeProps {
  patientUniqueId: string;
  size?: number;
  title?: string;
}

/**
 * Renders a QR code for a given patient unique ID.
 * The QR code encodes "PATIENT:{patient_unique_id}" so a scanner
 * can parse it and navigate to the patient's chart.
 */
const PatientQRCode: React.FC<PatientQRCodeProps> = ({
  patientUniqueId,
  size = 128,
  title = 'Patient QR Code',
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);

  const qrValue = encodePatientQR(patientUniqueId);

  return (
    <div className="flex flex-col items-center gap-2">
      {title && (
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">
          {title}
        </p>
      )}
      <div
        ref={canvasRef}
        className="rounded-xl border-2 border-gray-200 bg-white p-2 shadow-sm inline-block"
      >
        <QRCodeCanvas
          value={qrValue}
          size={size}
          bgColor="#ffffff"
          fgColor="#1f2937"
          level="M"
          includeMargin={false}
        />
      </div>
      <p className="text-[10px] text-gray-400 font-medium">
        ID: {patientUniqueId}
      </p>
    </div>
  );
};

export default PatientQRCode;
