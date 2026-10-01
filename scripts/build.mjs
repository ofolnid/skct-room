import { mkdir, cp, copyFile } from 'node:fs/promises';
await mkdir('dist/vendor', { recursive: true });
await cp('src', 'dist', { recursive: true });
for (const name of ['pdf.mjs', 'pdf.worker.mjs']) {
  await copyFile(`node_modules/pdfjs-dist/build/${name}`, `dist/vendor/${name}`);
}
for (const name of ['cmaps', 'standard_fonts', 'wasm', 'image_decoders']) {
  await cp(`node_modules/pdfjs-dist/${name}`, `dist/vendor/${name}`, { recursive: true });
}
await copyFile('node_modules/pdfjs-dist/LICENSE', 'dist/vendor/PDFJS-LICENSE.txt');
console.log('정적 배포 파일 생성 완료: dist/');
