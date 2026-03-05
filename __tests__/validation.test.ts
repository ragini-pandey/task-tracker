import { registerSchema, loginSchema, taskSchema, commentSchema, assignSchema, taskUpdateSchema } from "@/lib/validation";

describe("Validation Schemas", () => {
  describe("registerSchema", () => {
    it("should accept valid registration data", () => {
      const data = { name: "John Doe", email: "john@example.com", password: "password123" };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should reject invalid email", () => {
      const data = { name: "John", email: "not-an-email", password: "password123" };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("should reject short password", () => {
      const data = { name: "John", email: "john@example.com", password: "123" };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("should reject short name", () => {
      const data = { name: "J", email: "john@example.com", password: "password123" };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("should reject empty fields", () => {
      const result = registerSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("loginSchema", () => {
    it("should accept valid login data", () => {
      const result = loginSchema.safeParse({ email: "john@example.com", password: "pass" });
      expect(result.success).toBe(true);
    });

    it("should reject missing password", () => {
      const result = loginSchema.safeParse({ email: "john@example.com" });
      expect(result.success).toBe(false);
    });
  });

  describe("taskSchema", () => {
    it("should accept valid task data", () => {
      const data = { title: "Fix bug", description: "Some bug", status: "todo", priority: "high", assignees: [] };
      const result = taskSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should use defaults for optional fields", () => {
      const result = taskSchema.safeParse({ title: "New task" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe("todo");
        expect(result.data.priority).toBe("medium");
        expect(result.data.assignees).toEqual([]);
      }
    });

    it("should reject empty title", () => {
      const result = taskSchema.safeParse({ title: "" });
      expect(result.success).toBe(false);
    });

    it("should reject invalid status", () => {
      const result = taskSchema.safeParse({ title: "Test", status: "invalid" });
      expect(result.success).toBe(false);
    });

    it("should reject invalid priority", () => {
      const result = taskSchema.safeParse({ title: "Test", priority: "super-high" });
      expect(result.success).toBe(false);
    });
  });

  describe("taskUpdateSchema (partial)", () => {
    it("should accept partial updates", () => {
      const result = taskUpdateSchema.safeParse({ status: "done" });
      expect(result.success).toBe(true);
    });

    it("should accept empty object", () => {
      const result = taskUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe("commentSchema", () => {
    it("should accept valid comment", () => {
      const result = commentSchema.safeParse({ text: "Great work!" });
      expect(result.success).toBe(true);
    });

    it("should reject empty comment", () => {
      const result = commentSchema.safeParse({ text: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("assignSchema", () => {
    it("should accept valid userId", () => {
      const result = assignSchema.safeParse({ userId: "507f1f77bcf86cd799439011" });
      expect(result.success).toBe(true);
    });

    it("should reject empty userId", () => {
      const result = assignSchema.safeParse({ userId: "" });
      expect(result.success).toBe(false);
    });
  });
});
