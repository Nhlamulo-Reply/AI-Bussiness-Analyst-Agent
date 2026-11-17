export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details: Array<{ field: string; reason: string }> = []
  ) {
    super(message);
    this.name = "AppError";
  }
}
