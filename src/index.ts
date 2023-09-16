import { deflate, inflate, strFromU8, strToU8 } from 'fflate';

const loadImage = async (image: Blob | HTMLImageElement | string): Promise<HTMLImageElement> => {
  let img: HTMLImageElement;
  if (image instanceof HTMLImageElement) {
    img = image;
  } else if (image instanceof Blob || typeof image === 'string') {
    const url = image instanceof Blob ? URL.createObjectURL(image) : image;
    try {
      img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onerror = reject;
        img.onload = () => resolve(img);
        img.src = url;
      });
    } finally {
      if (image instanceof Blob) {
        URL.revokeObjectURL(url);
      }
    }
  } else {
    throw new Error('Image is not a Blob, HTMLImageElement or URL.');
  }
  return img;
};

export const encode = async (image: Blob | HTMLImageElement | string, data: Uint8Array, output: HTMLCanvasElement = document.createElement('canvas')): Promise<HTMLCanvasElement> => {
  const img = await loadImage(image);
  output.width = img.width;
  output.height = img.height;
  const ctx = output.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, img.width, img.height);

  const deflated = await new Promise<Uint8Array>((resolve, reject) => deflate(data, (err, data) => {
    if (err) reject(err);
    else resolve(data);
  }));
  const lengthAsBytes = new Uint8Array((new Uint32Array([deflated.length])).buffer);
  const bytes = new Uint8Array(lengthAsBytes.length + deflated.length);
  bytes.set(lengthAsBytes, 0);
  bytes.set(deflated, lengthAsBytes.length);
  const { length } = bytes;
  const requiredPixels = length * 8 / 6;
  if (pixels.data.length / 4 < requiredPixels) {
    throw new Error('The image is too small to fit the encoded data.');
  }

  let pixel = 0;
  bytes.forEach((byte) => {
    for (let i = 0; i < 4; i++) {
      pixels.data[pixel] = (pixels.data[pixel] & ~3) | ((byte >> (i * 2)) & 3);
      pixel++;
      if (pixel % 4 == 3) pixel++;
    }
  });
  ctx.putImageData(pixels, 0, 0);

  return output;
};

export const encodeString = (image: Blob | HTMLImageElement | string, data: string, output?: HTMLCanvasElement): Promise<HTMLCanvasElement> => (
  encode(image, strToU8(data), output)
);

export const decode = async (image: Blob | HTMLImageElement | string): Promise<Uint8Array> => {
  const img = await loadImage(image);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, img.width, img.height).data;
  
  let pixel = 0;
  const getByte = () => {
    let byte = 0;
    for (let i = 0; i < 4; i++) {
      byte |= (pixels[pixel++] & 3) << (i * 2);
      if (pixel % 4 == 3) pixel++;
    }
    return byte;
  };
  const length = (new Uint32Array((new Uint8Array([getByte(), getByte(), getByte(), getByte()])).buffer))[0];
  const deflated = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    deflated[i] = getByte();
  }

  return new Promise<Uint8Array>((resolve, reject) => inflate(deflated, (err, data) => {
    if (err) reject(err);
    else resolve(data);
  }));
};

export const decodeString = async (image: Blob | HTMLImageElement | string): Promise<string> => (
  strFromU8(await decode(image))
);

export default { encode, encodeString, decode, decodeString };
