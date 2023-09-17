import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import copy from 'rollup-plugin-copy';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.resolve(__dirname, 'dist');

export default {
  external: ['fflate', 'seedrandom'],
  input: path.join(__dirname, 'src'),
  output: {
    file: path.join(outputPath, 'imgpocket.js'),
    format: 'esm',
  },
  plugins: [
    nodeResolve({ extensions: ['.js', '.ts'] }),
    typescript({ declaration: true, declarationDir: 'types' }),
    terser({ format: { comments: false } }),
    copy({
      copyOnce: true,
      targets: [
        { src: 'LICENSE', dest: 'dist' },
        { src: 'README.md', dest: 'dist' },
      ],
    }),
    {
      writeBundle() {
        fs.writeFileSync(path.join(outputPath, 'package.json'), JSON.stringify({
          name: 'imgpocket',
          author: 'Daniel Esteban Nombela',
          license: 'MIT',
          module: './imgpocket.js',
          type: 'module',
          types: './types',
          peerDependencies: {
            fflate: '>=0.8.0',
            seedrandom: '>=3.0.5',
          },
          repository: {
            type: 'git',
            url: 'https://github.com/danielesteban/imgpocket',
          },
          version: '0.0.7',
        }, null, '  '));
      },
    },
  ],
};
