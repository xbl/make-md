declare module "*.css";
declare module "*.css?inline" {
  const content: string;
  export default content;
}

declare global {
  interface Window {
    __MAKE_MD_APP__?: {
      openFile: (path: string) => Promise<unknown>;
    };
    __MAKE_MD_E2E__?: {
      files: Record<string, string>;
    };
  }
}
