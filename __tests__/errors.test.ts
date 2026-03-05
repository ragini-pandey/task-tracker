import { AppError, handleApiError } from "@/lib/errors";
import { ZodError, type ZodIssue } from "zod";

describe("Error Handling", () => {
  describe("AppError", () => {
    it("should create error with custom status code", () => {
      const error = new AppError("Not found", 404);
      expect(error.message).toBe("Not found");
      expect(error.statusCode).toBe(404);
    });

    it("should default to 400 status code", () => {
      const error = new AppError("Bad request");
      expect(error.statusCode).toBe(400);
    });

    it("should be an instance of Error", () => {
      const error = new AppError("Test");
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("handleApiError", () => {
    it("should handle AppError and return correct status", async () => {
      const error = new AppError("Forbidden", 403);
      const response = handleApiError(error);
      const body = await response.json();
      expect(response.status).toBe(403);
      expect(body.error).toBe("Forbidden");
    });

    it("should handle ZodError and return 400 with details", async () => {
      const issues = [
        { code: "invalid_type", expected: "string", received: "number", path: ["email"], message: "Expected string" },
      ] as unknown as ZodIssue[];
      const error = new ZodError(issues);
      const response = handleApiError(error);
      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.error).toBe("Validation error");
      expect(body.details).toHaveLength(1);
      expect(body.details[0].path).toBe("email");
    });

    it("should handle unknown errors and return 500", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const response = handleApiError(new Error("Something unexpected"));
      const body = await response.json();
      expect(response.status).toBe(500);
      expect(body.error).toBe("Internal server error");
      consoleSpy.mockRestore();
    });

    it("should handle non-Error objects", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const response = handleApiError("string error");
      const body = await response.json();
      expect(response.status).toBe(500);
      expect(body.error).toBe("Internal server error");
      consoleSpy.mockRestore();
    });
  });
});
