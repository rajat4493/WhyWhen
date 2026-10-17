import {describe,expect,it} from "vitest";
import {normalizeSlugInput,slugFromName,slugProblem} from "../src/core/hosts/slug";

describe("public link slug",()=>{
 it("suggests from the Google display name",()=>{
  expect(slugFromName("Rajat","r.p@example.com")).toBe("rajat");
  expect(slugFromName("Rajat Pandey","x@example.com")).toBe("rajat-pandey");
  expect(slugFromName("  Zoë  O'Brien ","x@example.com")).toBe("zoe-o-brien");
 });
 it("falls back when the name is unusable or reserved",()=>{
  expect(slugFromName(null,"jane.doe@example.com")).toBe("jane-doe");
  expect(slugFromName("李","jane@example.com")).toBe("jane");
  expect(slugFromName("Admin","ab@example.com")).toBe("admin-host");
  expect(slugFromName("Jo","x@example.com")).toBe("jo-host");
 });
 it("validates allowed characters, length and reserved words",()=>{
  for(const ok of ["rajat","rajat-pandey","r2d","a1b2c3"])expect(slugProblem(ok)).toBeNull();
  for(const bad of ["ra","-rajat","rajat-","raj--at","Rajat","raj at","raj_at","rajat!","x".repeat(41),"dashboard","api","manage"])expect(slugProblem(bad)).not.toBeNull();
  expect(normalizeSlugInput("  Rajat ")).toBe("rajat");
 });
});
