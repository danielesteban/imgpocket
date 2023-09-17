import { deflate, inflate, strFromU8, strToU8 } from 'fflate';
import seedrandom from 'seedrandom';

const getLUT = (length: number, password: string) => {
  if (!password) {
    return (i: number) => i;
  }
  const rng = seedrandom(password);
  const lut = (length > 65535 ? Uint32Array : Uint16Array)
    .from({ length } as any, (_, i) => i);
  for (let i = length - 1; i > 0; i--) {
    const r = Math.floor(rng() * i);
    const t = lut[i];
    lut[i] = lut[r];
    lut[r] = t;
  }
  return (i: number) => lut[Math.floor(i / 4)] + Math.floor(i % 4);
};

type Image = Blob | HTMLCanvasElement | HTMLImageElement | string;

const loadImage = async (image: Image): Promise<HTMLCanvasElement | HTMLImageElement> => {
  let img: HTMLCanvasElement | HTMLImageElement;
  if (image instanceof HTMLCanvasElement || image instanceof HTMLImageElement) {
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

export const encode = async (
  image: Image,
  data: Uint8Array,
  password: string = '',
  canvas: HTMLCanvasElement = document.createElement('canvas')
): Promise<HTMLCanvasElement> => {
  const img = await loadImage(image);
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
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
  const lut = getLUT(img.width * img.height, password);
  bytes.forEach((byte) => {
    for (let i = 0; i < 4; i++) {
      const index = lut(pixel++);
      if (pixel % 4 === 3) pixel++;
      pixels.data[index] = (pixels.data[index] & ~3) | ((byte >> (i * 2)) & 3);
    }
  });
  ctx.putImageData(pixels, 0, 0);

  return canvas;
};

export const encodeString = (
  image: Image,
  data: string,
  password?: string,
  canvas?: HTMLCanvasElement
): Promise<HTMLCanvasElement> => (
  encode(image, strToU8(data), password, canvas)
);

export const decode = async (
  image: Image,
  password: string = '',
  canvas: HTMLCanvasElement = document.createElement('canvas')
): Promise<Uint8Array> => {
  const img = await loadImage(image);
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, img.width, img.height).data;

  let pixel = 0;
  const lut = getLUT(img.width * img.height, password);
  const getByte = () => {
    let byte = 0;
    for (let i = 0; i < 4; i++) {
      byte |= (pixels[lut(pixel++)] & 3) << (i * 2);
      if (pixel % 4 === 3) pixel++;
    }
    return byte;
  };
  const length = (new Uint32Array((new Uint8Array([getByte(), getByte(), getByte(), getByte()])).buffer))[0];
  if (pixels.length / 4 < (length + 4) * 8 / 6) {
    throw new Error("Couldn't decode data.");
  }
  const deflated = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    deflated[i] = getByte();
  }

  return new Promise<Uint8Array>((resolve, reject) => inflate(deflated, (err, data) => {
    if (err) reject(err);
    else resolve(data);
  }));
};

export const decodeString = async (
  image: Blob | HTMLImageElement | string,
  password?: string,
  canvas?: HTMLCanvasElement
): Promise<string> => (
  strFromU8(await decode(image, password, canvas))
);

export default { encode, encodeString, decode, decodeString };
