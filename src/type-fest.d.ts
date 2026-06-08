declare module "type-fest" {
  export type SetOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
  export type SetRequired<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;
}
