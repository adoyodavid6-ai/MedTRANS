import { describe, expect, it } from "vitest";
import { sniffMime } from "@/lib/files/sniff";

const bytes = (...b: number[]) => new Uint8Array(b);
const ascii = (s: string) => new TextEncoder().encode(s);

describe("sniffMime (upload type by content, not by name)", () => {
  it("recognises JPEG, PNG, WebP and PDF", () => {
    expect(sniffMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("image/png");
    expect(sniffMime(ascii("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffMime(ascii("%PDF-1.7\n"))).toBe("application/pdf");
  });
  it("rejects everything else, including HTML or scripts named .pdf", () => {
    expect(sniffMime(ascii("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffMime(ascii("not really a pdf"))).toBeNull();
    expect(sniffMime(bytes())).toBeNull();
  });
});
