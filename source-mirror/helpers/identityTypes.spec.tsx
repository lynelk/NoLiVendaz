import { validateIdentityDocument } from "./identityTypes";

describe("identity document validation", () => {
  it("accepts a 14-character NIN without calling it verified", () => {
    const result = validateIdentityDocument("NIN", "CM123456789012");
    expect(result.formatValid).toBeTrue();
    expect(result.normalized).toBe("CM123456789012");
  });

  it("applies the selected identity type rules", () => {
    expect(validateIdentityDocument("PASSPORT", "A1234567").formatValid).toBeTrue();
    expect(validateIdentityDocument("PASSPORT", "A12").formatValid).toBeFalse();
    expect(validateIdentityDocument("REFUGEE_ID", "R-123456").formatValid).toBeTrue();
  });
});
