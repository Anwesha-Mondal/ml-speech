# SPEECH ARENA: 03-RIGHTS-PROVENANCE

## 1. Introduction

The legal and ethical handling of speech data is a primary judging criterion. Distributing a dataset containing copyrighted media or uncleared personal voice data will result in disqualification. 

This document defines the strict acquisition protocol and the schema for the Rights Manifest. Every single `.wav`, `.mp3`, or `.ogg` file in the `speech-arena/datasets/` directory MUST have an accompanying JSON manifest verifying its provenance.

---

## 2. The 10-Step Acquisition Protocol

Before an audio file is allowed to enter the feature extraction pipeline, the Data Engineer must manually or programmatically complete these 10 steps:

1.  **Open the canonical/original item:** Do not trust re-uploads on YouTube or random aggregators. Go to the primary archive (e.g., National Archives, Miller Center).
2.  **Verify Transcript Match:** Ensure the provided text transcript refers to the *exact* performance in the audio. Live speeches often deviate from prepared remarks.
3.  **Separate Dates:** Clearly separate the `performance_date` (when the speech was given) from the `recording_date` or `digitization_date`.
4.  **Read the License:** Locate and read the exact asset license or rights statement. Never infer public-domain status simply based on the age of the speech or the location of the archive.
5.  **Download:** Download the asset only if the license permits it.
6.  **Hash:** Compute the SHA-256 hash of the raw downloaded file. This prevents tampering and duplicate ingestion.
7.  **Store Metadata:** Save all provenance and license metadata into the JSON manifest.
8.  **Isolate Assets:** Keep raw downloaded assets strictly separate from derived/processed assets (e.g., chunked 10-second WAV files).
9.  **Classify Distribution Status:** If the rights are unclear or highly restrictive (e.g., CC BY-NC-ND), classify the asset as `RESEARCH_ONLY`. It cannot be included in the public redistribution bundle.
10. **Re-check:** Re-check rights immediately prior to the final release bundle generation, in case archive policies have changed.

---

## 3. The Rights Manifest Schema

Every source audio file must be tracked using this strict JSON schema.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "RightsManifest",
  "type": "object",
  "required": [
    "asset_id", "canonical_url", "provider", "speaker", 
    "performance_date", "license", "redistribution_allowed", "checksum"
  ],
  "properties": {
    "asset_id": {
      "type": "string",
      "description": "Unique internal ID (e.g., spch_miller_jfk_1962)"
    },
    "canonical_url": {
      "type": "string",
      "description": "URL to the primary source archive page"
    },
    "download_url": {
      "type": "string",
      "description": "Direct URL to the audio file if applicable"
    },
    "provider": {
      "type": "string",
      "description": "Institution name (e.g., Miller Center, National Archives)"
    },
    "title": {
      "type": "string",
      "description": "Official title of the speech"
    },
    "speaker": {
      "type": "string",
      "description": "Name of the individual speaking"
    },
    "performance_date": {
      "type": "string",
      "format": "date",
      "description": "YYYY-MM-DD when the speech was spoken"
    },
    "recording_date": {
      "type": "string",
      "format": "date",
      "description": "YYYY-MM-DD when the audio was recorded (often later for historical studio recreations)"
    },
    "digitization_date": {
      "type": "string",
      "format": "date",
      "description": "YYYY-MM-DD when the digital file was created"
    },
    "license": {
      "type": "string",
      "description": "Exact license text (e.g., 'Public Domain', 'CC BY 4.0')"
    },
    "jurisdiction": {
      "type": "string",
      "description": "Legal jurisdiction (e.g., 'USA')"
    },
    "rights_statement": {
      "type": "string",
      "description": "Direct quote from the archive's terms of use"
    },
    "attribution": {
      "type": "string",
      "description": "Required text for crediting the source"
    },
    "redistribution_allowed": {
      "type": "boolean",
      "description": "True if we can include this in our Kaggle/GitHub dataset release"
    },
    "derivative_allowed": {
      "type": "boolean",
      "description": "True if we can alter the pitch/speed to create flawed variants"
    },
    "commercial_allowed": {
      "type": "boolean",
      "description": "True if allowed in a commercial SaaS product"
    },
    "restrictions": {
      "type": "array",
      "items": { "type": "string" },
      "description": "List of specific things we cannot do"
    },
    "verification_date": {
      "type": "string",
      "format": "date-time"
    },
    "verifier": {
      "type": "string",
      "description": "Name or email of the team member who executed the 10-step protocol"
    },
    "checksum": {
      "type": "string",
      "description": "SHA-256 hash of the downloaded file"
    },
    "notes": {
      "type": "string"
    }
  }
}
```

---

## 4. The Historical Recording Warning

**CRITICAL POLICY:** Many famous historical recordings (e.g., Winston Churchill's wartime speeches, early presidential addresses) were not recorded live. They are often later recreations, studio readings by the original speaker years later, or occasionally readings by voice actors. 

*   The dataset MUST NEVER claim that an archival recording is the original live delivery unless the provenance definitively supports that claim.
*   This is why `performance_date` and `recording_date` are strictly separated in the schema.
*   Example: LibriVox's "Gettysburg Address" was recorded in the 21st century by a volunteer. The `performance_date` is 1863. The `recording_date` is ~2013. The `speaker` is NOT Abraham Lincoln. Mislabeling this will result in massive penalties during judging.

*End of RIGHTS-PROVENANCE.md*


## Note
Consent fields for team/user recordings are now required.