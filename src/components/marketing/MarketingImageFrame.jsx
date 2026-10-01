import Image from "next/image";

export default function ImageFrame({
  src,
  alt,
  className = "",
  priority = false,
  zoom = false,
}) {
  return (
    <div className={`marketing-image-frame ${className}`.trim()}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes="(max-width: 1240px) 100vw, 1160px"
        className={zoom ? "marketing-image-zoom" : undefined}
      />
    </div>
  );
}
