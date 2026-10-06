# SPEECH ARENA: 02-DATA-SOURCES

## 1. Introduction

This document contains the complete, verified index of all external data sources authorized for use in the Speech Arena Track C project. 

As per the strict requirement: **"External corpora are inputs to a controlled data-engineering pipeline... they do not automatically become our custom contrastive dataset."** 

Every source here must be passed through the ingestion and alignment pipelines. Do not download a huge collection and claim it is the final dataset.

---

## 2. Source Categories

Sources are divided into five strict categories:
1.  **Reference:** High-quality public performances with verified provenance. Used as the "ideal" baseline.
2.  **Alignment/Acoustic Benchmark:** Massive datasets used *only* for training the underlying forced-alignment and feature-extraction models.
3.  **Rhetorical/Content:** Text-only or weakly-aligned data used for testing NLP aspects (e.g., debate structure).
4.  **Discovery/Archive:** Raw, unverified aggregators. Items found here must be traced back to primary sources.
5.  **Restricted/Research-Only:** Data that can be used to validate the model internally but *cannot* be redistributed in the final public dataset bundle due to licensing.

---

## 3. Priority Download / Dataset Index

This section lists the massive datasets required for baseline acoustic model training.

| ID | Name | Type | Size / Scope | License / Notes | Link |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **B-01** | Miller Center Archive | Reference | >1000 US Presidential Speeches. | Public Domain / Academic. Bulk `.tgz` available. | [Download Archive](https://data.millercenter.org/miller_center_speeches.tgz) |
| **B-02** | LibriSpeech (SLR12) | Acoustic | ~1000h 16kHz read English. | CC BY 4.0. Core alignment benchmark. | [SLR12](https://www.openslr.org/12/) |
| **B-03** | LibriTTS (SLR60) | Acoustic | ~585h 24kHz multi-speaker English. | CC BY 4.0. Contains original + normalized text. | [SLR60](https://www.openslr.org/60/) |
| **B-04** | Multilingual LibriSpeech | Acoustic | 8 languages, train/dev/test. | CC BY 4.0. | [SLR94](https://www.openslr.org/94/) |
| **B-05** | Bengali TTS | Acoustic | Indian/Bangladesh Bengali. | CC BY-SA 4.0. | [SLR37](https://www.openslr.org/37/) |
| **B-06** | Bengali ASR | Acoustic | ~196K utterances. | CC BY-SA 4.0. | [SLR53](https://www.openslr.org/53/) |
| **B-07** | Pansori-TEDxKR | Acoustic | ~3h Korean TEDx, 41 speakers. | **CC BY-NC-ND 4.0**. Restricts commercial/derivatives. | [SLR58](https://www.openslr.org/58/) |
| **B-08** | TEDx Spanish | Acoustic | 24h spontaneous Spanish. | **CC BY-NC-ND 4.0**. | [SLR67](https://www.openslr.org/67/) |
| **B-09** | Multilingual TEDx | Acoustic | Audio/transcripts/translations. | Varies by sub-dataset. Check individually. | [SLR100](https://www.openslr.org/100/) |
| **B-10** | LibriTTS-R | Acoustic | Restored audio quality. | CC BY 4.0. Use for audio-quality baselines. | [SLR141](https://www.openslr.org/141/) |
| **B-11** | IBM Debate Speeches | Rhetorical | 948 opening speeches (Text). | CDLA-Permissive-2.0. Not acoustic ground truth. | [HuggingFace](https://huggingface.co/datasets/ibm-research/debate_speeches) |

---

## 4. User-Supplied Source Link Index

These specific URLs were provided in the master prompt and must be investigated. All metadata must be manually verified at acquisition time.

### 4.1 Primary Archives (Search & Discovery)
*   **01. Miller Center Search:** [Search Portal](https://millercenter.org/search?search=Miller%20Center%20Presidential%20Speeches). Primary source for presidential audio and transcripts.
*   **02. American Rhetoric Top 100:** [Top 100 List](https://www.americanrhetoric.com/newtop100speeches.htm). *Warning:* Highly curated seed list. Audio rights are often murky or owned by media conglomerates. Treat as an index, find the primary source.
*   **03. OpenSLR Resources:** [Index](https://openslr.org/resources.php).
*   **04. IBM Debater EAP Tutorial:** [GitHub](https://github.com/IBM/debater-eap-tutorial). *Note:* Live API sunset in 2024. Use methodology, do not depend on the API.
*   **14. National Archives Press:** [Archive](https://www.archives.gov/press/press-releases/2003-12). Federal authority for provenance.
*   **18. JFK Library:** [Archive](https://www.jfklibrary.org/node/433966). Primary source.
*   **20. DPLA Item:** [Archive](https://dp.la/item/483e9dc56cc7121124f83b08b79d1c1c). Aggregation layer; follow to underlying institution.

### 4.2 Specific Audio Assets (Requires Strict Rights Verification)
*   **06. IBM/Kaggle Emphasized Words:** [Dataset](https://www.kaggle.com/datasets/bahraleloom/ibm-debater-and-reg-labeled-emphasized-words-in-speech). Use for expressive speech motivation.
*   **07. LibriVox Gettysburg:** [Asset](https://librivox.org/the-gettysburg-address-150th-anniversary-by-abraham-lincoln/). *Warning:* This is a modern volunteer reading, NOT Abraham Lincoln's original voice. Public domain (USA).
*   **08. Internet Archive Gettysburg:** [Asset](https://archive.org/details/gettysburg_johng_librivox).
*   **09. Wikimedia ARES Mirror:** [Asset](https://2016.ares-conference.eu/commons.wikimedia.org/wiki/Category_Audio_files_of_speeches.html).
*   **10. Reagan - Evil Empire:** [Wikimedia OGG](https://commons.wikimedia.org/wiki/File:Evil_Empire.ogg). 33:14 audio. Source: Miller Center. Public domain metadata.
*   **11. Nixon Resignation:** [Wikimedia OGG](https://commons.wikimedia.org/wiki/File:Nixon_resignation_audio.ogg). 15:22 audio. Source: Miller Center.
*   **12. FDR Pearl Harbor:** [Wikimedia OGG](https://commons.wikimedia.org/wiki/File:1941_Roosevelt_speech_pearlharbor_p1.ogg). *Warning:* Only 26 seconds long. Lacks source/author metadata. Do not use as a primary full-speech asset.
*   **13. Obama Inaugural:** [Wikimedia OGV](https://c.enwp.org/wiki/File:Barack_Obama_inaugural_address.ogv). Check federal status (typically public domain if official government feed).
*   **15. MSU Vincent Voice Library:** [Asset](https://d.lib.msu.edu/vvl/1739). Verify item-level rights.
*   **16. Columbia Time-Based Media:** [Asset](https://dlc.library.columbia.edu/time_based_media/10.7916/d8-vpnc-p531).
*   **17. History Today Churchill:** [Asset](https://historytoday.com/archive/feature/winston-churchill-record). *Warning:* Some Churchill speeches are highly restricted or are later studio recreations by actors. Verify provenance meticulously.
*   **19. OER Commons Samuel Gompers:** [Asset](https://www.oercommons.org/browse/keyword/samuel-gompers).

---

## 5. Ingestion Rules

1.  **Never Assume:** Do not assume a site provides every required field (audio + perfect transcript + rights).
2.  **Unverified Flag:** If a page cannot be independently verified (e.g., 404 error, sparse metadata), mark it as `UNVERIFIED` in the database rather than inventing or guessing metadata.
3.  **Hash Verification:** Upon downloading any `.wav` or `.ogg`, immediately compute its SHA-256 hash and store it in the rights manifest.

*End of DATA-SOURCES.md*
