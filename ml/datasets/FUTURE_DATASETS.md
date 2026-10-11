# Future Datasets for Speech Flaw Classifier

This document serves as a reference for real-world audio datasets to be downloaded and integrated when moving from the synthetic (dummy) data pipeline to the final, production-ready machine learning training pipeline.

## 1. "Good Speech" Datasets (Fluent & Expert Delivery)
These datasets contain high-quality, professional, and historic speeches. They serve as **positive training examples** for the model to learn excellent pacing, dynamic intonation, and powerful emphasis.

*   **IBM Research Debate Speeches**
    *   *Link:* [HuggingFace - ibm-research/debate_speeches](https://huggingface.co/datasets/ibm-research/debate_speeches)
    *   *Details:* Contains human and AI-generated debate speeches scored for quality. (Note: Primarily text transcripts, useful for NLP and emphasis tracking).
*   **Miller Center Presidential Speeches**
    *   *Link:* [Miller Center Search](https://millercenter.org/search?search=Miller%20Center%20Presidential%20Speeches)
    *   *Details:* High-quality audio and verified transcripts of US Presidents. Excellent for teaching the model "presidential pacing".
*   **American Rhetoric Top 100 Speeches**
    *   *Link:* [American Rhetoric](https://www.americanrhetoric.com/newtop100speeches.htm)
    *   *Details:* A curated list of the most influential speeches (e.g., MLK, JFK) with high acoustic variance.
*   **OpenSLR Datasets**
    *   *Link:* [OpenSLR Resources](https://openslr.org/resources.php)
    *   *Details:* Massive speech corpora (like LibriSpeech, 1000+ hours). Provides a massive baseline of fluent, clear, and perfectly enunciated English.
*   **LibriVox & Wikimedia Commons**
    *   *Links:* [Gettysburg Address](https://librivox.org/the-gettysburg-address-150th-anniversary), [I Have a Dream](https://upload.wikimedia.org/wikipedia/commons/4/4b/I_Have_A_Dream_speech_by_Martin_Luther_King._Jr..ogg)
    *   *Details:* Raw audio files of historical speeches.

## 2. "Bad Speech" Datasets (Disfluencies, Stuttering, & Filler Words)
These datasets contain annotated speech flaws. They serve as **negative training examples** so the model learns to detect and flag these specific issues.

*   **SEP-28k (Stuttering Events in Podcasts)**
    *   *Details:* The premier dataset for stuttering and filler words. Contains over 28,000 labeled 3-second audio clips with specific annotations for blocks, prolongations, repetitions, and interjections (filler words like "um", "uh").
*   **FluencyBank**
    *   *Details:* Features approximately 4,000 annotated audio/video clips specifically studied by speech-language pathologists. Often used alongside SEP-28k.
*   **LibriStutter**
    *   *Details:* A synthesized dataset of artificial stutters applied to the LibriSpeech corpus. Great for benchmarking stuttering detection models.
*   **AS-70 & LearnerVoice**
    *   *Details:* Datasets focusing on non-native speakers and conversational speech containing high prevalence of disfluencies, restarts, and false starts.

## Integration Plan
When we are ready to replace `download_advanced_datasets.py` with real audio:
1.  **Authentication:** Obtain API keys (HuggingFace, Kaggle) to programmatically download the datasets.
2.  **Audio Processing:** Write Python scripts using `librosa` or `soundfile` to slice the large audio files into 5-10 second chunks.
3.  **Label Mapping:** Map the dataset-specific annotations (e.g., SEP-28k's "interjection") to our model's expected flaws (e.g., "FILLER_HEAVY", "TOO_FAST", "MONOTONE").
4.  **Feature Extraction:** Process all raw audio through `Wav2Vec2` before feeding them into our classifier.
