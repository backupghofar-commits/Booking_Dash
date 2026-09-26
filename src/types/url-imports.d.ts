// Type declaration for imports that use Vite-style ?url suffix
// Matches imports like: import workerUrl from '.../pdf.worker.min.mjs?url'

declare module '*?url' {
  const src: string;
  export default src;
}

// Specific (optional) declaration for the pdfjs worker import — keeps types clearer
declare module 'pdfjs-dist/build/pdf.worker.min.mjs?url' {
  const src: string;
  export default src;
}
