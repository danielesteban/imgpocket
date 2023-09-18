imgpocket
[![npm-version](https://img.shields.io/npm/v/imgpocket.svg)](https://www.npmjs.com/package/imgpocket)
==

> Encode/Decode magic data pockets inside images

### Example

[https://codesandbox.io/s/imgpocket-x8jl2q](https://codesandbox.io/s/imgpocket-x8jl2q)

### Installation

```bash
npm i imgpocket
```

### Usage

```js
import { encodeString, decodeString } from 'imgpocket';

// Encode:

const output = await encodeString(inputImage, JSON.stringify({ some: 'data' }));
output.toBlob((blob) => {
  window.open(URL.createObjectURL(blob));
});

// Decode:

const decoded = JSON.parse(await decodeString(encodedImage));
console.log(decoded); // { some: 'data' }

```
