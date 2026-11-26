declare global {
  namespace Express {
    interface Request {
      id: string;
      user?: {
        id: string;
        email: string;
        roles: Array<
          | "business_analyst"
          | "product_owner"
          | "delivery_lead"
          | "admin"
        >;
      };
    }
  }
}

export {};
