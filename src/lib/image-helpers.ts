export async function convertSvgToPngBlob(svgHtml: string): Promise<Blob> {
  const blob = new Blob([svgHtml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load SVG image"));
      img.src = url;
    });

    const width = Math.max(Math.ceil(image.naturalWidth || image.width || 800), 1);
    const height = Math.max(Math.ceil(image.naturalHeight || image.height || 400), 1);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas context is unavailable");
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    const pngBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });

    if (!pngBlob) {
      throw new Error("Failed to convert SVG to PNG Blob");
    }

    return pngBlob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
