/**
 * Reference speeches registered in datasets/rights/*.json and datasets/registry/sources.yaml.
 * Only the Gettysburg passage text is bundled; for the others the user pastes the passage.
 */
export interface ReferenceSpeech {
  id: string
  title: string
  speaker: string
  license: string
  text: string
}

export const GETTYSBURG_OPENING =
  'Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal. Now we are engaged in a great civil war, testing whether that nation, or any nation so conceived and so dedicated, can long endure.'

export const REFERENCES: ReferenceSpeech[] = [
  {
    id: 'asset-07',
    title: 'Gettysburg Address (opening)',
    speaker: 'LibriVox volunteer reading',
    license: 'Public domain',
    text: GETTYSBURG_OPENING,
  },
  { id: 'asset-10', title: 'Evil Empire Speech', speaker: 'Ronald Reagan', license: 'Public domain', text: '' },
  { id: 'asset-11', title: 'Resignation Address', speaker: 'Richard Nixon', license: 'Public domain', text: '' },
  { id: 'custom', title: 'My own passage', speaker: 'No reference speaker', license: '—', text: '' },
]
