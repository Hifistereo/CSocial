import { describe, it, expect } from "vitest";
import { extractVideoId, parseIsoDuration } from "@/lib/youtube";

describe("extractVideoId", () => {
  const id = "dQw4w9WgXcQ";

  it.each([
    [`https://www.youtube.com/watch?v=${id}`],
    [`https://youtube.com/watch?v=${id}`],
    [`http://www.youtube.com/watch?v=${id}&t=42s&list=PL123`],
    [`https://m.youtube.com/watch?v=${id}`],
    [`https://music.youtube.com/watch?v=${id}`],
    [`https://youtu.be/${id}`],
    [`https://youtu.be/${id}?si=abcdef&t=10`],
    [`https://www.youtube.com/shorts/${id}`],
    [`https://www.youtube.com/shorts/${id}?feature=share`],
    [`https://www.youtube.com/embed/${id}`],
    [`https://www.youtube-nocookie.com/embed/${id}`],
    [`https://www.youtube.com/live/${id}`],
    [`https://www.youtube.com/v/${id}`],
    [`  https://youtu.be/${id}  `],
  ])("parses %s", (url) => {
    expect(extractVideoId(url)).toBe(id);
  });

  it.each([
    ["not a url"],
    [""],
    ["https://vimeo.com/12345678"],
    ["https://example.com/watch?v=dQw4w9WgXcQ"],
    ["https://youtube.com/watch"],
    ["https://youtube.com/watch?v=tooShort"],
    ["https://youtu.be/"],
    ["https://youtube.com/playlist?list=PL123"],
    ["javascript:alert(1)"],
    ["https://evilyoutube.com/watch?v=dQw4w9WgXcQ"],
  ])("rejects %s", (url) => {
    expect(extractVideoId(url)).toBeNull();
  });
});

describe("parseIsoDuration", () => {
  it("parses hours/minutes/seconds", () => {
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
    expect(parseIsoDuration("PT4M13S")).toBe(253);
    expect(parseIsoDuration("PT58S")).toBe(58);
    expect(parseIsoDuration("PT2H")).toBe(7200);
  });

  it("returns null for junk", () => {
    expect(parseIsoDuration("P1D")).toBeNull();
    expect(parseIsoDuration("nonsense")).toBeNull();
  });
});
