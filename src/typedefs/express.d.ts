declare module "express-serve-static-core" {
  interface Request {// Add arguments to default type
    context: any;// Add context arg
    user: any;// Add user arg
  }
}
export {};
