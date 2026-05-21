import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeSourceExperienceMetadata } from "./experience-rules";
import {
  formatSourceExperienceParseError,
  parseSourceExperience,
} from "./parse-source-experience";
import type { Resume } from "@/lib/types";

const USER_SOURCE_EXAMPLE = `Education:

Middle Georgia State University
Macon, Georgia
Bachelor of Computer Science
April 2010 – November 2014

Work Experience:

January 2015 – May 2017
Improving Enterprises, Inc. — Addison, Texas

June 2017 – February 2020
Nexient, LLC — Ann Arbor, Michigan

March 2020 – December 2022
Freecast, Inc. — Orlando, Florida

January 2023 – April 2026
Beejern, Inc. — Remote
`;

function minimalResume(experienceCount: number): Resume {
  return {
    target_title: "Engineer",
    contact: {
      name: "Test",
      email: "t@example.com",
      phone: null,
      location: null,
      linkedin: null,
      website: null,
    },
    summary: "Summary",
    skills: ["Languages: Python"],
    experience: Array.from({ length: experienceCount }, (_, i) => ({
      title: `Title ${i}`,
      company: "Placeholder Co",
      location: null,
      dates: "Jan 2020 – Jan 2021",
      bullets: ["Built systems.", "Led team.", "Shipped features."],
    })),
    education: [],
    projects: [],
    certifications: [],
  };
}

describe("parseSourceExperience", () => {
  it("parses four roles from user example (reverse-chronological)", () => {
    const entries = parseSourceExperience(USER_SOURCE_EXAMPLE);
    assert.equal(entries.length, 4);
    assert.equal(entries[0]?.company, "Beejern, Inc.");
    assert.equal(entries[0]?.location, "Remote");
    assert.equal(entries[0]?.dates, "January 2023 – April 2026");
    assert.equal(entries[3]?.company, "Improving Enterprises, Inc.");
    assert.equal(entries[3]?.location, "Addison, Texas");
    assert.equal(entries[3]?.dates, "January 2015 – May 2017");
  });

  it("ignores Education section for experience entries", () => {
    const entries = parseSourceExperience(USER_SOURCE_EXAMPLE);
    assert.ok(!entries.some((e) => e.company.includes("Georgia State")));
  });

  it("returns empty when Work Experience header is missing", () => {
    assert.deepEqual(parseSourceExperience("Education:\n\nFoo\n"), []);
  });
});

describe("mergeSourceExperienceMetadata", () => {
  it("overwrites company, location, dates; keeps title and bullets", () => {
    const source = parseSourceExperience(USER_SOURCE_EXAMPLE);
    const resume = minimalResume(4);
    const merged = mergeSourceExperienceMetadata(resume, source);

    assert.equal(merged.experience[0]?.company, "Beejern, Inc.");
    assert.equal(merged.experience[0]?.location, "Remote");
    assert.equal(merged.experience[0]?.dates, "January 2023 – April 2026");
    assert.equal(merged.experience[0]?.title, "Title 0");
    assert.deepEqual(merged.experience[0]?.bullets, resume.experience[0]?.bullets);

    assert.equal(merged.experience[3]?.company, "Improving Enterprises, Inc.");
  });

  it("throws when source has no parseable roles", () => {
    assert.throws(
      () => mergeSourceExperienceMetadata(minimalResume(1), []),
      (err: Error) => err.message.includes(formatSourceExperienceParseError().slice(0, 20)),
    );
  });

  it("throws on experience count mismatch", () => {
    const source = parseSourceExperience(USER_SOURCE_EXAMPLE);
    assert.throws(
      () => mergeSourceExperienceMetadata(minimalResume(2), source),
      /count mismatch/i,
    );
  });
});
