import type { DomeApiErrorDetails } from "./types.js";

export class DomeApiError extends Error {
  override name = "DomeApiError";
  details: DomeApiErrorDetails;

  constructor(message: string, details: DomeApiErrorDetails) {
    super(message);
    this.details = details;
  }
}

