/// <reference types="vite/client" />

declare module "*.json" {
  const value: unknown;
  export default value;
}

declare module "*.wasm" {
  const value: string;
  export default value;
}
