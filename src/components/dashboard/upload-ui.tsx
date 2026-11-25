/** The shared "preparing your photo" overlay: the orange shimmer and ring used wherever a picture is uploading. */
export function UploadingOverlay({ rounded = "rounded-2xl", label = "Preparing your photo" }: { rounded?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={`upload-tile absolute inset-0 z-10 grid place-items-center ${rounded}`}>
      <span className="flex flex-col items-center gap-1.5 text-orange-700">
        <span className="upload-ring" aria-hidden />
        {rounded === "rounded-2xl" && <span className="text-xs font-bold">{label}</span>}
      </span>
    </span>
  );
}
